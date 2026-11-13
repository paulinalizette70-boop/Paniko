'use strict';
let ingredients = [];
let recipes = [];
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
const normalizeSearch=(value)=>String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es');
const VIEWS={dashboard:'Inicio',production:'Producción',ingredients:'Ingredientes',recipes:'Recetas',products:'Productos y ventas',history:'Historial',private:'Recetas privadas'};
let currentView='dashboard';
function navigateTo(view,{focus=false}={}) {
  if(!Object.hasOwn(VIEWS,view))return;
  if(view==='private'&&document.querySelector('[data-view-target="private"]')?.hidden)return;
  currentView=view;
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
    const details=make('div');details.append(make('strong',item.name),make('small',`${money(item.costPerUnit)} por ${item.unit}`));
    const count=make('span',`${item.stock} ${item.unit}`,item.stock<=0?'stock-value zero':'stock-value');
    line.append(details,count);root.append(line);
  }
  if(!list.length)root.append(make('p',ingredients.length?'No se encontraron ingredientes.':'Todavía no hay ingredientes registrados.','muted'));
}
function renderRecipeList(){
  const root=$('recipe-list'),query=normalizeSearch($('recipe-search').value.trim());
  root.replaceChildren();
  const list=recipes.filter(r=>normalizeSearch(r.name).includes(query));
  for(const recipe of list){
    const line=make('div',undefined,'inventory-item');
    const details=make('div');details.append(make('strong',recipe.name),make('small',`${recipe.items.length} ingredientes · Rendimiento base: ${recipe.baseYield} piezas`));
    const use=make('button','Preparar','secondary');use.type='button';
    use.addEventListener('click',()=>{
      navigateTo('production');$('scale-form').elements.recipe.value=recipe.id;
      $('scale-form').elements.recipe.dispatchEvent(new Event('change'));
      window.PanikoFinishedProducts?.updateProductionOptions?.();
      $('scale-form').elements.desiredYield.value=String(recipe.baseYield);
      resetCapacitySuggestion();
    });
    line.append(details,use);root.append(line);
  }
  if(!list.length)root.append(make('p',recipes.length?'No se encontraron recetas.':'Todavía no hay fichas técnicas.','muted'));
}
$('ingredient-search').addEventListener('input',renderIngredientList);
$('recipe-search').addEventListener('input',renderRecipeList);

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
function availableUnits(unit) {
  if (['g','kg'].includes(unit)) return ['g','kg'];
  if (['ml','l'].includes(unit)) return ['ml','l'];
  return unit === 'pieza' ? ['pieza'] : [];
}
function setUnitOptions(select, ingredientId) {
  const ing=ingredients.find(i=>i.id===ingredientId);
  const previous=select.value;
  const allowed=availableUnits(ing?.unit);
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
function addRecipeItem() {
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
  setUnitOptions(unit,select.value);
}
function formatProductionDate(value){
  if(!value)return 'Fecha no disponible';
  const date=new Date(value);
  return Number.isNaN(date.getTime())?'Fecha no disponible':date.toLocaleString('es-MX',{dateStyle:'medium',timeStyle:'short'});
}
function renderBatchDetail(container,detail){
  container.replaceChildren();
  container.append(make('p',`Lote: ${detail.id}`,'muted'));
  container.append(make('p',`Confirmado: ${formatProductionDate(detail.createdAt)} · Costo estimado del lote: ${money(detail.estimatedTotalCost)}`));
  container.append(make('h4','Ingredientes descontados'));
  if(!detail.lines?.length)container.append(make('p','Sin consumos registrados.','muted'));
  for(const line of detail.lines||[]){
    const previous=line.stockBefore===null?'':` · stock ${line.stockBefore} → ${line.stockAfter} ${line.unit}`;
    container.append(make('div',`${line.name}: ${line.quantity} ${line.unit} · costo estimado ${money(line.estimatedCost)}${previous}`,'list-row'));
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
    const costPerPiece=batch.desiredYield>0?money(batch.estimatedTotalCost/batch.desiredYield):'—';
    section.append(make('div',`${formatProductionDate(batch.createdAt)} · ${batch.recipeName} · ${batch.desiredYield} piezas · ${money(batch.estimatedTotalCost)} (${costPerPiece}/pieza)`));
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
async function refresh() {
  const [ings,recs,movements,batches]=await Promise.all([
    api('/api/ingredients'),api('/api/recipes'),api('/api/inventory/movements'),api('/api/production')]);
  ingredients=ings;recipes=recs;render(movements,batches);
  window.PanikoFinishedProducts?.updateProductionOptions?.();
  resetCapacitySuggestion();
}
$('production-filter').addEventListener('change',renderProductionHistory);
$('add-item').addEventListener('click', addRecipeItem);
$('stock-in-form').elements.ingredient.addEventListener('change',syncStockUnit);
$('stock-out-form').elements.ingredient.addEventListener('change',syncStockOutUnit);
$('adjust-stock-form').elements.ingredient.addEventListener('change',syncAdjustUnit);
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
    await post('/api/recipes', {name:form.elements.name.value,baseYield:Number(form.elements.yield.value),items:rows.map(row=>({ingredientId:row.querySelector('select').value,quantity:Number(row.querySelector('input').value),unit:row.querySelector('.recipe-unit').value}))});
    form.reset(); $('recipe-items').replaceChildren(); addRecipeItem(); await refresh(); notify('Ficha técnica guardada.');
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
  container.append(make('p', `${result.recipeName} · ${result.desiredYield} piezas · costo estimado ${money(result.estimatedTotalCost)}`));
  container.append(make('p', `Capacidad con existencias actuales: hasta ${result.maxProducible} piezas.`, result.maxProducible>0?'good':'warning'));
  if(result.limitingIngredients?.length)container.append(make('p', `Insumo(s) limitante(s): ${result.limitingIngredients.join(', ')}`, 'muted'));
  for(const line of result.lines){
    const detail=`${line.name}: necesita ${line.required} ${line.unit} · disponible ${line.stock} ${line.unit}`+
      (line.shortage>0?` · faltan ${line.shortage} ${line.unit}`:'')+` · ${money(line.estimatedCost)}`;
    container.append(make('div',detail,`list-row ${line.sufficient?'':'warning'}`));
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
$('scale-form').elements.recipe.addEventListener('change',resetCapacitySuggestion);
$('scale-form').elements.desiredYield.addEventListener('input',resetCapacitySuggestion);
$('max-production-button').addEventListener('click',()=>{
  const button=$('max-production-button');
  const form=$('scale-form');
  const maximum=Number(button.dataset.maximum);
  if(button.disabled||button.dataset.recipeId!==form.elements.recipe.value||
     !Number.isSafeInteger(maximum)||maximum<1)return;
  form.elements.desiredYield.value=String(maximum);
  resetCapacitySuggestion();
  notify(`Cantidad ajustada a ${maximum} piezas. Calcula la vista previa de nuevo para confirmar.`);
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
    if(!confirm(`¿Confirmas ${result.desiredYield} piezas de ${result.recipeName}? Se descontarán ingredientes. ${details}`)) return;
    const done=await post(`/api/recipes/${result.recipeId}/produce`,{desiredYield:result.desiredYield,productId:selectedProduct||null});
    await refresh();await window.PanikoFinishedProducts?.refresh?.();
    resetCapacitySuggestion();
    notify(done.finishedProduct ? `Producción registrada: ingredientes descontados y ${done.desiredYield} piezas añadidas a ${done.finishedProduct.name}.` : `Producción confirmada (${done.id}). Solo se descontaron ingredientes: no seleccionaste un producto vinculado.`);
  }catch(e){notify(e.message,true);}
});
function showAuthUI(user,required){
  $('workspace').hidden=Boolean(required&&!user);
  $('auth-panel').hidden=Boolean(!required||user);
  $('auth-bar').hidden=Boolean(!required||!user);
  const admin=Boolean(user?.role==='admin');
  document.querySelector('[data-view-target="private"]').hidden=!admin;
  $('stock-adjust-panel').hidden=Boolean(required&&!admin);
  $('ingredient-create-details').hidden=Boolean(required&&!admin);
  $('recipe-create-details').hidden=Boolean(required&&!admin);
  if(user){$('auth-user').textContent=user.username+' ('+(admin?'Administración':'Operación')+')';
    document.querySelector('.avatar').textContent=user.username.slice(0,1).toUpperCase();}
  if(!user){$('notification').hidden=true;currentView='dashboard';}
  navigateTo(currentView==='private'&&!admin?'dashboard':currentView);
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
  $('private-recipes-list').replaceChildren();showAuthUI(null,true);
});
$('load-private-button').addEventListener('click',async()=>{
 const view=$('private-recipes-list');
 try{
  const cat=await api('/api/private/catalog');view.replaceChildren();
  for(const [heading,records] of [['Recetas',cat.recetas||[]],['Rellenos',cat.rellenos||[]]]){
   view.append(make('h3',heading+' ('+records.length+')'));
   for(const record of records){
    const details=make('details');
    details.append(make('summary',record.title),make('pre',JSON.stringify(record.data,null,2),'recipe-json'));
    view.append(details);
   }
  }
 }catch(error){view.replaceChildren(make('p',error.message,'warning'));}
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
