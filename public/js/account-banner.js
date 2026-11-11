import { esc, icon } from './lib.js?v=d433188fd528';

export function accountBanner(isAdmin = false) {
  const slides = [
    { theme:'request', symbol:icon.request, title:'Não achou seu dorama? Peça aqui', description:'Conte qual história você quer ver no KingDrama e acompanhe em Meus pedidos.', action:'Pedir dorama', href:'/pedidos' },
    { theme:'support', symbol:icon.mail, title:'Dúvidas? Fale com o suporte', description:'Estamos no WhatsApp: (51) 92004-8910.', action:'Conversar no WhatsApp', href:'https://wa.me/5551920048910?text='+encodeURIComponent('Olá! Preciso de ajuda com o KingDrama.'), external:true },
    { theme:'referral', symbol:icon.gift, title:'Indique e ganhe dias grátis', description:'A cada amigo que pagar pelo seu link, você ganha 10 dias.', action:'Ver minhas indicações', href:'/indicacoes' },
  ];
  return `<section class="wrap account-promos" data-account-promos aria-label="Pedidos, suporte e indicações" aria-roledescription="carrossel">
    <div class="promo-heading"><span>Mais para você</span>${isAdmin?'':`<a class="promo-request-shortcut" href="/pedidos">${icon.request} Pedir dorama ${icon.next}</a>`}</div>
    <div class="promo-slides">${slides.map((slide,index)=>`<a class="promo-slide promo-${slide.theme}" href="${esc(slide.href)}" ${slide.external?'target="_blank" rel="noopener noreferrer"':''} data-promo-slide aria-label="${esc(slide.title)}${slide.external?' — abre o WhatsApp em outra aba':''}" ${index?'hidden':''}>
      <span class="promo-symbol" aria-hidden="true">${slide.symbol}</span><div class="promo-copy"><span class="promo-eyebrow">${index+1} / ${slides.length} · KINGDRAMA</span><h2>${esc(slide.title)}</h2><p>${esc(slide.description)}</p><span class="promo-action">${esc(slide.action)} ${icon.next}</span></div><span class="promo-end" aria-hidden="true">${slide.symbol}</span>
    </a>`).join('')}</div>
    <div class="promo-controls"><div class="promo-dots" aria-label="Escolher mensagem">${slides.map((slide,index)=>`<button type="button" data-promo-dot="${index}" aria-label="Mostrar mensagem: ${esc(slide.title)}" aria-current="${index===0}"><span></span></button>`).join('')}</div><div class="promo-buttons"><button type="button" class="icon-btn" data-promo-prev aria-label="Mensagem anterior">${icon.back}</button><button type="button" class="promo-pause" data-promo-pause aria-label="Pausar troca automática" aria-pressed="false">Pausar</button><button type="button" class="icon-btn" data-promo-next aria-label="Próxima mensagem">${icon.next}</button></div></div>
  </section>`;
}

export function mountAccountBanner(root) {
  const banner=root.querySelector('[data-account-promos]');
  if(!banner)return;
  const slides=[...banner.querySelectorAll('[data-promo-slide]')],dots=[...banner.querySelectorAll('[data-promo-dot]')];
  const pause=banner.querySelector('[data-promo-pause]');
  const motion=matchMedia('(prefers-reduced-motion: reduce)');
  let current=0,timer,paused=motion.matches,hovered=false,focused=false,disposed=false,startX=null,swiped=false;
  const stop=()=>clearInterval(timer);
  const show=index=>{current=(index+slides.length)%slides.length;slides.forEach((slide,i)=>{slide.hidden=i!==current;});dots.forEach((dot,i)=>dot.setAttribute('aria-current',String(i===current)));};
  const restart=()=>{stop();if(!disposed&&!paused&&!hovered&&!focused&&!document.hidden)timer=setInterval(()=>show(current+1),7000);};
  const updatePause=()=>{pause.textContent=paused?'Retomar':'Pausar';pause.setAttribute('aria-label',paused?'Retomar troca automática':'Pausar troca automática');pause.setAttribute('aria-pressed',String(paused));};
  dots.forEach(dot=>dot.addEventListener('click',()=>{show(Number(dot.dataset.promoDot));restart();}));
  banner.querySelector('[data-promo-prev]').addEventListener('click',()=>{show(current-1);restart();});
  banner.querySelector('[data-promo-next]').addEventListener('click',()=>{show(current+1);restart();});
  pause.addEventListener('click',()=>{paused=!paused;updatePause();restart();});
  banner.addEventListener('pointerenter',event=>{if(event.pointerType==='mouse'){hovered=true;stop();}});
  banner.addEventListener('pointerleave',event=>{if(event.pointerType==='mouse'){hovered=false;restart();}});
  banner.addEventListener('focusin',()=>{focused=true;stop();});
  banner.addEventListener('focusout',event=>{if(!banner.contains(event.relatedTarget)){focused=false;restart();}});
  const surface=banner.querySelector('.promo-slides');
  surface.addEventListener('pointerdown',event=>{swiped=false;startX=event.pointerType==='touch'?event.clientX:null;});
  surface.addEventListener('pointerup',event=>{if(startX===null)return;const dx=event.clientX-startX;startX=null;if(Math.abs(dx)>50){swiped=true;show(current+(dx<0?1:-1));restart();}});
  surface.addEventListener('pointercancel',()=>{startX=null;});
  surface.addEventListener('click',event=>{if(swiped){event.preventDefault();event.stopPropagation();swiped=false;}},true);
  const visibility=()=>restart(),onMotion=()=>{paused=motion.matches;updatePause();restart();};
  document.addEventListener('visibilitychange',visibility);motion.addEventListener('change',onMotion);
  updatePause();restart();
  return ()=>{disposed=true;stop();document.removeEventListener('visibilitychange',visibility);motion.removeEventListener('change',onMotion);};
}
