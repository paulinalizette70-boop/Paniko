'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const {createApp}=require('../src/app');
const {createStore}=require('../src/store');
const os=require('node:os'),fs=require('node:fs'),path=require('node:path');
test('PREP-API: solo administracion vincula recetas y crea productos; operador puede producir',async t=>{
 const folder=fs.mkdtempSync(path.join(os.tmpdir(),'paniko-prep-'));
 const admin='A'.repeat(43),operator='B'.repeat(43);
 const rid=randomUUID();let products=0,registrations=0,productions=0;
 const auth={async userForToken(token){return token===admin?{role:'admin'}:token===operator?{role:'operador'}:null;}};
 const dough={list:async()=>({bases:[],formats:[]}),createProduct:async()=>{products++;return{id:randomUUID()}}};
 const preparations={
   list:async()=>[{recipeId:rid,ingredientId:randomUUID(),stock:100}],
   register:async()=>{registrations++;return{ok:true}},
   preview:async()=>({recipeId:rid,estimatedTotalCost:500,outputUnitCost:32,stockAvailable:true,
     lines:[{name:'Azucar',required:20,unitCost:15,estimatedCost:300}]}),
   produce:async()=>{productions++;return{ok:true}}
 };
 const app=createApp({store:createStore(path.join(folder,'data.json')),auth,dough,preparations});
 await new Promise(ok=>app.listen(0,'127.0.0.1',ok));
 t.after(()=>{app.close();fs.rmSync(folder,{recursive:true,force:true})});
 const base='http://127.0.0.1:'+app.address().port;
 const req=(url,token=null,method='GET',data={})=>fetch(base+url,{method,
   headers:{...(token?{Cookie:'paniko_session='+token}:{}),...(method==='POST'?{'Content-Type':'application/json'}:{})},
   ...(method==='POST'?{body:JSON.stringify(data)}:{})});
 assert.equal((await req('/api/dough/preparations')).status,401);
 assert.equal((await req('/api/dough/preparations',operator,'POST')).status,403);
 assert.equal((await req('/api/dough/product',operator,'POST')).status,403);
 assert.equal(products,0);assert.equal(registrations,0);
 assert.equal((await req('/api/dough/preparations',admin,'POST')).status,201);
 assert.equal((await req('/api/dough/product',admin,'POST')).status,201);
 assert.equal(products,1);assert.equal(registrations,1);
 const p=await req('/api/dough/preparations/preview',operator,'POST');
 assert.equal(p.status,200);const payload=await p.json();
 assert.equal('estimatedTotalCost' in payload,false);
 assert.equal('unitCost' in payload.lines[0],false);
 assert.equal('outputUnitCost' in payload,false);
 assert.equal((await req('/api/dough/preparations/produce',operator,'POST')).status,201);
 assert.equal(productions,1);
 // El flujo tradicional no puede consumir una subpreparacion sin registrar su inventario final.
 const old=await req('/api/recipes/'+rid+'/produce',operator,'POST',{desiredYield:100});
 assert.equal(old.status,409);
 assert.match((await old.json()).error,/subpreparaci[oó]n/i);
});
test('PREP-UI: crear desde Recetas, preparar costra y no agregar menu lateral',()=>{
 const html=fs.readFileSync(path.join(__dirname,'../public/index.html'),'utf8');
 const app=fs.readFileSync(path.join(__dirname,'../public/app.js'),'utf8');
 const dough=fs.readFileSync(path.join(__dirname,'../public/dough.js'),'utf8');
 assert.match(app,/Crear productos desde esta receta/);
 assert.match(html,/id="dough-prep-batch-form"/);
 assert.match(html,/id="dough-format-form"/);
 assert.match(dough,/\/api\/dough\/product/);
 assert.match(dough,/\/api\/dough\/preparations\/produce/);
 assert.doesNotMatch(html,/<button class="nav-link"[^>]+(?:Brioche|Preparaciones)/);
});

