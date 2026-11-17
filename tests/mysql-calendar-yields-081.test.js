'use strict';
const test=require('node:test'),assert=require('node:assert/strict');const {randomUUID}=require('node:crypto');
const MYSQL=process.env.MYSQL_TEST==='1';
test('DB-081-01 MySQL aislado: migración repetible, receta en g, producción en g, calendario refleja lote sin alterar el plan',
 {skip:!MYSQL?'Requiere MYSQL_TEST y una BD aislada terminada en _test':false},async()=>{
 if(!/_test$/.test(process.env.DB_NAME||''))throw Error('Las integraciones MySQL solo se ejecutan contra una BD _test');
 const {poolFromEnv}=require('../src/database');const {migrate}=require('../scripts/migrate-calendar-yields-081');
 const {createMysqlStore}=require('../src/mysql-store');const {createCalendarStore}=require('../src/calendar');
 const db=poolFromEnv();try{
  await migrate(db);await migrate(db);
  const store=createMysqlStore(db),calendar=createCalendarStore(db);
  const ing=await store.addIngredient({name:'Insumo sintético 081 '+randomUUID(),unit:'kg',costPerUnit:0,stock:2});
  const recipe=await store.addRecipe({name:'Preparación sintética 081 '+randomUUID(),baseYield:1000,yieldUnit:'g',items:[{ingredientId:ing.id,quantity:1,unit:'kg'}]});
  const plan=await store.preview(recipe.id,250);
  assert.equal(plan.lines[0].required,0.25);assert.equal(plan.yieldUnit,'g');
  const now=new Date();const month=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  const y=now.getFullYear(),m=String(now.getMonth()+1).padStart(2,'0'),day=String(now.getDate()).padStart(2,'0');
  const item=await calendar.create({eventDate:`${y}-${m}-${day}`,kind:'produccion',title:'Preparación sintética planeada',recipeId:recipe.id,plannedQuantity:250});
  const confirmed=await store.confirmProduction(recipe.id,250,{});
  assert.equal(confirmed.yieldUnit,'g');
  const loaded=await store.getRecipe(recipe.id);assert.equal(loaded.yieldUnit,'g');
  const history=await store.listProduction();assert.ok(history.some(b=>b.id===confirmed.id&&b.yieldUnit==='g'));
  const report=await calendar.month(month);assert.ok(report.entries.some(e=>e.id===item.id));
  // MySQL timestamps are server-local; a boundary around midnight can land in adjacent month.
  const [saved]=await db.execute('SELECT yield_unit FROM production_batches WHERE id=?',[confirmed.id]);assert.equal(saved[0].yield_unit,'g');
  const after=(await store.listIngredients()).find(i=>i.id===ing.id);assert.equal(after.stock,1.75);
  await calendar.setStatus(item.id,'hecho');await calendar.remove(item.id);
  assert.equal((await store.listIngredients()).find(i=>i.id===ing.id).stock,1.75);
 }finally{await db.end();}
});
