'use strict';
const {ValidationError,convertQuantity,convertIngredientQuantity,validateRecipe,validateIngredient} = require('./domain');

// 'base_yield' del sistema actual representa unidades enteras de producción,
// no gramos de masa ni peso final. No inventar unidades a partir de pesos.
const PIECE_YIELD_UNITS = new Set(['pieza','piezas','panes','hogazas','baguettes','panques','panqués','bollos','galletas','unidades','porciones','croissants','rollos']);
const INGREDIENT_UNITS = new Set(['g','kg','ml','l','pieza']);
const normalized = value => String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().replace(/\s+/g,' ').toLocaleLowerCase('es');
const compatible = (a,b,name) => {
  try{convertIngredientQuantity(1,a,b,name);return true;}catch(_){return false;}
};

function planCatalogRecipe(raw, requestedYield=null){
  const issues=[];
  if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new ValidationError('Receta original inválida');
  const name=raw.nombre;
  if(typeof name!=='string'||!name.trim()||name.trim().length>100)issues.push('Nombre de receta inválido');
  if(raw.estado!=='confirmada')issues.push('La fórmula aún está pendiente de validación');
  if(Array.isArray(raw.componentes)&&raw.componentes.length)
    issues.push('Contiene subpreparaciones: comprueba sus cantidades antes de crear la ficha');
  const sourceYield=raw.rendimiento||{};
  const knownYield=PIECE_YIELD_UNITS.has(normalized(sourceYield.unidad))&&Number.isInteger(sourceYield.cantidad)&&sourceYield.cantidad>0;
  let baseYield=knownYield?sourceYield.cantidad:null;
  if(requestedYield!==null&&requestedYield!==undefined){
    if(!Number.isSafeInteger(requestedYield)||requestedYield<1||requestedYield>1e9)
      issues.push('El rendimiento en piezas debe ser un entero positivo');
    else if(knownYield&&baseYield!==requestedYield)
      issues.push('El rendimiento base ya está confirmado en la receta original');
    else baseYield=requestedYield;
  }
  if(!baseYield)issues.push('Indica cuántas piezas completas se obtienen de este lote: el peso de masa no es el número de piezas');
  const sourceItems=Array.isArray(raw.ingredientes)?raw.ingredientes:[];
  if(!sourceItems.length||sourceItems.length>100)issues.push('Ingredientes incompletos o demasiados');
  const items=[];
  for(let i=0;i<sourceItems.length;i++){
    const x=sourceItems[i]||{};
    if(!x.ingrediente||typeof x.ingrediente!=='string'||!x.ingrediente.trim()||x.ingrediente.trim().length>100){issues.push(`Ingrediente ${i+1}: nombre pendiente`);continue;}
    if(!INGREDIENT_UNITS.has(x.unidad)){issues.push(`${x.ingrediente}: unidad ${x.unidad||'sin definir'} por convertir`);continue;}
    if(typeof x.cantidad!=='number'||!Number.isFinite(x.cantidad)||x.cantidad<=0){issues.push(`${x.ingrediente}: cantidad exacta pendiente`);continue;}
    try{convertQuantity(x.cantidad,x.unidad,x.unidad);}catch(e){issues.push(`${x.ingrediente}: ${e.message}`);continue;}
    items.push({name:x.ingrediente.trim(),quantity:x.cantidad,unit:x.unidad});
  }
  return {name:typeof name==='string'?name.trim():'',baseYield,needsPieceYield:!knownYield,
    items,issues,ready:issues.length===0};
}

// Una sola transacción. Las recetas importadas no descuentan inventario.
// Todo ingrediente nuevo nace con stock y costo 0; nunca inventar existencias.
async function promoteCatalogRecipe(pool,source,requestedYield=null){
  const plan=planCatalogRecipe(source,requestedYield);
  if(!plan.ready)throw new ValidationError('No se puede crear la ficha: '+plan.issues.join('; '),409);
  const crypto=require('node:crypto');
  const conn=await pool.getConnection();
  try{
    await conn.beginTransaction();
    const [existingRecipes]=await conn.execute('SELECT id FROM recipes WHERE name=? LIMIT 1',[plan.name]);
    if(existingRecipes.length){
      await conn.commit();
      return {id:existingRecipes[0].id,name:plan.name,existing:true,createdIngredients:[]};
    }
    const [rows]=await conn.execute('SELECT id,name,unit,cost_per_unit,stock FROM ingredients ORDER BY id FOR UPDATE');
    const ingredients=rows.map(row=>({id:row.id,name:row.name,unit:row.unit,costPerUnit:Number(row.cost_per_unit),stock:Number(row.stock)}));
    const createdIngredients=[];
    const grouped=new Map();
    for(const item of plan.items){
      const matches=ingredients.filter(x=>normalized(x.name)===normalized(item.name));
      let ingredient=matches.find(x=>x.unit===item.unit)||matches.find(x=>compatible(x.unit,item.unit,item.name));
      if(!ingredient&&matches.length)throw new ValidationError(`No existe una equivalencia segura entre la unidad de ${item.name} en la receta y la unidad del ingrediente registrado`,409);
      if(!ingredient){
        ingredient={id:crypto.randomUUID(),name:item.name,unit:item.unit,costPerUnit:0,stock:0};
        validateIngredient(ingredient);
        await conn.execute('INSERT INTO ingredients (id,name,unit,cost_per_unit,stock) VALUES (?,?,?,?,?)',
          [ingredient.id,ingredient.name,ingredient.unit,0,0]);
        ingredients.push(ingredient);createdIngredients.push({name:ingredient.name,unit:ingredient.unit});
      }
      const quantity=convertIngredientQuantity(item.quantity,item.unit,ingredient.unit,ingredient.name);
      const previous=grouped.get(ingredient.id)||0;
      const total=Math.round((previous+quantity)*1e6)/1e6;
      if(total<=0||total>1e9)throw new ValidationError(`Cantidad demasiado grande de ${ingredient.name}`);
      grouped.set(ingredient.id,total);
    }
    const recipe=validateRecipe({name:plan.name,baseYield:plan.baseYield,
      items:[...grouped].map(([ingredientId,quantity])=>({ingredientId,quantity}))},ingredients);
    const id=crypto.randomUUID();
    await conn.execute('INSERT INTO recipes (id,name,base_yield) VALUES (?,?,?)',[id,recipe.name,recipe.baseYield]);
    for(const item of recipe.items)
      await conn.execute('INSERT INTO recipe_items (recipe_id,ingredient_id,quantity) VALUES (?,?,?)',
        [id,item.ingredientId,item.quantity]);
    await conn.commit();
    return {id,name:recipe.name,baseYield:recipe.baseYield,existing:false,createdIngredients};
  }catch(error){try{await conn.rollback();}catch(_){};throw error;}
  finally{conn.release();}
}
module.exports={planCatalogRecipe,promoteCatalogRecipe};
