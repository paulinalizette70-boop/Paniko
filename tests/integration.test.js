'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {once} = require('node:events');
const {createApp} = require('../src/app');

test('CP-01, CP-04, CP-05 y CP-06: API de ingredientes, recetas, consulta y escalado', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'paniko-test-'));
  const file = path.join(dir, 'db.json');
  const server = createApp({dataFile: file});
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => {server.close();fs.rmSync(dir, {recursive:true,force:true});});
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = async (route, payload) => {
    const response = await fetch(base+route, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
    return {status:response.status, body: await response.json()};
  };
  const flour = await post('/api/ingredients',{name:'Harina',unit:'kg',costPerUnit:25,stock:5});
  assert.equal(flour.status,201);
  const sugar = await post('/api/ingredients',{name:'Azúcar',unit:'kg',costPerUnit:30,stock:2});
  assert.equal(sugar.status,201);
  const bad = await post('/api/ingredients',{name:'',unit:'kg',costPerUnit:25,stock:5});
  assert.equal(bad.status,400);
  const recipe = await post('/api/recipes',{name:'Conchas de prueba',baseYield:10,items:[
    {ingredientId:flour.body.id,quantity:1},{ingredientId:sugar.body.id,quantity:0.25}]});
  assert.equal(recipe.status,201);
  const list = await (await fetch(base+'/api/recipes')).json();
  assert.equal(list.length,1);
  assert.equal(list[0].name,'Conchas de prueba');
  const result = await post(`/api/recipes/${recipe.body.id}/scale`,{desiredYield:20});
  assert.equal(result.status,200);
  assert.equal(result.body.estimatedTotalCost,65);
  assert.equal(result.body.lines[0].required,2);
  assert.equal(result.body.stockAvailable,true);
  const invalid = await post(`/api/recipes/${recipe.body.id}/scale`,{desiredYield:0});
  assert.equal(invalid.status,400);
  const persisted = JSON.parse(fs.readFileSync(file,'utf8'));
  assert.equal(persisted.ingredients.length,2);
  assert.equal(persisted.ingredients[0].stock,5); // simulación, no descuenta
  const page = await fetch(base+'/');
  assert.equal(page.status,200);
  assert.match(await page.text(),/Paniko/);
});
