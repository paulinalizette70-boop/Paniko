'use strict';
// Reserva el ID en la MISMA transacción que actualiza existencias y lotes.
// InnoDB serializa las solicitudes con el mismo ID, incluso con varios servidores.
const {createHash}=require('node:crypto');
const {ValidationError}=require('./domain');
const UUID=/^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i;
async function withRequest(conn,operationId,type,payload,action){
  // Mantiene compatibilidad con clientes antiguos; éstos NO quedan protegidos.
  if(operationId===null||operationId===undefined)return action();
  if(typeof operationId!=='string'||!UUID.test(operationId))
    throw new ValidationError('Identificador de operación inválido');
  const hash=createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  try{
    await conn.execute('INSERT INTO operation_requests (operation_id,operation_type,payload_hash) VALUES (?,?,?)',
      [operationId,type,hash]);
  }catch(error){
    if(error?.code!=='ER_DUP_ENTRY')throw error;
    // SELECT bloqueante para leer el resultado confirmado más reciente.
    const [rows]=await conn.execute(
      'SELECT operation_type,payload_hash,result_json FROM operation_requests WHERE operation_id=? FOR UPDATE',
      [operationId]);
    if(!rows.length)throw new ValidationError('La operación está en proceso: revisa el historial antes de reintentar.',409);
    if(rows[0].operation_type!==type||rows[0].payload_hash!==hash)
      throw new ValidationError('Este identificador corresponde a otra operación',409);
    if(rows[0].result_json===null)
      throw new ValidationError('La operación está en proceso: revisa el historial.',409);
    return typeof rows[0].result_json==='string'?JSON.parse(rows[0].result_json):rows[0].result_json;
  }
  const result=await action();
  await conn.execute('UPDATE operation_requests SET result_json=? WHERE operation_id=?',
    [JSON.stringify(result),operationId]);
  return result;
}
module.exports={withRequest};
