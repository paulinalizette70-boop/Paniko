'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const MYSQL=process.env.MYSQL_TEST==='1';
test('DB-083-01 MySQL aislado: corregir masa madre vinculada y leche g/ml en ficha de brioche',
 {skip:!MYSQL?'Requiere MYSQL_TEST y una base _test aislada':false},async()=>{
 if(!/_test$/.test(process.env.DB_NAME||''))throw Error('Nunca probar contra la base de datos real: se requiere _test');
 const {poolFromEnv}=require('../src/database');
 const {migrate}=require('../scripts/migrate-starter-inventory-082');
 const {createMysqlStore}=require('../src/mysql-store');
 const {createSourdoughStore}=require('../src/sourdough');
 const pool=poolFromEnv();
 try{
  await migrate(pool);
  const inv=createMysqlStore(pool),sourdough=createSourdoughStore(pool),suffix=randomUUID();
  const m=await inv.addIngredient({name:'Masa madre 083 '+suffix,unit:'kg',stock:0,costPerUnit:0});
  const f=await inv.addIngredient({name:'Harina 083 '+suffix,unit:'kg',stock:1,costPerUnit:0});
  const w=await inv.addIngredient({name:'Agua filtrada',unit:'l',stock:1,costPerUnit:0});
  const milk=await inv.addIngredient({name:'Leche entera',unit:'l',stock:0.5,costPerUnit:0});
  const culture=await sourdough.createStarter({name:'Cultivo 083 '+suffix,location:'ambiente',feedEveryHours:24,initialWeightGrams:100});
  const link=await sourdough.linkInventory(culture.id,{starterIngredientId:m.id,flourIngredientId:f.id,waterIngredientId:w.id,syncMode:'starter',expectedInventoryGrams:0});
  assert.equal(link.inventoryUpdated,true);
  assert.equal((await inv.listIngredients()).find(i=>i.id===m.id).stock,0.1);
  const fed=await sourdough.feed(culture.id,{beforeGrams:100,discardedGrams:20,flourGrams:100,waterGrams:100});
  assert.equal(fed.afterGrams,280);
  assert.equal((await inv.listIngredients()).find(i=>i.id===m.id).stock,0.28);
  const correction=await sourdough.reconcileInventory(culture.id,{realWeightGrams:150,expectedInventoryGrams:280});
  assert.equal(correction.inventoryUpdated,true);
  assert.equal((await inv.listIngredients()).find(i=>i.id===m.id).stock,0.15);
  const recipe=await inv.addRecipe({name:'Brioche prueba 083 '+suffix,baseYield:2,yieldUnit:'pieza',items:[
   {ingredientId:f.id,unit:'kg',quantity:0.2},{ingredientId:milk.id,unit:'g',quantity:103}
  ]});
  const preview=await inv.preview(recipe.id,2);
  assert.equal(preview.lines.find(x=>x.ingredientId===milk.id).required,0.1);
  assert.equal(preview.stockAvailable,true);
  const [moves]=await pool.execute('SELECT movement_type,quantity FROM inventory_movements WHERE ingredient_id=? AND reason LIKE ? ORDER BY created_at,id',[m.id,'%masa madre%']);
  assert.ok(moves.length>=3);
 }finally{await pool.end();}
});
