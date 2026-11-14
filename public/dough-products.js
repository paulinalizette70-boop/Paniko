'use strict';
// Paniko: la masa se guarda UNA vez como ficha con rendimiento en gramos.
// Aquí definimos qué productos salen de ella y qué extras necesita cada pieza.
(()=>{
  const get=id=>document.getElementById(id);
  const root=get('dough-workshop');
  if(!root)return;
  const create=(tag,value,cls)=>{
    const element=document.createElement(tag);
    if(value!==undefined)element.textContent=String(value);
    if(cls)element.className=cls;
    return element;
  };
  const button=(value,cls)=>{const b=create('button',value,cls);b.type='button';return b;};
  const label=(value,control)=>{const l=create('label',value);l.append(control);return l;};
  const fields=get('dough-template-form');
  const extraRows=get('dough-extra-rows');
  const templateList=get('dough-template-list');
  const baseSelect=get('dough-production-recipe');
  const allocations=get('dough-allocation-rows');
  const previewBox=get('dough-preview');
  const confirmBtn=get('dough-confirm-button');
  let user=null,recipes=[],ingredients=[],categories=[],templates=[],editing=null,previewKey=null;
  let refreshing=false;
  const status=(value,isError=false)=>{
    get('dough-status').textContent=value;
    get('dough-status').className=isError?'warning':'good';
  };
  async function api(route,options){
    const response=await fetch(route,options);
    let data;try{data=await response.json();}catch{throw Error('El servidor no devolvió una respuesta válida');}
    if(!response.ok)throw Error(data.error||'No se pudo completar la operación');
    return data;
  }
  const post=(route,body)=>api(route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  const option=(value,text)=>{const o=create('option',text);o.value=value;return o;};
  function fill(select,rows,empty,old){
    select.replaceChildren(option('',empty));
    rows.forEach(row=>select.append(option(row.value,row.label)));
    select.value=old&&[...select.options].some(o=>o.value===old)?old:(rows[0]?.value||'');
  }
  function compatible(ingredient){
    if(!ingredient)return[];
    const u=ingredient.unit;
    const name=String(ingredient.name).normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
    if(/^agua( |$)/.test(name)||/^leche( |$)/.test(name))return ['g','kg','ml','l'];
    if(/^huevos?( |$)/.test(name))return ['pieza','g','kg'];
    if(['g','kg'].includes(u))return ['g','kg'];
    if(['ml','l'].includes(u))return ['ml','l'];
    return [u];
  }
  function addExtraRow(entry=null){
    if(!ingredients.length)return status('Primero registra un ingrediente en Inventario.',true);
    const line=create('div',undefined,'dough-extra-line');
    const ingredientSelect=create('select');ingredientSelect.required=true;
    ingredientSelect.append(...ingredients.map(i=>option(i.id,i.name+' ('+i.unit+')')));
    if(entry?.ingredientId)ingredientSelect.value=entry.ingredientId;
    const qty=create('input');qty.type='number';qty.min='0.000001';qty.max='100000000';qty.step='0.000001';qty.required=true;
    qty.placeholder='Por pieza';qty.value=entry?.quantityPerPiece??'';
    const unitSelect=create('select');unitSelect.required=true;
    const remove=button('Quitar','btn-soft');
    function syncUnit(){
      const ing=ingredients.find(i=>i.id===ingredientSelect.value);
      const previous=unitSelect.value;
      unitSelect.replaceChildren(...compatible(ing).map(u=>option(u,u)));
      const preferred=entry?.ingredientId===ingredientSelect.value?entry.unit:null;
      unitSelect.value=[...unitSelect.options].some(o=>o.value===(preferred||previous))?(preferred||previous):ing?.unit;
    }
    ingredientSelect.addEventListener('change',()=>{syncUnit();invalidate();});
    qty.addEventListener('input',invalidate);
    unitSelect.addEventListener('change',invalidate);
    remove.addEventListener('click',()=>{line.remove();invalidate();});
    syncUnit();
    line.append(label('Ingrediente extra',ingredientSelect),label('Cantidad por pieza',qty),label('Unidad',unitSelect),remove);
    extraRows.append(line);
    return line;
  }
  function formBody(){
    const value=n=>fields.elements.namedItem(n)?.value;
    const extras=[...extraRows.children].map(line=>{
      const inputs=line.querySelectorAll('input,select');
      return {ingredientId:inputs[0].value,quantity:Number(inputs[1].value),unit:inputs[2].value};
    });
    return {name:value('name').trim(),categoryId:value('categoryId'),recipeId:value('recipeId'),
      gramsPerPiece:Number(value('gramsPerPiece')),extras};
  }
  function resetForm(){
    editing=null;fields.reset();extraRows.replaceChildren();
    get('dough-save-template').textContent='Guardar producto por gramaje';
    get('dough-cancel-template').hidden=true;
  }
  function renderTemplates(){
    templateList.replaceChildren();
    if(!templates.length){
      templateList.append(create('p','Todavía no hay productos por gramaje. Crea uno arriba y podrás usarlo en varias tandas.','muted'));
      return;
    }
    for(const t of templates){
      const card=create('article',undefined,'dough-product-card');
      const head=create('div',undefined,'dough-product-head');
      head.append(create('strong',t.name),create('span',t.gramsPerPiece+' g de masa / pieza','dough-weight'));
      card.append(head,create('p',t.recipeName+' · '+t.categoryName+' · '+t.stock+' piezas disponibles','muted'));
      if(t.extras.length){
        card.append(create('small','Extras por pieza: '+t.extras.map(e=>e.name+' '+e.quantityPerPiece+' '+e.unit).join(' · ')));
      }else card.append(create('small','Sin ingredientes extras'));
      const edit=button('Editar gramaje y extras','btn-soft');
      edit.addEventListener('click',()=>{
        editing=t.id;
        get('dough-template-details').open=true;
        fields.elements.namedItem('name').value=t.name;
        fields.elements.namedItem('categoryId').value=t.categoryId||'';
        fields.elements.namedItem('recipeId').value=t.recipeId;
        fields.elements.namedItem('gramsPerPiece').value=String(t.gramsPerPiece);
        extraRows.replaceChildren();
        t.extras.forEach(e=>addExtraRow(e));
        get('dough-save-template').textContent='Guardar cambios de este producto';
        get('dough-cancel-template').hidden=false;
        get('dough-template-details').scrollIntoView({behavior:'smooth',block:'start'});
      });
      card.append(edit);templateList.append(card);
    }
  }
  function invalidate(){
    previewKey=null;confirmBtn.disabled=true;
    previewBox.replaceChildren(create('p','Calcula primero la masa y los extras para esta tanda.','muted'));
  }
  function renderAllocations(){
    const old=new Map([...allocations.querySelectorAll('input[data-product]')]
      .map(input=>[input.dataset.product,input.value]));
    const selected=baseSelect.value;
    allocations.replaceChildren();
    const chosen=templates.filter(p=>p.active&&p.recipeId===selected);
    if(!selected){
      allocations.append(create('p','Primero crea una ficha de masa base con rendimiento en gramos en Recetas.','muted'));
    }else if(!chosen.length){
      allocations.append(create('p','Esta masa todavía no tiene productos por gramaje. Créales una ficha desde el formulario de arriba.','muted'));
    }else{
      for(const product of chosen){
        const row=create('div',undefined,'dough-allocation-row');
        const labelWrap=create('div');
        labelWrap.append(create('strong',product.name),create('small',product.gramsPerPiece+' g por pieza'));
        const qty=create('input');qty.type='number';qty.min='0';qty.max='100000';qty.step='1';qty.value=old.get(product.id)??'0';
        qty.dataset.product=product.id;qty.setAttribute('aria-label','Cantidad de '+product.name);
        qty.addEventListener('input',invalidate);
        row.append(labelWrap,qty);allocations.append(row);
      }
    }
    get('dough-calc-button').disabled=!chosen.length;
    invalidate();
  }
  function selection(){
    const items=[...allocations.querySelectorAll('input[data-product]')].map(el=>({
      productId:el.dataset.product,quantity:Number(el.value)})).filter(x=>x.quantity>0);
    if(!baseSelect.value)throw Error('Selecciona una ficha de masa base.');
    if(!items.length)throw Error('Escribe cuántas piezas quieres hacer de uno o más productos.');
    if(items.some(x=>!Number.isSafeInteger(x.quantity)||x.quantity>100000))
      throw Error('Las piezas deben ser números enteros.');
    return {recipeId:baseSelect.value,items};
  }
  function renderPreview(data){
    previewBox.replaceChildren();
    previewBox.append(create('h4','Necesitarás '+data.totalDoughGrams+' g de '+data.recipeName));
    const summary=create('ul',undefined,'dough-output-list');
    data.outputs.forEach(o=>{
      const li=create('li',o.quantity+' × '+o.name+' ('+o.gramsPerPiece+' g) = '+o.totalGrams+' g');
      summary.append(li);
    });
    previewBox.append(summary,create('h4','Ingredientes de la masa y extras'));
    for(const line of data.lines){
      const shortage=line.shortage>0?' · faltan '+line.shortage+' '+line.unit:'';
      previewBox.append(create('div',line.name+': '+line.required+' '+line.unit+' · disponibles '+line.stock+' '+line.unit+shortage,
        line.sufficient?'dough-stock-line':'dough-stock-line warning'));
    }
    previewBox.append(create('p',data.stockAvailable?
      'El inventario es suficiente. No se ha descontado nada todavía.':
      'Faltan ingredientes. No se puede confirmar esta tanda.',data.stockAvailable?'good':'warning'));
  }
  async function refresh(){
    if(!user||refreshing)return;
    refreshing=true;
    try{
      const [rr,ii,cc,tt]=await Promise.all([
        api('/api/recipes'),api('/api/ingredients'),api('/api/product-categories'),api('/api/dough-products')]);
      recipes=rr.filter(x=>x.yieldUnit==='g');
      ingredients=ii;categories=cc;templates=tt;
      const oldTemplateRecipe=fields.elements.namedItem('recipeId').value;
      const oldCat=fields.elements.namedItem('categoryId').value;
      const oldBase=baseSelect.value;
      fill(fields.elements.namedItem('recipeId'),recipes.map(x=>({value:x.id,label:x.name+' ('+x.baseYield+' g)'})),'Crea primero una masa en gramos',oldTemplateRecipe);
      fill(fields.elements.namedItem('categoryId'),categories.map(x=>({value:x.id,label:x.name})),'Selecciona categoría',oldCat);
      fill(baseSelect,recipes.map(x=>({value:x.id,label:x.name+' ('+x.baseYield+' g)'})),'Selecciona una masa base',oldBase);
      renderTemplates();renderAllocations();
    }catch(err){status(err.message,true);}
    finally{refreshing=false;}
  }
  fields.addEventListener('submit',async event=>{
    event.preventDefault();
    if(!fields.reportValidity())return;
    try{
      const route=editing?'/api/dough-products/'+editing+'/update':'/api/dough-products';
      await post(route,formBody());
      resetForm();await refresh();
      status('Producto guardado. Su gramaje y extras se usarán en futuras tandas. No se modificó el inventario.');
    }catch(err){status(err.message,true);}
  });
  get('dough-add-extra').addEventListener('click',()=>addExtraRow());
  get('dough-cancel-template').addEventListener('click',resetForm);
  baseSelect.addEventListener('change',renderAllocations);
  get('dough-calc-button').addEventListener('click',async()=>{
    try{
      const payload=selection();
      const data=await post('/api/dough-products/preview',payload);
      renderPreview(data);previewKey=JSON.stringify(payload);
      confirmBtn.disabled=!data.stockAvailable;
      status('Vista previa lista. Ningún ingrediente se ha descontado.');
    }catch(err){invalidate();status(err.message,true);}
  });
  confirmBtn.addEventListener('click',async()=>{
    try{
      const payload=selection();
      if(!previewKey||JSON.stringify(payload)!==previewKey)throw Error('Cambiaste las cantidades. Calcula de nuevo antes de producir.');
      const total=payload.items.reduce((n,x)=>{
        const product=templates.find(p=>p.id===x.productId);
        return n+product.gramsPerPiece*x.quantity;
      },0);
      if(!confirm('¿Confirmas '+total+' g de masa repartida entre '+payload.items.length+' producto(s)? Se descontarán los ingredientes de masa y los extras.'))return;
      confirmBtn.disabled=true;
      const done=await post('/api/dough-products/produce',payload);
      await Promise.all([window.PanikoRefreshInventory?.(),window.PanikoFinishedProducts?.refresh?.()]);
      document.dispatchEvent(new Event('paniko:production-saved'));
      await refresh();
      status('Tanda '+done.id+' confirmada. Se descontaron ingredientes y se sumaron '+done.finishedProducts.reduce((n,x)=>n+x.quantity,0)+' piezas terminadas.');
    }catch(err){status(err.message,true);}
    finally{invalidate();}
  });
  document.addEventListener('paniko:auth',e=>{
    user=e.detail.user;
    if(user)void refresh();
    else{recipes=[];templates=[];ingredients=[];categories=[];editing=null;templateList.replaceChildren();allocations.replaceChildren();invalidate();}
  });
  document.addEventListener('paniko:inventory-refreshed',()=>{if(user)void refresh();});
})();
