'use strict';
const crypto=require('node:crypto');
const {ValidationError}=require('./domain');
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
function fromRow(r){return {id:r.id,name:r.name,location:r.location,feedEveryHours:Number(r.feed_every_hours),currentWeightGrams:r.current_weight_g===null?null:Number(r.current_weight_g),lastFedAt:r.last_fed_at||null,notes:r.notes,active:Boolean(r.active)};}
function createSourdoughStore(pool){
 async function listStarters(){const [rows]=await pool.execute('SELECT * FROM sourdough_starters ORDER BY active DESC,name');return rows.map(fromRow);}
 async function createStarter(raw){const starter=starterForm(raw),id=crypto.randomUUID();
  try{await pool.execute('INSERT INTO sourdough_starters (id,name,location,feed_every_hours,current_weight_g,notes) VALUES (?,?,?,?,?,?)',
    [id,starter.name,starter.location,starter.feedEveryHours,starter.initialWeightGrams,starter.notes]);}
  catch(e){if(e?.code==='ER_DUP_ENTRY')throw new ValidationError('Ya existe una masa madre con ese nombre',409);throw e;}
  return{id,...starter,lastFedAt:null,active:true};
 }
 async function updateStarter(id,raw){if(!isUUID(id))throw new ValidationError('Masa madre inválida');const {location:loc,feedEveryHours,notes}=raw||{};
  const active=raw?.active;if(typeof active!=='boolean')throw new ValidationError('Indica si esta masa madre sigue activa');
  const [res]=await pool.execute('UPDATE sourdough_starters SET location=?,feed_every_hours=?,notes=?,active=? WHERE id=?',
    [location(loc),interval(feedEveryHours),note(notes),active?1:0,id]);
  if(res.affectedRows!==1)throw new ValidationError('Masa madre no encontrada',404);
  return{id,location:loc,feedEveryHours,notes,active};
 }
 async function feed(id,raw){if(!isUUID(id))throw new ValidationError('Masa madre inválida');const c=await pool.getConnection();
  try{await c.beginTransaction();
   const [rows]=await c.execute('SELECT id,active,current_weight_g FROM sourdough_starters WHERE id=? FOR UPDATE',[id]);
   if(!rows.length)throw new ValidationError('Masa madre no encontrada',404);
   if(!rows[0].active)throw new ValidationError('Activa la masa madre antes de registrar una alimentación',409);
   const before=rows[0].current_weight_g===null?null:Number(rows[0].current_weight_g);
   const plan=planFeeding(raw,before),feedId=crypto.randomUUID();
   await c.execute('INSERT INTO sourdough_feedings (id,starter_id,before_g,discarded_g,flour_g,water_g,after_g,notes) VALUES (?,?,?,?,?,?,?,?)',
     [feedId,id,plan.beforeGrams,plan.discardedGrams,plan.flourGrams,plan.waterGrams,plan.afterGrams,plan.notes]);
   await c.execute('UPDATE sourdough_starters SET current_weight_g=?,last_fed_at=NOW() WHERE id=?',[plan.afterGrams,id]);
   await c.commit();return {id:feedId,starterId:id,...plan};
  }catch(e){try{await c.rollback();}catch(_){}throw e;}finally{c.release();}
 }
 async function feedings(id){if(!isUUID(id))throw new ValidationError('Masa madre inválida');
  const [rows]=await pool.execute('SELECT id,starter_id,before_g,discarded_g,flour_g,water_g,after_g,notes,fed_at FROM sourdough_feedings WHERE starter_id=? ORDER BY fed_at DESC,id DESC LIMIT 50',[id]);
  return rows.map(r=>({id:r.id,starterId:r.starter_id,beforeGrams:Number(r.before_g),discardedGrams:Number(r.discarded_g),flourGrams:Number(r.flour_g),waterGrams:Number(r.water_g),afterGrams:Number(r.after_g),feedHydrationPercent:Math.round(Number(r.water_g)/Number(r.flour_g)*10000)/100,notes:r.notes,fedAt:r.fed_at}));
 }
 return{listStarters,createStarter,updateStarter,feed,feedings};
}
module.exports={createSourdoughStore,starterForm,planFeeding};
