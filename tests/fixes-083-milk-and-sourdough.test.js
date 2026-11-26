'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {convertIngredientQuantity,validateRecipe,bakerPercentages,MILK_GRAMS_PER_ML}=require('../src/domain');
const {stockEntry,stockExit}=require('../src/inventory');
const {planCatalogRecipe}=require('../src/catalog-to-recipe');

test('MILK-083-01 leche entera g/kg y ml/l con densidad culinaria explícita',()=>{
 assert.equal(MILK_GRAMS_PER_ML,1.03);
 assert.equal(convertIngredientQuantity(100,'ml','g','Leche'),103);
 assert.equal(convertIngredientQuantity(100,'g','ml','Leche'),97.087379);
 assert.equal(convertIngredientQuantity(1,'l','kg','Leche entera'),1.03);
 assert.equal(convertIngredientQuantity(0.5,'kg','ml','Leche pasteurizada'),485.436893);
 assert.equal(convertIngredientQuantity(200,'ml','kg','Leche fría'),0.206);
 assert.equal(convertIngredientQuantity(0.75,'l','g','Leche tibia'),772.5);
 assert.throws(()=>convertIngredientQuantity(200,'g','ml','Leche en polvo'),/equivalencia/i);
 assert.throws(()=>convertIngredientQuantity(200,'g','ml','Leche condensada'),/equivalencia/i);
 assert.throws(()=>convertIngredientQuantity(200,'g','ml','Leche evaporada'),/equivalencia/i);
 assert.throws(()=>convertIngredientQuantity(200,'g','ml','Miel'),/equivalencia/i);
 assert.throws(()=>convertIngredientQuantity(200,'g','ml','Aceite'),/equivalencia/i);
});
test('MILK-083-02 fichas de brioche en ml con leche registrada en kg se convierten y no exigen stock',()=>{
 const ingredients=[{id:'milk',name:'Leche entera',unit:'kg',stock:0,costPerUnit:0},{id:'flour',name:'Harina de trigo',unit:'kg',stock:0,costPerUnit:0}];
 const recipe=validateRecipe({name:'Brioche de prueba',baseYield:8,yieldUnit:'pieza',items:[
   {ingredientId:'milk',quantity:250,unit:'ml'},{ingredientId:'flour',quantity:1,unit:'kg'}
 ]},ingredients);
 assert.equal(recipe.items.find(r=>r.ingredientId==='milk').quantity,0.2575);
 assert.equal(ingredients[0].stock,0);
 const b=bakerPercentages(recipe,ingredients);
 assert.equal(b.lines.find(r=>r.ingredientId==='milk').percentage,25.75);
});
test('MILK-083-03 inventario de leche admite entrada/salida y no convierte otras sustancias',()=>{
 assert.equal(stockEntry({quantity:1000,unit:'ml'},'kg','Leche entera').quantity,1.03);
 assert.equal(stockExit({quantity:103,unit:'g'},'l','Leche').quantity,0.1);
 assert.throws(()=>stockEntry({quantity:100,unit:'ml'},'kg','Mantequilla'),/equivalencia/i);
});
test('MILK-083-04 catálogo de brioche de prueba admite leche en gramos al planificar',()=>{
 const raw={nombre:'Brioche ficticio',estado:'confirmada',rendimiento:{cantidad:8,unidad:'piezas'},componentes:[],ingredientes:[
   {ingrediente:'Harina de trigo',cantidad:600,unidad:'g'},
   {ingrediente:'Leche',cantidad:120,unidad:'g'}
 ]};
 const plan=planCatalogRecipe(raw);
 assert.equal(plan.ready,true);assert.equal(plan.items[1].unit,'g');
});
test('MILK-083-05 selector UI de leche admite g, kg, ml, l y aclara densidad',()=>{
 const root=path.join(__dirname,'..','public');
 assert.match(fs.readFileSync(path.join(root,'app.js'),'utf8'),/leche\(\?:/);
 assert.match(fs.readFileSync(path.join(root,'index.html'),'utf8'),/1 ml ≈ 1\.03 g/);
});
