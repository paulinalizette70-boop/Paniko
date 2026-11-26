'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const enabled=process.env.MYSQL_TEST==='1';
test('DB-FORM-01 MySQL aislado: un lote brioche produce tres formatos y extras sin duplicar ingredientes',
 {skip:!enabled?'Requiere MySQL de pruebas aislado, exclusivamente *_test':false},async()=>{
  if(!/_test$/.test(process.env.DB_NAME||''))throw Error('Nunca ejecutar contra inventario real; se necesita *_test');
  const {poolFromEnv}=require('../src/database');
  const {createMysqlStore}=require('../src/mysql-store');
  const {createFinishedProductStore}=require('../src/finished-products');
  const {createDoughFormatStore}=require('../src/dough-formats');
  const {migrate}=require('../scripts/migrate-dough-formats');
  const db=poolFromEnv();
  try{
    await migrate(db);await migrate(db);
    const inventory=createMysqlStore(db),products=createFinishedProductStore(db),dough=createDoughFormatStore(db);
    const suffix=randomUUID();
    const flour=await inventory.addIngredient({name:'Harina brioche '+suffix,unit:'g',stock:10000,costPerUnit:.05});
    const milk=await inventory.addIngredient({name:'Leche entera fresca',unit:'l',stock:5,costPerUnit:30});
    const jam=await inventory.addIngredient({name:'Mermelada '+suffix,unit:'kg',stock:2,costPerUnit:100});
    const cream=await inventory.addIngredient({name:'Queso crema '+suffix,unit:'g',stock:2000,costPerUnit:.1});
    const crust=await inventory.addIngredient({name:'Costra '+suffix,unit:'g',stock:3000,costPerUnit:.2});
    const recipe=await inventory.addRecipe({name:'Masa brioche sintética '+suffix,baseYield:10,yieldUnit:'pieza',items:[
      {ingredientId:flour.id,quantity:600,unit:'g'}, {ingredientId:milk.id,quantity:206,unit:'g'}]});
    const concha=await products.createProduct({name:'Concha brioche '+suffix,categoryId:'brioche',salePrice:null,operationalRecipeId:recipe.id});
    const hamburger=await products.createProduct({name:'Bollo brioche '+suffix,categoryId:'brioche',salePrice:null,operationalRecipeId:recipe.id});
    const bun=await products.createProduct({name:'Bun relleno '+suffix,categoryId:'brioche',salePrice:null,operationalRecipeId:recipe.id});
    await dough.setBase({recipeId:recipe.id,referenceGrams:1000});
    await dough.setFormat({recipeId:recipe.id,productId:concha.id,doughGrams:45,
      extras:[{ingredientId:crust.id,quantity:15,unit:'g'}]});
    await dough.setFormat({recipeId:recipe.id,productId:hamburger.id,doughGrams:60,extras:[]});
    await dough.setFormat({recipeId:recipe.id,productId:bun.id,doughGrams:70,
      extras:[{ingredientId:jam.id,quantity:20,unit:'g'}, {ingredientId:cream.id,quantity:15,unit:'g'}]});
    const request={recipeId:recipe.id,formats:[{productId:concha.id,pieces:10},{productId:hamburger.id,pieces:12},{productId:bun.id,pieces:8}]};
    const preview=await dough.preview(request);
    assert.equal(preview.stockAvailable,true);assert.equal(preview.doughGrams,1730);
    const confirmed=await dough.confirm(request);
    assert.equal(confirmed.totalPieces,30);assert.equal(confirmed.finishedProducts.length,3);
    const stocks=Object.fromEntries((await inventory.listIngredients()).map(i=>[i.id,i.stock]));
    assert.equal(stocks[flour.id],8962);
    assert.equal(stocks[milk.id],4.654);
    assert.equal(stocks[jam.id],1.84);assert.equal(stocks[cream.id],1880);assert.equal(stocks[crust.id],2850);
    const saved=(await products.listProducts()).filter(p=>[concha.id,hamburger.id,bun.id].includes(p.id));
    assert.deepEqual(saved.map(x=>x.stock).sort((a,b)=>a-b),[8,10,12]);
    const [rows]=await db.execute('SELECT product_id,quantity,batch_id FROM finished_product_movements WHERE batch_id=?',[confirmed.id]);
    assert.equal(rows.length,3);
    const [fmt]=await db.execute('SELECT product_id,pieces,dough_grams_per_piece FROM production_batch_formats WHERE batch_id=?',[confirmed.id]);
    assert.equal(fmt.length,3);
    const detail=await inventory.getProductionBatch(confirmed.id);
    assert.equal(detail.finishedProducts.length,3);
    assert.equal(detail.desiredYield,1730);assert.equal(detail.yieldUnit,'g');
    // Una operación con faltante no genera lote ni reduce inventario.
    await assert.rejects(()=>dough.confirm({recipeId:recipe.id,formats:[{productId:concha.id,pieces:3000}]}),/faltan ingredientes/i);
    const later=(await inventory.listIngredients()).find(i=>i.id===flour.id);assert.equal(later.stock,8962);
  }finally{await db.end();}
});
