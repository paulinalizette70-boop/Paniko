'use strict';
const fs=require('node:fs');
const path=require('node:path');
const mysql=require('mysql2/promise');
const {dbConfig}=require('../src/database');
async function main(){
  const {database,...config}=dbConfig();
  const connection=await mysql.createConnection(config);
  try {
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`);
    await connection.query(`USE \`${database}\``);
    for (const schema of ['schema.sql', 'private-catalog.sql', 'auth.sql', 'finished-products.sql']) {
      const sql=fs.readFileSync(path.join(__dirname,'..','sql',schema),'utf8').replace(/^--.*$/gm,'');
      for(const statement of sql.split(';').map(s=>s.trim()).filter(Boolean)) await connection.query(statement);
    }
    const {migrate}=require('./migrate-finance-and-starter');
    await migrate(connection);
    await require('./migrate-calendar-yields-081').migrate(connection);
    console.log(`Esquema MySQL listo: ${database}`);
  }finally{await connection.end();}
}
main().catch(e=>{console.error('Error al crear esquema:',e.message);process.exitCode=1;});
