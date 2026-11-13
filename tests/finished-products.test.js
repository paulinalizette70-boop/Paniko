'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {once}=require('node:events');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {createFinishedProductStore,text,quantity,moneyOptional,recipeId}=require('../src/finished-products');
const {createApp}=require('../src/app');
const {createStore}=require('../src/store');

const validId='12345678-1234-1234-1234-123456789012';
test('FP-01 validaciones de inventario terminado: cantidades, precio, IDs y texto',()=>{
  assert.equal(quantity(2),2);assert.equal(quantity(0,'Stock mínimo',true),0);
  for(const bad of [-1,0,1.5,'2',NaN,100000001])assert.throws(()=>quantity(bad));
  assert.equal(moneyOptional(null),null);assert.equal(moneyOptional(22.5),22.5);
  for(const bad of [-1,1.567,'15',Infinity])assert.throws(()=>moneyOptional(bad));
  assert.equal(recipeId(validId),validId);assert.equal(recipeId(''),null);
  assert.throws(()=>recipeId('invalida'));assert.equal(text('  Concha  ','Nombre'),'Concha');
});

test('FP-02 registro de venta utiliza transacción y rechaza stock negativo',async()=>{
  let state=5,commits=0,rollbacks=0,movements=0;
  const conn={async beginTransaction(){},async commit(){commits++;},async rollback(){rollbacks++;},release(){},
    async execute(sql,values){
      if(sql.startsWith('SELECT id,name,stock'))return [[{id:validId,name:'Producto ficticio',stock:state,active:1}]];
      if(sql.startsWith('UPDATE finished_products')){state=values[0];return [{affectedRows:1}];}
      if(sql.startsWith('INSERT INTO finished_product_movements')){movements++;return [{affectedRows:1}];}
      throw Error('SQL no esperado: '+sql);
    }};
  const store=createFinishedProductStore({getConnection:async()=>conn});
  const result=await store.recordMovement(validId,{type:'venta',quantity:2,reason:'Prueba de venta ficticia'});
  assert.equal(result.after,3);assert.equal(state,3);assert.equal(movements,1);assert.equal(commits,1);
  await assert.rejects(()=>store.recordMovement(validId,{type:'merma',quantity:4,reason:'Prueba ficticia'}),/insuficientes/);
  assert.equal(state,3);assert.equal(commits,1);assert.equal(rollbacks,1);
});

test('FP-03 importar catálogo es idempotente y NO modifica existencias',async()=>{
  const sqls=[];
  const pool={getConnection:async()=>({
    async beginTransaction(){},async commit(){},async rollback(){},release(){},
    async query(sql){sqls.push(sql);return [[{product_key:'p1',title:'Pan ficticio',source_recipe_id:'brioche_base'},
      {product_key:'p2',title:'Galleta ficticia',source_recipe_id:'galleta_chip'}]];},
    async execute(sql,params){
      sqls.push(sql);
      if(sql.startsWith('SELECT id FROM finished_products'))return [params[0]==='p2'?[{id:'existing-product'}]:[]];
      assert.match(sql,/INSERT INTO finished_products/);assert.equal(params.length,4);
      return [{affectedRows:1}];
    }
  })};
  const store=createFinishedProductStore(pool);
  const result=await store.importCatalog();
  assert.deepEqual(result,{source:2,created:1,already:1});
  assert.equal(sqls.filter(x=>x.includes('UPDATE finished_products SET stock')).length,0);
  assert.equal(sqls.filter(x=>x.includes('INSERT INTO finished_products')).length,1);
});

test('FP-04 API terminados: requiere sesión; equipo administra catálogo y administración fija precios',async t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'fp-api-'));
  const auth={
    async userForToken(token){if(token==='A'.repeat(43))return{role:'admin'};if(token==='B'.repeat(43))return{role:'operador'};return null;},
    async privateCatalog(){return {recetas:[],productos:[],rellenos:[]};}
  };
  let modified=0,created=0,synced=0;
  const finished={
    async listCategories(){return[{id:'pan',name:'Pan'}]},
    async listProducts(){return [{id:validId,name:'Pan ficticio',stock:4}]},
    async movements(){return []},
    async recordMovement(){modified++;return {after:3}},
    async createProduct(){created++;return{id:validId}},
    async importCatalog(){synced++;return{source:1,created:1,already:0}},
    async updateProduct(){created++;return{id:validId}},
    async createCategory(){created++;return{id:'nuevo'}}
  };
  const server=createApp({store:createStore(path.join(dir,'data.json')),auth,products:finished});
  server.listen(0,'127.0.0.1');await once(server,'listening');
  t.after(()=>{server.close();fs.rmSync(dir,{recursive:true,force:true});});
  const base='http://127.0.0.1:'+server.address().port;
  const guest=await fetch(base+'/api/products');assert.equal(guest.status,401);
  const post=async(uri,role='B')=>fetch(base+uri,{method:'POST',headers:{Cookie:'paniko_session='+role.repeat(43),'Content-Type':'application/json'},body:'{}'});
  assert.equal((await post('/api/products')).status,201);
  assert.equal((await post('/api/products/import-catalog')).status,200);
  assert.equal((await post('/api/products/'+validId+'/update')).status,200);
  assert.equal((await post('/api/products/'+validId+'/movements')).status,201);
  assert.equal(modified,1);assert.equal(created,2);assert.equal(synced,1);
  assert.equal((await post('/api/products','A')).status,201);
  assert.equal((await post('/api/products/import-catalog','A')).status,200);
  assert.equal(created,3);assert.equal(synced,2);
  const csrf=await fetch(base+'/api/products/import-catalog',{method:'POST',headers:{Origin:'https://ejemplo.evil',Cookie:'paniko_session='+'A'.repeat(43)},body:'{}'});
  assert.equal(csrf.status,403);
  const list=await fetch(base+'/api/products',{headers:{Cookie:'paniko_session='+'B'.repeat(43)}});
  assert.equal(list.status,200);assert.equal((await list.json())[0].stock,4);
});
