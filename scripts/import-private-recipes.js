'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {validatePrivateCatalog, CatalogValidationError} = require('../src/private-catalog');

function parseArguments(args) {
  const options = {file: null, apply: false};
  for (let i=0;i<args.length;i++) {
    if (args[i] === '--file' && args[i+1]) options.file = args[++i];
    else if (args[i] === '--apply') options.apply = true;
    else throw new Error(`Opción no reconocida: ${args[i]}`);
  }
  if (!options.file) throw new Error('Indica --file private/catalogo_recetas.json');
  if (path.extname(options.file).toLowerCase() !== '.json') throw new Error('El archivo debe ser JSON');
  return options;
}

async function main(args = process.argv.slice(2)) {
  const options = parseArguments(args);
  const filePath = path.resolve(options.file);
  const info = fs.statSync(filePath);
  if (!info.isFile() || info.size > 10 * 1024 * 1024) throw new Error('Archivo inválido o superior a 10 MB');
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const valid = validatePrivateCatalog(data);
  console.log(`Catálogo válido: ${valid.summary.recetas} recetas, ${valid.summary.productos} productos, ${valid.summary.rellenos} rellenos.`);
  console.log(`Avisos de validación: ${valid.summary.avisos}; fórmulas propuestas no verificadas: ${valid.summary.propuestas}.`);
  if (!options.apply) {
    console.log('SIMULACIÓN: no se ha conectado a MySQL ni se ha escrito ningún dato.');
    console.log('Para guardar en MySQL utiliza el mismo comando con --apply.');
    return valid.summary;
  }
  const {poolFromEnv} = require('../src/database');
  const {importPrivateCatalog} = require('../src/private-catalog-store');
  const pool = poolFromEnv();
  try {
    const results = await importPrivateCatalog(pool, data);
    console.log(`Importación PRIVADA completada en MySQL: ${results.recetas} recetas, ${results.productos} productos y ${results.rellenos} rellenos.`);
    console.log('Las fórmulas NO se publicaron en GitHub ni están expuestas por la API web.');
    console.log('Permanecen en staging; no consumen inventario sin validación y autorización posterior.');
    return results;
  } finally {await pool.end();}
}
if (require.main === module) main().catch(error => {
  // No imprimir el objeto MySQL/JSON que pudiera contener información sensible.
  const message = error instanceof CatalogValidationError ? 'Catálogo inválido: revisa campos requeridos y sus unidades' :
    error.code ? `Error de conexión o base de datos (${error.code}). Revisa .env, acceso y npm run db:init.` :
      'No se pudo validar/importar. Revisa la ruta, JSON y configuración local.';
  console.error(message);
  process.exitCode = 1;
});

module.exports = {main, parseArguments};
