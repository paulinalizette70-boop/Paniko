'use strict';
/* Paniko · interacciones visuales progresivas.
   Nunca consulta datos privados ni altera procesos de inventario. */
(()=>{
  const byId=id=>document.getElementById(id);
  const workspace=byId('workspace');
  const menuButton=byId('mobile-menu-toggle');
  const nav=document.querySelector('.nav-list');
  const searchButton=byId('workspace-search');
  const dialog=byId('paniko-command');
  const input=byId('paniko-command-input');
  const results=byId('paniko-command-results');
  const closeButton=byId('paniko-command-close');
  if(!workspace||!nav||!dialog||!input||!results)return;

  const destinations=[
    {view:'dashboard',title:'Inicio',subtitle:'Resumen y calendario',icon:'⌂',keywords:'resumen panel agenda hoy'},
    {view:'production',title:'Producción',subtitle:'Lotes, masas y subpreparaciones',icon:'✳',keywords:'hornear masa brioche lote concha'},
    {view:'ingredients',title:'Ingredientes',subtitle:'Inventario, entradas y salidas',icon:'▦',keywords:'almacen insumos compras existencia'},
    {view:'recipes',title:'Recetas',subtitle:'Fichas técnicas y escalado',icon:'▤',keywords:'formula cantidades porcentaje panadero'},
    {view:'sourdough',title:'Mi masa madre',subtitle:'Cultivos y alimentaciones',icon:'❧',keywords:'cultivo alimentar refresco'},
    {view:'products',title:'Productos y ventas',subtitle:'Piezas y movimientos de mostrador',icon:'◒',keywords:'vender venta precio producto'},
    {view:'history',title:'Historial',subtitle:'Revisa lotes y movimientos',icon:'◷',keywords:'movimiento registro anterior'},
    {view:'finance',title:'Finanzas',subtitle:'Costos, gastos y resultados',icon:'◇',keywords:'dinero presupuesto precio costos utilidad'}
  ];
  const findNav=view=>[...document.querySelectorAll('.nav-list .nav-link')].find(b=>b.dataset.viewTarget===view);
  const accessible=entry=>{
    const button=findNav(entry.view);
    return button&&!button.hidden&&!button.closest('[hidden]');
  };
  const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es').trim();
  let lastFocus=null;

  function setMenu(open){
    if(!menuButton)return;
    nav.classList.toggle('is-open',open);
    menuButton.setAttribute('aria-expanded',String(open));
    menuButton.textContent=open?'×':'☰';
    menuButton.setAttribute('aria-label',open?'Cerrar menú de navegación':'Abrir menú de navegación');
  }
  menuButton?.addEventListener('click',()=>setMenu(!nav.classList.contains('is-open')));
  nav.addEventListener('click',event=>{
    if(event.target.closest('.nav-link'))setMenu(false);
  });
  window.addEventListener('resize',()=>{
    if(window.innerWidth>980&&nav.classList.contains('is-open'))setMenu(false);
  });

  function createResult(entry){
    const button=document.createElement('button');
    button.type='button';button.className='command-result';
    button.dataset.view=entry.view;
    const glyph=document.createElement('span');
    glyph.className='command-result-icon';glyph.setAttribute('aria-hidden','true');glyph.textContent=entry.icon;
    const words=document.createElement('span');
    const strong=document.createElement('strong');strong.textContent=entry.title;
    const small=document.createElement('small');small.textContent=entry.subtitle;
    words.append(strong,small);
    const arrow=document.createElement('span');
    arrow.className='command-result-arrow';arrow.setAttribute('aria-hidden','true');arrow.textContent='↗';
    button.append(glyph,words,arrow);
    button.addEventListener('click',()=>{
      closeDialog();
      const target=findNav(entry.view);
      if(target&&!target.hidden)target.click();
    });
    return button;
  }
  function renderSearch(){
    const query=normalize(input.value);
    const choices=destinations.filter(accessible).filter(entry=>
      !query||normalize([entry.title,entry.subtitle,entry.keywords].join(' ')).includes(query));
    results.replaceChildren();
    if(choices.length){
      choices.forEach(entry=>results.append(createResult(entry)));
    }else{
      const empty=document.createElement('p');empty.className='command-empty';
      empty.textContent='No encontramos esa sección. Prueba con “recetas”, “inventario” o “producción”.';
      results.append(empty);
    }
  }
  function openDialog(){
    if(workspace.hidden)return;
    lastFocus=document.activeElement;
    input.value='';
    dialog.hidden=false;
    document.body.classList.add('command-open');
    renderSearch();
    input.focus();
  }
  function closeDialog(){
    dialog.hidden=true;
    document.body.classList.remove('command-open');
    if(lastFocus&&document.contains(lastFocus))lastFocus.focus();
  }
  searchButton?.addEventListener('click',openDialog);
  closeButton?.addEventListener('click',closeDialog);
  dialog.querySelector('[data-command-close]')?.addEventListener('click',closeDialog);
  input.addEventListener('input',renderSearch);
  input.addEventListener('keydown',event=>{
    const options=[...results.querySelectorAll('.command-result')];
    if(event.key==='ArrowDown'&&options.length){event.preventDefault();options[0].focus();}
    if(event.key==='Enter'&&options.length){event.preventDefault();options[0].click();}
  });
  results.addEventListener('keydown',event=>{
    const options=[...results.querySelectorAll('.command-result')];
    const current=options.indexOf(document.activeElement);
    if(event.key==='ArrowDown'&&current>=0){event.preventDefault();options[(current+1)%options.length].focus();}
    if(event.key==='ArrowUp'&&current>=0){event.preventDefault();if(current===0)input.focus();else options[current-1].focus();}
  });
  document.addEventListener('keydown',event=>{
    if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'){
      event.preventDefault();
      if(dialog.hidden)openDialog();else closeDialog();
    }
    if(event.key==='Escape'){
      if(!dialog.hidden){event.preventDefault();closeDialog();}
      else if(nav.classList.contains('is-open'))setMenu(false);
    }
  });
  // Mantener el foco dentro del cuadro cuando se utiliza solo el teclado.
  dialog.addEventListener('keydown',event=>{
    if(event.key!=='Tab')return;
    const focusable=[input,...results.querySelectorAll('.command-result'),closeButton].filter(Boolean);
    const first=focusable[0],last=focusable[focusable.length-1];
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
  });
  function updateGreeting(){
    const h=new Date().getHours();
    const greeting=h<12?'Buenos días':h<19?'Buenas tardes':'Buenas noches';
    const greetingNode=byId('hero-greeting');
    if(greetingNode)greetingNode.textContent=greeting;
    const date=new Intl.DateTimeFormat('es-MX',{weekday:'long',day:'numeric',month:'long'}).format(new Date());
    const dateNode=byId('hero-day');
    if(dateNode)dateNode.textContent=date.charAt(0).toUpperCase()+date.slice(1);
    const today=byId('paniko-today');
    if(today)today.textContent=date.charAt(0).toUpperCase()+date.slice(1);
  }
  updateGreeting();
  // Evitar conteos falsos: los indicadores siguen viniendo de la app real.
  const highlight=byId('paniko-dashboard-status');
  const stats=['dashboard-ingredients','dashboard-recipes','dashboard-batches'].map(byId).filter(Boolean);
  function summarize(){
    if(!highlight)return;
    const counts=stats.map(s=>Number(s.textContent));
    if(counts.some(n=>!Number.isFinite(n)))return;
    const [ingredients,recipes,batches]=counts;
    if(ingredients===0)highlight.textContent='Empieza registrando tus ingredientes.';
    else if(recipes===0)highlight.textContent='Ya tienes ingredientes; sigue con una ficha técnica.';
    else if(batches===0)highlight.textContent='Todo listo para planear tu primera tanda.';
    else highlight.textContent='Tu información está al día. ¡Buen trabajo!';
  }
  if(typeof MutationObserver!=='undefined'&&highlight){
    const observer=new MutationObserver(summarize);
    stats.forEach(node=>observer.observe(node,{childList:true,subtree:true,characterData:true}));
    summarize();
  }
})();
