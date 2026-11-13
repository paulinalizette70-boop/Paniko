'use strict';
(()=>{
 const root=document.getElementById('sourdough-list');if(!root)return;
 const $=id=>document.getElementById(id);
 const node=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=String(text);if(cls)e.className=cls;return e;};
 const append=(parent,...children)=>parent.append(...children);
 const field=(label,input)=>{const e=node('label',label);e.append(input);return e;};
 const input=(type,name,val='',options={})=>{const i=node('input');i.type=type;i.name=name;i.value=val===null?'':String(val);for(const [key,v] of Object.entries(options))i.setAttribute(key,v);return i;};
 const select=(name,options,initial)=>{const s=node('select');s.name=name;for(const [value,text] of options){const o=node('option',text);o.value=value;s.append(o);}s.value=initial;return s;};
 async function api(url,method='GET',body){const response=await fetch(url,{method,headers:method==='POST'?{'Content-Type':'application/json'}:{},body:method==='POST'?JSON.stringify(body):undefined});const result=await response.json();if(!response.ok)throw Error(result.error||'Solicitud no completada');return result;}
 function message(text,error=false){const p=$('sourdough-message');if(p){p.textContent=text;p.className=error?'warning':'good';}}
 const dateText=value=>value?new Date(value).toLocaleString('es-MX',{dateStyle:'medium',timeStyle:'short'}):'No registrada';
 const format=n=>new Intl.NumberFormat('es-MX',{maximumFractionDigits:2}).format(n);
 let inventoryIngredients=[];
 function ingredientSelect(name,units,chosen){
   const items=inventoryIngredients.filter(x=>units.includes(x.unit));
   const choices=[['','Elige un ingrediente'],...items.map(x=>[x.id,`${x.name} · ${format(x.stock)} ${x.unit}`])];
   return select(name,choices,chosen||'');
 } 
 function nextText(starter){
   if(!starter.lastFedAt)return 'Sin alimentación registrada';
   const next=new Date(starter.lastFedAt).getTime()+starter.feedEveryHours*3600000;
   if(!Number.isFinite(next))return 'Fecha por confirmar';
   return (Date.now()>next?'Revisión pendiente desde ':'Próxima revisión: ')+dateText(next);
 }
 function starterCard(starter){
  const card=node('article',undefined,'starter-card'),header=node('header');header.append(node('h2',starter.name),node('span',starter.active?'En seguimiento':'Inactiva','starter-status'));card.append(header);
  const metrics=node('div',undefined,'starter-metrics');
  for(const [label,value] of [['Cantidad actual',starter.currentWeightGrams===null?'Por registrar':format(starter.currentWeightGrams)+' g'],['Ubicación',starter.location==='ambiente'?'Ambiente':'Refrigerador'],['Última alimentación',dateText(starter.lastFedAt)],['Revisión',nextText(starter)]]){
    const box=node('div',undefined,'starter-metric');box.append(node('small',label),node('strong',value));metrics.append(box);
  }card.append(metrics);
  if(starter.notes)card.append(node('p',starter.notes,'hint'));
  const linked=node('p',starter.inventoryLinked?'Conectada al inventario: las alimentaciones descuentan harina y agua y actualizan masa madre.':'Sin conectar a Inventario: vincula los tres ingredientes antes de registrar una alimentación.',starter.inventoryLinked?'good':'warning');
  card.append(linked);
  if(starter.inventoryLinked){
    const names=[['Masa madre',starter.starterIngredientId],['Harina',starter.flourIngredientId],['Agua',starter.waterIngredientId]];
    const links=node('div',undefined,'starter-linked-stock');
    for(const [label,id] of names){
      const item=inventoryIngredients.find(i=>i.id===id);
      links.append(node('p',item?`${label}: ${item.name} · ${format(item.stock)} ${item.unit}`:`${label}: ingrediente no disponible`,'hint'));
    }
    card.append(links);
  }
  if(!starter.inventoryLinked)card.append(node('p','Para sincronizar la cantidad inicial, elige si conservar el peso de Inventario o usar el peso registrado en esta masa madre. El segundo caso modifica Inventario con un movimiento auditable.','hint'));
  const connection=node('details');connection.append(node('summary',starter.inventoryLinked?'Ver vinculación de ingredientes':'Conectar con inventario'));
  const cf=node('form',undefined,'form-stack');
  const starterSelect=ingredientSelect('starterIngredientId',['g','kg'],starter.starterIngredientId);
  const flourSelect=ingredientSelect('flourIngredientId',['g','kg'],starter.flourIngredientId);
  const waterSelect=ingredientSelect('waterIngredientId',['g','kg','ml','l'],starter.waterIngredientId);
  if(starter.inventoryLinked){starterSelect.disabled=true;}
  const syncMode=select('syncMode',[[ 'inventory','Conservar existencias actuales de Inventario (sin ajuste)' ],[ 'starter','Sincronizar Inventario con el peso registrado en Mi masa madre (con movimiento)' ]],'inventory');
  if(starter.inventoryLinked)syncMode.disabled=true;
  const explain=node('p','Si tu masa madre ya tiene un peso registrado pero el ingrediente en Inventario aparece en cero, elige la segunda opción para igualarlos. Solo se permite durante el primer vínculo; queda registrado como ajuste. Si falta un ingrediente, regístralo primero en Ingredientes.','hint');
  const connect=node('button',starter.inventoryLinked?'Actualizar harina y agua vinculadas':'Conectar ingredientes','btn-soft');connect.type='submit';
  append(cf,field('Masa madre del inventario (g o kg)',starterSelect),field('Harina que utilizas (g o kg)',flourSelect),field('Agua que utilizas (g, kg, ml o l)',waterSelect));
  if(!starter.inventoryLinked)cf.append(field('¿Qué cantidad inicial quieres conservar?',syncMode));
  append(cf,explain,connect);
  cf.addEventListener('submit',async e=>{e.preventDefault();connect.disabled=true;
    try{
      const ids={starterIngredientId:starterSelect.value,flourIngredientId:flourSelect.value,waterIngredientId:waterSelect.value};
      if(new Set(Object.values(ids)).size!==3||Object.values(ids).some(x=>!x))throw Error('Elige tres ingredientes distintos.');
      const previous=starter.currentWeightGrams;
      const actual=inventoryIngredients.find(i=>i.id===ids.starterIngredientId);
      const actualGrams=actual?actual.stock*(actual.unit==='kg'?1000:1):null;
      const mode=starter.inventoryLinked?'inventory':syncMode.value;
      if(actualGrams===null)throw Error('Selecciona un ingrediente de masa madre válido.');
      if(mode==='starter'&&previous===null)throw Error('Primero registra el peso de tu masa madre para sincronizarlo.');
      const description=mode==='starter'
        ?`El peso de la bitácora es ${format(previous)} g. Inventario registra ${format(actualGrams)} g. ¿CONFIRMAS actualizar Inventario y registrar la diferencia como movimiento?`
        :`Inventario registra ${format(actualGrams)} g de masa madre${previous===null?'':` y la bitácora ${format(previous)} g`}. Se utilizará Inventario como referencia, sin modificar las existencias. ¿Continuar?`;
      if(!confirm(description)){connect.disabled=false;return;}
      const result=await api(`/api/sourdough/starters/${starter.id}/link-inventory`,'POST',{...ids,syncMode:mode,expectedInventoryGrams:actualGrams});
      await refresh();window.PanikoRefreshInventory?.();
      message(result.inventoryUpdated
        ?`Inventario sincronizado: ahora tienes ${format(result.currentWeightGrams)} g de masa madre. El ajuste quedó registrado en movimientos.`
        :`Vinculación guardada: se usarán ${format(result.currentWeightGrams)} g registrados en Inventario. Las alimentaciones posteriores actualizarán sus existencias.`);
    }catch(err){message(err.message,true);connect.disabled=false;}
  });connection.append(cf);card.append(connection);
  if(!starter.inventoryLinked)return card;
  const reconcile=node('details');reconcile.append(node('summary','Corregir existencias de masa madre (conteo físico)'));
  const rf=node('form',undefined,'form-stack');
  const counted=input('number','realWeightGrams',starter.currentWeightGrams,{min:'0',max:'1000000',step:'0.01',required:''});
  const countedText=node('p','Úsalo si la vinculación anterior dejó las existencias en 0 o en otra cantidad incorrecta. Pesa la masa madre y registra el valor real. Este ajuste solo afecta la existencia de Masa madre; NO descuenta harina ni agua y quedará en el historial de movimientos.','hint');
  const reconcileSave=node('button','Guardar conteo físico en Inventario','btn-soft');reconcileSave.type='submit';
  rf.append(field('Peso real de masa madre (g)',counted),countedText,reconcileSave);
  rf.addEventListener('submit',async e=>{e.preventDefault();reconcileSave.disabled=true;
    try{
      const realWeightGrams=Number(counted.value);
      const beforeGrams=starter.currentWeightGrams;
      if(!Number.isFinite(realWeightGrams)||realWeightGrams<0)throw Error('Escribe el peso real en gramos.');
      if(!confirm(`Inventario registra ${format(beforeGrams)} g. ¿Confirmas que realmente tienes ${format(realWeightGrams)} g? Se ajustará el inventario y se guardará el movimiento, pero no se registrará una alimentación.`)){reconcileSave.disabled=false;return;}
      const result=await api(`/api/sourdough/starters/${starter.id}/reconcile-inventory`,'POST',{realWeightGrams,expectedInventoryGrams:beforeGrams});
      await refresh();window.PanikoRefreshInventory?.();
      message(result.inventoryUpdated?`Conteo guardado. Inventario registra ahora ${format(result.currentWeightGrams)} g de masa madre.`:'Las existencias ya coincidían. No fue necesario registrar movimiento.');
    }catch(err){message(err.message,true);reconcileSave.disabled=false;}
  });reconcile.append(rf);card.append(reconcile);
  const details=node('details');details.append(node('summary','Registrar alimentación y actualizar inventario'));
  const form=node('form',undefined,'form-stack');
  const before=input('number','beforeGrams',starter.currentWeightGrams,{min:'0',max:'1000000',step:'0.01',required:''});
  const discard=input('number','discardedGrams','0',{min:'0',max:'1000000',step:'0.01',required:''});
  const flour=input('number','flourGrams','',{min:'0.01',max:'1000000',step:'0.01',required:''});
  const water=input('number','waterGrams','',{min:'0.01',max:'1000000',step:'0.01',required:''});
  const notes=input('text','notes','',{maxlength:'500',placeholder:'Aroma, burbujas, temperatura…'});
  const save=node('button','Guardar alimentación','btn-primary');save.type='submit';
  append(form,field('Masa madre antes de alimentar (g)',before),field('Cantidad descartada (g)',discard),field('Harina agregada (g)',flour),field('Agua agregada (g)',water),field('Observaciones',notes),save);
  form.addEventListener('submit',async e=>{e.preventDefault();save.disabled=true;
    try{const result=await api(`/api/sourdough/starters/${starter.id}/feed`,'POST',{beforeGrams:Number(before.value),discardedGrams:Number(discard.value),flourGrams:Number(flour.value),waterGrams:Number(water.value),notes:notes.value});
      await refresh();message(`Inventario actualizado: ${format(result.afterGrams)} g de masa madre; se descontaron ${format(result.flourGrams)} g de harina y ${format(result.waterGrams)} g de agua.`);
      window.PanikoRefreshInventory?.();
    }catch(e){message(e.message,true);save.disabled=false;}
  });details.append(form);card.append(details);
  const settings=node('details');settings.append(node('summary','Cambiar ubicación o frecuencia'));
  const sf=node('form',undefined,'form-stack');const loc=select('location',[['ambiente','Temperatura ambiente'],['refrigerador','Refrigerador']],starter.location);
  const hours=input('number','feedEveryHours',starter.feedEveryHours,{min:'1',max:'336',step:'1',required:''});const settingNotes=input('text','notes',starter.notes,{maxlength:'500'});
  const act=node('input');act.type='checkbox';act.checked=starter.active;const submit=node('button','Guardar configuración','btn-soft');submit.type='submit';
  append(sf,field('Ubicación',loc),field('Revisar cada cuántas horas',hours),field('Notas',settingNotes),field('En seguimiento',act),submit);
  sf.addEventListener('submit',async e=>{e.preventDefault();try{await api(`/api/sourdough/starters/${starter.id}/update`,'POST',{location:loc.value,feedEveryHours:Number(hours.value),notes:settingNotes.value,active:act.checked});await refresh();message('Configuración actualizada.');}catch(e){message(e.message,true);}});
  settings.append(sf);card.append(settings);
  const history=node('details');history.append(node('summary','Ver las últimas 50 alimentaciones'));
  history.addEventListener('toggle',async()=>{if(!history.open)return;const existing=history.querySelector('.starter-logs');if(existing)existing.remove();const result=node('div',undefined,'starter-logs');history.append(result);
    try{const list=await api(`/api/sourdough/starters/${starter.id}/feedings`);if(!list.length)result.append(node('p','Todavía no hay alimentaciones registradas.','muted'));
      for(const f of list){const entry=node('div');entry.append(node('strong',dateText(f.fedAt)),node('p',`${format(f.beforeGrams)} g antes − ${format(f.discardedGrams)} g descartados + ${format(f.flourGrams)} g harina + ${format(f.waterGrams)} g agua = ${format(f.afterGrams)} g. Hidratación de la alimentación: ${format(f.feedHydrationPercent)} %`));if(f.notes)entry.append(node('p',f.notes,'muted'));entry.append(node('small',f.inventoryUpdated?'Inventario actualizado':'Registro anterior sin actualización de inventario','hint'));result.append(entry);}}
    catch(e){result.replaceChildren(node('p',e.message,'warning'));}
  });card.append(history);return card;
 }
 async function refresh(){root.replaceChildren(node('p','Cargando tus masas madre…','muted'));
  try{const [list,ings]=await Promise.all([api('/api/sourdough/starters'),api('/api/ingredients')]);inventoryIngredients=ings;root.replaceChildren();if(!list.length)root.append(node('p','Agrega tu primera masa madre para comenzar a llevar el registro.','muted'));for(const starter of list)root.append(starterCard(starter));}
  catch(e){root.replaceChildren(node('p',e.message,'warning'));}
 }
 $('starter-create-form').addEventListener('submit',async e=>{e.preventDefault();const f=e.currentTarget;
  try{await api('/api/sourdough/starters','POST',{name:f.elements.name.value,location:f.elements.location.value,feedEveryHours:Number(f.elements.feedEveryHours.value),initialWeightGrams:f.elements.initialWeightGrams.value===''?null:Number(f.elements.initialWeightGrams.value),notes:f.elements.notes.value});
    f.reset();$('sourdough-create-details').open=false;await refresh();message('Masa madre añadida.');}catch(e){message(e.message,true);}
 });
 // Mensaje persistente fuera de la lista, para que sobreviva a sus actualizaciones.
 const status=node('p',undefined,'hint');status.id='sourdough-message';root.before(status);
 document.addEventListener('paniko:auth',event=>{if(!event.detail?.user){root.replaceChildren();$('sourdough-message').textContent='';}});
 window.PanikoSourdough={refresh};
})();
