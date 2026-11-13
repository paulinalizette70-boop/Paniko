'use strict';
const test=require('node:test');const assert=require('node:assert/strict');const {randomUUID}=require('node:crypto');
const MYSQL=process.env.MYSQL_TEST==='1';
test('DB-080-01 MySQL aislado: venta captura precio/costo, gastos y alimentaciones persisten sin tocar inventario',
 {skip:!MYSQL?'Requiere MYSQL_TEST y base MySQL aislada terminada en _test':false},async()=>{
 if(!/_test$/.test(process.env.DB_NAME||''))throw Error('No ejecutar pruebas destructivas contra MySQL real');
 const {poolFromEnv}=require('../src/database');const pool=poolFromEnv();
 const {migrate}=require('../scripts/migrate-finance-and-starter');
 const {createFinishedProductStore}=require('../src/finished-products');
 const {createFinanceDashboard}=require('../src/finance-dashboard');
 const {createSourdoughStore}=require('../src/sourdough');
 try{
  await migrate(pool);await migrate(pool); // idempotente
  const products=createFinishedProductStore(pool),finance=createFinanceDashboard(pool),starters=createSourdoughStore(pool);
  const categories=await products.listCategories();assert.ok(categories.length);
  const p=await products.createProduct({name:'Venta prueba 080 '+randomUUID(),categoryId:categories[0].id,salePrice:55,minStock:0});
  await products.updateFinancials(p.id,{unitCost:22,salePrice:55});
  await products.recordMovement(p.id,{type:'produccion_manual',quantity:5,reason:'Producción ficticia'});
  const sold=await products.recordMovement(p.id,{type:'venta',quantity:2,reason:'Venta ficticia'});
  await products.updateFinancials(p.id,{unitCost:99,salePrice:100});
  const [snapshots]=await pool.execute('SELECT unit_price,unit_cost,quantity FROM sale_financial_snapshots WHERE movement_id=?',[sold.id]);
  assert.equal(snapshots.length,1);assert.equal(Number(snapshots[0].unit_price),55);assert.equal(Number(snapshots[0].unit_cost),22);assert.equal(snapshots[0].quantity,2);
  const after=(await products.listProducts()).find(x=>x.id===p.id);assert.equal(after.stock,3);
  const extra=await finance.addExpense({category:'Otros',description:'Gasto ficticio '+randomUUID(),amount:10,expenseDate:new Date().toISOString().slice(0,10)});assert.ok(extra.id);
  const dashboard=await finance.dashboard(7);assert.ok(dashboard.knownRevenue>=110);assert.ok(dashboard.expenses>=10);
  const st=await starters.createStarter({name:'Masa ficticia '+randomUUID(),location:'ambiente',feedEveryHours:24,initialWeightGrams:120});
  const fed=await starters.feed(st.id,{discardedGrams:40,flourGrams:60,waterGrams:60,notes:'Datos de prueba'});
  assert.equal(fed.afterGrams,200);
  assert.equal((await starters.listStarters()).find(x=>x.id===st.id).currentWeightGrams,200);
  assert.equal((await starters.feedings(st.id))[0].afterGrams,200);
  const afterFeeding=(await products.listProducts()).find(x=>x.id===p.id);assert.equal(afterFeeding.stock,3);
 }finally{await pool.end();}
});
