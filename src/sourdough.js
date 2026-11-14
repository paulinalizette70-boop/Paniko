'use strict';
const crypto=require('node:crypto');
const {ValidationError,convertIngredientQuantity}=require('./domain');
const {roundQuantity,safeStockSum}=require('./inventory');
const isUUID=value=>typeof value==='string'&&/^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i.test(value);
function note(v,label='Notas'){if(v===undefined||v===null||v==='')return '';if(typeof v!=='string'||v.length>500)throw new ValidationError(`${label}: máximo 500 caracteres`);return v.trim();}
function weight(v,label,allowZero=true){
 if(typeof v!=='number'||!Number.isFinite(v)||(allowZero?v<0:v<=0)||v>1000000||Math.abs(v*100-Math.round(v*100))>1e-6)
 throw new ValidationError(`${label}: indica gramos con hasta dos decimales`);
 return Math.round(v*100)/100;
}
function interval(hours){if(!Number.isSafeInteger(hours)||hours<1||hours>336)throw new ValidationError('Intervalo entre revisiones: de 1 a 336 horas');return hours;}
function location(v){if(!['ambiente','refrigerador'].includes(v))throw new ValidationError('Ubicación de masa madre inválida');return v;}
function starterForm(raw){
 if(!raw||typeof raw.name!=='string'||!raw.name.trim()||raw.name.trim().length>100)throw new ValidationError('Nombre de masa madre obligatorio (hasta 100 caracteres)');
 const initialWeightGrams=raw.initialWeightGrams===null||raw.initialWeightGrams===undefined||raw.initialWeightGrams===''?null:weight(raw.initialWeightGrams,'Peso actual');
 return{name:raw.name.trim(),location:location(raw.location),feedEveryHours:interval(raw.feedEveryHours),notes:note(raw.notes),initialWeightGrams};
}
function planFeeding(raw,knownBefore){
 if(!raw||typeof raw!=='object')throw new ValidationError('Registro de alimentación inválido');
 const before=raw.beforeGrams===null||raw.beforeGrams===undefined||raw.beforeGrams===''?knownBefore:weight(raw.beforeGrams,'Cantidad anterior');
 if(before===null||before===undefined)throw new ValidationError('Primero indica cuántos gramos de masa madre tienes antes de alimentar');
 const beforeGrams=weight(before,'Cantidad anterior');
 const discardedGrams=weight(raw.discardedGrams,'Masa madre descartada');
 const flourGrams=weight(raw.flourGrams,'Harina añadida',false);
 const waterGrams=weight(raw.waterGrams,'Agua añadida',false);
 if(discardedGrams>beforeGrams)throw new ValidationError('No puedes descartar más masa madre de la que tienes');
 const afterGrams=Math.round((beforeGrams-discardedGrams+flourGrams+waterGrams)*100)/100;
 if(afterGrams>1000000)throw new ValidationError('La cantidad final supera el límite permitido');
 return {beforeGrams,discardedGrams,flourGrams,waterGrams,afterGrams,notes:note(raw.notes),feedHydrationPercent:Math.round(waterGrams/flourGrams*10000)/100};
}
function gramStock(stock,unit,strict=false){
 if(!['g','kg'].includes(unit))throw new ValidationError('La masa madre del inventario debe estar en g o kg');
 const grams=Number(stock)*(unit==='kg'?1000:1);
 // El control del cultivo trabaja a centésimas de gramo. No redondear stock arbitrariamente.
 if(!Number.isFinite(grams)||(strict&&Math.abs(grams-Math.round(grams*100)/100)>1e-7))
   throw new ValidationError('Ajusta primero la existencia de masa madre a una precisión de 0.01 g');
 return Math.round(grams*100)/100;
}
function linkData(raw){
 const ids=[raw?.starterIngredientId,raw?.flourIngredientId,raw?.waterIngredientId];
 if(ids.some(id=>!isUUID(id))||new Set(ids).size!==3)
   throw new ValidationError('Elige tres ingredientes diferentes: masa madre, harina y agua');
 return {starterIngredientId:ids[0],flourIngredientId:ids[1],waterIngredientId:ids[2]};
}
function fromRow(r){
 const linked=Boolean(r.starter_ingredient_id&&r.flour_ingredient_id&&r.water_ingredient_id);
 let stockWeight=null;
 if(linked&&r.inventory_stock!==undefined&&r.inventory_stock!==null)
   stockWeight=gramStock(r.inventory_stock,r.inventory_unit);
 return {id:r.id,name:r.name,location:r.location,feedEveryHours:Number(r.feed_every_hours),
  currentWeightGrams:stockWeight??(r.current_weight_g===null?null:Number(r.current_weight_g)),
  registeredWeightGrams:r.current_weight_g===null?null:Number(r.current_weight_g),
  lastFedAt:r.last_fed_at||null,notes:r.notes,active:Boolean(r.active),inventoryLinked:linked,
  starterIngredientId:r.starter_ingredient_id||null,flourIngredientId:r.flour_ingredient_id||null,waterIngredientId:r.water_ingredient_id||null};
}
function createSourdoughStore(pool){
 async function listStarters(){
  // El inventario es la fuente de verdad cuando se consumió masa madre en producción.
  const [rows]=await pool.execute(`SELECT s.*,i.stock AS inventory_stock,i.unit AS inventory_unit
    FROM sourdough_starters s LEFT JOIN ingredients i ON i.id=s.starter_ingredient_id ORDER BY s.active DESC,s.name`);
  return rows.map(fromRow);
 }
 async function createStarter(raw){const starter=starterForm(raw),id=crypto.randomUUID();
  try{await pool.execute('INSERT INTO sourdough_starters (id,name,location,feed_every_hours,current_weight_g,notes) VALUES (?,?,?,?,?,?)',
    [id,starter.name,starter.location,starter.feedEveryHours,starter.initialWeightGrams,starter.notes]);}
  catch(e){if(e?.code==='ER_DUP_ENTRY')throw new ValidationError('Ya existe una masa madre con ese nombre',409);throw e;}
  return{id,...starter,lastFedAt:null,active:true,inventoryLinked:false};
 }
 async function updateStarter(id,raw){if(!isUUID(id))throw new ValidationError('Masa madre inválida');const {location:loc,feedEveryHours,notes}=raw||{};
  const active=raw?.active;if(typeof active!=='boolean')throw new ValidationError('Indica si esta masa madre sigue activa');
  const [res]=await pool.execute('UPDATE sourdough_starters SET location=?,feed_every_hours=?,notes=?,active=? WHERE id=?',
    [location(loc),interval(feedEveryHours),note(notes),active?1:0,id]);
  if(res.affectedRows!==1)throw new ValidationError('Masa madre no encontrada',404);
  return{id,location:loc,feedEveryHours,notes,active};
 }
 async function linkInventory(id,raw){
  if(!isUUID(id))throw new ValidationError('Masa madre inválida');
  const mapping=linkData(raw),syncMode=raw?.syncMode??'inventory';
  if(!['inventory','starter'].includes(syncMode))throw new ValidationError('Selecciona cómo sincronizar masa madre e inventario');
  if(syncMode==='starter'&&(typeof raw?.expectedInventoryGrams!=='number'||!Number.isFinite(raw.expectedInventoryGrams)))
    throw new ValidationError('Revisa las existencias actuales de masa madre antes de sincronizar');
  const c=await pool.getConnection();
  try{
   await c.beginTransaction();
   const [starters]=await c.execute('SELECT id,starter_ingredient_id,current_weight_g,name FROM sourdough_starters WHERE id=? FOR UPDATE',[id]);
   if(!starters.length)throw new ValidationError('Masa madre no encontrada',404);
   if(starters[0].starter_ingredient_id && starters[0].starter_ingredient_id!==mapping.starterIngredientId)
     throw new ValidationError('La masa madre ya está vinculada a otro ingrediente. No se puede cambiar sin reconciliar existencias',409);
   if(syncMode==='starter'&&starters[0].starter_ingredient_id)
     throw new ValidationError('La sincronización inicial solo se permite antes del primer vínculo. Revisa Inventario para ajustes posteriores',409);
   const items=new Map();
   for(const ingredientId of Object.values(mapping).sort()){
    const [rows]=await c.execute('SELECT id,name,unit,stock FROM ingredients WHERE id=? FOR UPDATE',[ingredientId]);
    if(!rows.length)throw new ValidationError('Un ingrediente no existe en Inventario',404);
    items.set(ingredientId,rows[0]);
   }
   const stockItem=items.get(mapping.starterIngredientId),flour=items.get(mapping.flourIngredientId),water=items.get(mapping.waterIngredientId);
   if(!['g','kg'].includes(stockItem.unit)||!['g','kg'].includes(flour.unit)||!['g','kg','ml','l'].includes(water.unit))
     throw new ValidationError('Masa madre y harina deben estar en g/kg; agua puede estar en g/kg/ml/l');
   let available=gramStock(stockItem.stock,stockItem.unit,true);
   // La opción por defecto mantiene Inventario como referencia: nunca tocar stock en silencio.
   // Si se elige el peso de la bitácora, registrar un ajuste inicial con movimiento auditado.
   if(syncMode==='starter'){
     if(Math.abs(raw.expectedInventoryGrams-available)>0.001)
       throw new ValidationError('La existencia de masa madre cambió. Actualiza la pantalla antes de sincronizar',409);
     const recorded=starters[0].current_weight_g;
     if(recorded===null||recorded===undefined)
       throw new ValidationError('Primero registra el peso real de tu masa madre en la bitácora',409);
     const grams=weight(Number(recorded),'Peso registrado');
     const converted=grams===0?0:convertIngredientQuantity(grams,'g',stockItem.unit,stockItem.name);
     if(Math.abs(gramStock(converted,stockItem.unit,true)-grams)>0.001)
       throw new ValidationError('No se puede representar el peso en la unidad del inventario sin perder precisión',409);
     const stockBefore=Number(stockItem.stock);
     const difference=Math.round(Math.abs(converted-stockBefore)*1e6)/1e6;
     if(difference>0){
       const [updated]=await c.execute('UPDATE ingredients SET stock=? WHERE id=? AND stock=?',[converted,stockItem.id,stockBefore]);
       if(updated.affectedRows!==1)throw new ValidationError('El inventario cambió. Actualiza la pantalla antes de sincronizar',409);
       await c.execute('INSERT INTO inventory_movements (id,ingredient_id,movement_type,quantity,stock_before,stock_after,reason) VALUES (?,?,?,?,?,?,?)',
         [crypto.randomUUID(),stockItem.id,converted>stockBefore?'entrada':'salida',difference,stockBefore,converted,
           (`Sincronización inicial masa madre: ${starters[0].name}`).slice(0,150)]);
     }
     available=grams;
   }
   const [claimed]=await c.execute('SELECT id FROM sourdough_starters WHERE starter_ingredient_id=? AND id<>? LIMIT 1',[mapping.starterIngredientId,id]);
   if(claimed.length)throw new ValidationError('Ese ingrediente de masa madre ya está vinculado a otro cultivo',409);
   await c.execute('UPDATE sourdough_starters SET starter_ingredient_id=?,flour_ingredient_id=?,water_ingredient_id=?,current_weight_g=? WHERE id=?',
    [mapping.starterIngredientId,mapping.flourIngredientId,mapping.waterIngredientId,available,id]);
   await c.commit();return {id,...mapping,currentWeightGrams:available,inventoryLinked:true,inventoryUpdated:syncMode==='starter'};
  }catch(e){try{await c.rollback();}catch(_){}if(e?.code==='ER_DUP_ENTRY')throw new ValidationError('Ese ingrediente de masa madre ya está vinculado a otro cultivo',409);throw e;}
  finally{c.release();}
 }
 async function reconcileInventory(id,raw){
  if(!isUUID(id))throw new ValidationError('Masa madre inválida');
  const realWeightGrams=weight(raw?.realWeightGrams,'Conteo real de masa madre');
  if(typeof raw?.expectedInventoryGrams!=='number'||!Number.isFinite(raw.expectedInventoryGrams))
    throw new ValidationError('Actualiza la pantalla y revisa las existencias antes de ajustar');
  const c=await pool.getConnection();
  try{
   await c.beginTransaction();
   const [cultures]=await c.execute('SELECT id,name,starter_ingredient_id FROM sourdough_starters WHERE id=? FOR UPDATE',[id]);
   if(!cultures.length)throw new ValidationError('Masa madre no encontrada',404);
   const culture=cultures[0];
   if(!culture.starter_ingredient_id)throw new ValidationError('Conecta primero la masa madre con Inventario',409);
   const [ingredients]=await c.execute('SELECT id,name,unit,stock FROM ingredients WHERE id=? FOR UPDATE',[culture.starter_ingredient_id]);
   if(!ingredients.length)throw new ValidationError('El ingrediente de masa madre vinculado ya no existe',409);
   const stockItem=ingredients[0];
   const stockBefore=Number(stockItem.stock),beforeGrams=gramStock(stockBefore,stockItem.unit,true);
   if(Math.abs(beforeGrams-raw.expectedInventoryGrams)>0.001)
     throw new ValidationError('La existencia de masa madre cambió en Inventario. Actualiza la pantalla antes de ajustar',409);
   const converted=realWeightGrams===0?0:convertIngredientQuantity(realWeightGrams,'g',stockItem.unit,stockItem.name);
   if(Math.abs(gramStock(converted,stockItem.unit,true)-realWeightGrams)>0.001)
     throw new ValidationError('Este peso no se puede registrar sin perder precisión en la unidad del inventario',409);
   const difference=Math.round(Math.abs(converted-stockBefore)*1e6)/1e6;
   if(difference>0){
     const [updated]=await c.execute('UPDATE ingredients SET stock=? WHERE id=? AND stock=?',[converted,stockItem.id,stockBefore]);
     if(updated.affectedRows!==1)throw new ValidationError('Inventario cambió durante el ajuste. Actualiza la pantalla',409);
     const reason=`Conteo físico de masa madre: ${culture.name}`.slice(0,150);
     await c.execute('INSERT INTO inventory_movements (id,ingredient_id,movement_type,quantity,stock_before,stock_after,reason) VALUES (?,?,?,?,?,?,?)',
       [crypto.randomUUID(),stockItem.id,converted>stockBefore?'entrada':'salida',difference,stockBefore,converted,reason]);
   }
   await c.execute('UPDATE sourdough_starters SET current_weight_g=? WHERE id=?',[realWeightGrams,id]);
   await c.commit();
   return {id,currentWeightGrams:realWeightGrams,inventoryUpdated:difference>0,adjustmentGrams:realWeightGrams-beforeGrams};
  }catch(e){try{await c.rollback();}catch(_){}throw e;}finally{c.release();}
 }
 async function feed(id,raw){
  if(!isUUID(id))throw new ValidationError('Masa madre inválida');
  const c=await pool.getConnection();
  try{
   await c.beginTransaction();
   const [rows]=await c.execute('SELECT id,name,active,starter_ingredient_id,flour_ingredient_id,water_ingredient_id FROM sourdough_starters WHERE id=? FOR UPDATE',[id]);
   if(!rows.length)throw new ValidationError('Masa madre no encontrada',404);
   const s=rows[0];
   if(!s.active)throw new ValidationError('Activa la masa madre antes de registrar una alimentación',409);
   if(!s.starter_ingredient_id||!s.flour_ingredient_id||!s.water_ingredient_id)
     throw new ValidationError('Conecta esta masa madre con los ingredientes de Inventario antes de alimentarla',409);
   const ids=[s.starter_ingredient_id,s.flour_ingredient_id,s.water_ingredient_id];
   if(new Set(ids).size!==3)throw new ValidationError('Los ingredientes vinculados no pueden ser iguales',409);
   const ingredients=new Map();
   for(const ingredientId of [...ids].sort()){
    const [items]=await c.execute('SELECT id,name,unit,stock FROM ingredients WHERE id=? FOR UPDATE',[ingredientId]);
    if(!items.length)throw new ValidationError('Un ingrediente vinculado ya no existe',409);
    ingredients.set(ingredientId,items[0]);
   }
   const starter=ingredients.get(s.starter_ingredient_id),flour=ingredients.get(s.flour_ingredient_id),water=ingredients.get(s.water_ingredient_id);
   const actualBefore=gramStock(starter.stock,starter.unit,true);
   if(raw?.beforeGrams!==null&&raw?.beforeGrams!==undefined&&raw?.beforeGrams!=='' &&
      Math.abs(weight(raw.beforeGrams,'Cantidad anterior')-actualBefore)>0.001)
     throw new ValidationError('La cantidad de masa madre cambió en Inventario. Actualiza la pantalla y revisa el peso antes de alimentar',409);
   const plan=planFeeding({...raw,beforeGrams:actualBefore},actualBefore),feedId=crypto.randomUUID();
   const flourUsed=convertIngredientQuantity(plan.flourGrams,'g',flour.unit,flour.name);
   const waterUsed=convertIngredientQuantity(plan.waterGrams,'g',water.unit,water.name);
   if(Number(flour.stock)+1e-9<flourUsed||Number(water.stock)+1e-9<waterUsed)
    throw new ValidationError('Inventario insuficiente para alimentar: revisa harina y agua',409);
   const reason=`Alimentación de masa madre: ${s.name}`.slice(0,150);
   async function move(item,type,quantity){
    if(quantity<=0)return;
    const before=Number(item.stock),after=type==='salida'?roundQuantity(before-quantity):safeStockSum(before,quantity);
    if(after<0)throw new ValidationError(`Inventario insuficiente: ${item.name}`,409);
    const [u]=await c.execute(`UPDATE ingredients SET stock=? WHERE id=? AND stock>=?`,[after,item.id,type==='salida'?quantity:0]);
    if(u.affectedRows!==1)throw new ValidationError(`Inventario insuficiente o cambiado: ${item.name}`,409);
    await c.execute('INSERT INTO inventory_movements (id,ingredient_id,movement_type,quantity,stock_before,stock_after,reason) VALUES (?,?,?,?,?,?,?)',
      [crypto.randomUUID(),item.id,type,quantity,before,after,reason]);
    item.stock=after;
   }
   // Todos los movimientos y el registro de alimentación comparten una transacción.
   await move(flour,'salida',flourUsed);
   await move(water,'salida',waterUsed);
   await move(starter,'salida',plan.discardedGrams?convertIngredientQuantity(plan.discardedGrams,'g',starter.unit,starter.name):0);
   await move(starter,'entrada',convertIngredientQuantity(plan.flourGrams+plan.waterGrams,'g',starter.unit,starter.name));
   if(Math.abs(gramStock(starter.stock,starter.unit,true)-plan.afterGrams)>0.001)
     throw new ValidationError('El resultado no coincide con la existencia final: operación cancelada',409);
   await c.execute('INSERT INTO sourdough_feedings (id,starter_id,before_g,discarded_g,flour_g,water_g,after_g,notes,inventory_synced) VALUES (?,?,?,?,?,?,?,?,1)',
     [feedId,id,plan.beforeGrams,plan.discardedGrams,plan.flourGrams,plan.waterGrams,plan.afterGrams,plan.notes]);
   await c.execute('UPDATE sourdough_starters SET current_weight_g=?,last_fed_at=NOW() WHERE id=?',[plan.afterGrams,id]);
   await c.commit();return {id:feedId,starterId:id,...plan,inventoryUpdated:true};
  }catch(e){try{await c.rollback();}catch(_){}throw e;}finally{c.release();}
 }
 async function feedings(id){if(!isUUID(id))throw new ValidationError('Masa madre inválida');
  const [rows]=await pool.execute('SELECT id,starter_id,before_g,discarded_g,flour_g,water_g,after_g,notes,fed_at,inventory_synced FROM sourdough_feedings WHERE starter_id=? ORDER BY fed_at DESC,id DESC LIMIT 50',[id]);
  return rows.map(r=>({id:r.id,starterId:r.starter_id,beforeGrams:Number(r.before_g),discardedGrams:Number(r.discarded_g),flourGrams:Number(r.flour_g),waterGrams:Number(r.water_g),afterGrams:Number(r.after_g),feedHydrationPercent:Math.round(Number(r.water_g)/Number(r.flour_g)*10000)/100,notes:r.notes,fedAt:r.fed_at,inventoryUpdated:Boolean(r.inventory_synced)}));
 }
 return{listStarters,createStarter,updateStarter,linkInventory,reconcileInventory,feed,feedings};
}
module.exports={createSourdoughStore,starterForm,planFeeding,gramStock,linkData};
