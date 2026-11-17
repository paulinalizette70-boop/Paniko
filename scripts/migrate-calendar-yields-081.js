'use strict';
// Migración aditiva e idempotente: mantiene recetas, lotes, existencias y ventas intactos.
const {dbConfig}=require('../src/database');
const COLUMN='yield_unit';
const CREATE_CALENDAR=`CREATE TABLE IF NOT EXISTS calendar_entries (
 id CHAR(36) NOT NULL PRIMARY KEY,
 event_date DATE NOT NULL,
 kind ENUM('pendiente','produccion') NOT NULL,
 title VARCHAR(120) NOT NULL,
 notes VARCHAR(300) NOT NULL DEFAULT '',
 status ENUM('pendiente','hecho') NOT NULL DEFAULT 'pendiente',
 recipe_id CHAR(36) NULL,
 planned_quantity INT NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 INDEX ix_calendar_date (event_date),
 CONSTRAINT fk_calendar_recipe FOREIGN KEY(recipe_id) REFERENCES recipes(id),
 CONSTRAINT ck_calendar_quantity CHECK (planned_quantity IS NULL OR planned_quantity>0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`;
async function hasColumn(db,table,col){
 const [rows]=await db.execute(`SELECT COUNT(*) AS n FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME=? AND COLUMN_NAME=?`,[table,col]);
 return Number(rows[0].n)>0;
}
async function migrate(db){
 // Si ya existe la columna, no toca su contenido. Lotes históricos asumen pieza.
 for(const table of ['recipes','production_batches']){
   if(!(await hasColumn(db,table,COLUMN)))await db.query(`ALTER TABLE ${table} ADD COLUMN yield_unit ENUM('pieza','g','ml') NOT NULL DEFAULT 'pieza'`);
 }
 await db.query(CREATE_CALENDAR);
 return {columns:['recipes.yield_unit','production_batches.yield_unit'],table:'calendar_entries'};
}
async function main(){
 if(!process.argv.includes('--apply')){console.log('Vista previa: se añaden las columnas yield_unit y la tabla calendar_entries sin borrar datos. Haz un respaldo de MySQL antes de aplicar.');return;}
 const mysql=require('mysql2/promise');const db=mysql.createPool({...dbConfig(),connectionLimit:2});
 try{await migrate(db);console.log('Migración Paniko 0.8.1 completada.');}finally{await db.end();}
}
if(require.main===module)main().catch(e=>{console.error('Migración 0.8.1 no completada:',e.message);process.exitCode=1;});
module.exports={migrate,hasColumn,CREATE_CALENDAR};
