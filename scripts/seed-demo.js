'use strict';
const path = require('node:path');
const {createStore} = require('../src/store');
const store = createStore(process.env.DATA_FILE || path.join(__dirname, '..', 'data', 'paniko.json'));
if (store.listIngredients().length || store.listRecipes().length) {
  console.log('No se añadieron datos: la base local ya tiene registros.');
  process.exit(0);
}
const flour = store.addIngredient({name: 'Harina de trigo', unit: 'kg', costPerUnit: 25, stock: 5});
const sugar = store.addIngredient({name: 'Azúcar', unit: 'kg', costPerUnit: 30, stock: 2});
store.addRecipe({name: 'Conchas de demostración', baseYield: 10,
  items: [{ingredientId: flour.id, quantity: 1}, {ingredientId: sugar.id, quantity: 0.25}]});
console.log('Demo creada: 2 ingredientes y una receta para 10 conchas.');
