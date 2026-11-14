'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {once}=require('node:events');
const {createApp}=require('../src/app');
const {createStore}=require('../src/store');
const {createMysqlStore}=require('../src/mysql-store');
const {editCatalogRecipe,manualCatalogHash}=require('../src/catalog-edit');
const {makeAuth}=require('../src/auth');

const pending=()=>({id:'hogaza_demo',nombre:'Hogaza de prueba',estado:'pendiente',
 rendimiento:{cantidad:null,unidad:'g_de_masa'},observaciones:'Necesita confirmar rendimiento',
 ingredientes:[{ingrediente:'Harina de prueba',cantidad:500,unidad:'g'},
 {ingrediente:'Agua',cantidad:null,unidad:'ml'}],componentes:[],variantes:[]});
const draftInput=()=>({name:'Hogaza de prueba',yieldQuantity:null,yieldUnit:'g_de_masa',
 items:[{name:'Harina de prueba',quantity:500,unit:'g'},{name:'Agua',quantity:null,unit:'ml'}],
 notes:'Pendiente de comprobar',confirm:false});

test('EDIT-01 se guardan cambios parciales y se bloquea confirmar sin datos',()=>{
 const result=editCatalogRecipe(pending(),draftInput());
 assert.equal(result.estado,'pendiente');
 assert.equal(result.ingredientes[1].cantidad,null);
 assert.equal(result.rendimiento.cantidad,null);
 assert.equal(result.componentes.length,0);
 assert.throws(()=>editCatalogRecipe(pending(),{...draftInput(),confirm:true}),e=>e.status===409&&/Antes de confirmar/.test(e.message));
 const corrected={...draftInput(),yieldQuantity:5,yieldUnit:'pieza',
   items:[{name:'Harina de prueba',quantity:500,unit:'g'},{name:'Agua',quantity:300,unit:'ml'}],confirm:true};
 const ready=editCatalogRecipe(pending(),corrected);
 assert.equal(ready.estado,'confirmada');
 assert.equal(ready.rendimiento.cantidad,5);
 assert.equal(ready.ingredientes[1].cantidad,300);
 const manual=manualCatalogHash(ready);
 assert.equal(manual.length,64);assert.match(manual,/^manual-/);
});

test('EDIT-02 se rechazan cantidades negativas, datos inválidos y subrecetas sin resolver',()=>{
 const sample=pending();sample.componentes=[{nombre:'Relleno',cantidad:2}];
 assert.throws(()=>editCatalogRecipe(sample,{...draftInput(),confirm:true,yieldQuantity:5,yieldUnit:'pieza',items:[{name:'Harina de prueba',quantity:500,unit:'g'}]}),/subpreparaciones/);
 assert.throws(()=>editCatalogRecipe(pending(),{...draftInput(),items:[{name:'Harina de prueba',quantity:-1,unit:'g'}]}),/cantidad/);
 assert.throws(()=>editCatalogRecipe(pending(),{...draftInput(),items:[]}),/ingredientes/);
});

test('EDIT-03 editar ficha productiva conserva el ID, inventario y lotes históricos',()=>{
 const folder=fs.mkdtempSync(path.join(os.tmpdir(),'paniko-edit-'));
 try{
  const store=createStore(path.join(folder,'store.json'));
  const ing=store.addIngredient({name:'Harina ficticia',unit:'kg',stock:2,costPerUnit:12});
  const old=store.addRecipe({name:'Masa ficticia',baseYield:10,items:[{ingredientId:ing.id,quantity:0.5}]});
  const batch=store.confirmProduction(old.id,10);
  const stock=store.listIngredients()[0].stock;
  const update=store.updateRecipe(old.id,{name:'Masa ficticia corregida',baseYield:20,items:[{ingredientId:ing.id,quantity:1,unit:'kg'}]});
  assert.equal(update.id,old.id);assert.equal(store.listRecipes().length,1);
  assert.equal(store.listIngredients()[0].stock,stock);
  assert.equal(store.getProductionBatch(batch.id).recipeName,'Masa ficticia');
  assert.equal(store.getRecipe(old.id).baseYield,20);
  assert.throws(()=>store.updateRecipe(randomUUID(),{name:'x',baseYield:1,items:[]}),e=>e.status===404);
 }finally{fs.rmSync(folder,{recursive:true,force:true});}
});

