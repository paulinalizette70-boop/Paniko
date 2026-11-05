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
    const sql=fs.readFileSync(path.join(__dirname,'..','sql','schema.sql'),'utf8').replace(/^--.*$/gm,'');
    for(const statement of sql.split(';').map(s=>s.trim()).filter(Boolean)) await connection.query(statement);
    console.log(`Esquema MySQL listo: ${database}`);
  }finally{await connection.end();}
}
main().catch(e=>{console.error('Error al crear esquema:',e.message);process.exitCode=1;});
