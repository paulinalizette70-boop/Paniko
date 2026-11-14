'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {once}=require('node:events');
const crypto=require('node:crypto');
const {createDoughProductsStore,normalizeTemplate,calculateDoughPlan}=require('../src/dough-products');
const {createApp}=require('../src/app');
const {migrate}=require('../scripts/migrate-dough-products-084');
const {createStore}=require('../src/store');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');

const recipeId='11111111-1111-4111-8111-111111111111';
const conchaId='22222222-2222-4222-8222-222222222222';
const frenchId='33333333-3333-4333-8333-333333333333';
const rollId='44444444-4444-4444-8444-444444444444';
const flourId='55555555-5555-4555-8555-555555555555';
const sugarId='66666666-6666-4666-8666-666666666666';
const cinnamonId='77777777-7777-4777-8777-777777777777';

const ingredients=[
 {id:flourId,name:'Harina ficticia',unit:'kg',stock:3,costPerUnit:25},
 {id:sugarId,name:'Azúcar ficticia',unit:'kg',stock:2,costPerUnit:30},
 {id:cinnamonId,name:'Canela ficticia',unit:'kg',stock:0.02,costPerUnit:100}
];
const recipe={id:recipeId,name:'Masa brioche ficticia',baseYield:2000,yieldUnit:'g',
 items:[{ingredientId:flourId,quantity:1},{ingredientId:sugarId,quantity:0.4}]};
const variants=[
 {id:conchaId,name:'Concha de ensayo',categoryId:'brioche',recipeId,gramsPerPiece:45,stock:0,active:true,
  extras:[{ingredientId:sugarId,quantityPerPiece:0.01}]},
 {id:frenchId,name:'Francés de ensayo',categoryId:'brioche',recipeId,gramsPerPiece:55,stock:0,active:true,extras:[]},
 {id:rollId,name:'Placa de roles ficticia',categoryId:'brioche',recipeId,gramsPerPiece:370,stock:0,active:true,
  extras:[{ingredientId:cinnamonId,quantityPerPiece:0.005}]}
];
const planInput={recipeId,items:[
 {productId:conchaId,quantity:10},{productId:frenchId,quantity:8},{productId:rollId,quantity:3}]};

test('MASA-01 guardar variantes exige masa por gramos, gramaje positivo y extras de inventario',()=>{
 const refs={recipes:[recipe],ingredients,categories:[{id:'brioche',name:'Brioche'}]};
 const valid=normalizeTemplate({name:' Concha ficticia ',categoryId:'brioche',recipeId,
   gramsPerPiece:45,extras:[{ingredientId:sugarId,quantity:20,unit:'g'}]},refs);
 assert.equal(valid.name,'Concha ficticia');
 assert.equal(valid.gramsPerPiece,45);
 assert.equal(valid.extras[0].quantityPerPiece,0.02);
 assert.throws(()=>normalizeTemplate({name:'Pieza',categoryId:'brioche',recipeId,gramsPerPiece:0},refs),/Gramos/);
 assert.throws(()=>normalizeTemplate({name:'Pieza',categoryId:'brioche',recipeId,gramsPerPiece:45,
   extras:[{ingredientId:sugarId,quantity:20,unit:'ml'}]},refs),/incompatib|equivalencia/i);
 assert.throws(()=>normalizeTemplate({name:'Pieza',categoryId:'brioche',recipeId,gramsPerPiece:45,
   extras:[{ingredientId:sugarId,quantity:5,unit:'g'},{ingredientId:sugarId,quantity:5,unit:'g'}]},refs),/repitas/);
 assert.throws(()=>normalizeTemplate({name:'Pieza',categoryId:'brioche',recipeId,gramsPerPiece:45},
   {...refs,recipes:[{...recipe,yieldUnit:'pieza'}]}),/rendimiento en gramos/);
});

test('MASA-02 de una masa de 2000 g salen conchas, franceses y placas; extras no duplican insumos',()=>{
 const plan=calculateDoughPlan(planInput,recipe,variants,ingredients);
 assert.equal(plan.totalDoughGrams,2000);
 assert.deepEqual(plan.outputs.map(x=>x.totalGrams),[450,440,1110]);
 assert.equal(plan.stockAvailable,true);
 assert.equal(plan.lines.find(x=>x.ingredientId===flourId).required,1);
 assert.equal(plan.lines.find(x=>x.ingredientId===sugarId).required,0.5);
 assert.equal(plan.lines.find(x=>x.ingredientId===cinnamonId).required,0.015);
 assert.equal(plan.lines.length,3);
 assert.equal(plan.outputs.reduce((n,x)=>n+x.quantity,0),21);
});

