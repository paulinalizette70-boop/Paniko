'use strict';
const {ValidationError,convertQuantity,convertIngredientQuantity,validateRecipe,validateIngredient} = require('./domain');

// 'base_yield' del sistema actual representa unidades enteras de producción,
// no gramos de masa ni peso final. No inventar unidades a partir de pesos.
const PIECE_YIELD_UNITS = new Set(['pieza','piezas','panes','hogazas','baguettes','panques','panqués','bollos','galletas','unidades','porciones','croissants','rollos']);
const INGREDIENT_UNITS = new Set(['g','kg','ml','l','pieza']);
const MASS_YIELD_UNITS={g:['g',1],gramo:['g',1],gramos:['g',1],kg:['g',1000],kilogramo:['g',1000],kilogramos:['g',1000],ml:['ml',1],mililitros:['ml',1],l:['ml',1000],litro:['ml',1000],litros:['ml',1000]};
const normalized = value => String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().replace(/\s+/g,' ').toLocaleLowerCase('es');
const compatible = (a,b,name) => {
  try{convertIngredientQuantity(1,a,b,name);return true;}catch(_){return false;}
};

function planCatalogRecipe(raw, requestedYield=null, requestedUnit=null){
  const issues=[];
  if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new ValidationError('Receta original inválida');
  const name=raw.nombre;
  if(typeof name!=='string'||!name.trim()||name.trim().length>100)issues.push('Nombre de receta inválido');
  if(raw.estado!=='confirmada')issues.push('La fórmula aún está pendiente de validación');
  if(Array.isArray(raw.componentes)&&raw.componentes.length)
    issues.push('Contiene subpreparaciones: comprueba sus cantidades antes de crear la ficha');
  const sourceYield=raw.rendimiento||{};
  const sourceUnit=normalized(sourceYield.unidad);
  const hasPieces=PIECE_YIELD_UNITS.has(sourceUnit);
  const mass=MASS_YIELD_UNITS[sourceUnit];
  const yieldUnit=mass?mass[0]:hasPieces?'pieza':(['pieza','g','ml'].includes(requestedUnit)?requestedUnit:'pieza');
  if(requestedUnit!==null&&requestedUnit!==yieldUnit)issues.push('La unidad solicitada no coincide con el rendimiento original');
  const knownYield=Boolean(hasPieces||mass)&&Number.isFinite(sourceYield.cantidad)&&sourceYield.cantidad>0&&
    Number.isSafeInteger(sourceYield.cantidad*(mass?mass[1]:1));
  let baseYield=knownYield?sourceYield.cantidad*(mass?mass[1]:1):null;
  if(requestedYield!==null&&requestedYield!==undefined){
    if(!Number.isSafeInteger(requestedYield)||requestedYield<1||requestedYield>1e9)
      issues.push('El rendimiento debe ser un entero positivo (piezas, g o ml)');
    else if(knownYield&&baseYield!==requestedYield)
      issues.push('El rendimiento base ya está confirmado en la receta original');
    else baseYield=requestedYield;
  }
  if(!baseYield)issues.push('Confirma el rendimiento del lote en piezas, g, kg, ml o l; no se puede inferir del peso de los ingredientes');
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
  return {name:typeof name==='string'?name.trim():'',baseYield,yieldUnit,needsPieceYield:!knownYield,
    items,issues,ready:issues.length===0};
}

// Una sola transacción. Las recetas importadas no descuentan inventario.
// Todo ingrediente nuevo nace con stock y costo 0; nunca inventar existencias.
async function promoteCatalogRecipe(pool,source,requestedYield=null,requestedUnit=null){
  const plan=planCatalogRecipe(source,requestedYield,requestedUnit);
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
    const recipe=validateRecipe({name:plan.name,baseYield:plan.baseYield,yieldUnit:plan.yieldUnit,
      items:[...grouped].map(([ingredientId,quantity])=>({ingredientId,quantity}))},ingredients);
    const id=crypto.randomUUID();
    await conn.execute('INSERT INTO recipes (id,name,base_yield,yield_unit) VALUES (?,?,?,?)',[id,recipe.name,recipe.baseYield,recipe.yieldUnit]);
    for(const item of recipe.items)
      await conn.execute('INSERT INTO recipe_items (recipe_id,ingredient_id,quantity) VALUES (?,?,?)',
        [id,item.ingredientId,item.quantity]);
    await conn.commit();
    return {id,name:recipe.name,baseYield:recipe.baseYield,yieldUnit:recipe.yieldUnit,existing:false,createdIngredients};
  }catch(error){try{await conn.rollback();}catch(_){};throw error;}
  finally{conn.release();}
}
module.exports={planCatalogRecipe,promoteCatalogRecipe};
