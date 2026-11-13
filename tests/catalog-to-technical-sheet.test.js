'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const {planCatalogRecipe,promoteCatalogRecipe}=require('../src/catalog-to-recipe');
const {createApp}=require('../src/app');
const {createStore}=require('../src/store');
const {once}=require('node:events');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');

const formula=()=>({id:'hogaza_prueba',nombre:'Hogaza sintética',estado:'confirmada',
  rendimiento:{cantidad:5,unidad:'hogazas'},ingredientes:[
    {ingrediente:'Harina de prueba',cantidad:120,unidad:'g'},
    {ingrediente:'Agua de prueba',cantidad:0.75,unidad:'l'},
    {ingrediente:'Harina de prueba',cantidad:300,unidad:'g'}],componentes:[],variantes:[]});

test('FICHA-01 usa rendimiento en piezas confirmado y NO infiere rendimiento de un peso',()=>{
  const a=planCatalogRecipe(formula());
  assert.equal(a.ready,true);assert.equal(a.baseYield,5);assert.equal(a.items.length,3);
  const bread=formula();bread.rendimiento={cantidad:2000,unidad:'g_de_masa'};
  const pending=planCatalogRecipe(bread);
  assert.equal(pending.ready,false);assert.equal(pending.needsPieceYield,true);
  assert.match(pending.issues.join(' '),/piezas/);
  const supplied=planCatalogRecipe(bread,20);
  assert.equal(supplied.ready,true);assert.equal(supplied.baseYield,20);
  assert.equal(planCatalogRecipe(formula(),10).ready,false,'no debe cambiar el rendimiento confirmado');
  const plates=formula();plates.rendimiento={cantidad:2,unidad:'placas'};
  assert.equal(planCatalogRecipe(plates).ready,false,'placas de masa no equivalen a piezas vendibles');
});

test('FICHA-02 bloquea ingredientes incompletos, conversiones arbitrarias y subrecetas',()=>{
  const pending=formula();pending.estado='propuesta_no_validada';
  assert.equal(planCatalogRecipe(pending).ready,false);
  const missing=formula();missing.ingredientes[0].cantidad=null;
  assert.equal(planCatalogRecipe(missing).ready,false);
  const unit=formula();unit.ingredientes[0].unidad='cucharada';
  assert.equal(planCatalogRecipe(unit).ready,false);
  const sub=formula();sub.componentes=[{id:'subreceta',cantidad:20,unidad:'g'}];
  assert.equal(planCatalogRecipe(sub).ready,false);
});

test('FICHA-03 genera ficha y reutiliza inventario en una sola transacción, sin descontar stock',async()=>{
  const store={ingredients:[{id:randomUUID(),name:'Harina de prueba',unit:'kg',cost_per_unit:'44.0000',stock:'9.000000'}],
    recipes:[],recipeItems:[],start:0,commit:0,rollback:0,release:0};
  const pool={async getConnection(){store.start++;return {
    async beginTransaction(){},async commit(){store.commit++;},async rollback(){store.rollback++;},release(){store.release++;},
    async execute(sql,params){
      if(sql.startsWith('SELECT id FROM recipes WHERE'))return [store.recipes.filter(r=>r.name===params[0])];
      if(sql.startsWith('SELECT id,name,unit,cost_per_unit,stock FROM ingredients'))return [store.ingredients];
      if(sql.startsWith('INSERT INTO ingredients')){store.ingredients.push({id:params[0],name:params[1],unit:params[2],cost_per_unit:params[3],stock:params[4]});return [{affectedRows:1}];}
      if(sql.startsWith('INSERT INTO recipes')){store.recipes.push({id:params[0],name:params[1],base_yield:params[2]});return [{affectedRows:1}];}
      if(sql.startsWith('INSERT INTO recipe_items')){store.recipeItems.push({recipeId:params[0],ingredientId:params[1],quantity:params[2]});return [{affectedRows:1}];}
      throw Error('SQL inesperado '+sql);
    }
  };}};
  const first=await promoteCatalogRecipe(pool,formula());
  assert.equal(first.existing,false);assert.equal(first.createdIngredients.length,1);
  assert.equal(store.ingredients.length,2,'Agua nueva, harina reutilizada');
  assert.equal(store.ingredients[0].stock,'9.000000');
  assert.equal(store.ingredients[0].cost_per_unit,'44.0000');
  assert.equal(store.ingredients[1].stock,0);assert.equal(store.ingredients[1].cost_per_unit,0);
  assert.equal(store.recipes.length,1);assert.equal(store.recipes[0].base_yield,5);
  assert.equal(store.recipeItems.length,2,'se agrupan dos cantidades de harina');
  assert.equal(store.recipeItems.find(i=>i.ingredientId===store.ingredients[0].id).quantity,0.42);
  const second=await promoteCatalogRecipe(pool,formula());
  assert.equal(second.existing,true);assert.equal(second.id,first.id);
  assert.equal(store.recipes.length,1,'no duplica recetas');
  assert.equal(store.commit,2);assert.equal(store.rollback,0);assert.equal(store.release,2);
});

