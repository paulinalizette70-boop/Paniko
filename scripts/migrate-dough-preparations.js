'use strict';
// Migracion aditiva: vincula fichas de preparaciones con existencias en inventario.
// NO elimina inventario, NO reejecuta recetas previas y NO importa datos privados.
const {dbConfig,poolFromEnv}=require('../src/database');
async function migrate(pool){
  await pool.query('CREATE TABLE IF NOT EXISTS dough_prepared_recipes ('+
    'recipe_id CHAR(36) NOT NULL PRIMARY KEY,'+
    'ingredient_id CHAR(36) NOT NULL UNIQUE,'+
    'created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,'+
    'CONSTRAINT fk_dpr_recipe FOREIGN KEY (recipe_id) REFERENCES recipes(id),'+
    'CONSTRAINT fk_dpr_ingredient FOREIGN KEY (ingredient_id) REFERENCES ingredients(id)'+
    ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');
  return {createdOrVerified:'dough_prepared_recipes'};
}
async function main(){
  const c=dbConfig();
  if(!process.argv.includes('--apply')){
    console.log('Vista previa: crear solo la tabla dough_prepared_recipes (si falta) en '+c.database);
    console.log('Para aplicar, exporta un respaldo completo de MySQL y ejecuta --apply --confirm-backup');
    return;
  }
  if(!process.argv.includes('--confirm-backup'))throw Error('Falta --confirm-backup: exporta antes un respaldo de MySQL');
  const pool=poolFromEnv();
  try{console.log(await migrate(pool));}finally{await pool.end()}
}
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1});
module.exports={migrate};
