'use strict';
// Una única receta de masa puede convertirse en varios productos de distintos gramajes.
// Los complementos son existencias reales (costra, mermelada, queso crema...),
// NO se vuelve a ejecutar su subreceta al consumirlos aquí.
const crypto=require('node:crypto');
const {ValidationError,convertIngredientQuantity}=require('./domain');
const {roundQuantity}=require('./inventory');
const UUID=/^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i;
const MAX=100000000;
const uuid=(id,label='Identificador')=>{
  if(typeof id!=='string'||!UUID.test(id))throw new ValidationError(`${label} inválido`);
  return id;
};
const positiveInt=(value,label,max=MAX)=>{
  if(typeof value!=='number'||!Number.isSafeInteger(value)||value<1||value>max)
    throw new ValidationError(`${label}: introduce un entero entre 1 y ${max}`);
  return value;
};
const positiveQuantity=(value,label)=>{
  if(typeof value!=='number'||!Number.isFinite(value)||value<=0||value>1e8||
    Math.abs(roundQuantity(value)-value)>1e-8||roundQuantity(value)<=0)
    throw new ValidationError(`${label}: cantidad positiva de máximo seis decimales`);
  return value;
};
const roundMoney=n=>Math.round((n+Number.EPSILON)*100)/100;
function validateFormat(raw,ingredients){
  if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new ValidationError('Formato inválido');
  const recipeId=uuid(raw.recipeId,'Receta base');
  const productId=uuid(raw.productId,'Producto terminado');
  const doughGrams=positiveInt(raw.doughGrams,'Gramaje de masa por pieza',1000000);
  const items=raw.extras??[];
  if(!Array.isArray(items)||items.length>30)throw new ValidationError('Demasiados complementos en el formato');
  const seen=new Set();
  const extras=items.map((item)=>{
    const ingredientId=uuid(item?.ingredientId,'Ingrediente adicional');
    if(seen.has(ingredientId))throw new ValidationError('No repitas un complemento en el mismo formato');
    seen.add(ingredientId);
    const ingredient=ingredients.find(x=>x.id===ingredientId);
    if(!ingredient)throw new ValidationError('Ingrediente adicional no registrado');
    const amount=convertIngredientQuantity(positiveQuantity(item.quantity,'Cantidad de complemento'),item.unit??ingredient.unit,ingredient.unit,ingredient.name);
    return {ingredientId,quantityPerPiece:amount};
  });
  return {recipeId,productId,doughGrams,extras};
}
function buildPlan(recipe,referenceGrams,formats,requested,ingredients){
  positiveInt(referenceGrams,'Rendimiento de la receta base en gramos');
  if(!Array.isArray(requested)||requested.length<1||requested.length>40)
    throw new ValidationError('Selecciona de uno a cuarenta formatos para producir');
  if(!recipe||!Array.isArray(recipe.items)||!recipe.items.length)
    throw new ValidationError('La receta base no tiene ingredientes');
  if(recipe.yieldUnit==='ml')throw new ValidationError('Una masa para pan debe expresarse en gramos, no en mililitros');
  if(recipe.yieldUnit==='g'&&recipe.baseYield!==referenceGrams)
    throw new ValidationError('El rendimiento de masa debe coincidir con los gramos de la ficha base');
  const list=new Map(formats.map(f=>[f.productId,f]));
  const seen=new Set(),lines=[];
  let doughGrams=0,totalPieces=0;
  for(const row of requested){
    const id=uuid(row?.productId,'Producto');
    if(seen.has(id))throw new ValidationError('No repitas un formato de pan');
    seen.add(id);
    const format=list.get(id);
    if(!format||!format.active||format.recipeId!==recipe.id)
      throw new ValidationError('El producto no tiene un formato activo de esta masa',409);
    const pieces=positiveInt(row?.pieces,'Piezas a producir',1000000);
    const total=pieces*format.doughGrams;
    if(!Number.isSafeInteger(total)||total>MAX)throw new ValidationError('La producción supera el máximo permitido');
    doughGrams+=total;totalPieces+=pieces;
    if(doughGrams>MAX||totalPieces>MAX)throw new ValidationError('La producción supera el máximo permitido');
    lines.push({productId:id,productName:format.productName,pieces,doughGramsPerPiece:format.doughGrams,doughGrams:total,
      extras:format.extras.map(e=>({...e}))});
  }
  const needed=new Map(),origins=new Map();
  const add=(ingredientId,qty,kind)=>{
    const prev=needed.get(ingredientId)||0;
    const value=roundQuantity(prev+qty);
    if(value<=0||value>1e9)throw new ValidationError('El lote tiene cantidades fuera del límite');
    needed.set(ingredientId,value);
    origins.set(ingredientId,[...new Set([...(origins.get(ingredientId)||[]),kind])]);
  };
  for(const item of recipe.items){
    let qty=roundQuantity(Number(item.quantity)*doughGrams/referenceGrams);
    if(qty<=0)throw new ValidationError('La cantidad calculada de la masa es demasiado pequeña');
    add(item.ingredientId,qty,'Masa base');
  }
  for(const line of lines){
    for(const extra of line.extras){
      const qty=roundQuantity(extra.quantityPerPiece*line.pieces);
      if(qty<=0)throw new ValidationError('Cantidad del complemento demasiado pequeña');
      add(extra.ingredientId,qty,line.productName||'Complemento');
    }
  }
  let totalCost=0;
  const consumptions=[];
  for(const [ingredientId,required] of [...needed].sort(([a],[b])=>a.localeCompare(b))){
    const ing=ingredients.find(x=>x.id===ingredientId);
    if(!ing)throw new ValidationError('No existe un ingrediente de la masa o sus complementos',409);
    const estimatedCost=roundMoney(required*ing.costPerUnit);
    totalCost+=required*ing.costPerUnit;
    consumptions.push({ingredientId,name:ing.name,unit:ing.unit,required,stock:ing.stock,
      shortage:roundQuantity(Math.max(0,required-ing.stock)),sufficient:required<=ing.stock+1e-8,
      estimatedCost,source:origins.get(ingredientId).join(' + ')});
  }
  return {recipeId:recipe.id,recipeName:recipe.name,referenceGrams,doughGrams,totalPieces,formats:lines,
    consumptions,stockAvailable:consumptions.every(x=>x.sufficient),estimatedTotalCost:roundMoney(totalCost)};
}
function createDoughFormatStore(pool){
  async function list(){
    const [bases]=await pool.execute(`SELECT d.recipe_id,d.reference_dough_grams,r.name AS recipe_name,r.base_yield,r.yield_unit
      FROM dough_recipe_yields d JOIN recipes r ON r.id=d.recipe_id ORDER BY r.name`);
    const [formats]=await pool.execute(`SELECT f.product_id,f.recipe_id,f.dough_grams_per_piece,f.active,p.name AS product_name
      FROM dough_product_formats f JOIN finished_products p ON p.id=f.product_id ORDER BY p.name`);
    const [extras]=await pool.execute(`SELECT e.product_id,e.ingredient_id,e.quantity_per_piece,i.name,i.unit
      FROM dough_product_extras e JOIN ingredients i ON i.id=e.ingredient_id ORDER BY i.name`);
    return {bases:bases.map(b=>({recipeId:b.recipe_id,recipeName:b.recipe_name,referenceGrams:Number(b.reference_dough_grams),yieldUnit:b.yield_unit,baseYield:Number(b.base_yield)})),
      formats:formats.map(f=>({recipeId:f.recipe_id,productId:f.product_id,productName:f.product_name,doughGrams:Number(f.dough_grams_per_piece),active:!!f.active,
        extras:extras.filter(e=>e.product_id===f.product_id).map(e=>({ingredientId:e.ingredient_id,name:e.name,unit:e.unit,quantityPerPiece:Number(e.quantity_per_piece)}))}))};
  }
  async function setBase(raw){
    const recipeId=uuid(raw?.recipeId,'Receta base');
    const referenceGrams=positiveInt(raw?.referenceGrams,'Rendimiento de la receta en gramos');
    const [rows]=await pool.execute('SELECT id,base_yield,yield_unit FROM recipes WHERE id=?',[recipeId]);
    if(!rows.length)throw new ValidationError('La receta base no existe',404);
    if(rows[0].yield_unit==='ml')throw new ValidationError('Una masa para pan no puede tener rendimiento líquido');
    if(rows[0].yield_unit==='g'&&Number(rows[0].base_yield)!==referenceGrams)
      throw new ValidationError('El rendimiento debe coincidir con el de la ficha técnica (g)');
    await pool.execute(`INSERT INTO dough_recipe_yields (recipe_id,reference_dough_grams) VALUES (?,?)
      ON DUPLICATE KEY UPDATE reference_dough_grams=VALUES(reference_dough_grams)`,[recipeId,referenceGrams]);
    return {recipeId,referenceGrams};
  }
  async function setFormat(raw){
    const [ings]=await pool.execute('SELECT id,name,unit,cost_per_unit,stock FROM ingredients ORDER BY id');
    const ing=ings.map(i=>({id:i.id,name:i.name,unit:i.unit,costPerUnit:Number(i.cost_per_unit),stock:Number(i.stock)}));
    const format=validateFormat(raw,ing);
    const conn=await pool.getConnection();
    try{
      await conn.beginTransaction();
      const [base]=await conn.execute('SELECT recipe_id FROM dough_recipe_yields WHERE recipe_id=?',[format.recipeId]);
      if(!base.length)throw new ValidationError('Configura primero los gramos totales de la receta base',409);
      const [prod]=await conn.execute('SELECT id,name,active,operational_recipe_id FROM finished_products WHERE id=? FOR UPDATE',[format.productId]);
      if(!prod.length||!prod[0].active)throw new ValidationError('El producto no existe o está inactivo',409);
      if(prod[0].operational_recipe_id&&prod[0].operational_recipe_id!==format.recipeId)
        throw new ValidationError('Este producto ya está vinculado a otra receta operativa',409);
      await conn.execute(`INSERT INTO dough_product_formats (product_id,recipe_id,dough_grams_per_piece,active) VALUES (?,?,?,1)
        ON DUPLICATE KEY UPDATE recipe_id=VALUES(recipe_id),dough_grams_per_piece=VALUES(dough_grams_per_piece),active=1`,
        [format.productId,format.recipeId,format.doughGrams]);
      await conn.execute('DELETE FROM dough_product_extras WHERE product_id=?',[format.productId]);
      for(const extra of format.extras)
        await conn.execute('INSERT INTO dough_product_extras (product_id,ingredient_id,quantity_per_piece) VALUES (?,?,?)',
          [format.productId,extra.ingredientId,extra.quantityPerPiece]);
      await conn.commit();
      return {productId:format.productId,recipeId:format.recipeId,doughGrams:format.doughGrams,extras:format.extras};
    }catch(err){await conn.rollback();throw err;}finally{conn.release();}
  }
  // Crear un producto directamente desde la receta base.
  // Producto y formato se guardan en una unica transaccion.
  async function createProduct(raw){
    const name=raw?.name;
    if(typeof name!=='string'||!name.trim()||name.trim().length>150)
      throw new ValidationError('Nombre de producto obligatorio (maximo 150 caracteres)');
    const productId=crypto.randomUUID();
    const [ings]=await pool.execute('SELECT id,name,unit,cost_per_unit,stock FROM ingredients ORDER BY id');
    const ingredients=ings.map(i=>({id:i.id,name:i.name,unit:i.unit,costPerUnit:Number(i.cost_per_unit),stock:Number(i.stock)}));
    const format=validateFormat({...raw,productId},ingredients);
    const conn=await pool.getConnection();
    try{
      await conn.beginTransaction();
      const [base]=await conn.execute('SELECT recipe_id FROM dough_recipe_yields WHERE recipe_id=?',[format.recipeId]);
      if(!base.length)throw new ValidationError('Configura primero los gramos que rinde la masa base',409);
      const [categories]=await conn.execute("SELECT id FROM finished_product_categories WHERE id='brioche'");
      const category=categories.length?'brioche':null;
      await conn.execute('INSERT INTO finished_products (id,name,category_id,operational_recipe_id) VALUES (?,?,?,?)',
        [productId,name.trim(),category,format.recipeId]);
      await conn.execute('INSERT INTO dough_product_formats (product_id,recipe_id,dough_grams_per_piece,active) VALUES (?,?,?,1)',
        [productId,format.recipeId,format.doughGrams]);
      for(const extra of format.extras)
        await conn.execute('INSERT INTO dough_product_extras (product_id,ingredient_id,quantity_per_piece) VALUES (?,?,?)',
          [productId,extra.ingredientId,extra.quantityPerPiece]);
      await conn.commit();
      return {id:productId,name:name.trim(),recipeId:format.recipeId,doughGrams:format.doughGrams,extras:format.extras,stock:0};
    }catch(err){
      await conn.rollback();
      if(err?.code==='ER_DUP_ENTRY')throw new ValidationError('Ya existe un producto con ese nombre; puedes editar su formato existente',409);
      throw err;
    }finally{conn.release()}
  }
  async function getPlan(input,conn=pool,locked=false){
    const recipeId=uuid(input?.recipeId,'Receta base');
    const requested=input?.formats;
    // Leer configuraciones y la receta dentro de la misma transacción de confirmación.
    const [baseRows]=await conn.execute('SELECT reference_dough_grams FROM dough_recipe_yields WHERE recipe_id=?',[recipeId]);
    if(!baseRows.length)throw new ValidationError('Esta receta aún no tiene rendimiento en gramos configurado',409);
    const [recipeRows]=await conn.execute('SELECT id,name,base_yield,yield_unit FROM recipes WHERE id=?',[recipeId]);
    if(!recipeRows.length)throw new ValidationError('Receta base no encontrada',404);
    const [items]=await conn.execute('SELECT ingredient_id,quantity FROM recipe_items WHERE recipe_id=? ORDER BY ingredient_id',[recipeId]);
    const recipe={id:recipeId,name:recipeRows[0].name,baseYield:Number(recipeRows[0].base_yield),yieldUnit:recipeRows[0].yield_unit,
      items:items.map(i=>({ingredientId:i.ingredient_id,quantity:Number(i.quantity)}))};
    const [rows]=await conn.execute(`SELECT f.product_id,f.recipe_id,f.dough_grams_per_piece,f.active,p.name AS product_name
      FROM dough_product_formats f JOIN finished_products p ON p.id=f.product_id
      WHERE f.recipe_id=? ORDER BY f.product_id`,[recipeId]);
    const [extraRows]=await conn.execute(`SELECT e.product_id,e.ingredient_id,e.quantity_per_piece
      FROM dough_product_extras e JOIN dough_product_formats f ON f.product_id=e.product_id
      WHERE f.recipe_id=? ORDER BY e.product_id,e.ingredient_id`,[recipeId]);
    const formats=rows.map(r=>({recipeId:r.recipe_id,productId:r.product_id,productName:r.product_name,doughGrams:Number(r.dough_grams_per_piece),active:!!r.active,
      extras:extraRows.filter(e=>e.product_id===r.product_id).map(e=>({ingredientId:e.ingredient_id,quantityPerPiece:Number(e.quantity_per_piece)}))}));
    // Bloqueo estable de las existencias de ingredientes, en confirmación exclusivamente.
    const idSet=new Set([...recipe.items.map(i=>i.ingredientId),...extraRows.map(e=>e.ingredient_id)]);
    const ingredients=[];
    for(const id of [...idSet].sort()){
      const sql='SELECT id,name,unit,cost_per_unit,stock FROM ingredients WHERE id=?'+(locked?' FOR UPDATE':'');
      const [ings]=await conn.execute(sql,[id]);
      if(!ings.length)throw new ValidationError('Ingrediente del formato eliminado',409);
      ingredients.push({id:ings[0].id,name:ings[0].name,unit:ings[0].unit,costPerUnit:Number(ings[0].cost_per_unit),stock:Number(ings[0].stock)});
    }
    return {plan:buildPlan(recipe,Number(baseRows[0].reference_dough_grams),formats,requested,ingredients),ingredients};
  }
  async function preview(raw){return (await getPlan(raw)).plan;}
  async function confirm(raw){
    const conn=await pool.getConnection();
    try{
      await conn.beginTransaction();
      const {plan,ingredients}=await getPlan(raw,conn,true);
      if(!plan.stockAvailable)throw new ValidationError('Faltan ingredientes: '+plan.consumptions.filter(x=>!x.sufficient).map(x=>x.name).join(', '),409);
      // Bloquear todos los productos en orden estable, revalidar vinculación y stock.
      const finished=[];
      for(const item of [...plan.formats].sort((a,b)=>a.productId.localeCompare(b.productId))){
        const [p]=await conn.execute('SELECT id,name,stock,active,operational_recipe_id FROM finished_products WHERE id=? FOR UPDATE',[item.productId]);
        if(!p.length||!p[0].active||(p[0].operational_recipe_id&&p[0].operational_recipe_id!==plan.recipeId))
          throw new ValidationError('Un producto cambió de estado o de receta. Revisa el lote.',409);
        const before=Number(p[0].stock),after=before+item.pieces;
        if(!Number.isSafeInteger(after)||after>MAX)throw new ValidationError('Inventario terminado supera el máximo',409);
        finished.push({...item,productName:p[0].name,before,after});
      }
      const batchId=crypto.randomUUID();
      await conn.execute('INSERT INTO production_batches (id,recipe_id,recipe_name,desired_yield,yield_unit,estimated_total_cost) VALUES (?,?,?,?,?,?)',
        [batchId,plan.recipeId,plan.recipeName,plan.doughGrams,'g',plan.estimatedTotalCost]);
      for(const line of plan.consumptions){
        const ingredient=ingredients.find(i=>i.id===line.ingredientId),before=ingredient.stock,after=roundQuantity(before-line.required);
        const [updated]=await conn.execute('UPDATE ingredients SET stock=? WHERE id=? AND stock>=?',
          [after,line.ingredientId,line.required]);
        if(updated.affectedRows!==1)throw new ValidationError('El inventario cambió antes de confirmar',409);
        await conn.execute(`INSERT INTO inventory_movements (id,ingredient_id,movement_type,quantity,stock_before,stock_after,reason,batch_id)
          VALUES (?,?,'salida',?,?,?,?,?)`,[crypto.randomUUID(),line.ingredientId,line.required,before,after,`Lote por formatos ${batchId}`,batchId]);
        await conn.execute('INSERT INTO production_batch_items (batch_id,ingredient_id,quantity,unit_cost,estimated_cost) VALUES (?,?,?,?,?)',
          [batchId,line.ingredientId,line.required,ingredient.costPerUnit,line.estimatedCost]);
      }
      for(const item of finished){
        await conn.execute('UPDATE finished_products SET stock=? WHERE id=?',[item.after,item.productId]);
        await conn.execute(`INSERT INTO finished_product_movements (id,product_id,movement_type,quantity,stock_before,stock_after,reason,batch_id)
          VALUES (?,?,'produccion',?,?,?,?,?)`,[crypto.randomUUID(),item.productId,item.pieces,item.before,item.after,'Lote de masa compartida',batchId]);
        await conn.execute(`INSERT INTO production_batch_formats (batch_id,product_id,product_name,pieces,dough_grams_per_piece,dough_total_grams)
          VALUES (?,?,?,?,?,?)`,[batchId,item.productId,item.productName,item.pieces,item.doughGramsPerPiece,item.doughGrams]);
      }
      await conn.commit();
      return {id:batchId,recipeId:plan.recipeId,recipeName:plan.recipeName,doughGrams:plan.doughGrams,totalPieces:plan.totalPieces,
        finishedProducts:finished.map(x=>({id:x.productId,name:x.productName,quantity:x.pieces,before:x.before,after:x.after})),
        estimatedTotalCost:plan.estimatedTotalCost};
    }catch(err){await conn.rollback();throw err;}finally{conn.release();}
  }
  return {list,setBase,setFormat,createProduct,preview,confirm};
}
module.exports={createDoughFormatStore,validateFormat,buildPlan,positiveInt};
