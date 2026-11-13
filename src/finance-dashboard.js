'use strict';
const crypto=require('node:crypto');
const {ValidationError}=require('./domain');
const CATEGORIES=new Set(['Renta','Servicios','Nómina','Empaque','Mantenimiento','Otros']);
function money(value,name='Importe'){
 if(typeof value!=='number'||!Number.isFinite(value)||value<=0||value>9999999999.99||Math.abs(value*100-Math.round(value*100))>1e-6)
   throw new ValidationError(`${name}: escribe un monto positivo con hasta dos decimales`);
 return Math.round(value*100)/100;
}
function validateExpense(raw){
 if(!raw||!CATEGORIES.has(raw.category))throw new ValidationError('Categoría de gasto inválida');
 const description=raw.description;
 if(typeof description!=='string'||!description.trim()||description.trim().length>150)throw new ValidationError('Indica un concepto de gasto de hasta 150 caracteres');
 const amount=money(raw.amount);
 const date=raw.expenseDate;
 if(typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(date)||Number.isNaN(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date)
   throw new ValidationError('Fecha de gasto inválida: usa AAAA-MM-DD');
 return {category:raw.category,description:description.trim(),amount,expenseDate:date};
}
const n=v=>Number(v||0);
const optionalAmount=v=>v===null||v===undefined?null:Number(v);
function buildFinancialSummary(sales,expenses,legacyCount,days){
 const snap=sales||[],spends=expenses||[];
 let revenue=0,cogs=0,pricedCount=0,costedCount=0,unpricedCount=0,uncostedCount=0,pieces=0;
 for(const s of snap){
   const q=n(s.quantity);pieces+=q;
   if(s.unit_price===null||s.unit_price===undefined){unpricedCount++;continue;}
   revenue+=q*n(s.unit_price);pricedCount++;
   if(s.unit_cost===null||s.unit_cost===undefined){uncostedCount++;continue;}
   cogs+=q*n(s.unit_cost);costedCount++;
 }
 const totalExpenses=spends.reduce((total,e)=>total+n(e.amount),0);
 const round=x=>Math.round((x+Number.EPSILON)*100)/100;
 const incomplete=legacyCount>0||unpricedCount>0||uncostedCount>0;
 return {days,transactions:snap.length,unitsSold:pieces,legacySales:legacyCount,unpricedSales:unpricedCount,unknownCostSales:uncostedCount,
  knownRevenue:round(revenue),knownCostOfSales:round(cogs),expenses:round(totalExpenses),
  grossProfit:incomplete?null:round(revenue-cogs),netProfit:incomplete?null:round(revenue-cogs-totalExpenses),
  partialGrossProfit:round(revenue-cogs),complete:!incomplete,
  note:incomplete?'Hay ventas históricas sin instantánea o ventas sin precio/costo: los importes conocidos son parciales; no se calcula una ganancia total ficticia.':
    'Utilidades calculadas sobre ventas registradas con precio y costo; gastos capturados manualmente.'};
}
function createFinanceDashboard(pool){
 async function dashboard(days=7){
  if(!Number.isSafeInteger(days)||days<1||days>365)throw new ValidationError('Periodo inválido (1 a 365 días)');
  // Se consulta el periodo completo, sin límite, para no subestimar el resumen.
  const [sales]=await pool.execute(`SELECT movement_id,product_name,quantity,unit_price,unit_cost,sale_at
    FROM sale_financial_snapshots WHERE sale_at >= DATE_SUB(CURRENT_DATE(), INTERVAL ? DAY) ORDER BY sale_at DESC`,[days-1]);
  const [expenses]=await pool.execute(`SELECT id,category,description,amount,expense_date,created_at
    FROM financial_expenses WHERE expense_date >= DATE_SUB(CURRENT_DATE(), INTERVAL ? DAY) ORDER BY expense_date DESC,created_at DESC`,[days-1]);
  const [old]=await pool.execute(`SELECT COUNT(*) AS pending FROM finished_product_movements m
    LEFT JOIN sale_financial_snapshots s ON s.movement_id=m.id
    WHERE m.movement_type='venta' AND m.created_at>=DATE_SUB(CURRENT_DATE(), INTERVAL ? DAY) AND s.movement_id IS NULL`,[days-1]);
  const summary=buildFinancialSummary(sales,expenses,n(old[0]?.pending),days);
  return {...summary,sales:sales.slice(0,40).map(s=>({id:s.movement_id,productName:s.product_name,quantity:n(s.quantity),unitPrice:optionalAmount(s.unit_price),unitCost:optionalAmount(s.unit_cost),soldAt:s.sale_at})),
    expenseList:expenses.slice(0,40).map(e=>({id:e.id,category:e.category,description:e.description,amount:n(e.amount),expenseDate:e.expense_date}))};
 }
 async function addExpense(raw){
  const item=validateExpense(raw),id=crypto.randomUUID();
  await pool.execute('INSERT INTO financial_expenses (id,category,description,amount,expense_date) VALUES (?,?,?,?,?)',
    [id,item.category,item.description,item.amount,item.expenseDate]);
  return {id,...item};
 }
 return {dashboard,addExpense};
}
module.exports={createFinanceDashboard,buildFinancialSummary,validateExpense};
