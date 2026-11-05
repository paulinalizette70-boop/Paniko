'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {validatePrivateCatalog, CatalogValidationError} = require('../src/private-catalog');

const example = () => ({
  metadata: {proyecto:'Datos sintéticos para pruebas automatizadas'},
  recetas: [{
    id:'receta_demo_1', nombre:'Receta ficticia A', estado:'confirmada',
    rendimiento:{cantidad:4,unidad:'porciones'},
    ingredientes:[{ingrediente:'Insumo de prueba',cantidad:50,unidad:'g'}],
    componentes:[], variantes:[]
  }],
  productos:[{producto:'Producto de prueba A',receta:'receta_demo_1',unidades_por_lote:4}],
  rellenos:[{nombre:'Relleno comercial de prueba',tipo:'comercial',gramos_por_pieza:null}]
});

test('CP-16: catalogar JSON de staging con referencias válidas', () => {
  const v=validatePrivateCatalog(example());
  assert.deepEqual(v.summary,{recetas:1,productos:1,rellenos:1,avisos:0,propuestas:0});
  assert.equal(v.hash.length,64);
});

test('CP-17: conservamos rendimiento desconocido y cantidades no convertibles como avisos', () => {
  const d=example();
  d.recetas[0].rendimiento.cantidad=null;
  d.recetas[0].ingredientes[0]={ingrediente:'Otro insumo',cantidad:null,unidad:'g',minimo:20,maximo:30};
  d.recetas[0].ingredientes.push({ingrediente:'Ingrediente por medir',cantidad:1,unidad:'cucharadita'});
  d.recetas[0].estado='propuesta_no_validada';
  const v=validatePrivateCatalog(d);
  assert.equal(v.summary.avisos,4);
  assert.equal(v.summary.propuestas,1);
  assert.equal(v.recetas[0].ingredientes[0].cantidad,null);
});

test('CP-18: rechazamos referencia a subreceta que no existe', () => {
  const d=example();
  d.recetas[0].componentes=[{id:'no_existe'}];
  assert.throws(()=>validatePrivateCatalog(d),CatalogValidationError);
});

test('CP-19: rechazamos productos con receta inexistente y IDs duplicados', () => {
  const d=example();
  d.productos[0].receta='ninguna';
  assert.throws(()=>validatePrivateCatalog(d),/receta de origen no encontrada/);
  const e=example();
  e.recetas.push(structuredClone(e.recetas[0]));
  assert.throws(()=>validatePrivateCatalog(e),/clave duplicada/);
});

test('CP-20: catálogo inválido se bloquea antes de conectarse a una base de datos', () => {
  assert.throws(()=>validatePrivateCatalog({recetas:[],productos:[],rellenos:[]}), /no contiene recetas/);
  assert.throws(()=>validatePrivateCatalog({...example(),rellenos:[{nombre:'R',tipo:'elaborado',receta:'no_existe'}]}),/preparación no encontrada/);
});

module.exports={example};
