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

async function exerciseDough(source,html,assert,execute){
 class Node{
  constructor(tag='div'){this.tag=tag;this.children=[];this.dataset={};this.handlers={};this.attributes={};this.value='';this.textContent='';this.className='';this.disabled=false;this.hidden=false;this.elements={};}
  append(...items){this.children.push(...items);}
  replaceChildren(...items){this.children=items; if(this.tag==='select')this.value='';this.textContent='';}
  get options(){return this.children;}
  setAttribute(k,v){this.attributes[k]=v;}
  addEventListener(k,f){(this.handlers[k]??=[]).push(f);}
  async fire(k,props={}){for(const f of this.handlers[k]||[])await f({preventDefault(){},...props});}
  remove(){}
  focus(){}
  scrollIntoView(){}
  matches(s){return s.startsWith('.')?this.className.split(' ').includes(s.slice(1)):s==='[data-dough-panel]'?!!this.dataset.doughPanel:s==='[data-dough-go]'?!!this.dataset.doughGo:s==='[data-dough-panel="settings"]'?this.dataset.doughPanel==='settings':s==='[data-dough-go="settings"]'?this.dataset.doughGo==='settings':s==='button[type=submit]'?this.tag==='button'&&this.type==='submit':this.tag===s;}
  querySelectorAll(s){const parts=s.split(',');const all=this.children.flatMap(n=>[n,...n.querySelectorAll(s)]);return all.filter((n,i)=>parts.some(p=>n.matches(p))&&all.indexOf(n)===i);}
  querySelector(s){return this.querySelectorAll(s)[0]||null;}
 }
 const ids=new Map();
 for(const m of html.matchAll(/<([a-z]+)[^>]*\bid="([^"]+)"/g))ids.set(m[2],new Node(m[1]));
 const $=id=>{if(!ids.has(id))throw Error('Falta ID '+id);return ids.get(id)};
 function form(id,fields){const f=$(id);for(const [name,tag] of Object.entries(fields)){const n=new Node(tag);f.elements[name]=n;f.append(n);}const b=new Node('button');b.type='submit';f.append(b);return f;}
 const base=form('dough-base-form',{recipeId:'select',referenceGrams:'input'});
 const format=form('dough-format-form',{recipeId:'select',productMode:'select',productId:'select',productName:'input',doughGrams:'input'});
 format.elements.productMode.value='new';
 const batch=form('dough-batch-form',{recipeId:'select'});batch.append($('dough-batch-formats'),$('dough-calculate'));
 const prep=form('dough-prep-batch-form',{recipeId:'select',quantity:'input'});
 form('dough-prep-link-form',{recipeId:'select',ingredientId:'select'});
 const root=$('dough-production'),nav={};
 for(const name of ['batch','prep','settings']){const b=new Node('button');b.dataset.doughPanel=name;root.append(b);nav[name]=b;}
 const doc=new Node();doc.getElementById=$;doc.createElement=t=>new Node(t);
 const formats=[{recipeId:'brioche',productId:'concha',productName:'Concha',active:true,doughGrams:45,extras:[]},{recipeId:'brioche',productId:'bollo',productName:'Bollo',active:true,doughGrams:35,extras:[]}];
 const records={'/api/dough/config':{bases:[{recipeId:'brioche',recipeName:'Brioche',referenceGrams:2000}],formats},'/api/products':formats.map(f=>({id:f.productId,name:f.productName,active:true,operationalRecipeId:'brioche'})),'/api/ingredients':[{id:'crust',name:'Costra',unit:'g'},{id:'cream',name:'Queso crema',unit:'kg'}],'/api/recipes':[{id:'brioche',name:'Brioche',baseYield:2000,yieldUnit:'g'},{id:'crust-recipe',name:'Costra',baseYield:500,yieldUnit:'g'},{id:'jam-recipe',name:'Mermelada de guayaba',baseYield:600,yieldUnit:'g'},{id:'unmeasured',name:'Otra costra',baseYield:1,yieldUnit:'pieza'}],'/api/dough/preparations':[{recipeId:'crust-recipe',ingredientId:'crust',recipeName:'Costra',yieldUnit:'g',unit:'g',baseYield:500,stock:200}]};
 let resolvePreview,posts=[];
 const response=x=>({ok:true,json:async()=>x});
 const fetch=async(url,opt={})=>{
   if(opt.method==='POST'){posts.push({url,data:JSON.parse(opt.body)});if(url==='/api/dough/preview')return new Promise(resolve=>{resolvePreview=()=>resolve(response({totalPieces:20,doughGrams:900,recipeName:'Brioche',formats:[{productName:'Concha',pieces:20,doughGramsPerPiece:45,doughGrams:900}],consumptions:[],stockAvailable:true}));});}
   if(opt.method==='POST'&&url==='/api/dough/preparations'){
     records['/api/ingredients'].push({id:'jam',name:'Preparacion: Mermelada de guayaba',unit:'g',stock:0});
     records['/api/dough/preparations'].push({recipeId:'jam-recipe',ingredientId:'jam',recipeName:'Mermelada de guayaba',yieldUnit:'g',unit:'g',baseYield:600,stock:0});
     return response({recipeId:'jam-recipe',ingredientId:'jam'});
   }
   if(opt.method==='POST'&&url==='/api/dough/product')return response({id:'bun'});
   if(!(url in records))throw Error('Ruta inesperada '+url);return response(records[url]);
 };
 const win={};
 execute(source,doc,win,fetch);
 await doc.fire('paniko:auth',{detail:{user:{role:'admin'}}});
 for(let i=0;i<30;i++)await Promise.resolve();
 assert.equal(batch.elements.recipeId.value,'brioche');
 assert.equal(format.elements.productName.disabled,false);
 assert.equal(format.elements.productId.disabled,true);
 assert.equal($('dough-batch-formats').children.length,2);
 const qty=()=>$('dough-batch-formats').children[0].querySelector('.dough-pieces');
 qty().value='20';await batch.fire('input');
 assert.equal($('dough-live-totals').children[0].children[1].textContent,'20');
 assert.equal($('dough-live-totals').children[1].children[1].textContent,'900 g');
 await nav.prep.fire('click');assert.equal($('dough-panel-prep').hidden,false);
 await nav.batch.fire('click');assert.equal(qty().value,'20');
 await $('dough-reload').fire('click');for(let i=0;i<30;i++)await Promise.resolve();
 assert.equal(qty().value,'20');
 const pending=batch.fire('submit');await Promise.resolve();
 assert.equal(posts[0].data.formats[0].pieces,20);
 qty().value='21';await batch.fire('input');resolvePreview();await pending;
 assert.equal($('dough-confirm').disabled,true);
 assert.equal($('dough-batch-preview').children.length,0);
 assert.equal(posts.filter(p=>p.url.endsWith('/confirm')).length,0);
 await nav.settings.fire('click');
 await $('dough-add-extra').fire('click');
 assert.equal($('dough-extra-items').children[0].children[0].options[1].value,'crust');
 // Bun de guayaba: conservar el borrador al vincular una preparación que aún no está en inventario.
 format.elements.productName.value='Bun de guayaba y queso crema';
 format.elements.doughGrams.value='50';
 const row=$('dough-extra-items').children[0],select=row.children[0];
 assert.ok(select.options.some(o=>o.value==='recipe:jam-recipe'));
 select.value='recipe:jam-recipe';await select.fire('change');
 row.children[1].value='15';
 assert.equal(row.children[2].value,'g');
 assert.equal(row.children[4].hidden,false);
 await $('dough-add-direct-extra').fire('click');
 const creamRow=$('dough-extra-items').children[1];
 creamRow.children[0].value='cream';await creamRow.children[0].fire('change');
 creamRow.children[1].value='10';
 assert.equal(creamRow.children[2].value,'g');
 await format.fire('submit');
 assert.equal(posts.filter(p=>p.url==='/api/dough/product').length,0);
 await row.children[4].children[1].fire('click');
 assert.equal(posts.filter(p=>p.url==='/api/dough/preparations').length,1);
 assert.equal(select.value,'jam');
 assert.equal(row.children[1].value,'15');
 assert.equal(creamRow.children[1].value,'10');
 assert.equal(format.elements.productName.value,'Bun de guayaba y queso crema');
 assert.equal(format.elements.doughGrams.value,'50');
 await format.fire('submit');
 const saved=posts.find(p=>p.url==='/api/dough/product').data;
 assert.equal(saved.name,'Bun de guayaba y queso crema');
 assert.equal(saved.doughGrams,50);
 assert.equal(JSON.stringify(saved.extras),JSON.stringify([{ingredientId:'jam',quantity:15,unit:'g'},{ingredientId:'cream',quantity:10,unit:'g'}]));
 assert.equal(posts.filter(p=>p.url.endsWith('/confirm')||p.url.endsWith('/produce')).length,0);
}

