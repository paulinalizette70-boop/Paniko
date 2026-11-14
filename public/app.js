'use strict';
let ingredients = [];
let recipes = [];
let editingRecipeId=null;
let productionBatches = [];
const $ = (id) => document.getElementById(id);
const make = (tag, content, cls) => {
  const element = document.createElement(tag);
  if (content !== undefined) element.textContent = String(content);
  if (cls) element.className = cls;
  return element;
};
const money = (value) => new Intl.NumberFormat('es-MX', {style:'currency',currency:'MXN'}).format(value);
function notify(message, failed=false) {
  const element=$('notification');element.textContent=message;
  element.className=failed?'toast warning':'toast good';element.hidden=false;
}
const yieldLabel=(unit)=>unit==='g'?'g':unit==='ml'?'ml':'piezas';
function normalizedCatalogYield(source){
  const unit=normalizeSearch(source?.unidad||''),quantity=source?.cantidad;
  const pieces=['pieza','piezas','panes','hogazas','baguettes','panques','bollos','galletas','unidades','porciones','croissants','rollos'];
  if(!Number.isFinite(quantity)||quantity<=0)return null;
  if(pieces.includes(unit)&&Number.isSafeInteger(quantity))return {baseYield:quantity,yieldUnit:'pieza'};
  const factor={g:1,gramo:1,gramos:1,kg:1000,kilogramo:1000,kilogramos:1000,ml:1,mililitros:1,l:1000,litro:1000,litros:1000}[unit];
  if(!factor)return null;
  const baseYield=quantity*factor;
  return Number.isSafeInteger(baseYield)&&baseYield>0?{baseYield,yieldUnit:['l','ml','litro','litros','mililitros'].includes(unit)?'ml':'g'}:null;
}
const normalizeSearch=(value)=>String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es');
const VIEWS={dashboard:'Inicio',production:'Producción',ingredients:'Ingredientes',recipes:'Recetas',products:'Productos y ventas',sourdough:'Mi masa madre',history:'Historial',finance:'Finanzas'};
let currentUser=null;
let currentView='dashboard';
function navigateTo(view,{focus=false}={}) {
  if(!Object.hasOwn(VIEWS,view))return;
  if(view==='finance'&&document.querySelector('[data-view-target="finance"]')?.hidden)return;
  currentView=view;
  if(view==='recipes')void loadCatalog();
  if(view==='finance')void loadFinances();
  if(view==='sourdough')window.PanikoSourdough?.refresh?.();
  for(const section of document.querySelectorAll('[data-view]'))section.hidden=section.dataset.view!==view;
  for(const button of document.querySelectorAll('.nav-link')){
    const selected=button.dataset.viewTarget===view;
    button.classList.toggle('active',selected);
    if(selected)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');
  }
  $('current-view-name').textContent=VIEWS[view];
  $('notification').hidden=true;
  window.scrollTo({top:0,behavior:'instant'});
  if(focus){const heading=document.querySelector(`[data-view="${view}"] h1`);if(heading){heading.tabIndex=-1;heading.focus({preventScroll:true});}}
}
for(const button of document.querySelectorAll('[data-view-target]')){
  button.addEventListener('click',()=>navigateTo(button.dataset.viewTarget,{focus:true}));
}
window.PanikoNavigate=navigateTo;
function renderIngredientList(){
  const root=$('ingredient-list'),query=normalizeSearch($('ingredient-search').value.trim());
  root.replaceChildren();
  const list=ingredients.filter(i=>normalizeSearch(i.name).includes(query));
  for(const item of list){
    const line=make('div',undefined,'inventory-item');
    const details=make('div');details.append(make('strong',item.name));
    if(currentUser?.role==='admin')details.append(make('small',`${money(item.costPerUnit)} por ${item.unit}`));
    const count=make('span',`${item.stock} ${item.unit}`,item.stock<=0?'stock-value zero':'stock-value');
    line.append(details,count);root.append(line);
  }
  if(!list.length)root.append(make('p',ingredients.length?'No se encontraron ingredientes.':'Todavía no hay ingredientes registrados.','muted'));
}
function displayPercentage(number){
  return typeof number==='number'?new Intl.NumberFormat('es-MX',{maximumFractionDigits:2}).format(number)+' %':'—';
}
function renderBakerPercentages(root,data){
  root.replaceChildren();
  if(!data.available){root.append(make('p',data.note,'muted'));return;}
  root.append(make('p',`Harinas totales: ${data.totalFlourGrams} g = 100 %`,'baker-base'));
  const table=make('table',undefined,'baker-table');
  const header=make('thead');const tr=make('tr');
  for(const label of ['Ingrediente','Cantidad de la ficha','Peso equivalente','% panadero'])tr.append(make('th',label));
  header.append(tr);table.append(header);
  const body=make('tbody');
  for(const row of data.lines){
    const line=make('tr');
    for(const label of [row.name,`${row.quantity} ${row.unit}`,
      row.weightGrams===null?'Sin equivalencia':`${Math.round(row.weightGrams*1e6)/1e6} g`,
      displayPercentage(row.percentage)])line.append(make('td',label));
    body.append(line);
  }
  table.append(body);root.append(table);
  root.append(make('p',data.note,'hint'));
  if(data.lines.some(row=>row.percentage===null))
    root.append(make('p','Las unidades sin equivalencia de peso se muestran sin porcentaje.','hint'));
}
function renderRecipeList(){
  const root=$('recipe-list'),query=normalizeSearch($('recipe-search').value.trim());
  root.replaceChildren();
  const list=recipes.filter(r=>normalizeSearch(r.name).includes(query));
  for(const recipe of list){
    const line=make('div',undefined,'inventory-item recipe-card');
    const details=make('div');details.append(make('strong',recipe.name),make('small',`${recipe.items.length} ingredientes · Rendimiento base: ${recipe.baseYield} ${yieldLabel(recipe.yieldUnit)}`));
    const use=make('button','Preparar','secondary');use.type='button';
    use.addEventListener('click',()=>{
      navigateTo('production');$('scale-form').elements.recipe.value=recipe.id;
      $('scale-form').elements.recipe.dispatchEvent(new Event('change'));
      window.PanikoFinishedProducts?.updateProductionOptions?.();
      $('scale-form').elements.desiredYield.value=String(recipe.baseYield);
      resetCapacitySuggestion();
    });
    const percentButton=make('button','Ver % panadero','secondary');percentButton.type='button';
    percentButton.setAttribute('aria-expanded','false');
    const detail=make('div',undefined,'baker-detail');detail.hidden=true;
    let percentLoaded=false;
    percentButton.addEventListener('click',async()=>{
      if(!detail.hidden){detail.hidden=true;percentButton.textContent='Ver % panadero';percentButton.setAttribute('aria-expanded','false');return;}
      detail.hidden=false;percentButton.textContent='Ocultar %';percentButton.setAttribute('aria-expanded','true');
      if(percentLoaded)return;
      detail.replaceChildren(make('p','Calculando porcentaje panadero…','muted'));
      percentButton.disabled=true;
      try{
        const formula=await api(`/api/recipes/${recipe.id}/bakers`);
        renderBakerPercentages(detail,formula);percentLoaded=true;
      }catch(error){detail.replaceChildren(make('p',error.message,'warning'));}
      finally{percentButton.disabled=false;}
    });
    const edit=make('button','Editar ficha','btn-soft');edit.type='button';
    edit.addEventListener('click',()=>startEditingRecipe(recipe));
    const actions=make('div',undefined,'recipe-actions');actions.append(edit,percentButton,use);
    line.append(details,actions,detail);root.append(line);
  }
  if(!list.length)root.append(make('p',recipes.length?'No se encontraron recetas.':'Todavía no hay fichas técnicas.','muted'));
}
$('ingredient-search').addEventListener('input',renderIngredientList);
$('recipe-search').addEventListener('input',()=>{renderRecipeList();catalogLoaded=false;void loadCatalog(true);});

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
function availableUnits(unit,name='') {
  const key=normalizeSearch(name).trim().replace(/\s+/g,' ');
  if(/^huevos?(?: (?:grandes?|medianos?|chicos?|enteros?))?$/.test(key)&&['pieza','g','kg'].includes(unit))
    return ['pieza','g','kg'];
  if(/^agua(?: (?:potable|purificada|filtrada))?$/.test(key)&&['g','kg','ml','l'].includes(unit))
    return ['g','kg','ml','l'];
  if(/^leche(?: (?:entera|tibia|fria|liquida|fresca|pasteurizada|deslactosada|descremada|semidescremada|de vaca|sin lactosa))*$/.test(key)&&['g','kg','ml','l'].includes(unit))
    return ['g','kg','ml','l'];
  if (['g','kg'].includes(unit)) return ['g','kg'];
  if (['ml','l'].includes(unit)) return ['ml','l'];
  return unit === 'pieza' ? ['pieza'] : [];
}
function setUnitOptions(select, ingredientId) {
  const ing=ingredients.find(i=>i.id===ingredientId);
  const previous=select.value;
  const allowed=availableUnits(ing?.unit,ing?.name);
  select.replaceChildren();
  for (const unit of allowed) {
    const option=make('option',unit);option.value=unit;select.append(option);
  }
  if (allowed.includes(previous))select.value=previous;
  else if(ing)select.value=ing.unit;
}
function syncStockUnit() {
  setUnitOptions($('stock-in-form').elements.unit,$('stock-in-form').elements.ingredient.value);
}
function syncStockOutUnit(){
  const form=$('stock-out-form');setUnitOptions(form.elements.unit,form.elements.ingredient.value);
}
function syncAdjustUnit(){
  const id=$('adjust-stock-form').elements.ingredient.value;
  $('adjust-unit-label').textContent=ingredients.find(i=>i.id===id)?.unit||'unidad';
}
function resetRecipeEditor(){
  editingRecipeId=null;
  const form=$('recipe-form');form.reset();form.elements.yieldUnit.value='pieza';
  $('recipe-items').replaceChildren();addRecipeItem();
  $('recipe-save-button').textContent='Guardar ficha técnica';
  $('recipe-cancel-button').hidden=true;$('recipe-edit-hint').hidden=true;
  $('baker-form-preview').hidden=true;$('baker-form-preview').replaceChildren();
}
function startEditingRecipe(recipe){
  editingRecipeId=recipe.id;
  navigateTo('recipes');$('recipe-create-details').open=true;
  const form=$('recipe-form');form.elements.name.value=recipe.name;
  form.elements.yield.value=String(recipe.baseYield);form.elements.yieldUnit.value=recipe.yieldUnit||'pieza';
  $('recipe-items').replaceChildren();
  for(const item of recipe.items)addRecipeItem(item);
  $('recipe-save-button').textContent='Guardar cambios';
  $('recipe-cancel-button').hidden=false;$('recipe-edit-hint').hidden=false;
  $('baker-form-preview').hidden=true;$('baker-form-preview').replaceChildren();
  $('recipe-create-details').scrollIntoView({block:'start',behavior:'smooth'});
}
$('recipe-cancel-button').addEventListener('click',resetRecipeEditor);
function addRecipeItem(defaults=null) {
  const row=make('div',undefined,'item-row');
  const select=make('select');select.setAttribute('aria-label','Ingrediente');
  fillSelect(select,ingredients,'Registra ingredientes antes');
  const quantity=make('input');
  quantity.type='number';quantity.min='0.000001';quantity.step='0.000001';quantity.required=true;
  quantity.placeholder='Cantidad';quantity.setAttribute('aria-label','Cantidad base');
  const unit=make('select');unit.className='recipe-unit';unit.setAttribute('aria-label','Unidad');
  const remove=make('button','Quitar','secondary');remove.type='button';
  remove.addEventListener('click',()=>row.remove());
  select.addEventListener('change',()=>setUnitOptions(unit,select.value));
  row.append(select,quantity,unit,remove);$('recipe-items').append(row);
  if(defaults?.ingredientId){select.value=defaults.ingredientId;quantity.value=String(defaults.quantity);}
  setUnitOptions(unit,select.value);
  if(defaults?.unit&&[...unit.options].some(o=>o.value===defaults.unit))unit.value=defaults.unit;
}
function formatProductionDate(value){
  if(!value)return 'Fecha no disponible';
  const date=new Date(value);
  return Number.isNaN(date.getTime())?'Fecha no disponible':date.toLocaleString('es-MX',{dateStyle:'medium',timeStyle:'short'});
}
function renderBatchDetail(container,detail){
  container.replaceChildren();
  container.append(make('p',`Lote: ${detail.id}`,'muted'));
  container.append(make('p',`Confirmado: ${formatProductionDate(detail.createdAt)}`+(currentUser?.role==='admin'?` · Costo estimado del lote: ${money(detail.estimatedTotalCost)}`:'')));
  container.append(make('h4','Ingredientes descontados'));
  if(!detail.lines?.length)container.append(make('p','Sin consumos registrados.','muted'));
  for(const line of detail.lines||[]){
    const previous=line.stockBefore===null?'':` · stock ${line.stockBefore} → ${line.stockAfter} ${line.unit}`;
    container.append(make('div',`${line.name}: ${line.quantity} ${line.unit}`+(currentUser?.role==='admin'?` · costo estimado ${money(line.estimatedCost)}`:'')+previous,'list-row'));
  }
  if(detail.finishedProduct){
    const p=detail.finishedProduct;
    container.append(make('p',`Producto terminado: ${p.name} · +${p.quantity} piezas · inventario ${p.before} → ${p.after} piezas`,'good'));
  }else container.append(make('p','Sin producto terminado vinculado a este lote.','muted'));
}
function renderProductionHistory(){
  const root=$('production-list'), filter=$('production-filter').value;
  root.replaceChildren();
  const batches=productionBatches.filter(b=>!filter||b.recipeId===filter);
  root.append(make('p',`${batches.length} lote(s) en el historial mostrado.`,'muted'));
  for(const batch of batches){
    const section=make('div',undefined,'list-row');
    const costPerUnit=batch.desiredYield>0?money(batch.estimatedTotalCost/batch.desiredYield):'—';
    const finance=currentUser?.role==='admin'?` · ${money(batch.estimatedTotalCost)} (${costPerUnit}/${yieldLabel(batch.yieldUnit)})`:'';
    section.append(make('div',`${formatProductionDate(batch.createdAt)} · ${batch.recipeName} · ${batch.desiredYield} ${yieldLabel(batch.yieldUnit)}${finance}`));
    const button=make('button','Ver detalle','secondary');button.type='button';button.setAttribute('aria-expanded','false');
    const detail=make('div',undefined,'production-detail');detail.hidden=true;
    let loaded=false;
    button.addEventListener('click',async()=>{
      if(!detail.hidden){detail.hidden=true;button.textContent='Ver detalle';button.setAttribute('aria-expanded','false');return;}
      detail.hidden=false;button.textContent='Ocultar detalle';button.setAttribute('aria-expanded','true');
      if(loaded)return;
      button.disabled=true;detail.replaceChildren(make('p','Cargando detalle del lote…','muted'));
      try{
        const data=await api(`/api/production/${batch.id}`);
        renderBatchDetail(detail,data);loaded=true;
      }catch(error){detail.replaceChildren(make('p',error.message,'warning'));}
      finally{button.disabled=false;}
    });
    section.append(button,detail);root.append(section);
  }
  if(!batches.length)root.append(make('p','No hay lotes para este filtro.','muted'));
}
function syncProductionFilter(){
  const select=$('production-filter'),old=select.value;
  const byRecipe=new Map(productionBatches.map(b=>[b.recipeId,b.recipeName]));
  select.replaceChildren();
  const all=make('option','Todas las recetas');all.value='';select.append(all);
  for(const [id,name] of [...byRecipe].sort((a,b)=>a[1].localeCompare(b[1],'es'))){
    const opt=make('option',name);opt.value=id;select.append(opt);
  }
  if(byRecipe.has(old))select.value=old;
}
function render(movements, batches) {
  renderIngredientList();renderRecipeList();
  $('dashboard-ingredients').textContent=String(ingredients.length);
  $('dashboard-recipes').textContent=String(recipes.length);
  $('dashboard-batches').textContent=String(batches.length);
  fillSelect($('scale-form').elements.recipe, recipes, 'Crea primero una receta');
  fillSelect($('stock-in-form').elements.ingredient, ingredients, 'Registra primero un ingrediente');
  fillSelect($('stock-out-form').elements.ingredient,ingredients,'Registra primero un ingrediente');
  fillSelect($('adjust-stock-form').elements.ingredient,ingredients,'Registra primero un ingrediente');
  syncStockUnit();syncStockOutUnit();syncAdjustUnit();
  for (const row of $('recipe-items').children) {
    const select=row.querySelector('select');
    fillSelect(select, ingredients, 'Registra ingredientes antes');
    setUnitOptions(row.querySelector('.recipe-unit'),select.value);
  }
  $('movement-list').replaceChildren();
  for (const item of movements.slice(0,12)) {
    $('movement-list').append(make('div', `${item.type==='entrada'?'Entrada':'Salida'} · ${item.name} · ${item.quantity} · ${item.reason}`, 'list-row'));
  }
  if (!movements.length) $('movement-list').append(make('p', 'Todavía no hay movimientos.', 'muted'));
  productionBatches=batches;
  syncProductionFilter();renderProductionHistory();
}
window.PanikoRefreshInventory=()=>refresh();
async function refresh() {
  const [ings,recs,movements,batches]=await Promise.all([
    api('/api/ingredients'),api('/api/recipes'),api('/api/inventory/movements'),api('/api/production')]);
  ingredients=ings;recipes=recs;render(movements,batches);
  window.PanikoFinishedProducts?.updateProductionOptions?.();
  syncProductionUnit();resetCapacitySuggestion();
  document.dispatchEvent(new Event('paniko:inventory-refreshed'));
}
$('production-filter').addEventListener('change',renderProductionHistory);
$('add-item').addEventListener('click', addRecipeItem);
$('stock-in-form').elements.ingredient.addEventListener('change',syncStockUnit);
$('stock-out-form').elements.ingredient.addEventListener('change',syncStockOutUnit);
$('adjust-stock-form').elements.ingredient.addEventListener('change',syncAdjustUnit);
$('ingredient-form').addEventListener('submit', async (event) => {
  event.preventDefault(); const form = event.currentTarget;
  try {
    await post('/api/ingredients', {name:form.elements.name.value,unit:form.elements.unit.value,costPerUnit:currentUser?.role==='admin'?Number(form.elements.cost.value||0):0,stock:Number(form.elements.stock.value)});
    form.reset(); await refresh(); notify('Ingrediente registrado.');
  } catch (error) { notify(error.message, true); }
});
function currentRecipeInput(form){
  return {name:form.elements.name.value,baseYield:Number(form.elements.yield.value),yieldUnit:form.elements.yieldUnit.value,
    items:[...$('recipe-items').children].map(row=>({ingredientId:row.querySelector('select').value,
      quantity:Number(row.querySelector('input').value),unit:row.querySelector('.recipe-unit').value}))};
}
$('baker-preview-button').addEventListener('click',async()=>{
  const form=$('recipe-form');
  if(!form.reportValidity()){notify('Completa la ficha antes de calcular los porcentajes.',true);return;}
  const result=$('baker-form-preview');result.hidden=false;
  try{
    if(!$('recipe-items').children.length)throw new Error('Añade ingredientes para calcular el porcentaje.');
    const percentages=await post('/api/recipes/bakers-preview',currentRecipeInput(form));
    renderBakerPercentages(result,percentages);
  }catch(error){result.replaceChildren(make('p',error.message,'warning'));}
});
$('recipe-form').addEventListener('input',()=>{const container=$('baker-form-preview');container.hidden=true;container.replaceChildren();});
$('recipe-form').addEventListener('submit', async (event) => {
  event.preventDefault(); const form = event.currentTarget;
  const rows = [...$('recipe-items').children];
  try {
    if (!rows.length) throw new Error('Añade al menos un ingrediente.');
    const wasEditing=Boolean(editingRecipeId);
    const url=wasEditing?`/api/recipes/${editingRecipeId}/update`:'/api/recipes';
    await post(url,currentRecipeInput(form));
    resetRecipeEditor();
    $('baker-form-preview').hidden=true;$('baker-form-preview').replaceChildren();
    await refresh(); notify(wasEditing?'Ficha técnica actualizada. No se modificó el inventario.':'Ficha técnica guardada.');
  } catch (error) { notify(error.message, true); }
});
$('stock-in-form').addEventListener('submit',async(event)=>{
  event.preventDefault();const form=event.currentTarget;
  try {
    await post(`/api/ingredients/${form.elements.ingredient.value}/stock-in`,{quantity:Number(form.elements.quantity.value),unit:form.elements.unit.value,reason:form.elements.reason.value});
    form.elements.quantity.value='';await refresh();notify('Entrada de inventario guardada.');
  }catch(error){notify(error.message,true);}
});
$('stock-out-form').addEventListener('submit',async event=>{
  event.preventDefault();const form=event.currentTarget;
  try{
    await post(`/api/ingredients/${form.elements.ingredient.value}/stock-out`,{
      quantity:Number(form.elements.quantity.value),unit:form.elements.unit.value,reason:form.elements.reason.value});
    form.elements.quantity.value='';await refresh();notify('Salida de ingrediente registrada.');
  }catch(error){notify(error.message,true);}
});
$('adjust-stock-form').addEventListener('submit',async event=>{
  event.preventDefault();const form=event.currentTarget;
  try{
    if(!confirm('¿Confirmas el conteo físico? Se modificará la existencia y quedará registrado en el historial.'))return;
    await post(`/api/ingredients/${form.elements.ingredient.value}/adjust-stock`,{
      newStock:Number(form.elements.newStock.value),reason:form.elements.reason.value});
    form.elements.newStock.value='';form.elements.reason.value='';await refresh();notify('Existencia ajustada. Movimiento registrado.');
  }catch(error){notify(error.message,true);}
});
function renderPreview(result) {
  const container=$('scale-results');container.replaceChildren();
  $('produce-button').disabled=!result.stockAvailable;
  container.append(make('p', `${result.recipeName} · ${result.desiredYield} ${yieldLabel(result.yieldUnit)}`+(currentUser?.role==='admin'?` · costo estimado ${money(result.estimatedTotalCost)}`:'')));
  container.append(make('p', `Capacidad con existencias actuales: hasta ${result.maxProducible} ${yieldLabel(result.yieldUnit)}.`, result.maxProducible>0?'good':'warning'));
  if(result.limitingIngredients?.length)container.append(make('p', `Insumo(s) limitante(s): ${result.limitingIngredients.join(', ')}`, 'muted'));
  for(const line of result.lines){
    const detail=`${line.name}: necesita ${line.required} ${line.unit} · disponible ${line.stock} ${line.unit}`+
      (line.shortage>0?` · faltan ${line.shortage} ${line.unit}`:'')+(currentUser?.role==='admin'?` · ${money(line.estimatedCost)}`:'');
    container.append(make('div',detail,`list-row ${line.sufficient?'':'warning'}`));
  }
  if(result.bakers){
    const accordion=make('details',undefined,'baker-preview');
    accordion.append(make('summary','Ver porcentajes panaderos (harinas = 100 %)'));
    const content=make('div',undefined,'baker-detail');
    renderBakerPercentages(content,result.bakers);accordion.append(content);
    container.append(accordion);
  }
  container.append(make('p', result.stockAvailable?'Inventario suficiente para esta producción.':'Inventario insuficiente. No se puede confirmar la producción.', result.stockAvailable?'good':'warning'));
  const maxButton=$('max-production-button');
  maxButton.disabled=!Number.isSafeInteger(result.maxProducible)||result.maxProducible<1;
  maxButton.dataset.maximum=String(result.maxProducible);
  maxButton.dataset.recipeId=result.recipeId;
}
async function selectedPreview(){
  const form=$('scale-form');
  if(!form.reportValidity()) throw new Error('Completa los datos para producir.');
  const recipeId=form.elements.recipe.value, desiredYield=Number(form.elements.desiredYield.value);
  const result=await post(`/api/recipes/${recipeId}/scale`,{desiredYield});
  renderPreview(result);
  return result;
}
function resetCapacitySuggestion(){
  const button=$('max-production-button');
  button.disabled=true;delete button.dataset.maximum;delete button.dataset.recipeId;
  $('produce-button').disabled=true;
  const placeholder=make('div',undefined,'empty-state');
  const symbol=make('span','✳');symbol.className='preview-symbol';
  placeholder.append(symbol,make('strong','Tu cálculo aparecerá aquí'),make('p','Selecciona una receta y pulsa «Calcular ingredientes».'));
  $('scale-results').replaceChildren(placeholder);
}
function syncProductionUnit(){
  const r=recipes.find(x=>x.id===$('scale-form').elements.recipe.value);
  $('production-amount-label').textContent='Cantidad que quieres preparar ('+yieldLabel(r?.yieldUnit)+')';
  if(r&&(r.yieldUnit||'pieza')!=='pieza')$('finished-product-selector').value='';
}
$('scale-form').elements.recipe.addEventListener('change',()=>{syncProductionUnit();resetCapacitySuggestion();});
$('scale-form').elements.desiredYield.addEventListener('input',resetCapacitySuggestion);
$('max-production-button').addEventListener('click',()=>{
  const button=$('max-production-button');
  const form=$('scale-form');
  const maximum=Number(button.dataset.maximum);
  if(button.disabled||button.dataset.recipeId!==form.elements.recipe.value||
     !Number.isSafeInteger(maximum)||maximum<1)return;
  form.elements.desiredYield.value=String(maximum);
  resetCapacitySuggestion();
  const recipe=recipes.find(r=>r.id===form.elements.recipe.value);
  notify(`Cantidad ajustada a ${maximum} ${yieldLabel(recipe?.yieldUnit)}. Calcula la vista previa de nuevo para confirmar.`);
});
$('scale-form').addEventListener('submit', async(event)=>{
  event.preventDefault();try{await selectedPreview();notify('Vista previa calculada. No se modificó el inventario.');}catch(e){notify(e.message,true);}
});
$('produce-button').addEventListener('click',async()=>{
  try {
    const result=await selectedPreview();
    if(!result.stockAvailable) throw new Error('No puedes confirmar: inventario insuficiente.');
    const selectedProduct=$('finished-product-selector').value;
    const details=selectedProduct?'También aumentará la existencia del producto terminado vinculado.':'No se seleccionó producto terminado; solo se descontarán ingredientes.';
    if(!confirm(`¿Confirmas ${result.desiredYield} ${yieldLabel(result.yieldUnit)} de ${result.recipeName}? Se descontarán ingredientes. ${details}`)) return;
    const done=await post(`/api/recipes/${result.recipeId}/produce`,{desiredYield:result.desiredYield,productId:selectedProduct||null});
    await refresh();await window.PanikoFinishedProducts?.refresh?.();
    document.dispatchEvent(new Event('paniko:production-saved'));
    resetCapacitySuggestion();
    notify(done.finishedProduct ? `Producción registrada: ingredientes descontados y ${done.desiredYield} piezas añadidas a ${done.finishedProduct.name}.` : `Producción confirmada (${done.id}). Solo se descontaron ingredientes: no seleccionaste un producto vinculado.`);
  }catch(e){notify(e.message,true);}
});
function showAuthUI(user,required){
  $('workspace').hidden=Boolean(required&&!user);
  $('auth-panel').hidden=Boolean(!required||user);
  $('auth-bar').hidden=Boolean(!required||!user);
  currentUser=user;
  const admin=Boolean(user?.role==='admin');
  document.querySelector('[data-view-target="finance"]').hidden=!admin;
  $('ingredient-cost-field').hidden=!admin;
  $('ingredient-create-details').hidden=false;
  $('recipe-create-details').hidden=false;
  $('stock-adjust-panel').hidden=false;
  if(user){$('auth-user').textContent=user.username+' ('+(admin?'Administración':'Operación')+')';
    document.querySelector('.avatar').textContent=user.username.slice(0,1).toUpperCase();}
  if(!user){$('notification').hidden=true;currentView='dashboard';}
  navigateTo(currentView==='finance'&&!admin?'dashboard':currentView);
  document.dispatchEvent(new CustomEvent('paniko:auth',{detail:{user,required}}));
}
$('login-form').addEventListener('submit',async event=>{
  event.preventDefault();const form=event.currentTarget;
  try{
    const data=await post('/api/auth/login',{username:form.elements.username.value,password:form.elements.password.value});
    form.elements.password.value='';$('auth-message').textContent='';
    showAuthUI(data.user,true);await refresh();
  }catch(error){form.elements.password.value='';$('auth-message').textContent=error.message;}
});
$('logout-button').addEventListener('click',async()=>{
  try{await post('/api/auth/logout',{});}catch(error){notify(error.message,true);}
  $('recipe-catalog-list').replaceChildren();catalogLoaded=false;showAuthUI(null,true);
});
let catalogLoaded=false;
let catalogBusy=false;
function catalogEditForm(record,owner){
  const data=record.data||{},sourceItems=Array.isArray(data.ingredientes)?data.ingredientes:[];
  const form=make('form',undefined,'form-stack catalog-edit-form');
  const heading=make('h4','Completar y revisar receta original');
  const help=make('p','Guardar pendiente conserva los datos aunque falten cantidades. Confirmar valida los datos necesarios para crear una ficha técnica. Ninguna opción descuenta inventario.','hint');
  const nameLabel=make('label','Nombre de la receta');
  const nameInput=make('input');nameInput.required=true;nameInput.maxLength=100;nameInput.value=data.nombre||record.title;
  nameLabel.append(nameInput);
  const yieldRow=make('div',undefined,'input-pair');
  const yieldLabel=make('label','Rendimiento del lote');
  const yieldInput=make('input');yieldInput.type='number';yieldInput.min='0.000001';yieldInput.max='1000000000';yieldInput.step='any';yieldInput.value=data.rendimiento?.cantidad??'';yieldInput.placeholder='Cantidad por confirmar';yieldLabel.append(yieldInput);
  const yieldUnitLabel=make('label','Unidad del rendimiento');
  const yieldUnit=make('select');
  const yieldUnits=[...new Set([data.rendimiento?.unidad,'pieza','piezas','kg','g','l','ml'].filter(Boolean))];
  for(const item of yieldUnits){const option=make('option',item);option.value=item;yieldUnit.append(option);}
  yieldUnit.value=data.rendimiento?.unidad||'pieza';yieldUnitLabel.append(yieldUnit);yieldRow.append(yieldLabel,yieldUnitLabel);
  const itemList=make('div',undefined,'catalog-edit-items');
  const available=['g','kg','ml','l','pieza'];
  function addSourceItem(source={}){
    const row=make('div',undefined,'catalog-edit-item');
    const name=make('input');name.type='text';name.required=true;name.maxLength=100;name.value=source.ingrediente||'';name.placeholder='Ingrediente';name.setAttribute('aria-label','Nombre del ingrediente');
    const quantity=make('input');quantity.type='number';quantity.min='0.000001';quantity.max='1000000000';quantity.step='0.000001';quantity.value=source.cantidad??'';quantity.placeholder='Por confirmar';quantity.setAttribute('aria-label','Cantidad del ingrediente');
    const unit=make('select');unit.setAttribute('aria-label','Unidad del ingrediente');
    for(const u of [...new Set([source.unidad,...available].filter(Boolean))]){const option=make('option',u);option.value=u;unit.append(option);}
    unit.value=source.unidad||'g';
    const remove=make('button','Quitar','secondary');remove.type='button';remove.addEventListener('click',()=>row.remove());
    row.append(name,quantity,unit,remove);itemList.append(row);
  }
  for(const item of sourceItems)addSourceItem(item);
  const add=make('button','+ Añadir ingrediente','btn-soft');add.type='button';add.addEventListener('click',()=>addSourceItem());
  const notesLabel=make('label','Observaciones');const notes=make('textarea');notes.maxLength=3000;notes.rows=3;notes.value=data.observaciones||'';notesLabel.append(notes);
  const actionRow=make('div',undefined,'recipe-actions');
  const draft=make('button','Guardar pendiente','btn-soft');draft.type='button';
  const confirmButton=make('button','Confirmar datos','btn-primary');confirmButton.type='button';
  const cancel=make('button','Cerrar','secondary');cancel.type='button';cancel.addEventListener('click',()=>form.remove());
  async function save(confirm){
    const items=[...itemList.children].map(row=>({name:row.children[0].value,quantity:row.children[1].value===''?null:Number(row.children[1].value),unit:row.children[2].value}));
    if(!form.reportValidity()){notify('Revisa los campos marcados.',true);return;}
    draft.disabled=true;confirmButton.disabled=true;
    try{
      await post(`/api/catalog/recipes/${data.id}/save`,{name:nameInput.value,
        yieldQuantity:yieldInput.value===''?null:Number(yieldInput.value),yieldUnit:yieldUnit.value,
        items,notes:notes.value,confirm});
      catalogLoaded=false;await loadCatalog(true);
      notify(confirm?'Receta confirmada. Ya puedes crear su ficha técnica.':'Cambios guardados como pendientes.');
    }catch(error){notify(error.message,true);}finally{draft.disabled=false;confirmButton.disabled=false;}
  }
  draft.addEventListener('click',()=>save(false));confirmButton.addEventListener('click',()=>save(true));
  actionRow.append(draft,confirmButton,cancel);
  form.append(heading,help,nameLabel,yieldRow,make('h4','Ingredientes'),itemList,add,notesLabel,actionRow);
  owner.append(form);
}
async function loadCatalog(force=false){
  if(!currentUser || (catalogLoaded&&!force) || catalogBusy)return;
  catalogBusy=true;
  const root=$('recipe-catalog-list');root.replaceChildren(make('p','Cargando preparaciones…','muted'));
  try{
    const catalog=await api('/api/private/catalog');
    root.replaceChildren();
    const all=[...(catalog.recetas||[]).map(record=>({...record,kind:'Preparación'})),
      ...(catalog.rellenos||[]).map(record=>({...record,kind:'Relleno'}))];
    if(!all.length)root.append(make('p','Todavía no hay preparaciones adicionales registradas.','muted'));
    const query=normalizeSearch($('recipe-search').value.trim());
    const filtered=all.filter(record=>normalizeSearch(record.title).includes(query));
    const pieceUnits=['pieza','piezas','panes','hogazas','baguettes','panques','bollos','galletas','unidades','porciones','croissants','rollos'];
    const candidates=all.filter(record=>{
      const data=record.data||{};
      return record.kind==='Preparación'&&data.id&&data.estado==='confirmada'&&
        !data.componentes?.length&&Boolean(normalizedCatalogYield(data.rendimiento))&&
        Array.isArray(data.ingredientes)&&data.ingredientes.length>0&&
        data.ingredientes.every(i=>Number.isFinite(i.cantidad)&&i.cantidad>0&&['g','kg','ml','l','pieza'].includes(i.unidad))&&
        !recipes.some(r=>normalizeSearch(r.name)===normalizeSearch(record.title));
    });
    if(candidates.length){
      const bulk=make('button',`Crear las ${candidates.length} fichas completas`,'btn-primary');bulk.type='button';
      bulk.addEventListener('click',async()=>{
        if(!confirm(`Se crearán ${candidates.length} fichas técnicas a partir de tus recetas, sin descontar inventario. Los ingredientes faltantes se registrarán con existencia y costo cero. ¿Continuar?`))return;
        bulk.disabled=true;let created=0,errors=[];
        for(const record of candidates){
          try{
            const result=await post(`/api/recipes/from-catalog/${record.data.id}`,normalizedCatalogYield(record.data.rendimiento));
            if(!result.existing)created++;
          }catch(error){errors.push(record.title+': '+error.message);}
        }
        await refresh();catalogLoaded=false;
        notify(`${created} fichas técnicas creadas.`+(errors.length?` ${errors.length} pendientes: ${errors.join('; ')}`:''),errors.length>0);
        void loadCatalog(true);
      });
      root.append(bulk,make('p','Solo se incluyen fórmulas confirmadas con rendimiento conocido en piezas, peso o volumen e ingredientes completos.','hint'));
    }
    for(const record of filtered){
      const data=record.data||{};
      const details=make('details',undefined,'catalog-recipe');
      const summary=make('summary',undefined);
      summary.append(make('strong',record.title),make('span',record.kind,'recipe-status'));
      details.append(summary);
      const yieldInfo=data.rendimiento;
      if(yieldInfo&&yieldInfo.cantidad)details.append(make('p',`Rendimiento: ${yieldInfo.cantidad} ${yieldInfo.unidad||''}`,'muted'));
      if(record.status)details.append(make('p',`Estado: ${record.status}`,'muted'));
      if(Array.isArray(data.ingredientes)&&data.ingredientes.length){
        details.append(make('h4','Ingredientes'));
        for(const ingredient of data.ingredientes){
          const amount=ingredient.cantidad??(ingredient.minimo!==undefined?`${ingredient.minimo}–${ingredient.maximo}`:'Cantidad por definir');
          details.append(make('div',`${ingredient.ingrediente}: ${amount} ${ingredient.unidad||''}`,'list-row'));
        }
      }
      if(Array.isArray(data.componentes)&&data.componentes.length){
        details.append(make('h4','Subpreparaciones'));
        for(const item of data.componentes)details.append(make('p',item.nombre||item.id||'Componente','muted'));
      }
      if(data.observaciones)details.append(make('p',`Notas: ${data.observaciones}`,'muted'));
      if(record.kind==='Preparación'&&data.id){
        const editOriginal=make('button',data.estado==='confirmada'?'Editar receta original':'Completar receta pendiente','btn-soft');
        editOriginal.type='button';editOriginal.addEventListener('click',()=>{
          if(details.querySelector('.catalog-edit-form')){details.querySelector('.catalog-edit-form').remove();return;}
          catalogEditForm(record,details);
        });
        details.append(editOriginal);
      }
      const already=recipes.some(r=>normalizeSearch(r.name)===normalizeSearch(record.title));
      const canConvert=record.kind==='Preparación' && data.id && /^[a-z][a-z0-9_]{0,99}$/.test(data.id);
      if(already){
        details.append(make('p','Ficha técnica disponible. Puedes escalarla en Producción.','good'));
      }else if(canConvert){
        const items=Array.isArray(data.ingredientes)?data.ingredientes:[];
        const problems=[];
        if(data.estado!=='confirmada')problems.push('Fórmula pendiente de validación');
        if(data.componentes?.length)problems.push('Tiene subpreparaciones que debes revisar');
        for(const i of items){
          if(typeof i.cantidad!=='number'||i.cantidad<=0)problems.push(`${i.ingrediente||'Ingrediente'}: falta cantidad exacta`);
          if(!['g','kg','ml','l','pieza'].includes(i.unidad))problems.push(`${i.ingrediente||'Ingrediente'}: unidad por definir`);
        }
        if(!items.length)problems.push('No tiene ingredientes completos');
        if(problems.length){
          details.append(make('p','Ficha pendiente: '+problems.join('; ')+'.','warning'));
        }else{
          const ready=normalizedCatalogYield(data.rendimiento);
          let yieldField=null,unitField=null;
          if(!ready){
            const label=make('label','Rendimiento real del lote (no se calcula automáticamente)');
            yieldField=make('input');yieldField.type='number';yieldField.min='1';yieldField.step='1';yieldField.max='1000000000';yieldField.placeholder='Cantidad confirmada';
            unitField=make('select');
            for(const [value,name] of [['pieza','Piezas'],['g','Gramos (g)'],['kg','Kilogramos (kg)'],['ml','Mililitros (ml)'],['l','Litros (l)']]){const o=make('option',name);o.value=value;unitField.append(o);}
            unitField.value=['g','kg','ml','l'].includes(data.rendimiento?.unidad)?data.rendimiento.unidad:'g';
            label.append(yieldField,unitField);details.append(label,make('p','También puedes completar el rendimiento desde «Editar receta original».','hint'));
          }
          const create=make('button','Crear ficha técnica escalable','btn-primary');create.type='button';
          create.addEventListener('click',async()=>{
            const quantity=ready?ready:normalizedCatalogYield({cantidad:Number(yieldField?.value),unidad:unitField?.value});
            if(!quantity){notify('Indica un rendimiento real en piezas, g, kg, ml o l.',true);yieldField?.focus();return;}
            const {baseYield,yieldUnit}=quantity;
            const confirmation=`¿Crear la ficha de ${record.title} para ${baseYield} ${yieldLabel(yieldUnit)}? Se conectarán los ingredientes existentes. Si falta alguno, se registrará con existencia y costo cero. Esta acción NO descuenta inventario.`;
            if(!confirm(confirmation))return;
            create.disabled=true;
            try{
              const result=await post(`/api/recipes/from-catalog/${data.id}`,{baseYield,yieldUnit});
              await refresh();catalogLoaded=false;
              notify(result.existing?'La ficha ya existía; revisa su rendimiento.':`Ficha creada para ${baseYield} ${yieldLabel(yieldUnit)}. ${result.createdIngredients.length} ingredientes nuevos sin existencias.`);
              void loadCatalog(true);
            }catch(error){notify(error.message,true);create.disabled=false;}
          });
          details.append(create,make('p','No se modifica el inventario hasta confirmar una producción.','hint'));
        }
      }else{
        details.append(make('p','Relleno de consulta; se utiliza como ingrediente o preparación de otras recetas.','hint'));
      }
      root.append(details);
    }
    if(!filtered.length&&all.length)root.append(make('p','No hay preparaciones que coincidan con la búsqueda.','muted'));
    catalogLoaded=true;
  }catch(error){root.replaceChildren(make('p','No se pudieron cargar las preparaciones: '+error.message,'warning'));}
  finally{catalogBusy=false;}
}
$('refresh-recipe-catalog').addEventListener('click',()=>{catalogLoaded=false;void loadCatalog(true);});

