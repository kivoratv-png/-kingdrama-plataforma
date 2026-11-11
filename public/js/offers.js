import { api, esc, icon } from './lib.js?v=48397e6a9d1c';

export function offerPath(path) {
  const match = path.match(/^\/assistir\/([\w-]+)\/(\d+)$/);
  return match ? `/ofertas?${new URLSearchParams({ titulo: match[1], episodio: match[2] })}` : '/ofertas';
}

function checkoutUrl(plan) {
  if (!/^[a-zA-Z0-9]{6,32}$/.test(plan.productId || '')) return null;
  const url = new URL('https://pay.lowify.com.br/checkout');
  url.searchParams.set('product_id', plan.productId);
  return url.href;
}

function watchDestination(query) {
  const title = query.get('titulo') || '', episode = query.get('episodio') || '1';
  return /^[\w-]{1,120}$/.test(title) && /^\d{1,6}$/.test(episode) && Number(episode) > 0
    ? `/assistir/${encodeURIComponent(title)}/${Number(episode)}` : '/inicio';
}

export async function offers(ctx) {
  const response = await fetch('/config/ofertas.json', { cache: 'no-store' });
  if (!response.ok) throw new Error('Não foi possível carregar as ofertas. Tente novamente.');
  const config = await response.json();
  if (!Array.isArray(config.plans) || !Array.isArray(config.features)) throw new Error('As ofertas estão temporariamente indisponíveis.');
  const title = ctx.query.get('titulo') || '';
  const episode = ctx.query.get('episodio') || '1';
  const hasTitle = /^[\w-]{1,120}$/.test(title);
  const hasEpisode = /^\d{1,6}$/.test(episode) && Number(episode) > 0;
  const active = ctx.state.me?.access?.active;
  const back = hasTitle ? `/titulo/${encodeURIComponent(title)}` : '/inicio';
  const plans = config.plans.slice().sort((a,b) => Number(Boolean(b.available)) - Number(Boolean(a.available)));
  return `<div class="page-head offers-heading"><span class="eyebrow">Seu próximo dorama começa aqui</span><h1>Escolha seu plano</h1><p>Quatro períodos de acesso. O mesmo universo de histórias.</p></div>
    <div class="wrap stack offers-page">
      ${active ? `<section class="offer-active"><div>${icon.check}<p><strong>Sua assinatura está ativa</strong><span>Você já pode assistir aos episódios do catálogo.</span></p></div>${hasTitle && hasEpisode ? `<a class="btn btn-primary" href="${esc(watchDestination(ctx.query))}">${icon.play} Continuar para o episódio</a>` : ''}</section>` : ''}
      <section class="offers-grid" aria-label="Ofertas de assinatura" data-offer-cards>${plans.map(plan => {
        const url = checkoutUrl(plan), available = Boolean(plan.available && url);
        const hasPrice = Number.isInteger(plan.priceCents) && plan.priceCents > 0;
        const price = hasPrice ? (plan.priceCents / 100).toLocaleString('pt-BR', { style:'currency', currency:'BRL' }) : null;
        return `<article class="offer-card ${plan.featured ? 'offer-card-featured' : ''} ${available ? '' : 'offer-card-unavailable'}">
          <div class="offer-card-top"><span class="offer-duration">${esc(plan.durationLabel)}</span>${!available ? '<span class="offer-availability">Em preparação</span>' : ''}</div>
          <h2>${esc(plan.name)}</h2><p class="offer-tagline">${esc(plan.tagline)}</p>
          <div class="offer-price">${price ? `<strong>${esc(price)}</strong><span>à vista · ${esc(plan.pricePeriod)}</span>` : `<strong class="offer-price-pending">${available ? 'Valor no checkout' : 'Valor em breve'}</strong><span>${esc(plan.pricePeriod)}</span>`}</div>
          <p class="offer-description">${esc(plan.description)}</p>
          <ul class="offer-benefits">${config.features.map(feature => `<li>${icon.check}<span>${esc(feature)}</span></li>`).join('')}</ul>
          ${available ? `<a class="btn ${plan.featured ? 'btn-primary' : 'btn-ghost'} btn-block" href="${esc(url)}" target="_blank" rel="noopener noreferrer" data-offer-checkout="${esc(plan.code)}" data-product-id="${esc(plan.productId)}" aria-label="Assinar ${esc(plan.name)} no checkout da Lowify, abre em outra aba">Assinar ${esc(plan.name.replace(/^Plano /,''))} ${icon.next}</a><p class="offer-checkout-note">Pagamento no checkout da Lowify</p>` : '<button class="btn btn-ghost btn-block" type="button" disabled>Indisponível no momento</button><p class="offer-checkout-note">Esta oferta estará disponível em breve.</p>'}
        </article>`;
      }).join('')}</section>
      <section class="offer-help" aria-labelledby="offer-help-title"><div><h2 id="offer-help-title">Do pagamento ao próximo episódio</h2><p>Você será direcionado ao checkout da Lowify. Use o mesmo e-mail cadastrado na sua conta: <strong class="offer-account-email">${esc(ctx.state.me?.user?.email || '')}</strong>.</p><p>A validade começa com a confirmação do pagamento. Ao final do período, renove seu acesso para continuar assistindo. Suas datas ficam disponíveis no Perfil.</p><p class="hint">A indicação é válida no primeiro pagamento confirmado de cada amigo. Os dias extras são somados à sua assinatura.</p></div><div class="offer-help-actions"><button class="btn btn-ghost" type="button" data-offer-check>Já paguei — verificar acesso</button><a class="link" href="mailto:kivoratv@gmail.com?subject=Assinatura%20KingDrama">Preciso de ajuda com minha assinatura</a></div><p class="hint" data-offer-feedback role="status" aria-live="polite"></p></section>
      <a class="btn btn-ghost offers-back" href="${esc(back)}">${icon.back} ${hasTitle ? 'Voltar ao dorama' : 'Explorar o catálogo'}</a>
    </div>`;
}

