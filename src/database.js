'use strict';
function dbConfig(env=process.env) {
  const name=env.DB_NAME || 'paniko';
  if (!/^[A-Za-z0-9_]+$/.test(name)) throw new Error('DB_NAME solo puede contener letras, números y guion bajo');
  if (!env.DB_USER) throw new Error('Falta DB_USER');
  if (env.DB_PASSWORD === undefined) throw new Error('Falta DB_PASSWORD; asigna una contraseña para la conexión a MySQL');
  return {host:env.DB_HOST||'127.0.0.1',port:Number(env.DB_PORT||3306),user:env.DB_USER,password:env.DB_PASSWORD,database:name,decimalNumbers:false,waitForConnections:true,connectionLimit:10};
}
function poolFromEnv() {
  // Carga tardía: las pruebas del adaptador JSON no requieren mysql2 ni conexión MySQL.
  const mysql=require('mysql2/promise');
  return mysql.createPool(dbConfig());
}
module.exports={dbConfig,poolFromEnv};
