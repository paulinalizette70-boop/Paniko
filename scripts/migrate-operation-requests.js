'use strict';
// Migración aditiva. Nunca borra recetas, existencias ni lotes; exige respaldo.
const {dbConfig,poolFromEnv}=require('../src/database');
const ddl=`CREATE TABLE IF NOT EXISTS operation_requests (
  operation_id CHAR(36) NOT NULL PRIMARY KEY,
  operation_type VARCHAR(50) NOT NULL,
  payload_hash CHAR(64) NOT NULL,
  result_json JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX ix_operation_requests_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`;
async function migrate(pool){
  await pool.query(ddl);
  return {createdOrVerified:'operation_requests'};
}
async function main(){
  const config=dbConfig();
  if(!process.argv.includes('--apply')){
    console.log('Vista previa: verificar/crear tabla operation_requests en '+config.database);
    console.log('No se ha modificado MySQL. Tras respaldo, utiliza --apply --confirm-backup');
    return;
  }
  if(!process.argv.includes('--confirm-backup'))
    throw Error('Debes exportar y verificar un respaldo de MySQL antes de --confirm-backup');
  const pool=poolFromEnv();
  try{console.log(await migrate(pool));}finally{await pool.end();}
}
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1});
module.exports={migrate,ddl};
