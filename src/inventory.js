'use strict';
const {ValidationError, scaleRecipe, convertQuantity} = require('./domain');

const SIX = 1_000_000;
const roundQuantity = (n) => Math.round((n + Number.EPSILON) * SIX) / SIX;

function stockEntry(raw, targetUnit, defaultReason = 'Reposición de inventario') {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new ValidationError('Entrada de inventario inválida');
  const quantity = raw.quantity;
  if (typeof quantity !== 'number' || !Number.isFinite(quantity) || quantity <= 0 || quantity > 1e9 ||
    roundQuantity(quantity) <= 0 || Math.abs(roundQuantity(quantity) - quantity) > 1e-8) {
    throw new ValidationError('Cantidad de entrada: debe ser positiva, válida y tener máximo 6 decimales');
  }
  const reason = raw.reason === undefined || raw.reason === null || raw.reason === '' ? defaultReason : raw.reason;
  if (typeof reason !== 'string' || !reason.trim() || reason.trim().length > 150) {
    throw new ValidationError('Motivo: escribe entre 1 y 150 caracteres');
  }
  if (raw.unit !== undefined && !targetUnit) throw new ValidationError('No se puede convertir sin la unidad del ingrediente');
  const normalized=targetUnit ? convertQuantity(quantity,raw.unit ?? targetUnit,targetUnit) : roundQuantity(quantity);
  return {quantity: normalized, reason: reason.trim()};
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

module.exports = {stockEntry, validateProduction, roundQuantity, safeStockSum};
