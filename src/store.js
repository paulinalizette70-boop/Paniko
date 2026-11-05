'use strict';
// Adaptador JSON para pruebas unitarias, pruebas de integración locales y desarrollo sin MySQL.
// La aplicación de uso normal inicia con MySQL; ver server.js y ADR-004.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {ValidationError, validateIngredient, validateRecipe, scaleRecipe} = require('./domain');
const {stockEntry, validateProduction, roundQuantity, safeStockSum} = require('./inventory');

function createStore(filePath) {
  function read() {
    const data = fs.existsSync(filePath) ? JSON.parse(fs.readFileSync(filePath, 'utf8')) : {};
    return {ingredients: data.ingredients || [], recipes: data.recipes || [], movements: data.movements || [], batches: data.batches || []};
  }
  function write(data) {
    fs.mkdirSync(path.dirname(filePath), {recursive: true});
    const temp = `${filePath}.${crypto.randomUUID()}.tmp`;
    fs.writeFileSync(temp, JSON.stringify(data, null, 2));
    fs.renameSync(temp, filePath);
  }
  return {
    listIngredients: () => read().ingredients,
    listRecipes: () => read().recipes,
    listMovements: () => read().movements.slice().reverse(),
    listProduction: () => read().batches.slice().reverse(),
    getRecipe: (id) => read().recipes.find((r) => r.id === id),
    addIngredient(raw) {
      const ingredient = validateIngredient(raw);
      const data = read();
      if (data.ingredients.some((i) => i.name.toLowerCase() === ingredient.name.toLowerCase() && i.unit === ingredient.unit)) {
        throw new ValidationError('Este ingrediente ya existe con la misma unidad', 409);
      }
      const saved = {id: crypto.randomUUID(), ...ingredient};
      data.ingredients.push(saved);
      if (saved.stock > 0) data.movements.push({id: crypto.randomUUID(), ingredientId: saved.id, name: saved.name, type: 'entrada', quantity: saved.stock, stockBefore: 0, stockAfter: saved.stock, reason: 'Inventario inicial', createdAt: new Date().toISOString()});
      write(data);
      return saved;
    },
    addRecipe(raw) {
      const data = read();
      const recipe = validateRecipe(raw, data.ingredients);
      const saved = {id: crypto.randomUUID(), ...recipe};
      data.recipes.push(saved);
      write(data);
      return saved;
    },
    preview(id, desiredYield) {
      const data = read();
      const recipe = data.recipes.find((r) => r.id === id);
      if (!recipe) throw new ValidationError('Receta no encontrada', 404);
      return scaleRecipe(recipe, data.ingredients, desiredYield);
    },
    stockIn(id, raw) {
      const {quantity, reason} = stockEntry(raw);
      const data = read();
      const ingredient = data.ingredients.find(i => i.id === id);
      if (!ingredient) throw new ValidationError('Ingrediente no encontrado', 404);
      const stockBefore = ingredient.stock;
      ingredient.stock = safeStockSum(stockBefore, quantity);
      const movement = {id:crypto.randomUUID(), ingredientId:id, name:ingredient.name, type:'entrada', quantity, stockBefore, stockAfter:ingredient.stock, reason, createdAt:new Date().toISOString()};
      data.movements.push(movement);
      write(data);
      return {ingredient, movement};
    },
    confirmProduction(id, desiredYield) {
      const data = read();
      const recipe = data.recipes.find(r => r.id === id);
      if (!recipe) throw new ValidationError('Receta no encontrada', 404);
      const preview = validateProduction(recipe, data.ingredients, desiredYield);
      const batch = {id:crypto.randomUUID(), recipeId:recipe.id, recipeName:recipe.name, desiredYield, estimatedTotalCost:preview.estimatedTotalCost, createdAt:new Date().toISOString(), lines:preview.lines.map(line => ({ingredientId:line.ingredientId, name:line.name, unit:line.unit, quantity:line.required, estimatedCost:line.estimatedCost}))};
      for (const line of preview.lines) {
        const ingredient = data.ingredients.find(i => i.id === line.ingredientId);
        const before = ingredient.stock;
        const after = roundQuantity(before - line.required);
        ingredient.stock = after;
        data.movements.push({id:crypto.randomUUID(), ingredientId:ingredient.id, name:ingredient.name, type:'salida', quantity:line.required, stockBefore:before, stockAfter:after, reason:`Producción ${batch.id}`, batchId:batch.id, createdAt:batch.createdAt});
      }
      data.batches.push(batch);
      write(data);
      return batch;
    },
  };
}
module.exports = {createStore};
