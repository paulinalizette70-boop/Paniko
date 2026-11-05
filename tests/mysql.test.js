'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {poolFromEnv}=require('../src/database');
const {createMysqlStore}=require('../src/mysql-store');

// Se ejecuta en CI con servicio MySQL. Nunca utiliza datos reales o bases de producción.
test('CP-15 MySQL: entrada, descuento transaccional, rechazo por stock y bitácora', {skip:process.env.MYSQL_TEST!=='1'?'MYSQL_TEST no configurado':false}, async()=>{
  if(!/_test$/.test(process.env.DB_NAME||'')) throw Error('Pruebas requieren una DB_NAME terminada en _test para proteger datos reales');
  const pool=poolFromEnv();
  try {
    const store=createMysqlStore(pool);
    // La DB del servicio CI es nueva; no borrar tablas indiscriminadamente.
    const flour=await store.addIngredient({name:'Harina test '+Date.now(),unit:'kg',costPerUnit:25,stock:1});
    const sugar=await store.addIngredient({name:'Azúcar test '+Date.now(),unit:'kg',costPerUnit:30,stock:0.3});
    const entries=await store.stockIn(sugar.id,{quantity:1,reason:'Entrada de prueba'});
    assert.equal(entries.ingredient.stock,1.3);
    const rec=await store.addRecipe({name:'Conchas test',baseYield:10,items:[{ingredientId:flour.id,quantity:0.5},{ingredientId:sugar.id,quantity:0.25}]});
    const preview=await store.preview(rec.id,10);
    assert.equal(preview.stockAvailable,true);
    const batch=await store.confirmProduction(rec.id,10);
    assert.equal(batch.desiredYield,10);
    const after=await store.listIngredients();
    assert.equal(after.find(i=>i.id===flour.id).stock,0.5);
    assert.equal(after.find(i=>i.id===sugar.id).stock,1.05);
    const beforeCount=(await store.listProduction()).filter(x=>x.id===batch.id).length;
    assert.equal(beforeCount,1);
    const reason=(await store.listMovements()).filter(x=>x.batchId===batch.id);
    assert.equal(reason.length,2);
    await assert.rejects(()=>store.confirmProduction(rec.id,1000),e=>e.status===409);
    const afterReject=await store.listIngredients();
    assert.equal(afterReject.find(i=>i.id===flour.id).stock,0.5);
    assert.equal((await store.listProduction()).filter(x=>x.id===batch.id).length,1);
  } finally {await pool.end();}
});
