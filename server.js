'use strict';
const {createApp}=require('./src/app');
const {poolFromEnv}=require('./src/database');
const {createMysqlStore}=require('./src/mysql-store');
async function main() {
  const pool=poolFromEnv();
  try {
    await pool.query('SELECT 1');
    const app=createApp({store:createMysqlStore(pool)});
    const port=Number(process.env.PORT || 3000);
    app.listen(port, () => console.log(`Paniko (MySQL) disponible en http://localhost:${port}`));
    async function close() {app.close();await pool.end();}
    process.on('SIGINT',close);
    process.on('SIGTERM',close);
  }catch(err){await pool.end();console.error('No se pudo iniciar Paniko:',err.message);process.exitCode=1;}
}
main();