test('EDIT-04 API permite editar ficha a operador; no permite anónimos; no toca inventario',async t=>{
 const folder=fs.mkdtempSync(path.join(os.tmpdir(),'paniko-edit-api-'));
 const store=createStore(path.join(folder,'db.json'));
 const ing=store.addIngredient({name:'Azúcar prueba',unit:'kg',costPerUnit:10,stock:0});
 const old=store.addRecipe({name:'Galleta ficticia',baseYield:8,items:[{ingredientId:ing.id,quantity:0.2}]});
 const auth={async userForToken(token){return token==='X'.repeat(43)?{username:'operador',role:'operador'}:null;}};
 const server=createApp({store,auth});server.listen(0,'127.0.0.1');await once(server,'listening');
 t.after(async()=>{await new Promise(r=>server.close(r));fs.rmSync(folder,{recursive:true,force:true});});
 const url=`http://127.0.0.1:${server.address().port}/api/recipes/${old.id}/update`;
 const input={name:'Galleta mejorada',baseYield:12,items:[{ingredientId:ing.id,quantity:0.3,unit:'kg'}]};
 const guest=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)});
 assert.equal(guest.status,401);
 const response=await fetch(url,{method:'POST',headers:{Cookie:'paniko_session='+'X'.repeat(43),'Content-Type':'application/json'},body:JSON.stringify(input)});
 assert.equal(response.status,200);assert.equal((await response.json()).name,'Galleta mejorada');
 assert.equal(store.listIngredients()[0].stock,0);
});

test('EDIT-05 MySQL actualiza receta en transacción sin alterar ingredientes',async()=>{
 const id=randomUUID(),ingId=randomUUID();let rollback=0,commit=0,queries=[];
 const conn={async beginTransaction(){},async commit(){commit++;},async rollback(){rollback++;},release(){},async execute(sql,params){
  queries.push({sql,params});
  if(sql.startsWith('SELECT id FROM recipes'))return [[{id}]];
  if(sql.startsWith('SELECT id,name,unit,cost_per_unit,stock FROM ingredients'))return [[{id:ingId,name:'Harina ficticia',unit:'kg',stock:'3.0',cost_per_unit:'0.0'}]];
  return [{affectedRows:1}];
 }};
 const store=createMysqlStore({async getConnection(){return conn;}});
 const result=await store.updateRecipe(id,{name:'Fórmula corregida',baseYield:12,items:[{ingredientId:ingId,quantity:0.75,unit:'kg'}]});
 assert.equal(result.id,id);assert.equal(commit,1);assert.equal(rollback,0);
 assert.ok(queries.some(x=>x.sql.startsWith('UPDATE recipes')));
 assert.ok(queries.some(x=>x.sql.startsWith('DELETE FROM recipe_items')));
 assert.equal(queries.some(x=>x.sql.includes('UPDATE ingredients')),false);
});

test('EDIT-06 receta original guardada en MySQL mantiene modificación y no cambia inventario',async()=>{
 const id='hogaza_demo',queries=[];let commit=0;
 const conn={async beginTransaction(){},async commit(){commit++;},async rollback(){},release(){},async execute(sql,params){
  queries.push({sql,params});
  if(sql.startsWith('SELECT raw_data FROM private_catalog_recipes'))return [[{raw_data:JSON.stringify(pending())}]];
  return [{affectedRows:1}];
 }};
 const auth=makeAuth({async getConnection(){return conn;}});
 const result=await auth.saveCatalogRecipe(id,draftInput());
 assert.equal(result.status,'pendiente');assert.equal(commit,1);
 const update=queries.find(x=>x.sql.startsWith('UPDATE private_catalog_recipes'));
 assert.equal(update.params[4],id);assert.match(update.params[3],/^manual-/);
 assert.equal(queries.some(x=>x.sql.includes('inventory_movements')),false);
});

test('EDIT-07 API de recetas originales acepta operador, rechaza anónimo y controla origen',async t=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'paniko-catalog-api-'));
 const store=createStore(path.join(directory,'demo.json'));
 let source=pending();let changes=0;
 const auth={
  async userForToken(token){return token==='Y'.repeat(43)?{username:'operador',role:'operador'}:null;},
  async saveCatalogRecipe(id,input){assert.equal(id,'hogaza_demo');source=editCatalogRecipe(source,input);changes++;return {data:source,status:source.estado,title:source.nombre};}
 };
 const server=createApp({store,auth});server.listen(0,'127.0.0.1');await once(server,'listening');
 t.after(async()=>{await new Promise(r=>server.close(r));fs.rmSync(directory,{recursive:true,force:true});});
 const base=`http://127.0.0.1:${server.address().port}`;
 const endpoint=base+'/api/catalog/recipes/hogaza_demo/save';
 const payload=JSON.stringify(draftInput());
 const guest=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:payload});assert.equal(guest.status,401);
 const csrf=await fetch(endpoint,{method:'POST',headers:{Origin:'http://sitio-malicioso.test',Cookie:'paniko_session='+'Y'.repeat(43),'Content-Type':'application/json'},body:payload});assert.equal(csrf.status,403);
 const operator=await fetch(endpoint,{method:'POST',headers:{Cookie:'paniko_session='+'Y'.repeat(43),'Content-Type':'application/json'},body:payload});assert.equal(operator.status,200);
 assert.equal((await operator.json()).status,'pendiente');assert.equal(changes,1);
});
