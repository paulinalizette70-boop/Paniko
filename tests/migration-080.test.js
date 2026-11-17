'use strict';
const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');
const {migrate,SQL}=require('../scripts/migrate-finance-and-starter');

test('MIG-080-01 migración solamente crea cuatro tablas opcionales, es repetible',async()=>{
 const sql=[];const pool={async query(s){sql.push(s)}};
 await migrate(pool);await migrate(pool);
 assert.equal(SQL.length,4);assert.equal(sql.length,8);
 for(const q of sql){assert.match(q,/^CREATE TABLE IF NOT EXISTS/);assert.doesNotMatch(q,/\bDROP\b|\bTRUNCATE\b|\bDELETE\b|\bALTER\s+TABLE/i);}
 assert.ok(sql.some(s=>s.includes('sale_financial_snapshots')));
 assert.ok(sql.some(s=>s.includes('sourdough_feedings')));
});
test('UI-080-02 pantallas, controles y archivo JS de masa madre existen',()=>{
 const html=fs.readFileSync(path.join(__dirname,'../public/index.html'),'utf8');
 const js=fs.readFileSync(path.join(__dirname,'../public/app.js'),'utf8');
 for(const id of ['sourdough-list','starter-create-form','finance-period','finance-revenue','finance-net','finance-expense-form'])assert.ok(html.includes(`id="${id}"`),id);
 assert.match(html,/data-view="sourdough"/);assert.match(html,/src="\/sourdough.js"/);
 assert.match(js,/loadFinanceDashboard\(/);assert.match(js,/PanikoSourdough/);
});
