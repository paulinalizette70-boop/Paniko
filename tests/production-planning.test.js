'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {scaleRecipe,maximumProducible}=require('../src/domain');
const {createStore}=require('../src/store');
const {createApp}=require('../src/app');
const {once}=require('node:events');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');

function sample(){
  return {
    recipe:{id:'demo',name:'Conchas ficticias',baseYield:10,items:[{ingredientId:'harina',quantity:1},{ingredientId:'azucar',quantity:0.25}]},
    ingredients:[
      {id:'harina',name:'Harina',unit:'kg',stock:2.5,costPerUnit:20},
      {id:'azucar',name:'Azúcar',unit:'kg',stock:1,costPerUnit:30}
    ]
  };
}

test('PLAN-01 muestra capacidad conservadora, ingrediente limitante y faltantes',()=>{
  const {recipe,ingredients}=sample();
  const preview=scaleRecipe(recipe,ingredients,30);
  assert.equal(preview.maxProducible,25);
  assert.deepEqual(preview.limitingIngredients,['Harina']);
  assert.equal(preview.stockAvailable,false);
  assert.equal(preview.lines[0].required,3);
  assert.equal(preview.lines[0].shortage,0.5);
  assert.equal(preview.lines[1].shortage,0);
  assert.equal(scaleRecipe(recipe,ingredients,25).stockAvailable,true);
  assert.equal(ingredients[0].stock,2.5,'la vista previa no descuenta existencias');
});

test('PLAN-02 límite con stock cero, unidades fraccionarias y máximo de entrada',()=>{
  const {recipe,ingredients}=sample();
  ingredients[0].stock=0;
  assert.equal(maximumProducible(recipe,ingredients).maximum,0);
  assert.equal(scaleRecipe(recipe,ingredients,1).stockAvailable,false);
  ingredients[0].stock=2.5;
  recipe.items[0].quantity=0.125;
  assert.equal(maximumProducible(recipe,ingredients).maximum,40,'1 kg de azúcar por cada 40 piezas es limitante');
  ingredients[0].stock=1e9;
  ingredients[1].stock=1e9;
  assert.equal(maximumProducible(recipe,ingredients).maximum,1e9,'no propone cantidades fuera del límite de la API');
});

test('PLAN-03 API real de vista previa conserva los ingredientes; la confirmación descuenta',async t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'paniko-plan-'));
  const store=createStore(path.join(dir,'demo.json'));
  const flour=store.addIngredient({name:'Harina prueba',unit:'kg',costPerUnit:20,stock:2});
  const rec=store.addRecipe({name:'Pan prueba',baseYield:10,items:[{ingredientId:flour.id,quantity:1}]});
  const server=createApp({store});server.listen(0,'127.0.0.1');await once(server,'listening');
  t.after(()=>{server.close();fs.rmSync(dir,{recursive:true,force:true});});
  const base='http://127.0.0.1:'+server.address().port;
  const post=async(url,data)=>{
    const r=await fetch(base+url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
    return {status:r.status,data:await r.json()};
  };
  const preview=await post('/api/recipes/'+rec.id+'/scale',{desiredYield:25});
  assert.equal(preview.status,200);
  assert.equal(preview.data.maxProducible,20);
  assert.equal(preview.data.lines[0].shortage,0.5);
  assert.equal(store.listIngredients()[0].stock,2);
  const produce=await post('/api/recipes/'+rec.id+'/produce',{desiredYield:20});
  assert.equal(produce.status,201);
  assert.equal(store.listIngredients()[0].stock,0);
  const after=await post('/api/recipes/'+rec.id+'/scale',{desiredYield:1});
  assert.equal(after.data.maxProducible,0);
});
