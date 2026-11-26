'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createMysqlStore}=require('../src/mysql-store');
const {randomUUID}=require('node:crypto');
const recipeId=randomUUID(),ingredientId=randomUUID(),productId=randomUUID();

function mockPool(){
  let rawStock=10,productStock=3,commits=0,rollbacks=0,productMovements=0;
  const conn={
    async beginTransaction(){},async commit(){commits++;},async rollback(){rollbacks++;},release(){},
    async execute(sql,params){
      if(sql.startsWith('SELECT id, name, base_yield, yield_unit FROM recipes'))return [[{id:recipeId,name:'Receta ficticia',base_yield:10}]];
      if(sql.startsWith('SELECT ingredient_id, quantity FROM recipe_items'))return [[{ingredient_id:ingredientId,quantity:2}]];
      if(sql.startsWith('SELECT id,name,unit,cost_per_unit,stock FROM ingredients WHERE'))return [[{id:ingredientId,name:'Ingrediente inventado',unit:'kg',cost_per_unit:5,stock:rawStock}]];
      if(sql.startsWith('SELECT id,name,stock FROM finished_products WHERE'))return [[{id:productId,name:'Producto ficticio',stock:productStock}]];
      if(sql.startsWith('UPDATE ingredients SET')){rawStock=params[0];return [{affectedRows:1}];}
      if(sql.startsWith('UPDATE finished_products SET stock')){productStock=params[0];return [{affectedRows:1}];}
      if(sql.includes('INSERT INTO finished_product_movements'))productMovements++;
      return [{affectedRows:1}];
    }
  };
  return {getConnection:async()=>conn,values:()=>({rawStock,productStock,commits,rollbacks,productMovements})};
}
test('FP-05 Producción operativa vinculada: descuenta insumos y suma piezas en una sola transacción',async()=>{
 const pool=mockPool(),store=createMysqlStore(pool);
 const done=await store.confirmProduction(recipeId,10,{productId});
 assert.equal(done.finishedProduct.after,13);
 const s=pool.values();assert.equal(s.rawStock,8);assert.equal(s.productStock,13);
 assert.equal(s.commits,1);assert.equal(s.rollbacks,0);assert.equal(s.productMovements,1);
});
test('FP-06 No vincular producto mantiene el comportamiento anterior',async()=>{
 const pool=mockPool(),store=createMysqlStore(pool);
 const done=await store.confirmProduction(recipeId,10,{});
 assert.equal(done.finishedProduct,null);
 const s=pool.values();assert.equal(s.rawStock,8);assert.equal(s.productStock,3);assert.equal(s.commits,1);assert.equal(s.productMovements,0);
});
test('FP-07 Producto ID inválido se rechaza antes de afectar inventario',async()=>{
 const pool=mockPool(),store=createMysqlStore(pool);
 await assert.rejects(()=>store.confirmProduction(recipeId,10,{productId:'incorrecto'}),/Producto terminado inválido/);
 const s=pool.values();assert.equal(s.rawStock,10);assert.equal(s.productStock,3);assert.equal(s.commits,0);assert.equal(s.rollbacks,1);
});