async function loadFinances(){
  if(currentUser?.role!=='admin')return;
  const root=$('finance-ingredient-list');root.replaceChildren(make('p','Consultando costos…','muted'));
  try{
    const result=await api('/api/finance/overview');
    $('finance-inventory-value').textContent=money(result.inventoryValue);
    $('finance-batch-cost').textContent=money(result.recentBatchCost);
    root.replaceChildren();
    if(!result.ingredients.length)root.append(make('p','No hay ingredientes registrados.','muted'));
    for(const item of result.ingredients){
      const form=make('form',undefined,'finance-cost-row');
      const description=make('div');description.append(make('strong',item.name),make('small',`${item.stock} ${item.unit} · Valor: ${money(item.inventoryValue)}`));
      const label=make('label','Costo unitario (MXN)');
      const input=make('input');input.type='number';input.min='0';input.step='0.0001';input.value=String(item.costPerUnit);input.required=true;
      label.append(input);
      const save=make('button','Guardar costo','btn-soft');save.type='submit';
      form.append(description,label,save);
      form.addEventListener('submit',async event=>{
        event.preventDefault();save.disabled=true;
        try{await post(`/api/finance/ingredients/${item.id}/cost`,{costPerUnit:Number(input.value)});
          await loadFinances();await refresh();notify(`Costo de ${item.name} actualizado.`);
        }catch(error){notify(error.message,true);}finally{save.disabled=false;}
      });
      root.append(form);
    }
  }catch(error){root.replaceChildren(make('p',error.message,'warning'));}
  await Promise.all([loadProductFinances(),loadFinanceDashboard()]);
}

