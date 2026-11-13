'use strict';
// Migración aditiva: añade solo una columna opcional y no altera los productos.
const {dbConfig}=require('../src/database');
async function migrate(pool,dbName){
  const [rows]=await pool.execute(`SELECT COUNT(*) AS found FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA=? AND TABLE_NAME='finished_products' AND COLUMN_NAME='unit_cost'`,[dbName]);
  if(Number(rows[0].found)>0)return {changed:false,message:'La columna de costos ya existía.'};
  const [table]=await pool.execute(`SELECT COUNT(*) AS found FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA=? AND TABLE_NAME='finished_products'`,[dbName]);
  if(!Number(table[0].found))throw Error('No existe finished_products. No se modificó la base de datos.');
  // Las columnas preexistentes no se tocan. La columna nueva inicia con NULL.
  await pool.query('ALTER TABLE finished_products ADD COLUMN unit_cost DECIMAL(14,2) NULL AFTER sale_price');
  return {changed:true,message:'Columna unit_cost agregada. Los productos conservan todos sus valores anteriores.'};
}
async function main(){
  const config=dbConfig();
  if(!/^[A-Za-z0-9_]+$/.test(config.database))throw Error('Nombre de base de datos inválido');
  if(!process.argv.includes('--apply')){
    console.log(`Solo vista previa: en ${config.database}, verificar y, si falta, añadir finished_products.unit_cost DECIMAL(14,2) NULL.`);
    console.log('No se realizaron cambios. Antes de aplicarlo, haz un respaldo de MySQL.');
    console.log('Para aplicar: node --env-file=.env scripts/migrate-product-cost.js --apply');
    return;
  }
  const mysql=require('mysql2/promise');
  const pool=mysql.createPool({...config,connectionLimit:2});
  try{const result=await migrate(pool,config.database);console.log(result.message);}
  finally{await pool.end();}
}
if(require.main===module)main().catch(error=>{console.error('Migración no completada:',error.message);process.exitCode=1;});
module.exports={migrate};
