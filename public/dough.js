'use strict';
// Producción mixta de brioche: UNA masa compartida; formatos por gramaje y extras en stock.
// Separate prepared stock from ingredients added directly to a finished product.
function doughComplementChoices(ingredients,preparations,kind){
  const preparedIds=new Set(preparations.map(p=>p.ingredientId));
  return ingredients.filter(i=>kind==='prepared'?preparedIds.has(i.id):!preparedIds.has(i.id))
    .sort((a,b)=>a.name.localeCompare(b.name,'es'))
    .map(i=>({id:i.id,name:i.name+' ('+i.unit+')'}));
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
  module.exports={doughComplementChoices,syncDoughProductMode,doughBatchTotals,doughEditableProducts};
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
  const selectedFormats=()=>config.formats.filter(f=>f.recipeId===formBatch.elements.recipeId.value&&f.active&&products.some(p=>p.id===f.productId&&p.active));
  function showPanel(panel){
    if(panel==='settings'&&user?.role!=='admin')panel='batch';
    for(const name of ['batch','prep','settings'])$('dough-panel-'+name).hidden=name!==panel;
    for(const b of root.querySelectorAll('[data-dough-panel]'))b.setAttribute('aria-pressed',String(b.dataset.doughPanel===panel));
    if(panel==='settings')$('dough-settings').open=true;
  }
  for(const b of root.querySelectorAll('[data-dough-panel],[data-dough-go]'))b.addEventListener('click',()=>showPanel(b.dataset.doughPanel||b.dataset.doughGo));
  $('dough-reload').addEventListener('click',()=>{if(!confirmingDough&&!confirmingPrep)void refresh('Existencias actualizadas. Revisa el consumo antes de confirmar.');});
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
      card.append(el('strong',f.productName),el('small',num(f.doughGrams)+' g de masa por pieza'),el('small',f.extras.length?f.extras.map(e=>num(e.quantityPerPiece)+' '+e.unit+' '+e.name).join(' · '):'Sin complementos'));
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
    const choices=doughComplementChoices(ingredients,preparations,kind);
    if(!known&&!choices.length){
      status(kind==='prepared'?'Aún no hay preparaciones vinculadas. Vincula una ficha de costra o mermelada en el apartado de subpreparaciones.':'No hay ingredientes directos disponibles en inventario.',true);
      if(kind==='prepared'){
        const details=$('dough-prep-link-details');
        if(details&&!details.hidden){showPanel('prep');details.open=true;details.scrollIntoView({block:'start',behavior:'smooth'});}
      }
      return;
    }
    const row=el('div',undefined,'dough-extra-row');
    const select=el('select');select.required=true;
    select.setAttribute('aria-label',kind==='prepared'?'Preparación de relleno o cubierta':'Ingrediente directo de relleno o cubierta');
    fillSelect(select,choices,kind==='prepared'?'Selecciona preparación':'Selecciona ingrediente directo');
    const qty=el('input');qty.type='number';qty.min='0.000001';qty.step='0.000001';qty.required=true;qty.placeholder='Cantidad por pieza';
    const unit=el('select');unit.setAttribute('aria-label','Unidad');
    const del=el('button','Quitar','btn-soft');del.type='button';del.addEventListener('click',()=>row.remove());
    const update=()=>{const ing=ingredients.find(x=>x.id===select.value),old=unit.value;unit.replaceChildren();for(const value of unitsFor(ing)){const option=el('option',value);option.value=value;unit.append(option)}if([...unit.options].some(o=>o.value===old))unit.value=old;else unit.value=ing?.unit||'';};
    select.addEventListener('change',update);
    row.append(select,qty,unit,del);$('dough-extra-items').append(row);
    if(known){select.value=known.ingredientId;update();qty.value=String(known.quantityPerPiece);unit.value=known.unit||ingredients.find(x=>x.id===known.ingredientId)?.unit||'';}
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
      if(item.extras.length)description.append(el('small',item.extras.map(e=>`${num(e.quantityPerPiece)} ${e.unit} ${e.name}`).join(' + ')));
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
      for(const b of root.querySelectorAll('[data-dough-panel="settings"],[data-dough-go="settings"]'))b.hidden=user.role!=='admin';
      if(user.role!=='admin'&&!$('dough-panel-settings').hidden)showPanel('batch');
      if(message||!$('dough-status').textContent)status(message|| (config.bases.length?'Captura las piezas y revisa el consumo.':'Configura primero el rendimiento de tu masa base.'));
      return true;
    }catch(e){if(revision===refreshRevision){root.hidden=false;status('No se pudo cargar producción por formatos: '+e.message,true);}return false;}
  }
  function selectedPayload(){
    const recipeId=formBatch.elements.recipeId.value;
    const formats=[...$('dough-batch-formats').children].filter(e=>e.dataset.productId)
      .map(e=>({productId:e.dataset.productId,pieces:Number(e.querySelector('.dough-pieces').value)})).filter(x=>x.pieces>0);
    if(!recipeId||!formats.length)throw Error('Selecciona una masa y al menos un formato con piezas.');
    if(formats.some(x=>!Number.isSafeInteger(x.pieces)))throw Error('Las cantidades deben ser piezas enteras.');
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
    e.preventDefault();if(savingFormat)return;
    savingFormat=true;const button=$('dough-save-product');button.disabled=true;
    try{
      const extras=[...$('dough-extra-items').children].map(row=>({ingredientId:row.querySelector('select').value,
        quantity:Number(row.querySelector('input').value),unit:row.querySelectorAll('select')[1].value}));
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
  const prepLinkForm=$('dough-prep-link-form'),prepBatchForm=$('dough-prep-batch-form');
  function syncExistingIngredientChoices(){
    const r=recipes.find(x=>x.id===prepLinkForm.elements.recipeId.value);
    const linkedIds=new Set(preparations.map(p=>p.ingredientId));
    const list=ingredients.filter(i=>!linkedIds.has(i.id)&&(r?.yieldUnit==='g'?['g','kg'].includes(i.unit):r?.yieldUnit==='ml'?['ml','l'].includes(i.unit):false))
      .map(i=>({id:i.id,name:i.name+' ('+i.unit+')'}));
    fillSelect(prepLinkForm.elements.ingredientId,list,'Crear existencia nueva automáticamente');
  }
  function renderPreparationForms(){
    const already=new Set(preparations.map(x=>x.recipeId));
    fillSelect(prepLinkForm.elements.recipeId,recipes.filter(r=>['g','ml'].includes(r.yieldUnit)&&!already.has(r.id))
      .map(r=>({id:r.id,name:r.name+' · '+r.baseYield+' '+r.yieldUnit})),'Selecciona una receta complementaria');
    syncExistingIngredientChoices();
    fillSelect(prepBatchForm.elements.recipeId,preparations.map(p=>({id:p.recipeId,name:p.recipeName+' · '+p.yieldUnit})),
      'Selecciona una preparación vinculada');
    const root=$('dough-prep-list');root.replaceChildren();
    if(!preparations.length)root.append(el('p','Aún no hay recetas complementarias vinculadas. Puedes comenzar con la costra de concha.','muted'));
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
      await refresh('Preparación registrada: +'+num(result.addedQuantity)+' '+result.unit+' de '+result.ingredientName+'.');
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
        const msg=`${line.name}: ${num(line.required)} ${line.unit} · disponible ${num(line.stock)} ${line.unit}`+
          (line.shortage>0?` · faltan ${num(line.shortage)} ${line.unit}`:'');
        result.append(el('div',msg,line.sufficient?'list-row':'list-row warning'));
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
    if(user)void refresh();else {refreshRevision++;config={bases:[],formats:[]};preparations=[];pieceDrafts.clear();$('dough-batch-formats').replaceChildren();clearPreview();clearPrepPreview();showPanel('batch');root.hidden=true;}
  });
})();
