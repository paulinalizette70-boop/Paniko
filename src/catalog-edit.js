'use strict';
// Edición de recetas originales: conserva información que aún no está confirmada.
const crypto=require('node:crypto');
const {ValidationError}=require('./domain');
const {planCatalogRecipe}=require('./catalog-to-recipe');

function cleanText(value,label,max=100){
  if(typeof value!=='string'||!value.trim()||value.trim().length>max)
    throw new ValidationError(`${label}: escribe un texto de 1 a ${max} caracteres`);
  return value.trim();
}
function editCatalogRecipe(source,input){
  if(!source||typeof source!=='object'||Array.isArray(source)||!input||typeof input!=='object'||Array.isArray(input))
    throw new ValidationError('Datos de ficha inválidos');
  const name=cleanText(input.name,'Nombre de receta');
  const original=source.rendimiento||{};
  const quantity=input.yieldQuantity==null||input.yieldQuantity===''?null:Number(input.yieldQuantity);
  if(quantity!==null&&(!Number.isFinite(quantity)||quantity<=0||quantity>1e9))
    throw new ValidationError('El rendimiento debe ser positivo o estar pendiente');
  const yieldUnit=cleanText(input.yieldUnit,'Unidad de rendimiento',60);
  const pieces=['pieza','piezas'].includes(yieldUnit);
  if(pieces&&quantity!==null&&!Number.isSafeInteger(quantity))
    throw new ValidationError('El rendimiento en piezas debe ser un número entero');
  if(!Array.isArray(input.items)||input.items.length<1||input.items.length>100)
    throw new ValidationError('Añade entre 1 y 100 ingredientes');
  const ingredients=input.items.map((item,i)=>{
    if(!item||typeof item!=='object'||Array.isArray(item))throw new ValidationError(`Ingrediente ${i+1} inválido`);
    const name=cleanText(item.name,`Ingrediente ${i+1}`);
    const unit=cleanText(item.unit,`Unidad de ${name}`,30);
    const q=item.quantity==null||item.quantity===''?null:Number(item.quantity);
    if(q!==null&&(!Number.isFinite(q)||q<=0||q>1e9||Math.abs(q-Math.round(q*1e6)/1e6)>1e-10))
      throw new ValidationError(`${name}: la cantidad debe ser positiva (hasta seis decimales) o quedar pendiente`);
    return {ingrediente:name,cantidad:q,unidad:unit};
  });
  const notes=input.notes==null?'':String(input.notes);
  if(notes.length>3000)throw new ValidationError('Las notas son demasiado largas');
  const updated={...source,nombre:name,
    rendimiento:{...original,cantidad:quantity,unidad:yieldUnit},
    ingredientes:ingredients.map((item,i)=>({...source.ingredientes?.[i],...item})),
    observaciones:notes.trim(),estado:input.confirm?'confirmada':'pendiente'};
  if(input.confirm){
    const plan=planCatalogRecipe(updated);
    if(!plan.ready)throw new ValidationError('Antes de confirmar: '+plan.issues.join('; '),409);
  }
  return updated;
}
function manualCatalogHash(value){return 'manual-'+crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0,57);}
module.exports={editCatalogRecipe,manualCatalogHash};
