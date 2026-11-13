'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const {once}=require('node:events');
const {createApp}=require('../src/app');
const root=path.join(__dirname,'..','public');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const css=fs.readFileSync(path.join(root,'styles.css'),'utf8');
const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
const products=fs.readFileSync(path.join(root,'products.js'),'utf8');

test('UX-01 secciones y formularios existentes conservan sus IDs para no romper operaciones',()=>{
 const expectedViews=['dashboard','production','ingredients','recipes','products','history','private'];
 for(const view of expectedViews){
   assert.match(html,new RegExp('data-view="'+view+'"'));
   assert.match(html,new RegExp('data-view-target="'+view+'"'));
 }
 const expectedForms=['login-form','ingredient-form','recipe-form','stock-in-form','stock-out-form','adjust-stock-form','scale-form'];
 for(const id of expectedForms)assert.ok(html.includes('id="'+id+'"'),'Falta formulario '+id);
 const expectedIds=['finished-inventory-content','scale-results','produce-button','max-production-button','finished-product-selector',
   'recipe-items','ingredient-list','recipe-list','production-list','production-filter','movement-list',
   'auth-panel','auth-bar','auth-user','auth-message','notification','private-recipes-list',
   'ingredient-search','recipe-search','finished-search','finished-low-only'];
 for(const id of expectedIds)assert.ok(html.includes('id="'+id+'"'),'Falta control '+id);
 const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(x=>x[1]);
 assert.equal(new Set(ids).size,ids.length,'Todos los ids deben ser únicos');
});

test('UX-02 la interfaz mantiene acceso por roles y la confirmación de producción',()=>{
 assert.match(app,/showAuthUI\(user,required\)/);
 assert.match(app,/ingredient-create-details/);
 assert.match(app,/recipe-create-details/);
 assert.match(app,/stock-adjust-panel/);
 assert.match(app,/produce-button.*disabled=true/);
 assert.match(app,/if\(!result\.stockAvailable\)/);
 assert.match(products,/if\(isAdmin\(\)\)/);
 assert.match(products,/Registrar venta/);
});

test('UX-03 el diseño es adaptable y tiene navegación accesible',()=>{
 assert.match(html,/<nav class="nav-list"/);
 assert.match(html,/aria-current="page"/);
 assert.match(html,/aria-live="polite"/);
 assert.match(css,/@media\(max-width:520px\)/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
 assert.match(css,/overflow-x:auto/);
});

test('UX-04 el servidor sigue ofreciendo CSS y JavaScript sin tocar las APIs',async t=>{
 const server=createApp({store:{}});
 server.listen(0,'127.0.0.1');await once(server,'listening');
 t.after(()=>new Promise(resolve=>server.close(resolve)));
 const address='http://127.0.0.1:'+server.address().port;
 for(const [route,type] of [['/','text/html'],['/styles.css','text/css'],['/app.js','application/javascript'],['/products.js','application/javascript']]){
   const response=await fetch(address+route);
   assert.equal(response.status,200,route);
   assert.ok(response.headers.get('content-type').includes(type));
   assert.ok((await response.text()).length>100);
 }
});
