import { api, esc, icon } from './lib.js?v=bee0a3ccd446';

export function categoryLinks(categories, currentPath = '') {
  return `<a class="category-option" href="/inicio">${icon.home}<span>Início</span></a>${categories.map((category,index)=>{
    const href=`/categoria/${encodeURIComponent(category.id)}`;
    return `<a class="category-option category-tone-${index%4}" href="${esc(href)}" ${currentPath===href?'aria-current="page"':''}>${icon.grid}<span>${esc(category.name)}</span></a>`;
  }).join('')}`;
}

export function mountCategoryMenu(root) {
  const panel=root.querySelector('[data-category-panel]');
  const triggers=[...root.querySelectorAll('[data-category-toggle]')];
  if(!panel||!triggers.length)return;
  let opened=false,disposed=false,activeTrigger=null,loaded=false;
  const place=()=>{
    if(!opened||!activeTrigger)return;
    if(matchMedia('(min-width: 900px)').matches){
      const rect=activeTrigger.getBoundingClientRect();
      panel.style.top=`${rect.bottom+10}px`;panel.style.bottom='auto';
      panel.style.left=`${Math.max(12,Math.min(rect.left,window.innerWidth-308))}px`;panel.style.right='auto';
    }else{panel.style.top='auto';panel.style.bottom='calc(var(--tabbar-h) + var(--safe-b) + 10px)';panel.style.left='16px';panel.style.right='16px';}
  };
  const close=(restoreFocus=false)=>{
    opened=false;panel.hidden=true;triggers.forEach(button=>button.setAttribute('aria-expanded','false'));
    if(restoreFocus)activeTrigger?.focus();
  };
  const open=async trigger=>{
    activeTrigger=trigger;opened=true;panel.hidden=false;
    triggers.forEach(button=>button.setAttribute('aria-expanded',String(button===trigger)));place();
    if(!loaded){
      panel.innerHTML='<p class="category-menu-status" role="status">Carregando categorias…</p>';
      try{
        const {categories}=await api('/api/categories');
        if(disposed)return;
        panel.innerHTML=categoryLinks(categories,location.pathname);loaded=true;
      }catch(error){if(disposed)return;panel.innerHTML=`<p class="category-menu-status" role="status">${esc(error.message)}</p><button type="button" class="category-option" data-category-retry>Tentar novamente</button>`;}
    }
  };
  triggers.forEach(trigger=>{
    trigger.addEventListener('click',()=>opened&&activeTrigger===trigger?close():open(trigger));
    trigger.addEventListener('keydown',async event=>{
      if(event.key!=='ArrowDown')return;event.preventDefault();await open(trigger);
      if(!disposed&&opened)panel.querySelector('a,button')?.focus();
    });
  });
  panel.addEventListener('click',event=>{if(event.target.closest('a'))close();else if(event.target.closest('[data-category-retry]'))open(activeTrigger);});
  panel.addEventListener('keydown',event=>{
    const links=[...panel.querySelectorAll('a,button')],index=links.indexOf(document.activeElement);
    if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){
      event.preventDefault();const target=event.key==='Home'?0:event.key==='End'?links.length-1:(index+(event.key==='ArrowDown'?1:-1)+links.length)%links.length;links[target]?.focus();
    }
  });
  const outside=event=>{if(opened&&!panel.contains(event.target)&&!triggers.some(button=>button.contains(event.target)))close();};
  const keyboard=event=>{if(event.key==='Escape'&&opened){event.preventDefault();close(true);}};
  const focus=event=>{if(opened&&!panel.contains(event.target)&&!triggers.some(button=>button.contains(event.target)))close();};
  document.addEventListener('click',outside);document.addEventListener('keydown',keyboard);document.addEventListener('focusin',focus);window.addEventListener('resize',place);
  return ()=>{disposed=true;close();document.removeEventListener('click',outside);document.removeEventListener('keydown',keyboard);document.removeEventListener('focusin',focus);window.removeEventListener('resize',place);};
}
