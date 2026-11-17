'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {once}=require('node:events');
const os=require('node:os');const fs=require('node:fs');const path=require('node:path');
const {randomUUID}=require('node:crypto');
const {createFinishedProductStore}=require('../src/finished-products');
const {createApp}=require('../src/app');const {createStore}=require('../src/store');
const {migrate}=require('../scripts/migrate-product-cost');
const ID=randomUUID(), A='A'.repeat(43), B='B'.repeat(43);

test('COST-01 el administrador puede guardar costo y precio; NULL no inventa datos',async()=>{
  const writes=[];
  const products=createFinishedProductStore({async execute(sql,params){
    writes.push([sql,params]);
    if(sql.startsWith('SELECT id,name,stock,unit_cost,sale_price'))return [[{id:ID,name:'Pan de prueba',stock:8,unit_cost:null,sale_price:'45.00'}]];
    if(sql.startsWith('UPDATE finished_products SET unit_cost='))return [{affectedRows:1}];
    throw Error('SQL inesperado: '+sql);
  }});
  const rows=await products.listFinancials();assert.deepEqual(rows,[{id:ID,name:'Pan de prueba',stock:8,unitCost:null,salePrice:45}]);
  assert.deepEqual(await products.updateFinancials(ID,{unitCost:24.50,salePrice:45}),{id:ID,unitCost:24.5,salePrice:45});
  assert.deepEqual(writes[1][1],[24.5,45,ID]);
  assert.deepEqual(await products.updateFinancials(ID,{unitCost:null,salePrice:null}),{id:ID,unitCost:null,salePrice:null});
});

test('COST-02 validación del servidor rechaza importes incorrectos y IDs inexistentes',async()=>{
  let count=0;
  const products=createFinishedProductStore({async execute(){count++;return [{affectedRows:0}];}});
  for(const n of [-1,'22',3.999,Infinity,1e11]){
    await assert.rejects(()=>products.updateFinancials(ID,{unitCost:n,salePrice:50}),e=>e.status===400);
    await assert.rejects(()=>products.updateFinancials(ID,{unitCost:25,salePrice:n}),e=>e.status===400);
  }
  assert.equal(count,0,'No se ejecutaron consultas con importes inválidos');
  await assert.rejects(()=>products.updateFinancials(ID,{unitCost:1,salePrice:2}),e=>e.status===404);
  assert.equal(count,1);
});

test('COST-03 solamente administración puede usar la API financiera de productos',async t=>{
  const folder=fs.mkdtempSync(path.join(os.tmpdir(),'paniko-finance-'));
  const auth={async userForToken(token){return token===A?{role:'admin'}:token===B?{role:'operador'}:null;}};
  let updates=0;
  const products={
    async listCategories(){return[];},async listProducts(){return[{id:ID,name:'Pan de prueba',unitCost:28,salePrice:50,stock:2}]},
    async listFinancials(){return[{id:ID,name:'Pan de prueba',unitCost:28,salePrice:50,stock:2}]},
    async updateFinancials(){updates++;return {id:ID,unitCost:30,salePrice:55}}};
  const server=createApp({store:createStore(path.join(folder,'data.json')),auth,products});
  server.listen(0,'127.0.0.1');await once(server,'listening');
  t.after(async()=>{await new Promise(done=>server.close(done));fs.rmSync(folder,{recursive:true,force:true});});
  const base=`http://127.0.0.1:${server.address().port}`;
  const call=(method,url,token,body)=>fetch(base+url,{method,headers:{Cookie:`paniko_session=${token}`,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
  assert.equal((await call('GET','/api/finance/products',B)).status,403);
  assert.equal((await call('POST',`/api/finance/products/${ID}/pricing`,B,{unitCost:0,salePrice:0})).status,403);
  assert.equal(updates,0);
  const adminList=await call('GET','/api/finance/products',A);assert.equal(adminList.status,200);
  assert.equal((await adminList.json())[0].unitCost,28);
  const operatorCatalog=await call('GET','/api/products',B);assert.equal(operatorCatalog.status,200);
  const data=await operatorCatalog.json();assert.equal('unitCost' in data[0],false);
  assert.equal((await call('POST',`/api/finance/products/${ID}/pricing`,A,{unitCost:30,salePrice:55})).status,200);
  assert.equal(updates,1);
});

test('COST-04 migración es idempotente, no borra registros ni realiza cambios si la columna existe',async()=>{
  const statements=[];
  let existing=false;
  const pool={async execute(sql,params){statements.push([sql,params]);return [[{found:Number(sql.includes('INFORMATION_SCHEMA.TABLES')||existing)}]];},
    async query(sql){statements.push([sql]);existing=true;}};
  assert.deepEqual((await migrate(pool,'paniko')).changed,true);
  assert.equal(statements.filter(([sql])=>sql.startsWith('ALTER TABLE')).length,1);
  assert.ok(statements.find(([sql])=>sql.startsWith('ALTER TABLE'))[0].includes('ADD COLUMN unit_cost'));
  assert.deepEqual((await migrate(pool,'paniko')).changed,false);
  assert.equal(statements.filter(([sql])=>sql.startsWith('ALTER TABLE')).length,1);
});

test('COST-05 MySQL aislado: la edición financiera no altera inventario y sobrevive una actualización de producto',
  {skip:process.env.MYSQL_TEST!=='1'?'Solo en MySQL de pruebas aislado':false},async()=>{
  if(!/_test$/.test(process.env.DB_NAME||''))throw Error('Las pruebas MySQL solo se ejecutan contra *_test');
  const {poolFromEnv}=require('../src/database');const pool=poolFromEnv();
  try{
    const products=createFinishedProductStore(pool);
    const cats=await products.listCategories();assert.ok(cats.length>0);
    const created=await products.createProduct({name:'Costo ficticio '+randomUUID(),categoryId:cats[0].id,salePrice:70,minStock:0});
    const before=(await products.listProducts()).find(p=>p.id===created.id);assert.equal(before.stock,0);
    const finance=await products.updateFinancials(created.id,{unitCost:32.5,salePrice:75});
    assert.equal(finance.unitCost,32.5);
    let stored=(await products.listFinancials()).find(p=>p.id===created.id);
    assert.equal(stored.unitCost,32.5);assert.equal(stored.salePrice,75);
    await products.updateProduct(created.id,{name:before.name,categoryId:cats[0].id,salePrice:0,minStock:0,active:true},{preservePrice:true});
    stored=(await products.listFinancials()).find(p=>p.id===created.id);
    assert.equal(stored.unitCost,32.5);assert.equal(stored.salePrice,75);assert.equal(stored.stock,0);
  }finally{await pool.end();}
});