async function loadProductFinances(){
  if(currentUser?.role!=='admin')return;
  const root=$('finance-product-list');
  root.replaceChildren(make('p','Cargando costos y precios de productos…','muted'));
  try{
    const products=await api('/api/finance/products');
    root.replaceChildren();
    if(!products.length){root.append(make('p','Aún no hay productos terminados. Regístralos primero en Productos y ventas.','muted'));return;}
    for(const item of products){
      const form=make('form',undefined,'finance-cost-row');
      const title=make('div');title.append(make('strong',item.name),make('small',`${item.stock} piezas disponibles`));
      const costLabel=make('label','Costo de elaboración por pieza (MXN)');
      const cost=make('input');cost.type='number';cost.step='0.01';cost.min='0';cost.placeholder='Sin definir';
      cost.value=item.unitCost===null?'':String(item.unitCost);cost.setAttribute('aria-label',`Costo de elaboración de ${item.name}`);
      costLabel.append(cost);
      const priceLabel=make('label','Precio de venta por pieza (MXN)');
      const price=make('input');price.type='number';price.step='0.01';price.min='0';price.placeholder='Sin definir';
      price.value=item.salePrice===null?'':String(item.salePrice);price.setAttribute('aria-label',`Precio de venta de ${item.name}`);
      priceLabel.append(price);
      const save=make('button','Guardar costos y precio','btn-soft');save.type='submit';
      const note=make('small','Ambos importes son opcionales. No cambian el inventario ni las ventas anteriores.','muted');
      form.append(title,costLabel,priceLabel,save,note);
      form.addEventListener('submit',async event=>{
        event.preventDefault();if(!form.reportValidity())return;save.disabled=true;
        try{
          await post(`/api/finance/products/${item.id}/pricing`,{
            unitCost:cost.value===''?null:Number(cost.value),
            salePrice:price.value===''?null:Number(price.value)});
          await Promise.all([loadProductFinances(),loadFinanceDashboard()]);await window.PanikoFinishedProducts?.refresh?.();
          notify(`Costos y precio de ${item.name} actualizados.`);
        }catch(error){notify(error.message,true);save.disabled=false;}
      });
      root.append(form);
    }
  }catch(error){root.replaceChildren(make('p',error.message,'warning'));}
}

