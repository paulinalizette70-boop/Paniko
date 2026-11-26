'use strict';
// Idempotente, aditiva y sin reescribir movimientos ni recetas previas.
const {dbConfig}=require('../src/database');
const SQL=[
`CREATE TABLE IF NOT EXISTS sale_financial_snapshots (
 movement_id CHAR(36) NOT NULL PRIMARY KEY,
 product_id CHAR(36) NOT NULL,
 product_name VARCHAR(150) NOT NULL,
 quantity INT NOT NULL,
 unit_price DECIMAL(14,2) NULL,
 unit_cost DECIMAL(14,2) NULL,
 sale_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 INDEX ix_sfs_date (sale_at),
 CONSTRAINT fk_sfs_movement FOREIGN KEY(movement_id) REFERENCES finished_product_movements(id),
 CONSTRAINT fk_sfs_product FOREIGN KEY(product_id) REFERENCES finished_products(id),
 CONSTRAINT ck_sfs_quantity CHECK (quantity>0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
`CREATE TABLE IF NOT EXISTS financial_expenses (
 id CHAR(36) NOT NULL PRIMARY KEY,
 category VARCHAR(40) NOT NULL,
 description VARCHAR(150) NOT NULL,
 amount DECIMAL(14,2) NOT NULL,
 expense_date DATE NOT NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 INDEX ix_fe_date (expense_date),
 CONSTRAINT ck_fe_amount CHECK (amount>0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
`CREATE TABLE IF NOT EXISTS sourdough_starters (
 id CHAR(36) NOT NULL PRIMARY KEY,
 name VARCHAR(100) NOT NULL UNIQUE,
 location ENUM('ambiente','refrigerador') NOT NULL DEFAULT 'ambiente',
 feed_every_hours SMALLINT UNSIGNED NOT NULL,
 current_weight_g DECIMAL(12,2) NULL,
 last_fed_at TIMESTAMP NULL,
 notes VARCHAR(500) NOT NULL DEFAULT '',
 active TINYINT(1) NOT NULL DEFAULT 1,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT ck_ss_weight CHECK (current_weight_g IS NULL OR current_weight_g>=0),
 CONSTRAINT ck_ss_interval CHECK (feed_every_hours BETWEEN 1 AND 336)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
`CREATE TABLE IF NOT EXISTS sourdough_feedings (
 id CHAR(36) NOT NULL PRIMARY KEY,
 starter_id CHAR(36) NOT NULL,
 before_g DECIMAL(12,2) NOT NULL,
 discarded_g DECIMAL(12,2) NOT NULL,
 flour_g DECIMAL(12,2) NOT NULL,
 water_g DECIMAL(12,2) NOT NULL,
 after_g DECIMAL(12,2) NOT NULL,
 notes VARCHAR(500) NOT NULL DEFAULT '',
 fed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 INDEX ix_sf_starter_date (starter_id,fed_at),
 CONSTRAINT fk_sf_starter FOREIGN KEY(starter_id) REFERENCES sourdough_starters(id),
 CONSTRAINT ck_sf_values CHECK (before_g>=0 AND discarded_g>=0 AND flour_g>0 AND water_g>0 AND after_g>=0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
];
async function migrate(pool){
  for(const statement of SQL)await pool.query(statement);
  return {tables:['sale_financial_snapshots','financial_expenses','sourdough_starters','sourdough_feedings']};
}
async function main(){
  if(!process.argv.includes('--apply')){console.log('Vista previa: crear 4 tablas nuevas si faltan. No se modifican datos existentes. Exporta primero un respaldo de MySQL.');return;}
  const mysql=require('mysql2/promise'); const pool=mysql.createPool({...dbConfig(),connectionLimit:2});
  try{const result=await migrate(pool);console.log('Estructura comprobada: '+result.tables.join(', '));}
  finally{await pool.end();}
}
if(require.main===module)main().catch(e=>{console.error('No se completó la migración:',e.message);process.exitCode=1;});
module.exports={migrate,SQL};
