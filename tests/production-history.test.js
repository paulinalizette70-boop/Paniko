'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const {createStore}=require('../src/store');
const {createMysqlStore}=require('../src/mysql-store');
const {createApp}=require('../src/app');
const {once}=require('node:events');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');

test('HIST-01 detalle JSON devuelve cantidades y saldos históricos sin tocar existencias',()=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'paniko-lotes-'));
  try{
    const store=createStore(path.join(directory,'datos.json'));
    const ingredient=store.addIngredient({name:'Harina ficticia',unit:'kg',stock:2,costPerUnit:20});
    const recipe=store.addRecipe({name:'Lote ficticio',baseYield:10,items:[{ingredientId:ingredient.id,quantity:0.5}]});
    const batch=store.confirmProduction(recipe.id,10);
    const stock=store.listIngredients()[0].stock;
    const detail=store.getProductionBatch(batch.id);
    assert.equal(detail.id,batch.id);
    assert.equal(detail.lines.length,1);
    assert.equal(detail.lines[0].quantity,0.5);
    assert.equal(detail.lines[0].stockBefore,2);
    assert.equal(detail.lines[0].stockAfter,1.5);
    assert.equal(detail.finishedProduct,null);
    assert.equal(store.listIngredients()[0].stock,stock);
    assert.throws(()=>store.getProductionBatch(randomUUID()),e=>e.status===404);
  }finally{fs.rmSync(directory,{recursive:true,force:true});}
});

test('HIST-02 API deniega sesiones ausentes y devuelve detalle de lote existente',async t=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'paniko-lotes-api-'));
  const store=createStore(path.join(directory,'datos.json'));
  const ing=store.addIngredient({name:'Masa prueba',unit:'kg',stock:3,costPerUnit:20});
  const recipe=store.addRecipe({name:'Receta prueba',baseYield:10,items:[{ingredientId:ing.id,quantity:1}]});
  const batch=store.confirmProduction(recipe.id,10);
  const auth={async userForToken(token){return token==='A'.repeat(43)?{username:'operador',role:'operador'}:null;}};
  const app=createApp({store,auth});app.listen(0,'127.0.0.1');await once(app,'listening');
  t.after(async()=>{await new Promise(resolve=>app.close(resolve));fs.rmSync(directory,{recursive:true,force:true});});
  const base=`http://127.0.0.1:${app.address().port}`;
  const unauthorized=await fetch(`${base}/api/production/${batch.id}`);
  assert.equal(unauthorized.status,401);
  const allowed=await fetch(`${base}/api/production/${batch.id}`,{headers:{Cookie:`paniko_session=${'A'.repeat(43)}`}});
  assert.equal(allowed.status,200);
  const details=await allowed.json();
  assert.equal(details.id,batch.id);
  assert.equal(details.lines[0].stockAfter,2);
  const missing=await fetch(`${base}/api/production/${randomUUID()}`,{headers:{Cookie:`paniko_session=${'A'.repeat(43)}`}});
  assert.equal(missing.status,404);
  assert.equal(store.listIngredients()[0].stock,2);
});

test('HIST-03 detalle MySQL combina consumos y producto terminado del mismo lote',async()=>{
  const batchId=randomUUID(),recipeId=randomUUID(),ingredientId=randomUUID(),productId=randomUUID();
  const queries=[];
  const pool={async execute(sql,params){
    queries.push({sql,params});
    if(sql.includes('FROM production_batches WHERE id=?'))return [[{id:batchId,recipe_id:recipeId,recipe_name:'Pan ficticio',desired_yield:10,estimated_total_cost:'15.00',created_at:'2026-11-12 10:00:00'}]];
    if(sql.includes('FROM production_batch_items bi'))return [[{ingredient_id:ingredientId,ingredient_name:'Harina ficticia',unit:'kg',quantity:'0.500000',unit_cost:'30.0000',estimated_cost:'15.00',stock_before:'4.000000',stock_after:'3.500000'}]];
    if(sql.includes('FROM finished_product_movements m'))return [[{product_id:productId,product_name:'Bolsa ficticia',quantity:10,stock_before:2,stock_after:12}]];
    throw Error('Consulta no esperada: '+sql);
  }};
  const store=createMysqlStore(pool);
  const result=await store.getProductionBatch(batchId);
  assert.equal(result.recipeName,'Pan ficticio');
  assert.equal(result.lines[0].quantity,0.5);
  assert.equal(result.lines[0].estimatedCost,15);
  assert.equal(result.lines[0].stockBefore,4);
  assert.equal(result.finishedProduct.after,12);
  assert.equal(queries.length,3);
  assert.ok(queries.every(q=>q.params[0]===batchId));
});

test('HIST-04 detalle MySQL de lote sin producto terminado y lote inexistente',async()=>{
  const batchId=randomUUID();let absent=false;
  const pool={async execute(sql){
    if(sql.includes('FROM production_batches WHERE id=?'))return absent?[[]]:[[{id:batchId,recipe_id:randomUUID(),recipe_name:'Pan prueba',desired_yield:5,estimated_total_cost:'8.00',created_at:new Date()}]];
    if(sql.includes('FROM production_batch_items bi'))return [[{ingredient_id:randomUUID(),ingredient_name:'Azúcar',unit:'kg',quantity:'0.100000',unit_cost:'80.0000',estimated_cost:'8.00',stock_before:null,stock_after:null}]];
    if(sql.includes('FROM finished_product_movements m'))return [[]];
    throw Error('Consulta no esperada: '+sql);
  }};
  const store=createMysqlStore(pool);const result=await store.getProductionBatch(batchId);
  assert.equal(result.finishedProduct,null);
  assert.equal(result.lines[0].stockBefore,null);
  absent=true;
  await assert.rejects(()=>store.getProductionBatch(randomUUID()),e=>e.status===404);
});
