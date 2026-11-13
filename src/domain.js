'use strict';

const UNITS = ['g', 'kg', 'ml', 'l', 'pieza'];

class ValidationError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = 'ValidationError';
    this.status = status;
  }
}

function textField(value, label) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 100) {
    throw new ValidationError(`${label}: texto obligatorio de máximo 100 caracteres`);
  }
  return value.trim();
}

function numberField(value, label, {positive = false, integer = false} = {}) {
  if (typeof value !== 'number' || !Number.isFinite(value) ||
      (positive ? value <= 0 : value < 0) || (integer && !Number.isInteger(value)) || value > 1e9) {
    throw new ValidationError(`${label}: número ${positive ? 'mayor que cero' : 'no negativo'} válido`);
  }
  return value;
}


const UNIT_FACTORS = Object.freeze({g:1,kg:1000,ml:1,l:1000,pieza:1});
function convertQuantity(quantity, sourceUnit, targetUnit) {
  numberField(quantity,'Cantidad',{positive:true});
  if (!UNITS.includes(sourceUnit) || !UNITS.includes(targetUnit)) throw new ValidationError('Unidad no permitida');
  const compatible=(sourceUnit===targetUnit) ||
    (['g','kg'].includes(sourceUnit) && ['g','kg'].includes(targetUnit)) ||
    (['ml','l'].includes(sourceUnit) && ['ml','l'].includes(targetUnit));
  if (!compatible) throw new ValidationError('Unidades incompatibles');
  const value=quantity * UNIT_FACTORS[sourceUnit] / UNIT_FACTORS[targetUnit];
  const rounded=Math.round(value*1e6)/1e6;
  if (!Number.isFinite(value) || rounded<=0 || value>1e9 ||
      Math.abs(value-rounded)>1e-10 ||
      Math.abs(quantity-Math.round(quantity*1e6)/1e6)>1e-10)
    throw new ValidationError('Cantidad fuera de precisión máxima de 6 decimales');
  return rounded;
}


