'use strict';
const crypto=require('node:crypto');
const {ValidationError}=require('./domain');
function monthRange(month){
 if(typeof month!=='string'||!/^20\d{2}-(0[1-9]|1[0-2])$/.test(month))throw new ValidationError('Mes inválido (AAAA-MM)');
 const year=Number(month.slice(0,4)),m=Number(month.slice(5));
 const next=m===12?`${year+1}-01`:`${year}-${String(m+1).padStart(2,'0')}`;
 return {from:`${month}-01`,to:`${next}-01`};
}
function validateEntry(raw){
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new ValidationError('Pendiente inválido');
 const kind=raw.kind;
 if(!['pendiente','produccion'].includes(kind))throw new ValidationError('Tipo de evento no permitido');
 const eventDate=raw.eventDate;
 if(typeof eventDate!=='string'||!/^20\d{2}-\d{2}-\d{2}$/.test(eventDate)||Number.isNaN(new Date(`${eventDate}T12:00:00Z`).getTime())||new Date(`${eventDate}T12:00:00Z`).toISOString().slice(0,10)!==eventDate)throw new ValidationError('Fecha inválida');
 const title=raw.title;
 if(typeof title!=='string'||!title.trim()||title.trim().length>120)throw new ValidationError('Escribe un título de hasta 120 caracteres');
 const notes=raw.notes??'';
 if(typeof notes!=='string'||notes.length>300)throw new ValidationError('Notas demasiado largas');
 const recipeId=raw.recipeId||null;
 if(recipeId!==null&&(!/^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i.test(recipeId)||kind!=='produccion'))throw new ValidationError('Receta planificada inválida');
 const plannedQuantity=raw.plannedQuantity==null||raw.plannedQuantity===''?null:raw.plannedQuantity;
 if(plannedQuantity!==null&&(!recipeId||!Number.isSafeInteger(plannedQuantity)||plannedQuantity<1||plannedQuantity>1e9))throw new ValidationError('Indica una cantidad válida para la receta planificada');
 return {kind,eventDate,title:title.trim(),notes:notes.trim(),recipeId,plannedQuantity};
}
function createCalendarStore(pool){
 return {
   async month(month){
     const {from,to}=monthRange(month);
     const [entries]=await pool.execute(`SELECT e.id,DATE_FORMAT(e.event_date,'%Y-%m-%d') AS event_date,e.kind,e.title,e.notes,e.status,e.recipe_id,e.planned_quantity,r.yield_unit
       FROM calendar_entries e LEFT JOIN recipes r ON r.id=e.recipe_id
       WHERE e.event_date>=? AND e.event_date<? ORDER BY e.event_date,e.created_at,e.id`,[from,to]);
     const [batches]=await pool.execute(`SELECT id,DATE_FORMAT(created_at,'%Y-%m-%d') AS batch_date,recipe_name,desired_yield,yield_unit FROM production_batches
       WHERE created_at>=? AND created_at<? ORDER BY created_at,id`,[from,to]);
     return {month,entries:entries.map(e=>({id:e.id,eventDate:e.event_date,kind:e.kind,title:e.title,notes:e.notes,status:e.status,recipeId:e.recipe_id,plannedQuantity:e.planned_quantity===null?null:Number(e.planned_quantity),yieldUnit:e.yield_unit||'pieza'})),
       productions:batches.map(b=>({id:b.id,eventDate:b.batch_date,recipeName:b.recipe_name,quantity:Number(b.desired_yield),yieldUnit:b.yield_unit||'pieza'}))};
   },
   async create(raw){
     const data=validateEntry(raw);const id=crypto.randomUUID();
     if(data.recipeId){const [recipes]=await pool.execute('SELECT id FROM recipes WHERE id=?',[data.recipeId]);if(!recipes.length)throw new ValidationError('La receta seleccionada no existe',404);}
     await pool.execute('INSERT INTO calendar_entries (id,event_date,kind,title,notes,status,recipe_id,planned_quantity) VALUES (?,?,?,?,?,?,?,?)',
       [id,data.eventDate,data.kind,data.title,data.notes,'pendiente',data.recipeId,data.plannedQuantity]);
     return {id,...data,status:'pendiente'};
   },
   async setStatus(id,status){
     if(!/^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i.test(id))throw new ValidationError('Evento inválido');
     if(!['pendiente','hecho'].includes(status))throw new ValidationError('Estado de pendiente inválido');
     const [result]=await pool.execute('UPDATE calendar_entries SET status=? WHERE id=?',[status,id]);
     if(result.affectedRows!==1)throw new ValidationError('Pendiente no encontrado',404);
     return {id,status};
   },
   async remove(id){
     if(!/^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i.test(id))throw new ValidationError('Evento inválido');
     const [result]=await pool.execute('DELETE FROM calendar_entries WHERE id=?',[id]);
     if(result.affectedRows!==1)throw new ValidationError('Pendiente no encontrado',404);
     return {id,deleted:true};
   }
 };
}
module.exports={createCalendarStore,validateEntry,monthRange};
