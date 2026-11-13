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
  const details=node('details');details.append(node('summary','Registrar alimentación'));
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
      await refresh();message(`Alimentación registrada: ${format(result.afterGrams)} g resultantes; agua/harina añadidas: ${format(result.feedHydrationPercent)} %.`);
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
      for(const f of list){const entry=node('div');entry.append(node('strong',dateText(f.fedAt)),node('p',`${format(f.beforeGrams)} g antes − ${format(f.discardedGrams)} g descartados + ${format(f.flourGrams)} g harina + ${format(f.waterGrams)} g agua = ${format(f.afterGrams)} g. Hidratación de la alimentación: ${format(f.feedHydrationPercent)} %`));if(f.notes)entry.append(node('p',f.notes,'muted'));result.append(entry);}}
    catch(e){result.replaceChildren(node('p',e.message,'warning'));}
  });card.append(history);return card;
 }
 async function refresh(){root.replaceChildren(node('p','Cargando tus masas madre…','muted'));
  try{const list=await api('/api/sourdough/starters');root.replaceChildren();if(!list.length)root.append(node('p','Agrega tu primera masa madre para comenzar a llevar el registro.','muted'));for(const starter of list)root.append(starterCard(starter));}
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
