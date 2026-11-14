'use strict';
const crypto = require('node:crypto');
const {promoteCatalogRecipe} = require('./catalog-to-recipe');
const {ValidationError, validateIngredient, validateRecipe, scaleRecipe} = require('./domain');
const {stockEntry, stockExit, stockAdjustment, validateProduction, safeStockSum, roundQuantity} = require('./inventory');

// mysql2/promise devuelve DECIMAL como cadenas para preservar la precisión.
function ingredientFromRow(row) {
  return {id:row.id, name:row.name, unit:row.unit, costPerUnit:Number(row.cost_per_unit), stock:Number(row.stock)};
}
function recipeFromRow(row) {
  return {id:row.id, name:row.name, baseYield:Number(row.base_yield),yieldUnit:row.yield_unit||'pieza', items:[]};
}
function movementFromRow(row) {
  return {id:row.id, ingredientId:row.ingredient_id, name:row.ingredient_name, type:row.movement_type,
    quantity:Number(row.quantity), stockBefore:Number(row.stock_before), stockAfter:Number(row.stock_after),
    reason:row.reason, batchId:row.batch_id, createdAt:row.created_at};
}
function mysqlError(error) {
  if (error && error.code === 'ER_DUP_ENTRY') return new ValidationError('Este ingrediente ya existe con la misma unidad',409);
  if (error && error.code === 'ER_NO_REFERENCED_ROW_2') return new ValidationError('Un ingrediente ya no existe',409);
  return error;
}
async function inTransaction(pool, action) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const value = await action(conn);
    await conn.commit();
    return value;
  } catch (error) {
    await conn.rollback();
    throw mysqlError(error);
  } finally {conn.release();}
}
function createMysqlStore(pool) {
  async function listIngredients() {
    const [rows] = await pool.execute('SELECT id, name, unit, cost_per_unit, stock FROM ingredients ORDER BY name, id');
    return rows.map(ingredientFromRow);
  }
  async function updateIngredientCost(id,costPerUnit){
    if(typeof costPerUnit!=='number'||!Number.isFinite(costPerUnit)||costPerUnit<0||costPerUnit>1e9||
       Math.abs(costPerUnit-Math.round(costPerUnit*1e4)/1e4)>1e-10)
      throw new ValidationError('Costo inválido: máximo cuatro decimales');
    const [result]=await pool.execute('UPDATE ingredients SET cost_per_unit=? WHERE id=?',[costPerUnit,id]);
    if(result.affectedRows!==1)throw new ValidationError('Ingrediente no encontrado',404);
    return {id,costPerUnit};
  }
  async function importCatalogRecipe(source,baseYield,yieldUnit=null){return promoteCatalogRecipe(pool,source,baseYield,yieldUnit);}
  async function listRecipes() {
    const [rows] = await pool.execute('SELECT id, name, base_yield, yield_unit FROM recipes ORDER BY name, id');
    const [items] = await pool.execute('SELECT recipe_id, ingredient_id, quantity FROM recipe_items ORDER BY recipe_id, ingredient_id');
    const recipes = rows.map(recipeFromRow);
    const byId = new Map(recipes.map(r => [r.id,r]));
    for (const item of items) byId.get(item.recipe_id)?.items.push({ingredientId:item.ingredient_id, quantity:Number(item.quantity)});
    return recipes;
  }
  async function getRecipe(id, conn=pool) {
    const [rows] = await conn.execute('SELECT id, name, base_yield, yield_unit FROM recipes WHERE id=?', [id]);
    if (!rows.length) return undefined;
    const recipe=recipeFromRow(rows[0]);
    const [items] = await conn.execute('SELECT ingredient_id, quantity FROM recipe_items WHERE recipe_id=? ORDER BY ingredient_id', [id]);
    recipe.items=items.map(i => ({ingredientId:i.ingredient_id, quantity:Number(i.quantity)}));
    return recipe;
  }
  async function addIngredient(raw) {
    const ingredient=validateIngredient(raw);
    const id=crypto.randomUUID();
    try {
      await inTransaction(pool, async c => {
        await c.execute('INSERT INTO ingredients (id,name,unit,cost_per_unit,stock) VALUES (?,?,?,?,?)', [id,ingredient.name,ingredient.unit,ingredient.costPerUnit,ingredient.stock]);
        if (ingredient.stock>0) await c.execute(`INSERT INTO inventory_movements (id,ingredient_id,movement_type,quantity,stock_before,stock_after,reason) VALUES (?,?,'entrada',?,?,?,'Inventario inicial')`,[crypto.randomUUID(),id,ingredient.stock,0,ingredient.stock]);
      });
    }catch(e){throw mysqlError(e);}
    return {id,...ingredient};
  }
  async function addRecipe(raw) {
    return inTransaction(pool,async c=>{
      const [rows]=await c.execute('SELECT id,name,unit,cost_per_unit,stock FROM ingredients ORDER BY id');
      const recipe=validateRecipe(raw,rows.map(ingredientFromRow));
      const id=crypto.randomUUID();
      await c.execute('INSERT INTO recipes (id,name,base_yield,yield_unit) VALUES (?,?,?,?)',[id,recipe.name,recipe.baseYield,recipe.yieldUnit]);
      for(const item of recipe.items) await c.execute('INSERT INTO recipe_items (recipe_id,ingredient_id,quantity) VALUES (?,?,?)',[id,item.ingredientId,item.quantity]);
      return {id,...recipe};
    });
  }
  async function updateRecipe(id,raw){
    return inTransaction(pool,async conn=>{
      const [rows]=await conn.execute('SELECT id FROM recipes WHERE id=? FOR UPDATE',[id]);
      if(!rows.length)throw new ValidationError('Ficha técnica no encontrada',404);
      const [ingredients]=await conn.execute('SELECT id,name,unit,cost_per_unit,stock FROM ingredients ORDER BY id');
      const validated=validateRecipe(raw,ingredients.map(ingredientFromRow));
      await conn.execute('UPDATE recipes SET name=?,base_yield=?,yield_unit=? WHERE id=?',[validated.name,validated.baseYield,validated.yieldUnit,id]);
      await conn.execute('DELETE FROM recipe_items WHERE recipe_id=?',[id]);
      for(const item of validated.items)
        await conn.execute('INSERT INTO recipe_items (recipe_id,ingredient_id,quantity) VALUES (?,?,?)',[id,item.ingredientId,item.quantity]);
      return {id,...validated};
    });
  }
  async function preview(id,desiredYield) {
    const recipe=await getRecipe(id);
    if(!recipe) throw new ValidationError('Receta no encontrada',404);
    return scaleRecipe(recipe,await listIngredients(),desiredYield);
  }
  async function listMovements() {
    const [rows]=await pool.execute(`SELECT m.id,m.ingredient_id,i.name AS ingredient_name,m.movement_type,m.quantity,m.stock_before,m.stock_after,m.reason,m.batch_id,m.created_at FROM inventory_movements m JOIN ingredients i ON i.id=m.ingredient_id ORDER BY m.created_at DESC,m.id DESC LIMIT 100`);
    return rows.map(movementFromRow);
  }
  async function listProduction() {
    const [rows]=await pool.execute('SELECT id,recipe_id,recipe_name,desired_yield,yield_unit,estimated_total_cost,created_at FROM production_batches ORDER BY created_at DESC,id DESC LIMIT 100');
    return rows.map(r=>({id:r.id,recipeId:r.recipe_id,recipeName:r.recipe_name,desiredYield:r.desired_yield,yieldUnit:r.yield_unit||'pieza',estimatedTotalCost:Number(r.estimated_total_cost),createdAt:r.created_at}));
  }
  async function getProductionBatch(id) {
    const [rows]=await pool.execute(
      'SELECT id,recipe_id,recipe_name,desired_yield,yield_unit,estimated_total_cost,created_at FROM production_batches WHERE id=?', [id]);
    if(!rows.length)throw new ValidationError('Lote de producción no encontrado',404);
    const r=rows[0];
    const [items]=await pool.execute(`SELECT bi.ingredient_id,i.name AS ingredient_name,i.unit,bi.quantity,bi.unit_cost,bi.estimated_cost,
      m.stock_before,m.stock_after
      FROM production_batch_items bi
      JOIN ingredients i ON i.id=bi.ingredient_id
      LEFT JOIN inventory_movements m ON m.batch_id=bi.batch_id AND m.ingredient_id=bi.ingredient_id
      WHERE bi.batch_id=? ORDER BY i.name,bi.ingredient_id`,[id]);
    const [finished]=await pool.execute(`SELECT m.product_id,p.name AS product_name,m.quantity,m.stock_before,m.stock_after
      FROM finished_product_movements m JOIN finished_products p ON p.id=m.product_id
      WHERE m.batch_id=? ORDER BY m.product_id`,[id]);
    return {
      id:r.id,recipeId:r.recipe_id,recipeName:r.recipe_name,desiredYield:Number(r.desired_yield),yieldUnit:r.yield_unit||'pieza',
      estimatedTotalCost:Number(r.estimated_total_cost),createdAt:r.created_at,
      lines:items.map(x=>({ingredientId:x.ingredient_id,name:x.ingredient_name,unit:x.unit,
        quantity:Number(x.quantity),unitCost:Number(x.unit_cost),estimatedCost:Number(x.estimated_cost),
        stockBefore:x.stock_before===null?null:Number(x.stock_before),
        stockAfter:x.stock_after===null?null:Number(x.stock_after)})),
      finishedProduct:finished.length?{id:finished[0].product_id,name:finished[0].product_name,
        quantity:Number(finished[0].quantity),before:Number(finished[0].stock_before),after:Number(finished[0].stock_after)}:null,
      finishedProducts:finished.map(p=>({id:p.product_id,name:p.product_name,
        quantity:Number(p.quantity),before:Number(p.stock_before),after:Number(p.stock_after)}))
    };
  }
  async function stockIn(id,raw) {
    return inTransaction(pool,async c=>{
      const [rows]=await c.execute('SELECT id,name,unit,cost_per_unit,stock FROM ingredients WHERE id=? FOR UPDATE',[id]);
      if(!rows.length) throw new ValidationError('Ingrediente no encontrado',404);
      const ingredient=ingredientFromRow(rows[0]);
      const {quantity,reason}=stockEntry(raw,ingredient.unit,ingredient.name);
      const stockBefore=ingredient.stock;
      ingredient.stock=safeStockSum(stockBefore,quantity);
      const movementId=crypto.randomUUID();
      await c.execute('UPDATE ingredients SET stock=? WHERE id=?',[ingredient.stock,id]);
      await c.execute(`INSERT INTO inventory_movements (id,ingredient_id,movement_type,quantity,stock_before,stock_after,reason) VALUES (?,?,'entrada',?,?,?,?)`,[movementId,id,quantity,stockBefore,ingredient.stock,reason]);
      return {ingredient,movement:{id:movementId,ingredientId:id,name:ingredient.name,type:'entrada',quantity,stockBefore,stockAfter:ingredient.stock,reason}};
    });
  }
  async function stockOut(id,raw){
    return inTransaction(pool,async c=>{
      const [rows]=await c.execute('SELECT id,name,unit,cost_per_unit,stock FROM ingredients WHERE id=? FOR UPDATE',[id]);
      if(!rows.length)throw new ValidationError('Ingrediente no encontrado',404);
      const ingredient=ingredientFromRow(rows[0]);
      const {quantity,reason}=stockExit(raw,ingredient.unit,ingredient.name),before=ingredient.stock;
      if(quantity>before)throw new ValidationError('Inventario insuficiente para esta salida',409);
      const after=roundQuantity(before-quantity);
      const [updated]=await c.execute('UPDATE ingredients SET stock=? WHERE id=? AND stock>=?',[after,id,quantity]);
      if(updated.affectedRows!==1)throw new ValidationError('El inventario cambió: vuelve a revisar existencias',409);
      const movementId=crypto.randomUUID();
      await c.execute(`INSERT INTO inventory_movements (id,ingredient_id,movement_type,quantity,stock_before,stock_after,reason) VALUES (?,?,'salida',?,?,?,?)`,
        [movementId,id,quantity,before,after,reason]);
      ingredient.stock=after;
      return {ingredient,movement:{id:movementId,ingredientId:id,name:ingredient.name,type:'salida',quantity,stockBefore:before,stockAfter:after,reason}};
    });
  }
  async function adjustStock(id,raw){
    return inTransaction(pool,async c=>{
      const [rows]=await c.execute('SELECT id,name,unit,cost_per_unit,stock FROM ingredients WHERE id=? FOR UPDATE',[id]);
      if(!rows.length)throw new ValidationError('Ingrediente no encontrado',404);
      const ingredient=ingredientFromRow(rows[0]);
      const {newStock,reason}=stockAdjustment(raw),before=ingredient.stock;
      if(newStock===before)throw new ValidationError('La existencia no cambió',400);
      const type=newStock>before?'entrada':'salida';
      const quantity=roundQuantity(Math.abs(newStock-before));
      await c.execute('UPDATE ingredients SET stock=? WHERE id=?',[newStock,id]);
      const movementId=crypto.randomUUID();
      await c.execute('INSERT INTO inventory_movements (id,ingredient_id,movement_type,quantity,stock_before,stock_after,reason) VALUES (?,?,?,?,?,?,?)',
        [movementId,id,type,quantity,before,newStock,reason]);
      ingredient.stock=newStock;
      return {ingredient,movement:{id:movementId,ingredientId:id,name:ingredient.name,type,quantity,stockBefore:before,stockAfter:newStock,reason}};
    });
  }
  async function confirmProduction(id,desiredYield,options={}) {
    return inTransaction(pool,async c=>{
      const recipe=await getRecipe(id,c);
      if(!recipe) throw new ValidationError('Receta no encontrada',404);
      // Orden estable para minimizar interbloqueos entre producciones concurrentes.
      const ingredients=[];
      for(const ingredientId of [...new Set(recipe.items.map(i=>i.ingredientId))].sort()) {
        const [rows]=await c.execute('SELECT id,name,unit,cost_per_unit,stock FROM ingredients WHERE id=? FOR UPDATE',[ingredientId]);
        if(!rows.length) throw new ValidationError('Ingrediente no encontrado',409);
        ingredients.push(ingredientFromRow(rows[0]));
      }
      const result=validateProduction(recipe,ingredients,desiredYield);
      const finishedId=options?.productId||null;
      let finished=null;
      if(finishedId){
        if((recipe.yieldUnit||'pieza')!=='pieza')throw new ValidationError('Las preparaciones por peso o volumen no se suman como piezas al inventario terminado',409);
        if(typeof finishedId!=='string'||!/^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i.test(finishedId))
          throw new ValidationError('Producto terminado inválido');
        const [rows]=await c.execute('SELECT id,name,stock FROM finished_products WHERE id=? AND operational_recipe_id=? AND active=1 FOR UPDATE',[finishedId,id]);
        if(!rows.length)throw new ValidationError('El producto no está vinculado a esta receta operativa',409);
        const before=Number(rows[0].stock);
        if(before+desiredYield>100000000)throw new ValidationError('Inventario terminado supera el límite',400);
        finished={id:finishedId,name:rows[0].name,before,after:before+desiredYield};
      }

      const batchId=crypto.randomUUID();
      await c.execute('INSERT INTO production_batches (id,recipe_id,recipe_name,desired_yield,yield_unit,estimated_total_cost) VALUES (?,?,?,?,?,?)',[batchId,id,recipe.name,desiredYield,recipe.yieldUnit||'pieza',result.estimatedTotalCost]);
      for(const line of result.lines){
        const ingredient=ingredients.find(i=>i.id===line.ingredientId);
        const before=ingredient.stock;
        const after=roundQuantity(before-line.required);
        const [update]=await c.execute('UPDATE ingredients SET stock=? WHERE id=? AND stock >= ?',[after,ingredient.id,line.required]);
        if(update.affectedRows!==1) throw new ValidationError('El inventario cambió: vuelve a revisar existencias',409);
        await c.execute(`INSERT INTO inventory_movements (id,ingredient_id,movement_type,quantity,stock_before,stock_after,reason,batch_id) VALUES (?,?,'salida',?,?,?,?,?)`,[crypto.randomUUID(),ingredient.id,line.required,before,after,`Producción ${batchId}`,batchId]);
        await c.execute('INSERT INTO production_batch_items (batch_id,ingredient_id,quantity,unit_cost,estimated_cost) VALUES (?,?,?,?,?)',[batchId,ingredient.id,line.required,ingredient.costPerUnit,line.estimatedCost]);
      }
      if(finished){
        await c.execute('UPDATE finished_products SET stock=? WHERE id=?',[finished.after,finished.id]);
        await c.execute(`INSERT INTO finished_product_movements (id,product_id,movement_type,quantity,stock_before,stock_after,reason,batch_id)
          VALUES (?,?,'produccion',?,?,?, ?, ?)`,[crypto.randomUUID(),finished.id,desiredYield,finished.before,finished.after,'Producción confirmada desde receta operativa',batchId]);
      }
      return {id:batchId,recipeId:recipe.id,recipeName:recipe.name,desiredYield,yieldUnit:recipe.yieldUnit||'pieza',estimatedTotalCost:result.estimatedTotalCost,
        finishedProduct:finished,lines:result.lines.map(line=>({ingredientId:line.ingredientId,name:line.name,unit:line.unit,quantity:line.required,estimatedCost:line.estimatedCost}))};
    });
  }
  return {listIngredients,updateIngredientCost,importCatalogRecipe,listRecipes,getRecipe,addIngredient,addRecipe,updateRecipe,preview,listMovements,listProduction,getProductionBatch,stockIn,stockOut,adjustStock,confirmProduction};
}
module.exports={createMysqlStore};
