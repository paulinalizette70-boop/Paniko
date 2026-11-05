'use strict';
const crypto=require('node:crypto');
const {promisify}=require('node:util');
const scrypt=promisify(crypto.scrypt);
const PASSWORD_OPTIONS={N:32768,r:8,p:1,maxmem:64*1024*1024};
const SESSION_HOURS=8;

function userName(value){
  if(typeof value!=='string' || !/^[a-zA-Z0-9_.-]{3,50}$/.test(value))
    throw new Error('Usuario: 3-50 caracteres; letras, números, guion, punto o guion bajo');
  return value.toLowerCase();
}
function validatePassword(value){
  if(typeof value!=='string' || value.length<12 || value.length>256)
    throw new Error('La contraseña debe tener entre 12 y 256 caracteres');
}
async function passwordHash(password,salt){
  return (await scrypt(password,Buffer.from(salt,'hex'),64,PASSWORD_OPTIONS)).toString('hex');
}
function getCookieToken(header){
  if(typeof header!=='string')return null;
  const match=header.split(';').map(x=>x.trim()).find(x=>x.startsWith('paniko_session='));
  const token=match?.slice('paniko_session='.length);
  return token && /^[a-zA-Z0-9_-]{43}$/.test(token)?token:null;
}
function cookieForToken(token,secure=false){
  return 'paniko_session='+token+'; Path=/; HttpOnly; SameSite=Strict; Max-Age='+(SESSION_HOURS*3600)+(secure?'; Secure':'');
}
function expiredCookie(secure=false){
  return 'paniko_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0'+(secure?'; Secure':'');
}
function tokenHash(token){return crypto.createHash('sha256').update(token).digest('hex');}
function makeAuth(pool){
  async function createUser(username,password,role='admin'){
    username=userName(username);
    validatePassword(password);
    if(!['admin','operador'].includes(role))throw new Error('Rol no válido');
    const salt=crypto.randomBytes(16).toString('hex');
    const hashed=await passwordHash(password,salt);
    const id=crypto.randomUUID();
    await pool.execute('INSERT INTO auth_users (id,username,password_salt,password_hash,role) VALUES (?,?,?,?,?)',
      [id,username,salt,hashed,role]);
    return {id,username,role};
  }
  async function login(username,password){
    if(typeof username!=='string' || typeof password!=='string' ||
       username.length>100 || password.length>256)return null;
    const normalized=/^[a-zA-Z0-9_.-]{3,50}$/.test(username)?username.toLowerCase():'';
    const [rows]=await pool.execute('SELECT id,username,password_salt,password_hash,role,active FROM auth_users WHERE username=? LIMIT 1',[normalized]);
    const row=rows[0];
    const salt=row?.password_salt||'00000000000000000000000000000000';
    const comparison=await passwordHash(password,salt);
    const expected=row?.password_hash||'0'.repeat(128);
    if(!crypto.timingSafeEqual(Buffer.from(comparison,'hex'),Buffer.from(expected,'hex')) || !row || !row.active)return null;
    const token=crypto.randomBytes(32).toString('base64url');
    await pool.execute('INSERT INTO auth_sessions (token_hash,user_id,expires_at) VALUES (?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? HOUR))',
      [tokenHash(token),row.id,SESSION_HOURS]);
    return {token,user:{username:row.username,role:row.role}};
  }
  async function userForToken(token){
    if(!token)return null;
    const [rows]=await pool.execute(
      'SELECT u.id,u.username,u.role FROM auth_sessions s JOIN auth_users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>UTC_TIMESTAMP() AND u.active=1 LIMIT 1',
      [tokenHash(token)]);
    return rows.length?{id:rows[0].id,username:rows[0].username,role:rows[0].role}:null;
  }
  async function logout(token){
    if(token)await pool.execute('DELETE FROM auth_sessions WHERE token_hash=?',[tokenHash(token)]);
  }
  async function privateCatalog(){
    const [recetas]=await pool.execute('SELECT title,review_status,raw_data FROM private_catalog_recipes ORDER BY title');
    const [productos]=await pool.execute('SELECT title,raw_data FROM private_catalog_products ORDER BY title');
    const [rellenos]=await pool.execute('SELECT title,filling_kind,raw_data FROM private_catalog_fillings ORDER BY title');
    const parse=value=>typeof value==='string'?JSON.parse(value):value;
    return {
      recetas:recetas.map(r=>({title:r.title,status:r.review_status,data:parse(r.raw_data)})),
      productos:productos.map(r=>({title:r.title,data:parse(r.raw_data)})),
      rellenos:rellenos.map(r=>({title:r.title,type:r.filling_kind,data:parse(r.raw_data)}))
    };
  }
  return {createUser,login,userForToken,logout,privateCatalog};
}
module.exports={makeAuth,userName,validatePassword,passwordHash,getCookieToken,cookieForToken,expiredCookie};
