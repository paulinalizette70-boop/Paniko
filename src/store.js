'use strict';
// Adaptador JSON para pruebas unitarias, pruebas de integración locales y desarrollo sin MySQL.
// La aplicación de uso normal inicia con MySQL; ver server.js y ADR-004.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {ValidationError, validateIngredient, validateRecipe, scaleRecipe} = require('./domain');
const {stockEntry, stockExit, stockAdjustment, validateProduction, roundQuantity, safeStockSum} = require('./inventory');

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
    updateIngredientCost(id,costPerUnit){
      if(typeof costPerUnit!=='number'||!Number.isFinite(costPerUnit)||costPerUnit<0||costPerUnit>1e9||
         Math.abs(costPerUnit-Math.round(costPerUnit*1e4)/1e4)>1e-10)
        throw new ValidationError('Costo inválido: máximo cuatro decimales');
      const data=read(),item=data.ingredients.find(x=>x.id===id);
      if(!item)throw new ValidationError('Ingrediente no encontrado',404);
      item.costPerUnit=costPerUnit;write(data);return {id,costPerUnit};
    },
    listMovements: () => read().movements.slice().reverse(),
    listProduction: () => read().batches.slice().reverse(),
    getProductionBatch(id) {
      const data=read(),batch=data.batches.find(b=>b.id===id);
      if(!batch)throw new ValidationError('Lote de producción no encontrado',404);
      return {...batch,lines:batch.lines.map(line=>{
        const move=data.movements.find(m=>m.batchId===id&&m.ingredientId===line.ingredientId);
        return {...line,stockBefore:move?.stockBefore??null,stockAfter:move?.stockAfter??null};
      }),finishedProduct:null};
    },
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
      const data = read();
      const ingredient = data.ingredients.find(i => i.id === id);
      if (!ingredient) throw new ValidationError('Ingrediente no encontrado', 404);
      const {quantity, reason} = stockEntry(raw, ingredient.unit);
      const stockBefore = ingredient.stock;
      ingredient.stock = safeStockSum(stockBefore, quantity);
      const movement = {id:crypto.randomUUID(), ingredientId:id, name:ingredient.name, type:'entrada', quantity, stockBefore, stockAfter:ingredient.stock, reason, createdAt:new Date().toISOString()};
      data.movements.push(movement);
      write(data);
      return {ingredient, movement};
    },
    stockOut(id,raw){
      const data=read(),ingredient=data.ingredients.find(i=>i.id===id);
      if(!ingredient)throw new ValidationError('Ingrediente no encontrado',404);
      const {quantity,reason}=stockExit(raw,ingredient.unit),before=ingredient.stock;
      if(quantity>before)throw new ValidationError('Inventario insuficiente para esta salida',409);
      ingredient.stock=roundQuantity(before-quantity);
      const movement={id:crypto.randomUUID(),ingredientId:id,name:ingredient.name,type:'salida',
        quantity,stockBefore:before,stockAfter:ingredient.stock,reason,createdAt:new Date().toISOString()};
      data.movements.push(movement);write(data);return{ingredient,movement};
    },
    adjustStock(id,raw){
      const data=read(),ingredient=data.ingredients.find(i=>i.id===id);
      if(!ingredient)throw new ValidationError('Ingrediente no encontrado',404);
      const {newStock,reason}=stockAdjustment(raw),before=ingredient.stock;
      if(newStock===before)throw new ValidationError('La existencia no cambió',400);
      const movement={id:crypto.randomUUID(),ingredientId:id,name:ingredient.name,
        type:newStock>before?'entrada':'salida',quantity:roundQuantity(Math.abs(newStock-before)),
        stockBefore:before,stockAfter:newStock,reason,createdAt:new Date().toISOString()};
      ingredient.stock=newStock;data.movements.push(movement);write(data);return{ingredient,movement};
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