test('MASA-03 rechazo de piezas no enteras, producto duplicado, receta distinta y faltantes',()=>{
 const bad=[...ingredients.map(x=>({...x}))];
 bad[2].stock=0.005;
 assert.equal(calculateDoughPlan(planInput,recipe,variants,bad).stockAvailable,false);
 assert.equal(calculateDoughPlan(planInput,recipe,variants,bad).lines.find(x=>x.ingredientId===cinnamonId).shortage,0.01);
 assert.throws(()=>calculateDoughPlan({recipeId,items:[{productId:conchaId,quantity:1.5}]},recipe,variants,ingredients),/entero/);
 assert.throws(()=>calculateDoughPlan({recipeId,items:[{productId:conchaId,quantity:1},{productId:conchaId,quantity:1}]},recipe,variants,ingredients),/repitas/);
 assert.throws(()=>calculateDoughPlan({recipeId,items:[{productId:conchaId,quantity:1}]},
   {...recipe,yieldUnit:'pieza'},variants,ingredients),/rendimiento en gramos/);
 assert.throws(()=>calculateDoughPlan({recipeId,items:[{productId:conchaId,quantity:1}]},
   recipe,variants.map(x=>({...x,active:false})),ingredients),/activo|masa/);
});

function mockPool({shortage=false}={}){
 const ingredientState=new Map(ingredients.map(x=>[x.id,{...x,stock:x.id===cinnamonId&&shortage?0.005:x.stock}]));
 const productState=new Map(variants.map(x=>[x.id,{...x}]));
 const log={begin:0,commits:0,rollbacks:0,batches:0,productMovements:0,ingredients:[],outputRows:[]};
 const connection={
   async beginTransaction(){log.begin++;},
   async commit(){log.commits++;},
   async rollback(){log.rollbacks++;},
   release(){},
   async execute(sql,args=[]){
     if(sql.startsWith('SELECT id,name,base_yield,yield_unit FROM recipes WHERE yield_unit='))return [[{
       id:recipe.id,name:recipe.name,base_yield:recipe.baseYield,yield_unit:'g'}]];
     if(sql.startsWith('SELECT p.id,p.name,p.category_id')){
       return [[...productState.values()].filter(x=>!args.length||args.includes(x.id))
         .map(p=>({id:p.id,name:p.name,category_id:p.categoryId,category_name:'Brioche',
           operational_recipe_id:p.recipeId,recipe_name:recipe.name,dough_grams_per_piece:p.gramsPerPiece,
           active:1,stock:p.stock}))];
     }
     if(sql.startsWith('SELECT e.product_id,e.ingredient_id')){
       const rs=[...productState.values()].filter(p=>args.includes(p.id)).flatMap(p=>p.extras.map(e=>{
         const ing=ingredientState.get(e.ingredientId);
         return {product_id:p.id,ingredient_id:ing.id,quantity_per_piece:e.quantityPerPiece,
           name:ing.name,unit:ing.unit};
       }));
       return [rs];
     }
     if(sql.startsWith('SELECT ingredient_id,quantity FROM recipe_items WHERE recipe_id=')){
       return [recipe.items.map(i=>({ingredient_id:i.ingredientId,quantity:i.quantity}))];
     }
     if(sql.startsWith('SELECT id,name,unit,cost_per_unit,stock FROM ingredients')){
       return [[...ingredientState.values()].filter(i=>!args.length||args.includes(i.id))
         .map(i=>({id:i.id,name:i.name,unit:i.unit,cost_per_unit:i.costPerUnit,stock:i.stock}))];
     }
     if(sql.startsWith('INSERT INTO production_batches')){log.batches++;return [{affectedRows:1}];}
     if(sql.startsWith('UPDATE ingredients SET stock=')){
       const ing=ingredientState.get(args[1]);if(ing.stock<args[2])return [{affectedRows:0}];
       ing.stock=args[0];return [{affectedRows:1}];
     }
     if(sql.startsWith('INSERT INTO inventory_movements')){log.ingredients.push(args[1]);return [{affectedRows:1}];}
     if(sql.startsWith('INSERT INTO production_batch_items'))return [{affectedRows:1}];
     if(sql.startsWith('UPDATE finished_products SET stock=')){
       const product=productState.get(args[1]);
       if(product.stock!==args[2])return [{affectedRows:0}];
       product.stock=args[0];return [{affectedRows:1}];
     }
     if(sql.startsWith('INSERT INTO finished_product_movements')){log.productMovements++;return [{affectedRows:1}];}
     if(sql.startsWith('INSERT INTO dough_batch_outputs')){log.outputRows.push(args);return [{affectedRows:1}];}
     throw Error('SQL inesperado: '+sql);
   }
 };
 return {getConnection:async()=>connection,execute:connection.execute.bind(connection),
   report:()=>({log,ingredientState,productState})};
}

