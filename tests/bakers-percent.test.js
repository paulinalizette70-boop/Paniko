'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {bakerPercentages,scaleRecipe,validateRecipe}=require('../src/domain');
const {createStore}=require('../src/store');
const {createApp}=require('../src/app');
const {once}=require('node:events');

function fixture(){
  const ingredients=[
    {id:'trigo',name:'Harina de trigo',unit:'kg',stock:0,costPerUnit:0},
    {id:'centeno',name:'Harina integral de centeno',unit:'g',stock:0,costPerUnit:0},
    {id:'agua',name:'Agua',unit:'l',stock:0,costPerUnit:0},
    {id:'sal',name:'Sal',unit:'g',stock:0,costPerUnit:0},
    {id:'huevo',name:'Huevo',unit:'pieza',stock:0,costPerUnit:0},
  ];
  const recipe={id:'test',name:'Pan de prueba',baseYield:10,items:[
    {ingredientId:'trigo',quantity:0.6},{ingredientId:'centeno',quantity:400},
    {ingredientId:'agua',quantity:0.65},{ingredientId:'sal',quantity:20},
    {ingredientId:'huevo',quantity:2},
  ]};
  return {ingredients,recipe};
}

test('PAN-01 harina total = 100%, separa mezcla 60/40 y agua al 65%',()=>{
  const {recipe,ingredients}=fixture();const out=bakerPercentages(recipe,ingredients);
  assert.equal(out.available,true);assert.equal(out.totalFlourGrams,1000);
  assert.deepEqual(out.lines.map(x=>x.percentage),[60,40,65,2,10]);
  assert.deepEqual(out.lines.map(x=>x.weightGrams),[600,400,650,20,100]);
});

test('PAN-02 escala piezas sin cambiar porcentajes ni tocar stock',()=>{
  const {recipe,ingredients}=fixture();
  const preview=scaleRecipe(recipe,ingredients,20);
  assert.equal(preview.bakers.totalFlourGrams,1000);
  assert.equal(preview.lines[0].required,1.2);
  assert.equal(preview.lines[2].required,1.3);
  assert.deepEqual(preview.lines.map(x=>x.bakerPercentage),[60,40,65,2,10]);
  assert.equal(preview.stockAvailable,false);
  assert.equal(ingredients[0].stock,0);
});

test('PAN-03 muestra aviso si la fórmula no tiene harina, sin inventar porcentajes',()=>{
  const ingredients=[{id:'fruta',name:'Guayaba',unit:'kg',stock:0,costPerUnit:0}];
  const recipe={items:[{ingredientId:'fruta',quantity:0.5}]};
  const out=bakerPercentages(recipe,ingredients);
  assert.equal(out.available,false);assert.equal(out.totalFlourGrams,null);
  assert.equal(out.lines[0].percentage,null);
  assert.match(out.note,/harina/i);
});

test('PAN-04 unidades sin equivalencia de peso no generan porcentajes falsos',()=>{
  const ingredients=[
    {id:'harina',name:'Harina',unit:'g',stock:0,costPerUnit:0},
    {id:'leche',name:'Leche',unit:'ml',stock:0,costPerUnit:0},
    {id:'nuez',name:'Nuez',unit:'pieza',stock:0,costPerUnit:0}];
  const out=bakerPercentages({items:[
    {ingredientId:'harina',quantity:1000},{ingredientId:'leche',quantity:200},{ingredientId:'nuez',quantity:10}
  ]},ingredients);
  assert.equal(out.available,true);assert.equal(out.lines[0].percentage,100);
  assert.equal(out.lines[1].percentage,null);assert.equal(out.lines[1].weightGrams,null);
  assert.equal(out.lines[2].percentage,null);
});

