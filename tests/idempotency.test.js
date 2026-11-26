'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const {withRequest}=require('../src/idempotency');
function fakeDb(){
 const entries=new Map();
 return {entries,async execute(sql,args){
  if(sql.startsWith('INSERT INTO operation_requests')){
   if(entries.has(args[0])){const e=new Error('Duplicate');e.code='ER_DUP_ENTRY';throw e;}
   entries.set(args[0],{operation_type:args[1],payload_hash:args[2],result_json:null});return[{}];
  }
  if(sql.startsWith('SELECT operation_type'))return [[entries.get(args[0])].filter(Boolean)];
  if(sql.startsWith('UPDATE operation_requests')){entries.get(args[1]).result_json=args[0];return [{}];}
  throw Error('Unexpected query: '+sql);
 }};
}
test('IDEMP-01 repetir confirmación devuelve el primer lote y no repite el consumo',async()=>{
 const db=fakeDb(),operationId=randomUUID();let stock=10,calls=0;
 const confirm=()=>withRequest(db,operationId,'production',{recipeId:'demo',desiredYield:10},async()=>{
  stock--;calls++;return{id:'lote-1',stock};
 });
 assert.deepEqual(await confirm(),{id:'lote-1',stock:9});
 assert.deepEqual(await confirm(),{id:'lote-1',stock:9});
 assert.equal(stock,9);assert.equal(calls,1);
});
test('IDEMP-02 no reutiliza ID para otra cantidad ni para otro tipo de operación',async()=>{
 const db=fakeDb(),operationId=randomUUID();
 await withRequest(db,operationId,'sale',{productId:'x',quantity:1},async()=>({id:'sale-1'}));
 await assert.rejects(()=>withRequest(db,operationId,'sale',{productId:'x',quantity:2},async()=>({})),e=>e.status===409);
 await assert.rejects(()=>withRequest(db,operationId,'production',{productId:'x',quantity:1},async()=>({})),e=>e.status===409);
});
test('IDEMP-03 rechaza token inválido y mantiene compatibilidad de solicitudes antiguas',async()=>{
 const db=fakeDb();let count=0;
 await assert.rejects(()=>withRequest(db,'no-es-uuid','production',{},async()=>null),/inválido/);
 await withRequest(db,null,'production',{},async()=>++count);
 await withRequest(db,null,'production',{},async()=>++count);
 assert.equal(count,2);
});
