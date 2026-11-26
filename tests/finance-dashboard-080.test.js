'use strict';
const test=require('node:test');const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');const {once}=require('node:events');
const {buildFinancialSummary,validateExpense,createFinanceDashboard}=require('../src/finance-dashboard');
const {createApp}=require('../src/app');
const A='A'.repeat(43),B='B'.repeat(43);

test('FIN-080-01 ingreso bruto y neto: precios y costos de venta, gastos aparte',()=>{
 const r=buildFinancialSummary([{quantity:3,unit_price:'50.00',unit_cost:'20.00'},
  {quantity:2,unit_price:'60.00',unit_cost:'25.00'}],[{amount:'35.00'}],0,7);
 assert.equal(r.knownRevenue,270);assert.equal(r.knownCostOfSales,110);assert.equal(r.expenses,35);
 assert.equal(r.grossProfit,160);assert.equal(r.netProfit,125);assert.equal(r.complete,true);
});
test('FIN-080-02 ventas antiguas o sin precio/costo muestran utilidad desconocida, nunca se inventa',()=>{
 const a=buildFinancialSummary([{quantity:1,unit_price:'50.00',unit_cost:null}],[],1,30);
 assert.equal(a.netProfit,null);assert.equal(a.grossProfit,null);assert.equal(a.knownRevenue,50);
 assert.equal(a.unknownCostSales,1);assert.equal(a.legacySales,1);
 const b=buildFinancialSummary([{quantity:1,unit_price:null,unit_cost:'12.00'}],[],0,7);
 assert.equal(b.netProfit,null);assert.equal(b.knownRevenue,0);assert.equal(b.unpricedSales,1);
});
test('FIN-080-03 gastos validados: sin texto, importe inválido o fecha imposible',()=>{
 assert.deepEqual(validateExpense({category:'Renta',description:' Local ',amount:500,expenseDate:'2026-11-13'}),{category:'Renta',description:'Local',amount:500,expenseDate:'2026-11-13'});
 for(const value of [-10,0,1.234,'200',Infinity])assert.throws(()=>validateExpense({category:'Renta',description:'Prueba',amount:value,expenseDate:'2026-11-13'}));
 assert.throws(()=>validateExpense({category:'Otros',description:'Prueba',amount:5,expenseDate:'2026-02-30'}));
 assert.throws(()=>validateExpense({category:'No existe',description:'Prueba',amount:5,expenseDate:'2026-02-18'}));
});
test('FIN-080-04 resumen consulta todo el periodo sin limitarlo y guarda gastos, sin cambiar stock',async()=>{
 const actions=[];const pool={async execute(sql,values){actions.push([sql,values]);
  if(sql.includes('FROM sale_financial_snapshots'))return [[{movement_id:randomUUID(),product_name:'Pan ficticio',quantity:2,unit_price:'40.00',unit_cost:'10.00',sale_at:'2026-11-13'}]];
  if(sql.includes('FROM financial_expenses'))return [[{id:randomUUID(),category:'Servicios',description:'Luz',amount:'12.00',expense_date:'2026-11-12'}]];
  if(sql.includes('COUNT(*) AS pending'))return [[{pending:0}]];
  return [{affectedRows:1}];}};
 const finance=createFinanceDashboard(pool),r=await finance.dashboard(7);
 assert.equal(r.knownRevenue,80);assert.equal(r.netProfit,48);assert.equal(r.sales.length,1);
 await finance.addExpense({category:'Otros',description:'Prueba',amount:12,expenseDate:'2026-11-13'});
 assert.equal(actions.length,4);assert.ok(actions.every(([sql])=>!sql.includes('UPDATE finished_products')));
 await assert.rejects(()=>finance.dashboard(1000),/Periodo/);
});
test('FIN-080-05 solo administración consulta resultados y registra gastos',async t=>{
 let reads=0,writes=0;const auth={async userForToken(token){return token===A?{role:'admin'}:token===B?{role:'operador'}:null;}};
 const finance={async dashboard(){reads++;return{days:7,netProfit:100}},async addExpense(){writes++;return{id:randomUUID()}}};
 const app=createApp({auth,finance});app.listen(0,'127.0.0.1');await once(app,'listening');t.after(()=>new Promise(ok=>app.close(ok)));
 const base=`http://127.0.0.1:${app.address().port}`;
 const fetchFor=(path,token,body)=>fetch(base+path,{method:body?'POST':'GET',headers:{Cookie:`paniko_session=${token}`,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
 assert.equal((await fetchFor('/api/finance/dashboard?days=7',B)).status,403);
 assert.equal((await fetchFor('/api/finance/expenses',B,{amount:9})).status,403);
 assert.equal((await fetchFor('/api/finance/dashboard?days=7',A)).status,200);
 assert.equal((await fetchFor('/api/finance/expenses',A,{amount:9})).status,201);
 assert.equal(reads,1);assert.equal(writes,1);
});