test('PREP-UI-07: recorrido simulado conserva piezas y descarta vista previa obsoleta',async()=>{
 const source=fs.readFileSync(path.join(__dirname,'../public/dough.js'),'utf8');
 const html=fs.readFileSync(path.join(__dirname,'../public/index.html'),'utf8');
 await exerciseDough(source,html,assert,(s,doc,win,fetch)=>require('node:vm').runInNewContext(s,{document:doc,window:win,fetch,confirm:()=>true,crypto:{randomUUID:()=>randomUUID()}}));
});

test('PREP-UI-08: incluye fichas de mermelada sin vincular y detecta existencia equivalente',()=>{
 const {doughPreparationChoices,doughMatchingStock}=require('../public/dough.js');
 const jam={id:'recipe-jam',name:'Mermelada de guayaba',yieldUnit:'g',items:[{ingredientId:'fruit'}]};
 const recipes=[jam,{id:'base',name:'Brioche',yieldUnit:'g'},{id:'other',name:'Costra',yieldUnit:'pieza'}];
 const ingredients=[{id:'jam',name:'Preparación: Mermelada de guayaba',unit:'kg'},{id:'fruit',name:'Guayaba',unit:'kg'},{id:'cream',name:'Queso crema',unit:'kg'}];
 const options=doughPreparationChoices(ingredients,[],recipes,[{recipeId:'base'}]);
 assert.equal(options.some(o=>o.id==='recipe:recipe-jam'),true);
 assert.equal(options.some(o=>o.id==='recipe:base'),false);
 assert.match(options.find(o=>o.id==='recipe:other').name,/falta rendimiento/);
 assert.deepEqual(doughMatchingStock(jam,ingredients,[]).map(i=>i.id),['jam']);
 assert.deepEqual(doughMatchingStock(jam,ingredients,[{ingredientId:'jam'}]),[]);
});
test('PREP-BUN-01: 20 buns consumen 1000 g masa, 200 g queso y 300 g mermelada',()=>{
 const {validateFormat,buildPlan}=require('../src/dough-formats');
 const [rid,pid,flour,cream,jam]=Array.from({length:5},()=>randomUUID());
 const ingredients=[{id:flour,name:'Harina de prueba',unit:'g',stock:3000,costPerUnit:0.01},{id:cream,name:'Queso crema',unit:'kg',stock:0.5,costPerUnit:100},{id:jam,name:'Mermelada de guayaba',unit:'g',stock:300,costPerUnit:0.1}];
 const recipe={id:rid,name:'Brioche de prueba',baseYield:2000,yieldUnit:'g',items:[{ingredientId:flour,quantity:1000}]};
 const f=validateFormat({recipeId:rid,productId:pid,doughGrams:50,extras:[{ingredientId:cream,quantity:10,unit:'g'},{ingredientId:jam,quantity:15,unit:'g'}]},ingredients);
 const formats=[{...f,productName:'Bun de guayaba',active:true}];
 const plan=buildPlan(recipe,2000,formats,[{productId:pid,pieces:20}],ingredients);
 assert.equal(plan.totalPieces,20);assert.equal(plan.doughGrams,1000);
 assert.equal(plan.consumptions.find(x=>x.ingredientId===cream).required,0.2);
 assert.equal(plan.consumptions.find(x=>x.ingredientId===jam).required,300);
 assert.equal(plan.consumptions.find(x=>x.ingredientId===flour).required,500);
 assert.equal(plan.stockAvailable,true);
 ingredients[2].stock=100;
 const shortage=buildPlan(recipe,2000,formats,[{productId:pid,pieces:20}],ingredients);
 assert.equal(shortage.stockAvailable,false);
 assert.equal(shortage.consumptions.find(x=>x.ingredientId===jam).shortage,200);
});
