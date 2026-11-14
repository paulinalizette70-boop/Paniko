'use strict';
// Migración 0.8.4: registra productos derivados de una masa base SIN tocar las
// recetas anteriores, los precios, los stocks ni los movimientos históricos.
const {dbConfig}=require('../src/database');

const CREATE_EXTRAS="CREATE TABLE IF NOT EXISTS dough_product_extras ("+
  "product_id CHAR(36) NOT NULL, ingredient_id CHAR(36) NOT NULL,"+
  "quantity_per_piece DECIMAL(16,6) NOT NULL,"+
  "PRIMARY KEY (product_id,ingredient_id),"+
  "CONSTRAINT fk_dpe_product FOREIGN KEY(product_id) REFERENCES finished_products(id) ON DELETE CASCADE,"+
  "CONSTRAINT fk_dpe_ingredient FOREIGN KEY(ingredient_id) REFERENCES ingredients(id),"+
  "CONSTRAINT ck_dpe_quantity CHECK (quantity_per_piece>0)"+
  ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4";
const CREATE_OUTPUTS="CREATE TABLE IF NOT EXISTS dough_batch_outputs ("+
  "batch_id CHAR(36) NOT NULL, product_id CHAR(36) NOT NULL,"+
  "product_name VARCHAR(150) NOT NULL, quantity INT NOT NULL,"+
  "grams_per_piece INT NOT NULL,total_grams INT NOT NULL,"+
  "PRIMARY KEY(batch_id,product_id),"+
  "CONSTRAINT fk_dbo_batch FOREIGN KEY(batch_id) REFERENCES production_batches(id),"+
  "CONSTRAINT fk_dbo_product FOREIGN KEY(product_id) REFERENCES finished_products(id),"+
  "CONSTRAINT ck_dbo_qty CHECK (quantity>0 AND grams_per_piece>0 AND total_grams>0)"+
  ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4";

async function hasColumn(db,table,col){
  const [rows]=await db.execute('SELECT COUNT(*) AS n FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND COLUMN_NAME=?',[table,col]);
  return Number(rows[0].n)>0;
}
async function hasIndex(db,table,index){
  const [rows]=await db.execute('SELECT COUNT(*) AS n FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND INDEX_NAME=?',[table,index]);
  return Number(rows[0].n)>0;
}
async function migrate(db){
  // Primero los campos y tablas nuevos. Ninguna columna existente se elimina.
  if(!(await hasColumn(db,'finished_products','dough_grams_per_piece')))
    await db.query("ALTER TABLE finished_products ADD COLUMN dough_grams_per_piece INT NULL");
  await db.query(CREATE_EXTRAS);
  await db.query(CREATE_OUTPUTS);
  // Antes existía una restricción UNIQUE(batch_id), que no permitía repartir
  // una tanda en conchas + franceses. La sustituimos por UNIQUE(batch_id,product_id).
  if(await hasIndex(db,'finished_product_movements','uq_fpm_batch')){
    await db.query('ALTER TABLE finished_product_movements DROP INDEX uq_fpm_batch');
  }
  if(!(await hasIndex(db,'finished_product_movements','uq_fpm_batch_product')))
    await db.query('ALTER TABLE finished_product_movements ADD UNIQUE KEY uq_fpm_batch_product (batch_id,product_id)');
  return {column:'finished_products.dough_grams_per_piece',tables:['dough_product_extras','dough_batch_outputs'],index:'uq_fpm_batch_product'};
}
async function main(){
  if(!process.argv.includes('--apply')){
    console.log('Vista previa: se agrega el gramaje a productos, extras y reparto de tandas. No se cambian existencias. Haz un respaldo MySQL antes de aplicar --apply.');
    return;
  }
  const mysql=require('mysql2/promise');
  const db=mysql.createPool({...dbConfig(),connectionLimit:2});
  try{const changes=await migrate(db);console.log('Migración Paniko 0.8.4 lista:',changes);}
  finally{await db.end();}
}
if(require.main===module)main().catch(e=>{console.error('No se pudo preparar el esquema 0.8.4:',e.message);process.exitCode=1;});
module.exports={migrate,hasColumn,hasIndex,CREATE_EXTRAS,CREATE_OUTPUTS};
