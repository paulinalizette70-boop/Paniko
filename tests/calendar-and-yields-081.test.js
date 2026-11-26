'use strict';
const test=require('node:test');const assert=require('node:assert/strict');const {randomUUID}=require('node:crypto');
const {createStore}=require('../src/store');const {createApp}=require('../src/app');const {ValidationError,validateRecipe,scaleRecipe}=require('../src/domain');
const {planCatalogRecipe}=require('../src/catalog-to-recipe');
const {createCalendarStore,validateEntry,monthRange}=require('../src/calendar');
const {migrate,CREATE_CALENDAR}=require('../scripts/migrate-calendar-yields-081');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');const {once}=require('node:events');
const ing={id:randomUUID(),name:'Azúcar sintética',unit:'kg',costPerUnit:0,stock:0};
const r={name:'Mermelada ficticia',baseYield:1000,yieldUnit:'g',items:[{ingredientId:ing.id,quantity:1}]};

test('UNIDAD-081-01 crumble y mermelada usan rendimiento en gramos; 250 g de 1000 g requieren 25% de ingredientes sin stock',()=>{
 const saved=validateRecipe(r,[ing]);assert.equal(saved.yieldUnit,'g');
 const p=scaleRecipe(saved,[ing],250);assert.equal(p.factor,0.25);assert.equal(p.lines[0].required,0.25);
 assert.equal(p.stockAvailable,false);assert.equal(ing.stock,0);
 const liquid=validateRecipe({...r,name:'Relleno líquido ficticio',yieldUnit:'ml'},[ing]);assert.equal(liquid.yieldUnit,'ml');
 assert.throws(()=>validateRecipe({...r,yieldUnit:'kg'},[ing]),/rendimiento/);
 assert.throws(()=>scaleRecipe(saved,[ing],0),/válido/);
});

test('UNIDAD-081-02 importación confirma rendimiento de 1.5 kg como 1500 g, sin inferir piezas de insumos',()=>{
 const raw={id:'demo',nombre:'Crumble sintético',estado:'confirmada',rendimiento:{cantidad:1.5,unidad:'kg'},ingredientes:[{ingrediente:'Harina de prueba',cantidad:300,unidad:'g'}],componentes:[]};
 const plan=planCatalogRecipe(raw);assert.equal(plan.ready,true);assert.equal(plan.baseYield,1500);assert.equal(plan.yieldUnit,'g');
 assert.equal(planCatalogRecipe(raw,1500,'g').ready,true);
 assert.equal(planCatalogRecipe(raw,1500,'pieza').ready,false);
 const noYield={...raw,rendimiento:{cantidad:null,unidad:'desconocida'}};
 assert.equal(planCatalogRecipe(noYield).ready,false);
 const chosen=planCatalogRecipe(noYield,500,'g');assert.equal(chosen.ready,true);assert.equal(chosen.yieldUnit,'g');
});

