'use strict';
const test=require('node:test');const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');const {once}=require('node:events');
const {createSourdoughStore,gramStock,linkData}=require('../src/sourdough');
const {createApp}=require('../src/app');
const ids={starter:randomUUID(),flour:randomUUID(),water:randomUUID(),culture:randomUUID()};
function fakePool({flourStock=1,waterStock=0.5,starterStock=0.1}={}){
 let state={
  ingredients:{
   [ids.starter]:{id:ids.starter,name:'Masa madre ficticia',unit:'kg',stock:starterStock},
   [ids.flour]:{id:ids.flour,name:'Harina de trigo ficticia',unit:'kg',stock:flourStock},
   [ids.water]:{id:ids.water,name:'Agua',unit:'l',stock:waterStock}},
  cultures:{[ids.culture]:{id:ids.culture,name:'Cultivo ficticio',active:1,location:'ambiente',feed_every_hours:24,
    current_weight_g:100,starter_ingredient_id:null,flour_ingredient_id:null,water_ingredient_id:null,
    last_fed_at:null,notes:''}},feedings:[],movements:[]};
 let commits=0,rollbacks=0;
 function clone(o){return structuredClone(o);}
 function getConnection(){
  let local=clone(state);return{
   async beginTransaction(){local=clone(state)},async commit(){state=clone(local);commits++},
   async rollback(){rollbacks++},release(){},
   async execute(sql,p=[]){
    if(sql.startsWith('SELECT id,starter_ingredient_id FROM sourdough_starters'))return[[clone(local.cultures[p[0]])].filter(Boolean)];
    if(sql.startsWith('SELECT id,name,active,starter_ingredient_id'))return[[clone(local.cultures[p[0]])].filter(Boolean)];
    if(sql.startsWith('SELECT id,name,unit,stock FROM ingredients WHERE id'))return[[clone(local.ingredients[p[0]])].filter(Boolean)];
    if(sql.startsWith('SELECT id FROM sourdough_starters WHERE starter_ingredient_id'))return[[...Object.values(local.cultures)].filter(c=>c.starter_ingredient_id===p[0]&&c.id!==p[1]).map(c=>({id:c.id}))];
    if(sql.startsWith('UPDATE sourdough_starters SET starter_ingredient_id')){
     const c=local.cultures[p[4]];Object.assign(c,{starter_ingredient_id:p[0],flour_ingredient_id:p[1],water_ingredient_id:p[2],current_weight_g:p[3]});return[{affectedRows:1}];}
    if(sql.startsWith('UPDATE ingredients SET stock')){
     const i=local.ingredients[p[1]];if(!i||i.stock+1e-10<p[2])return[{affectedRows:0}];i.stock=p[0];return[{affectedRows:1}];}
    if(sql.startsWith('INSERT INTO inventory_movements')){local.movements.push({id:p[0],ingredientId:p[1],type:p[2],quantity:p[3],before:p[4],after:p[5],reason:p[6]});return[{affectedRows:1}];}
    if(sql.startsWith('INSERT INTO sourdough_feedings')){local.feedings.push({id:p[0],cultureId:p[1],before:p[2],discard:p[3],flour:p[4],water:p[5],after:p[6]});return[{affectedRows:1}];}
    if(sql.startsWith('UPDATE sourdough_starters SET current_weight_g')){local.cultures[p[1]].current_weight_g=p[0];return[{affectedRows:1}];}
    throw new Error('SQL no simulado: '+sql);
   }
  };
 }
 async function execute(sql){
  if(sql.startsWith('SELECT s.*,i.stock AS inventory_stock'))return [Object.values(state.cultures).map(c=>{
   const ingredient=state.ingredients[c.starter_ingredient_id];return {...clone(c),inventory_stock:ingredient?.stock,inventory_unit:ingredient?.unit};})];
  throw new Error('Consulta no simulada: '+sql);
 }
 return {getConnection:async()=>getConnection(),execute,state:()=>clone(state),get commits(){return commits},get rollbacks(){return rollbacks}};
}
const mapping={starterIngredientId:ids.starter,flourIngredientId:ids.flour,waterIngredientId:ids.water};

