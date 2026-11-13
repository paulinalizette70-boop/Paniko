'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const {ValidationError,bakerPercentages,validateRecipe} = require('./domain');
const {createStore} = require('./store');
const {getCookieToken,cookieForToken,expiredCookie}=require('./auth');

// Los costos y el presupuesto son información de administración, no del equipo operativo.
// Filtrar también los campos anidados: ocultar botones NO protege la API.
const FINANCIAL_KEYS=/^(costPerUnit|unitCost|estimatedCost|estimatedTotalCost|cost(?:s|_.*)?|costo(?:s|_.*)?|precio(?:$|[_-].*)|price(?:$|[_-].*)|presupuesto|margen|utilidad|ganancia|gasto(?:s|_.*)?|ingreso(?:s|_.*)?|inversion|inversión|valorInventario)$/i;
function operationalData(value){
  if(Array.isArray(value))return value.map(operationalData);
  if(value&&typeof value==='object'&&!(value instanceof Date)){
    return Object.fromEntries(Object.entries(value).filter(([key])=>!FINANCIAL_KEYS.test(key))
      .map(([key,entry])=>[key,operationalData(entry)]));
  }
  return value;
}


function createApp({store, auth = null, products = null, finance = null, sourdough = null, dataFile = path.join(__dirname, '..', 'data', 'paniko.json')} = {}) {
  store = store || createStore(dataFile);
  const assets = {
    '/': ['index.html', 'text/html; charset=utf-8'],
    '/styles.css': ['styles.css', 'text/css; charset=utf-8'],
    '/app.js': ['app.js', 'application/javascript; charset=utf-8'],
    '/products.js': ['products.js', 'application/javascript; charset=utf-8'],
    '/sourdough.js': ['sourdough.js', 'application/javascript; charset=utf-8'],
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
    let loggedInUser=null;
    const respond=(status,data,extraHeaders={})=>send(res,status,
      loggedInUser?.role==='operador'?operationalData(data):data,extraHeaders);
    try {
      const url = new URL(req.url, 'http://localhost');
      const pathname = url.pathname;
      if (req.method === 'GET' && assets[pathname]) {
        const [file, contentType] = assets[pathname];
        res.writeHead(200, {'Content-Type': contentType, 'X-Content-Type-Options': 'nosniff'});
        res.end(fs.readFileSync(path.join(__dirname, '..', 'public', file)));
        return;
      }
      if (req.method === 'GET' && pathname === '/api/health') return respond( 200, {status: 'ok'});
      if (req.method === 'GET' && pathname === '/api/auth/config') return respond(200,{required:Boolean(auth)});
      if (auth) {
        if(req.method==='POST' && req.headers.origin) {
          let origin;
          try {origin=new URL(req.headers.origin);} catch {return respond(403,{error:'Origen no permitido'});}
          if(origin.host!==req.headers.host) return respond(403,{error:'Origen no permitido'});
        }
        const token=getCookieToken(req.headers.cookie);
        if(req.method==='POST' && pathname==='/api/auth/login') {
          const body=await bodyAsJson(req);
          const result=await auth.login(body?.username,body?.password);
          if(!result)return respond(401,{error:'Usuario o contraseña incorrectos'});
          return respond(200,{user:result.user},{'Set-Cookie':cookieForToken(result.token,Boolean(req.socket.encrypted))});
        }
        if(req.method==='POST' && pathname==='/api/auth/logout'){
          await auth.logout(token);
          return respond(200,{ok:true},{'Set-Cookie':expiredCookie(Boolean(req.socket.encrypted))});
        }
        if(req.method==='GET' && pathname==='/api/auth/me'){
          const user=await auth.userForToken(token);
          return user?send(res,200,{user}):send(res,401,{error:'Sesión no iniciada'});
        }
        if(pathname.startsWith('/api/')){
          const user=await auth.userForToken(token);
          loggedInUser=user;
          if(!user)return respond(401,{error:'Inicia sesión para continuar'});
          if(pathname==='/api/private/catalog' && req.method==='GET'){
            return respond(200,await auth.privateCatalog());
          }
          // El personal opera recetas e inventario. Las finanzas sí son exclusivas de administración.
          if(pathname.startsWith('/api/finance/')&&user.role!=='admin')
            return respond(403,{error:'La gestión financiera requiere permiso de administración'});
        }
      }

      // Productos terminados: inventario separado de las fichas técnicas.
      if(pathname==='/api/product-categories'||pathname.startsWith('/api/products')){
        if(!auth||!products)return respond(503,{error:'El módulo de inventario requiere inicio de sesión y MySQL'});
        const user=await auth.userForToken(getCookieToken(req.headers.cookie));
        if(!user)return respond(401,{error:'Inicia sesión para continuar'});
        const admin=user.role==='admin';
        if(pathname==='/api/product-categories'){
          if(req.method==='GET')return respond(200,await products.listCategories());
          if(req.method==='POST'){
            return respond(201,await products.createCategory(await bodyAsJson(req)));
          }
        }
        if(pathname==='/api/products'){
          if(req.method==='GET')return respond(200,await products.listProducts());
          if(req.method==='POST'){
            const input=await bodyAsJson(req);
            // Un operador no puede establecer el precio: lo configura administración.
            if(!admin)input.salePrice=null;
            return respond(201,await products.createProduct(input));
          }
        }
        if(pathname==='/api/products/import-catalog'&&req.method==='POST'){
          return respond(200,await products.importCatalog());
        }
        if(pathname==='/api/products/movements'&&req.method==='GET')
          return respond(200,await products.movements());
        const edit=pathname.match(/^\/api\/products\/([a-f\d-]+)\/update$/i);
        if(edit&&req.method==='POST'){
          return respond(200,await products.updateProduct(edit[1],await bodyAsJson(req),{preservePrice:!admin}));
        }
        const move=pathname.match(/^\/api\/products\/([a-f\d-]+)\/movements$/i);
        if(move&&req.method==='POST')return respond(201,await products.recordMovement(move[1],await bodyAsJson(req)));
        return respond(404,{error:'Ruta de productos no encontrada'});
      }
      // Seguimiento de masa madre: lectura y alimentación para personal con sesión.
      // No descuenta ingredientes del inventario automáticamente.
      if(pathname.startsWith('/api/sourdough/')){
        if(!auth||!sourdough)return respond(503,{error:'Módulo de masa madre no disponible: verifica la migración MySQL'});
        if(!loggedInUser)return respond(401,{error:'Inicia sesión para continuar'});
        if(pathname==='/api/sourdough/starters'){
          if(req.method==='GET')return respond(200,await sourdough.listStarters());
          if(req.method==='POST')return respond(201,await sourdough.createStarter(await bodyAsJson(req)));
        }
        const starterAction=pathname.match(/^\/api\/sourdough\/starters\/([a-f\d-]{36})\/(update|feed|feedings)$/i);
        if(starterAction){
          const [,id,action]=starterAction;
          if(action==='update'&&req.method==='POST')return respond(200,await sourdough.updateStarter(id,await bodyAsJson(req)));
          if(action==='feed'&&req.method==='POST')return respond(201,await sourdough.feed(id,await bodyAsJson(req)));
          if(action==='feedings'&&req.method==='GET')return respond(200,await sourdough.feedings(id));
        }
        return respond(404,{error:'Operación de masa madre no encontrada'});
      }
      // Control financiero exclusivo de administración, también a nivel de API.
      if(pathname==='/api/finance/dashboard'&&req.method==='GET'){
        if(!auth||loggedInUser?.role!=='admin')return respond(403,{error:'Solo administración puede consultar las ganancias'});
        if(!finance)return respond(503,{error:'Panel financiero no disponible: verifica la migración MySQL'});
        const days=Number(url.searchParams.get('days')||7);
        return respond(200,await finance.dashboard(days));
      }
      if(pathname==='/api/finance/expenses'&&req.method==='POST'){
        if(!auth||loggedInUser?.role!=='admin')return respond(403,{error:'Solo administración puede registrar gastos'});
        if(!finance)return respond(503,{error:'Panel financiero no disponible: verifica la migración MySQL'});
        return respond(201,await finance.addExpense(await bodyAsJson(req)));
      }
      if(pathname==='/api/finance/products'&&req.method==='GET'){
        if(!auth||!loggedInUser||loggedInUser.role!=='admin')
          return respond(403,{error:'Solo administración puede consultar los costos de productos'});
        if(!products?.listFinancials)return respond(503,{error:'El inventario de productos requiere MySQL'});
        return respond(200,await products.listFinancials());
      }
      const financialProduct=pathname.match(/^\/api\/finance\/products\/([a-f\d-]+)\/pricing$/i);
      if(financialProduct&&req.method==='POST'){
        if(!auth||!loggedInUser||loggedInUser.role!=='admin')
          return respond(403,{error:'Solo administración puede editar costos y precios de productos'});
        if(!products?.updateFinancials)return respond(503,{error:'El inventario de productos requiere MySQL'});
        return respond(200,await products.updateFinancials(financialProduct[1],await bodyAsJson(req)));
      }
      if(pathname==='/api/finance/overview'&&req.method==='GET'){
        if(!auth||!loggedInUser||loggedInUser.role!=='admin')return respond(403,{error:'Acceso exclusivo a administración'});
        const [ingredients,batches]=await Promise.all([store.listIngredients(),store.listProduction()]);
        const detailed=ingredients.map(item=>({...item,inventoryValue:Math.round(item.stock*item.costPerUnit*100)/100}));
        return respond(200,{ingredients:detailed,inventoryValue:Math.round(detailed.reduce((s,item)=>s+item.inventoryValue,0)*100)/100,
          recentBatchCost:Math.round(batches.reduce((s,b)=>s+Number(b.estimatedTotalCost||0),0)*100)/100,
          batchesConsidered:batches.length});
      }
      const costUpdate=pathname.match(/^\/api\/finance\/ingredients\/([a-f\d-]+)\/cost$/i);
      if(costUpdate&&req.method==='POST'){
        if(!auth||!loggedInUser||loggedInUser.role!=='admin')return respond(403,{error:'Acceso exclusivo a administración'});
        const input=await bodyAsJson(req);
        return respond(200,await store.updateIngredientCost(costUpdate[1],input.costPerUnit));
      }
      if (req.method === 'GET' && pathname === '/api/ingredients') return respond( 200, await store.listIngredients());
      if (req.method === 'POST' && pathname === '/api/ingredients') {
        const input=await bodyAsJson(req);
        if(loggedInUser?.role==='operador')input.costPerUnit=0;
        return respond(201, await store.addIngredient(input));
      }
      const originalEdit=pathname.match(/^\/api\/catalog\/recipes\/([a-z][a-z0-9_]{0,99})\/save$/);
      if(originalEdit&&req.method==='POST'){
        if(!auth?.saveCatalogRecipe)return respond(503,{error:'Se requiere MySQL e inicio de sesión para editar recetas originales'});
        return respond(200,await auth.saveCatalogRecipe(originalEdit[1],await bodyAsJson(req)));
      }
      const fromCatalog=pathname.match(/^\/api\/recipes\/from-catalog\/([a-z][a-z0-9_]{0,99})$/);
      if(fromCatalog&&req.method==='POST'){
        if(!auth?.getCatalogRecipe||!store.importCatalogRecipe)
          return respond(503,{error:'La conversión de recetas necesita MySQL y una sesión iniciada'});
        const source=await auth.getCatalogRecipe(fromCatalog[1]);
        if(!source)return respond(404,{error:'Receta original no encontrada'});
        const input=await bodyAsJson(req);
        const result=await store.importCatalogRecipe(source,input?.baseYield??null);
        return respond(result.existing?200:201,result);
      }
      if (req.method === 'GET' && pathname === '/api/recipes') return respond( 200, await store.listRecipes());
      if (req.method === 'POST' && pathname === '/api/recipes') return respond( 201, await store.addRecipe(await bodyAsJson(req)));
      const recipeEdit=pathname.match(/^\/api\/recipes\/([a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12})\/update$/i);
      if(recipeEdit&&req.method==='POST')return respond(200,await store.updateRecipe(recipeEdit[1],await bodyAsJson(req)));
      if(req.method==='POST' && pathname==='/api/recipes/bakers-preview'){
        const input=await bodyAsJson(req);
        const ingredients=await store.listIngredients();
        const validated=validateRecipe(input,ingredients);
        return respond(200,{recipeName:validated.name,baseYield:validated.baseYield,
          ...bakerPercentages(validated,ingredients)});
      }
      const bakers=pathname.match(/^\/api\/recipes\/([a-f\d-]+)\/bakers$/i);
      if(req.method==='GET' && bakers){
        const recipe=await store.getRecipe(bakers[1]);
        if(!recipe)return respond(404,{error:'Ficha técnica no encontrada'});
        const calculation=bakerPercentages(recipe,await store.listIngredients());
        return respond(200,{recipeId:recipe.id,recipeName:recipe.name,baseYield:recipe.baseYield,...calculation});
      }
      if (req.method === 'GET' && pathname === '/api/inventory/movements') return respond( 200, await store.listMovements());
      if (req.method === 'GET' && pathname === '/api/production') return respond( 200, await store.listProduction());
      const batchDetail=pathname.match(/^\/api\/production\/([a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12})$/i);
      if(req.method==='GET'&&batchDetail) return respond(200,await store.getProductionBatch(batchDetail[1]));
      const stock = pathname.match(/^\/api\/ingredients\/([a-f\d-]+)\/stock-in$/i);
      if (stock && req.method === 'POST') return respond( 200, await store.stockIn(stock[1], await bodyAsJson(req)));
      const stockOut=pathname.match(/^\/api\/ingredients\/([a-f\d-]+)\/stock-out$/i);
      if(stockOut&&req.method==='POST')return respond(200,await store.stockOut(stockOut[1],await bodyAsJson(req)));
      const adjust=pathname.match(/^\/api\/ingredients\/([a-f\d-]+)\/adjust-stock$/i);
      if(adjust&&req.method==='POST')return respond(200,await store.adjustStock(adjust[1],await bodyAsJson(req)));
      const scale = pathname.match(/^\/api\/recipes\/([a-f\d-]+)\/scale$/i);
      if (scale && req.method === 'POST') {
        const body = await bodyAsJson(req);
        return respond( 200, await store.preview(scale[1], body.desiredYield));
      }
      const produce = pathname.match(/^\/api\/recipes\/([a-f\d-]+)\/produce$/i);
      if (produce && req.method === 'POST') {
        const body = await bodyAsJson(req);
        return respond( 201, await store.confirmProduction(produce[1], body.desiredYield, {productId:body.productId||null}));
      }
      respond(404, {error: 'Ruta no encontrada'});
    } catch (error) {
      if (!(error instanceof ValidationError)) console.error('Error interno', error);
      send(res, error instanceof ValidationError ? error.status : 500,
        {error: error instanceof ValidationError ? error.message : 'Error interno del servidor'});
    }
  });
}
module.exports = {createApp};