// Equivalencias de trabajo declaradas por la panadería: 1 huevo = 50 g sin cáscara.
// Para Agua, 1 g ≈ 1 ml; para leche líquida de vaca 1 ml ≈ 1.03 g.
// Esta densidad de leche es una aproximación culinaria, no sirve para leche en polvo/condensada/evaporada.
const EGG_GRAMS_PER_PIECE = 50;
const MILK_GRAMS_PER_ML = 1.03;
function ingredientKind(name) {
  const key=String(name||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase().replace(/\s+/g,' ');
  if (/^huevos?(?: (?:grandes?|medianos?|chicos?|enteros?))?$/.test(key)) return 'egg';
  if (/^agua(?: (?:potable|purificada|filtrada))?$/.test(key)) return 'water';
  if (/^leche(?: (?:entera|tibia|fria|liquida|fresca|pasteurizada|deslactosada|descremada|semidescremada|de vaca|sin lactosa))*$/.test(key)) return 'milk';
  return null;
}
function convertIngredientQuantity(quantity,sourceUnit,targetUnit,ingredientName){
  if (!UNITS.includes(sourceUnit) || !UNITS.includes(targetUnit)) throw new ValidationError('Unidad no permitida');
  const standard=(sourceUnit===targetUnit) ||
    (['g','kg'].includes(sourceUnit)&&['g','kg'].includes(targetUnit)) ||
    (['ml','l'].includes(sourceUnit)&&['ml','l'].includes(targetUnit));
  if(standard) return convertQuantity(quantity,sourceUnit,targetUnit);
  const kind=ingredientKind(ingredientName);
  const eggUnits=['pieza','g','kg'];
  const waterUnits=['g','kg','ml','l'];
  let factors;
  if(kind==='egg'&&eggUnits.includes(sourceUnit)&&eggUnits.includes(targetUnit))
    factors={g:1,kg:1000,pieza:EGG_GRAMS_PER_PIECE};
  else if(kind==='water'&&waterUnits.includes(sourceUnit)&&waterUnits.includes(targetUnit))
    factors={g:1,kg:1000,ml:1,l:1000};
  else if(kind==='milk'&&waterUnits.includes(sourceUnit)&&waterUnits.includes(targetUnit))
    factors={g:1,kg:1000,ml:MILK_GRAMS_PER_ML,l:1000*MILK_GRAMS_PER_ML};
  else throw new ValidationError(`Unidades incompatibles: no hay equivalencia de ${sourceUnit} a ${targetUnit} para ${ingredientName||'este ingrediente'}`);
  numberField(quantity,'Cantidad',{positive:true});
  const raw=quantity*factors[sourceUnit]/factors[targetUnit];
  const rounded=Math.round(raw*1e6)/1e6;
  // La densidad de leche produce cocientes decimales no terminantes: redondear SOLO la salida
  // a 6 decimales, sin aceptar entradas con más precisión ni cantidades que redondeen a cero.
  if(!Number.isFinite(raw)||raw>1e9||rounded<=0||
     (kind!=='milk'&&Math.abs(raw-rounded)>1e-10)||Math.abs(quantity-Math.round(quantity*1e6)/1e6)>1e-10)
    throw new ValidationError('Cantidad fuera de precisión máxima de 6 decimales');
  return rounded;
}

function validateIngredient(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new ValidationError('Ingrediente inválido');
  const name = textField(raw.name, 'Nombre');
  const unit = raw.unit;
  if (!UNITS.includes(unit)) throw new ValidationError('Unidad no permitida (g, kg, ml, l, pieza)');
  const costPerUnit = numberField(raw.costPerUnit, 'Costo por unidad');
  const stock = numberField(raw.stock, 'Existencia');
  if (Math.abs(costPerUnit - Math.round(costPerUnit * 10000) / 10000) > 1e-10) throw new ValidationError('Costo: máximo 4 decimales');
  if (Math.abs(stock - Math.round(stock * 1e6) / 1e6) > 1e-10) throw new ValidationError('Existencia: máximo 6 decimales');
  return {name, unit, costPerUnit, stock};
}

function validateRecipe(raw, ingredients) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new ValidationError('Receta inválida');
  const name = textField(raw.name, 'Nombre de receta');
  const baseYield = numberField(raw.baseYield, 'Rendimiento base', {positive: true, integer: true});
  const yieldUnit = raw.yieldUnit ?? 'pieza';
  if(!['pieza','g','ml'].includes(yieldUnit))throw new ValidationError('El rendimiento debe expresarse en piezas, gramos o mililitros');
  if (!Array.isArray(raw.items) || !raw.items.length || raw.items.length > 100) {
    throw new ValidationError('Agrega al menos un ingrediente a la receta');
  }
  const seen = new Set();
  const items = raw.items.map((item) => {
    if (!item || typeof item.ingredientId !== 'string') throw new ValidationError('Ingrediente de receta inválido');
    if (seen.has(item.ingredientId)) throw new ValidationError('No repitas un ingrediente en la receta');
    seen.add(item.ingredientId);
    const ingredient=ingredients.find(i=>i.id===item.ingredientId);
    if(!ingredient)throw new ValidationError('La receta contiene un ingrediente que no existe');
    const quantity=convertIngredientQuantity(item.quantity,item.unit ?? ingredient.unit,ingredient.unit,ingredient.name);
    return {ingredientId:item.ingredientId,quantity};
  });
  return {name, baseYield, yieldUnit, items};
}


