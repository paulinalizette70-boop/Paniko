'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const {ValidationError} = require('./domain');
const {createStore} = require('./store');
const {getCookieToken,cookieForToken,expiredCookie}=require('./auth');

function createApp({store, auth = null, dataFile = path.join(__dirname, '..', 'data', 'paniko.json')} = {}) {
  store = store || createStore(dataFile);
  const assets = {
    '/': ['index.html', 'text/html; charset=utf-8'],
    '/styles.css': ['styles.css', 'text/css; charset=utf-8'],
    '/app.js': ['app.js', 'application/javascript; charset=utf-8'],
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
      if (req.method === 'GET' && pathname === '/api/auth/config')
        return send(res,200,{required: Boolean(auth)});
      if (auth) {
        // SameSite=Strict + comprobación Origin en peticiones con cambios.
        if (req.method === 'POST' && req.headers.origin) {
          let from;
          try { from=new URL(req.headers.origin); } catch { return send(res,403,{error:'Origen no permitido'}); }
          if (from.host!==req.headers.host) return send(res,403,{error:'Origen no permitido'});
        }
        const token=getCookieToken(req.headers.cookie);
        if (pathname === '/api/auth/login' && req.method === 'POST') {
          const credentials=await bodyAsJson(req);
          const result=await auth.login(credentials?.username,credentials?.password);
          if (!result) return send(res,401,{error:'Usuario o contraseña incorrectos'});
          return send(res,200,{user:result.user},{'Set-Cookie':cookieForToken(result.token,Boolean(req.socket.encrypted))});
        }
        if (pathname === '/api/auth/logout' && req.method === 'POST') {
          await auth.logout(token);
          return send(res,200,{ok:true},{'Set-Cookie':expiredCookie(Boolean(req.socket.encrypted))});
        }
        if (req.method === 'GET' && pathname === '/api/auth/me') {
          const user=await auth.userForToken(token);
          return user?send(res,200,{user}):send(res,401,{error:'Sesión no iniciada'});
        }
        // Es obligatorio autenticar ANTES de consultar cualquier ruta de datos.
        if (pathname.startsWith('/api/')) {
          const user=await auth.userForToken(token);
          if (!user) return send(res,401,{error:'Inicia sesión para continuar'});
          if (pathname==='/api/private/catalog' && req.method==='GET') {
            if (user.role!=='admin') return send(res,403,{error:'Acceso reservado a administración'});
            return send(res,200,await auth.privateCatalog());
          }
          const adminOnly=req.method!=='GET' &&
            (pathname==='/api/ingredients' || pathname==='/api/recipes');
          if (adminOnly && user.role!=='admin') return send(res,403,{error:'Se requiere permiso de administrador'});
        }
      }
      if (req.method === 'GET' && pathname === '/api/ingredients') return send(res, 200, await store.listIngredients());
      if (req.method === 'POST' && pathname === '/api/ingredients') return send(res, 201, await store.addIngredient(await bodyAsJson(req)));
      if (req.method === 'GET' && pathname === '/api/recipes') return send(res, 200, await store.listRecipes());
      if (req.method === 'POST' && pathname === '/api/recipes') return send(res, 201, await store.addRecipe(await bodyAsJson(req)));
      if (req.method === 'GET' && pathname === '/api/inventory/movements') return send(res, 200, await store.listMovements());
      if (req.method === 'GET' && pathname === '/api/production') return send(res, 200, await store.listProduction());
      const stock = pathname.match(/^\/api\/ingredients\/([a-f\d-]+)\/stock-in$/i);
      if (stock && req.method === 'POST') return send(res, 200, await store.stockIn(stock[1], await bodyAsJson(req)));
      const stockOut = pathname.match(/^\/api\/ingredients\/([a-f\d-]+)\/stock-out$/i);
      if (stockOut && req.method === 'POST') return send(res, 200, await store.stockOut(stockOut[1], await bodyAsJson(req)));
      const adjustStock = pathname.match(/^\/api\/ingredients\/([a-f\d-]+)\/adjust-stock$/i);
      if (adjustStock && req.method === 'POST') return send(res, 200, await store.adjustStock(adjustStock[1], await bodyAsJson(req)));
      const scale = pathname.match(/^\/api\/recipes\/([a-f\d-]+)\/scale$/i);
      if (scale && req.method === 'POST') {
        const body = await bodyAsJson(req);
        return send(res, 200, await store.preview(scale[1], body.desiredYield));
      }
      const produce = pathname.match(/^\/api\/recipes\/([a-f\d-]+)\/produce$/i);
      if (produce && req.method === 'POST') {
        const body = await bodyAsJson(req);
        return send(res, 201, await store.confirmProduction(produce[1], body.desiredYield));
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
