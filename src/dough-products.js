'use strict';
const crypto=require('node:crypto');
const {ValidationError,convertIngredientQuantity}=require('./domain');
const {roundQuantity}=require('./inventory');

const UUID=/^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i;
const isId=x=>typeof x==='string'&&UUID.test(x);
const validId=(x,label)=>{
  if(!isId(x))throw new ValidationError(label+' inválido');
  return x;
};
function intAmount(value,label,max){
  if(!Number.isSafeInteger(value)||value<=0||value>max)
    throw new ValidationError(label+': introduce un entero positivo de hasta '+max);
  return value;
}
function normalizedQuantity(value,label){
  if(typeof value!=='number'||!Number.isFinite(value)||value<=0||value>100000000||Math.abs(roundQuantity(value)-value)>1e-8||roundQuantity(value)<=0)
    throw new ValidationError(label+': cantidad positiva con máximo seis decimales');
  return roundQuantity(value);
}
function normalizeTemplate(raw,{recipes,ingredients,categories}){
  if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new ValidationError('Completa los datos del producto');
  const name=String(raw.name||'').trim();
  if(!name||name.length>150)throw new ValidationError('Nombre de producto obligatorio (máximo 150 caracteres)');
  const recipeId=validId(raw.recipeId,'Masa base');
  const recipe=recipes.find(r=>r.id===recipeId);
  if(!recipe||recipe.yieldUnit!=='g')throw new ValidationError('La masa base debe ser una ficha con rendimiento en gramos (g)');
  if(typeof raw.categoryId!=='string'||!categories.some(c=>c.id===raw.categoryId))
    throw new ValidationError('Selecciona una categoría válida');
  const gramsPerPiece=intAmount(raw.gramsPerPiece,'Gramos de masa por pieza',50000);
  const input=raw.extras??[];
  if(!Array.isArray(input)||input.length>30)throw new ValidationError('Máximo 30 ingredientes extras por producto');
  const seen=new Set();
  const extras=input.map(entry=>{
    const ingredientId=validId(entry?.ingredientId,'Ingrediente extra');
    if(seen.has(ingredientId))throw new ValidationError('No repitas el mismo ingrediente extra');
    seen.add(ingredientId);
    const ingredient=ingredients.find(i=>i.id===ingredientId);
    if(!ingredient)throw new ValidationError('No se encontró un ingrediente extra del inventario');
    const qty=normalizedQuantity(entry.quantity,'Cantidad extra');
    const unit=entry.unit||ingredient.unit;
    const normalized=convertIngredientQuantity(qty,unit,ingredient.unit,ingredient.name);
    if(normalized<=0)throw new ValidationError('El ingrediente extra es demasiado pequeño para guardarse');
    return {ingredientId,quantityPerPiece:normalized};
  });
  return {name,categoryId:raw.categoryId,recipeId,gramsPerPiece,extras};
}
function validateSelection(raw,variants){
  if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new ValidationError('Elige la masa base y sus productos');
  const recipeId=validId(raw.recipeId,'Masa base');
  if(!Array.isArray(raw.items)||raw.items.length<1||raw.items.length>40)throw new ValidationError('Selecciona entre 1 y 40 productos para producir');
  const seen=new Set();
  const items=raw.items.map(item=>{
    const productId=validId(item?.productId,'Producto');
    if(seen.has(productId))throw new ValidationError('No repitas un producto en la misma tanda');
    seen.add(productId);
    const quantity=intAmount(item.quantity,'Piezas solicitadas',100000);
    const product=variants.find(v=>v.id===productId);
    if(!product||!product.active||product.recipeId!==recipeId)
      throw new ValidationError('El producto no está activo o no utiliza esta masa base',409);
    return {product,quantity};
  });
  const totalDoughGrams=items.reduce((sum,{product,quantity})=>sum+product.gramsPerPiece*quantity,0);
  if(!Number.isSafeInteger(totalDoughGrams)||totalDoughGrams>1000000000)
    throw new ValidationError('La tanda de masa no puede superar 1,000,000,000 gramos');
  return {recipeId,items,totalDoughGrams};
}
// Una sola receta de masa produce distintas piezas. No duplicamos la ficha de masa
// ni descontamos ingredientes hasta que la tanda completa se confirma.
function calculateDoughPlan(raw,recipe,variants,ingredients){
  if(!recipe||recipe.yieldUnit!=='g')throw new ValidationError('Elige una masa base con rendimiento en gramos');
  const selection=validateSelection(raw,variants);
  if(selection.recipeId!==recipe.id)throw new ValidationError('Los productos deben pertenecer a la masa seleccionada');
  const factor=selection.totalDoughGrams/recipe.baseYield;
  const byIngredient=new Map(ingredients.map(i=>[i.id,i]));
  const needs=new Map();
  function add(ingredientId,required){
    if(!byIngredient.has(ingredientId))throw new ValidationError('Falta registrar un ingrediente de esta masa o producto',409);
    if(!Number.isFinite(required)||required<=0)throw new ValidationError('Cantidad de ingrediente inválida');
    needs.set(ingredientId,(needs.get(ingredientId)||0)+required);
  }
  for(const item of recipe.items){
    add(item.ingredientId,item.quantity*factor);
  }
  const outputs=selection.items.map(({product,quantity})=>{
    for(const extra of product.extras){
      add(extra.ingredientId,extra.quantityPerPiece*quantity);
    }
    return {productId:product.id,name:product.name,quantity,gramsPerPiece:product.gramsPerPiece,
      totalGrams:quantity*product.gramsPerPiece};
  });
  const lines=[...needs].map(([ingredientId,rawRequired])=>{
    const ingredient=byIngredient.get(ingredientId);
    const required=roundQuantity(rawRequired);
    if(required<=0)throw new ValidationError('Un ingrediente se redondea a cero; ajusta el gramaje o el rendimiento');
    const stock=Number(ingredient.stock);
    const sufficient=stock+1e-9>=required;
    return {ingredientId,name:ingredient.name,unit:ingredient.unit,required,stock,sufficient,
      shortage:roundQuantity(Math.max(0,required-stock)),
      estimatedCost:Math.round(required*ingredient.costPerUnit*100)/100};
  }).sort((a,b)=>a.name.localeCompare(b.name,'es'));
  return {
    recipeId:recipe.id,recipeName:recipe.name,totalDoughGrams:selection.totalDoughGrams,
    outputs,lines,stockAvailable:lines.every(x=>x.sufficient),
    estimatedTotalCost:Math.round(lines.reduce((n,x)=>n+x.required*byIngredient.get(x.ingredientId).costPerUnit,0)*100)/100
  };
}
function dbError(error){
  if(error?.code==='ER_DUP_ENTRY')return new ValidationError('Ya existe un producto con ese nombre',409);
  if(error?.code==='ER_NO_REFERENCED_ROW_2')return new ValidationError('Alguna receta, categoría o ingrediente ya no existe',409);
  return error;
}
async function transact(pool,fn){
  const connection=await pool.getConnection();
  try{
    await connection.beginTransaction();
    const result=await fn(connection);
    await connection.commit();
    return result;
  }catch(e){try{await connection.rollback();}catch(_){}throw dbError(e);}
  finally{connection.release();}
}
const ingredientColumns='id,name,unit,cost_per_unit,stock';
const fromIngredient=r=>({id:r.id,name:r.name,unit:r.unit,costPerUnit:Number(r.cost_per_unit),stock:Number(r.stock)});
const fromVariant=r=>({id:r.id,name:r.name,categoryId:r.category_id,categoryName:r.category_name||'Sin categoría',
  recipeId:r.operational_recipe_id,recipeName:r.recipe_name,gramsPerPiece:Number(r.dough_grams_per_piece),
  active:Boolean(r.active),stock:Number(r.stock),extras:[]});
