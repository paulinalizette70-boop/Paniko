'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {once}=require('node:events');
const {createApp}=require('../src/app');
const {createStore}=require('../src/store');
const {getCookieToken,validatePassword,userName}=require('../src/auth');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');

test('AUTH-01 contraseña y nombre validan entradas inválidas',()=>{
 assert.throws(()=>validatePassword('123'),/12/);
 assert.equal(userName('Admin.USUARIO'),'admin.usuario');
 assert.throws(()=>userName(''),/inválido/);
 assert.equal(getCookieToken('other=abcd'),null);
});

test('AUTH-02 API protege fórmulas y operaciones mediante permisos (datos sintéticos)',async(t)=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'paniko-auth-test-'));
 const store=createStore(path.join(dir,'data.json'));
 const ingredient=store.addIngredient({name:'Insumo ficticio',unit:'kg',costPerUnit:10,stock:2});
 const auth={
  async login(name,pw){if(name==='admin'&&pw==='ejemplo' )return{token:'A'.repeat(43),user:{username:'admin',role:'admin'}};return null;},
  async logout(){},
  async userForToken(token){if(token==='A'.repeat(43))return{username:'admin',role:'admin'};if(token==='B'.repeat(43))return{username:'operador',role:'operador'};return null;},
  async privateCatalog(){return {recetas:[{title:'Receta ficticia',data:{id:'ficticia'}}],productos:[],rellenos:[]};}
 };
 const server=createApp({store,auth});server.listen(0,'127.0.0.1');await once(server,'listening');
 t.after(()=>{server.close();fs.rmSync(dir,{recursive:true,force:true});});
 const base='http://127.0.0.1:'+server.address().port;
 const guest=await fetch(base+'/api/private/catalog');assert.equal(guest.status,401);
 const noStock=await fetch(base+'/api/ingredients');assert.equal(noStock.status,401);
 const operator=await fetch(base+'/api/private/catalog',{headers:{Cookie:'paniko_session='+ 'B'.repeat(43)}});assert.equal(operator.status,200);
 const accessible=await operator.json();assert.equal(accessible.recetas[0].title,'Receta ficticia');
 const admin=await fetch(base+'/api/private/catalog',{headers:{Cookie:'paniko_session='+'A'.repeat(43)}});
 assert.equal(admin.status,200);assert.equal((await admin.json()).recetas[0].title,'Receta ficticia');
 const mutate=await fetch(base+'/api/ingredients',{method:'POST',headers:{Cookie:'paniko_session='+ 'B'.repeat(43),'Content-Type':'application/json'},body:JSON.stringify({name:'No debe crearse',unit:'kg',costPerUnit:10,stock:0})});assert.equal(mutate.status,201);assert.equal(store.listIngredients().find(x=>x.name==='No debe crearse').costPerUnit,0);
 const csrf=await fetch(base+'/api/ingredients',{method:'POST',headers:{Origin:'https://otro.ejemplo',Cookie:'paniko_session='+ 'A'.repeat(43),'Content-Type':'application/json'},body:'{}'});assert.equal(csrf.status,403);
 const login=await fetch(base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'admin',password:'ejemplo'})});
 assert.equal(login.status,200);assert.match(login.headers.get('set-cookie'),/HttpOnly/);
 const health=await fetch(base+'/api/health');assert.equal(health.status,200);
 assert.equal(ingredient.stock,2);
});
