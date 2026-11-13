'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto'),{once}=require('node:events');
const {createApp}=require('../src/app');
test('API-083-01 conteo físico de masa madre requiere sesión y se entrega solo al módulo',async t=>{
 const id=randomUUID();let calls=0;
 const auth={async userForToken(cookie){return cookie==='A'.repeat(43)?{role:'operador'}:null}};
 const sourdough={async reconcileInventory(v,raw){calls++;assert.equal(v,id);assert.equal(raw.realWeightGrams,130);return {id,currentWeightGrams:130,inventoryUpdated:true}}};
 const server=createApp({auth,sourdough});server.listen(0,'127.0.0.1');await once(server,'listening');
 t.after(()=>new Promise(resolve=>server.close(resolve)));
 const base=`http://127.0.0.1:${server.address().port}`;
 const req={method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({realWeightGrams:130,expectedInventoryGrams:0})};
 assert.equal((await fetch(`${base}/api/sourdough/starters/${id}/reconcile-inventory`,req)).status,401);
 const response=await fetch(`${base}/api/sourdough/starters/${id}/reconcile-inventory`,{...req,headers:{...req.headers,Cookie:'paniko_session='+'A'.repeat(43)}});
 assert.equal(response.status,200);assert.equal((await response.json()).currentWeightGrams,130);assert.equal(calls,1);
});
