'use strict';
const crypto = require('node:crypto');
const {ValidationError, validateIngredient, validateRecipe, scaleRecipe} = require('./domain');
const {stockEntry, validateProduction, safeStockSum, roundQuantity} = require('./inventory');

// mysql2/promise devuelve DECIMAL como cadenas para preservar la precisión.
function ingredientFromRow(row) {
  return {id:row.id, name:row.name, unit:row.unit, costPerUnit:Number(row.cost_per_unit), stock:Number(row.stock)};
}
function recipeFromRow(row) {
  return {id:row.id, name:row.name, baseYield:Number(row.base_yield), items:[]};
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
  async function listRecipes() {
    const [rows] = await pool.execute('SELECT id, name, base_yield FROM recipes ORDER BY name, id');
    const [items] = await pool.execute('SELECT recipe_id, ingredient_id, quantity FROM recipe_items ORDER BY recipe_id, ingredient_id');
    const recipes = rows.map(recipeFromRow);
    const byId = new Map(recipes.map(r => [r.id,r]));
    for (const item of items) byId.get(item.recipe_id)?.items.push({ingredientId:item.ingredient_id, quantity:Number(item.quantity)});
    return recipes;
  }
  async function getRecipe(id, conn=pool) {
    const [rows] = await conn.execute('SELECT id, name, base_yield FROM recipes WHERE id=?', [id]);
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
      await c.execute('INSERT INTO recipes (id,name,base_yield) VALUES (?,?,?)',[id,recipe.name,recipe.baseYield]);
      for(const item of recipe.items) await c.execute('INSERT INTO recipe_items (recipe_id,ingredient_id,quantity) VALUES (?,?,?)',[id,item.ingredientId,item.quantity]);
      return {id,...recipe};
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
    const [rows]=await pool.execute('SELECT id,recipe_id,recipe_name,desired_yield,estimated_total_cost,created_at FROM production_batches ORDER BY created_at DESC,id DESC LIMIT 100');
    return rows.map(r=>({id:r.id,recipeId:r.recipe_id,recipeName:r.recipe_name,desiredYield:r.desired_yield,estimatedTotalCost:Number(r.estimated_total_cost),createdAt:r.created_at}));
  }
  async function stockIn(id,raw) {
    return inTransaction(pool,async c=>{
      const [rows]=await c.execute('SELECT id,name,unit,cost_per_unit,stock FROM ingredients WHERE id=? FOR UPDATE',[id]);
      if(!rows.length) throw new ValidationError('Ingrediente no encontrado',404);
      const ingredient=ingredientFromRow(rows[0]);
      const {quantity,reason}=stockEntry(raw,ingredient.unit);
      const stockBefore=ingredient.stock;
      ingredient.stock=safeStockSum(stockBefore,quantity);
      const movementId=crypto.randomUUID();
      await c.execute('UPDATE ingredients SET stock=? WHERE id=?',[ingredient.stock,id]);
      await c.execute(`INSERT INTO inventory_movements (id,ingredient_id,movement_type,quantity,stock_before,stock_after,reason) VALUES (?,?,'entrada',?,?,?,?)`,[movementId,id,quantity,stockBefore,ingredient.stock,reason]);
      return {ingredient,movement:{id:movementId,ingredientId:id,name:ingredient.name,type:'entrada',quantity,stockBefore,stockAfter:ingredient.stock,reason}};
    });
  }
  async function stockOut(id,raw) {
    return inTransaction(pool,async c=>{
      const [rows]=await c.execute('SELECT id,name,unit,cost_per_unit,stock FROM ingredients WHERE id=? FOR UPDATE',[id]);
      if(!rows.length) throw new ValidationError('Ingrediente no encontrado',404);
      const ingredient=ingredientFromRow(rows[0]);
      const {quantity,reason}=stockEntry(raw,ingredient.unit,'Salida manual de inventario');
      const stockBefore=ingredient.stock;
      if(quantity>stockBefore) throw new ValidationError('Inventario insuficiente para registrar la salida',409);
      ingredient.stock=roundQuantity(stockBefore-quantity);
      const [update]=await c.execute('UPDATE ingredients SET stock=? WHERE id=? AND stock>=?',[ingredient.stock,id,quantity]);
      if(update.affectedRows!==1) throw new ValidationError('El inventario cambió: vuelve a revisar existencias',409);
      const movementId=crypto.randomUUID();
      await c.execute(`INSERT INTO inventory_movements (id,ingredient_id,movement_type,quantity,stock_before,stock_after,reason) VALUES (?,?,'salida',?,?,?,?)`,
        [movementId,id,quantity,stockBefore,ingredient.stock,reason]);
      return {ingredient,movement:{id:movementId,ingredientId:id,name:ingredient.name,type:'salida',
        quantity,stockBefore,stockAfter:ingredient.stock,reason}};
    });
  }
  async function confirmProduction(id,desiredYield) {
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
      const batchId=crypto.randomUUID();
      await c.execute('INSERT INTO production_batches (id,recipe_id,recipe_name,desired_yield,estimated_total_cost) VALUES (?,?,?,?,?)',[batchId,id,recipe.name,desiredYield,result.estimatedTotalCost]);
      for(const line of result.lines){
        const ingredient=ingredients.find(i=>i.id===line.ingredientId);
        const before=ingredient.stock;
        const after=roundQuantity(before-line.required);
        const [update]=await c.execute('UPDATE ingredients SET stock=? WHERE id=? AND stock >= ?',[after,ingredient.id,line.required]);
        if(update.affectedRows!==1) throw new ValidationError('El inventario cambió: vuelve a revisar existencias',409);
        await c.execute(`INSERT INTO inventory_movements (id,ingredient_id,movement_type,quantity,stock_before,stock_after,reason,batch_id) VALUES (?,?,'salida',?,?,?,?,?)`,[crypto.randomUUID(),ingredient.id,line.required,before,after,`Producción ${batchId}`,batchId]);
        await c.execute('INSERT INTO production_batch_items (batch_id,ingredient_id,quantity,unit_cost,estimated_cost) VALUES (?,?,?,?,?)',[batchId,ingredient.id,line.required,ingredient.costPerUnit,line.estimatedCost]);
      }
      return {id:batchId,recipeId:recipe.id,recipeName:recipe.name,desiredYield,estimatedTotalCost:result.estimatedTotalCost,lines:result.lines.map(line=>({ingredientId:line.ingredientId,name:line.name,unit:line.unit,quantity:line.required,estimatedCost:line.estimatedCost}))};
    });
  }
  return {listIngredients,listRecipes,getRecipe,addIngredient,addRecipe,preview,listMovements,listProduction,stockIn,stockOut,confirmProduction};
}
module.exports={createMysqlStore};
