import { esc, icon } from './lib.js?v=69eeb26e4b0b';

export function offerPath(path) {
  const match = path.match(/^\/assistir\/([\w-]+)\/(\d+)$/);
  return match ? `/ofertas?${new URLSearchParams({ titulo: match[1], episodio: match[2] })}` : '/ofertas';
}

export function offers(ctx) {
  const title = ctx.query.get('titulo') || '';
  const episode = ctx.query.get('episodio') || '1';
  const hasTitle = /^[\w-]{1,120}$/.test(title);
  const hasEpisode = /^\d{1,6}$/.test(episode) && Number(episode) > 0;
  const active = ctx.state.me?.access?.active;
  const back = hasTitle ? `/titulo/${encodeURIComponent(title)}` : '/inicio';
  return `<div class="page-head narrow"><h1>Ofertas</h1><p>Continue explorando. Assine quando quiser assistir.</p></div>
    <div class="wrap narrow stack offers-page">
      <section class="profile-card settings-section">
        <span class="offer-icon" aria-hidden="true">${icon.play}</span>
        <h2>${active ? 'Sua assinatura está ativa' : 'Escolha uma oferta para começar a assistir'}</h2>
        <p>${active ? 'Seu acesso aos episódios está liberado.' : 'Você pode navegar pelo catálogo, conhecer os doramas e salvar seus favoritos. Para reproduzir os episódios, é necessário ter uma assinatura ativa.'}</p>
        ${active && hasTitle && hasEpisode ? `<a class="btn btn-primary" href="/assistir/${encodeURIComponent(title)}/${Number(episode)}">${icon.play} Continuar para o episódio</a>` : ''}
      </section>
      <section class="offers-grid" aria-label="Ofertas de assinatura" data-offer-cards>
        <div class="offers-placeholder"><h2>Ofertas em breve</h2><p>Os planos de assinatura estarão disponíveis aqui em breve.</p></div>
      </section>
      <a class="btn btn-ghost" href="${esc(back)}">${icon.back} ${hasTitle ? 'Voltar ao dorama' : 'Explorar o catálogo'}</a>
    </div>`;
}
