'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const {ValidationError} = require('./domain');
const {createStore} = require('./store');
const {getCookieToken,cookieForToken,expiredCookie}=require('./auth');

function createApp({store, auth = null, products = null, dataFile = path.join(__dirname, '..', 'data', 'paniko.json')} = {}) {
  store = store || createStore(dataFile);
  const assets = {
    '/': ['index.html', 'text/html; charset=utf-8'],
    '/styles.css': ['styles.css', 'text/css; charset=utf-8'],
    '/app.js': ['app.js', 'application/javascript; charset=utf-8'],
    '/products.js': ['products.js', 'application/javascript; charset=utf-8'],
  };
  async function bodyAsJson(req) {
    let size = 0; const chunks=[];
    for await (const chunk of req) {
      size += chunk.length;
      if (size > 1024 * 1024) throw new ValidationError('Solicitud demasiado grande', 413);
      chunks.push(chunk);
    }
    try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
    catch { throw new ValidationError('JSON inválido'); }
  }
  const send = (res, status, data, extraHeaders={}) => {
    res.writeHead(status, {'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options':'nosniff',...extraHeaders});
    res.end(JSON.stringify(data));
  };
  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      const pathname = url.pathname;
      if (req.method === 'GET' && assets[pathname]) {
        const [file, contentType] = assets[pathname];
        res.writeHead(200, {'Content-Type': contentType, 'X-Content-Type-Options': 'nosniff'});
        res.end(fs.readFileSync(path.join(__dirname, '..', 'public', file)));
        return;
      }
      if (req.method === 'GET' && pathname === '/api/health') return send(res, 200, {status: 'ok'});
      if (req.method === 'GET' && pathname === '/api/auth/config') return send(res,200,{required:Boolean(auth)});
      if (auth) {
        if(req.method==='POST' && req.headers.origin) {
          let origin;
          try {origin=new URL(req.headers.origin);} catch {return send(res,403,{error:'Origen no permitido'});}
          if(origin.host!==req.headers.host) return send(res,403,{error:'Origen no permitido'});
        }
        const token=getCookieToken(req.headers.cookie);
        if(req.method==='POST' && pathname==='/api/auth/login') {
          const body=await bodyAsJson(req);
          const result=await auth.login(body?.username,body?.password);
          if(!result)return send(res,401,{error:'Usuario o contraseña incorrectos'});
          return send(res,200,{user:result.user},{'Set-Cookie':cookieForToken(result.token,Boolean(req.socket.encrypted))});
        }
        if(req.method==='POST' && pathname==='/api/auth/logout'){
          await auth.logout(token);
          return send(res,200,{ok:true},{'Set-Cookie':expiredCookie(Boolean(req.socket.encrypted))});
        }
        if(req.method==='GET' && pathname==='/api/auth/me'){
          const user=await auth.userForToken(token);
          return user?send(res,200,{user}):send(res,401,{error:'Sesión no iniciada'});
        }
        if(pathname.startsWith('/api/')){
          const user=await auth.userForToken(token);
          if(!user)return send(res,401,{error:'Inicia sesión para continuar'});
          if(pathname==='/api/private/catalog' && req.method==='GET'){
            if(user.role!=='admin')return send(res,403,{error:'Acceso reservado a administración'});
            return send(res,200,await auth.privateCatalog());
          }
          if(req.method==='POST' && user.role!=='admin' &&
             (pathname==='/api/ingredients'||pathname==='/api/recipes'||/\/api\/ingredients\/[a-f\d-]+\/adjust-stock$/i.test(pathname)))
            return send(res,403,{error:'Se requiere permiso de administrador'});
        }
      }

      // Productos terminados: inventario separado de las fichas técnicas privadas.
      if(pathname==='/api/product-categories'||pathname.startsWith('/api/products')){
        if(!auth||!products)return send(res,503,{error:'El módulo de inventario requiere inicio de sesión y MySQL'});
        const user=await auth.userForToken(getCookieToken(req.headers.cookie));
        if(!user)return send(res,401,{error:'Inicia sesión para continuar'});
        const admin=user.role==='admin';
        if(pathname==='/api/product-categories'){
          if(req.method==='GET')return send(res,200,await products.listCategories());
          if(req.method==='POST'){
            if(!admin)return send(res,403,{error:'Se requiere permiso de administrador'});
            return send(res,201,await products.createCategory(await bodyAsJson(req)));
          }
        }
        if(pathname==='/api/products'){
          if(req.method==='GET')return send(res,200,await products.listProducts());
          if(req.method==='POST'){
            if(!admin)return send(res,403,{error:'Se requiere permiso de administrador'});
            return send(res,201,await products.createProduct(await bodyAsJson(req)));
          }
        }
        if(pathname==='/api/products/import-catalog'&&req.method==='POST'){
          if(!admin)return send(res,403,{error:'Se requiere permiso de administrador'});
          return send(res,200,await products.importCatalog());
        }
        if(pathname==='/api/products/movements'&&req.method==='GET')
          return send(res,200,await products.movements());
        const edit=pathname.match(/^\/api\/products\/([a-f\d-]+)\/update$/i);
        if(edit&&req.method==='POST'){
          if(!admin)return send(res,403,{error:'Se requiere permiso de administrador'});
          return send(res,200,await products.updateProduct(edit[1],await bodyAsJson(req)));
        }
        const move=pathname.match(/^\/api\/products\/([a-f\d-]+)\/movements$/i);
        if(move&&req.method==='POST')return send(res,201,await products.recordMovement(move[1],await bodyAsJson(req)));
        return send(res,404,{error:'Ruta de productos no encontrada'});
      }
      if (req.method === 'GET' && pathname === '/api/ingredients') return send(res, 200, await store.listIngredients());
      if (req.method === 'POST' && pathname === '/api/ingredients') return send(res, 201, await store.addIngredient(await bodyAsJson(req)));
      if (req.method === 'GET' && pathname === '/api/recipes') return send(res, 200, await store.listRecipes());
      if (req.method === 'POST' && pathname === '/api/recipes') return send(res, 201, await store.addRecipe(await bodyAsJson(req)));
      if (req.method === 'GET' && pathname === '/api/inventory/movements') return send(res, 200, await store.listMovements());
      if (req.method === 'GET' && pathname === '/api/production') return send(res, 200, await store.listProduction());
      const batchDetail=pathname.match(/^\/api\/production\/([a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12})$/i);
      if(req.method==='GET'&&batchDetail) return send(res,200,await store.getProductionBatch(batchDetail[1]));
      const stock = pathname.match(/^\/api\/ingredients\/([a-f\d-]+)\/stock-in$/i);
      if (stock && req.method === 'POST') return send(res, 200, await store.stockIn(stock[1], await bodyAsJson(req)));
      const stockOut=pathname.match(/^\/api\/ingredients\/([a-f\d-]+)\/stock-out$/i);
      if(stockOut&&req.method==='POST')return send(res,200,await store.stockOut(stockOut[1],await bodyAsJson(req)));
      const adjust=pathname.match(/^\/api\/ingredients\/([a-f\d-]+)\/adjust-stock$/i);
      if(adjust&&req.method==='POST')return send(res,200,await store.adjustStock(adjust[1],await bodyAsJson(req)));
      const scale = pathname.match(/^\/api\/recipes\/([a-f\d-]+)\/scale$/i);
      if (scale && req.method === 'POST') {
        const body = await bodyAsJson(req);
        return send(res, 200, await store.preview(scale[1], body.desiredYield));
      }
      const produce = pathname.match(/^\/api\/recipes\/([a-f\d-]+)\/produce$/i);
      if (produce && req.method === 'POST') {
        const body = await bodyAsJson(req);
        return send(res, 201, await store.confirmProduction(produce[1], body.desiredYield, {productId:body.productId||null}));
      }
      send(res, 404, {error: 'Ruta no encontrada'});
    } catch (error) {
      if (!(error instanceof ValidationError)) console.error('Error interno', error);
      send(res, error instanceof ValidationError ? error.status : 500,
        {error: error instanceof ValidationError ? error.message : 'Error interno del servidor'});
    }
  });
}
module.exports = {createApp};
