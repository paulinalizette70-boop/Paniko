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
