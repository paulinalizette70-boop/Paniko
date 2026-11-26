'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const enabled=process.env.MYSQL_TEST==='1';
test('DB-PREP-01 MySQL aislado: crear preparacion, producirla y usarla en conchas sin doble descuento',
 {skip:!enabled?'Solo MySQL de pruebas con nombre *_test':false},async()=>{
  if(!/_test$/.test(process.env.DB_NAME||''))throw Error('Las pruebas de preparaciones requieren *_test');
  const {poolFromEnv}=require('../src/database');
  const {createMysqlStore}=require('../src/mysql-store');
  const {createFinishedProductStore}=require('../src/finished-products');
  const {createDoughFormatStore}=require('../src/dough-formats');
  const {createPreparationStore}=require('../src/dough-preparations');
  const {migrate}=require('../scripts/migrate-dough-preparations');
  const db=poolFromEnv();
  try{
    await migrate(db);await migrate(db); // idempotente
    const inv=createMysqlStore(db),dough=createDoughFormatStore(db),prep=createPreparationStore(db);
    const products=createFinishedProductStore(db);
    const suffix=randomUUID();
    const flour=await inv.addIngredient({name:'Harina masa '+suffix,unit:'g',stock:10000,costPerUnit:0.02});
    const sugar=await inv.addIngredient({name:'Azucar costra '+suffix,unit:'g',stock:1500,costPerUnit:0.03});
    const butter=await inv.addIngredient({name:'Mantequilla costra '+suffix,unit:'g',stock:1200,costPerUnit:0.1});
    const recipe=await inv.addRecipe({name:'Brioche sintetico '+suffix,baseYield:1000,yieldUnit:'g',
      items:[{ingredientId:flour.id,quantity:600,unit:'g'}]});
    const crustRecipe=await inv.addRecipe({name:'Costra sintetica '+suffix,baseYield:600,yieldUnit:'g',
      items:[{ingredientId:sugar.id,quantity:300,unit:'g'},{ingredientId:butter.id,quantity:200,unit:'g'}]});
    const link=await prep.register({recipeId:crustRecipe.id});
    assert.ok(link.ingredientId);
    assert.equal((await prep.list()).find(x=>x.recipeId===crustRecipe.id).stock,0);
    assert.equal((await inv.listIngredients()).find(x=>x.id===sugar.id).stock,1500);
    const view=await prep.preview({recipeId:crustRecipe.id,quantity:600});
    assert.equal(view.stockAvailable,true);
    assert.equal(view.addedQuantity,600);
    assert.equal('outputUnitCost' in view,false);
    assert.equal('unitCost' in view.lines[0],false);
    const batch=await prep.produce({recipeId:crustRecipe.id,quantity:600});
    assert.equal(batch.stockAfter,600);
    assert.equal((await inv.listIngredients()).find(x=>x.id===sugar.id).stock,1200);
    assert.equal((await inv.listIngredients()).find(x=>x.id===butter.id).stock,1000);
    const [moves]=await db.execute('SELECT movement_type,ingredient_id,quantity,batch_id FROM inventory_movements WHERE batch_id=?',[batch.id]);
    assert.equal(moves.length,3);
    assert.equal(moves.filter(x=>x.movement_type==='entrada').length,1);
    assert.ok(moves.some(x=>x.ingredient_id===link.ingredientId&&x.movement_type==='entrada'&&Number(x.quantity)===600));

    await dough.setBase({recipeId:recipe.id,referenceGrams:1000});
    const concha=await dough.createProduct({recipeId:recipe.id,name:'Concha creada desde brioche '+suffix,doughGrams:45,
      extras:[{ingredientId:link.ingredientId,quantity:15,unit:'g'}]});
    const recorded=(await products.listProducts()).find(x=>x.id===concha.id);
    assert.ok(recorded);assert.equal(recorded.stock,0);
    const calculation=await dough.preview({recipeId:recipe.id,formats:[{productId:concha.id,pieces:10}]});
    assert.equal(calculation.stockAvailable,true);
    assert.equal(calculation.doughGrams,450);
    const done=await dough.confirm({recipeId:recipe.id,formats:[{productId:concha.id,pieces:10}]});
    assert.equal(done.totalPieces,10);
    assert.equal((await inv.listIngredients()).find(x=>x.id===link.ingredientId).stock,450);
    // Costra usada como inventario: la azucar/mantequilla NO se descuentan otra vez.
    assert.equal((await inv.listIngredients()).find(x=>x.id===sugar.id).stock,1200);
    assert.equal((await inv.listIngredients()).find(x=>x.id===butter.id).stock,1000);
    assert.equal((await products.listProducts()).find(x=>x.id===concha.id).stock,10);
    await assert.rejects(()=>dough.createProduct({recipeId:recipe.id,name:recorded.name,doughGrams:40,extras:[]}),/Ya existe/i);
    assert.equal((await products.listProducts()).filter(x=>x.name===recorded.name).length,1);
    // Un faltante impide confirmar y conserva inventario.
    await assert.rejects(()=>prep.produce({recipeId:crustRecipe.id,quantity:100000}),/Inventario insuficiente/);
    assert.equal((await inv.listIngredients()).find(x=>x.id===link.ingredientId).stock,450);
  }finally{await db.end();}
});
test('DB-PREP-02 reutiliza la existencia ya registrada de una receta de mermelada',
 {skip:!enabled?'Solo MySQL de pruebas con nombre *_test':false},async()=>{
  if(!/_test$/.test(process.env.DB_NAME||''))throw Error('Base no aislada');
  const {poolFromEnv}=require('../src/database');
  const {createMysqlStore}=require('../src/mysql-store');
  const {createPreparationStore}=require('../src/dough-preparations');
  const db=poolFromEnv();
  try{
    const inv=createMysqlStore(db),prep=createPreparationStore(db),suffix=randomUUID();
    const fruit=await inv.addIngredient({name:'Fruta '+suffix,unit:'kg',stock:2,costPerUnit:25});
    const output=await inv.addIngredient({name:'Mermelada preparada '+suffix,unit:'kg',stock:0.1,costPerUnit:50});
    const recipe=await inv.addRecipe({name:'Mermelada '+suffix,baseYield:1000,yieldUnit:'g',
      items:[{ingredientId:fruit.id,quantity:1,unit:'kg'}]});
    await prep.register({recipeId:recipe.id,ingredientId:output.id});
    await assert.rejects(()=>prep.register({recipeId:recipe.id,ingredientId:output.id}),/ya esta vinculada/i);
    const done=await prep.produce({recipeId:recipe.id,quantity:500});
    assert.equal(done.addedQuantity,.5);
    assert.equal(done.stockAfter,.6);
    assert.equal((await inv.listIngredients()).find(x=>x.id===fruit.id).stock,1.5);
    assert.equal((await inv.listIngredients()).find(x=>x.id===output.id).stock,.6);
  }finally{await db.end();}
});

