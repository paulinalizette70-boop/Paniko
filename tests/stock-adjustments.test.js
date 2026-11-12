'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {once}=require('node:events');
const {createStore}=require('../src/store'),{createApp}=require('../src/app');

test('INV-01 salida manual convierte unidades, registra consumo y no permite inventario negativo',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'paniko-out-'));
  try{
    const store=createStore(path.join(dir,'data.json'));
    const ing=store.addIngredient({name:'Insumo ficticio',unit:'kg',stock:2,costPerUnit:20});
    const result=store.stockOut(ing.id,{quantity:250,unit:'g',reason:'Consumo manual'});
    assert.equal(result.ingredient.stock,1.75);assert.equal(result.movement.quantity,0.25);
    assert.equal(result.movement.type,'salida');assert.equal(store.listProduction().length,0);
    assert.throws(()=>store.stockOut(ing.id,{quantity:3,unit:'kg'}),e=>e.status===409);
    assert.throws(()=>store.stockOut(ing.id,{quantity:1,unit:'l'}),/incompatibles/);
    assert.equal(store.listIngredients()[0].stock,1.75);
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('INV-02 ajustes de entrada/salida respetan el conteo físico, cero y auditan motivo',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'paniko-adjust-'));
  try{
    const store=createStore(path.join(dir,'data.json'));
    const ing=store.addIngredient({name:'Insumo ficticio',unit:'kg',stock:1,costPerUnit:20});
    const inc=store.adjustStock(ing.id,{newStock:1.5,reason:'Conteo'});
    assert.equal(inc.movement.type,'entrada');assert.equal(inc.movement.quantity,0.5);
    const dec=store.adjustStock(ing.id,{newStock:0,reason:'Corrección'});
    assert.equal(dec.movement.type,'salida');assert.equal(dec.movement.quantity,1.5);
    assert.match(dec.movement.reason,/^Ajuste:/);
    assert.throws(()=>store.adjustStock(ing.id,{newStock:0,reason:'Sin diferencia'}),e=>e.status===400);
    assert.throws(()=>store.adjustStock(ing.id,{newStock:-1,reason:'Inválido'}),/Existencia real/);
    assert.equal(store.listMovements().length,3);
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('INV-03 API controla autenticación y rol para ajustes de insumos',async t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'paniko-access-'));
  const store=createStore(path.join(dir,'data.json'));
  const ing=store.addIngredient({name:'Insumo prueba',unit:'kg',stock:2,costPerUnit:20});
  const auth={async userForToken(token){return token==='A'.repeat(43)?{role:'admin',username:'admin'}:
    token==='B'.repeat(43)?{role:'operador',username:'operador'}:null;}};
  const server=createApp({store,auth});server.listen(0,'127.0.0.1');await once(server,'listening');
  t.after(()=>{server.close();fs.rmSync(dir,{recursive:true,force:true});});
  const url='http://127.0.0.1:'+server.address().port+'/api/ingredients/'+ing.id;
  const send=(suffix,token,body)=>fetch(url+suffix,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Cookie:'paniko_session='+token}:{})},body:JSON.stringify(body)});
  assert.equal((await send('/adjust-stock',null,{newStock:1,reason:'Nada'})).status,401);
  assert.equal((await send('/adjust-stock','B'.repeat(43),{newStock:1,reason:'No autorizado'})).status,403);
  assert.equal(store.listIngredients()[0].stock,2);
  assert.equal((await send('/stock-out','B'.repeat(43),{quantity:0.25,unit:'kg',reason:'Consumo'})).status,200);
  assert.equal((await send('/adjust-stock','A'.repeat(43),{newStock:1.5,reason:'Conteo'})).status,200);
  assert.equal(store.listIngredients()[0].stock,1.5);
});