test('UNIDAD-081-03 fichas existentes siguen por piezas; editar conserva el ID y no modifica stock',()=>{
 const old=validateRecipe({name:'Pan ficticio',baseYield:10,items:[{ingredientId:ing.id,quantity:2}]},[ing]);assert.equal(old.yieldUnit,'pieza');
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'paniko081-'));try{
  const store=createStore(path.join(dir,'db.json'));const fake=store.addIngredient({...ing,name:'Ingrediente prueba distinto'});
  const created=store.addRecipe({name:'Crumble de prueba',baseYield:500,yieldUnit:'g',items:[{ingredientId:fake.id,quantity:0.2}]});
  const changed=store.updateRecipe(created.id,{name:'Crumble con azúcar',baseYield:1000,yieldUnit:'g',items:[{ingredientId:fake.id,quantity:0.4}]});
  assert.equal(changed.id,created.id);assert.equal(changed.yieldUnit,'g');assert.equal(store.listIngredients()[0].stock,0);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('CAL-081-01 validación estricta de fechas, tipos, estados y cantidades',()=>{
 assert.deepEqual(monthRange('2026-11'),{from:'2026-11-01',to:'2026-12-01'});
 assert.deepEqual(monthRange('2026-12'),{from:'2026-12-01',to:'2027-01-01'});
 assert.throws(()=>monthRange('2026-14'),ValidationError);
 const valid={eventDate:'2026-11-17',kind:'pendiente',title:'Comprar harina',notes:'Sin costos'};
 assert.equal(validateEntry(valid).recipeId,null);
 assert.throws(()=>validateEntry({...valid,eventDate:'2026-02-30'}),ValidationError);
 assert.throws(()=>validateEntry({...valid,kind:'desconocido'}),ValidationError);
 assert.throws(()=>validateEntry({...valid,recipeId:randomUUID()}),ValidationError);
 assert.throws(()=>validateEntry({...valid,plannedQuantity:20}),ValidationError);
 const plan=validateEntry({...valid,kind:'produccion',recipeId:randomUUID(),plannedQuantity:500});assert.equal(plan.plannedQuantity,500);
});

test('CAL-081-02 consultas y cambios no realizan operaciones de inventario, lotes ni finanzas',async()=>{
 const id=randomUUID(),recipeId=randomUUID(),logs=[];
 const db={async execute(sql,params){logs.push({sql,params});
  if(sql.startsWith('SELECT e.id'))return [[{id,event_date:'2026-11-17',kind:'produccion',title:'Preparar crumble',status:'pendiente',notes:'',recipe_id:recipeId,planned_quantity:500,yield_unit:'g'}]];
  if(sql.startsWith('SELECT id,DATE_FORMAT(created_at'))return [[{id:randomUUID(),batch_date:'2026-11-17',recipe_name:'Crumble',desired_yield:500,yield_unit:'g'}]];
  if(sql.startsWith('SELECT id FROM recipes'))return [[{id:recipeId}]];
  return [{affectedRows:1}];}};
 const store=createCalendarStore(db);
 const list=await store.month('2026-11');assert.equal(list.entries[0].plannedQuantity,500);assert.equal(list.productions[0].quantity,500);assert.equal(list.productions[0].yieldUnit,'g');
 const a=await store.create({kind:'produccion',title:'Preparar crumble',eventDate:'2026-11-17',recipeId,plannedQuantity:500});assert.equal(a.status,'pendiente');
 assert.equal((await store.setStatus(a.id,'hecho')).status,'hecho');await store.remove(a.id);
 assert.ok(logs.some(x=>x.sql.startsWith('INSERT INTO calendar_entries')));
 assert.ok(logs.every(x=>!/UPDATE ingredients|INSERT INTO production_batches|UPDATE finished_products|financial_/.test(x.sql)));
});

test('CAL-081-03 API requiere sesión, no permite consultar Finanzas al operador y no registra lotes al planificar',async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'paniko-calendar-081-'));
 const calls=[];
 const calendar={month:async m=>({month:m,entries:[],productions:[]}),create:async raw=>{calls.push(raw);return{id:randomUUID(),...raw,status:'pendiente'}},setStatus:async()=>({ok:true}),remove:async()=>({deleted:true})};
 const auth={userForToken:async token=>token==='B'.repeat(43)?{role:'operador'}:null};
 const server=createApp({store:createStore(path.join(dir,'db.json')),auth,calendar});server.listen(0,'127.0.0.1');await once(server,'listening');
 t.after(async()=>{await new Promise(resolve=>server.close(resolve));fs.rmSync(dir,{recursive:true,force:true});});
 const base=`http://127.0.0.1:${server.address().port}`;
 const headers={Cookie:'paniko_session='+'B'.repeat(43),'Content-Type':'application/json'};
 assert.equal((await fetch(base+'/api/calendar?month=2026-11')).status,401);
 assert.equal((await fetch(base+'/api/calendar?month=2026-11',{headers})).status,200);
 assert.equal((await fetch(base+'/api/finance/dashboard',{headers})).status,403);
 const res=await fetch(base+'/api/calendar/events',{method:'POST',headers,body:JSON.stringify({eventDate:'2026-11-17',kind:'pendiente',title:'Recordatorio ficticio'})});
 assert.equal(res.status,201);assert.equal(calls.length,1);
});

test('CAL-081-04 migración idempotente agrega columnas opcionales y una tabla sin actualizar registros',async()=>{
 const columns=new Set(),queries=[];
 const db={async execute(sql,params){assert.match(sql,/information_schema/);return [[{n:columns.has(params.join('.'))?1:0}]];},
  async query(sql){queries.push(sql);if(sql.includes('ALTER TABLE')){const t=sql.match(/^ALTER TABLE (\w+)/)[1];columns.add(t+'.yield_unit');}}};
 await migrate(db);await migrate(db);
 assert.equal(queries.filter(x=>x.includes('ALTER TABLE')).length,2);
 assert.equal(queries.filter(x=>x.includes('CREATE TABLE')).length,2);
 assert.match(CREATE_CALENDAR,/event_date DATE/);
 assert.ok(queries.every(x=>!/(DROP TABLE|TRUNCATE|UPDATE ingredients|DELETE FROM)/.test(x)));
});
