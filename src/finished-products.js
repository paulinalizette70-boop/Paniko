'use strict';
const crypto=require('node:crypto');
const {ValidationError}=require('./domain');

const TYPES=['produccion_manual','venta','merma','ajuste_entrada','ajuste_salida'];
const isUUID=value=>typeof value==='string'&&/^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i.test(value);
function text(value,label,max=150){
  if(typeof value!=='string'||!value.trim()||value.trim().length>max)throw new ValidationError(label+': texto obligatorio de máximo '+max+' caracteres');
  return value.trim();
}
function quantity(value,label='Cantidad',allowZero=false){
  if(typeof value!=='number'||!Number.isSafeInteger(value)||(allowZero?value<0:value<1)||value>100000000)
    throw new ValidationError(label+': número entero '+(allowZero?'no negativo':'mayor que cero')+' válido');
  return value;
}
function moneyOptional(value){
  if(value===undefined||value===null||value==='')return null;
  if(typeof value!=='number'||!Number.isFinite(value)||value<0||value>9999999999.99||Math.abs(value*100-Math.round(value*100))>1e-6)
    throw new ValidationError('Precio: número no negativo con máximo 2 decimales');
  return value;
}
function categoryId(value){
  if(value===null||value===undefined||value==='')return null;
  return text(value,'Categoría',60);
}
function recipeId(value){
  if(value===null||value===undefined||value==='')return null;
  if(!isUUID(value))throw new ValidationError('La receta vinculada no es válida');
  return value;
}
function fromRow(r){return{
  id:r.id,name:r.name,categoryId:r.category_id,categoryName:r.category_name||'Sin categoría',
  sourceCatalog:Boolean(r.source_product_key),operationalRecipeId:r.operational_recipe_id,
  operationalRecipeName:r.operational_recipe_name||null,unit:r.unit,stock:Number(r.stock),
  minStock:r.min_stock===null?null:Number(r.min_stock),salePrice:r.sale_price===null?null:Number(r.sale_price),
  active:Boolean(r.active)
};}
async function tx(pool,handler){
  const c=await pool.getConnection();
  try{await c.beginTransaction();const result=await handler(c);await c.commit();return result;}
  catch(e){try{await c.rollback();}catch(_){}throw e;}
  finally{c.release();}
}
function dbError(e){
  if(e?.code==='ER_DUP_ENTRY')return new ValidationError('Ya existe un producto o categoría con ese nombre',409);
  if(e?.code==='ER_NO_REFERENCED_ROW_2')return new ValidationError('La categoría o receta seleccionada ya no existe',409);
  return e;
}
const productCols=`p.id,p.name,p.category_id,c.name AS category_name,p.source_product_key,
 p.operational_recipe_id,r.name AS operational_recipe_name,p.unit,p.stock,p.min_stock,p.sale_price,p.active`;
const joins=` FROM finished_products p LEFT JOIN finished_product_categories c ON c.id=p.category_id
 LEFT JOIN recipes r ON r.id=p.operational_recipe_id`;
