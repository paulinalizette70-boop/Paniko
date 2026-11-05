'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {randomUUID} = require('node:crypto');
const {poolFromEnv} = require('../src/database');
const {importPrivateCatalog} = require('../src/private-catalog-store');
const {validatePrivateCatalog} = require('../src/private-catalog');

test('CP-21 MySQL: catálogo de prueba privado se importa sin duplicados y se aísla de la API',
  {skip:process.env.MYSQL_TEST==='1'?false:'Requiere MYSQL_TEST y MySQL aislado'}, async () => {
    if (!String(process.env.DB_NAME||'').endsWith('_test')) throw new Error('Se exige DB_NAME terminada en _test');
    const {createApp} = require('../src/app');
    const {createMysqlStore} = require('../src/mysql-store');
    const {once} = require('node:events');
    const uniq='receta_prueba_'+randomUUID().replace(/-/g,'').slice(0,20);
    const input={recetas:[{id:uniq,nombre:'Receta de prueba sintética',estado:'confirmada',rendimiento:{cantidad:2,unidad:'porciones'},ingredientes:[{ingrediente:'Insumo inventado',cantidad:5,unidad:'g'}],componentes:[],variantes:[]}],productos:[{producto:'Producto ficticio '+uniq,receta:uniq}],rellenos:[{nombre:'Relleno ficticio '+uniq,tipo:'comercial'}]};
    const pool=poolFromEnv();
    let server;
    try {
      const saved=await importPrivateCatalog(pool,input);
      assert.equal(saved.recetas,1);
      await importPrivateCatalog(pool,input);
      const [recipeRows]=await pool.execute('SELECT raw_data FROM private_catalog_recipes WHERE catalog_id=?',[uniq]);
      assert.equal(recipeRows.length,1);
      const stored=typeof recipeRows[0].raw_data==='string'?JSON.parse(recipeRows[0].raw_data):recipeRows[0].raw_data;
      assert.equal(stored.id,uniq);
      const [productRows]=await pool.execute('SELECT COUNT(*) AS total FROM private_catalog_products WHERE source_recipe_id=?',[uniq]);
      assert.equal(Number(productRows[0].total),1);
      const [importRows]=await pool.execute('SELECT COUNT(*) AS total FROM private_catalog_imports WHERE source_hash=?',[validatePrivateCatalog(input).hash]);
      assert.equal(Number(importRows[0].total),1);
      server=createApp({store:createMysqlStore(pool)});
      server.listen(0,'127.0.0.1');
      await once(server,'listening');
      const port=server.address().port;
      const publicRecipes=await (await fetch(`http://127.0.0.1:${port}/api/recipes`)).json();
      assert.equal(publicRecipes.some(r=>r.name==='Receta de prueba sintética'),false,'Un catálogo privado no debe verse por API');
      const noPrivateEndpoint=await fetch(`http://127.0.0.1:${port}/api/private/recipes`);
      assert.equal(noPrivateEndpoint.status,404);
    } finally {
      if(server)await new Promise(resolve=>server.close(resolve));
      await pool.end();
    }
  });
