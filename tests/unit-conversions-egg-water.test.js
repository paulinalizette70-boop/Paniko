'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const {convertIngredientQuantity,convertQuantity,validateRecipe,EGG_GRAMS_PER_PIECE}=require('../src/domain');
const {stockEntry,stockExit}=require('../src/inventory');
const {promoteCatalogRecipe}=require('../src/catalog-to-recipe');

test('UNIDAD-01 huevo definido a 50 g: piezas, g, kg, ida y vuelta',()=>{
  assert.equal(EGG_GRAMS_PER_PIECE,50);
  assert.equal(convertIngredientQuantity(1,'pieza','g','Huevo'),50);
  assert.equal(convertIngredientQuantity(2,'pieza','kg','Huevos'),0.1);
  assert.equal(convertIngredientQuantity(100,'g','pieza','Huevo'),2);
  assert.equal(convertIngredientQuantity(180,'g','pieza','Huevo'),3.6);
  assert.equal(convertIngredientQuantity(0.25,'kg','pieza','Huevo grande'),5);
  assert.equal(convertIngredientQuantity(2,'pieza','g','HUEVOS'),100);
  assert.equal(convertIngredientQuantity(0.05,'kg','pieza','Huevo entero'),1);
});

test('UNIDAD-02 agua g/ml y kg/l, sin extender densidad a otros alimentos',()=>{
  assert.equal(convertIngredientQuantity(500,'g','ml','Agua'),500);
  assert.equal(convertIngredientQuantity(500,'g','l','Agua'),0.5);
  assert.equal(convertIngredientQuantity(0.75,'l','g','Agua'),750);
  assert.equal(convertIngredientQuantity(1,'kg','l','Agua purificada'),1);
  assert.equal(convertIngredientQuantity(250,'ml','kg','Agua'),0.25);
  assert.equal(convertIngredientQuantity(500,'g','ml','Leche'),485.436893); // leche ≈1.03 g/ml
  assert.throws(()=>convertIngredientQuantity(1,'pieza','g','Manzana'),/equivalencia/i);
  assert.throws(()=>convertIngredientQuantity(1,'pieza','g','Mantequilla'),/equivalencia/i);
  assert.throws(()=>convertIngredientQuantity(1,'pieza','ml','Huevo'),/equivalencia/i);
  assert.throws(()=>convertIngredientQuantity(1,'pieza','g','Agua'),/equivalencia/i);
  assert.throws(()=>convertQuantity(1,'pieza','g'),/incompatibles/i);
  assert.throws(()=>convertIngredientQuantity(0,'pieza','g','Huevo'),/Cantidad/);
  assert.throws(()=>convertIngredientQuantity(0.000001,'g','pieza','Huevo'),/precisión/i);
});

test('UNIDAD-03 ficha manual de panqué admite 180 g de huevo con inventario en piezas',()=>{
  const ingredients=[
    {id:'huevo',name:'Huevo',unit:'pieza',stock:0,costPerUnit:0},
    {id:'agua',name:'Agua',unit:'l',stock:0,costPerUnit:0},
  ];
  const r=validateRecipe({name:'Panqué ficticio',baseYield:2,items:[
    {ingredientId:'huevo',unit:'g',quantity:180},
    {ingredientId:'agua',unit:'g',quantity:250}
  ]},ingredients);
  assert.deepEqual(r.items,[{ingredientId:'huevo',quantity:3.6},{ingredientId:'agua',quantity:0.25}]);
  assert.equal(ingredients[0].stock,0);
  assert.throws(()=>validateRecipe({name:'Algo imposible',baseYield:1,items:[
    {ingredientId:'huevo',unit:'ml',quantity:30}
  ]},ingredients),/equivalencia/i);
});

test('UNIDAD-04 entrada y salida de huevo por gramos se registran en piezas equivalentes',()=>{
  assert.deepEqual(stockEntry({quantity:100,unit:'g',reason:'Ingreso ficticio'},'pieza','Huevo'),
    {quantity:2,reason:'Ingreso ficticio'});
  assert.deepEqual(stockExit({quantity:50,unit:'g',reason:'Salida ficticia'},'pieza','Huevo'),
    {quantity:1,reason:'Salida ficticia'});
  assert.equal(stockEntry({quantity:750,unit:'g'},'l','Agua').quantity,0.75);
  assert.throws(()=>stockEntry({quantity:100,unit:'g'},'pieza','Levadura'),/equivalencia/i);
});

