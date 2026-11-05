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
  select.replaceChildren();
  if (!list.length) select.append(make('option', empty));
  for (const item of list) {
    const option = make('option', item.name);
    option.value = item.id;
    select.append(option);
  }
}
function addRecipeItem() {
  const row = make('div', undefined, 'item-row');
  const select = make('select');
  select.setAttribute('aria-label', 'Ingrediente');
  fillSelect(select, ingredients, 'Registra ingredientes antes');
  const quantity = make('input');
  quantity.type = 'number'; quantity.min = '0.000001'; quantity.step = 'any'; quantity.required = true;
  quantity.placeholder = 'Cantidad'; quantity.setAttribute('aria-label', 'Cantidad base');
  const remove = make('button', 'Quitar', 'secondary'); remove.type = 'button'; remove.addEventListener('click', () => row.remove());
  row.append(select, quantity, remove); $('recipe-items').append(row);
}
function render() {
  $('ingredient-list').replaceChildren();
  for (const item of ingredients) $('ingredient-list').append(make('div', `${item.name}: ${item.stock} ${item.unit} disponibles · ${money(item.costPerUnit)}/${item.unit}`, 'list-row'));
  if (!ingredients.length) $('ingredient-list').append(make('p', 'Sin ingredientes.', 'muted'));
  $('recipe-list').replaceChildren();
  for (const item of recipes) $('recipe-list').append(make('div', `${item.name} · ${item.baseYield} piezas · ${item.items.length} ingrediente(s)`, 'list-row'));
  if (!recipes.length) $('recipe-list').append(make('p', 'Sin recetas.', 'muted'));
  fillSelect($('scale-form').elements.recipe, recipes, 'Crea primero una receta');
  for (const select of $('recipe-items').querySelectorAll('select')) {
    const value = select.value;
    fillSelect(select, ingredients, 'Registra ingredientes antes');
    if (ingredients.some(i=>i.id === value)) select.value = value;
  }
}
async function refresh() { [ingredients, recipes] = await Promise.all([api('/api/ingredients'), api('/api/recipes')]); render(); }
$('add-item').addEventListener('click', addRecipeItem);
$('ingredient-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  try {
    await post('/api/ingredients', {name:form.elements.name.value,unit:form.elements.unit.value,costPerUnit:Number(form.elements.cost.value),stock:Number(form.elements.stock.value)});
    form.reset(); await refresh(); notify('Ingrediente registrado.');
  } catch (error) { notify(error.message, true); }
});
$('recipe-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const rows = [...$('recipe-items').children];
  try {
    if (!rows.length) throw new Error('Añade al menos un ingrediente.');
    await post('/api/recipes', {name:form.elements.name.value,baseYield:Number(form.elements.yield.value),items:rows.map(row=>({ingredientId:row.querySelector('select').value,quantity:Number(row.querySelector('input').value)}))});
    form.reset(); $('recipe-items').replaceChildren(); addRecipeItem(); await refresh(); notify('Ficha técnica guardada.');
  } catch (error) { notify(error.message, true); }
});
$('scale-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  try {
    const result = await post(`/api/recipes/${form.elements.recipe.value}/scale`, {desiredYield:Number(form.elements.desiredYield.value)});
    const container = $('scale-results'); container.replaceChildren();
    container.append(make('p', `${result.recipeName} · ${result.desiredYield} piezas · costo estimado ${money(result.estimatedTotalCost)}`));
    for (const line of result.lines) container.append(make('div', `${line.name}: ${line.required} ${line.unit} (disponible: ${line.stock}) · ${money(line.estimatedCost)}`, `list-row ${line.sufficient?'':'warning'}`));
    container.append(make('p', result.stockAvailable ? 'Existencia suficiente para esta simulación.' : 'Inventario insuficiente; no se ha descontado stock.', result.stockAvailable?'good':'warning'));
    notify('Cálculo realizado; ninguna existencia fue modificada.');
  } catch (error) { notify(error.message, true); }
});
addRecipeItem(); refresh().catch(error=>notify(error.message,true));