test('DB-PREP-03 jornada bun: faltante de guayaba, preparación y lote sin doble descuento',
 {skip:!enabled?'Solo MySQL de pruebas con nombre *_test':false},async()=>{
  if(!/_test$/.test(process.env.DB_NAME||''))throw Error('Base no aislada');
  const {poolFromEnv}=require('../src/database');
  const {createMysqlStore}=require('../src/mysql-store');
  const {createFinishedProductStore}=require('../src/finished-products');
  const {createDoughFormatStore}=require('../src/dough-formats');
  const {createPreparationStore}=require('../src/dough-preparations');
  const db=poolFromEnv();
  try{
    const inv=createMysqlStore(db),prep=createPreparationStore(db),dough=createDoughFormatStore(db),products=createFinishedProductStore(db),suffix=randomUUID();
    const flour=await inv.addIngredient({name:'Harina bun '+suffix,unit:'g',stock:3000,costPerUnit:.02});
    const cream=await inv.addIngredient({name:'Queso bun '+suffix,unit:'kg',stock:.5,costPerUnit:100});
    const fruit=await inv.addIngredient({name:'Guayaba prueba '+suffix,unit:'g',stock:1000,costPerUnit:.05});
    const jam=await inv.addIngredient({name:'Mermelada prueba '+suffix,unit:'kg',stock:.1,costPerUnit:100});
    const base=await inv.addRecipe({name:'Brioche bun '+suffix,baseYield:2000,yieldUnit:'g',items:[{ingredientId:flour.id,quantity:1000,unit:'g'}]});
    const jamRecipe=await inv.addRecipe({name:'Guayaba preparada '+suffix,baseYield:600,yieldUnit:'g',items:[{ingredientId:fruit.id,quantity:600,unit:'g'}]});
    await prep.register({recipeId:jamRecipe.id,ingredientId:jam.id});
    await dough.setBase({recipeId:base.id,referenceGrams:2000});
    const bun=await dough.createProduct({recipeId:base.id,name:'Bun guayaba '+suffix,doughGrams:50,extras:[{ingredientId:cream.id,quantity:10,unit:'g'},{ingredientId:jam.id,quantity:15,unit:'g'}]});
    const stock=async id=>(await inv.listIngredients()).find(x=>x.id===id).stock;
    assert.equal(await stock(jam.id),.1);
    const payload={recipeId:base.id,formats:[{productId:bun.id,pieces:20}],operationId:randomUUID()};
    const missing=await dough.preview(payload);
    assert.equal(missing.stockAvailable,false);
    assert.equal(missing.consumptions.find(x=>x.ingredientId===jam.id).shortage,.2);
    await assert.rejects(()=>dough.confirm(payload),/Faltan ingredientes/);
    assert.equal(await stock(flour.id),3000);
    const prepPayload={recipeId:jamRecipe.id,quantity:200,operationId:randomUUID()};
    assert.equal((await prep.preview(prepPayload)).stockAvailable,true);
    await prep.produce(prepPayload);
    await prep.produce(prepPayload);
    assert.equal(await stock(jam.id),.3);
    assert.equal(await stock(fruit.id),800);
    const ready=await dough.preview(payload);
    assert.equal(ready.stockAvailable,true);
    assert.equal(ready.doughGrams,1000);
    const done=await dough.confirm(payload);
    const repeat=await dough.confirm(payload);
    assert.equal(done.id,repeat.id);
    assert.equal(await stock(jam.id),0);
    assert.equal(await stock(cream.id),.3);
    assert.equal(await stock(flour.id),2500);
    assert.equal(await stock(fruit.id),800);
    assert.equal((await products.listProducts()).find(p=>p.id===bun.id).stock,20);
  }finally{await db.end();}
});