function fakePool(ingredients){
  const state={ingredients:ingredients.map(i=>({...i})),recipes:[],recipeItems:[],commits:0,rollbacks:0};
  const conn={
    async beginTransaction(){},async commit(){state.commits++},async rollback(){state.rollbacks++},release(){},
    async execute(sql,params){
      if(sql.startsWith('SELECT id FROM recipes')) return [state.recipes.filter(r=>r.name===params[0])];
      if(sql.startsWith('SELECT id,name,unit,cost_per_unit,stock FROM ingredients'))return [state.ingredients];
      if(sql.startsWith('INSERT INTO ingredients')){state.ingredients.push({id:params[0],name:params[1],unit:params[2],cost_per_unit:params[3],stock:params[4]});return [{affectedRows:1}];}
      if(sql.startsWith('INSERT INTO recipes')){state.recipes.push({id:params[0],name:params[1],base_yield:params[2]});return [{affectedRows:1}];}
      if(sql.startsWith('INSERT INTO recipe_items')){state.recipeItems.push({recipeId:params[0],ingredientId:params[1],quantity:params[2]});return [{affectedRows:1}];}
      throw new Error('SQL inesperado '+sql);
    }
  };
  return {state, getConnection:async()=>conn};
}
function formula(name,items){return {id:'demo_sin_formula_real',nombre:name,estado:'confirmada',rendimiento:{cantidad:2,unidad:'piezas'},componentes:[],variantes:[],ingredientes:items};}

test('UNIDAD-05 convierte Agua y Huevo al crear ficha y NO cambia stocks ni costos',async()=>{
  const eggId=randomUUID(),waterId=randomUUID();
  const pool=fakePool([
    {id:eggId,name:'Huevo',unit:'pieza',cost_per_unit:4,stock:30},
    {id:waterId,name:'Agua',unit:'l',cost_per_unit:8,stock:5}
  ]);
  const recipe=formula('Panqué de ensayo',[{ingrediente:'Huevo',cantidad:180,unidad:'g'},
    {ingrediente:'Agua',cantidad:200,unidad:'g'}]);
  const first=await promoteCatalogRecipe(pool,recipe);
  assert.equal(first.existing,false);
  assert.deepEqual(first.createdIngredients,[]);
  assert.equal(pool.state.recipeItems.find(x=>x.ingredientId===eggId).quantity,3.6);
  assert.equal(pool.state.recipeItems.find(x=>x.ingredientId===waterId).quantity,0.2);
  assert.equal(pool.state.ingredients[0].stock,30);
  assert.equal(pool.state.ingredients[1].stock,5);
  assert.equal(pool.state.ingredients[0].cost_per_unit,4);
  const second=await promoteCatalogRecipe(pool,recipe);
  assert.equal(second.existing,true);
  assert.equal(pool.state.recipes.length,1);
  assert.equal(pool.state.rollbacks,0);
});

test('UNIDAD-06 ficha sin stock se crea y producción es la que revisa existencia',async()=>{
  const eggId=randomUUID();
  const pool=fakePool([{id:eggId,name:'Huevo',unit:'pieza',cost_per_unit:0,stock:0}]);
  const first=await promoteCatalogRecipe(pool,formula('Panqué sin stock',[{ingrediente:'Huevo',cantidad:100,unidad:'g'}]));
  assert.equal(first.existing,false);
  assert.equal(pool.state.recipeItems[0].quantity,2);
  assert.equal(pool.state.ingredients[0].stock,0);
});

test('UNIDAD-083-01 importación de brioche ficticio reutiliza leche almacenada en litros sin alterar stock',async()=>{
 const milkId=randomUUID(),flourId=randomUUID();
 const pool=fakePool([
  {id:milkId,name:'Leche',unit:'l',cost_per_unit:23,stock:4},
  {id:flourId,name:'Harina de trigo',unit:'kg',cost_per_unit:18,stock:5}
 ]);
 const raw=formula('Brioche ficticio con leche',[{ingrediente:'Leche',cantidad:103,unidad:'g'},
   {ingrediente:'Harina de trigo',cantidad:600,unidad:'g'}]);
 const result=await promoteCatalogRecipe(pool,raw);
 assert.equal(result.existing,false);assert.deepEqual(result.createdIngredients,[]);
 const milkLine=pool.state.recipeItems.find(i=>i.ingredientId===milkId);
 assert.equal(milkLine.quantity,0.1);
 assert.equal(pool.state.ingredients[0].stock,4);
 assert.equal(pool.state.ingredients[0].cost_per_unit,23);
});