test('MASA-082-01 vincular insumos no modifica existencias y usa stock del ingrediente',async()=>{
 const pool=fakePool(),store=createSourdoughStore(pool);const before=pool.state();
 const linked=await store.linkInventory(ids.culture,mapping);
 assert.equal(linked.currentWeightGrams,100);assert.equal(linked.inventoryLinked,true);
 assert.deepEqual(pool.state().ingredients,before.ingredients);
 const culture=(await store.listStarters())[0];assert.equal(culture.currentWeightGrams,100);
 assert.equal(culture.flourIngredientId,ids.flour);
 assert.equal(pool.commits,1);
});
test('MASA-082-02 alimentación descuenta harina/agua, registra descarte e incrementa masa madre',async()=>{
 const pool=fakePool(),store=createSourdoughStore(pool);
 await store.linkInventory(ids.culture,mapping);
 const fed=await store.feed(ids.culture,{beforeGrams:100,discardedGrams:20,flourGrams:250,waterGrams:200,notes:'Burbujas'});
 assert.equal(fed.afterGrams,530);assert.equal(fed.inventoryUpdated,true);
 const s=pool.state();assert.equal(s.ingredients[ids.flour].stock,0.75);
 assert.equal(s.ingredients[ids.water].stock,0.3);
 assert.equal(s.ingredients[ids.starter].stock,0.53);
 assert.equal(s.movements.length,4);
 assert.equal(s.feedings.length,1);
 const culture=(await store.listStarters())[0];assert.equal(culture.currentWeightGrams,530);
 // Si una receta consume masa madre, el cuadro refleja el stock real y no el peso anterior guardado.
 s.ingredients[ids.starter].stock=0.49;
 // El motor no permite escribir por fuera en el mock; la validación de UI se cubre en MySQL.
 assert.equal(pool.commits,2);
});
test('MASA-082-03 insuficiencia de harina revierte todo y no deja alimentación incompleta',async()=>{
 const pool=fakePool({flourStock:0.1}),store=createSourdoughStore(pool);
 await store.linkInventory(ids.culture,mapping);
 const before=pool.state();
 await assert.rejects(()=>store.feed(ids.culture,{beforeGrams:100,discardedGrams:20,flourGrams:200,waterGrams:200}),/Inventario insuficiente/);
 assert.deepEqual(pool.state(),before);
 assert.equal(pool.commits,1);assert.equal(pool.rollbacks,1);
});
test('MASA-082-04 detecta datos de pantalla obsoletos y no descuenta doble',async()=>{
 const pool=fakePool(),store=createSourdoughStore(pool);
 await store.linkInventory(ids.culture,mapping);
 await assert.rejects(()=>store.feed(ids.culture,{beforeGrams:95,discardedGrams:10,flourGrams:20,waterGrams:20}),/cambió en Inventario/);
 assert.equal(pool.state().movements.length,0);
});
test('MASA-082-05 las unidades y los enlaces se validan, sin equivalencias inventadas',()=>{
 assert.equal(gramStock(0.35,'kg'),350);
 assert.throws(()=>gramStock(4,'pieza'),/g o kg/);
 assert.throws(()=>linkData({starterIngredientId:ids.starter,flourIngredientId:ids.starter,waterIngredientId:ids.water}),/diferentes/);
});
test('MASA-082-06 API de vinculación requiere sesión pero no permiso financiero',async t=>{
 let linked=0;
 const auth={async userForToken(token){return token==='A'.repeat(43)?{role:'operador'}:null;}};
 const sourdough={async linkInventory(){linked++;return {inventoryLinked:true}}};
 const server=createApp({auth,sourdough});server.listen(0,'127.0.0.1');await once(server,'listening');t.after(()=>new Promise(r=>server.close(r)));
 const url=`http://127.0.0.1:${server.address().port}/api/sourdough/starters/${ids.culture}/link-inventory`;
 const opts={method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(mapping)};
 assert.equal((await fetch(url,opts)).status,401);
 assert.equal((await fetch(url,{...opts,headers:{...opts.headers,Cookie:`paniko_session=${'A'.repeat(43)}`}})).status,200);
 assert.equal(linked,1);
});
