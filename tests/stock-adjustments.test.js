'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {once}=require('node:events');
const {createStore}=require('../src/store');
const {createApp}=require('../src/app');

test('CP-25 salida manual: descuenta y registra movimiento sin producción',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'paniko-out-'));
  try {
    const store=createStore(path.join(dir,'data.json'));
    const ing=store.addIngredient({name:'Harina ficticia',unit:'kg',stock:2,costPerUnit:22});
    const result=store.stockOut(ing.id,{quantity:250,unit:'g',reason:'Consumo manual'});
    assert.equal(result.ingredient.stock,1.75);
    assert.equal(result.movement.type,'salida');
    assert.equal(result.movement.quantity,0.25);
    assert.equal(store.listMovements().length,2);
    assert.equal(store.listProduction().length,0);
    assert.throws(()=>store.stockOut(ing.id,{quantity:2,unit:'kg'}),e=>e.status===409);
    assert.throws(()=>store.stockOut(ing.id,{quantity:1,unit:'l'}),/incompatibles/);
    assert.equal(store.listIngredients()[0].stock,1.75);
    assert.equal(store.listMovements().length,2);
  } finally {fs.rmSync(dir,{recursive:true,force:true});}
});

test('CP-26 ajuste físico: admite cero, crea movimiento y rechaza no-cambios',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'paniko-adjust-'));
  try {
    const store=createStore(path.join(dir,'data.json'));
    const ing=store.addIngredient({name:'Azúcar ficticia',unit:'kg',stock:1,costPerUnit:24});
    const up=store.adjustStock(ing.id,{newStock:1.5,reason:'Conteo de almacén'});
    assert.equal(up.movement.type,'entrada');
    assert.equal(up.movement.quantity,0.5);
    assert.match(up.movement.reason,/^Ajuste:/);
    const down=store.adjustStock(ing.id,{newStock:0,reason:'Corrección por conteo'});
    assert.equal(down.ingredient.stock,0);
    assert.equal(down.movement.type,'salida');
    assert.equal(down.movement.quantity,1.5);
    assert.throws(()=>store.adjustStock(ing.id,{newStock:0,reason:'No cambió'}),e=>e.status===400);
    assert.throws(()=>store.adjustStock(ing.id,{newStock:-1,reason:'No válido'}),/Existencia real/);
    assert.throws(()=>store.adjustStock(ing.id,{newStock:1,reason:' '}),/Motivo del ajuste/);
    assert.equal(store.listMovements().length,3);
  } finally {fs.rmSync(dir,{recursive:true,force:true});}
});

test('CP-27 API HTTP registra salida y ajuste y responde 409 al exceder stock',async t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'paniko-http-adjust-'));
  const app=createApp({dataFile:path.join(dir,'data.json')});
  app.listen(0,'127.0.0.1');await once(app,'listening');
  t.after(()=>{app.close();fs.rmSync(dir,{recursive:true,force:true});});
  const base='http://127.0.0.1:'+app.address().port;
  const post=async(route,data)=>{
    const r=await fetch(base+route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
    return {status:r.status,body:await r.json()};
  };
  const ing=await post('/api/ingredients',{name:'Sal prueba',unit:'kg',stock:1,costPerUnit:10});
  assert.equal(ing.status,201);
  const id=ing.body.id;
  const exit=await post('/api/ingredients/'+id+'/stock-out',{quantity:500,unit:'g',reason:'Consumo'});
  assert.equal(exit.status,200);assert.equal(exit.body.ingredient.stock,0.5);
  const excessive=await post('/api/ingredients/'+id+'/stock-out',{quantity:1,unit:'kg'});
  assert.equal(excessive.status,409);
  const adjust=await post('/api/ingredients/'+id+'/adjust-stock',{newStock:0.4,reason:'Conteo físico'});
  assert.equal(adjust.status,200);assert.equal(adjust.body.movement.type,'salida');
  const current=await(await fetch(base+'/api/ingredients')).json();
  assert.equal(current[0].stock,0.4);
  const movements=await(await fetch(base+'/api/inventory/movements')).json();
  assert.equal(movements.length,3);
  assert.match(movements[0].reason,/^Ajuste:/);
});
