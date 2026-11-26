'use strict';
// Adición de tablas. Cambia el índice de movimientos finalizados para permitir que
// varios productos pertenezcan a un mismo lote; no modifica registros existentes.
const fs=require('node:fs');
const path=require('node:path');
const {dbConfig}=require('../src/database');
async function migrate(pool){
  const [old]=await pool.execute(`SELECT INDEX_NAME FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='finished_product_movements' AND INDEX_NAME='uq_fpm_batch'`);
  if(old.length){
    const [newIdx]=await pool.execute(`SELECT INDEX_NAME FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='finished_product_movements' AND INDEX_NAME='ix_fpm_batch'`);
    if(!newIdx.length)await pool.query('CREATE INDEX ix_fpm_batch ON finished_product_movements(batch_id)');
    await pool.query('ALTER TABLE finished_product_movements DROP INDEX uq_fpm_batch');
  }
  const statements=fs.readFileSync(path.join(__dirname,'../sql/dough-formats.sql'),'utf8')
    .replace(/^--.*$/gm,'').split(';').map(x=>x.trim()).filter(Boolean);
  for(const sql of statements)await pool.query(sql);
  return {tables:4,requiresReversalPlan:true};
}
async function main(){
  const {poolFromEnv}=require('../src/database');
  const config=dbConfig();
  if(!process.argv.includes('--apply')){
    console.log(`Vista previa: base ${config.database}; cuatro tablas nuevas e índice de lotes multiproducto. Sin cambios.`);
    return;
  }
  if(!process.argv.includes('--confirm-backup'))throw Error('Exporta un respaldo de MySQL y añade --confirm-backup para aplicar');
  const pool=poolFromEnv();
  try{console.log(await migrate(pool));}finally{await pool.end();}
}
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1});
module.exports={migrate};
