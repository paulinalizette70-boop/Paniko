'use strict';
const {poolFromEnv}=require('../src/database');
const {createMysqlStore}=require('../src/mysql-store');
async function main(){
  if(process.env.ALLOW_DEMO_SEED !== 'yes') throw Error('No se cargaron datos ficticios. Para autorizarlos define ALLOW_DEMO_SEED=yes');
  const pool=poolFromEnv();
  try {
    const store=createMysqlStore(pool);
    if((await store.listIngredients()).length || (await store.listRecipes()).length){console.log('Ya hay registros; no se agregan datos ficticios.');return;}
    const flour=await store.addIngredient({name:'Harina de trigo (demo)',unit:'kg',costPerUnit:25,stock:5});
    const sugar=await store.addIngredient({name:'Azúcar (demo)',unit:'kg',costPerUnit:30,stock:2});
    await store.addRecipe({name:'Conchas de demostración (no receta real)',baseYield:10,items:[{ingredientId:flour.id,quantity:1},{ingredientId:sugar.id,quantity:0.25}]});
    console.log('Datos ficticios de prueba creados.');
  }finally{await pool.end();}
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
