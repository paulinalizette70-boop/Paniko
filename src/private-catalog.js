'use strict';

const crypto = require('node:crypto');

class CatalogValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'CatalogValidationError';
  }
}

function requiredText(value, path, max = 150) {
  if (typeof value !== 'string' || !value.trim() || value.length > max) {
    throw new CatalogValidationError(`${path}: se necesita texto de hasta ${max} caracteres`);
  }
  return value.trim();
}
function object(value, path) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new CatalogValidationError(`${path}: se necesita un objeto`);
  }
  return value;
}
function array(value, path) {
  if (!Array.isArray(value)) throw new CatalogValidationError(`${path}: se necesita una lista`);
  return value;
}
function positiveOrMissing(value, path) {
  if (value === null || value === undefined) return false;
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new CatalogValidationError(`${path}: debe ser un número positivo o null cuando no se conozca`);
  }
  return true;
}
function stableKey(prefix, name) {
  return crypto.createHash('sha256').update(`${prefix}:${name}`, 'utf8').digest('hex');
}
function sourceHash(catalog) {
  return crypto.createHash('sha256').update(JSON.stringify(catalog), 'utf8').digest('hex');
}

/**
 * Validar el catálogo privado preservando los datos aportados sin inventar rendimientos,
 * convertir cucharadas arbitrariamente o sustituir ingredientes opcionales.
 * Este modelo es SOLO de staging, no las fichas productivas visibles en la API.
 */
function validatePrivateCatalog(data) {
  const root = object(data, 'catálogo');
  const recetas = array(root.recetas, 'recetas');
  const productos = array(root.productos, 'productos');
  const rellenos = array(root.rellenos, 'rellenos');
  if (recetas.length < 1) throw new CatalogValidationError('El catálogo no contiene recetas');
  if (recetas.length > 1000 || productos.length > 3000 || rellenos.length > 3000) {
    throw new CatalogValidationError('El catálogo supera el límite de seguridad');
  }
  const warnings = [];
  const ids = new Set();
  recetas.forEach((receta, idx) => {
    const path = `recetas[${idx}]`;
    object(receta, path);
    const id = requiredText(receta.id, `${path}.id`, 100);
    if (!/^[a-z][a-z0-9_]*$/.test(id)) throw new CatalogValidationError(`${path}.id: clave inválida`);
    if (ids.has(id)) throw new CatalogValidationError(`${path}.id: clave duplicada`);
    ids.add(id);
    requiredText(receta.nombre, `${path}.nombre`, 100);
    requiredText(receta.estado, `${path}.estado`, 40);
    const rendimiento = object(receta.rendimiento, `${path}.rendimiento`);
    requiredText(rendimiento.unidad, `${path}.rendimiento.unidad`, 60);
    if (!positiveOrMissing(rendimiento.cantidad, `${path}.rendimiento.cantidad`)) {
      warnings.push(`${path}: rendimiento por confirmar`);
    }
    const ingredientes = array(receta.ingredientes, `${path}.ingredientes`);
    if (!ingredientes.length || ingredientes.length > 200) throw new CatalogValidationError(`${path}: número de ingredientes inválido`);
    ingredientes.forEach((item, j) => {
      const p = `${path}.ingredientes[${j}]`;
      object(item, p);
      requiredText(item.ingrediente, `${p}.ingrediente`, 120);
      const unidad = requiredText(item.unidad, `${p}.unidad`, 40);
      if (!positiveOrMissing(item.cantidad, `${p}.cantidad`)) {
        const min = item.minimo, max = item.maximo;
        if (min !== undefined || max !== undefined) {
          if (!positiveOrMissing(min, `${p}.minimo`) || !positiveOrMissing(max, `${p}.maximo`) || min > max) {
            throw new CatalogValidationError(`${p}: rango inválido`);
          }
        }
        warnings.push(`${p}: cantidad exacta por confirmar`);
      }
      if (!['g', 'kg', 'ml', 'l', 'pieza'].includes(unidad)) warnings.push(`${p}: conversión de unidad pendiente`);
    });
    array(receta.componentes || [], `${path}.componentes`);
    array(receta.variantes || [], `${path}.variantes`);
    if (receta.estado !== 'confirmada') warnings.push(`${path}: fórmula provisional no validada`);
  });
  recetas.forEach((r, idx) => (r.componentes || []).forEach((c, ci) => {
    object(c, `recetas[${idx}].componentes[${ci}]`);
    if (!ids.has(c.id)) throw new CatalogValidationError(`recetas[${idx}].componentes[${ci}]: subreceta no encontrada`);
  }));
  const productNames = new Set();
  productos.forEach((p, i) => {
    object(p, `productos[${i}]`);
    const name = requiredText(p.producto, `productos[${i}].producto`, 150);
    if (productNames.has(name)) throw new CatalogValidationError(`productos[${i}]: producto duplicado`);
    productNames.add(name);
    if (!ids.has(p.receta)) throw new CatalogValidationError(`productos[${i}]: receta de origen no encontrada`);
    if (p.preparacion_adicional && !ids.has(p.preparacion_adicional)) throw new CatalogValidationError(`productos[${i}]: preparación adicional no encontrada`);
    if (p.variante) {
      const r = recetas.find(r => r.id === p.receta);
      if (!(r.variantes || []).some(v => v.nombre === p.variante)) throw new CatalogValidationError(`productos[${i}]: variante no encontrada`);
    }
  });
  const fillingNames = new Set();
  rellenos.forEach((f, i) => {
    object(f, `rellenos[${i}]`);
    const name = requiredText(f.nombre, `rellenos[${i}].nombre`, 150);
    if (fillingNames.has(name)) throw new CatalogValidationError(`rellenos[${i}]: relleno duplicado`);
    fillingNames.add(name);
    if (f.tipo !== 'comercial' && f.tipo !== 'elaborado') throw new CatalogValidationError(`rellenos[${i}]: tipo inválido`);
    if (f.tipo === 'elaborado' && !ids.has(f.receta)) throw new CatalogValidationError(`rellenos[${i}]: preparación no encontrada`);
  });
  return {
    recetas, productos, rellenos, hash: sourceHash(data), warnings,
    summary: {recetas: recetas.length, productos: productos.length, rellenos: rellenos.length, avisos: warnings.length,
      propuestas: recetas.filter(r => r.estado !== 'confirmada').length}
  };
}

module.exports = {validatePrivateCatalog, CatalogValidationError, stableKey};
