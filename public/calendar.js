'use strict';
// Calendario visual: agenda manual + producciones realmente confirmadas.
(()=>{
 const $=id=>document.getElementById(id);
 const grid=$('calendar-grid');if(!grid)return;
 const node=(tag,value,cls)=>{const n=document.createElement(tag);if(value!==undefined)n.textContent=String(value);if(cls)n.className=cls;return n;};
 const isoDate=(year,month,day)=>`${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
 const today=new Date();let year=today.getFullYear(),month=today.getMonth()+1,selected=isoDate(year,month,today.getDate());
 let data={entries:[],productions:[]},loggedIn=false;
 const formatQuantity=(n,u)=>`${Number(n).toLocaleString('es-MX')} ${u==='pieza'?'piezas':u==='ml'?'ml':'g'}`;
 const msg=(str,failed=false)=>{const p=$('calendar-status');p.textContent=str;p.className=failed?'warning':'hint';};
 async function api(url,body){const res=await fetch(url,body===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const j=await res.json();if(!res.ok)throw Error(j.error||'No se pudo completar la acción');return j;}
 function dayDetails(){
  const date=new Date(selected+'T12:00:00');$('calendar-day-title').textContent=date.toLocaleDateString('es-MX',{weekday:'long',day:'numeric',month:'long'});
  const root=$('calendar-day-items');root.replaceChildren();
  const entries=data.entries.filter(x=>x.eventDate===selected);
  const actual=data.productions.filter(x=>x.eventDate===selected);
  for(const e of entries){
   const card=node('div',undefined,'calendar-agenda-item '+(e.status==='hecho'?'is-done':''));
   const heading=node('div');heading.append(node('strong',(e.kind==='produccion'?'🍞 ':'☑ ')+e.title),node('small',e.kind==='produccion'?'Producción planeada':'Pendiente'));
   if(e.plannedQuantity)heading.append(node('small','Cantidad planeada: '+formatQuantity(e.plannedQuantity,e.yieldUnit)));
   if(e.notes)heading.append(node('small',e.notes));card.append(heading);
   const actions=node('div',undefined,'calendar-actions');const done=node('button',e.status==='hecho'?'Reabrir':'Marcar hecho','btn-soft');done.type='button';
   done.addEventListener('click',async()=>{done.disabled=true;try{await api(`/api/calendar/events/${e.id}/status`,{status:e.status==='hecho'?'pendiente':'hecho'});await load();}catch(error){msg(error.message,true);done.disabled=false;}});
   const del=node('button','Eliminar','text-button');del.type='button';del.addEventListener('click',async()=>{
    if(!confirm('¿Eliminar este pendiente del calendario? No afectará los lotes producidos.'))return;
    try{await api(`/api/calendar/events/${e.id}/delete`,{});await load();}catch(error){msg(error.message,true);}
   });actions.append(done,del);card.append(actions);root.append(card);
  }
  for(const b of actual){const card=node('div',undefined,'calendar-agenda-item actual');card.append(node('strong','✓ '+b.recipeName),node('small','Producido y confirmado: '+formatQuantity(b.quantity,b.yieldUnit)));root.append(card);}
  if(!entries.length&&!actual.length)root.append(node('p','Todavía no hay pendientes ni producciones registradas este día.','muted'));
  $('calendar-form').elements.eventDate.value=selected;
 }
 function render(){
  $('calendar-month-label').textContent=new Date(year,month-1,1).toLocaleDateString('es-MX',{month:'long',year:'numeric'});
  grid.replaceChildren();for(const name of ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'])grid.append(node('div',name,'calendar-weekday'));
  const offset=(new Date(year,month-1,1).getDay()+6)%7;
  const days=new Date(year,month,0).getDate();
  const byDate=new Map();for(const e of data.entries){const arr=byDate.get(e.eventDate)||[];arr.push(e.kind);byDate.set(e.eventDate,arr);}
  const produced=new Map();for(const b of data.productions)produced.set(b.eventDate,(produced.get(b.eventDate)||0)+1);
  for(let i=0;i<offset+days;i++){
   if(i<offset){grid.append(node('div',undefined,'calendar-empty'));continue;}
   const day=i-offset+1,key=isoDate(year,month,day),events=byDate.get(key)||[],count=produced.get(key)||0;
   const button=node('button',undefined,'calendar-day');button.type='button';button.setAttribute('aria-pressed',String(key===selected));
   if(key===selected)button.classList.add('selected');
   if(key===isoDate(today.getFullYear(),today.getMonth()+1,today.getDate()))button.classList.add('today');
   button.append(node('strong',day));const dots=node('span',undefined,'calendar-day-dots');
   if(events.includes('pendiente'))dots.append(node('i',undefined,'cal-dot pending'));
   if(events.includes('produccion'))dots.append(node('i',undefined,'cal-dot planned'));
   if(count)dots.append(node('i',undefined,'cal-dot actual'));
   button.append(dots);
   button.setAttribute('aria-label',`${day} de ${$('calendar-month-label').textContent}, ${events.length} pendientes y ${count} lotes producidos`);
   button.addEventListener('click',()=>{selected=key;render();});grid.append(button);
  }
  dayDetails();
 }
 async function load(){
   if(!loggedIn)return;
   msg('Cargando calendario…');
   try{data=await api(`/api/calendar?month=${year}-${String(month).padStart(2,'0')}`);render();msg('Selecciona un día para ver sus tareas y producciones.');}
   catch(error){grid.replaceChildren(node('p',error.message,'warning'));msg('No se pudo cargar el calendario. Revisa que la migración 0.8.1 esté aplicada.',true);}
 }
 function move(offset){const date=new Date(year,month-1+offset,1);year=date.getFullYear();month=date.getMonth()+1;selected=isoDate(year,month,1);void load();}
 $('calendar-prev').addEventListener('click',()=>move(-1));$('calendar-next').addEventListener('click',()=>move(1));
 $('calendar-today').addEventListener('click',()=>{const d=new Date();year=d.getFullYear();month=d.getMonth()+1;selected=isoDate(year,month,d.getDate());void load();});
 const form=$('calendar-form');
 function syncKind(){const planned=form.elements.kind.value==='produccion';form.elements.recipeId.disabled=!planned;form.elements.plannedQuantity.disabled=!planned;if(!planned){form.elements.recipeId.value='';form.elements.plannedQuantity.value='';}}
 form.elements.kind.addEventListener('change',syncKind);
 form.addEventListener('submit',async e=>{
  e.preventDefault();if(!form.reportValidity())return;
  const button=form.querySelector('button[type=submit]');button.disabled=true;
  try{await api('/api/calendar/events',{eventDate:form.elements.eventDate.value,kind:form.elements.kind.value,title:form.elements.title.value,notes:form.elements.notes.value,
    recipeId:form.elements.kind.value==='produccion'?form.elements.recipeId.value||null:null,
    plannedQuantity:form.elements.kind.value==='produccion'&&form.elements.plannedQuantity.value!==''?Number(form.elements.plannedQuantity.value):null});
    selected=form.elements.eventDate.value;year=Number(selected.slice(0,4));month=Number(selected.slice(5,7));form.reset();syncKind();$('calendar-new-details').open=false;await load();msg('Pendiente guardado en el calendario.');}
  catch(error){msg(error.message,true);}finally{button.disabled=false;}
 });
 async function loadRecipes(){
  try{const recs=await api('/api/recipes'),select=form.elements.recipeId;select.replaceChildren();const none=node('option','Sin receta vinculada');none.value='';select.append(none);
   for(const r of recs){const option=node('option',r.name+' ('+formatQuantity(r.baseYield,r.yieldUnit)+')');option.value=r.id;select.append(option);}}
  catch(error){msg('No se pudieron cargar recetas del calendario: '+error.message,true);}
 }
 document.addEventListener('paniko:auth',event=>{
  loggedIn=Boolean(event.detail?.user);
  if(loggedIn){void loadRecipes();void load();}
  else{data={entries:[],productions:[]};grid.replaceChildren();$('calendar-day-items').replaceChildren();msg('');}
 });
 document.addEventListener('paniko:production-saved',()=>{if(loggedIn)void load();});
 syncKind();
 window.PanikoCalendar={refresh:load};
})();
