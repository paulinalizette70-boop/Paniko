'use strict';
const readline=require('node:readline');
const {Writable}=require('node:stream');
const {poolFromEnv}=require('../src/database');
const {makeAuth}=require('../src/auth');
async function readHidden(label){
 const sink=new Writable({write(_chunk,_encoding,done){done();}});
 const rl=readline.createInterface({input:process.stdin,output:sink,terminal:Boolean(process.stdin.isTTY)});
 process.stdout.write(label);
 try{return await new Promise((resolve,reject)=>{
   rl.once('SIGINT',()=>reject(Error('Cancelado')));
   rl.question('',resolve);
 });}
 finally{rl.close();process.stdout.write('\n');}
}
async function main(){
 const username=process.argv[2]||'admin';
 if(!process.stdin.isTTY)throw Error('Ejecuta este script en PowerShell interactivo, no a través de pipes');
 const password=await readHidden('Contraseña nueva (mínimo 12 caracteres, no aparece mientras escribes): ');
 const confirmation=await readHidden('Repite la contraseña: ');
 if(password!==confirmation)throw Error('Las contraseñas no coinciden');
 const pool=poolFromEnv();
 try{
  const user=await makeAuth(pool).createUser(username,password,'admin');
  console.log('Cuenta administradora creada:',user.username);
 }finally{await pool.end();}
}
main().catch(err=>{console.error(err.code==='ER_DUP_ENTRY'?'Ese usuario ya existe.':err.message);process.exitCode=1;});
