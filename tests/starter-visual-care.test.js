'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {evaluate,formatRemaining}=require('../public/starter-status');
const {createApp}=require('../src/app');
const {createStore}=require('../src/store');
const os=require('node:os');
const {mkdtempSync}=fs;
const now=Date.UTC(2026,10,13,18,0,0);
const base={id:'seed',name:'Cultivo de prueba',active:true,inventoryLinked:true,location:'ambiente',feedEveryHours:12,lastFedAt:new Date(now-2*3600000).toISOString()};
const atHoursBefore=(hours)=>({...base,lastFedAt:new Date(now-hours*3600000).toISOString()});

test('VIS-01 cuida los estados temporalmente sin afirmar fermentación ni readiness',()=>{
 const good=evaluate(base,now);assert.equal(good.code,'ontrack');assert.equal(good.nextAt,now+10*3600000);
 assert.equal(Math.round(good.progress),17);assert.equal(good.requiresAttention,false);
 const soon=evaluate(atHoursBefore(11),now);assert.equal(soon.code,'soon');assert.equal(soon.requiresAttention,true);
 const late=evaluate(atHoursBefore(16),now);assert.equal(late.code,'overdue');assert.equal(late.requiresAttention,true);
 assert.match(late.note,/revisar|alimentar/i);
 assert.doesNotMatch([good.label,soon.label,late.label].join(','),/lista para hornear|fermentad[ao]|saludable/i);
});
test('VIS-02 refrigerador, seguimiento pausado, sin alimentación ni vínculo',()=>{
 assert.equal(evaluate({...base,location:'refrigerador'},now).code,'cold');
 assert.equal(evaluate({...atHoursBefore(11),location:'refrigerador'},now).code,'soon');
 assert.equal(evaluate({...atHoursBefore(13),location:'refrigerador'},now).code,'overdue');
 assert.equal(evaluate({...base,active:false},now).code,'paused');
 assert.equal(evaluate({...base,inventoryLinked:false},now).code,'unlinked');
 assert.equal(evaluate({...base,lastFedAt:null},now).code,'unfed');
 assert.equal(evaluate({...base,lastFedAt:'inválido'},now).code,'unfed');
 assert.equal(evaluate({...base,feedEveryHours:0},now).code,'unfed');
});
test('VIS-03 formatea el tiempo y no inventa horarios',()=>{
 assert.match(formatRemaining(0.5),/30 min/);
 assert.match(formatRemaining(1.5),/2 h/);
 assert.match(formatRemaining(-2.1),/Retraso de 3 h/);
 assert.match(formatRemaining(null),/Sin horario/);
});
test('VIS-04 Inicio muestra estado y acciones mientras la pantalla conserva APIs de inventario',()=>{
 const html=fs.readFileSync(path.join(__dirname,'..','public','index.html'),'utf8');
 const source=fs.readFileSync(path.join(__dirname,'..','public','sourdough.js'),'utf8');
 assert.match(html,/id="sourdough-home"/);
 assert.match(html,/id="sourdough-home-items"/);
 assert.match(html,/src="\/starter-status\.js"/);
 assert.match(html,/id="sourdough-list"/);
 assert.match(source,/PanikoStarterStatus/);
 assert.match(source,/currentWeightGrams/);
 for(const route of ['/link-inventory','/reconcile-inventory','/feed','/feedings','/update'])assert.ok(source.includes(route),route);
 assert.match(source,/PanikoRefreshInventory/);
 assert.match(source,/setInterval\(updateLive/);
 assert.match(source,/fetch\(url/);
});
test('VIS-05 recurso de estados servido por HTTP sin reconfigurar MySQL',async t=>{
 const dir=mkdtempSync(path.join(os.tmpdir(),'paniko-visual-'));
 t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const server=createApp({store:createStore(path.join(dir,'empty.json'))});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(()=>server.close());
 const response=await fetch(`http://127.0.0.1:${server.address().port}/starter-status.js`);
 assert.equal(response.status,200);
 assert.match(await response.text(),/requiresAttention/);
});
