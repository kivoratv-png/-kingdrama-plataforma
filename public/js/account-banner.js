import { esc, icon } from './lib.js?v=48397e6a9d1c';

export function accountBanner() {
  const slides = [
    { theme:'request', symbol:icon.request, title:'Não achou seu dorama? Peça aqui', description:'Conte qual história você quer ver no KingDrama e acompanhe em Meus pedidos.', action:'Pedir dorama', href:'/pedidos' },
    { theme:'support', symbol:icon.whatsapp, title:'Entre no canal KINGDRAMA', description:'Receba os lançamentos em primeira mão — siga e ative o sininho.', action:'Seguir o canal no WhatsApp', href:'https://whatsapp.com/channel/0029Vb9NN6o8fewpZKqFQ80u', external:true },
    { theme:'referral', symbol:icon.gift, title:'Indique e ganhe dias grátis', description:'A cada amigo que pagar pelo seu link, você ganha 10 dias.', action:'Ver minhas indicações', href:'/indicacoes' },
  ];
  return `<section class="wrap account-promos" data-account-promos aria-label="Pedidos, canal e indicações" aria-roledescription="carrossel">
    <div class="promo-heading"><span>Mais para você</span></div>
    <div class="promo-slides">${slides.map((slide,index)=>`<a class="promo-slide promo-${slide.theme}" href="${esc(slide.href)}" ${slide.external?'target="_blank" rel="noopener noreferrer"':''} data-promo-slide aria-label="${esc(slide.title)}${slide.external?' — abre o WhatsApp em outra aba':''}" ${index?'hidden':''}>
      <span class="promo-symbol" aria-hidden="true">${slide.symbol}</span><div class="promo-copy"><span class="promo-eyebrow">${index+1} / ${slides.length} · KINGDRAMA</span><h2>${esc(slide.title)}</h2><p>${esc(slide.description)}</p><span class="promo-action">${esc(slide.action)} ${icon.next}</span></div><span class="promo-end" aria-hidden="true">${slide.symbol}</span>
    </a>`).join('')}</div>
  </section>`;
}

export function mountAccountBanner(root) {
  const banner=root.querySelector('[data-account-promos]');
  if(!banner)return;
  const slides=[...banner.querySelectorAll('[data-promo-slide]')];
  if(slides.length<2)return;
  let current=0,timer,focused=false,disposed=false;
  const stop=()=>clearInterval(timer);
  const restart=()=>{
    stop();
    if(!disposed&&!focused&&!document.hidden)timer=setInterval(()=>{
      current=(current+1)%slides.length;
      slides.forEach((slide,index)=>{slide.hidden=index!==current;});
    },5000);
  };
  // Keep a keyboard-focused link stable until focus leaves the banner.
  banner.addEventListener('focusin',()=>{focused=true;stop();});
  banner.addEventListener('focusout',event=>{if(!banner.contains(event.relatedTarget)){focused=false;restart();}});
  document.addEventListener('visibilitychange',restart);
  restart();
  return ()=>{disposed=true;stop();document.removeEventListener('visibilitychange',restart);};
}
