'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {once}=require('node:events');
const {createApp}=require('../src/app');
const publicDir=path.resolve(__dirname,'../public');
const html=fs.readFileSync(path.join(publicDir,'index.html'),'utf8');
const css=fs.readFileSync(path.join(publicDir,'design.css'),'utf8');
const js=fs.readFileSync(path.join(publicDir,'design.js'),'utf8');

test('DESIGN-01 conserva la navegación, formularios y secciones anteriores',()=>{
 for(const id of ['auth-panel','workspace','login-form','dashboard-title','calendar-grid','scale-form',
  'produce-button','ingredient-form','stock-in-form','stock-out-form','adjust-stock-form',
  'recipe-form','finished-inventory-content','sourdough-list','production-list',
  'finance-panel','finance-expense-form','dough-production'])
  assert.ok(html.includes('id="'+id+'"'),'Control existente ausente: '+id);
 for(const section of ['dashboard','production','ingredients','recipes','sourdough','products','history','finance'])
  assert.ok(html.includes('data-view="'+section+'"'),'Vista ausente: '+section);
 const allIds=[...html.matchAll(/\bid="([^"]+)"/g)].map(x=>x[1]);
 assert.equal(allIds.length,new Set(allIds).size,'IDs HTML deben ser únicos');
});

test('DESIGN-02 buscador y navegación móvil son controles accesibles, no decorativos',()=>{
 for(const id of ['workspace-search','mobile-menu-toggle','main-navigation','paniko-command',
  'paniko-command-input','paniko-command-results','paniko-command-close','hero-greeting','hero-day'])
  assert.ok(html.includes('id="'+id+'"'),'Falta '+id);
 assert.match(html,/role="dialog" aria-modal="true"/);
 assert.match(html,/aria-expanded="false"/);
 assert.match(html,/aria-live="polite"/);
 assert.match(js,/event\.ctrlKey\|\|event\.metaKey/);
 assert.match(js,/findNav\(entry\.view\)/);
 assert.match(js,/button\.hidden/);
 assert.match(js,/setMenu\(false\)/);
});

test('DESIGN-03 estilos adaptables, sin recursos externos ni animaciones obligatorias',()=>{
 assert.match(css,/@media\(max-width:980px\)/);
 assert.match(css,/@media\(max-width:520px\)/);
 assert.match(css, /prefers-reduced-motion:reduce/);
 assert.match(css, /:focus-visible/);
 assert.match(css, /command-panel/);
 assert.ok(!/@import|url\(https?:\/\//i.test(css),'Las fuentes y estilos no deben requerir red externa');
 assert.doesNotThrow(()=>new vm.Script(js,{filename:'design.js'}));
});

test('DESIGN-04 servidor entrega nuevo CSS y JS con sus tipos MIME',async t=>{
 const server=createApp({store:{}});
 server.listen(0,'127.0.0.1');
 await once(server,'listening');
 t.after(()=>new Promise(resolve=>server.close(resolve)));
 for(const [uri,type] of [['/design.css','text/css'],['/design.js','application/javascript']]){
   const response=await fetch('http://127.0.0.1:'+server.address().port+uri);
   assert.equal(response.status,200);
   assert.ok(response.headers.get('content-type')?.includes(type));
   assert.ok((await response.text()).length>100);
 }
});

test('DESIGN-05 CSS se carga después del tema base y sin datos privados',()=>{
 assert.ok(html.indexOf('/styles.css')<html.indexOf('/design.css'));
 assert.ok(html.includes('<script src="/design.js" defer></script>'));
 assert.ok(!html.includes('catalogo_recetas.json')&&!js.includes('catalogo_recetas.json'));
});
