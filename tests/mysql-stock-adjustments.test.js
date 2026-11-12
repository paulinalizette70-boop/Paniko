'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {poolFromEnv}=require('../src/database');
const {createMysqlStore}=require('../src/mysql-store');

test('CP-28 MySQL: salidas y ajustes son transaccionales', {skip:process.env.MYSQL_TEST!=='1'?'MySQL de pruebas no configurado':false}, async()=>{
  if(!/_test$/.test(process.env.DB_NAME||'')) throw Error('Se requiere una base de prueba terminada en _test');
  const pool=poolFromEnv();
  try {
    const store=createMysqlStore(pool);
    const ingredient=await store.addIngredient({name:'Ajuste prueba '+Date.now(),unit:'kg',costPerUnit:20,stock:2});
    const out=await store.stockOut(ingredient.id,{quantity:250,unit:'g',reason:'Consumo de prueba'});
    assert.equal(out.ingredient.stock,1.75);
    await assert.rejects(()=>store.stockOut(ingredient.id,{quantity:3,unit:'kg'}),e=>e.status===409);
    assert.equal((await store.listIngredients()).find(i=>i.id===ingredient.id).stock,1.75);
    const adjustment=await store.adjustStock(ingredient.id,{newStock:0,reason:'Conteo de prueba'});
    assert.equal(adjustment.ingredient.stock,0);
    assert.equal(adjustment.movement.type,'salida');
    assert.equal(adjustment.movement.quantity,1.75);
    await assert.rejects(()=>store.adjustStock(ingredient.id,{newStock:0,reason:'Igual'}),e=>e.status===400);
    const movements=(await store.listMovements()).filter(m=>m.ingredientId===ingredient.id);
    assert.equal(movements.length,3);
  } finally {await pool.end();}
});
