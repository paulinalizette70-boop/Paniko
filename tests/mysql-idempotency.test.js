'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const enabled=process.env.MYSQL_TEST==='1';
test('DB-IDEMP-01 MySQL aislado: dos confirmaciones simultáneas registran UN lote y UNA venta', {
 skip:!enabled?'Solo con MySQL de pruebas aislado terminado en _test':false
},async()=>{
 if(!/_test$/.test(process.env.DB_NAME||''))throw Error('Por seguridad solo se permite una base *_test');
 const {poolFromEnv}=require('../src/database');
 const {createMysqlStore}=require('../src/mysql-store');
 const {createFinishedProductStore}=require('../src/finished-products');
 const {migrate}=require('../scripts/migrate-operation-requests');
 const db=poolFromEnv();
 try{
  await migrate(db);await migrate(db);
  const inv=createMysqlStore(db),products=createFinishedProductStore(db),suffix=randomUUID();
  const flour=await inv.addIngredient({name:'Harina idempotencia '+suffix,unit:'kg',stock:4,costPerUnit:25});
  const recipe=await inv.addRecipe({name:'Pan demo idempotencia '+suffix,baseYield:10,items:[{ingredientId:flour.id,quantity:1,unit:'kg'}]});
  const operationId=randomUUID();
  const outcome=await Promise.all([
   inv.confirmProduction(recipe.id,5,{operationId}),
   inv.confirmProduction(recipe.id,5,{operationId})
  ]);
  assert.equal(outcome[0].id,outcome[1].id);
  assert.equal((await inv.listIngredients()).find(x=>x.id===flour.id).stock,3.5);
  const [recorded]=await db.execute('SELECT COUNT(*) AS total FROM production_batches WHERE id=?',[outcome[0].id]);
  assert.equal(Number(recorded[0].total),1);
  await assert.rejects(()=>inv.confirmProduction(recipe.id,6,{operationId}),e=>e.status===409);
  const category=await products.createCategory({name:'Demo '+suffix});
  const product=await products.createProduct({name:'Pan de test '+suffix,categoryId:category.id});
  await products.recordMovement(product.id,{type:'produccion_manual',quantity:8,reason:'Entrada ficticia'});
  const saleId=randomUUID();
  const [saleA,saleB]=await Promise.all([
   products.recordMovement(product.id,{type:'venta',quantity:3,reason:'Venta de prueba',operationId:saleId}),
   products.recordMovement(product.id,{type:'venta',quantity:3,reason:'Venta de prueba',operationId:saleId})
  ]);
  assert.equal(saleA.id,saleB.id);
  assert.equal((await products.listProducts()).find(x=>x.id===product.id).stock,5);
  const [snap]=await db.execute('SELECT COUNT(*) AS total FROM sale_financial_snapshots WHERE movement_id=?',[saleA.id]);
  assert.equal(Number(snap[0].total),1);
 }finally{await db.end();}
});
