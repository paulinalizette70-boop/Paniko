'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {validateIngredient, validateRecipe, scaleRecipe} = require('../src/domain');
const ingredients = [
  {id: 'harina', name:'Harina de trigo', unit:'kg', costPerUnit:25, stock:5},
  {id: 'azucar', name:'Azúcar', unit:'kg', costPerUnit:30, stock:0.3},
];
const recipe = {id:'r1', name:'Conchas', baseYield:10, items:[
  {ingredientId:'harina',quantity:1},{ingredientId:'azucar',quantity:0.25},
]};
test('CP-01 valida ingrediente correcto', ()=> {
  assert.deepEqual(validateIngredient({name:'Harina',unit:'kg',costPerUnit:25,stock:3}),
    {name:'Harina',unit:'kg',costPerUnit:25,stock:3});
});
test('CP-02 rechaza ingrediente sin nombre', ()=> {
  assert.throws(()=>validateIngredient({name:'',unit:'kg',costPerUnit:25,stock:3}),/Nombre/);
});
test('CP-03 rechaza costos negativos', ()=> {
  assert.throws(()=>validateIngredient({name:'Azúcar',unit:'kg',costPerUnit:-2,stock:3}),/Costo/);
});
test('CP-04 valida ficha con ingredientes existentes', ()=> {
  assert.equal(validateRecipe(recipe,ingredients).items.length,2);
});
test('CP-06 duplica cantidades y costo para 20 piezas', ()=> {
  const result=scaleRecipe(recipe,ingredients,20);
  assert.equal(result.lines[0].required,2);
  assert.equal(result.lines[1].required,0.5);
  assert.equal(result.estimatedTotalCost,65);
  assert.equal(result.stockAvailable,false);
});
test('CP-07 rechaza producción cero', ()=>{
  assert.throws(()=>scaleRecipe(recipe,ingredients,0),/Producción solicitada/);
});
test('detecta inventario suficiente y no modifica existencias', ()=>{
  const result=scaleRecipe(recipe,ingredients,10);
  assert.equal(result.stockAvailable,true);
  assert.equal(ingredients[0].stock,5);
});
test('rechaza ingrediente inexistente en una ficha', ()=>{
  assert.throws(()=>validateRecipe({name:'Conchas',baseYield:10,items:[{ingredientId:'fantasma',quantity:1}]},ingredients),/no existe/);
});

test('CP-22 normaliza g/kg, ml/l y evita conversiones incompatibles',()=>{
  const set=[...ingredients,{id:'agua',name:'Agua',unit:'ml',stock:2000,costPerUnit:0.02}];
  const r=validateRecipe({name:'Fórmula de ejemplo',baseYield:10,items:[
    {ingredientId:'harina',quantity:500,unit:'g'},
    {ingredientId:'agua',quantity:1.5,unit:'l'}
  ]},set);
  assert.equal(r.items[0].quantity,0.5);
  assert.equal(r.items[1].quantity,1500);
  assert.throws(()=>validateRecipe({name:'Error',baseYield:1,items:[
    {ingredientId:'harina',quantity:3,unit:'ml'}]},set),/incompatibles/);
  assert.throws(()=>validateRecipe({name:'Error de precisión',baseYield:1,items:[
    {ingredientId:'harina',quantity:0.0005,unit:'g'}]},set),/precisión/);
});
