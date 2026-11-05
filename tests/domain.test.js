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
