'use strict';
// Módulo independiente del inventario de productos terminados.
// No usa ni copia fórmulas privadas del navegador.
(() => {
  const root=document.getElementById('finished-inventory-content');
  const recipePicker=document.getElementById('finished-product-selector');
  if(!root)return;
  const el=(tag,text,cls)=>{
    const e=document.createElement(tag);
    if(text!==undefined)e.textContent=String(text);
    if(cls)e.className=cls;
    return e;
  };
  const set=(parent,...nodes)=>parent.append(...nodes);
  const label=(title,input)=>{const l=el('label',title);l.append(input);return l;};
  const input=(type,name,value='',attrs={})=>{
    const e=el('input');e.type=type;e.name=name;e.value=value===null?'':String(value);
    for(const [attr,val] of Object.entries(attrs))e.setAttribute(attr,String(val));
    return e;
  };
  const button=(title,cls)=>{const b=el('button',title,cls);b.type='button';return b;};
  const select=(name,options,selected)=>{
    const s=el('select');s.name=name;
    for(const item of options){const o=el('option',item.label);o.value=item.value;s.append(o);}
    if(selected!==undefined&&selected!==null)s.value=selected;
    return s;
  };
  const fmtMoney=n=>n===null?'Precio pendiente':new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN'}).format(n);
  let currentUser=null,products=[],categories=[],recipes=[],movements=[];
  let previousProductionRecipeId=null;
  let hadLinkedProducts=false;
  const normalizeSearch=(value)=>String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es');
  const search=document.getElementById('finished-search');
  const lowOnly=document.getElementById('finished-low-only');
  search?.addEventListener('input',render);
  lowOnly?.addEventListener('change',render);
  const isAdmin=()=>currentUser?.role==='admin';
  async function api(route,options){
    const response=await fetch(route,options);
    let json;try{json=await response.json();}catch{throw Error('El servidor no devolvió JSON');}
    if(!response.ok)throw Error(json.error||'Error de solicitud');
    return json;
  }
  const post=(route,value)=>api(route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(value)});
  const status=(message,error=false)=>{
    const target=document.getElementById('finished-status');
    if(target){target.textContent=message;target.className='finished-status '+(error?'warning':'good');}
  };
  function updateProductionOptions(){
    if(!recipePicker)return;
    const old=recipePicker.value;
    const recipeId=document.getElementById('scale-form')?.elements.recipe?.value;
    const changed=recipeId!==previousProductionRecipeId;
    const linked=products.filter(p=>p.active&&p.operationalRecipeId===recipeId);
    recipePicker.replaceChildren();
    const empty=el('option','Sin producto vinculado: solo descuenta ingredientes');empty.value='';recipePicker.append(empty);
    for(const product of linked){
      const option=el('option',product.name);option.value=product.id;recipePicker.append(option);
    }
    // Si hay una sola opción, la seleccionamos al cambiar de receta.
    // Conservar una selección explícita (incluso "ninguna") al actualizar la lista.
    if((changed||!hadLinkedProducts)&&linked.length===1)recipePicker.value=linked[0].id;
    else if([...recipePicker.options].some(o=>o.value===old))recipePicker.value=old;
    previousProductionRecipeId=recipeId;
    hadLinkedProducts=linked.length>0;
  }
  document.getElementById('scale-form')?.elements.recipe?.addEventListener('change',updateProductionOptions);
  function categoryChoices(){return categories.map(c=>({label:c.name,value:c.id}));}
  function recipeChoices(){return [{label:'Sin vincular — no suma stock automáticamente',value:''},...recipes.map(r=>({label:r.name+' ('+r.baseYield+' piezas)',value:r.id}))];}
  function render(){
    root.replaceChildren();
    const metrics=el('div',undefined,'finished-metrics');
    const active=products.filter(p=>p.active);
    const low=active.filter(p=>p.minStock!==null&&p.stock<=p.minStock).length;
    const stats=[products.length+' productos',active.reduce((n,p)=>n+p.stock,0)+' piezas registradas',low+' con stock bajo'];
    for(const v of stats)set(metrics,el('span',v,'finished-metric'));
    root.append(metrics);
    const toolbar=el('div',undefined,'finished-toolbar');
    {
      const importBtn=button('Incorporar productos del catálogo de preparaciones','secondary');
      importBtn.addEventListener('click',async()=>{
        if(!confirm('Se agregarán los productos que falten del catálogo de preparaciones, con inventario inicial 0. No se modificarán las existencias ni los precios ya registrados. ¿Continuar?'))return;
        try{const result=await post('/api/products/import-catalog',{});await refresh();status(`Catálogo revisado: ${result.source} origen, ${result.created} nuevos, ${result.already} ya existentes.`);}
        catch(e){status(e.message,true);}
      });
      const newBtn=button('Registrar producto','secondary');
      const newCatBtn=button('Crear categoría','secondary');
      toolbar.append(importBtn,newBtn,newCatBtn);
      if(isAdmin()){
        const costs=button('Editar costos y precios en Finanzas','btn-soft');
        costs.addEventListener('click',()=>window.PanikoNavigate?.('finance'));
        toolbar.append(costs);
      }
      const newBox=el('div');newBox.hidden=true;
      const form=el('form');form.className='finished-editor';
      const productName=input('text','productName','',{required:'',maxlength:150});
      const cat=select('categoryId',categoryChoices());cat.required=true;
      const price=input('number','salePrice','',{min:0,step:'0.01',placeholder:'Opcional'});
      const min=input('number','minStock','',{min:0,step:1,placeholder:'Opcional'});
      const linked=select('operationalRecipeId',recipeChoices());
      const save=el('button','Guardar producto');save.type='submit';
      set(form,label('Nombre',productName),label('Categoría',cat));
      if(isAdmin())form.append(label('Precio de venta (MXN) · Administración',price));
      set(form,label('Stock mínimo (opcional)',min),label('Receta operativa vinculada (opcional)',linked),save);
      form.addEventListener('submit',async e=>{
        e.preventDefault();
        try{
          await post('/api/products',{name:productName.value,categoryId:cat.value,salePrice:price.value===''?null:Number(price.value),minStock:min.value===''?null:Number(min.value),operationalRecipeId:linked.value||null});
          await refresh();status('Producto registrado con stock inicial 0. Registra después su conteo físico.');
        }catch(err){status(err.message,true);}
      });
      newBox.append(form);
      newBtn.addEventListener('click',()=>{newBox.hidden=!newBox.hidden;});
      const catBox=el('div');catBox.hidden=true;
      const catForm=el('form');catForm.className='finished-actions';
      const newName=input('text','categoryName','',{required:'',maxlength:100,placeholder:'Nombre de categoría'});
      const catSave=el('button','Guardar categoría');catSave.type='submit';
      set(catForm,label('Nueva categoría',newName),catSave);
      catForm.addEventListener('submit',async e=>{
        e.preventDefault();try{await post('/api/product-categories',{name:newName.value});await refresh();status('Categoría registrada.');}catch(err){status(err.message,true);}
      });
      catBox.append(catForm);
      newCatBtn.addEventListener('click',()=>{catBox.hidden=!catBox.hidden;});
      root.append(toolbar,newBox,catBox);
    }
    const statusRow=el('p',undefined,'finished-status');statusRow.id='finished-status';root.append(statusRow);
    if(!products.length){root.append(el('p','Aún no hay productos terminados. Puedes registrarlos aquí.','muted'));return;}
    const query=normalizeSearch(search?.value.trim()||'')||'';
    const visible=products.filter(p=>(!query||normalizeSearch(p.name).includes(query)||normalizeSearch(p.categoryName).includes(query))&&
      (!lowOnly?.checked||(p.minStock!==null&&p.stock<=p.minStock)));
    if(!visible.length)root.append(el('p','No hay productos que coincidan con los filtros.','muted'));
    const groupNames=[...new Set(visible.map(p=>p.categoryName))];
    for(const catName of groupNames){
      root.append(el('h3',catName,'finished-category'));
      for(const p of visible.filter(p=>p.categoryName===catName)){
        const card=el('article',undefined,'finished-item');
        const header=el('header');
        const name=el('strong',p.name);
        const low=p.minStock!==null&&p.stock<=p.minStock;
        const count=el('span',`${p.stock} pieza${p.stock===1?'':'s'}${low?' · stock bajo':''}`,low?'finished-warning':'finished-sale');
        set(header,name,count);card.append(header);
        const subtitle=el('p',`${fmtMoney(p.salePrice)} · ${p.active?'Activo':'Inactivo'} · Stock mínimo: ${p.minStock===null?'sin definir':p.minStock}`,'muted');card.append(subtitle);
        {
          const details=el('details');set(details,el('summary','Editar producto'));
          const form=el('form');form.className='finished-editor';
          const n=input('text','productName',p.name,{required:'',maxlength:150});
          const c=select('categoryId',categoryChoices(),p.categoryId);c.required=true;
          const price=input('number','salePrice',p.salePrice,{min:0,step:'0.01',placeholder:'Sin definir'});
          const minimum=input('number','minStock',p.minStock,{min:0,step:1,placeholder:'Sin definir'});
          const link=select('operationalRecipeId',recipeChoices(),p.operationalRecipeId||'');
          const active=el('input');active.type='checkbox';active.checked=p.active;
          const save=el('button','Guardar cambios');save.type='submit';
          set(form,label('Nombre',n),label('Categoría',c));
          if(isAdmin())form.append(label('Precio MXN · Administración',price));
          set(form,label('Stock mínimo',minimum),label('Receta operativa vinculada',link),label('Producto activo',active),save);
          form.addEventListener('submit',async e=>{
            e.preventDefault();
            try{
              await post(`/api/products/${p.id}/update`,{name:n.value,categoryId:c.value,salePrice:price.value===''?null:Number(price.value),minStock:minimum.value===''?null:Number(minimum.value),operationalRecipeId:link.value||null,active:active.checked});
              await refresh();status('Producto actualizado, sin cambiar el inventario.');
            }catch(err){status(err.message,true);}
          });
          details.append(form);card.append(details);
        }
        if(p.active){
          const toggle=button('Otros movimientos','secondary');
          toggle.setAttribute('aria-expanded','false');
          const box=el('div');box.hidden=true;
          toggle.addEventListener('click',()=>{
            box.hidden=!box.hidden;
            box.classList.toggle('movement-form-open',!box.hidden);
            toggle.setAttribute('aria-expanded',String(!box.hidden));
            toggle.textContent=box.hidden?'Otros movimientos':'Ocultar movimientos';
          });
          const saleButton=button('Registrar venta','sale-button');
          saleButton.addEventListener('click',()=>{
            box.hidden=false;box.classList.add('movement-form-open');
            toggle.setAttribute('aria-expanded','true');toggle.textContent='Ocultar movimientos';
            type.value='venta';qty.focus();
          });
          card.append(saleButton,toggle);
          const form=el('form');form.className='finished-editor';
          const type=select('movementType',[
            {value:'venta',label:'Venta · restar piezas'},
            {value:'produccion_manual',label:'Entrada manual (NO descuenta ingredientes)'},
            {value:'merma',label:'Salida por merma'},
            {value:'ajuste_entrada',label:'Ajuste por conteo: sumar'},
            {value:'ajuste_salida',label:'Ajuste por conteo: restar'}]);
          const qty=input('number','quantity','1',{min:1,step:1,required:''});
          const reason=input('text','reason','',{required:'',maxlength:150,placeholder:'Motivo de este movimiento'});
          const save=el('button','Registrar movimiento');save.type='submit';
          set(form,label('Tipo de movimiento',type),label('Piezas',qty),label('Motivo',reason),save);
          form.addEventListener('submit',async e=>{
            e.preventDefault();
            if(type.value==='produccion_manual'&&!confirm('Esta entrada suma piezas terminadas, pero NO descuenta ingredientes. ¿Continuar?'))return;
            try{
              const result=await post(`/api/products/${p.id}/movements`,{type:type.value,quantity:Number(qty.value),reason:reason.value});
              await refresh();status(`${p.name}: ${result.before} → ${result.after} piezas.`);
            }catch(err){status(err.message,true);}
          });
          box.append(form);card.append(box);
        } else {
          card.append(el('p','Producto inactivo: actívalo desde «Editar producto» para registrar movimientos.','muted'));
        }
        root.append(card);
      }
    }
    if(movements.length){
      root.append(el('h3','Movimientos recientes'));
      const history=el('div',undefined,'finished-history');
      for(const m of movements.slice(0,20))history.append(el('div',`${m.productName} · ${m.type.replaceAll('_',' ')} · ${m.quantity} pieza(s) · ${m.before} → ${m.after} · ${m.reason}`,'list-row'));
      root.append(history);
    }
  }
  async function refresh(){
    if(!currentUser){root.replaceChildren();return;}
    try{
      [categories,products,movements,recipes]=await Promise.all([
        api('/api/product-categories'),api('/api/products'),api('/api/products/movements'),api('/api/recipes')]);
      render();updateProductionOptions();
    }catch(e){root.replaceChildren(el('p',e.message,'warning'));}
  }
  document.addEventListener('paniko:auth',event=>{
    currentUser=event.detail.user;
    if(currentUser)void refresh();else{products=[];root.replaceChildren();updateProductionOptions();}
  });
  window.PanikoFinishedProducts={refresh,updateProductionOptions};
})();
