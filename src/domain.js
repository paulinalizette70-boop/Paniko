'use strict';

const UNITS = ['g', 'kg', 'ml', 'l', 'pieza'];

class ValidationError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = 'ValidationError';
    this.status = status;
  }
}

function textField(value, label) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 100) {
    throw new ValidationError(`${label}: texto obligatorio de máximo 100 caracteres`);
  }
  return value.trim();
}

function numberField(value, label, {positive = false, integer = false} = {}) {
  if (typeof value !== 'number' || !Number.isFinite(value) ||
      (positive ? value <= 0 : value < 0) || (integer && !Number.isInteger(value)) || value > 1e9) {
    throw new ValidationError(`${label}: número ${positive ? 'mayor que cero' : 'no negativo'} válido`);
  }
  return value;
}

function validateIngredient(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new ValidationError('Ingrediente inválido');
  const name = textField(raw.name, 'Nombre');
  const unit = raw.unit;
  if (!UNITS.includes(unit)) throw new ValidationError('Unidad no permitida (g, kg, ml, l, pieza)');
  const costPerUnit = numberField(raw.costPerUnit, 'Costo por unidad');
  const stock = numberField(raw.stock, 'Existencia');
  if (Math.abs(costPerUnit - Math.round(costPerUnit * 10000) / 10000) > 1e-10) throw new ValidationError('Costo: máximo 4 decimales');
  if (Math.abs(stock - Math.round(stock * 1e6) / 1e6) > 1e-10) throw new ValidationError('Existencia: máximo 6 decimales');
  return {name, unit, costPerUnit, stock};
}

function validateRecipe(raw, ingredients) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new ValidationError('Receta inválida');
  const name = textField(raw.name, 'Nombre de receta');
  const baseYield = numberField(raw.baseYield, 'Rendimiento base', {positive: true, integer: true});
  if (!Array.isArray(raw.items) || !raw.items.length || raw.items.length > 100) {
    throw new ValidationError('Agrega al menos un ingrediente a la receta');
  }
  const seen = new Set();
  const items = raw.items.map((item) => {
    if (!item || typeof item.ingredientId !== 'string') throw new ValidationError('Ingrediente de receta inválido');
    if (seen.has(item.ingredientId)) throw new ValidationError('No repitas un ingrediente en la receta');
    seen.add(item.ingredientId);
    if (!ingredients.some((i) => i.id === item.ingredientId)) {
      throw new ValidationError('La receta contiene un ingrediente que no existe');
    }
    const quantity = numberField(item.quantity, 'Cantidad', {positive: true});
    if (Math.abs(quantity - Math.round(quantity * 1e6) / 1e6) > 1e-10 || Math.round(quantity * 1e6) === 0)
      throw new ValidationError('Cantidad: máximo 6 decimales y mayor que cero');
    return {ingredientId: item.ingredientId, quantity};
  });
  return {name, baseYield, items};
}

function money(value) { return Math.round((value + Number.EPSILON) * 100) / 100; }

function scaleRecipe(recipe, ingredients, desiredYield) {
  numberField(desiredYield, 'Producción solicitada', {positive: true, integer: true});
  const factor = desiredYield / recipe.baseYield;
  const lines = recipe.items.map(({ingredientId, quantity}) => {
    const ingredient = ingredients.find((i) => i.id === ingredientId);
    if (!ingredient) throw new ValidationError('Ingrediente de receta no encontrado', 409);
    const required = Math.round(quantity * factor * 1000000) / 1000000;
    return {
      ingredientId,
      name: ingredient.name,
      unit: ingredient.unit,
      required,
      stock: ingredient.stock,
      sufficient: ingredient.stock + 1e-9 >= required,
      estimatedCost: money(required * ingredient.costPerUnit),
    };
  });
  return {
    recipeId: recipe.id,
    recipeName: recipe.name,
    desiredYield,
    factor,
    lines,
    stockAvailable: lines.every((l) => l.sufficient),
    estimatedTotalCost: money(lines.reduce((total, l) => total + l.required *
      ingredients.find((i) => i.id === l.ingredientId).costPerUnit, 0)),
  };
}

module.exports = {ValidationError, validateIngredient, validateRecipe, scaleRecipe, UNITS};