// Porcentaje panadero: las harinas suman el 100 % del peso de referencia.
// No depende de inventario. Las unidades volumétricas no se convierten a masa
// salvo Agua (1 ml ≈ 1 g) y Huevo (1 pieza = 50 g sin cáscara).
function isFlour(name) {
  const normalized=String(name||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
  return /^harinas?(?:\s|$)/.test(normalized);
}
function weightInGrams(quantity,unit,name){
  if(!Number.isFinite(quantity)||quantity<=0)return null;
  if(unit==='g')return quantity;
  if(unit==='kg')return quantity*1000;
  const kind=ingredientKind(name);
  if(kind==='water'&&unit==='ml')return quantity;
  if(kind==='water'&&unit==='l')return quantity*1000;
  if(kind==='milk'&&unit==='ml')return quantity*MILK_GRAMS_PER_ML;
  if(kind==='milk'&&unit==='l')return quantity*1000*MILK_GRAMS_PER_ML;
  if(kind==='egg'&&unit==='pieza')return quantity*EGG_GRAMS_PER_PIECE;
  return null;
}
function bakerPercentages(recipe,ingredients){
  const rows=recipe.items.map(item=>{
    const ingredient=ingredients.find(i=>i.id===item.ingredientId);
    if(!ingredient)throw new ValidationError('Ingrediente de receta no encontrado',409);
    return {ingredientId:ingredient.id,name:ingredient.name,
      quantity:item.quantity,unit:ingredient.unit,
      weightGrams:weightInGrams(item.quantity,ingredient.unit,ingredient.name),
      isFlour:isFlour(ingredient.name)};
  });
  const flourRows=rows.filter(x=>x.isFlour);
  // Si alguna harina carece de peso, NO mostrar porcentajes incorrectos.
  const hasValidFlour=flourRows.length>0 && flourRows.every(x=>x.weightGrams!==null);
  const totalFlourGrams=hasValidFlour?flourRows.reduce((sum,x)=>sum+x.weightGrams,0):0;
  const available=hasValidFlour&&Number.isFinite(totalFlourGrams)&&totalFlourGrams>0;
  return {
    available,totalFlourGrams:available?Math.round(totalFlourGrams*1e6)/1e6:null,
    note:available?'Las harinas de esta ficha suman 100 %. No incluye la harina interna de masas madre o prefermentos.':
      'No se puede calcular: la ficha necesita al menos una harina con peso en g o kg.',
    lines:rows.map(row=>({...row,
      percentage:available&&row.weightGrams!==null
        ?Math.round(row.weightGrams/totalFlourGrams*100*100)/100:null
    }))
  };
}

function money(value) { return Math.round((value + Number.EPSILON) * 100) / 100; }

function maximumProducible(recipe, ingredients) {
  // El inventario y las recetas se guardan con seis decimales.
  // BigInt evita los errores de punto flotante al dividir existencias.
  let maximum=1_000_000_000n;
  let limiting=[];
  for (const item of recipe.items) {
    const ingredient=ingredients.find(i=>i.id===item.ingredientId);
    if(!ingredient)throw new ValidationError('Ingrediente de receta no encontrado',409);
    const available=BigInt(Math.round(ingredient.stock*1_000_000));
    const perBatch=BigInt(Math.round(item.quantity*1_000_000));
    if(perBatch<=0n)throw new ValidationError('Cantidad de ingrediente inválida en la receta',409);
    const possible=(available*BigInt(recipe.baseYield))/perBatch;
    if(possible<maximum){maximum=possible;limiting=[ingredient.name];}
    else if(possible===maximum)limiting.push(ingredient.name);
  }
  return {maximum:Number(maximum), limitingIngredients:limiting};
}

function scaleRecipe(recipe, ingredients, desiredYield) {
  numberField(desiredYield, 'Producción solicitada', {positive: true, integer: true});
  const factor = desiredYield / recipe.baseYield;
  const capacity=maximumProducible(recipe,ingredients);
  const bakers=bakerPercentages(recipe,ingredients);
  const byIngredient=new Map(bakers.lines.map(line=>[line.ingredientId,line]));
  const lines = recipe.items.map(({ingredientId, quantity}) => {
    const ingredient = ingredients.find((i) => i.id === ingredientId);
    if (!ingredient) throw new ValidationError('Ingrediente de receta no encontrado', 409);
    const required = Math.round(quantity * factor * 1000000) / 1000000;
    return {
      ingredientId,
      name: ingredient.name,
      unit: ingredient.unit,
      required,
      stock: ingredient.stock,
      sufficient: ingredient.stock + 1e-9 >= required,
      shortage: Math.round(Math.max(0,required-ingredient.stock)*1_000_000)/1_000_000,
      estimatedCost: money(required * ingredient.costPerUnit),
      bakerPercentage: byIngredient.get(ingredientId)?.percentage ?? null,
    };
  });
  return {
    recipeId: recipe.id,
    recipeName: recipe.name,
    desiredYield,
    yieldUnit:recipe.yieldUnit||'pieza',
    factor,
    bakers,
    lines,
    maxProducible: capacity.maximum,
    limitingIngredients: capacity.limitingIngredients,
    stockAvailable: lines.every((l) => l.sufficient),
    estimatedTotalCost: money(lines.reduce((total, l) => total + l.required *
      ingredients.find((i) => i.id === l.ingredientId).costPerUnit, 0)),
  };
}

module.exports = {ValidationError, validateIngredient, validateRecipe, scaleRecipe, maximumProducible, convertQuantity, convertIngredientQuantity, EGG_GRAMS_PER_PIECE, MILK_GRAMS_PER_ML, bakerPercentages, UNITS};
