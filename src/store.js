'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {ValidationError, validateIngredient, validateRecipe, scaleRecipe} = require('./domain');

function createStore(filePath) {
  function read() {
    if (!fs.existsSync(filePath)) return {ingredients: [], recipes: []};
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
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
    getRecipe: (id) => read().recipes.find((r) => r.id === id),
    addIngredient(raw) {
      const ingredient = validateIngredient(raw);
      const data = read();
      if (data.ingredients.some((i) => i.name.toLowerCase() === ingredient.name.toLowerCase() && i.unit === ingredient.unit)) {
        throw new ValidationError('Este ingrediente ya existe con la misma unidad', 409);
      }
      const saved = {id: crypto.randomUUID(), ...ingredient};
      data.ingredients.push(saved);
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
  };
}
module.exports = {createStore};
