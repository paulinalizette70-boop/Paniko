'use strict';
const {createApp}=require('./src/app');
const {poolFromEnv}=require('./src/database');
const {createMysqlStore}=require('./src/mysql-store');
const {makeAuth}=require('./src/auth');
const {createFinishedProductStore}=require('./src/finished-products');
const {createFinanceDashboard}=require('./src/finance-dashboard');
const {createSourdoughStore}=require('./src/sourdough');
const {createCalendarStore}=require('./src/calendar');
async function main() {
  const pool=poolFromEnv();
  try {
    await pool.query('SELECT 1');
    const app=createApp({store:createMysqlStore(pool),auth:makeAuth(pool),products:createFinishedProductStore(pool),finance:createFinanceDashboard(pool),sourdough:createSourdoughStore(pool),calendar:createCalendarStore(pool)});
    const port=Number(process.env.PORT || 3000);
    const host=process.env.HOST || '127.0.0.1';
    app.listen(port, host, () => console.log(`Paniko (MySQL) disponible en http://${host}:${port}`));
    async function close() {app.close();await pool.end();}
    process.on('SIGINT',close);
    process.on('SIGTERM',close);
  }catch(err){await pool.end();console.error('No se pudo iniciar Paniko:',err.message);process.exitCode=1;}
}
main();
