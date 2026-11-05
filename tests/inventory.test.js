'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {once}=require('node:events');
const {createStore}=require('../src/store');
const {createApp}=require('../src/app');
const {stockEntry}=require('../src/inventory');

test('CP-10 entrada válida incrementa existencias y crea movimiento',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'paniko-stock-'));
  try{
    const store=createStore(path.join(dir,'db.json'));
    const ing=store.addIngredient({name:'Harina',unit:'kg',costPerUnit:25,stock:1});
    const updated=store.stockIn(ing.id,{quantity:2.5,reason:'Compra para semana'});
    assert.equal(updated.ingredient.stock,3.5);
    const ledger=store.listMovements();
    assert.equal(ledger.length,2);
    assert.equal(ledger[0].type,'entrada');
    assert.equal(ledger[0].quantity,2.5);
    assert.equal(ledger[0].stockBefore,1);
    assert.equal(ledger[0].stockAfter,3.5);
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('CP-11 rechaza entradas negativas, cero o fracciones menores a resolución',()=>{
  assert.throws(()=>stockEntry({quantity:0}),/Cantidad de entrada/);
  assert.throws(()=>stockEntry({quantity:-1}),/Cantidad de entrada/);
  assert.throws(()=>stockEntry({quantity:0.0000001}),/Cantidad de entrada/);
});

test('CP-12 producción confirma y descuenta exactamente los ingredientes de una receta',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'paniko-prod-'));
  try{
    const store=createStore(path.join(dir,'db.json'));
    const flour=store.addIngredient({name:'Harina',unit:'kg',costPerUnit:25,stock:5});
    const sugar=store.addIngredient({name:'Azúcar',unit:'kg',costPerUnit:30,stock:2});
    const recipe=store.addRecipe({name:'Conchas prueba',baseYield:10,items:[{ingredientId:flour.id,quantity:1},{ingredientId:sugar.id,quantity:0.25}]});
    const batch=store.confirmProduction(recipe.id,20);
    assert.equal(batch.desiredYield,20);
    assert.equal(batch.estimatedTotalCost,65);
    const after=store.listIngredients();
    assert.equal(after.find(i=>i.id===flour.id).stock,3);
    assert.equal(after.find(i=>i.id===sugar.id).stock,1.5);
    assert.equal(store.listProduction().length,1);
    assert.equal(store.listMovements().filter(x=>x.type==='salida').length,2);
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('CP-13 producción con stock insuficiente no modifica ingredientes ni genera lotes',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'paniko-rollback-'));
  try{
    const store=createStore(path.join(dir,'db.json'));
    const ing=store.addIngredient({name:'Harina',unit:'kg',costPerUnit:25,stock:1});
    const recipe=store.addRecipe({name:'Conchas',baseYield:10,items:[{ingredientId:ing.id,quantity:1}]});
    const ledgerBefore=store.listMovements().length;
    assert.throws(()=>store.confirmProduction(recipe.id,20),/Inventario insuficiente/);
    assert.equal(store.listIngredients()[0].stock,1);
    assert.equal(store.listProduction().length,0);
    assert.equal(store.listMovements().length,ledgerBefore);
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('CP-14 API HTTP confirma entrada, producción y 409 cuando falta stock',async(t)=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'paniko-api-stock-'));
  const server=createApp({dataFile:path.join(dir,'db.json')});
  server.listen(0,'127.0.0.1');await once(server,'listening');
  t.after(()=>{server.close();fs.rmSync(dir,{recursive:true,force:true});});
  const base=`http://127.0.0.1:${server.address().port}`;
  const post=async(route,body)=>{const resp=await fetch(base+route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});return{status:resp.status,body:await resp.json()};};
  const ing=await post('/api/ingredients',{name:'Harina',unit:'kg',costPerUnit:20,stock:0});
  assert.equal(ing.status,201);
  const entry=await post(`/api/ingredients/${ing.body.id}/stock-in`,{quantity:3,reason:'Entrega proveedor'});
  assert.equal(entry.status,200);assert.equal(entry.body.ingredient.stock,3);
  const recipe=await post('/api/recipes',{name:'Pan',baseYield:10,items:[{ingredientId:ing.body.id,quantity:2}]});
  assert.equal(recipe.status,201);
  const batch=await post(`/api/recipes/${recipe.body.id}/produce`,{desiredYield:10});
  assert.equal(batch.status,201);assert.equal(batch.body.estimatedTotalCost,40);
  const fail=await post(`/api/recipes/${recipe.body.id}/produce`,{desiredYield:10});
  assert.equal(fail.status,409);
  const current=await(await fetch(base+'/api/ingredients')).json();
  assert.equal(current[0].stock,1);
  const ledger=await(await fetch(base+'/api/inventory/movements')).json();
  assert.equal(ledger.filter(x=>x.type==='salida').length,1);
});

test('CP-23 convierte entradas de gramos a kilogramos antes de consumir',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'paniko-units-'));
  try{
    const store=createStore(path.join(dir,'test.json'));
    const flour=store.addIngredient({name:'Insumo ficticio',unit:'kg',costPerUnit:20,stock:2});
    const added=store.stockIn(flour.id,{quantity:250,unit:'g',reason:'Prueba'});
    assert.equal(added.ingredient.stock,2.25);
    const recipe=store.addRecipe({name:'Lote sintético',baseYield:10,items:[{ingredientId:flour.id,quantity:500,unit:'g'}]});
    assert.equal(recipe.items[0].quantity,0.5);
    store.confirmProduction(recipe.id,20);
    assert.equal(store.listIngredients()[0].stock,1.25);
    assert.throws(()=>store.stockIn(flour.id,{quantity:5,unit:'ml',reason:'Error'}),/incompatibles/);
    assert.equal(store.listIngredients()[0].stock,1.25);
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
