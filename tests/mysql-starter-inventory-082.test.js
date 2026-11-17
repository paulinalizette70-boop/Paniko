'use strict';
const test=require('node:test'),assert=require('node:assert/strict');const {randomUUID}=require('node:crypto');
const MYSQL=process.env.MYSQL_TEST==='1';
test('DB-082-01 MySQL aislado: migración repetible, alimentación transaccional y producción consumen masa madre real',
 {skip:!MYSQL?'Requiere MYSQL_TEST y una base _test aislada':false},async()=>{
 if(!/_test$/.test(process.env.DB_NAME||''))throw Error('Solo se permiten pruebas en DB_NAME terminado en _test');
 const {poolFromEnv}=require('../src/database');const {migrate}=require('../scripts/migrate-starter-inventory-082');
 const {createMysqlStore}=require('../src/mysql-store'),{createSourdoughStore}=require('../src/sourdough');
 const pool=poolFromEnv();
 try{
  await migrate(pool);await migrate(pool);
  const inv=createMysqlStore(pool),starters=createSourdoughStore(pool),suffix=randomUUID();
  const starterIngredient=await inv.addIngredient({name:'Masa prueba DB 082 '+suffix,unit:'kg',stock:0.1,costPerUnit:0});
  const flour=await inv.addIngredient({name:'Harina prueba DB 082 '+suffix,unit:'kg',stock:1,costPerUnit:0});
  const water=await inv.addIngredient({name:'Agua purificada',unit:'l',stock:0.5,costPerUnit:0});
  const culture=await starters.createStarter({name:'Cultivo prueba DB 082 '+suffix,location:'ambiente',feedEveryHours:24,initialWeightGrams:100});
  await starters.linkInventory(culture.id,{starterIngredientId:starterIngredient.id,flourIngredientId:flour.id,waterIngredientId:water.id});
  await assert.rejects(()=>starters.feed(culture.id,{beforeGrams:100,discardedGrams:20,flourGrams:1500,waterGrams:200}),/Inventario insuficiente/);
  assert.equal((await starters.listStarters()).find(s=>s.id===culture.id).currentWeightGrams,100);
  const fed=await starters.feed(culture.id,{beforeGrams:100,discardedGrams:20,flourGrams:250,waterGrams:200});
  assert.equal(fed.afterGrams,530);
  const snapshot=await inv.listIngredients();
  assert.equal(snapshot.find(i=>i.id===flour.id).stock,0.75);
  assert.equal(snapshot.find(i=>i.id===water.id).stock,0.3);
  assert.equal(snapshot.find(i=>i.id===starterIngredient.id).stock,0.53);
  const [moves]=await pool.execute('SELECT movement_type,quantity FROM inventory_movements WHERE reason LIKE ? ORDER BY created_at,id',[`Alimentación de masa madre: Cultivo prueba DB 082 ${suffix}`]);
  assert.equal(moves.length,4);
  const recipe=await inv.addRecipe({name:'Consumo ficticio de masa madre '+suffix,baseYield:1,yieldUnit:'pieza',items:[{ingredientId:starterIngredient.id,quantity:0.04,unit:'kg'}]});
  await inv.confirmProduction(recipe.id,1);
  const updated=(await starters.listStarters()).find(s=>s.id===culture.id);
  assert.equal(updated.currentWeightGrams,490);
  await assert.rejects(()=>starters.feed(culture.id,{beforeGrams:530,discardedGrams:10,flourGrams:20,waterGrams:20}),/cambió en Inventario/);
 }finally{await pool.end();}
});
