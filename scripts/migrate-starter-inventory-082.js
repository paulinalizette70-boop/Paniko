'use strict';
// Solo cambios de esquema aditivos: preserva cada masa madre, alimentación e inventario existentes.
const {dbConfig}=require('../src/database');
async function migrate(pool){
  const columns=[
    ['sourdough_starters','starter_ingredient_id','CHAR(36) NULL'],
    ['sourdough_starters','flour_ingredient_id','CHAR(36) NULL'],
    ['sourdough_starters','water_ingredient_id','CHAR(36) NULL'],
    ['sourdough_feedings','inventory_synced','TINYINT(1) NOT NULL DEFAULT 0']
  ];
  for(const [table,column,definition] of columns){
    const [found]=await pool.execute(`SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND COLUMN_NAME=?`,[table,column]);
    if(!found.length)await pool.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
  }
  const indexes=[['uq_ss_starter_ingredient','UNIQUE KEY uq_ss_starter_ingredient (starter_ingredient_id)']];
  for(const [name,definition] of indexes){
    const [found]=await pool.execute('SELECT INDEX_NAME FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND INDEX_NAME=? LIMIT 1',['sourdough_starters',name]);
    if(!found.length)await pool.query(`ALTER TABLE sourdough_starters ADD ${definition}`);
  }
  for(const [name,column] of [['fk_ss_starter_ingredient','starter_ingredient_id'],['fk_ss_flour_ingredient','flour_ingredient_id'],['fk_ss_water_ingredient','water_ingredient_id']]){
    const [found]=await pool.execute('SELECT CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME=? AND CONSTRAINT_NAME=? LIMIT 1',['sourdough_starters',name]);
    if(!found.length)await pool.query(`ALTER TABLE sourdough_starters ADD CONSTRAINT ${name} FOREIGN KEY (${column}) REFERENCES ingredients(id)`);
  }
  return {columns:columns.map(([t,c])=>`${t}.${c}`),linkedInventoryEnabled:true};
}
async function main(){
  if(!process.argv.includes('--apply')){
    console.log('Vista previa: agregar 3 vínculos de ingredientes a cada masa madre y un indicador de movimientos en alimentación. Haz primero respaldo MySQL.');return;
  }
  const mysql=require('mysql2/promise'),pool=mysql.createPool({...dbConfig(),connectionLimit:2});
  try{const result=await migrate(pool);console.log('Vinculación de masa madre con Inventario lista: '+result.columns.join(', '));}
  finally{await pool.end();}
}
if(require.main===module)main().catch(e=>{console.error('Error en migración de masa madre:',e.message);process.exitCode=1;});
module.exports={migrate};