function createDoughProductsStore(pool){
  async function recipes(conn=pool){
    const [rows]=await conn.execute('SELECT id,name,base_yield,yield_unit FROM recipes WHERE yield_unit=? ORDER BY name,id',['g']);
    return rows.map(r=>({id:r.id,name:r.name,baseYield:Number(r.base_yield),yieldUnit:r.yield_unit}));
  }
  async function ingredients(conn=pool,lock=false,ids=null){
    let query='SELECT '+ingredientColumns+' FROM ingredients';
    const params=[];
    if(ids){if(!ids.length)return [];query+=' WHERE id IN ('+ids.map(()=>'?').join(',')+')';params.push(...ids);}
    query+=' ORDER BY id'+(lock?' FOR UPDATE':'');
    const [rows]=await conn.execute(query,params);
    return rows.map(fromIngredient);
  }
  async function categories(conn=pool){
    const [rows]=await conn.execute('SELECT id,name FROM finished_product_categories ORDER BY sort_order,name');
    return rows;
  }
  async function variants(conn=pool,ids=null,lock=false){
    let query='SELECT p.id,p.name,p.category_id,c.name AS category_name,p.operational_recipe_id,r.name AS recipe_name,'+
      'p.dough_grams_per_piece,p.stock,p.active FROM finished_products p '+
      'JOIN recipes r ON r.id=p.operational_recipe_id LEFT JOIN finished_product_categories c ON c.id=p.category_id '+
      'WHERE p.dough_grams_per_piece IS NOT NULL';
    const params=[];
    if(ids){if(!ids.length)return [];query+=' AND p.id IN ('+ids.map(()=>'?').join(',')+')';params.push(...ids);}
    query+=' ORDER BY p.id'+(lock?' FOR UPDATE':'');
    const [rows]=await conn.execute(query,params);
    const result=rows.map(fromVariant);
    if(result.length){
      const placeholders=result.map(()=>'?').join(',');
      const [extras]=await conn.execute('SELECT e.product_id,e.ingredient_id,e.quantity_per_piece,i.name,i.unit '+
        'FROM dough_product_extras e JOIN ingredients i ON i.id=e.ingredient_id '+
        'WHERE e.product_id IN ('+placeholders+') ORDER BY i.name,e.ingredient_id',result.map(p=>p.id));
      const map=new Map(result.map(p=>[p.id,p]));
      for(const e of extras)map.get(e.product_id)?.extras.push({
        ingredientId:e.ingredient_id,name:e.name,unit:e.unit,quantityPerPiece:Number(e.quantity_per_piece)});
    }
    return result;
  }
  async function list(){return variants();}
  async function create(raw){
    return transact(pool,async conn=>{
      const input=normalizeTemplate(raw,{
        recipes:await recipes(conn),ingredients:await ingredients(conn),categories:await categories(conn)});
      const id=crypto.randomUUID();
      await conn.execute('INSERT INTO finished_products (id,name,category_id,operational_recipe_id,dough_grams_per_piece,stock) VALUES (?,?,?,?,?,0)',
        [id,input.name,input.categoryId,input.recipeId,input.gramsPerPiece]);
      for(const e of input.extras)
        await conn.execute('INSERT INTO dough_product_extras (product_id,ingredient_id,quantity_per_piece) VALUES (?,?,?)',
          [id,e.ingredientId,e.quantityPerPiece]);
      return {id,...input,stock:0};
    });
  }
  async function update(id,raw){
    validId(id,'Producto');
    return transact(pool,async conn=>{
      const [existing]=await conn.execute('SELECT id FROM finished_products WHERE id=? AND dough_grams_per_piece IS NOT NULL FOR UPDATE',[id]);
      if(!existing.length)throw new ValidationError('No se encontró este producto de masa base',404);
      const input=normalizeTemplate(raw,{
        recipes:await recipes(conn),ingredients:await ingredients(conn),categories:await categories(conn)});
      await conn.execute('UPDATE finished_products SET name=?,category_id=?,operational_recipe_id=?,dough_grams_per_piece=? WHERE id=?',
        [input.name,input.categoryId,input.recipeId,input.gramsPerPiece,id]);
      await conn.execute('DELETE FROM dough_product_extras WHERE product_id=?',[id]);
      for(const e of input.extras)
        await conn.execute('INSERT INTO dough_product_extras (product_id,ingredient_id,quantity_per_piece) VALUES (?,?,?)',
          [id,e.ingredientId,e.quantityPerPiece]);
      return {id,...input};
    });
  }
  async function getInputs(conn,raw,lock=false){
    const recipeId=validId(raw?.recipeId,'Masa base');
    // Validar IDs y cantidades antes de crear una consulta SQL.
    if(!Array.isArray(raw?.items)||!raw.items.length||raw.items.length>40)
      throw new ValidationError('Selecciona uno o más productos para la tanda');
    const ids=raw.items.map(x=>validId(x?.productId,'Producto'));
    if(new Set(ids).size!==ids.length)throw new ValidationError('No repitas un producto en la misma tanda');
    const linked=await variants(conn,ids,lock);
    const recipeRows=await recipes(conn);
    const recipe=recipeRows.find(r=>r.id===recipeId);
    if(!recipe)throw new ValidationError('La masa base debe rendir gramos (g)');
    const [parts]=await conn.execute('SELECT ingredient_id,quantity FROM recipe_items WHERE recipe_id=? ORDER BY ingredient_id',[recipeId]);
    recipe.items=parts.map(p=>({ingredientId:p.ingredient_id,quantity:Number(p.quantity)}));
    if(!recipe.items.length)throw new ValidationError('La masa base no tiene ingredientes registrados');
    const used=[...new Set([...parts.map(i=>i.ingredient_id),...linked.flatMap(p=>p.extras.map(e=>e.ingredientId))])].sort();
    return {recipe,linked,stock:await ingredients(conn,lock,used)};
  }
  async function preview(raw){
    const {recipe,linked,stock}=await getInputs(pool,raw);
    return calculateDoughPlan(raw,recipe,linked,stock);
  }
  async function produce(raw){
    return transact(pool,async conn=>{
      const {recipe,linked,stock}=await getInputs(conn,raw,true);
      const plan=calculateDoughPlan(raw,recipe,linked,stock);
      if(!plan.stockAvailable){
        throw new ValidationError('Inventario insuficiente: '+plan.lines.filter(x=>!x.sufficient).map(x=>x.name).join(', '),409);
      }
      const batchId=crypto.randomUUID();
      await conn.execute('INSERT INTO production_batches (id,recipe_id,recipe_name,desired_yield,yield_unit,estimated_total_cost) VALUES (?,?,?,?,?,?)',
        [batchId,recipe.id,recipe.name,plan.totalDoughGrams,'g',plan.estimatedTotalCost]);
      const stockById=new Map(stock.map(i=>[i.id,i]));
      for(const line of plan.lines){
        const ingredient=stockById.get(line.ingredientId),before=ingredient.stock,after=roundQuantity(before-line.required);
        const [updated]=await conn.execute('UPDATE ingredients SET stock=? WHERE id=? AND stock>=?',
          [after,ingredient.id,line.required]);
        if(updated.affectedRows!==1)throw new ValidationError('Las existencias cambiaron; vuelve a calcular la tanda',409);
        await conn.execute("INSERT INTO inventory_movements (id,ingredient_id,movement_type,quantity,stock_before,stock_after,reason,batch_id) VALUES (?,?,'salida',?,?,?,?,?)",
          [crypto.randomUUID(),ingredient.id,line.required,before,after,'Producción de masa base '+batchId,batchId]);
        await conn.execute('INSERT INTO production_batch_items (batch_id,ingredient_id,quantity,unit_cost,estimated_cost) VALUES (?,?,?,?,?)',
          [batchId,ingredient.id,line.required,ingredient.costPerUnit,line.estimatedCost]);
      }
      const byProduct=new Map(linked.map(p=>[p.id,p]));
      const finishedProducts=[];
      for(const output of plan.outputs){
        const product=byProduct.get(output.productId),before=product.stock,after=before+output.quantity;
        if(after>100000000)throw new ValidationError('El inventario de productos terminados supera el máximo',409);
        const [updated]=await conn.execute('UPDATE finished_products SET stock=? WHERE id=? AND stock=? AND active=1',
          [after,product.id,before]);
        if(updated.affectedRows!==1)throw new ValidationError('Las existencias del producto cambiaron; vuelve a calcular',409);
        await conn.execute("INSERT INTO finished_product_movements (id,product_id,movement_type,quantity,stock_before,stock_after,reason,batch_id) VALUES (?,?,'produccion',?,?,?, ?, ?)",
          [crypto.randomUUID(),product.id,output.quantity,before,after,'Masa base: '+output.gramsPerPiece+' g por pieza',batchId]);
        await conn.execute('INSERT INTO dough_batch_outputs (batch_id,product_id,product_name,quantity,grams_per_piece,total_grams) VALUES (?,?,?,?,?,?)',
          [batchId,product.id,product.name,output.quantity,output.gramsPerPiece,output.totalGrams]);
        finishedProducts.push({...output,before,after});
      }
      return {...plan,id:batchId,finishedProducts};
    });
  }
  return {list,create,update,preview,produce};
}
module.exports={createDoughProductsStore,normalizeTemplate,calculateDoughPlan,validateSelection};
