'use strict';
// Subpreparaciones: el inventario de preparacion se crea desde su receta.
// Un lote consume materias primas y suma la preparacion terminada, todo en MySQL.
const {randomUUID}=require('node:crypto');
const {withRequest}=require('./idempotency');
const {ValidationError,convertQuantity,validateRecipe}=require('./domain');
const {roundQuantity,safeStockSum}=require('./inventory');
const UUID=/^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i;
const money=n=>Math.round((n+Number.EPSILON)*100)/100;
const cost4=n=>Math.round((n+Number.EPSILON)*10000)/10000;
function id(v,label='Receta'){
  if(typeof v!=='string'||!UUID.test(v))throw new ValidationError(label+' invalida');
  return v;
}
function quantity(v){
  if(typeof v!=='number'||!Number.isSafeInteger(v)||v<1||v>1000000000)
    throw new ValidationError('Cantidad preparada: indica un numero entero de gramos o mililitros');
  return v;
}
function validateUnit(yieldUnit,unit){
  if(yieldUnit!=='g'&&yieldUnit!=='ml')
    throw new ValidationError('Las subpreparaciones deben tener rendimiento en gramos o mililitros');
  if(!(yieldUnit==='g'?['g','kg']:['ml','l']).includes(unit))
    throw new ValidationError('El ingrediente y el rendimiento de la preparacion deben tener unidades compatibles');
}
function createPreparationStore(pool){
  async function list(){
    const [rows]=await pool.execute(
      'SELECT p.recipe_id,p.ingredient_id,r.name AS recipe_name,r.base_yield,r.yield_unit,i.name AS ingredient_name,i.unit,i.stock '+
      'FROM dough_prepared_recipes p JOIN recipes r ON r.id=p.recipe_id '+
      'JOIN ingredients i ON i.id=p.ingredient_id ORDER BY r.name,p.recipe_id');
    return rows.map(r=>({recipeId:r.recipe_id,ingredientId:r.ingredient_id,recipeName:r.recipe_name,
      baseYield:Number(r.base_yield),yieldUnit:r.yield_unit,ingredientName:r.ingredient_name,unit:r.unit,stock:Number(r.stock)}));
  }
  // Vincula una ficha con una existencia; opcionalmente reutiliza un ingrediente ya creado.
  // No cambia cantidades existentes ni ejecuta la receta.
  async function register(raw){
    const recipeId=id(raw?.recipeId);
    const existingIngredientId=raw?.ingredientId ? id(raw.ingredientId,'Ingrediente') : null;
    const conn=await pool.getConnection();
    try{
      await conn.beginTransaction();
      const [r]=await conn.execute('SELECT id,name,base_yield,yield_unit FROM recipes WHERE id=? FOR UPDATE',[recipeId]);
      if(!r.length)throw new ValidationError('No se encontro la ficha tecnica',404);
      if(!['g','ml'].includes(r[0].yield_unit))
        throw new ValidationError('La receta complementaria necesita rendimiento en gramos o mililitros');
      const [linked]=await conn.execute('SELECT ingredient_id FROM dough_prepared_recipes WHERE recipe_id=?',[recipeId]);
      if(linked.length)throw new ValidationError('La preparacion ya esta vinculada al inventario',409);
      const [components]=await conn.execute('SELECT ingredient_id FROM recipe_items WHERE recipe_id=?',[recipeId]);
      if(!components.length)throw new ValidationError('La receta no tiene ingredientes');
      let ingredientId=existingIngredientId;
      if(ingredientId){
        if(components.some(x=>x.ingredient_id===ingredientId))
          throw new ValidationError('Una receta no puede producir el mismo ingrediente que consume');
        const [ing]=await conn.execute('SELECT id,name,unit,stock FROM ingredients WHERE id=? FOR UPDATE',[ingredientId]);
        if(!ing.length)throw new ValidationError('Ingrediente de preparacion no encontrado',404);
        validateUnit(r[0].yield_unit,ing[0].unit);
        const [other]=await conn.execute('SELECT recipe_id FROM dough_prepared_recipes WHERE ingredient_id=?',[ingredientId]);
        if(other.length)throw new ValidationError('Esta existencia ya corresponde a otra preparacion',409);
      }else{
        ingredientId=randomUUID();
        const name=('Preparacion: '+r[0].name).slice(0,100);
        await conn.execute('INSERT INTO ingredients (id,name,unit,cost_per_unit,stock) VALUES (?,?,?,0,0)',
          [ingredientId,name,r[0].yield_unit]);
      }
      await conn.execute('INSERT INTO dough_prepared_recipes (recipe_id,ingredient_id) VALUES (?,?)',[recipeId,ingredientId]);
      await conn.commit();
      return {recipeId,ingredientId};
    }catch(err){
      await conn.rollback();
      if(err?.code==='ER_DUP_ENTRY')throw new ValidationError('La preparacion o su nombre ya existe; selecciona el ingrediente existente para vincularlo',409);
      throw err;
    }finally{conn.release();}
  }
  // Crear ficha y existencia en una sola transacción, sin movimientos de inventario.
  async function create(raw){
    if(!['g','ml'].includes(raw?.yieldUnit))throw new ValidationError('Indica el rendimiento real en gramos o mililitros');
    const conn=await pool.getConnection();
    try{
      await conn.beginTransaction();
      const [rows]=await conn.execute('SELECT id,name,unit,cost_per_unit,stock FROM ingredients ORDER BY id FOR UPDATE');
      const ingredients=rows.map(i=>({id:i.id,name:i.name,unit:i.unit,costPerUnit:Number(i.cost_per_unit),stock:Number(i.stock)}));
      const recipe=validateRecipe(raw,ingredients);
      quantity(recipe.baseYield);
      const [existing]=await conn.execute('SELECT id FROM recipes WHERE name=? FOR UPDATE',[recipe.name]);
      if(existing.length)throw new ValidationError('Ya existe una ficha con ese nombre. Usa la opción de receta existente.',409);
      const normalize=v=>String(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/^preparacion:\s*/,'').trim();
      const matches=ingredients.filter(i=>normalize(i.name)===normalize(recipe.name));
      let ingredientId;
      if(raw.ingredientId){
        ingredientId=id(raw.ingredientId,'Existencia');
        const ing=ingredients.find(i=>i.id===ingredientId);
        if(!ing)throw new ValidationError('Existencia no encontrada',404);
        validateUnit(recipe.yieldUnit,ing.unit);
        if(recipe.items.some(i=>i.ingredientId===ingredientId))throw new ValidationError('La preparación no puede consumirse a sí misma');
        const [linked]=await conn.execute('SELECT recipe_id FROM dough_prepared_recipes WHERE ingredient_id=?',[ingredientId]);
        if(linked.length)throw new ValidationError('Esta existencia ya está vinculada a otra preparación',409);
      }else{
        if(matches.length)throw new ValidationError('Ya existe un ingrediente con ese nombre. Selecciona la existencia correcta para no duplicar inventario.',409);
        ingredientId=randomUUID();
        await conn.execute('INSERT INTO ingredients (id,name,unit,cost_per_unit,stock) VALUES (?,?,?,0,0)',[ingredientId,('Preparacion: '+recipe.name).slice(0,100),recipe.yieldUnit]);
      }
      const recipeId=randomUUID();
      await conn.execute('INSERT INTO recipes (id,name,base_yield,yield_unit) VALUES (?,?,?,?)',[recipeId,recipe.name,recipe.baseYield,recipe.yieldUnit]);
      for(const item of recipe.items)await conn.execute('INSERT INTO recipe_items (recipe_id,ingredient_id,quantity) VALUES (?,?,?)',[recipeId,item.ingredientId,item.quantity]);
      await conn.execute('INSERT INTO dough_prepared_recipes (recipe_id,ingredient_id) VALUES (?,?)',[recipeId,ingredientId]);
      await conn.commit();
      return {recipeId,ingredientId,name:recipe.name};
    }catch(err){await conn.rollback();if(err?.code==='ER_DUP_ENTRY')throw new ValidationError('La preparación o existencia ya existe. Revisa las recetas existentes.',409);throw err;}finally{conn.release();}
  }
  async function getPlan(raw,conn=pool,locked=false){
    const recipeId=id(raw?.recipeId);
    const desiredYield=quantity(raw?.quantity);
    const [recipes]=await conn.execute(
      'SELECT r.id,r.name,r.base_yield,r.yield_unit,p.ingredient_id FROM dough_prepared_recipes p '+
      'JOIN recipes r ON r.id=p.recipe_id WHERE r.id=?',[recipeId]);
    if(!recipes.length)throw new ValidationError('Primero vincula esta preparacion con inventario',409);
    const r=recipes[0];
    if(!['g','ml'].includes(r.yield_unit))throw new ValidationError('El rendimiento de la subpreparacion ya no es valido',409);
    const [items]=await conn.execute('SELECT ingredient_id,quantity FROM recipe_items WHERE recipe_id=? ORDER BY ingredient_id',[recipeId]);
    if(!items.length)throw new ValidationError('La receta no tiene ingredientes',409);
    if(items.some(x=>x.ingredient_id===r.ingredient_id))
      throw new ValidationError('La preparacion no puede consumirse a si misma',409);
    const ids=[...new Set([r.ingredient_id,...items.map(x=>x.ingredient_id)])].sort();
    const ingredients=new Map();
    for(const ingredientId of ids){
      const [rows]=await conn.execute('SELECT id,name,unit,cost_per_unit,stock FROM ingredients WHERE id=?'+(locked?' FOR UPDATE':''),[ingredientId]);
      if(!rows.length)throw new ValidationError('Falta un ingrediente de la preparacion',409);
      ingredients.set(ingredientId,{id:rows[0].id,name:rows[0].name,unit:rows[0].unit,
        costPerUnit:Number(rows[0].cost_per_unit),stock:Number(rows[0].stock)});
    }
    const output=ingredients.get(r.ingredient_id);
    validateUnit(r.yield_unit,output.unit);
    const addedQuantity=convertQuantity(desiredYield,r.yield_unit,output.unit);
    let totalCost=0;
    const lines=items.map(item=>{
      const ingredient=ingredients.get(item.ingredient_id);
      const required=roundQuantity(Number(item.quantity)*desiredYield/Number(r.base_yield));
      if(!Number.isFinite(required)||required<=0||required>1e9)
        throw new ValidationError('Cantidad de insumo fuera de limites');
      const shortage=roundQuantity(Math.max(0,required-ingredient.stock));
      totalCost+=required*ingredient.costPerUnit;
      return {ingredientId:ingredient.id,name:ingredient.name,unit:ingredient.unit,required,
        stock:ingredient.stock,shortage,sufficient:required<=ingredient.stock+1e-8,
        unitCost:ingredient.costPerUnit,estimatedCost:money(required*ingredient.costPerUnit)};
    });
    // No devolver al personal el coste en las rutas publicas: se filtra en src/app.js.
    return {recipeId,recipeName:r.name,quantity:desiredYield,yieldUnit:r.yield_unit,
      outputIngredientId:output.id,outputName:output.name,outputUnit:output.unit,
      stockBefore:output.stock,addedQuantity,lines,stockAvailable:lines.every(x=>x.sufficient),
      estimatedTotalCost:money(totalCost),outputUnitCost:output.costPerUnit};
  }
  async function preview(raw){
    const {outputUnitCost,...plan}=await getPlan(raw);
    return {...plan,lines:plan.lines.map(({unitCost,...line})=>line)};
  }
  async function produce(raw){
    const conn=await pool.getConnection();
    try{
      await conn.beginTransaction();
      const result=await withRequest(conn,raw?.operationId,'preparation-production',
        {recipeId:raw?.recipeId,quantity:raw?.quantity},async()=>{
      const plan=await getPlan(raw,conn,true);
      if(!plan.stockAvailable)
        throw new ValidationError('Inventario insuficiente: '+plan.lines.filter(x=>!x.sufficient).map(x=>x.name).join(', '),409);
      const stockAfter=safeStockSum(plan.stockBefore,plan.addedQuantity);
      const unitCost=cost4((plan.stockBefore*plan.outputUnitCost+plan.estimatedTotalCost)/stockAfter);
      if(!Number.isFinite(unitCost)||unitCost<0||unitCost>9999999999)
        throw new ValidationError('Costo de preparacion fuera de limites');
      const batchId=randomUUID();
      await conn.execute('INSERT INTO production_batches (id,recipe_id,recipe_name,desired_yield,yield_unit,estimated_total_cost) VALUES (?,?,?,?,?,?)',
        [batchId,plan.recipeId,plan.recipeName,plan.quantity,plan.yieldUnit,plan.estimatedTotalCost]);
      for(const line of plan.lines){
        const after=roundQuantity(line.stock-line.required);
        const [updated]=await conn.execute('UPDATE ingredients SET stock=? WHERE id=? AND stock>=?',
          [after,line.ingredientId,line.required]);
        if(updated.affectedRows!==1)throw new ValidationError('El inventario cambio mientras producías',409);
        await conn.execute("INSERT INTO inventory_movements (id,ingredient_id,movement_type,quantity,stock_before,stock_after,reason,batch_id) VALUES (?,?,'salida',?,?,?,?,?)",
          [randomUUID(),line.ingredientId,line.required,line.stock,after,'Insumos de preparacion '+batchId,batchId]);
        await conn.execute('INSERT INTO production_batch_items (batch_id,ingredient_id,quantity,unit_cost,estimated_cost) VALUES (?,?,?,?,?)',
          [batchId,line.ingredientId,line.required,line.unitCost,line.estimatedCost]);
      }
      const [out]=await conn.execute('UPDATE ingredients SET stock=?,cost_per_unit=? WHERE id=?',
        [stockAfter,unitCost,plan.outputIngredientId]);
      if(out.affectedRows!==1)throw new ValidationError('No se pudo registrar la preparacion',409);
      await conn.execute("INSERT INTO inventory_movements (id,ingredient_id,movement_type,quantity,stock_before,stock_after,reason,batch_id) VALUES (?,?,'entrada',?,?,?,?,?)",
        [randomUUID(),plan.outputIngredientId,plan.addedQuantity,plan.stockBefore,stockAfter,'Preparacion terminada '+batchId,batchId]);
      return {id:batchId,recipeId:plan.recipeId,recipeName:plan.recipeName,quantity:plan.quantity,
        yieldUnit:plan.yieldUnit,ingredientId:plan.outputIngredientId,ingredientName:plan.outputName,
        addedQuantity:plan.addedQuantity,unit:plan.outputUnit,stockAfter};
      });
      await conn.commit();return result;
    }catch(err){await conn.rollback();throw err;}finally{conn.release()}
  }
  return {list,register,create,preview,produce};
}
module.exports={createPreparationStore};
