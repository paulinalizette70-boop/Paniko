'use strict';
// Producción mixta de brioche: UNA masa compartida; formatos por gramaje y extras en stock.
// Separate prepared stock from ingredients added directly to a finished product.
function doughComplementChoices(ingredients,preparations,kind){
  const preparedIds=new Set(preparations.map(p=>p.ingredientId));
  return ingredients.filter(i=>kind==='prepared'?preparedIds.has(i.id):!preparedIds.has(i.id))
    .sort((a,b)=>a.name.localeCompare(b.name,'es'))
    .map(i=>({id:i.id,name:i.name+' ('+i.unit+')'}));
}
function doughPreparationChoices(ingredients,preparations,recipes,bases){
  const linked=new Set(preparations.map(p=>p.recipeId)),baseIds=new Set(bases.map(b=>b.recipeId));
  return [
    ...doughComplementChoices(ingredients,preparations,'prepared'),
    ...recipes.filter(r=>!linked.has(r.id)&&!baseIds.has(r.id))
      .sort((a,b)=>a.name.localeCompare(b.name,'es'))
      .map(r=>({id:'recipe:'+r.id,name:r.name+(['g','ml'].includes(r.yieldUnit)?' · vincular receta':' · falta rendimiento en g/ml')}))
  ];
}
function doughMatchingStock(recipe,ingredients,preparations){
  const normalize=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/^preparaci[oó]n:\s*/,'').trim();
  const linked=new Set(preparations.map(p=>p.ingredientId)),components=new Set((recipe.items||[]).map(x=>x.ingredientId));
  const units=recipe.yieldUnit==='g'?['g','kg']:recipe.yieldUnit==='ml'?['ml','l']:[];
  return ingredients.filter(i=>!linked.has(i.id)&&!components.has(i.id)&&units.includes(i.unit)&&normalize(i.name)===normalize(recipe.name));
}
function doughPreparationShortage(line,preparations){
  const prep=preparations.find(p=>p.ingredientId===line.ingredientId);
  if(!prep||!(line.shortage>0))return null;
  const scale=prep.yieldUnit==='g'?(line.unit==='kg'?1000:line.unit==='g'?1:0):prep.yieldUnit==='ml'?(line.unit==='l'?1000:line.unit==='ml'?1:0):0;
  if(!scale)return null;
  return {recipeId:prep.recipeId,recipeName:prep.recipeName,quantity:Math.ceil(Number((line.shortage*scale).toFixed(6))),yieldUnit:prep.yieldUnit};
}
function doughReadableAmount(quantity,unit){
  if(unit==='kg'&&quantity<1)return {quantity:Number((quantity*1000).toFixed(6)),unit:'g'};
  if(unit==='l'&&quantity<1)return {quantity:Number((quantity*1000).toFixed(6)),unit:'ml'};
  return {quantity,unit};
}
function syncDoughProductMode(fields){
  const editing=fields.productMode.value==='edit';
  fields.productId.disabled=!editing;
  fields.productId.required=editing;
  fields.productName.disabled=editing;
  fields.productName.required=!editing;
  if(!editing)fields.productId.value='';
  return editing;
}
function doughBatchTotals(formats,quantities){
  let pieces=0,grams=0,valid=true;
  for(const f of formats){
    const n=Number(quantities[f.productId]??0);
    if(!Number.isSafeInteger(n)||n<0||n>1000000){valid=false;continue;}
    pieces+=n;grams+=n*f.doughGrams;
  }
  return {pieces,grams,valid:valid&&grams<=100000000&&pieces<=100000000};
}
function doughEditableProducts(products,formats,recipeId){
  if(!recipeId)return [];
  return products.filter(p=>p.active&&(!p.operationalRecipeId||p.operationalRecipeId===recipeId)&&
    !formats.some(f=>f.productId===p.id&&f.recipeId!==recipeId));
}
if(typeof module==='object'&&module.exports){
  module.exports={doughComplementChoices,doughPreparationChoices,doughMatchingStock,doughPreparationShortage,doughReadableAmount,syncDoughProductMode,doughBatchTotals,doughEditableProducts};
}else (()=>{
  const $=id=>document.getElementById(id), root=$('dough-production');
  if(!root)return;
  const el=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=String(text);if(cls)e.className=cls;return e;};
  const status=(text,isError=false)=>{const n=$('dough-status');n.textContent=text;n.className=isError?'warning':'hint';};
  const num=n=>new Intl.NumberFormat('es-MX',{maximumFractionDigits:6}).format(n);
  const formBase=$('dough-base-form'),formFormat=$('dough-format-form'),formBatch=$('dough-batch-form');
  let user=null,config={bases:[],formats:[]},preparations=[],products=[],ingredients=[],recipes=[],lastPreview=null,lastPayload=null;
  let requestedRecipeId=null,prepPreview=null,prepPayload=null;
  let confirmingPrep=false,confirmingDough=false,pendingPrep=null,pendingDough=null;
  let batchRevision=0,prepRevision=0,refreshRevision=0,savingBase=false,savingFormat=false,savingPrep=false;
  const pieceDrafts=new Map();
  let returnToBatch=false;
  const amount=(q,u)=>{const a=doughReadableAmount(q,u);return num(a.quantity)+' '+a.unit;};
  const selectedFormats=()=>config.formats.filter(f=>f.recipeId===formBatch.elements.recipeId.value&&f.active&&products.some(p=>p.id===f.productId&&p.active));
  function showPanel(panel){
    if(panel==='settings'&&user?.role!=='admin')panel='batch';
    for(const name of ['batch','prep','settings'])$('dough-panel-'+name).hidden=name!==panel;
    for(const b of root.querySelectorAll('[data-dough-panel]'))b.setAttribute('aria-pressed',String(b.dataset.doughPanel===panel));
    if(panel==='settings')$('dough-settings').open=true;
    if(panel==='batch')returnToBatch=false;
  }
  for(const b of root.querySelectorAll('[data-dough-panel],[data-dough-go]'))b.addEventListener('click',()=>showPanel(b.dataset.doughPanel||b.dataset.doughGo));
  $('dough-reload').addEventListener('click',()=>{if(!confirmingDough&&!confirmingPrep)void refresh('Existencias actualizadas. Revisa el consumo antes de confirmar.');});
  for(const b of document.querySelectorAll('[data-scroll-to="dough-production"]'))b.addEventListener('click',()=>{if(user&&!confirmingDough&&!confirmingPrep)void refresh();});
  function savePieceDraft(){
    for(const row of $('dough-batch-formats').children){
      if(row.dataset.productId)pieceDrafts.set(row.dataset.productId,row.querySelector('.dough-pieces').value);
    }
  }
  function liveTotals(){
    const values=Object.fromEntries([...$('dough-batch-formats').children].filter(r=>r.dataset.productId).map(r=>[r.dataset.productId,r.querySelector('.dough-pieces').value]));
    const totals=doughBatchTotals(selectedFormats(),values);
    const base=config.bases.find(b=>b.recipeId===formBatch.elements.recipeId.value);
    $('dough-base-note').textContent=base?'Una receta completa rinde '+num(base.referenceGrams)+' g de masa.':'Selecciona una masa configurada.';
    const box=$('dough-live-totals');box.replaceChildren();
    for(const [label,value] of [['Piezas',num(totals.pieces)],['Masa necesaria',num(totals.grams)+' g'],['Recetas equivalentes',base?num(totals.grams/base.referenceGrams):'—']]){
      const item=el('div');item.append(el('small',label),el('strong',value));box.append(item);
    }
    if(!totals.valid)box.append(el('p','Revisa las cantidades de piezas.','warning'));
    $('dough-calculate').disabled=!base||!totals.valid||totals.pieces===0||confirmingDough;
  }
  function syncProductChoices(){
    fillSelect(formFormat.elements.productId,doughEditableProducts(products,config.formats,formFormat.elements.recipeId.value).map(p=>({id:p.id,name:p.name})),'Selecciona el producto que deseas editar');
  }
  function renderProductCards(){
    const box=$('dough-product-cards');box.replaceChildren();
    const formats=config.formats.filter(f=>f.recipeId===formFormat.elements.recipeId.value&&f.active&&products.some(p=>p.id===f.productId&&p.active));
    if(!formats.length)box.append(el('p','Todavía no hay productos configurados para esta masa. Crea el primero en la ficha.','hint'));
    for(const f of formats){
      const card=el('div',undefined,'dough-product-card');
      card.append(el('strong',f.productName),el('small',num(f.doughGrams)+' g de masa por pieza'),el('small',f.extras.length?f.extras.map(e=>amount(e.quantityPerPiece,e.unit)+' '+e.name).join(' · '):'Sin complementos'));
      const edit=el('button','Editar formato','btn-soft');edit.type='button';
      edit.addEventListener('click',()=>{
        formFormat.elements.productMode.value='edit';syncProductChoices();formFormat.elements.productId.value=f.productId;
        syncProductMode();loadSelectedFormat();formFormat.scrollIntoView({block:'start',behavior:'smooth'});
      });card.append(edit);box.append(card);
    }
  }
  function syncBaseWeight(){
    const id=formBase.elements.recipeId.value,base=config.bases.find(b=>b.recipeId===id),recipe=recipes.find(r=>r.id===id);
    formBase.elements.referenceGrams.value=base?String(base.referenceGrams):recipe?.yieldUnit==='g'?String(recipe.baseYield):'';
  }
  const fetchJSON=async(url,opt={})=>{
    const res=await fetch(url,{credentials:'same-origin',...opt});
    const body=await res.json();if(!res.ok)throw Error(body.error||'No se pudo realizar la operación');return body;
  };
  const post=(url,payload)=>fetchJSON(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
  function fillSelect(node,entries,placeholder){
    const old=node.value;node.replaceChildren();
    const empty=el('option',placeholder);empty.value='';node.append(empty);
    for(const {id,name} of entries){const option=el('option',name);option.value=id;node.append(option)}
    node.value=[...node.options].some(x=>x.value===old)?old:'';
  }
  function unitsFor(ingredient){
    if(!ingredient)return [];
    if(['g','kg'].includes(ingredient.unit))return ['g','kg'];
    if(['ml','l'].includes(ingredient.unit))return ['ml','l'];
    return [ingredient.unit];
  }
  function addExtra(known,kind='prepared'){
    const preparedIds=new Set(preparations.map(p=>p.ingredientId));
    if(known)kind=preparedIds.has(known.ingredientId)?'prepared':'direct';
    const choicesForRow=()=>kind==='prepared'?doughPreparationChoices(ingredients,preparations,recipes,config.bases):doughComplementChoices(ingredients,preparations,'direct');
    const choices=choicesForRow();
    if(!known&&!choices.length){
      status(kind==='prepared'?'No hay fichas de preparación. En Recetas, crea una ficha técnica de costra o mermelada con rendimiento en g o ml.':'No hay ingredientes directos disponibles en inventario.',true);
      if(kind==='prepared'){
        if(user?.role==='admin')openNewPrep();
      }
      return;
    }
    const row=el('div',undefined,'dough-extra-row');
    const select=el('select');select.required=true;
    select.setAttribute('aria-label',kind==='prepared'?'Preparación de relleno o cubierta':'Ingrediente directo de relleno o cubierta');
    fillSelect(select,choices,kind==='prepared'?'Selecciona preparación':'Selecciona ingrediente directo');
    const qty=el('input');qty.type='number';qty.min='0.000001';qty.step='0.000001';qty.required=true;qty.placeholder='Cantidad por pieza';qty.setAttribute('aria-label','Cantidad de complemento por pieza');
    const unit=el('select');unit.setAttribute('aria-label','Unidad');
    const del=el('button','Quitar','btn-soft');del.type='button';del.addEventListener('click',()=>row.remove());
    const linkArea=el('div',undefined,'dough-inline-link');linkArea.hidden=true;
    const linkHint=el('p',undefined,'hint');
    const linkButton=el('button','Vincular preparación','btn-soft');linkButton.type='button';
    linkArea.append(linkHint,linkButton);
    const getRecipe=()=>select.value.startsWith('recipe:')?recipes.find(r=>r.id===select.value.slice(7)):null;
    const update=(keepUnit=false)=>{
      const recipe=getRecipe(),ing=ingredients.find(x=>x.id===select.value),old=unit.value;
      const measure=recipe?{unit:recipe.yieldUnit==='g'?'g':recipe.yieldUnit==='ml'?'ml':''}:ing;
      unit.replaceChildren();
      for(const value of measure?.unit?unitsFor(measure):[]){const option=el('option',value);option.value=value;unit.append(option);}
      if(keepUnit&&[...unit.options].some(o=>o.value===old))unit.value=old;
      else unit.value=measure?.unit==='kg'?'g':measure?.unit==='l'?'ml':measure?.unit||'';
      linkArea.hidden=!recipe;
      if(recipe){
        const eligible=['g','ml'].includes(recipe.yieldUnit);
        const matches=doughMatchingStock(recipe,ingredients,preparations);
        linkButton.hidden=!eligible;
        linkButton.textContent=matches.length===1?'Vincular existencia de '+matches[0].name:matches.length>1?'Elegir existencia en Preparaciones':'Vincular receta al inventario';
        linkHint.textContent=!eligible?'Edita la ficha técnica de '+recipe.name+' en Recetas y registra el rendimiento real en gramos o mililitros. No se puede convertir piezas a gramos sin ese dato.':matches.length===1?'Ya existe '+matches[0].name+' en inventario. Puedes reutilizarla sin cambiar su stock.':matches.length>1?'Hay varias existencias compatibles. Elige la correcta en Preparaciones.':'Esta ficha aún no tiene existencia de preparación. Vincúlala para usarla aquí; quedará en cero hasta registrar la preparación.';
      }
    };
    linkButton.addEventListener('click',async()=>{
      const recipe=getRecipe();
      if(!recipe||savingPrep||!['g','ml'].includes(recipe.yieldUnit))return;
      const matches=doughMatchingStock(recipe,ingredients,preparations);
      if(matches.length>1){
        showPanel('prep');$('dough-prep-link-details').open=true;
        prepLinkForm.elements.recipeId.value=recipe.id;syncExistingIngredientChoices();
        status('Selecciona la existencia correcta de '+recipe.name+' y vuelve a tu ficha.');return;
      }
      const payload={recipeId:recipe.id};
      if(matches.length===1)payload.ingredientId=matches[0].id;
      if(!confirm(matches.length===1?'¿Vincular '+recipe.name+' con '+matches[0].name+'? No cambia sus existencias.':'¿Vincular '+recipe.name+' creando una existencia en cero? No se descontarán ingredientes.'))return;
      savingPrep=true;linkButton.disabled=true;select.disabled=true;del.disabled=true;
      try{
        const linked=await post('/api/dough/preparations',payload);
        const loaded=await refresh();
        if(!loaded)throw Error('La vinculación se guardó; actualiza existencias para recuperar el complemento.');
        fillSelect(select,choicesForRow(),'Selecciona preparación');select.value=linked.ingredientId;
        update(true);
        status(recipe.name+' vinculada. Continúa con la cantidad por pieza; las existencias no se modificaron.');
        await window.PanikoRefreshInventory?.();
      }catch(err){status(err.message,true);}
      finally{savingPrep=false;linkButton.disabled=false;select.disabled=false;del.disabled=false;}
    });
    select.addEventListener('change',()=>update());
    row.append(select,qty,unit,del,linkArea);$('dough-extra-items').append(row);
    row.refreshComplement=()=>{
      const recipe=getRecipe(),linked=recipe&&preparations.find(p=>p.recipeId===recipe.id);
      if(kind==='direct'&&preparations.some(p=>p.ingredientId===select.value))kind='prepared';
      fillSelect(select,choicesForRow(),kind==='prepared'?'Selecciona preparación':'Selecciona ingrediente directo');
      if(linked)select.value=linked.ingredientId;
      update(true);
    };
    if(known){
      select.value=known.ingredientId;update();
      const display=doughReadableAmount(known.quantityPerPiece,known.unit||ingredients.find(x=>x.id===known.ingredientId)?.unit);
      qty.value=String(display.quantity);unit.value=display.unit||'';
    }
    else update();
  }
  function renderForms(){
    fillSelect(formBase.elements.recipeId,recipes.filter(x=>x.yieldUnit!=='ml').map(r=>({id:r.id,name:`${r.name} · ${r.baseYield} ${r.yieldUnit==='g'?'g':'piezas'}`})),'Selecciona receta base');
    const bases=config.bases.map(b=>({id:b.recipeId,name:`${b.recipeName} · ${num(b.referenceGrams)} g por receta`}));
    fillSelect(formFormat.elements.recipeId,bases,'Primero configura la masa base');
    fillSelect(formBatch.elements.recipeId,bases,'Selecciona una masa configurada');
    const requested=requestedRecipeId;
    requestedRecipeId=null;
    const oldFormatBase=formFormat.elements.recipeId.value;
    if(requested&&recipes.some(r=>r.id===requested)){
      formBase.elements.recipeId.value=requested;
      if(config.bases.some(b=>b.recipeId===requested)){
        formFormat.elements.recipeId.value=requested;formBatch.elements.recipeId.value=requested;
      }else{formFormat.elements.recipeId.value='';formBatch.elements.recipeId.value='';}
      if(user?.role==='admin')showPanel('settings');
    }
    if(!requested&&!formBatch.elements.recipeId.value){
      if(config.bases.length===1)formBatch.elements.recipeId.value=config.bases[0].recipeId;
      else if(config.bases.filter(b=>/brioche/i.test(b.recipeName)).length===1)formBatch.elements.recipeId.value=config.bases.find(b=>/brioche/i.test(b.recipeName)).recipeId;
    }
    if(!formFormat.elements.recipeId.value&&!requested)formFormat.elements.recipeId.value=formBatch.elements.recipeId.value;
    if(!formBase.elements.recipeId.value&&!requested)formBase.elements.recipeId.value=formFormat.elements.recipeId.value;
    syncBaseWeight();syncProductChoices();syncProductMode();
    if(oldFormatBase!==formFormat.elements.recipeId.value&&formFormat.elements.productMode.value==='edit')loadSelectedFormat();
    renderProductCards();renderPreparationForms();renderBatchRows();
    for(const row of $('dough-extra-items').children)row.refreshComplement?.();
  }
  function renderBatchRows(){
    savePieceDraft();clearPreview();
    const formats=selectedFormats();
    const root=$('dough-batch-formats');root.replaceChildren();
    if(!formats.length){
      root.append(el('p',formBatch.elements.recipeId.value?'Todavía no hay productos configurados para esta masa.':'Selecciona la masa que vas a utilizar. Si es nueva, configúrala primero.','hint'));
      liveTotals();return;
    }
    for(const item of formats){
      const row=el('div',undefined,'dough-batch-row');row.dataset.productId=item.productId;
      const description=el('div');description.append(el('strong',item.productName),el('small',`${item.doughGrams} g de masa por pieza`));
      if(item.extras.length)description.append(el('small',item.extras.map(e=>`${amount(e.quantityPerPiece,e.unit)} ${e.name}`).join(' + ')));
      const label=el('label','Piezas');
      const qty=el('input');qty.type='number';qty.min='0';qty.step='1';qty.max='1000000';qty.value=pieceDrafts.get(item.productId)??'0';qty.className='dough-pieces';qty.required=true;label.append(qty);
      const controls=el('div',undefined,'dough-piece-controls');
      for(const [symbol,delta] of [['−',-1],['+',1]]){
        const btn=el('button',symbol,'btn-soft');btn.type='button';btn.setAttribute('aria-label',(delta>0?'Aumentar ':'Reducir ')+item.productName);
        btn.addEventListener('click',()=>{if(confirmingDough)return;qty.value=String(Math.min(1000000,Math.max(0,(Number(qty.value)||0)+delta)));savePieceDraft();clearPreview();liveTotals();});controls.append(btn);
      }
      label.append(controls);row.append(description,label);root.append(row);
    }
    liveTotals();
  }
  function clearPreview(){batchRevision++;lastPreview=null;lastPayload=null;$('dough-confirm').disabled=true;$('dough-batch-preview').replaceChildren();}
  async function refresh(message){
    if(!user)return false;
    const revision=++refreshRevision;
    clearPreview();clearPrepPreview();
    try{
      const loaded=await Promise.all([
        fetchJSON('/api/dough/config'),fetchJSON('/api/products'),fetchJSON('/api/ingredients'),fetchJSON('/api/recipes'),fetchJSON('/api/dough/preparations')]);
      if(!user||revision!==refreshRevision)return false;
      [config,products,ingredients,recipes,preparations]=loaded;
      renderForms();root.hidden=false;$('dough-settings').hidden=user.role!=='admin';$('dough-prep-link-details').hidden=user.role!=='admin';
      $('dough-prep-admin-actions').hidden=user.role!=='admin';
      if(user.role!=='admin'){$('dough-prep-create-form').hidden=true;$('dough-prep-catalog-list').hidden=true;}
      for(const b of root.querySelectorAll('[data-dough-panel="settings"],[data-dough-go="settings"]'))b.hidden=user.role!=='admin';
      if(user.role!=='admin'&&!$('dough-panel-settings').hidden)showPanel('batch');
      if(message||!$('dough-status').textContent)status(message|| (config.bases.length?'Captura las piezas y revisa el consumo.':'Configura primero el rendimiento de tu masa base.'));
      return true;
    }catch(e){if(revision===refreshRevision){root.hidden=false;status('No se pudo cargar producción por formatos: '+e.message,true);}return false;}
  }
  function selectedPayload(){
    const recipeId=formBatch.elements.recipeId.value;
    const rows=[...$('dough-batch-formats').children].filter(e=>e.dataset.productId)
      .map(e=>({productId:e.dataset.productId,pieces:Number(e.querySelector('.dough-pieces').value)}));
    if(rows.some(x=>!Number.isSafeInteger(x.pieces)||x.pieces<0||x.pieces>1000000))throw Error('Las cantidades deben ser piezas enteras entre 0 y 1000000.');
    const formats=rows.filter(x=>x.pieces>0);
    if(!recipeId||!formats.length)throw Error('Selecciona una masa y al menos un formato con piezas.');
    return {recipeId,formats};
  }
  formBase.elements.recipeId.addEventListener('change',()=>{
    syncBaseWeight();
    if(config.bases.some(b=>b.recipeId===formBase.elements.recipeId.value)){
      const changed=formFormat.elements.recipeId.value!==formBase.elements.recipeId.value;
      formFormat.elements.recipeId.value=formBase.elements.recipeId.value;syncProductChoices();syncProductMode();renderProductCards();
      if(changed&&formFormat.elements.productMode.value==='edit')loadSelectedFormat();
    }
  });
  function syncProductMode(){
    const editing=syncDoughProductMode(formFormat.elements);
    $('dough-existing-product-field').hidden=!editing;
    $('dough-new-product-field').hidden=editing;
    $('dough-save-product').textContent=editing?'Guardar cambios del producto':'Crear producto y guardar formato';
    return editing;
  }
  function loadSelectedFormat(){
    const f=config.formats.find(x=>x.productId===formFormat.elements.productId.value);
    $('dough-extra-items').replaceChildren();
    if(f){formFormat.elements.recipeId.value=f.recipeId;formFormat.elements.doughGrams.value=String(f.doughGrams);for(const extra of f.extras)addExtra(extra);}
    else formFormat.elements.doughGrams.value='';
  }
  formFormat.elements.productMode.addEventListener('change',()=>{
    formFormat.elements.productId.value='';
    formFormat.elements.productName.value='';
    formFormat.elements.doughGrams.value='';
    $('dough-extra-items').replaceChildren();
    syncProductMode();
    (formFormat.elements.productMode.value==='edit'?formFormat.elements.productId:formFormat.elements.productName).focus();
  });
  formFormat.elements.productId.addEventListener('change',()=>{
    if(syncProductMode())loadSelectedFormat();
  });
  formFormat.elements.recipeId.addEventListener('change',()=>{
    formFormat.elements.productId.value='';syncProductChoices();syncProductMode();renderProductCards();
    if(formFormat.elements.productMode.value==='edit')loadSelectedFormat();
  });
  $('dough-add-extra').addEventListener('click',()=>addExtra(null,'prepared'));
  $('dough-add-direct-extra').addEventListener('click',()=>addExtra(null,'direct'));
  $('dough-create-complement').addEventListener('click',()=>openNewPrep());
  formBase.addEventListener('submit',async e=>{
    e.preventDefault();if(savingBase)return;
    savingBase=true;const button=formBase.querySelector('button[type=submit]');button.disabled=true;
    try{
      const id=formBase.elements.recipeId.value;
      await post('/api/dough/base',{recipeId:id,referenceGrams:Number(formBase.elements.referenceGrams.value)});
      requestedRecipeId=id;
      await refresh('Rendimiento guardado. Ya puedes crear productos o volver a producir.');
    }catch(err){status(err.message,true)}finally{savingBase=false;button.disabled=false;}
  });
  formFormat.addEventListener('submit',async e=>{
    e.preventDefault();if(savingFormat||savingPrep)return;
    savingFormat=true;const button=$('dough-save-product');button.disabled=true;
    try{
      const extras=[...$('dough-extra-items').children].map(row=>({ingredientId:row.querySelector('select').value,
        quantity:Number(row.querySelector('input').value),unit:row.querySelectorAll('select')[1].value}));
      if(extras.some(x=>x.ingredientId.startsWith('recipe:')))throw Error('Vincula las preparaciones seleccionadas antes de guardar el producto.');
      const data={recipeId:formFormat.elements.recipeId.value,doughGrams:Number(formFormat.elements.doughGrams.value),extras};
      const editing=syncProductMode();
      if(editing){
        if(!formFormat.elements.productId.value)throw Error('Selecciona el producto que deseas editar.');
        await post('/api/dough/format',{...data,productId:formFormat.elements.productId.value});
      }else{
        const name=formFormat.elements.productName.value.trim();
        if(!name)throw Error('Escribe el nombre del nuevo producto.');
        await post('/api/dough/product',{...data,name});
        formFormat.elements.productName.value='';
        formFormat.elements.doughGrams.value='';
        $('dough-extra-items').replaceChildren();
      }
      formBatch.elements.recipeId.value=data.recipeId;
      const refreshed=await refresh(editing?'Cambios guardados. No se modificó inventario.':'Producto creado. Puedes crear otro o volver a producir.');
      if(refreshed&&editing)loadSelectedFormat();
    }catch(err){status(err.message,true)}finally{savingFormat=false;button.disabled=false;}
  });
  const prepLinkForm=$('dough-prep-link-form'),prepBatchForm=$('dough-prep-batch-form'),prepCreateForm=$('dough-prep-create-form');
  let savingNewPrep=false;
  function syncNewPrepOutput(){
    const linked=new Set(preparations.map(p=>p.ingredientId));
    const used=new Set([...$('dough-prep-create-items').children].map(row=>row.querySelector('select').value));
    const unit=prepCreateForm.elements.yieldUnit.value;
    fillSelect(prepCreateForm.elements.ingredientId,ingredients.filter(i=>!linked.has(i.id)&&!used.has(i.id)&&(unit==='g'?['g','kg'].includes(i.unit):['ml','l'].includes(i.unit))).map(i=>({id:i.id,name:i.name+' ('+i.unit+')'})),'Crear existencia nueva en cero');
  }
  function addPrepItem(){
    const row=el('div',undefined,'dough-extra-row');
    const select=el('select');select.required=true;select.setAttribute('aria-label','Ingrediente de la preparación');
    const qty=el('input');qty.type='number';qty.required=true;qty.min='0.000001';qty.step='0.000001';qty.placeholder='Cantidad';qty.setAttribute('aria-label','Cantidad de ingrediente');
    const unit=el('select');unit.required=true;unit.setAttribute('aria-label','Unidad del ingrediente');
    const remove=el('button','Quitar','btn-soft');remove.type='button';remove.addEventListener('click',()=>{row.remove();syncNewPrepOutput();});
    const update=(preserve=false)=>{
      const old=unit.value,ing=ingredients.find(i=>i.id===select.value);
      unit.replaceChildren();
      for(const u of unitsFor(ing)){const opt=el('option',u);opt.value=u;unit.append(opt);}
      unit.value=preserve&&[...unit.options].some(o=>o.value===old)?old:ing?.unit==='kg'?'g':ing?.unit==='l'?'ml':ing?.unit||'';
    };
    row.refreshItem=()=>{fillSelect(select,ingredients.map(i=>({id:i.id,name:i.name+' ('+i.unit+')'})),'Selecciona ingrediente');update(true);};
    select.addEventListener('change',()=>{update();syncNewPrepOutput();});
    row.append(select,qty,unit,remove);$('dough-prep-create-items').append(row);row.refreshItem();
    return row;
  }
  function openNewPrep(name=''){
    if(user?.role!=='admin')return;
    showPanel('prep');$('dough-prep-catalog-list').hidden=true;
    prepCreateForm.hidden=false;
    if(name&&!prepCreateForm.elements.name.value)prepCreateForm.elements.name.value=name;
    if(! $('dough-prep-create-items').children.length)addPrepItem();
    syncNewPrepOutput();prepCreateForm.elements.name.focus();
  }
  $('dough-prep-new').addEventListener('click',()=>openNewPrep());
  $('dough-prep-cancel').addEventListener('click',()=>{prepCreateForm.hidden=true;});
  $('dough-prep-add-item').addEventListener('click',addPrepItem);
  prepCreateForm.elements.yieldUnit.addEventListener('change',syncNewPrepOutput);
  $('dough-prep-existing').addEventListener('click',()=>{
    $('dough-prep-catalog-list').hidden=true;
    $('dough-prep-link-details').open=true;prepLinkForm.elements.recipeId.focus();
  });
  prepCreateForm.addEventListener('submit',async e=>{
    e.preventDefault();if(savingNewPrep||savingPrep||user?.role!=='admin')return;
    const button=$('dough-prep-save');
    const data={name:prepCreateForm.elements.name.value.trim(),baseYield:Number(prepCreateForm.elements.baseYield.value),yieldUnit:prepCreateForm.elements.yieldUnit.value,
      items:[...$('dough-prep-create-items').children].map(row=>({ingredientId:row.querySelector('select').value,quantity:Number(row.querySelector('input').value),unit:row.querySelectorAll('select')[1].value}))};
    if(prepCreateForm.elements.ingredientId.value)data.ingredientId=prepCreateForm.elements.ingredientId.value;
    if(!data.name||!Number.isSafeInteger(data.baseYield)||data.baseYield<1||!data.items.length||data.items.some(x=>!x.ingredientId||!x.unit||!Number.isFinite(x.quantity)||x.quantity<=0)){
      status('Completa el nombre, rendimiento real e ingredientes de la preparación.',true);return;
    }
    savingNewPrep=true;button.disabled=true;
    try{
      const result=await post('/api/dough/preparations/create',data);
      prepCreateForm.elements.name.value='';prepCreateForm.elements.baseYield.value='';prepCreateForm.elements.ingredientId.value='';
      $('dough-prep-create-items').replaceChildren();prepCreateForm.hidden=true;
      const loaded=await refresh('Preparación guardada. Ahora puedes registrar los gramos elaborados; todavía no se descontó inventario.');
      if(loaded){prepBatchForm.elements.recipeId.value=result.recipeId;prepBatchForm.elements.quantity.value='';syncPrepQuantityLabel();prepBatchForm.elements.quantity.focus();}
      await window.PanikoRefreshInventory?.();
    }catch(err){status(err.message,true);}finally{savingNewPrep=false;button.disabled=false;}
  });
  function catalogYield(raw){
    const u=String(raw?.unidad||'').toLowerCase().trim(),n=Number(raw?.cantidad);
    const map={g:['g',1],gramos:['g',1],gramo:['g',1],kg:['g',1000],kilogramos:['g',1000],kilogramo:['g',1000],ml:['ml',1],mililitros:['ml',1],l:['ml',1000],litros:['ml',1000],litro:['ml',1000]};
    const x=map[u];return x&&Number.isSafeInteger(n*x[1])&&n>0?{baseYield:n*x[1],yieldUnit:x[0]}:null;
  }
  $('dough-prep-catalog').addEventListener('click',async()=>{
    if(user?.role!=='admin')return;
    const box=$('dough-prep-catalog-list');box.hidden=false;box.replaceChildren(el('p','Cargando tus recetas…','hint'));
    try{
      const catalog=await fetchJSON('/api/private/catalog');
      box.replaceChildren(el('h4','Recetas de tu catálogo'));
      const all=[...(catalog.recetas||[]).map(r=>({...r,importable:true})),...(catalog.rellenos||[]).map(r=>({...r,importable:false}))];
      const search=el('input');search.type='search';search.placeholder='Buscar mermelada, costra…';search.setAttribute('aria-label','Buscar recetas del catálogo');box.append(search);
      const list=el('div',undefined,'dough-product-cards');box.append(list);
      const render=()=>{
        list.replaceChildren();
        const query=search.value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
        for(const record of all.filter(r=>String(r.title).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().includes(query))){
          const card=el('div',undefined,'dough-product-card'),raw=record.data||{};
          card.append(el('strong',record.title));
          const existing=recipes.find(r=>r.name.toLowerCase().trim()===String(record.title).toLowerCase().trim()||r.name.toLowerCase().trim()===String(raw.nombre||'').toLowerCase().trim());
          const action=el('button',existing?'Usar ficha existente':'Crear ficha de preparación','btn-soft');action.type='button';
          const openExisting=id=>{box.hidden=true;$('dough-prep-link-details').open=true;prepLinkForm.elements.recipeId.value=id;syncExistingIngredientChoices();prepLinkForm.elements.recipeId.focus();};
          if(existing){
            const linked=preparations.find(p=>p.recipeId===existing.id);
            action.textContent=linked?'Registrar cantidad': ['g','ml'].includes(existing.yieldUnit)?'Usar ficha existente':'Revisar rendimiento en Recetas';
            action.addEventListener('click',()=>{if(linked){box.hidden=true;prepBatchForm.elements.recipeId.value=existing.id;syncPrepQuantityLabel();prepBatchForm.elements.quantity.focus();}else if(['g','ml'].includes(existing.yieldUnit))openExisting(existing.id);else{status('Edita el rendimiento real de la ficha existente en Recetas. No crees una copia.',true);window.PanikoNavigate?.('recipes');}});
          }else if(record.importable&&raw.estado==='confirmada'&&raw.id&&/^[a-z][a-z0-9_]{0,99}$/.test(raw.id)&&!raw.componentes?.length&&Array.isArray(raw.ingredientes)&&raw.ingredientes.length&&raw.ingredientes.every(i=>Number.isFinite(i.cantidad)&&i.cantidad>0&&['g','kg','ml','l','pieza'].includes(i.unidad))){
            const known=catalogYield(raw.rendimiento);
            const yieldInput=el('input');yieldInput.type='number';yieldInput.min='1';yieldInput.step='1';yieldInput.placeholder='Rendimiento real';
            const measure=el('select');for(const v of ['g','ml']){const o=el('option',v);o.value=v;measure.append(o);}measure.value='g';
            if(!known)card.append(el('small','Indica el rendimiento real en g o ml. Si la receta original está en piezas, corrígela primero en Recetas.'),yieldInput,measure);
            else card.append(el('small',known.baseYield+' '+known.yieldUnit+' por receta'));
            action.addEventListener('click',async()=>{
              const data=known||{baseYield:Number(yieldInput.value),yieldUnit:measure.value};
              if(!Number.isSafeInteger(data.baseYield)||data.baseYield<1){status('Indica el rendimiento real de la receta.',true);return;}
              if(!confirm('¿Crear ficha escalable de '+record.title+'? No se descontará inventario.'))return;
              action.disabled=true;
              try{const result=await post('/api/recipes/from-catalog/'+raw.id,data);if(await refresh('Ficha disponible. Selecciona o crea su existencia para terminar.'))openExisting(result.id);}
              catch(err){status(err.message,true);}finally{action.disabled=false;}
            });
          }else{
            card.append(el('small','Fórmula pendiente o relleno de consulta. Crea su ficha con cantidades y rendimiento confirmados, o completa la receta original.'));
            action.addEventListener('click',()=>openNewPrep(record.title));
          }
          card.append(action);list.append(card);
        }
        if(!list.children.length)list.append(el('p','No se encontraron recetas. Puedes crear una preparación nueva.','hint'));
      };search.addEventListener('input',render);render();
    }catch(err){box.replaceChildren(el('p','No se pudo abrir el catálogo: '+err.message,'warning'));}
  });
  function syncExistingIngredientChoices(){
    const r=recipes.find(x=>x.id===prepLinkForm.elements.recipeId.value);
    const linkedIds=new Set(preparations.map(p=>p.ingredientId));
    const components=new Set((r?.items||[]).map(x=>x.ingredientId));
    const list=ingredients.filter(i=>!linkedIds.has(i.id)&&!components.has(i.id)&&(r?.yieldUnit==='g'?['g','kg'].includes(i.unit):r?.yieldUnit==='ml'?['ml','l'].includes(i.unit):false))
      .map(i=>({id:i.id,name:i.name+' ('+i.unit+')'}));
    fillSelect(prepLinkForm.elements.ingredientId,list,'Crear existencia nueva automáticamente');
  }
  function renderPreparationForms(){
    const already=new Set(preparations.map(x=>x.recipeId));
    fillSelect(prepLinkForm.elements.recipeId,recipes.filter(r=>['g','ml'].includes(r.yieldUnit)&&!already.has(r.id)&&!config.bases.some(b=>b.recipeId===r.id))
      .map(r=>({id:r.id,name:r.name+' · '+r.baseYield+' '+r.yieldUnit})),'Selecciona una receta complementaria');
    syncExistingIngredientChoices();
    fillSelect(prepBatchForm.elements.recipeId,preparations.map(p=>({id:p.recipeId,name:p.recipeName+' · '+p.yieldUnit})),
      'Selecciona una preparación vinculada');
    const root=$('dough-prep-list');root.replaceChildren();
    if(!preparations.length)root.append(el('p',user?.role==='admin'?'Aún no tienes preparaciones guardadas. Pulsa Nueva preparación o Usar receta existente.':'Pide a administración que configure las preparaciones que vas a elaborar.','muted'));
    for(const p of preparations){
      const card=el('div',undefined,'dough-prep-card');
      card.append(el('strong',p.recipeName),
        el('small','Disponible: '+num(p.stock)+' '+p.unit+' · Rinde '+num(p.baseYield)+' '+p.yieldUnit+' por receta'));
      const action=el('button','Registrar preparación','btn-soft');action.type='button';
      action.addEventListener('click',()=>{
        if(confirmingPrep)return;
        prepBatchForm.elements.recipeId.value=p.recipeId;syncPrepQuantityLabel();clearPrepPreview();prepBatchForm.elements.quantity.focus();
      });card.append(action);root.append(card);
    }
    for(const row of $('dough-prep-create-items').children)row.refreshItem?.();
    syncNewPrepOutput();
    clearPrepPreview();syncPrepQuantityLabel();
  }
  function clearPrepPreview(){
    prepRevision++;prepPreview=null;prepPayload=null;$('dough-prep-confirm').disabled=true;
    $('dough-prep-preview').replaceChildren();
  }
  prepLinkForm.elements.recipeId.addEventListener('change',syncExistingIngredientChoices);
  prepLinkForm.addEventListener('submit',async e=>{
    e.preventDefault();if(savingPrep)return;
    savingPrep=true;const button=prepLinkForm.querySelector('button[type=submit]');button.disabled=true;
    try{
      const payload={recipeId:prepLinkForm.elements.recipeId.value};
      if(prepLinkForm.elements.ingredientId.value)payload.ingredientId=prepLinkForm.elements.ingredientId.value;
      await post('/api/dough/preparations',payload);
      const loaded=await refresh('Receta vinculada. Registra la cantidad preparada o vuelve a configurar tu producto.');
      if(loaded){prepBatchForm.elements.recipeId.value=payload.recipeId;syncPrepQuantityLabel();}
      await window.PanikoRefreshInventory?.();
    }catch(err){status(err.message,true);}finally{savingPrep=false;button.disabled=false;}
  });
  function syncPrepQuantityLabel(){
    const p=preparations.find(x=>x.recipeId===prepBatchForm.elements.recipeId.value);
    $('dough-prep-quantity-label').textContent=p?'Cantidad obtenida ('+p.yieldUnit+')':'Cantidad obtenida (g o ml)';
  }
  prepBatchForm.addEventListener('input',()=>{clearPrepPreview();syncPrepQuantityLabel();});
  prepBatchForm.addEventListener('change',()=>{clearPrepPreview();syncPrepQuantityLabel();});
  prepBatchForm.addEventListener('submit',async e=>{
    e.preventDefault();if(confirmingPrep)return;clearPrepPreview();
    const revision=prepRevision;
    try{
      const data={recipeId:prepBatchForm.elements.recipeId.value,quantity:Number(prepBatchForm.elements.quantity.value)};
      const plan=await post('/api/dough/preparations/preview',data);
      if(revision!==prepRevision)return;
      const box=$('dough-prep-preview');
      box.append(el('h4','Preparar '+num(plan.quantity)+' '+plan.yieldUnit+' de '+plan.recipeName));
      box.append(el('p','Se añadirán '+num(plan.addedQuantity)+' '+plan.outputUnit+' de '+plan.outputName+' al inventario.','hint'));
      for(const x of plan.lines){
        const msg=x.name+': '+num(x.required)+' '+x.unit+' · disponible '+num(x.stock)+' '+x.unit+
          (x.shortage>0?' · faltan '+num(x.shortage)+' '+x.unit:'');
        box.append(el('div',msg,x.sufficient?'list-row':'list-row warning'));
      }
      box.append(el('p',plan.stockAvailable?'Existencias suficientes para preparar.':'Inventario insuficiente. No se puede confirmar.',
        plan.stockAvailable?'good':'warning'));
      prepPayload=data;prepPreview=plan;$('dough-prep-confirm').disabled=!plan.stockAvailable||confirmingPrep;
    }catch(err){if(revision===prepRevision)status(err.message,true);}
  });
  $('dough-prep-confirm').addEventListener('click',async()=>{
    if(confirmingPrep||confirmingDough||!prepPreview?.stockAvailable||!prepPayload)return;
    if(!confirm('¿Confirmas '+prepPreview.quantity+' '+prepPreview.yieldUnit+' de '+prepPreview.recipeName+
       '? Se descontarán sus insumos y aumentará el inventario de la preparación.'))return;
    const signature=JSON.stringify(prepPayload);
    if(!pendingPrep||pendingPrep.signature!==signature)pendingPrep={signature,operationId:crypto.randomUUID()};
    confirmingPrep=true;$('dough-prep-confirm').disabled=true;
    const enabled=[...prepBatchForm.querySelectorAll('input,select,button')].filter(x=>!x.disabled);
    for(const x of enabled)x.disabled=true;
    try{
      const result=await post('/api/dough/preparations/produce',{...prepPayload,operationId:pendingPrep.operationId});
      pendingPrep=null;
      prepBatchForm.elements.quantity.value='';
      const resume=returnToBatch;
      const loaded=await refresh('Preparación registrada: +'+amount(result.addedQuantity,result.unit)+' de '+result.ingredientName+'.');
      if(resume&&loaded){
        showPanel('batch');
        status('Preparación registrada. Conservamos tus piezas; vuelve a revisar el consumo del lote.');
      }
      await window.PanikoRefreshInventory?.();
      await window.PanikoFinishedProducts?.refresh?.();
    }catch(err){status(err.message,true);}
    finally{confirmingPrep=false;for(const x of enabled)x.disabled=false;clearPrepPreview();}
  });
  window.PanikoDough={selectRecipe(id){
    requestedRecipeId=id;
    return user?refresh():Promise.resolve();
  }};
  formBatch.elements.recipeId.addEventListener('change',()=>{
    const changed=formFormat.elements.recipeId.value!==formBatch.elements.recipeId.value;
    formFormat.elements.recipeId.value=formBatch.elements.recipeId.value;
    formBase.elements.recipeId.value=formBatch.elements.recipeId.value;
    syncBaseWeight();syncProductChoices();syncProductMode();
    if(changed&&formFormat.elements.productMode.value==='edit')loadSelectedFormat();
    renderProductCards();renderBatchRows();
  });
  formBatch.addEventListener('input',()=>{
    const hadPreview=lastPreview||$('dough-status').textContent==='Calculando existencias…';
    savePieceDraft();clearPreview();liveTotals();
    if(hadPreview)status('Cambiaste las cantidades. Vuelve a revisar el consumo.');
  });
  $('dough-clear-pieces').addEventListener('click',()=>{
    if(confirmingDough)return;
    for(const input of formBatch.querySelectorAll('.dough-pieces'))input.value='0';
    savePieceDraft();clearPreview();liveTotals();
  });
  formBatch.addEventListener('submit',async e=>{
    e.preventDefault();if(confirmingDough)return;clearPreview();
    const revision=batchRevision;
    try{
      const payload=selectedPayload();status('Calculando existencias…');
      const plan=await post('/api/dough/preview',payload);
      if(revision!==batchRevision)return;
      lastPreview=plan;lastPayload=payload;
      const result=$('dough-batch-preview');result.replaceChildren();
      result.append(el('h3',`Lote: ${num(plan.totalPieces)} piezas · ${num(plan.doughGrams)} g de masa`));
      result.append(el('p',`${plan.recipeName} · la receta base se escala según el peso total de masa.`,'hint'));
      const heading=el('h4','Productos');result.append(heading);
      for(const f of plan.formats)result.append(el('div',`${f.productName}: ${f.pieces} piezas × ${f.doughGramsPerPiece} g = ${f.doughGrams} g de masa`,'list-row'));
      result.append(el('h4','Ingredientes y complementos a descontar'));
      for(const line of plan.consumptions){
        const msg=`${line.name}: ${amount(line.required,line.unit)} · disponible ${amount(line.stock,line.unit)}`+
          (line.shortage>0?` · faltan ${amount(line.shortage,line.unit)}`:'');
        const lineBox=el('div',undefined,line.sufficient?'list-row':'list-row warning');
        lineBox.append(el('span',msg));
        const need=doughPreparationShortage(line,preparations);
        if(need){
          const action=el('button','Preparar '+num(need.quantity)+' '+need.yieldUnit+' faltantes','btn-soft');
          action.type='button';
          action.addEventListener('click',()=>{
            if(confirmingDough||confirmingPrep)return;
            savePieceDraft();returnToBatch=true;showPanel('prep');
            prepBatchForm.elements.recipeId.value=need.recipeId;
            prepBatchForm.elements.quantity.value=String(need.quantity);
            syncPrepQuantityLabel();clearPrepPreview();
            status('Faltan '+num(need.quantity)+' '+need.yieldUnit+' de '+need.recipeName+'. Revisa su consumo y confirma solo la cantidad realmente preparada.');
            prepBatchForm.elements.quantity.focus();
          });lineBox.append(action);
        }
        result.append(lineBox);
      }
      result.append(el('p',plan.stockAvailable?'Inventario suficiente: puedes confirmar.':'Inventario insuficiente. No puedes confirmar esta tanda.',plan.stockAvailable?'good':'warning'));
      $('dough-confirm').disabled=!plan.stockAvailable||confirmingDough;
      status(plan.stockAvailable?'Consumo revisado. Confirma cuando hayas elaborado el lote.':'Hay faltantes. Revisa las cantidades o prepara los complementos.',!plan.stockAvailable);
    }catch(err){if(revision===batchRevision){clearPreview();status(err.message,true);}}
  });
  $('dough-confirm').addEventListener('click',async()=>{
    if(confirmingDough||confirmingPrep||!lastPayload||!lastPreview?.stockAvailable)return;
    const summary=lastPreview.formats.map(f=>`${f.pieces} × ${f.productName}`).join(', ');
    if(!confirm(`¿Confirmas ${summary}? Se descontarán los ingredientes y complementos y se registrarán los productos terminados.`))return;
    const signature=JSON.stringify(lastPayload);
    if(!pendingDough||pendingDough.signature!==signature)pendingDough={signature,operationId:crypto.randomUUID()};
    const button=$('dough-confirm');confirmingDough=true;button.disabled=true;
    const enabled=[...formBatch.querySelectorAll('input,select,button')].filter(x=>!x.disabled);
    for(const x of enabled)x.disabled=true;
    try{
      const r=await post('/api/dough/confirm',{...lastPayload,operationId:pendingDough.operationId});
      pendingDough=null;
      clearPreview();for(const inp of formBatch.querySelectorAll('.dough-pieces'))inp.value='0';
      savePieceDraft();
      await refresh(`Lote registrado: ${r.totalPieces} piezas de ${r.finishedProducts.length} formatos. Se actualizaron las existencias.`);
      await Promise.all([window.PanikoRefreshInventory?.(),window.PanikoFinishedProducts?.refresh?.()]);
    }catch(err){status(err.message,true)}
    finally{confirmingDough=false;for(const x of enabled)x.disabled=false;liveTotals();button.disabled=!lastPreview?.stockAvailable;}
  });
  document.addEventListener('paniko:auth',e=>{
    user=e.detail?.user||null;
    root.hidden=!user;
    if(user)void refresh();else {prepCreateForm.hidden=true;prepCreateForm.elements.name.value='';prepCreateForm.elements.baseYield.value='';$('dough-prep-create-items').replaceChildren();$('dough-prep-catalog-list').replaceChildren();$('dough-prep-catalog-list').hidden=true;returnToBatch=false;refreshRevision++;config={bases:[],formats:[]};preparations=[];pieceDrafts.clear();$('dough-batch-formats').replaceChildren();clearPreview();clearPrepPreview();showPanel('batch');root.hidden=true;}
  });
})();
