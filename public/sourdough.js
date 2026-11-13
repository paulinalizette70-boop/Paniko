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
 const care=window.PanikoStarterStatus;
 if(!care){root.replaceChildren(node('p','No se cargó el cálculo de recordatorios. Recarga Paniko (Ctrl+F5).','warning'));return;}
 const displayWeight=g=>g===null||g===undefined?'Por registrar':format(g)+' g';
 let starterCache=[],authenticated=false,pendingFeed=null,refreshing=null;

 const format=n=>new Intl.NumberFormat('es-MX',{maximumFractionDigits:2}).format(n);
 let inventoryIngredients=[];
 function ingredientSelect(name,units,chosen){
   const items=inventoryIngredients.filter(x=>units.includes(x.unit));
   const choices=[['','Elige un ingrediente'],...items.map(x=>[x.id,`${x.name} · ${format(x.stock)} ${x.unit}`])];
   return select(name,choices,chosen||'');
 } 
 function nextText(starter){
   const status=care.evaluate(starter);
   return status.nextAt===null?'Aún sin próxima revisión':dateText(status.nextAt);
 }
 function openPanel(panel){
   if(!panel)return;
   panel.open=true;
   panel.scrollIntoView?.({behavior:'smooth',block:'nearest'});
   const first=panel.querySelector('input:not([disabled]),select:not([disabled])');
   first?.focus?.({preventScroll:true});
 }
 function metric(label,value){
   const m=node('div',undefined,'starter-metric');
   m.append(node('small',label),node('strong',value));
   return m;
 }
 function renderLiveCard(card,starter){
   const state=care.evaluate(starter);
   const badge=card.querySelector('.starter-care-badge');
   if(badge){badge.textContent=state.label;badge.className='starter-care-badge care-'+state.code;}
   const reminder=card.querySelector('.starter-reminder-text');
   if(reminder)reminder.textContent=state.note+' '+care.formatRemaining(state.remainingHours)+'.';
   const time=card.querySelector('.starter-care-next');
   if(time)time.textContent=nextText(starter);
   const progress=card.querySelector('.starter-care-progress > span');
   if(progress){progress.style.width=state.progress+'%';progress.parentElement?.setAttribute('aria-valuenow',String(Math.round(state.progress)));}
   const hours=card.querySelector('.starter-care-elapsed');
   if(hours)hours.textContent=state.elapsedHours===null?'Sin registro de alimentación':`${format(Math.floor(state.elapsedHours*10)/10)} h de ${starter.feedEveryHours} h desde la última alimentación`;
 }
 function starterCard(starter){
  const state=care.evaluate(starter);
  const card=node('article',undefined,'starter-card starter-care-card');card.dataset.starterId=starter.id;
  const header=node('header',undefined,'starter-care-header');
  const headText=node('div');headText.append(node('span','TU CULTIVO','eyebrow'),node('h2',starter.name));
  const badge=node('span',state.label,'starter-care-badge care-'+state.code);
  header.append(headText,badge);card.append(header);
  const hero=node('div',undefined,'starter-care-hero');
  const drawing=node('div',undefined,'starter-care-jar-wrap');drawing.setAttribute('aria-hidden','true');
  const lid=node('span',undefined,'starter-care-lid');
  const jar=node('div',undefined,'starter-care-jar');
  const filling=node('span',undefined,'starter-care-fill');
  const amount=Number(starter.currentWeightGrams);
  filling.style.height=starter.currentWeightGrams===null?'12%':`${Math.max(9,Math.min(81,amount/1000*100))}%`;
  for(const bubbleClass of ['bubble-one','bubble-two','bubble-three'])filling.append(node('span',undefined,'starter-care-bubble '+bubbleClass));
  jar.append(filling);drawing.append(lid,jar,node('small','Frasco ilustrativo','starter-jar-caption'));
  const info=node('div',undefined,'starter-care-info');
  info.append(node('small','DISPONIBLE EN INVENTARIO','eyebrow'),node('strong',displayWeight(starter.currentWeightGrams),'starter-weight-big'));
  info.append(node('p',starter.inventoryLinked?'Sincronizado con el inventario de Paniko.':'Vincula el cultivo para sincronizar existencias.','muted'));
  const meta=node('div',undefined,'starter-care-meta');
  meta.append(metric('Ubicación',starter.location==='refrigerador'?'❄ Refrigerador':'☀ Ambiente'));
  meta.append(metric('Última alimentación',dateText(starter.lastFedAt)));
  meta.append(metric('Próxima revisión',nextText(starter)));
  meta.querySelector('.starter-metric:last-child strong').classList.add('starter-care-next');
  info.append(meta);hero.append(drawing,info);card.append(hero);
  const reminderBox=node('section',undefined,'starter-reminder care-'+state.code);
  reminderBox.append(node('strong','✦ Cuidados y recordatorios'),node('p',state.note+' '+care.formatRemaining(state.remainingHours)+'.','starter-reminder-text'));
  const elapsed=node('span',undefined,'starter-care-elapsed');reminderBox.append(elapsed);
  const progress=node('div',undefined,'starter-care-progress');progress.setAttribute('role','progressbar');
  progress.setAttribute('aria-label','Porcentaje del intervalo de revisión transcurrido');
  progress.setAttribute('aria-valuemin','0');progress.setAttribute('aria-valuemax','100');
  progress.setAttribute('aria-valuenow',String(Math.round(state.progress)));
  progress.append(node('span'));reminderBox.append(progress);
  reminderBox.append(node('small','Este indicador sigue tu horario, no mide la fermentación ni confirma que esté lista para hornear.','hint'));
  card.append(reminderBox);
  const actions=node('div',undefined,'starter-quick-actions');
  const feedQuick=node('button',!starter.active?'Reanudar seguimiento':(starter.inventoryLinked?'＋ Alimentar':'Conectar inventario'),'btn-primary');feedQuick.type='button';
  const countQuick=node('button','⚖ Corregir peso','btn-soft');countQuick.type='button';countQuick.disabled=!starter.inventoryLinked;
  const locationQuick=node('button',starter.location==='refrigerador'?'☀ Sacar del refri':'❄ Mandar al refri','btn-soft');locationQuick.type='button';
  actions.append(feedQuick,countQuick,locationQuick);card.append(actions);
  if(starter.notes)card.append(node('p',starter.notes,'starter-notes muted'));
  renderLiveCard(card,starter);
  const linked=node('p',starter.inventoryLinked?'✓ Inventario conectado. Las alimentaciones descuentan harina y agua y actualizan el cultivo.':'Primero conecta masa madre, harina y agua en Inventario para alimentar.',starter.inventoryLinked?'starter-connection good':'starter-connection warning');
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
  const connection=node('details',undefined,'starter-tech-details');connection.append(node('summary',starter.inventoryLinked?'Vinculación con inventario':'Conectar con inventario'));
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
  if(starter.inventoryLinked){
  const reconcile=node('details',undefined,'starter-tech-details');reconcile.append(node('summary','Corregir existencias de masa madre (conteo físico)'));
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
  const details=node('details',undefined,'starter-feed-details');details.dataset.feedPanel='true';details.append(node('summary','Registrar alimentación (actualiza inventario)'));
  const form=node('form',undefined,'form-stack');
  const before=input('number','beforeGrams',starter.currentWeightGrams,{min:'0',max:'1000000',step:'0.01',required:''});before.readOnly=true;
  const discard=input('number','discardedGrams','0',{min:'0',max:'1000000',step:'0.01',required:''});
  const flour=input('number','flourGrams','',{min:'0.01',max:'1000000',step:'0.01',required:''});
  const water=input('number','waterGrams','',{min:'0.01',max:'1000000',step:'0.01',required:''});
  const notes=input('text','notes','',{maxlength:'500',placeholder:'Aroma, burbujas, temperatura…'});
  const save=node('button','Guardar alimentación','btn-primary');save.type='submit';
  const feedIntro=node('p','Solo registra una alimentación real. Harina y agua se descontarán de Inventario al guardar; si falta alguno, Paniko cancelará toda la operación.','hint');
  const feedPreview=node('div',undefined,'starter-feed-preview');feedPreview.setAttribute('aria-live','polite');
  function updatePreview(){
    const current=Number(before.value),d=Number(discard.value),f=Number(flour.value),w=Number(water.value);
    if([current,d,f,w].some(x=>!Number.isFinite(x)||x<0)||d>current||!flour.value||!water.value||f<=0||w<=0){
      feedPreview.textContent='Completa harina y agua para ver el peso final; el descarte no puede superar el peso disponible.';
      return;
    }
    feedPreview.textContent=`Resultado previsto: ${format(Math.round((current-d+f+w)*100)/100)} g · Saldrán ${format(f)} g de harina y ${format(w)} g de agua del inventario.`;
  }
  for(const f of [discard,flour,water])f.addEventListener('input',updatePreview);
  append(form,feedIntro,field('Masa madre actual según Inventario (g)',before),field('Cantidad descartada (g)',discard),field('Harina agregada (g)',flour),field('Agua agregada (g)',water),field('Observaciones',notes),feedPreview,save);
  updatePreview();
  form.addEventListener('submit',async e=>{e.preventDefault();save.disabled=true;
    try{
      const base=Number(before.value),d=Number(discard.value),f=Number(flour.value),w=Number(water.value);
      if(!Number.isFinite(base)||!Number.isFinite(d)||!Number.isFinite(f)||!Number.isFinite(w)||d<0||f<=0||w<=0||d>base)
        throw Error('Revisa el descarte, la harina y el agua antes de continuar.');
      const after=Math.round((base-d+f+w)*100)/100;
      if(!confirm(`¿Confirmas alimentar ${starter.name}?\nHarina: -${format(f)} g\nAgua: -${format(w)} g\nDescarte: -${format(d)} g\nMasa madre final: ${format(after)} g\nSe actualizará Inventario.`)){
        save.disabled=false;return;
      }
      const result=await api(`/api/sourdough/starters/${starter.id}/feed`,'POST',{beforeGrams:base,discardedGrams:d,flourGrams:f,waterGrams:w,notes:notes.value});
      await refresh();message(`Inventario actualizado: ${format(result.afterGrams)} g de masa madre; se descontaron ${format(result.flourGrams)} g de harina y ${format(result.waterGrams)} g de agua.`);
      window.PanikoRefreshInventory?.();
    }catch(e){message(e.message,true);save.disabled=false;}
  });details.append(form);card.append(details);
  feedQuick.addEventListener('click',()=>openPanel(starter.active?details:settings));
  countQuick.addEventListener('click',()=>openPanel(reconcile));
  }else {feedQuick.addEventListener('click',()=>openPanel(starter.active?connection:settings));}
  const settings=node('details',undefined,'starter-tech-details');settings.append(node('summary','Cambiar ubicación o frecuencia'));
  const sf=node('form',undefined,'form-stack');const loc=select('location',[['ambiente','Temperatura ambiente'],['refrigerador','Refrigerador']],starter.location);
  const hours=input('number','feedEveryHours',starter.feedEveryHours,{min:'1',max:'336',step:'1',required:''});const settingNotes=input('text','notes',starter.notes,{maxlength:'500'});
  const act=node('input');act.type='checkbox';act.checked=starter.active;const submit=node('button','Guardar configuración','btn-soft');submit.type='submit';
  append(sf,field('Ubicación',loc),field('Revisar cada cuántas horas',hours),field('Notas',settingNotes),field('En seguimiento',act),submit);
  sf.addEventListener('submit',async e=>{e.preventDefault();try{await api(`/api/sourdough/starters/${starter.id}/update`,'POST',{location:loc.value,feedEveryHours:Number(hours.value),notes:settingNotes.value,active:act.checked});await refresh();message('Configuración actualizada.');}catch(e){message(e.message,true);}});
  settings.append(sf);card.append(settings);
  locationQuick.addEventListener('click',()=>{loc.value=starter.location==='refrigerador'?'ambiente':'refrigerador';openPanel(settings);message('Revisa la frecuencia de cuidados y guarda para confirmar el cambio de ubicación.');});
  const history=node('section',undefined,'starter-history');
  history.append(node('h3','Historial de alimentaciones'));
  const recent=node('div','Cargando alimentaciones…','starter-history-list');history.append(recent);
  const full=node('details',undefined,'starter-history-more');full.append(node('summary','Ver hasta 50 alimentaciones'));
  const extended=node('div',undefined,'starter-history-list');full.append(extended);history.append(full);
  card.append(history);
  void loadHistory(starter,recent,extended);
  return card;
 }
 function historyEntry(f){
   const entry=node('div',undefined,'starter-time-item');
   const dot=node('span','✿','starter-time-dot');dot.setAttribute('aria-hidden','true');
   const content=node('div');content.append(node('strong',dateText(f.fedAt)),
     node('p',`${format(f.flourGrams)} g de harina + ${format(f.waterGrams)} g de agua · descarte ${format(f.discardedGrams)} g · terminó en ${format(f.afterGrams)} g`));
   if(f.notes)content.append(node('p',f.notes,'muted'));
   content.append(node('small',f.inventoryUpdated?'Inventario actualizado':'Registro antiguo sin movimientos de inventario','hint'));
   entry.append(dot,content);return entry;
 }
 async function loadHistory(starter,recent,extended){
   try{
     const items=await api(`/api/sourdough/starters/${starter.id}/feedings`);
     if(!recent.isConnected)return;
     recent.replaceChildren();extended.replaceChildren();
     if(!items.length){recent.append(node('p','Aún no has registrado alimentaciones.','muted'));return;}
     for(const f of items.slice(0,3))recent.append(historyEntry(f));
     for(const f of items)extended.append(historyEntry(f));
   }catch(e){if(recent.isConnected)recent.replaceChildren(node('p','No se pudo consultar el historial: '+e.message,'warning'));}
 }
 function renderHome(list){
   const rootHome=$('sourdough-home-items'),summary=$('sourdough-home-summary');
   if(!rootHome||!summary)return;
   rootHome.replaceChildren();
   if(!list.length){summary.textContent='Todavía no tienes cultivos registrados.';return;}
   const active=list.filter(s=>s.active);
   const attention=active.filter(s=>care.evaluate(s).requiresAttention);
   summary.textContent=attention.length?`${attention.length} de ${active.length} cultivo(s) necesitan atención o configuración.`:
     `${active.length} cultivo(s) en seguimiento. Revisa su estado aquí.`;
   const sorted=[...list].sort((a,b)=>Number(care.evaluate(b).requiresAttention)-Number(care.evaluate(a).requiresAttention));
   for(const starter of sorted.slice(0,4)){
     const st=care.evaluate(starter);const line=node('div',undefined,'starter-home-item');
     const content=node('div');content.append(node('strong',starter.name),node('small',`${st.label} · ${displayWeight(starter.currentWeightGrams)}`));
     const action=node('button',!starter.active?'Ver cultivo':(starter.inventoryLinked?'Ver / alimentar':'Vincular'),'btn-soft');action.type='button';
     action.addEventListener('click',()=>openFeed(starter.id));
     line.append(content,action);rootHome.append(line);
   }
   if(list.length>4)rootHome.append(node('small',`Y ${list.length-4} cultivo(s) más en Mi masa madre.`,'hint'));
 }
 async function refreshDashboard(){
   if(!authenticated)return;
   try{const list=await api('/api/sourdough/starters');starterCache=list;renderHome(list);}
   catch(e){const summary=$('sourdough-home-summary');if(summary)summary.textContent='No se pudieron actualizar los cuidados: '+e.message;}
 }
 function updateLive(){
   if(!authenticated)return;
   renderHome(starterCache);
   for(const starter of starterCache){
     const card=[...root.children].find(el=>el.dataset.starterId===starter.id);
     if(card)renderLiveCard(card,starter);
   }
 }
 function openFeed(id){
   pendingFeed=id;
   window.PanikoNavigate?.('sourdough',{focus:true});
   void refresh();
 }
 async function refresh(){
  if(refreshing)return refreshing;
  const run=async()=>{
    root.replaceChildren(node('p','Cargando tus masas madre…','muted'));
    try{
      const [list,ings]=await Promise.all([api('/api/sourdough/starters'),api('/api/ingredients')]);
      starterCache=list;inventoryIngredients=ings;root.replaceChildren();renderHome(list);
      if(!list.length)root.append(node('p','Agrega tu primera masa madre para comenzar a cuidarla.','muted'));
      for(const starter of list)root.append(starterCard(starter));
      if(pendingFeed){
        const match=[...root.children].find(el=>el.dataset.starterId===pendingFeed);
        if(match)openPanel(match.querySelector('[data-feed-panel]')||match.querySelector('.starter-tech-details'));
        pendingFeed=null;
      }
    }catch(e){root.replaceChildren(node('p',e.message,'warning'));}
  };
  refreshing=run().finally(()=>{refreshing=null;});
  return refreshing;
 }
 $('starter-create-form').addEventListener('submit',async e=>{e.preventDefault();const f=e.currentTarget;
  try{await api('/api/sourdough/starters','POST',{name:f.elements.name.value,location:f.elements.location.value,feedEveryHours:Number(f.elements.feedEveryHours.value),initialWeightGrams:f.elements.initialWeightGrams.value===''?null:Number(f.elements.initialWeightGrams.value),notes:f.elements.notes.value});
    f.reset();$('sourdough-create-details').open=false;await refresh();message('Masa madre añadida.');}catch(e){message(e.message,true);}
 });
 // Mensaje persistente fuera de la lista, para que sobreviva a sus actualizaciones.
 const status=node('p',undefined,'hint');status.id='sourdough-message';root.before(status);
 document.addEventListener('paniko:auth',event=>{
   authenticated=Boolean(event.detail?.user);
   if(!authenticated){starterCache=[];inventoryIngredients=[];root.replaceChildren();$('sourdough-message').textContent='';renderHome([]);return;}
   void refreshDashboard();
 });
 // Mientras la página permanezca abierta, recalcular avisos sin borrar formularios.
 window.setInterval(updateLive,60*1000);
 window.addEventListener('focus',()=>{if(authenticated)void refreshDashboard();});
 window.PanikoSourdough={refresh,refreshDashboard,openFeed};
})();