async function loadFinanceDashboard(){
  if(currentUser?.role!=='admin')return;
  const info=$('finance-summary-note');info.textContent='Calculando resumen…';
  try{
    const days=Number($('finance-period').value),r=await api(`/api/finance/dashboard?days=${days}`);
    for(const [id,value] of [['finance-revenue',r.knownRevenue],['finance-cogs',r.knownCostOfSales],['finance-expenses',r.expenses],['finance-gross',r.grossProfit],['finance-net',r.netProfit]])
      $(id).textContent=value===null?'Sin calcular':money(value);
    info.textContent=`${r.transactions} ventas desde el registro financiero · ${r.unitsSold} piezas. `+(r.legacySales?`${r.legacySales} ventas anteriores sin importe registrado. `:'')+(r.unpricedSales?`${r.unpricedSales} ventas sin precio. `:'')+(r.unknownCostSales?`${r.unknownCostSales} ventas sin costo. `:'')+r.note;
    info.className='hint'+(r.complete?'':' warning');
    const list=$('finance-recent-list');list.replaceChildren();
    const entries=[...r.sales.map(s=>({when:s.soldAt,title:`Venta · ${s.productName}`,detail:`${s.quantity} piezas · ${s.unitPrice===null?'Precio sin definir':money(s.quantity*s.unitPrice)}${s.unitCost===null?' · costo pendiente':''}`})),
      ...r.expenseList.map(e=>({when:e.expenseDate,title:`Gasto · ${e.category}`,detail:`${e.description} · ${money(e.amount)}`}))].sort((a,b)=>String(b.when).localeCompare(String(a.when))).slice(0,25);
    if(!entries.length)list.append(make('p','Todavía no hay ventas o gastos nuevos en este periodo.','muted'));
    for(const e of entries){const row=make('div',undefined,'finance-history-row');row.append(make('strong',e.title),make('small',e.detail),make('small',new Date(e.when).toLocaleDateString('es-MX')));list.append(row);}
  }catch(e){info.textContent=e.message;info.className='hint warning';}
}
$('finance-period').addEventListener('change',loadFinanceDashboard);
$('finance-expense-date').value=new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,10);
$('finance-expense-form').addEventListener('submit',async event=>{
  event.preventDefault();if(currentUser?.role!=='admin')return;
  const f=event.currentTarget,save=f.querySelector('[type=submit]');save.disabled=true;try{
    await post('/api/finance/expenses',{category:f.elements.category.value,description:f.elements.description.value,
      amount:Number(f.elements.amount.value),expenseDate:f.elements.expenseDate.value});
    f.elements.description.value='';f.elements.amount.value='';await loadFinanceDashboard();notify('Gasto guardado en el panel financiero.');
  }catch(e){notify(e.message,true);}finally{save.disabled=false;}
});

async function initializePaniko(){
  addRecipeItem();showAuthUI(null,true);
  try{
    const config=await api('/api/auth/config');
    if(config.required){
      try{const session=await api('/api/auth/me');showAuthUI(session.user,true);await refresh();}
      catch{showAuthUI(null,true);}
    }else{showAuthUI(null,false);await refresh();}
  }catch(error){$('auth-message').textContent='No se pudo verificar el servidor. Revisa que Paniko esté encendido.';}
}
initializePaniko();
