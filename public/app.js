'use strict';
let ingredients = [];
let recipes = [];
const $ = (id) => document.getElementById(id);
const make = (tag, content, cls) => {
  const element = document.createElement(tag);
  if (content !== undefined) element.textContent = String(content);
  if (cls) element.className = cls;
  return element;
};
const money = (value) => new Intl.NumberFormat('es-MX', {style:'currency',currency:'MXN'}).format(value);
function notify(message, failed = false) { $('notification').textContent = message; $('notification').className = failed ? 'warning' : 'good'; }
async function api(path, options) {
  const response = await fetch(path, options);
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'No se pudo realizar la operación');
  return result;
}
function post(path, value) { return api(path, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(value)}); }
function fillSelect(select, list, empty) {
  const previous=select.value;
  select.replaceChildren();
  if (!list.length) {const option=make('option',empty);option.value='';select.append(option);}
  for (const item of list) {
    const option = make('option', item.name);
    option.value = item.id;
    select.append(option);
  }
  if (list.some(item=>item.id===previous)) select.value=previous;
}
function addRecipeItem() {
  const row = make('div', undefined, 'item-row');
  const select = make('select');
  select.setAttribute('aria-label', 'Ingrediente');
  fillSelect(select, ingredients, 'Registra ingredientes antes');
  const quantity = make('input');
  quantity.type = 'number'; quantity.min = '0.000001'; quantity.step = '0.000001'; quantity.required = true;
  quantity.placeholder = 'Cantidad'; quantity.setAttribute('aria-label', 'Cantidad base');
  const remove = make('button', 'Quitar', 'secondary'); remove.type = 'button'; remove.addEventListener('click', () => row.remove());
  row.append(select, quantity, remove); $('recipe-items').append(row);
}
function render(movements, batches) {
  $('ingredient-list').replaceChildren();
  for (const item of ingredients) $('ingredient-list').append(make('div', `${item.name}: ${item.stock} ${item.unit} disponibles · ${money(item.costPerUnit)}/${item.unit}`, 'list-row'));
  if (!ingredients.length) $('ingredient-list').append(make('p', 'Sin ingredientes.', 'muted'));
  $('recipe-list').replaceChildren();
  for (const item of recipes) $('recipe-list').append(make('div', `${item.name} · ${item.baseYield} piezas · ${item.items.length} ingrediente(s)`, 'list-row'));
  if (!recipes.length) $('recipe-list').append(make('p', 'Sin recetas.', 'muted'));
  fillSelect($('scale-form').elements.recipe, recipes, 'Crea primero una receta');
  fillSelect($('stock-in-form').elements.ingredient, ingredients, 'Registra primero un ingrediente');
  for (const select of $('recipe-items').querySelectorAll('select')) {
    fillSelect(select, ingredients, 'Registra ingredientes antes');
  }
  $('movement-list').replaceChildren();
  for (const item of movements.slice(0,12)) {
    $('movement-list').append(make('div', `${item.type==='entrada'?'Entrada':'Salida'} · ${item.name} · ${item.quantity} · ${item.reason}`, 'list-row'));
  }
  if (!movements.length) $('movement-list').append(make('p', 'Todavía no hay movimientos.', 'muted'));
  $('production-list').replaceChildren();
  for(const batch of batches.slice(0,10)) $('production-list').append(make('div', `${batch.recipeName} · ${batch.desiredYield} piezas · ${money(batch.estimatedTotalCost)}`, 'list-row'));
  if(!batches.length) $('production-list').append(make('p', 'Todavía no hay producciones confirmadas.', 'muted'));
}
async function refresh() {
  const [ings,recs,movements,batches]=await Promise.all([
    api('/api/ingredients'),api('/api/recipes'),api('/api/inventory/movements'),api('/api/production')]);
  ingredients=ings;recipes=recs;render(movements,batches);
}
$('add-item').addEventListener('click', addRecipeItem);
$('ingredient-form').addEventListener('submit', async (event) => {
  event.preventDefault(); const form = event.currentTarget;
  try {
    await post('/api/ingredients', {name:form.elements.name.value,unit:form.elements.unit.value,costPerUnit:Number(form.elements.cost.value),stock:Number(form.elements.stock.value)});
    form.reset(); await refresh(); notify('Ingrediente registrado.');
  } catch (error) { notify(error.message, true); }
});
$('recipe-form').addEventListener('submit', async (event) => {
  event.preventDefault(); const form = event.currentTarget;
  const rows = [...$('recipe-items').children];
  try {
    if (!rows.length) throw new Error('Añade al menos un ingrediente.');
    await post('/api/recipes', {name:form.elements.name.value,baseYield:Number(form.elements.yield.value),items:rows.map(row=>({ingredientId:row.querySelector('select').value,quantity:Number(row.querySelector('input').value)}))});
    form.reset(); $('recipe-items').replaceChildren(); addRecipeItem(); await refresh(); notify('Ficha técnica guardada.');
  } catch (error) { notify(error.message, true); }
});
$('stock-in-form').addEventListener('submit',async(event)=>{
  event.preventDefault();const form=event.currentTarget;
  try {
    await post(`/api/ingredients/${form.elements.ingredient.value}/stock-in`,{quantity:Number(form.elements.quantity.value),reason:form.elements.reason.value});
    form.elements.quantity.value='';await refresh();notify('Entrada de inventario guardada.');
  }catch(error){notify(error.message,true);}
});
function renderPreview(result) {
  const container=$('scale-results');container.replaceChildren();
  container.append(make('p', `${result.recipeName} · ${result.desiredYield} piezas · costo estimado ${money(result.estimatedTotalCost)}`));
  for (const line of result.lines) container.append(make('div', `${line.name}: ${line.required} ${line.unit} (disponible: ${line.stock}) · ${money(line.estimatedCost)}`, `list-row ${line.sufficient?'':'warning'}`));
  container.append(make('p', result.stockAvailable?'Inventario suficiente para esta producción.':'Inventario insuficiente. No se puede confirmar la producción.', result.stockAvailable?'good':'warning'));
}
async function selectedPreview(){
  const form=$('scale-form');
  if(!form.reportValidity()) throw new Error('Completa los datos para producir.');
  const recipeId=form.elements.recipe.value, desiredYield=Number(form.elements.desiredYield.value);
  const result=await post(`/api/recipes/${recipeId}/scale`,{desiredYield});
  renderPreview(result);
  return result;
}
$('scale-form').addEventListener('submit', async(event)=>{
  event.preventDefault();try{await selectedPreview();notify('Vista previa calculada. No se modificó el inventario.');}catch(e){notify(e.message,true);}
});
$('produce-button').addEventListener('click',async()=>{
  try {
    const result=await selectedPreview();
    if(!result.stockAvailable) throw new Error('No puedes confirmar: inventario insuficiente.');
    if(!confirm(`¿Confirmas ${result.desiredYield} piezas de ${result.recipeName}? Se descontarán ingredientes del inventario y se registrará el movimiento.`)) return;
    const done=await post(`/api/recipes/${result.recipeId}/produce`,{desiredYield:result.desiredYield});
    await refresh();$('scale-results').replaceChildren();notify(`Producción confirmada (${done.id}). El inventario se descontó.`);
  }catch(e){notify(e.message,true);}
});
addRecipeItem();refresh().catch(error=>notify(error.message,true));
