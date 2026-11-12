'use strict';
const {ValidationError, scaleRecipe, convertQuantity} = require('./domain');

const SIX = 1_000_000;
const roundQuantity = (n) => Math.round((n + Number.EPSILON) * SIX) / SIX;

function stockEntry(raw, targetUnit) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new ValidationError('Entrada de inventario inválida');
  const quantity = raw.quantity;
  if (typeof quantity !== 'number' || !Number.isFinite(quantity) || quantity <= 0 || quantity > 1e9 ||
    roundQuantity(quantity) <= 0 || Math.abs(roundQuantity(quantity) - quantity) > 1e-8) {
    throw new ValidationError('Cantidad de entrada: debe ser positiva, válida y tener máximo 6 decimales');
  }
  const reason = raw.reason === undefined || raw.reason === null || raw.reason === '' ? 'Reposición de inventario' : raw.reason;
  if (typeof reason !== 'string' || !reason.trim() || reason.trim().length > 150) {
    throw new ValidationError('Motivo: escribe entre 1 y 150 caracteres');
  }
  if (raw.unit !== undefined && !targetUnit) throw new ValidationError('No se puede convertir sin la unidad del ingrediente');
  const normalized=targetUnit ? convertQuantity(quantity,raw.unit ?? targetUnit,targetUnit) : roundQuantity(quantity);
  return {quantity: normalized, reason: reason.trim()};
}

// Una salida manual consume inventario sin crear un lote de producción.
function stockExit(raw, targetUnit) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new ValidationError('Salida de inventario inválida');
  return stockEntry({...raw, reason: raw.reason || 'Salida manual de inventario'}, targetUnit);
}

// El ajuste establece el stock físico contado, siempre en la unidad almacenada.
function stockAdjustment(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new ValidationError('Ajuste de inventario inválido');
  const newStock=raw.newStock;
  if (typeof newStock !== 'number' || !Number.isFinite(newStock) || newStock < 0 || newStock > 1e9 ||
      Math.abs(roundQuantity(newStock)-newStock) > 1e-8)
    throw new ValidationError('Existencia real: número entre 0 y 1000000000, máximo 6 decimales');
  if (typeof raw.reason !== 'string' || !raw.reason.trim() || raw.reason.trim().length > 142)
    throw new ValidationError('Motivo del ajuste: escribe entre 1 y 142 caracteres');
  return {newStock:roundQuantity(newStock), reason:'Ajuste: '+raw.reason.trim()};
}

function validateProduction(recipe, ingredients, desiredYield) {
  const preview = scaleRecipe(recipe, ingredients, desiredYield);
  if (!preview.stockAvailable) {
    const shortages = preview.lines.filter(line => !line.sufficient).map(line => line.name);
    throw new ValidationError(`Inventario insuficiente: ${shortages.join(', ')}`, 409);
  }
  return preview;
}

function safeStockSum(before, increment) {
  const next = roundQuantity(before + increment);
  if (!Number.isFinite(next) || next > 1e9) throw new ValidationError('Existencia excede el máximo permitido');
  return next;
}

module.exports = {stockEntry, stockExit, stockAdjustment, validateProduction, roundQuantity, safeStockSum};