test('MASA-04 vista previa no cambia inventario; confirmar registra una tanda y 3 productos',async()=>{
 const db=mockPool(),store=createDoughProductsStore(db);
 const before=db.report().ingredientState.get(flourId).stock;
 const preview=await store.preview(planInput);
 assert.equal(preview.totalDoughGrams,2000);
 assert.equal(db.report().log.batches,0);
 assert.equal(db.report().ingredientState.get(flourId).stock,before);
 const completed=await store.produce(planInput);
 const {log,ingredientState,productState}=db.report();
 assert.equal(completed.finishedProducts.length,3);
 assert.equal(completed.id.length,36);
 assert.equal(log.batches,1);
 assert.equal(log.ingredients.length,3);
 assert.equal(log.productMovements,3);
 assert.equal(log.outputRows.length,3);
 assert.equal(log.commits,1);
 assert.equal(log.rollbacks,0);
 assert.equal(ingredientState.get(flourId).stock,2);
 assert.equal(ingredientState.get(sugarId).stock,1.5);
 assert.equal(ingredientState.get(cinnamonId).stock,0.005);
 assert.equal(productState.get(conchaId).stock,10);
 assert.equal(productState.get(frenchId).stock,8);
 assert.equal(productState.get(rollId).stock,3);
});

test('MASA-05 inventario insuficiente bloquea toda la tanda antes de escribir',async()=>{
 const db=mockPool({shortage:true}),store=createDoughProductsStore(db);
 await assert.rejects(()=>store.produce(planInput),/Inventario insuficiente/);
 const {log,ingredientState,productState}=db.report();
 assert.equal(log.rollbacks,1);assert.equal(log.commits,0);
 assert.equal(log.batches,0);assert.equal(log.productMovements,0);
 assert.equal(ingredientState.get(flourId).stock,3);
 assert.equal(productState.get(conchaId).stock,0);
});

test('MASA-06 migración no altera stocks; cambia el índice único para varios productos por lote',async()=>{
 const names=[];
 let col=false,oldIndex=true,newIndex=false;
 const db={
   async execute(sql,args){
     if(sql.includes('information_schema.COLUMNS'))return [[{n:col?1:0}]];
     if(sql.includes('information_schema.STATISTICS'))
       return [[{n:args[2]==='uq_fpm_batch'?(oldIndex?1:0):(newIndex?1:0)}]];
     throw Error('SQL no esperado');
   },
   async query(sql){
     names.push(sql);
     if(sql.includes('ADD COLUMN dough_grams_per_piece'))col=true;
     if(sql.includes('DROP INDEX uq_fpm_batch'))oldIndex=false;
     if(sql.includes('ADD UNIQUE KEY uq_fpm_batch_product'))newIndex=true;
   }
 };
 const first=await migrate(db);
 assert.equal(first.index,'uq_fpm_batch_product');
 assert.ok(names.some(x=>x.includes('ADD COLUMN dough_grams_per_piece')));
 assert.ok(names.some(x=>x.includes('DROP INDEX uq_fpm_batch')));
 assert.ok(names.some(x=>x.includes('dough_product_extras')));
 assert.ok(names.some(x=>x.includes('dough_batch_outputs')));
 const count=names.length;await migrate(db);
 assert.equal(names.filter(x=>x.includes('ADD COLUMN')).length,1);
 assert.equal(names.filter(x=>x.includes('DROP INDEX')).length,1);
 assert.equal(names.filter(x=>x.includes('ADD UNIQUE KEY')).length,1);
 assert.equal(names.length,count+2); // CREATE TABLE IF NOT EXISTS se repite, no altera datos.
});

test('MASA-07 rutas de masa exigen autenticación y ocultan costos a operador',async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'dough-api-'));
 const dough={
   async list(){return variants;},
   async create(){return{id:conchaId};},
   async update(){return{id:conchaId};},
   async preview(){return{recipeId,estimatedTotalCost:123.45,lines:[{name:'Harina ficticia',estimatedCost:99}]};},
   async produce(){return{id:crypto.randomUUID()};}
 };
 const auth={async userForToken(token){
   if(token==='A'.repeat(43))return{role:'admin'};
   if(token==='B'.repeat(43))return{role:'operador'};
   return null;
 }};
 const server=createApp({store:createStore(path.join(dir,'data.json')),auth,dough});
 server.listen(0,'127.0.0.1');await once(server,'listening');
 t.after(()=>{server.close();fs.rmSync(dir,{recursive:true,force:true});});
 const base='http://127.0.0.1:'+server.address().port;
 assert.equal((await fetch(base+'/api/dough-products')).status,401);
 const api=async(path,role,method='GET')=>fetch(base+path,{
   method,headers:{Cookie:'paniko_session='+role.repeat(43),...(method==='POST'?{'Content-Type':'application/json'}:{})},
   ...(method==='POST'?{body:'{}'}:{})});
 assert.equal((await api('/api/dough-products','B')).status,200);
 assert.equal((await api('/api/dough-products','B','POST')).status,201);
 assert.equal((await api('/api/dough-products/'+conchaId+'/update','B','POST')).status,200);
 const oper=await (await api('/api/dough-products/preview','B','POST')).json();
 assert.equal(oper.estimatedTotalCost,undefined);
 assert.equal(oper.lines[0].estimatedCost,undefined);
 const admin=await (await api('/api/dough-products/preview','A','POST')).json();
 assert.equal(admin.estimatedTotalCost,123.45);
 const confirmed=await api('/api/dough-products/produce','B','POST');
 assert.equal(confirmed.status,201);
});
