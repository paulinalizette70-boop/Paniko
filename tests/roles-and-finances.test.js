'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {once}=require('node:events');
const {randomUUID}=require('node:crypto');
const {createApp}=require('../src/app');
const {createStore}=require('../src/store');
const {createMysqlStore}=require('../src/mysql-store');
const {createFinishedProductStore}=require('../src/finished-products');

const ADMIN='A'.repeat(43),OPER='B'.repeat(43);
function headers(token){return token?{Cookie:'paniko_session='+token}:{}};

test('ROLES-01 recetas internas visibles para el personal; cifras financieras no se filtran al operador',async t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'paniko-role071-'));
  const store=createStore(path.join(dir,'data.json'));
  const flour=store.addIngredient({name:'Harina ficticia',unit:'kg',costPerUnit:42,stock:4});
  const recipe=store.addRecipe({name:'Pan ficticio',baseYield:10,items:[{ingredientId:flour.id,quantity:1}]});
  const batch=store.confirmProduction(recipe.id,10);
  const auth={
    async userForToken(token){return token===ADMIN?{username:'admin',role:'admin'}:token===OPER?{username:'equipo',role:'operador'}:null;},
    async privateCatalog(){return {recetas:[{title:'Masa de prueba',status:'confirmada',data:{nombre:'Masa de prueba',ingredientes:[{ingrediente:'Harina',cantidad:1,unidad:'kg',costo:999}],costo:1337,notas:'Solo demostración'}}],rellenos:[{title:'Relleno ficticio',data:{nombre:'Relleno ficticio',precio_venta:55}}],productos:[]};}
  };
  const server=createApp({store,auth});server.listen(0,'127.0.0.1');await once(server,'listening');
  t.after(async()=>{await new Promise(resolve=>server.close(resolve));fs.rmSync(dir,{recursive:true,force:true});});
  const base='http://127.0.0.1:'+server.address().port;
  const get=async(route,token)=>fetch(base+route,{headers:headers(token)});
  const post=async(route,token,body)=>fetch(base+route,{method:'POST',headers:{...headers(token),'Content-Type':'application/json'},body:JSON.stringify(body)});
  assert.equal((await get('/api/private/catalog')).status,401);
  const catalogResponse=await get('/api/private/catalog',OPER);
  assert.equal(catalogResponse.status,200);
  const catalog=await catalogResponse.json();
  assert.equal(catalog.recetas[0].data.nombre,'Masa de prueba');
  assert.equal(catalog.recetas[0].data.ingredientes[0].cantidad,1);
  assert.equal('costo' in catalog.recetas[0].data,false);
  assert.equal('costo' in catalog.recetas[0].data.ingredientes[0],false);
  assert.equal('precio_venta' in catalog.rellenos[0].data,false);
  const byAdmin=await (await get('/api/private/catalog',ADMIN)).json();
  assert.equal(byAdmin.recetas[0].data.costo,1337);

  const ingOper=await (await get('/api/ingredients',OPER)).json();
  assert.equal('costPerUnit' in ingOper[0],false);
  assert.equal((await get('/api/finance/overview',OPER)).status,403);
  assert.equal((await post(`/api/finance/ingredients/${flour.id}/cost`,OPER,{costPerUnit:7})).status,403);

  const preview=await (await post(`/api/recipes/${recipe.id}/scale`,OPER,{desiredYield:15})).json();
  assert.equal(preview.lines[0].required,1.5);
  assert.equal('estimatedTotalCost' in preview,false);
  assert.equal('estimatedCost' in preview.lines[0],false);
  const history=await (await get('/api/production',OPER)).json();
  assert.equal('estimatedTotalCost' in history[0],false);
  const detail=await (await get('/api/production/'+batch.id,OPER)).json();
  assert.equal('estimatedCost' in detail.lines[0],false);
  assert.equal('unitCost' in detail.lines[0],false);

  const added=await post('/api/ingredients',OPER,{name:'Levadura prueba',unit:'kg',costPerUnit:499,stock:1});
  assert.equal(added.status,201);
  assert.equal(store.listIngredients().find(i=>i.name==='Levadura prueba').costPerUnit,0);
  const createdRecipe=await post('/api/recipes',OPER,{name:'Receta del equipo',baseYield:5,items:[{ingredientId:flour.id,quantity:0.5}]});
  assert.equal(createdRecipe.status,201);
  const finance=await (await get('/api/finance/overview',ADMIN)).json();
  assert.equal(finance.inventoryValue,3*42);
  assert.equal(finance.recentBatchCost,42);
  assert.equal(finance.ingredients[0].costPerUnit,42);
  const update=await post(`/api/finance/ingredients/${flour.id}/cost`,ADMIN,{costPerUnit:43.5});
  assert.equal(update.status,200);
  assert.equal(store.listIngredients().find(i=>i.id===flour.id).costPerUnit,43.5);
  assert.equal((await post(`/api/finance/ingredients/${flour.id}/cost`,ADMIN,{costPerUnit:-3})).status,400);
});

test('ROLES-02 operador no cambia precio de producto aunque manipule la petición',async()=>{
  const id=randomUUID();let actual=55;
  const pool={async execute(sql,values){
    if(sql.startsWith('SELECT sale_price FROM finished_products'))return [[{sale_price:String(actual)}]];
    if(sql.startsWith('UPDATE finished_products SET')){actual=values[2];return [{affectedRows:1}];}
    throw Error('SQL inesperado: '+sql);
  }};
  const finished=createFinishedProductStore(pool);
  const outcome=await finished.updateProduct(id,{name:'Pan ficticio',categoryId:'pan',salePrice:0,minStock:2,operationalRecipeId:null,active:true},{preservePrice:true});
  assert.equal(actual,55);
  assert.equal(outcome.salePrice,55);
});

test('ROLES-03 costos de insumos en MySQL solo se actualizan con un importe válido',async()=>{
  let stock=0;const id=randomUUID();
  const pool={async execute(sql,args){assert.match(sql,/^UPDATE ingredients SET cost_per_unit=/);stock=args[0];assert.equal(args[1],id);return [{affectedRows:1}];}};
  const store=createMysqlStore(pool);
  assert.deepEqual(await store.updateIngredientCost(id,8.25),{id,costPerUnit:8.25});
  assert.equal(stock,8.25);
  await assert.rejects(()=>store.updateIngredientCost(id,-1),e=>e.status===400);
  await assert.rejects(()=>store.updateIngredientCost(id,0.00001),e=>e.status===400);
});
