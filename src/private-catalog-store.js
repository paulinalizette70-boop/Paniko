'use strict';

const {validatePrivateCatalog, stableKey} = require('./private-catalog');

/**
 * Escribir la versión del catálogo en staging mediante una única transacción.
 * La ruta HTTP no consulta estas tablas. No crea insumos con stock ficticio.
 * La repetición de la misma importación actualiza las claves existentes sin duplicarlas.
 */
async function importPrivateCatalog(pool, data) {
  const valid = validatePrivateCatalog(data);
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    for (const receta of valid.recetas) {
      await conn.execute(`INSERT INTO private_catalog_recipes (catalog_id, title, review_status, raw_data, source_hash)
        VALUES (?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE title=VALUES(title), review_status=VALUES(review_status),
          raw_data=VALUES(raw_data), source_hash=VALUES(source_hash)`,
      [receta.id, receta.nombre, receta.estado, JSON.stringify(receta), valid.hash]);
    }
    for (const producto of valid.productos) {
      await conn.execute(`INSERT INTO private_catalog_products (product_key, title, source_recipe_id, raw_data, source_hash)
        VALUES (?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE title=VALUES(title), source_recipe_id=VALUES(source_recipe_id),
          raw_data=VALUES(raw_data), source_hash=VALUES(source_hash)`,
      [stableKey('producto', producto.producto), producto.producto, producto.receta, JSON.stringify(producto), valid.hash]);
    }
    for (const relleno of valid.rellenos) {
      await conn.execute(`INSERT INTO private_catalog_fillings (filling_key, title, filling_kind, raw_data, source_hash)
        VALUES (?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE title=VALUES(title), filling_kind=VALUES(filling_kind),
          raw_data=VALUES(raw_data), source_hash=VALUES(source_hash)`,
      [stableKey('relleno', relleno.nombre), relleno.nombre, relleno.tipo, JSON.stringify(relleno), valid.hash]);
    }
    await conn.execute(`INSERT INTO private_catalog_imports (source_hash, recipe_count, product_count, filling_count)
       VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE source_hash=VALUES(source_hash)`,
    [valid.hash, valid.summary.recetas, valid.summary.productos, valid.summary.rellenos]);
    await conn.commit();
    return valid.summary;
  } catch (error) {
    try { await conn.rollback(); } catch (_) { /* Preservar el error original */ }
    throw error;
  } finally {
    conn.release();
  }
}

module.exports = {importPrivateCatalog};