test('PREP-UI-02: selector de preparados excluye materias primas y el directo excluye preparados',()=>{
 const {doughComplementChoices}=require('../public/dough.js');
 const ingredients=[
   {id:'flour',name:'Harina',unit:'kg'},
   {id:'cream',name:'Queso crema',unit:'g'},
   {id:'crust',name:'Costra de prueba',unit:'g'},
   {id:'jam',name:'Mermelada de prueba',unit:'kg'}
 ];
 const preparations=[{ingredientId:'crust'},{ingredientId:'jam'}];
 assert.deepEqual(doughComplementChoices(ingredients,preparations,'prepared').map(x=>x.id),['crust','jam']);
 assert.deepEqual(doughComplementChoices(ingredients,preparations,'direct').map(x=>x.id),['flour','cream']);
 assert.deepEqual(doughComplementChoices(ingredients,[],'prepared'),[]);
 assert.equal(ingredients.length,4);
 const html=fs.readFileSync(path.join(__dirname,'../public/index.html'),'utf8');
 assert.match(html,/id="dough-add-extra"[^>]*>\+ Agregar preparación/);
 assert.match(html,/id="dough-add-direct-extra"[^>]*>\+ Agregar ingrediente directo/);
});

test('PREP-UI-03: crear producto habilita nombre y elimina cualquier selección anterior',()=>{
 const {syncDoughProductMode}=require('../public/dough.js');
 const fields={productMode:{value:'new'},productId:{value:'old-product'},productName:{value:'Concha nueva'}};
 assert.equal(syncDoughProductMode(fields),false);
 assert.equal(fields.productId.value,'');
 assert.equal(fields.productId.disabled,true);
 assert.equal(fields.productId.required,false);
 assert.equal(fields.productName.disabled,false);
 assert.equal(fields.productName.required,true);
 assert.equal(fields.productName.value,'Concha nueva');
 fields.productMode.value='edit';fields.productId.value='existing';
 assert.equal(syncDoughProductMode(fields),true);
 assert.equal(fields.productId.disabled,false);
 assert.equal(fields.productId.required,true);
 assert.equal(fields.productName.disabled,true);
 assert.equal(fields.productName.required,false);
 fields.productMode.value='new';
 syncDoughProductMode(fields);
 assert.equal(fields.productId.value,'');
 assert.equal(fields.productName.disabled,false);
 const html=fs.readFileSync(path.join(__dirname,'../public/index.html'),'utf8');
 assert.match(html,/<option value="new" selected>Crear producto nuevo/);
 assert.match(html,/<select name="productId" disabled>/);
});

test('PREP-UI-04: jornada de producción calcula piezas y masa sin redondear ni sumar complementos',()=>{
 const {doughBatchTotals}=require('../public/dough.js');
 const formats=[{productId:'concha',doughGrams:45},{productId:'hamburguesa',doughGrams:60},{productId:'bollo',doughGrams:35},{productId:'bun',doughGrams:70}];
 assert.deepEqual(doughBatchTotals(formats,{concha:20,hamburguesa:12,bollo:10,bun:10}),{pieces:52,grams:2670,valid:true});
 assert.deepEqual(doughBatchTotals(formats,{}),{pieces:0,grams:0,valid:true});
 assert.equal(doughBatchTotals(formats,{concha:1.5}).valid,false);
 assert.equal(doughBatchTotals(formats,{concha:-1}).valid,false);
 assert.equal(doughBatchTotals(formats,{concha:1000001}).valid,false);
});
test('PREP-UI-05: no ofrece editar productos de otra masa ni productos inactivos',()=>{
 const {doughEditableProducts}=require('../public/dough.js');
 const products=[{id:'a',active:true,operationalRecipeId:'brioche'},{id:'b',active:true,operationalRecipeId:'other'},{id:'c',active:false},{id:'d',active:true},{id:'e',active:true}];
 assert.deepEqual(doughEditableProducts(products,[{productId:'e',recipeId:'other'}],'brioche').map(p=>p.id),['a','d']);
 assert.deepEqual(doughEditableProducts(products,[],''),[]);
});
test('PREP-UI-06: producción diaria primero, paneles separados y controles disponibles',()=>{
 const html=fs.readFileSync(path.join(__dirname,'../public/index.html'),'utf8');
 assert.ok(html.indexOf('id="dough-panel-batch"')<html.indexOf('id="dough-panel-prep"'));
 assert.ok(html.indexOf('id="dough-panel-prep"')<html.indexOf('id="dough-panel-settings"'));
 for(const id of ['dough-live-totals','dough-clear-pieces','dough-calculate','dough-product-cards','dough-reload','dough-prep-quantity-label'])
   assert.ok(html.includes('id="'+id+'"'),id);
 assert.match(html,/id="dough-panel-prep" hidden/);
 assert.match(html,/id="dough-panel-settings" hidden/);
});
