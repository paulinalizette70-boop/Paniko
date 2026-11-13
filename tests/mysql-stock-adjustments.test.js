'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {poolFromEnv}=require('../src/database'),{createMysqlStore}=require('../src/mysql-store');
test('INV-04 MySQL salidas y ajustes son transaccionales',
  {skip:process.env.MYSQL_TEST!=='1'?'MySQL test no configurado':false},async()=>{
  if(!/_test$/.test(process.env.DB_NAME||''))throw Error('Base de prueba debe terminar con _test');
  const pool=poolFromEnv();
  try{
    const store=createMysqlStore(pool);
    const ing=await store.addIngredient({name:'Inventario test '+Date.now(),unit:'kg',costPerUnit:20,stock:2});
    const out=await store.stockOut(ing.id,{quantity:250,unit:'g',reason:'Consumo'});
    assert.equal(out.ingredient.stock,1.75);
    await assert.rejects(()=>store.stockOut(ing.id,{quantity:2,unit:'kg'}),e=>e.status===409);
    assert.equal((await store.listIngredients()).find(i=>i.id===ing.id).stock,1.75);
    const adjusted=await store.adjustStock(ing.id,{newStock:0,reason:'Conteo'});
    assert.equal(adjusted.ingredient.stock,0);
    assert.equal(adjusted.movement.type,'salida');
    assert.equal(adjusted.movement.quantity,1.75);
    const movements=(await store.listMovements()).filter(m=>m.ingredientId===ing.id);
    assert.equal(movements.length,3);
  }finally{await pool.end();}
});
