'use strict';
const test=require('node:test');const assert=require('node:assert/strict');const {randomUUID}=require('node:crypto');const {once}=require('node:events');
const {starterForm,planFeeding,createSourdoughStore}=require('../src/sourdough');const {createApp}=require('../src/app');
const ID=randomUUID(),A='A'.repeat(43),B='B'.repeat(43);
test('MASA-080-01 crea masa madre sin inventar peso',()=>{
 const s=starterForm({name:' Principal ',location:'ambiente',feedEveryHours:24});
 assert.equal(s.name,'Principal');assert.equal(s.initialWeightGrams,null);
 assert.throws(()=>starterForm({name:'Prueba',location:'ambiente',feedEveryHours:0}));
});
test('MASA-080-02 la alimentación cuadra descartes y agregados; hidratación solo de alimentación',()=>{
 const result=planFeeding({discardedGrams:20,flourGrams:50,waterGrams:50,notes:'Burbujas'},100);
 assert.equal(result.afterGrams,180);assert.equal(result.feedHydrationPercent,100);
 assert.throws(()=>planFeeding({discardedGrams:101,flourGrams:20,waterGrams:20},100),/descartar/);
 assert.throws(()=>planFeeding({discardedGrams:0,flourGrams:20,waterGrams:20},null),/indica cuántos gramos/);
});
test('MASA-080-03 no deja registrar alimentaciones desconectadas del inventario',async()=>{
 let commits=0,rollbacks=0;
 const c={async beginTransaction(){},async commit(){commits++;},async rollback(){rollbacks++;},release(){},
  async execute(sql){if(sql.startsWith('SELECT id,name,active,starter_ingredient_id'))return[[{id:ID,name:'Cultivo',active:1,starter_ingredient_id:null}]];return[{affectedRows:1}];}};
 const store=createSourdoughStore({getConnection:async()=>c});
 await assert.rejects(()=>store.feed(ID,{discardedGrams:20,flourGrams:60,waterGrams:30}),/Conecta esta masa madre/);
 assert.equal(commits,0);assert.equal(rollbacks,1);
});
test('MASA-080-04 operador puede registrar alimentación pero no consultar finanzas',async t=>{
 let feeds=0,financialReads=0;
 const auth={async userForToken(token){return token===A?{role:'admin'}:token===B?{role:'operador'}:null;}};
 const sourdough={async listStarters(){return[{id:ID,name:'Cultivo prueba',currentWeightGrams:100}]},async feed(){feeds++;return{id:randomUUID(),afterGrams:150}}};
 const finance={async dashboard(){financialReads++;return{netProfit:500}}};
 const app=createApp({auth,sourdough,finance});app.listen(0,'127.0.0.1');await once(app,'listening');t.after(()=>new Promise(ok=>app.close(ok)));
 const base=`http://127.0.0.1:${app.address().port}`;
 const request=(url,token,body)=>fetch(base+url,{method:body?'POST':'GET',headers:{Cookie:`paniko_session=${token}`,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
 assert.equal((await request('/api/sourdough/starters',B)).status,200);
 assert.equal((await request(`/api/sourdough/starters/${ID}/feed`,B,{discardedGrams:5,flourGrams:25,waterGrams:25})).status,201);
 assert.equal(feeds,1);
 assert.equal((await request('/api/finance/dashboard?days=7',B)).status,403);
 assert.equal(financialReads,0);
 assert.equal((await request('/api/sourdough/starters',null)).status,401);
});