test('PAN-05 ficha de huevo 100 g con inventario en piezas conserva proporciones panaderas',()=>{
  const ingredients=[
    {id:'harina',name:'Harina de fuerza',unit:'kg',stock:0,costPerUnit:0},
    {id:'huevo',name:'Huevo',unit:'pieza',stock:0,costPerUnit:0},
  ];
  const recipe=validateRecipe({name:'Brioche inventado',baseYield:10,items:[
    {ingredientId:'harina',quantity:1,unit:'kg'},
    {ingredientId:'huevo',quantity:100,unit:'g'}
  ]},ingredients);
  assert.equal(recipe.items[1].quantity,2);
  const result=bakerPercentages(recipe,ingredients);
  assert.equal(result.lines[1].weightGrams,100);
  assert.equal(result.lines[1].percentage,10);
});

test('PAN-06 API de porcentajes exige sesión, responde sin costos y permite operador',async t=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'paniko-pan-'));
  const store=createStore(path.join(directory,'data.json'));
  const harina=store.addIngredient({name:'Harina para prueba',unit:'kg',stock:0,costPerUnit:25});
  const agua=store.addIngredient({name:'Agua',unit:'l',stock:0,costPerUnit:5});
  const recipe=store.addRecipe({name:'Ficticia de prueba',baseYield:10,items:[
    {ingredientId:harina.id,quantity:1},{ingredientId:agua.id,quantity:0.65}]});
  const auth={async userForToken(token){return token==='B'.repeat(43)?{role:'operador',username:'test'}:null;}};
  const server=createApp({store,auth});server.listen(0,'127.0.0.1');await once(server,'listening');
  t.after(async()=>{await new Promise(resolve=>server.close(resolve));fs.rmSync(directory,{recursive:true,force:true});});
  const base=`http://127.0.0.1:${server.address().port}/api/recipes/`;
  const request=(id,token)=>fetch(base+id+'/bakers',token?{headers:{Cookie:'paniko_session='+token}}:{});
  assert.equal((await request(recipe.id)).status,401);
  const resp=await request(recipe.id,'B'.repeat(43));assert.equal(resp.status,200);
  const result=await resp.json();assert.equal(result.totalFlourGrams,1000);
  assert.deepEqual(result.lines.map(x=>x.percentage),[100,65]);
  assert.ok(!JSON.stringify(result).includes('costPerUnit'));
  assert.equal(store.listIngredients()[0].stock,0);
  assert.equal((await request(crypto.randomUUID(),'B'.repeat(43))).status,404);
});

test('PAN-07 vista previa panadera de ficha nueva no inserta ni modifica existencias',async t=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'paniko-pan-preview-'));
  const store=createStore(path.join(directory,'data.json'));
  const harina=store.addIngredient({name:'Harina integral',unit:'g',stock:0,costPerUnit:30});
  const huevo=store.addIngredient({name:'Huevo',unit:'pieza',stock:0,costPerUnit:4});
  const auth={async userForToken(token){return token==='C'.repeat(43)?{role:'operador',username:'test'}:null;}};
  const server=createApp({store,auth});server.listen(0,'127.0.0.1');await once(server,'listening');
  t.after(async()=>{await new Promise(resolve=>server.close(resolve));fs.rmSync(directory,{recursive:true,force:true});});
  const endpoint=`http://127.0.0.1:${server.address().port}/api/recipes/bakers-preview`;
  const payload={name:'Receta no guardada',baseYield:8,items:[
    {ingredientId:harina.id,quantity:500,unit:'g'},
    {ingredientId:huevo.id,quantity:100,unit:'g'}]};
  const params={method:'POST',headers:{'Content-Type':'application/json',Cookie:'paniko_session='+'C'.repeat(43)},body:JSON.stringify(payload)};
  const unauthorized=await fetch(endpoint,{...params,headers:{'Content-Type':'application/json'}});
  assert.equal(unauthorized.status,401);
  const resp=await fetch(endpoint,params);assert.equal(resp.status,200);
  const data=await resp.json();
  assert.deepEqual(data.lines.map(x=>x.percentage),[100,20]);
  assert.equal(store.listRecipes().length,0);
  assert.equal(store.listIngredients().find(x=>x.id===huevo.id).stock,0);
  assert.ok(!JSON.stringify(data).includes('costPerUnit'));
});