offers.mount = (root,ctx) => {
  const button = root.querySelector('[data-offer-check]'), feedback = root.querySelector('[data-offer-feedback]');
  if (!button || !feedback) return;
  let disposed = false, busy = false;
  const pendingPurchase = () => {
    try { const saved = JSON.parse(sessionStorage.getItem('kd_checkout_intent') || 'null'); return saved?.accountId === ctx.state.me?.user?.id && saved.needsActivation && Date.now() - saved.createdAt < 86400000; } catch { return false; }
  };
  root.querySelectorAll('[data-offer-checkout]').forEach(link => link.addEventListener('click', () => {
    try { sessionStorage.setItem('kd_checkout_intent', JSON.stringify({ accountId:ctx.state.me?.user?.id, productId:link.dataset.productId, plan:link.dataset.offerCheckout, needsActivation:!ctx.state.me?.access?.active, createdAt:Date.now() })); } catch { /* Optional storage. */ }
    feedback.textContent = 'Após pagar na Lowify, volte aqui para conferir a liberação do seu acesso.';
  }));
  const check = async (manual = false) => {
    if (disposed || busy || (!manual && (!pendingPurchase() || document.hidden))) return;
    busy = true; button.disabled = true;
    if (manual) feedback.textContent = 'Conferindo sua assinatura…';
    try {
      const me = await api('/api/me?atualizar=1'); if (disposed) return;
      ctx.state.me = me;
      if (me.access?.active) {
        try { sessionStorage.removeItem('kd_checkout_intent'); } catch { /* Optional storage. */ }
        ctx.navigate(watchDestination(ctx.query), { replace:true });
      } else if (manual) feedback.textContent = 'Sua compra ainda não foi confirmada na plataforma. Aguarde e confira novamente. Se precisar, fale com o suporte.';
    } catch(error) { if (manual && !disposed) feedback.textContent = error.message; }
    finally { busy = false; if (!disposed) button.disabled = false; }
  };
  button.addEventListener('click', () => check(true));
  const onVisible = () => { if (!document.hidden) check(); };
  document.addEventListener('visibilitychange',onVisible);
  const timer = setInterval(check,15000);
  return () => { disposed = true; clearInterval(timer); document.removeEventListener('visibilitychange',onVisible); };
};