test('FICHA-04 error de escritura MySQL revierte la operación',async()=>{
  let rollback=0,release=0;
  const pool={async getConnection(){return {async beginTransaction(){},async commit(){throw Error('no commit');},async rollback(){rollback++;},release(){release++;},
    async execute(sql){if(sql.startsWith('SELECT id FROM recipes'))return [[]];if(sql.startsWith('SELECT id,name,unit'))return [[]];if(sql.startsWith('INSERT INTO'))return [{affectedRows:1}];throw Error('SQL inesperado');}};}};
  await assert.rejects(()=>promoteCatalogRecipe(pool,formula()),/no commit/);
  assert.equal(rollback,1);assert.equal(release,1);
});

test('FICHA-05 API requiere sesión, usa catálogo guardado y admite operador para crear fichas',async t=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'paniko-ficha-'));
  const store=createStore(path.join(directory,'db.json'));
  let requestedId=null,requestedYield=null;
  store.importCatalogRecipe=async(source,yieldValue)=>{requestedYield=yieldValue;return {id:randomUUID(),name:source.nombre,baseYield:yieldValue,existing:false,createdIngredients:[]};};
  const auth={
    async userForToken(token){return token==='B'.repeat(43)?{role:'operador',username:'empleado'}:null;},
    async getCatalogRecipe(id){requestedId=id;return id==='hogaza_prueba'?formula():null;}
  };
  const server=createApp({store,auth});server.listen(0,'127.0.0.1');await once(server,'listening');
  t.after(async()=>{await new Promise(resolve=>server.close(resolve));fs.rmSync(directory,{recursive:true,force:true});});
  const base=`http://127.0.0.1:${server.address().port}`;
  const request=async(token)=>fetch(base+'/api/recipes/from-catalog/hogaza_prueba',{
    method:'POST',headers:{...(token?{Cookie:'paniko_session='+token}:{}),'Content-Type':'application/json'},
    body:JSON.stringify({baseYield:5})});
  assert.equal((await request()).status,401);
  const ok=await request('B'.repeat(43));assert.equal(ok.status,201);
  assert.equal((await ok.json()).baseYield,5);
  assert.equal(requestedId,'hogaza_prueba');assert.equal(requestedYield,5);
  const missing=await fetch(base+'/api/recipes/from-catalog/no_existe',{method:'POST',headers:{Cookie:'paniko_session='+'B'.repeat(43),'Content-Type':'application/json'},body:'{}'});
  assert.equal(missing.status,404);
});

test('FICHA-06 MySQL aislado: ficha importada usa ingredientes reales sin alterar stock y es idempotente',
  {skip:process.env.MYSQL_TEST==='1'?false:'Requiere MySQL de pruebas aislado'},async()=>{
    if(!String(process.env.DB_NAME||'').endsWith('_test'))throw Error('No ejecutar contra una base de datos real');
    const {poolFromEnv}=require('../src/database');
    const {createMysqlStore}=require('../src/mysql-store');
    const pool=poolFromEnv();
    try{
      const identifier=randomUUID().replace(/-/g,'').slice(0,16);
      const ingredientName='Ingrediente ficticio '+identifier;
      const source={id:'ficticia_'+identifier,nombre:'Ficha sintética '+identifier,estado:'confirmada',
        rendimiento:{cantidad:5,unidad:'piezas'},ingredientes:[
          {ingrediente:ingredientName,cantidad:125,unidad:'g'}],componentes:[],variantes:[]};
      const store=createMysqlStore(pool);
      const first=await store.importCatalogRecipe(source,5);
      assert.equal(first.existing,false);
      assert.equal(first.createdIngredients.length,1);
      const second=await store.importCatalogRecipe(source,5);
      assert.equal(second.existing,true);
      assert.equal(second.id,first.id);
      const found=(await store.listRecipes()).find(r=>r.id===first.id);
      assert.equal(found.baseYield,5);
      assert.equal(found.items.length,1);
      const stock=(await store.listIngredients()).find(i=>i.name===ingredientName);
      assert.equal(stock.stock,0);
      assert.equal(stock.costPerUnit,0);
      const preview=await store.preview(first.id,10);
      assert.equal(preview.lines.length,1);
      assert.equal(preview.lines[0].required,250);
      assert.equal(preview.maxProducible,0);
      assert.equal((await store.listIngredients()).find(i=>i.id===stock.id).stock,0);
    }finally{await pool.end();}
  });