function createFinishedProductStore(pool){
  async function listCategories(){
    const [rows]=await pool.query('SELECT id,name,sort_order FROM finished_product_categories ORDER BY sort_order,name');
    return rows;
  }
  async function createCategory(raw){
    const name=text(raw?.name,'Nombre de categoría',100);
    const id=crypto.randomUUID();
    try{await pool.execute('INSERT INTO finished_product_categories (id,name) VALUES (?,?)',[id,name]);}
    catch(e){throw dbError(e);}
    return{id,name};
  }
  async function listProducts(){
    const [rows]=await pool.query('SELECT '+productCols+joins+' ORDER BY c.sort_order,c.name,p.name');
    return rows.map(fromRow);
  }
  async function createProduct(raw){
    const name=text(raw?.name,'Nombre de producto');
    const cat=categoryId(raw?.categoryId);
    if(!cat)throw new ValidationError('Selecciona una categoría');
    const id=crypto.randomUUID();
    const price=moneyOptional(raw?.salePrice);
    const min=(raw?.minStock===null||raw?.minStock===undefined||raw?.minStock==='')?null:quantity(raw.minStock,'Stock mínimo',true);
    const linked=recipeId(raw?.operationalRecipeId);
    try{await pool.execute('INSERT INTO finished_products (id,name,category_id,sale_price,min_stock,operational_recipe_id) VALUES (?,?,?,?,?,?)',[id,name,cat,price,min,linked]);}
    catch(e){throw dbError(e);}
    return {id,name,categoryId:cat,stock:0,salePrice:price,minStock:min,operationalRecipeId:linked,unit:'pieza'};
  }
  async function updateProduct(id,raw,{preservePrice=false}={}){
    if(!isUUID(id))throw new ValidationError('Producto no válido');
    const name=text(raw?.name,'Nombre de producto');
    const cat=categoryId(raw?.categoryId);
    if(!cat)throw new ValidationError('Selecciona una categoría');
    let price=preservePrice?null:moneyOptional(raw?.salePrice);
    if(preservePrice){
      const [existing]=await pool.execute('SELECT sale_price FROM finished_products WHERE id=?',[id]);
      if(!existing.length)throw new ValidationError('Producto no encontrado',404);
      price=existing[0].sale_price===null?null:Number(existing[0].sale_price);
    }
    const min=(raw?.minStock===null||raw?.minStock===undefined||raw?.minStock==='')?null:quantity(raw.minStock,'Stock mínimo',true);
    const linked=recipeId(raw?.operationalRecipeId);
    if(typeof raw?.active!=='boolean')throw new ValidationError('Estado activo inválido');
    try{
      const [result]=await pool.execute('UPDATE finished_products SET name=?,category_id=?,sale_price=?,min_stock=?,operational_recipe_id=?,active=? WHERE id=?',[name,cat,price,min,linked,raw.active?1:0,id]);
      if(!result.affectedRows)throw new ValidationError('Producto no encontrado',404);
    }catch(e){throw dbError(e);}
    return {id,name,categoryId:cat,salePrice:price,minStock:min,operationalRecipeId:linked,active:raw.active};
  }
  async function movements(){
    const [rows]=await pool.query(`SELECT m.id,m.product_id,p.name AS product_name,m.movement_type,m.quantity,m.stock_before,m.stock_after,m.reason,m.batch_id,m.created_at
      FROM finished_product_movements m JOIN finished_products p ON p.id=m.product_id ORDER BY m.created_at DESC,m.id DESC LIMIT 200`);
    return rows.map(r=>({id:r.id,productId:r.product_id,productName:r.product_name,type:r.movement_type,
      quantity:Number(r.quantity),before:Number(r.stock_before),after:Number(r.stock_after),reason:r.reason,batchId:r.batch_id,createdAt:r.created_at}));
  }
  async function recordMovement(id,raw){
    if(!isUUID(id))throw new ValidationError('Producto no válido');
    const type=raw?.type;
    if(!TYPES.includes(type))throw new ValidationError('Tipo de movimiento inválido');
    const qty=quantity(raw?.quantity);
    const reason=text(raw?.reason,'Motivo');
    return tx(pool,async c=>{
      const [rows]=await c.execute('SELECT id,name,stock,active FROM finished_products WHERE id=? FOR UPDATE',[id]);
      if(!rows.length)throw new ValidationError('Producto no encontrado',404);
      if(!rows[0].active)throw new ValidationError('No se permiten movimientos de un producto inactivo',409);
      const before=Number(rows[0].stock);
      const sign=['produccion_manual','ajuste_entrada'].includes(type)?1:-1;
      const after=before+sign*qty;
      if(after<0)throw new ValidationError('Existencias insuficientes para registrar la salida',409);
      if(after>100000000)throw new ValidationError('El inventario supera el límite permitido',400);
      await c.execute('UPDATE finished_products SET stock=? WHERE id=?',[after,id]);
      const movementId=crypto.randomUUID();
      await c.execute('INSERT INTO finished_product_movements (id,product_id,movement_type,quantity,stock_before,stock_after,reason) VALUES (?,?,?,?,?,?,?)',
        [movementId,id,type,qty,before,after,reason]);
      return {id:movementId,productId:id,name:rows[0].name,type,quantity:qty,before,after,reason};
    });
  }
  async function importCatalog(){
    return tx(pool,async c=>{
      const [rows]=await c.query('SELECT product_key,title,source_recipe_id FROM private_catalog_products ORDER BY title');
      let created=0,already=0;
      const group={
        hogaza_masa_madre:'masa_madre',baguette_masa_madre:'masa_madre',
        brioche_base:'brioche',danesa_base:'laminada',
        galleta_chip:'galletas',galleta_red:'galletas',galleta_black:'galletas',
        tarta_vasca:'postres',panque_citrico:'postres',panque_platano:'postres'
      };
      for(const row of rows){
        const [existing]=await c.execute('SELECT id FROM finished_products WHERE source_product_key=? OR name=? LIMIT 1',[row.product_key,row.title]);
        if(existing.length){already++;continue;}
        const cat=group[row.source_recipe_id]||null;
        try{
          await c.execute('INSERT INTO finished_products (id,name,category_id,source_product_key,stock) VALUES (?,?,?,?,0)',
            [crypto.randomUUID(),row.title,cat,row.product_key]);
          created++;
        }catch(error){
          if(error?.code==='ER_DUP_ENTRY')already++;
          else throw error;
        }
      }
      return{source:rows.length,created,already};
    });
  }
  return{listCategories,createCategory,listProducts,createProduct,updateProduct,movements,recordMovement,importCatalog};
}
module.exports={createFinishedProductStore,text,quantity,moneyOptional,categoryId,recipeId};
