'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const {validateFormat,buildPlan,createDoughFormatStore}=require('../src/dough-formats');
const {createApp}=require('../src/app');
const {createStore}=require('../src/store');
const os=require('node:os');const fs=require('node:fs');const path=require('node:path');
const ID={recipe:randomUUID(),harina:randomUUID(),leche:randomUUID(),costra:randomUUID(),jam:randomUUID(),queso:randomUUID(),concha:randomUUID(),hamb:randomUUID(),bun:randomUUID()};
const ingredients=[
 {id:ID.harina,name:'Harina de trigo',unit:'g',stock:2000,costPerUnit:.02},
 {id:ID.leche,name:'Leche entera',unit:'ml',stock:2000,costPerUnit:.015},
 {id:ID.costra,name:'Costra de concha preparada',unit:'g',stock:200,costPerUnit:.08},
 {id:ID.jam,name:'Mermelada de higo',unit:'kg',stock:.5,costPerUnit:90},
 {id:ID.queso,name:'Queso crema',unit:'g',stock:400,costPerUnit:.09},
];
const recipe={id:ID.recipe,name:'Brioche',yieldUnit:'g',baseYield:1000,
 items:[{ingredientId:ID.harina,quantity:600},{ingredientId:ID.leche,quantity:200}]};
const formats=[
 {recipeId:ID.recipe,productId:ID.concha,productName:'Concha brioche',active:true,doughGrams:45,
   extras:[{ingredientId:ID.costra,quantityPerPiece:15}]},
 {recipeId:ID.recipe,productId:ID.hamb,productName:'Bollo hamburguesa',active:true,doughGrams:60,extras:[]},
 {recipeId:ID.recipe,productId:ID.bun,productName:'Bun con mermelada',active:true,doughGrams:70,
   extras:[{ingredientId:ID.jam,quantityPerPiece:.02},{ingredientId:ID.queso,quantityPerPiece:15}]},
];
const requested=[{productId:ID.concha,pieces:10},{productId:ID.hamb,pieces:12},{productId:ID.bun,pieces:8}];
test('FORM-01 una sola masa de 1730g permite tres formatos y calcula todos los complementos',()=>{
 const r=buildPlan(recipe,1000,formats,requested,ingredients);
 assert.equal(r.totalPieces,30);assert.equal(r.doughGrams,1730);
 const qty=Object.fromEntries(r.consumptions.map(x=>[x.name,x.required]));
 assert.equal(qty['Harina de trigo'],1038);assert.equal(qty['Leche entera'],346);
 assert.equal(qty['Costra de concha preparada'],150);
 assert.equal(qty['Mermelada de higo'],.16);
 assert.equal(qty['Queso crema'],120);assert.equal(r.stockAvailable,true);
 assert.deepEqual(r.formats.map(x=>x.doughGrams),[450,720,560]);
});
test('FORM-02 se bloquean faltantes, formatos repetidos y mezclas incompatibles',()=>{
 const deficient=ingredients.map(i=>({...i,stock:i.id===ID.jam?.1:i.stock}));
 const result=buildPlan(recipe,1000,formats,requested,deficient);
 assert.equal(result.stockAvailable,false);assert.equal(result.consumptions.find(x=>x.ingredientId===ID.jam).shortage,.06);
 assert.throws(()=>buildPlan(recipe,1000,formats,[requested[0],requested[0]],ingredients),/repitas/);
 assert.throws(()=>buildPlan(recipe,999,formats,requested,ingredients),/debe coincidir/);
 assert.throws(()=>buildPlan({...recipe,yieldUnit:'ml'},1000,formats,requested,ingredients),/mililitros/);
 assert.throws(()=>buildPlan(recipe,1000,formats,[{productId:randomUUID(),pieces:1}],ingredients),/formato activo/);
});
test('FORM-03 fichas viejas en piezas pueden indicar el rendimiento real de masa en g',()=>{
 const old={...recipe,baseYield:20,yieldUnit:'pieza'};
 const r=buildPlan(old,1000,formats,[requested[0]],ingredients);
 assert.equal(r.doughGrams,450);assert.equal(r.consumptions.find(x=>x.ingredientId===ID.harina).required,270);
});
test('FORM-04 se convierten los complementos a la unidad de inventario sin inventar equivalencias',()=>{
 const raw={recipeId:ID.recipe,productId:ID.bun,doughGrams:70,extras:[{ingredientId:ID.jam,quantity:20,unit:'g'}]};
 assert.equal(validateFormat(raw,ingredients).extras[0].quantityPerPiece,.02);
 assert.throws(()=>validateFormat({...raw,extras:[{ingredientId:ID.jam,quantity:1,unit:'pieza'}]},ingredients),/incompatibles/);
 assert.throws(()=>validateFormat({...raw,extras:[{ingredientId:ID.jam,quantity:20,unit:'g'},{ingredientId:ID.jam,quantity:10,unit:'g'}]},ingredients),/repitas/);
});
function fakePool(start={}){
 const stock=new Map(ingredients.map(i=>[i.id,i.stock]));
 const prodStock=new Map([[ID.concha,0],[ID.hamb,0],[ID.bun,0]]);
 const logs={commits:0,rollbacks:0,movements:[],finishedMovements:[],batch:[],formats:[]};
 let pending=null;
 const conn={
  async beginTransaction(){pending={stock:new Map(stock),prodStock:new Map(prodStock)};},
  async commit(){logs.commits++;pending=null;},
  async rollback(){logs.rollbacks++;if(pending){stock.clear();for(const [k,v] of pending.stock)stock.set(k,v);prodStock.clear();for(const [k,v] of pending.prodStock)prodStock.set(k,v)}pending=null},
  release(){},
  async execute(sql,args=[]){
   if(sql.startsWith('SELECT reference_dough_grams'))return [[{reference_dough_grams:1000}]];
   if(sql.startsWith('SELECT id,name,base_yield,yield_unit FROM recipes'))return [[{id:ID.recipe,name:'Brioche',base_yield:1000,yield_unit:'g'}]];
   if(sql.startsWith('SELECT ingredient_id,quantity FROM recipe_items'))return [[{ingredient_id:ID.harina,quantity:600},{ingredient_id:ID.leche,quantity:200}]];
   if(sql.includes('FROM dough_product_formats f JOIN finished_products'))return [formats.map(f=>({product_id:f.productId,recipe_id:f.recipeId,dough_grams_per_piece:f.doughGrams,active:1,product_name:f.productName}))];
   if(sql.includes('FROM dough_product_extras e JOIN dough_product_formats'))return [formats.flatMap(f=>f.extras.map(e=>({product_id:f.productId,ingredient_id:e.ingredientId,quantity_per_piece:e.quantityPerPiece})))];
   if(sql.startsWith('SELECT id,name,unit,cost_per_unit,stock FROM ingredients WHERE')){
     const ing=ingredients.find(i=>i.id===args[0]);return [[{id:ing.id,name:ing.name,unit:ing.unit,cost_per_unit:ing.costPerUnit,stock:stock.get(ing.id)}]];
   }
   if(sql.startsWith('SELECT id,name,stock,active,operational_recipe_id FROM finished_products')){
     const f=formats.find(x=>x.productId===args[0]);return [[{id:f.productId,name:f.productName,stock:prodStock.get(f.productId),active:1,operational_recipe_id:ID.recipe}]];
   }
   if(sql.startsWith('UPDATE ingredients SET stock')){
     if(start.failIngredient&&args[1]===start.failIngredient)return [{affectedRows:0}];
     stock.set(args[1],args[0]);return [{affectedRows:1}];
   }
   if(sql.startsWith('UPDATE finished_products SET stock')){prodStock.set(args[1],args[0]);return [{affectedRows:1}]}
   if(sql.includes('INSERT INTO inventory_movements'))logs.movements.push(args);
   if(sql.includes('INSERT INTO finished_product_movements'))logs.finishedMovements.push(args);
   if(sql.includes('INSERT INTO production_batches'))logs.batch.push(args);
   if(sql.includes('INSERT INTO production_batch_formats'))logs.formats.push(args);
   return [{affectedRows:1}];
  }
 };
 return {getConnection:async()=>conn,execute:conn.execute.bind(conn),logs,stock,prodStock};
}
test('FORM-05 confirmación atómica consume insumos y registra tres productos en un lote',async()=>{
 const db=fakePool(),svc=createDoughFormatStore(db);
 const before=await svc.preview({recipeId:ID.recipe,formats:requested});
 assert.equal(db.stock.get(ID.harina),2000);assert.equal(before.stockAvailable,true);
 const res=await svc.confirm({recipeId:ID.recipe,formats:requested});
 assert.equal(res.totalPieces,30);assert.equal(res.doughGrams,1730);
 assert.equal(db.stock.get(ID.harina),962);
 assert.equal(db.stock.get(ID.jam),.34);
 assert.equal(db.prodStock.get(ID.concha),10);assert.equal(db.prodStock.get(ID.hamb),12);assert.equal(db.prodStock.get(ID.bun),8);
 assert.equal(db.logs.batch.length,1);assert.equal(db.logs.formats.length,3);assert.equal(db.logs.finishedMovements.length,3);
 assert.equal(db.logs.movements.length,5);assert.equal(db.logs.commits,1);assert.equal(db.logs.rollbacks,0);
});
test('FORM-06 si falla la actualización no se conserva ningún movimiento ni stock',async()=>{
 const db=fakePool({failIngredient:ID.leche}),svc=createDoughFormatStore(db);
 await assert.rejects(()=>svc.confirm({recipeId:ID.recipe,formats:requested}),/inventario cambió/);
 assert.equal(db.logs.commits,0);assert.equal(db.logs.rollbacks,1);
 assert.equal(db.stock.get(ID.harina),2000);
 assert.equal(db.prodStock.get(ID.concha),0);
});
test('FORM-07 API requiere sesión y restringe cambios de formatos a administración',async t=>{
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'paniko-dough-'));
 const tokenAdmin='A'.repeat(43),tokenOperator='B'.repeat(43);
 let setCalls=0,confirmCalls=0;
 const auth={async userForToken(token){return token===tokenAdmin?{role:'admin'}:token===tokenOperator?{role:'operador'}:null;}};
 const dough={list:async()=>({bases:[],formats:[]}),setBase:async()=>{setCalls++;return{};},setFormat:async()=>{setCalls++;return{};},preview:async()=>({estimatedTotalCost:100,doughGrams:1,formats:[]}),confirm:async()=>{confirmCalls++;return {id:randomUUID()}}};
 const app=createApp({store:createStore(path.join(tmp,'data.json')),auth,dough});
 await new Promise(ok=>app.listen(0,'127.0.0.1',ok));
 t.after(()=>{app.close();fs.rmSync(tmp,{recursive:true,force:true})});
 const base='http://127.0.0.1:'+app.address().port;
 const req=async(route,token=null,method='GET')=>fetch(base+route,{method,headers:{...(token?{Cookie:'paniko_session='+token}:{}),...(method==='POST'?{'Content-Type':'application/json'}:{})},...(method==='POST'?{body:'{}'}:{})});
 assert.equal((await req('/api/dough/config')).status,401);
 assert.equal((await req('/api/dough/base',tokenOperator,'POST')).status,403);
 assert.equal((await req('/api/dough/format',tokenOperator,'POST')).status,403);
 assert.equal(setCalls,0);
 assert.equal((await req('/api/dough/base',tokenAdmin,'POST')).status,200);
 const preview=await req('/api/dough/preview',tokenOperator,'POST');
 assert.equal(preview.status,200);assert.equal('estimatedTotalCost' in await preview.json(),false);
 assert.equal((await req('/api/dough/confirm',tokenOperator,'POST')).status,201);assert.equal(confirmCalls,1);
});

const fsVisual=require('node:fs');
const pathVisual=require('node:path');
test('FORM-UI producción por formatos accesible dentro de Producción, sin enlace lateral',()=>{
 const html=fsVisual.readFileSync(pathVisual.join(__dirname,'../public/index.html'),'utf8');
 const js=fsVisual.readFileSync(pathVisual.join(__dirname,'../public/app.js'),'utf8');
 assert.match(html,/data-view-target="production" data-scroll-to="dough-production"/);
 assert.doesNotMatch(html,/<button class="nav-link"[^>]+data-scroll-to="dough-production"/);
 assert.match(html,/Abrir producción por formatos/);
 assert.match(js,/scrollTo:button\.dataset\.scrollTo\|\|null/);
});
