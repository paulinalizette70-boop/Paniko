'use strict';
// Producción mixta de brioche: UNA masa compartida; formatos por gramaje y extras en stock.
(()=>{
  const $=id=>document.getElementById(id), root=$('dough-production');
  if(!root)return;
  const el=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=String(text);if(cls)e.className=cls;return e;};
  const status=(text,isError=false)=>{const n=$('dough-status');n.textContent=text;n.className=isError?'warning':'hint';};
  const num=n=>new Intl.NumberFormat('es-MX',{maximumFractionDigits:6}).format(n);
  const formBase=$('dough-base-form'),formFormat=$('dough-format-form'),formBatch=$('dough-batch-form');
  let user=null,config={bases:[],formats:[]},products=[],ingredients=[],recipes=[],lastPreview=null,lastPayload=null;
  const fetchJSON=async(url,opt={})=>{
    const res=await fetch(url,{credentials:'same-origin',...opt});
    const body=await res.json();if(!res.ok)throw Error(body.error||'No se pudo realizar la operación');return body;
  };
  const post=(url,payload)=>fetchJSON(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
  function fillSelect(node,entries,placeholder){
    const old=node.value;node.replaceChildren();
    const empty=el('option',placeholder);empty.value='';node.append(empty);
    for(const {id,name} of entries){const option=el('option',name);option.value=id;node.append(option)}
    if([...node.options].some(x=>x.value===old))node.value=old;
  }
  function unitsFor(ingredient){
    if(!ingredient)return [];
    if(['g','kg'].includes(ingredient.unit))return ['g','kg'];
    if(['ml','l'].includes(ingredient.unit))return ['ml','l'];
    return [ingredient.unit];
  }
  function addExtra(known){
    const row=el('div',undefined,'dough-extra-row');
    const select=el('select');select.setAttribute('aria-label','Ingrediente de relleno o cubierta');
    fillSelect(select,ingredients.map(x=>({id:x.id,name:`${x.name} (${x.unit})`})),'Selecciona complemento');
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
    fillSelect(formFormat.elements.productId,products.filter(p=>p.active).map(p=>({id:p.id,name:p.name})),'Selecciona producto terminado');
    const selectedBase=config.bases.find(b=>b.recipeId===formBase.elements.recipeId.value);
    if(selectedBase)formBase.elements.referenceGrams.value=String(selectedBase.referenceGrams);
    renderBatchRows();
  }
  function renderBatchRows(){
    const baseId=formBatch.elements.recipeId.value;
    const formats=config.formats.filter(f=>f.recipeId===baseId&&f.active);
    const root=$('dough-batch-formats');root.replaceChildren();
    if(!formats.length){root.append(el('p','Todavía no hay formatos configurados para esta masa.','muted'));return;}
    for(const item of formats){
      const row=el('div',undefined,'dough-batch-row');row.dataset.productId=item.productId;
      const description=el('div');description.append(el('strong',item.productName),el('small',`${item.doughGrams} g de masa por pieza`));
      if(item.extras.length)description.append(el('small',item.extras.map(e=>`${num(e.quantityPerPiece)} ${e.unit} ${e.name}`).join(' + ')));
      const label=el('label','Piezas');
      const qty=el('input');qty.type='number';qty.min='0';qty.step='1';qty.max='1000000';qty.value='0';qty.className='dough-pieces';qty.required=true;label.append(qty);
      row.append(description,label);root.append(row);
    }
    clearPreview();
  }
  function clearPreview(){lastPreview=null;lastPayload=null;$('dough-confirm').disabled=true;$('dough-batch-preview').replaceChildren();}
  async function refresh(){
    if(!user)return;
    try{
      [config,products,ingredients,recipes]=await Promise.all([
        fetchJSON('/api/dough/config'),fetchJSON('/api/products'),fetchJSON('/api/ingredients'),fetchJSON('/api/recipes')]);
      renderForms();root.hidden=false;$('dough-settings').hidden=user.role!=='admin';
      status(config.bases.length?'Configura las piezas de cada formato y calcula el lote.':'Primero configura el rendimiento en gramos de tu receta base.');
    }catch(e){root.hidden=false;status('No se pudo cargar producción por formatos: '+e.message,true);}
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
    const recipe=recipes.find(r=>r.id===formBase.elements.recipeId.value);
    formBase.elements.referenceGrams.value=recipe?.yieldUnit==='g'?String(recipe.baseYield):'';
  });
  formFormat.elements.productId.addEventListener('change',()=>{
    const f=config.formats.find(x=>x.productId===formFormat.elements.productId.value);
    $('dough-extra-items').replaceChildren();
    if(f){formFormat.elements.recipeId.value=f.recipeId;formFormat.elements.doughGrams.value=String(f.doughGrams);for(const extra of f.extras)addExtra(extra);}
    else formFormat.elements.doughGrams.value='';
  });
  $('dough-add-extra').addEventListener('click',()=>addExtra());
  formBase.addEventListener('submit',async e=>{
    e.preventDefault();try{
      await post('/api/dough/base',{recipeId:formBase.elements.recipeId.value,referenceGrams:Number(formBase.elements.referenceGrams.value)});
      status('Rendimiento de masa base guardado. No se modificó inventario.');await refresh();
    }catch(err){status(err.message,true)}
  });
  formFormat.addEventListener('submit',async e=>{
    e.preventDefault();try{
      const extras=[...$('dough-extra-items').children].map(row=>({ingredientId:row.querySelector('select').value,
        quantity:Number(row.querySelector('input').value),unit:row.querySelectorAll('select')[1].value}));
      await post('/api/dough/format',{recipeId:formFormat.elements.recipeId.value,productId:formFormat.elements.productId.value,
        doughGrams:Number(formFormat.elements.doughGrams.value),extras});
      status('Formato y complementos guardados. No se modificó inventario.');await refresh();
    }catch(err){status(err.message,true)}
  });
  formBatch.elements.recipeId.addEventListener('change',renderBatchRows);
  formBatch.addEventListener('input',clearPreview);
  formBatch.addEventListener('submit',async e=>{
    e.preventDefault();try{
      const payload=selectedPayload();const plan=await post('/api/dough/preview',payload);
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
      $('dough-confirm').disabled=!plan.stockAvailable;
    }catch(err){clearPreview();status(err.message,true)}
  });
  $('dough-confirm').addEventListener('click',async()=>{
    if(!lastPayload||!lastPreview?.stockAvailable)return;
    const summary=lastPreview.formats.map(f=>`${f.pieces} × ${f.productName}`).join(', ');
    if(!confirm(`¿Confirmas ${summary}? Se descontarán los ingredientes y complementos y se registrarán los productos terminados.`))return;
    const button=$('dough-confirm');button.disabled=true;
    try{
      const r=await post('/api/dough/confirm',lastPayload);
      clearPreview();for(const inp of formBatch.querySelectorAll('.dough-pieces'))inp.value='0';
      status(`Lote registrado: ${r.totalPieces} piezas de ${r.finishedProducts.length} formatos. Se actualizaron las existencias.`);
      await Promise.all([window.PanikoRefreshInventory?.(),window.PanikoFinishedProducts?.refresh?.()]);
    }catch(err){status(err.message,true)}
    finally{button.disabled=!lastPreview?.stockAvailable;}
  });
  document.addEventListener('paniko:auth',e=>{
    user=e.detail?.user||null;
    root.hidden=!user;
    if(user)void refresh();else {config={bases:[],formats:[]};lastPreview=null;lastPayload=null;root.hidden=true;}
  });
})();
