import { api, esc, icon, card, row, enhance, toast, smallCover, initials } from './lib.js?v=2b974c99d6e0';
import { state } from './app.js?v=2b974c99d6e0';
import { accountBanner, mountAccountBanner } from './account-banner.js?v=2b974c99d6e0';
import { categoryLinks } from './category-menu.js?v=2b974c99d6e0';
import { loadPlayerControl, mountPlayerButton } from './player-button.js?v=2b974c99d6e0';

const statusLabel = { active: 'Ativo', pending: 'Pendente', canceled: 'Cancelado', refunded: 'Reembolsado', expired: 'Expirado', chargeback: 'Contestado' };
export const statusBadge = (s) => `<span class="status-badge ${s === 'active' ? 'status-active' : s === 'pending' ? 'status-pending' : 'status-other'}">${esc(statusLabel[s] || s)}</span>`;

// ============================================================ Visitante
export async function landing() {
  let show = { titles: [], total: 0, posters: [] };
  try { show = await api('/api/showcase'); } catch { /* segue sem vitrine */ }
  // Enquanto o catálogo não entra, o fundo usa as imagens dos banners.
  const art = show.titles.length ? show.titles.map((t) => smallCover(t.cover)) : (show.posters || []);
  const half = Math.ceil(art.length / 2) || 1;
  const lane = (list) => `<div class="lane">${[...list, ...list, ...list].map((src) => `<img src="${esc(src)}" alt="" loading="lazy" width="150" height="200">`).join('')}</div>`;
  const wall = art.length
    ? `<div class="poster-wall" aria-hidden="true">${lane(art.slice(0, half))}${lane(art.slice(half))}${lane([...art.slice(0, half)].reverse())}</div>`
    : '';
  return `
  <div class="landing-hero">
    ${wall}
    <header class="auth-top">
      <span class="logo"><img src="/img/logo.png" alt="KingDrama" width="300" height="100"></span>
      <a class="btn btn-ghost" href="/entrar" style="min-height:44px;padding:0 18px">Entrar</a>
    </header>
    <div class="landing-copy">
      <span class="eyebrow">Dramas e séries · novos episódios toda semana</span>
      <h1>Histórias que prendem do <em>primeiro ao último</em> episódio.</h1>
      <p>${show.total ? `${show.total} títulos para assistir` : 'Um catálogo inteiro para assistir'} no celular, no tablet ou no computador.</p>
      <div class="landing-cta">
        <a class="btn btn-primary" href="/cadastro">Criar conta</a>
        <a class="btn btn-ghost" href="/entrar">Já tenho conta</a>
      </div>
    </div>
  </div>
  <section class="how" aria-label="Como funciona">
    <article><b>1</b><h3>Crie sua conta</h3><p>Só com seu e-mail. Enviamos um código e um link de acesso de uso único — sem senha para decorar.</p></article>
    <article><b>2</b><h3>Conclua o pagamento</h3><p>Você é levado ao checkout seguro. O acesso fica pendente até a confirmação.</p></article>
    <article><b>3</b><h3>Acesso liberado</h3><p>Assim que o pagamento é confirmado pelo nosso servidor, o catálogo é liberado automaticamente.</p></article>
  </section>
  <footer class="site-foot">© ${new Date().getFullYear()} KingDrama</footer>`;
}

// ============================================================ Início
function heroFeature(list, site) {
  const guide = site?.banners?.showPlaceholderGuide
    ? `<div class="banner-guide">${icon.image}<div><strong>Espaço reservado para banner.</strong> Celular: ${esc(site.banners.guide.mobile)}. Computador: ${esc(site.banners.guide.desktop)}. Configure em <code>config/banners.json</code>. (Aviso visível só em desenvolvimento.)</div></div>`
    : '';
  if (!list.length) return '';
  const t = list[0];
  return `<section class="hero" aria-roledescription="carrossel" aria-label="Destaques">
    <div class="hero-bg" aria-hidden="true"><img src="${esc(smallCover(t.cover))}" alt=""></div>
    <div class="hero-inner">
      <div class="feature">
        <a class="feature-poster" href="/titulo/${esc(t.id)}" aria-label="${esc(t.name)}"><img src="${esc(t.cover)}" alt="" width="720" height="960"></a>
        <div class="feature-info">
          <span class="eyebrow">Em destaque</span>
          <h2 data-f="name">${esc(t.name)}</h2>
          <div class="feature-actions">
            <a class="btn btn-light" data-f="link" href="/titulo/${esc(t.id)}">${icon.info} Ver detalhes</a>
            <button class="btn btn-ghost" type="button" data-f="fav" data-id="${esc(t.id)}">${icon.heart} Favoritos</button>
          </div>
          <div class="feature-thumbs" role="tablist" aria-label="Escolher destaque">
            ${list.map((x, i) => `<button type="button" role="tab" data-i="${i}" aria-current="${i === 0}" aria-label="${esc(x.name)}"><img src="${esc(smallCover(x.cover))}" alt="" loading="lazy"></button>`).join('')}
          </div>
        </div>
      </div>
      <div class="feature-dots" role="tablist" aria-label="Escolher destaque">
        ${list.map((x, i) => `<button type="button" role="tab" data-i="${i}" aria-current="${i === 0}" aria-label="Destaque ${i + 1}: ${esc(x.name)}"></button>`).join('')}
      </div>
      ${guide}
    </div>
  </section>`;
}

// Banners (config/banners.json): imagem larga no computador com título, etiquetas, sinopse e "Reproduzir"
// à esquerda e miniaturas à direita; no celular, a capa em pé com as etiquetas e o botão logo abaixo.
function heroBanners(slots) {
  return `<section class="hero hero-banners" aria-roledescription="carrossel" aria-label="Destaques">
    ${slots.map((s, i) => {
      // Sem catálogo ainda: o botão leva ao aviso "em breve" em vez de uma página 404.
      const link = state.site?.catalogReady && s.titleId
        ? `/titulo/${encodeURIComponent(s.titleId)}`
        : `/em-breve?t=${encodeURIComponent(s.headline || '')}`;
      // Só o primeiro slide nasce com src. "hidden" esconde, mas NÃO impede o
      // download: os oito banners desciam juntos (mais de 1 MB) disputando a
      // rede com as capas. Os outros entram em data-src e são buscados pelo
      // carrossel pouco antes de aparecerem — com 8s de rotação, sobra tempo.
      const fonte = i
        ? `<source media="(min-width: 900px)" data-srcset="${esc(s.image.desktop)}">`
        : `<source media="(min-width: 900px)" srcset="${esc(s.image.desktop)}">`;
      const imagem = i
        ? `<img data-src="${esc(s.image.mobile)}" alt="${esc(s.alt || s.headline || '')}">`
        : `<img src="${esc(s.image.mobile)}" alt="${esc(s.alt || s.headline || '')}" fetchpriority="high">`;
      return `<article class="banner" data-slide="${i}" aria-roledescription="slide" aria-label="${i + 1} de ${slots.length}" ${i ? 'hidden' : ''}>
        <picture>
          ${fonte}
          ${imagem}
        </picture>
        <div class="banner-text">
          ${s.headline ? `<h2>${esc(s.headline)}</h2>` : ''}
          ${s.tags?.length ? `<div class="banner-tags">${s.tags.map((t) => `<span>${esc(t)}</span>`).join('')}</div>` : ''}
          ${s.subtitle ? `<p class="banner-synopsis">${esc(s.subtitle)}</p>` : ''}
          ${link ? `<a class="btn btn-light banner-cta" href="${link}">${icon.play} ${esc(s.ctaLabel || 'Reproduzir')}</a>` : ''}
        </div>
      </article>`;
    }).join('')}
    ${slots.length > 1 ? `<div class="banner-thumbs">
      <div class="banner-thumbs-track" role="tablist" aria-label="Escolher destaque">
        ${slots.map((s, i) => `<button type="button" role="tab" data-i="${i}" aria-selected="${i === 0}" aria-label="${esc(s.headline || `Destaque ${i + 1}`)}">${s.thumb ? `<img src="${esc(s.thumb)}" alt="" loading="lazy" width="90" height="120">` : ''}</button>`).join('')}
      </div>
      <button type="button" class="banner-next" aria-label="Próximo destaque">${icon.next}</button>
    </div>
    <div class="feature-dots banner-dots" aria-hidden="true">${slots.map((_, i) => `<button type="button" data-i="${i}" tabindex="-1" aria-current="${i === 0}"></button>`).join('')}</div>` : ''}
  </section>`;
}

export async function home() {
  const data = await api('/api/home');
  home.data = data;
  const slots = state.site?.banners?.slots || [];
  const hero = slots.length ? heroBanners(slots) : heroFeature(data.hero, state.site);
  const rows = data.rows.map(row).join('');
  // Estrutura publicada antes do catálogo: em vez de uma página só com o banner,
  // explica o que vem a seguir.
  const empty = `<section class="wrap" style="margin-top:28px">
      <div class="empty">${icon.film}<strong>O catálogo chega em breve</strong>
      <p>Os títulos, episódios e capas ainda não foram publicados. Assim que entrarem, aparecem aqui em fileiras por categoria.</p></div>
    </section>`;
  return `${hero}${accountBanner()}${rows ? `<div class="rows">${rows}</div>` : empty}`;
}
function mountHomeHero(root) {
  const data = home.data;
  const slots = state.site?.banners?.slots || [];
  const rotation = (state.site?.banners?.rotationSeconds || 8) * 1000;
  if (slots.length) {
    const hero = root.querySelector('.hero-banners');
    if (!hero) return;
    const slides = [...hero.querySelectorAll('.banner')];
    if (slides.length < 2) return;
    const track = hero.querySelector('.banner-thumbs-track');
    let cur = 0, timer;

    // Busca a imagem de um slide que ainda não foi baixado. A ordem importa:
    // o <source> do desktop precisa estar pronto antes do src do <img>, senão
    // o navegador começa a baixar a versão mobile mesmo em tela grande.
    const carregaSlide = (n) => {
      const slide = slides[(n + slides.length) % slides.length];
      const img = slide?.querySelector('img[data-src]');
      if (!img) return;
      const src = slide.querySelector('source[data-srcset]');
      if (src) { src.srcset = src.dataset.srcset; delete src.dataset.srcset; }
      img.src = img.dataset.src;
      delete img.dataset.src;
    };

    const show = (i) => {
      slides[cur].hidden = true;
      cur = (i + slides.length) % slides.length;
      carregaSlide(cur);      // caso tenham pulado direto para cá pela miniatura
      carregaSlide(cur + 1);  // e já deixa o próximo pronto
      slides[cur].hidden = false;
      hero.querySelectorAll('.banner-thumbs [data-i]').forEach((b) => b.setAttribute('aria-selected', String(Number(b.dataset.i) === cur)));
      hero.querySelectorAll('.banner-dots [data-i]').forEach((b) => b.setAttribute('aria-current', String(Number(b.dataset.i) === cur)));
      // Mantém a miniatura ativa visível na faixa (sem rolar a página).
      const thumb = track.children[cur];
      const left = thumb.offsetLeft - (track.clientWidth - thumb.offsetWidth) / 2;
      track.scrollTo({ left, behavior: 'smooth' });
    };
    const restart = () => {
      clearInterval(timer);
      if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      timer = setInterval(() => (hero.isConnected ? show(cur + 1) : clearInterval(timer)), rotation);
    };
    hero.querySelectorAll('[data-i]').forEach((b) => b.addEventListener('click', () => { show(Number(b.dataset.i)); restart(); }));
    hero.querySelector('.banner-next').addEventListener('click', () => { show(cur + 1); restart(); });
    // Deslizar o dedo sobre a imagem troca o banner.
    let x0 = null;
    hero.addEventListener('touchstart', (e) => { x0 = e.target.closest('.banner-thumbs') ? null : e.touches[0].clientX; }, { passive: true });
    hero.addEventListener('touchend', (e) => {
      if (x0 === null) return;
      const dx = e.changedTouches[0].clientX - x0;
      x0 = null;
      if (Math.abs(dx) > 40) { show(cur + (dx < 0 ? 1 : -1)); restart(); }
    });
    // O segundo banner só é buscado quando a página fica ociosa: a primeira
    // troca já o encontra pronto, sem disputar rede com as capas na abertura.
    const quandoOcioso = window.requestIdleCallback || ((fn) => setTimeout(fn, 1500));
    quandoOcioso(() => carregaSlide(1));
    restart();
    return () => clearInterval(timer);
  }
  const hero = root.querySelector('.hero');
  if (!hero || !data?.hero?.length) return;
  const list = data.hero;
  let cur = 0, timer;
  const show = (i) => {
    cur = (i + list.length) % list.length;
    const t = list[cur];
    hero.querySelector('.feature-poster').href = `/titulo/${t.id}`;
    hero.querySelector('.feature-poster').setAttribute('aria-label', t.name);
    hero.querySelector('.feature-poster img').src = t.cover;
    hero.querySelector('.hero-bg img').src = smallCover(t.cover);
    hero.querySelector('[data-f="name"]').textContent = t.name;
    hero.querySelector('[data-f="link"]').href = `/titulo/${t.id}`;
    hero.querySelector('[data-f="fav"]').dataset.id = t.id;
    hero.querySelectorAll('[data-i]').forEach((b) => b.setAttribute('aria-current', String(Number(b.dataset.i) === cur)));
  };
  const restart = () => {
    clearInterval(timer);
    timer = setInterval(() => (hero.isConnected ? show(cur + 1) : clearInterval(timer)), rotation);
  };
  hero.querySelectorAll('[data-i]').forEach((b) => b.addEventListener('click', () => { show(Number(b.dataset.i)); restart(); }));
  // Deslizar o dedo sobre o pôster troca o destaque.
  let x0 = null;
  const poster = hero.querySelector('.feature-poster');
  poster.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; }, { passive: true });
  poster.addEventListener('touchend', (e) => {
    if (x0 === null) return;
    const dx = e.changedTouches[0].clientX - x0;
    x0 = null;
    if (Math.abs(dx) > 40) { show(cur + (dx < 0 ? 1 : -1)); restart(); }
  });
  poster.addEventListener('click', (e) => { if (poster.dataset.swiped) e.preventDefault(); });
  hero.querySelector('[data-f="fav"]').addEventListener('click', async (e) => {
    const id = e.currentTarget.dataset.id;
    await api(`/api/favorites/${encodeURIComponent(id)}`, { method: 'PUT' });
    toast('Adicionado aos Favoritos');
  });
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches) restart();
  return () => clearInterval(timer);
}
home.mount = root => {
  const cleanupBanner=mountAccountBanner(root),cleanupHero=mountHomeHero(root);
  return ()=>{cleanupBanner?.();cleanupHero?.();};
};

// ============================================================ Busca
export async function search(ctx) {
  const q = ctx.query.get('q') || '';
  return `<div class="search-box" role="search">
      <form class="search-field" data-search>
        ${icon.search}<label class="sr-only" for="q">Buscar títulos</label>
        <input class="input" id="q" name="q" type="search" value="${esc(q)}" placeholder="Nome do título…" autocomplete="off" enterkeyhint="search" autocapitalize="off">
        <button class="icon-btn clear" type="button" aria-label="Limpar busca" ${q ? '' : 'hidden'}>${icon.close}</button>
      </form>
    </div>
    <div data-results aria-live="polite"></div>`;
}
search.mount = (root, ctx) => {
  const input = root.querySelector('#q');
  const out = root.querySelector('[data-results]');
  const clear = root.querySelector('.clear');
  let t, seq = 0;
  const run = async () => {
    const q = input.value.trim();
    clear.hidden = !q;
    history.replaceState(history.state, '', q ? `/buscar?q=${encodeURIComponent(q)}` : '/buscar');
    const my = ++seq;
    if (q.length < 2) {
      if (!run.cats) run.cats = (await api('/api/categories')).categories;
      if (my !== seq) return;
      out.innerHTML = run.cats.length
        ? `<div class="page-head" style="padding-top:8px"><h1 style="font-size:18px">Explore por categoria</h1></div>
           <div class="pills" style="flex-wrap:wrap;overflow:visible">${run.cats.map((c) => `<a class="pill" href="/categoria/${esc(c.id)}">${esc(c.name)}</a>`).join('')}</div>`
        : `<div class="wrap" style="margin-top:12px"><div class="empty">${icon.search}<strong>A busca fica pronta com o catálogo</strong>
           <p>Quando os títulos forem publicados, você poderá procurar por nome aqui.</p></div></div>`;
      return;
    }
    const { titles } = await api(`/api/search?q=${encodeURIComponent(q)}`);
    if (my !== seq) return;
    out.innerHTML = titles.length
      ? `<p class="count-line">${titles.length} resultado${titles.length > 1 ? 's' : ''} para “${esc(q)}”</p><div class="grid">${titles.map((x) => card(x)).join('')}</div>`
      : `<div class="wrap" style="margin-top:12px"><div class="empty">${icon.search}<strong>Nada encontrado para “${esc(q)}”</strong><p>Confira a grafia ou tente outra palavra do título.</p></div></div>`;
    enhance(out);
  };
  input.addEventListener('input', () => { clearTimeout(t); t = setTimeout(run, 220); });
  root.querySelector('[data-search]').addEventListener('submit', (e) => { e.preventDefault(); input.blur(); run(); });
  clear.addEventListener('click', () => { input.value = ''; input.focus(); run(); });
  run();
  if (!ctx.query.get('q') && matchMedia('(min-width: 900px)').matches) input.focus();
};

// ============================================================ Categorias
export async function categories() {
  const { categories: cats } = await api('/api/categories');
  if (!cats.length) {
    return `<div class="page-head"><h1>Categorias</h1></div>
      <div class="wrap"><div class="empty">${icon.grid}<strong>Nenhuma categoria ainda</strong>
      <p>As categorias são criadas junto com o catálogo. Volte depois que os títulos forem publicados.</p>
      <a class="btn btn-primary" href="/inicio">Voltar ao início</a></div></div>`;
  }
  return `<div class="page-head"><h1>Categorias</h1><p>Escolha um tema e encontre sua próxima série.</p></div>
    <nav class="wrap category-text-list" aria-label="Escolher categoria">${categoryLinks(cats)}</nav>`;
}

export async function category(ctx) {
  const [id] = ctx.params;
  const [{ titles }, { categories: cats }] = await Promise.all([api(`/api/titles?category=${encodeURIComponent(id)}`), api('/api/categories')]);
  const cat = cats.find((c) => c.id === id);
  if (!cat) return notFound();
  return `<div class="page-head"><h1>${esc(cat.name)}</h1></div>
    <nav class="pills" aria-label="Categorias">${cats.map((c) => `<a class="pill" href="/categoria/${esc(c.id)}" ${c.id === id ? 'aria-current="true"' : ''}>${esc(c.name)}</a>`).join('')}</nav>
    <p class="count-line">${titles.length} títulos</p>
    <div class="grid">${titles.map((t) => card(t)).join('')}</div>`;
}
category.mount = (root) => root.querySelector('.pill[aria-current="true"]')?.scrollIntoView({ inline: 'center', block: 'nearest' });

// ============================================================ Detalhes do título
export async function title(ctx) {
  const { title: t, related } = await api(`/api/titles/${encodeURIComponent(ctx.params[0])}`);
  title.current = t;
  const hasEps = t.episodes.length > 0;
  return `<article class="detail">
    <div class="hero-bg" aria-hidden="true"><img src="${esc(smallCover(t.cover))}" alt=""></div>
    <button class="icon-btn back-btn" type="button" data-back aria-label="Voltar">${icon.back}</button>
    <div class="detail-inner">
      <div class="detail-poster"><img src="${esc(t.cover)}" alt="Capa de ${esc(t.name)}" width="720" height="960"></div>
      <div class="detail-info">
        <h1>${esc(t.name)}</h1>
        <div class="chips">
          ${t.categories.map((c) => `<a class="chip" href="/categoria/${esc(c.id)}">${esc(c.name)}</a>`).join('')}
        </div>
        ${t.synopsis ? `<p class="synopsis">${esc(t.synopsis)}</p>` : ''}
        <div class="detail-actions">
          <a class="btn btn-primary" href="/assistir/${esc(t.id)}/${hasEps ? t.episodes[0].number : 1}">${icon.play} Assistir</a>
          <button class="btn btn-ghost ${t.favorite ? 'is-on' : ''}" type="button" data-fav aria-pressed="${t.favorite}">
            ${t.favorite ? icon.heartFill : icon.heart}<span>${t.favorite ? 'Nos Favoritos' : 'Favoritos'}</span>
          </button>
        </div>
      </div>
    </div>
  </article>
  ${t.episodes.length>1 ? `<section class="section" aria-labelledby="eps">
    <h2 id="eps">Episódios</h2>
    <div class="ep-list">${t.episodes.map((e) => `<a href="/assistir/${esc(t.id)}/${e.number}" aria-label="Episódio ${e.number}${e.name ? ': ' + esc(e.name) : ''}">${e.number}</a>`).join('')}</div>
  </section>` : ''}
  ${row({ id: 'related', title: 'Você também pode gostar', titles: related })}`;
}
title.mount = (root) => {
  const t = title.current;
  root.querySelector('[data-back]').addEventListener('click', () => (history.length > 1 ? history.back() : null));
  const btn = root.querySelector('[data-fav]');
  btn.addEventListener('click', async () => {
    const on = btn.getAttribute('aria-pressed') !== 'true';
    btn.disabled = true;
    try {
      await api(`/api/favorites/${encodeURIComponent(t.id)}`, { method: on ? 'PUT' : 'DELETE' });
      btn.setAttribute('aria-pressed', String(on));
      btn.classList.toggle('is-on', on);
      btn.innerHTML = `${on ? icon.heartFill : icon.heart}<span>${on ? 'Nos Favoritos' : 'Favoritos'}</span>`;
      toast(on ? 'Adicionado aos Favoritos' : 'Removido dos Favoritos');
    } catch (e) { toast(e.message); } finally { btn.disabled = false; }
  });
};

// ============================================================ Player
export async function player(ctx) {
  const [id, n] = ctx.params;
  let data;
  try {
    data = await api(`/api/play/${encodeURIComponent(id)}/${n}`);
  } catch (e) {
    if (e.status !== 404) throw e;
    data = null;
  }
  player.data = data;
  const ep = data?.episode;
  const src = data?.sources?.[0];
  let embed = data?.embedUrl;
  if(embed){
    const url=new URL(embed);url.searchParams.set('autoplay','false');embed=url.href;
    await loadPlayerControl().catch(()=>{});
  }
  // Sem vídeo cadastrado: mostra a capa do título com o botão de play, sem aviso de indisponível
  let info = ep;
  if (!src && !embed && !ep) {
    try {
      const { title: t } = await api(`/api/titles/${encodeURIComponent(id)}`);
      info = { titleName: t.name, cover: t.cover, number: Number(n) || 1 };
    } catch (e) {
      if (e.status !== 404) throw e;
      return notFound();
    }
  }
  return `<div class="player-page">
    <div class="player-bar">
      <a class="icon-btn" href="/titulo/${esc(id)}" aria-label="Voltar para o título">${icon.back}</a>
      <div class="t"><strong>${esc(info.titleName)}</strong></div>
    </div>
    <div class="player-stage">
      <div class="player-frame">
        ${embed
          ? `<iframe src="${esc(embed)}" title="${esc(info.titleName)}" loading="eager" allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>`
          : src
            ? `<video controls playsinline preload="metadata" poster="${esc(ep.cover)}"></video>`
            : `<div class="player-poster"><img src="${esc(info.cover)}" alt=""></div>`}
      </div>
    </div>
    <div class="player-watch-actions"><button class="btn btn-primary" type="button" data-player-watch>${icon.play} Assistir</button><p class="hint" data-player-feedback role="status"></p><a class="player-channel" href="https://whatsapp.com/channel/0029Vb9NN6o8fewpZKqFQ80u" target="_blank" rel="noopener noreferrer">${icon.whatsapp}<span>Receba os lançamentos em primeira mão — siga e ative o sininho</span>${icon.next}</a></div>
    ${ep ? `<div class="player-controls">
      ${data.prev ? `<a class="btn btn-ghost" href="/assistir/${esc(id)}/${data.prev}">${icon.back} Ep. ${data.prev}</a>` : ''}
      ${data.next ? `<a class="btn btn-primary" href="/assistir/${esc(id)}/${data.next}">Próximo: ep. ${data.next} ${icon.next}</a>` : ''}
    </div>` : ''}
  </div>`;
}
player.mount = (root, ctx) => {
  const cleanupButton=mountPlayerButton(root);
  const data = player.data;
  let sessionAlive = true;
  const checkSession = async () => {
    const { data: allowed, error } = await window.__KD_SB__.rpc('account_session_allowed');
    if (sessionAlive && !error && allowed === false) ctx.navigate('/perfil', { replace: true });
  };
  const sessionTimer = setInterval(() => { checkSession().catch(() => {}); }, 30000);
  const onVisible = () => { if (!document.hidden) checkSession().catch(() => {}); };
  document.addEventListener('visibilitychange', onVisible);
  const stopSessionCheck = () => { sessionAlive = false; clearInterval(sessionTimer); document.removeEventListener('visibilitychange', onVisible);cleanupButton?.(); };
  const video = root.querySelector('video');
  if (!video || !data) return stopSessionCheck;
  let hls = null;
  let alive = true;
  const fail = () => {
    if (!alive) return;
    video.replaceWith(Object.assign(document.createElement('div'), { className: 'empty', innerHTML: `${icon.film}<strong>Não foi possível carregar o vídeo</strong><p>Verifique sua conexão e tente novamente.</p><button class="btn btn-ghost" type="button">Tentar de novo</button>` }));
    root.querySelector('.player-frame .btn')?.addEventListener('click', () => ctx.navigate(location.pathname, { replace: true }));
  };
  // Tenta as fontes em ordem; se uma falhar, passa para a próxima.
  const play = async (i) => {
    const src = data.sources[i];
    if (!src || !alive) return fail();
    hls?.destroy();
    hls = null;
    video.onerror = null;
    const native = () => { video.onerror = () => play(i + 1); video.src = src.url; };
    // iPhone toca HLS nativamente (não tem MediaSource); Chrome/Android/Firefox/Edge/Safari no Mac usam hls.js.
    if (src.kind !== 'hls' || (video.canPlayType('application/vnd.apple.mpegurl') && !window.MediaSource)) return native();
    video.removeAttribute('src');
    const Hls = await loadHls().catch(() => null);
    if (!alive) return;
    if (!Hls?.isSupported()) return video.canPlayType('application/vnd.apple.mpegurl') ? native() : play(i + 1);
    hls = new Hls({ capLevelToPlayerSize: true });
    let retried = false;
    hls.on(Hls.Events.ERROR, (_, err) => {
      if (!err.fatal) return;
      if (err.type === Hls.ErrorTypes.MEDIA_ERROR && !retried) { retried = true; hls.recoverMediaError(); }
      else if (err.type === Hls.ErrorTypes.NETWORK_ERROR && !retried) { retried = true; hls.startLoad(); }
      else play(i + 1);
    });
    hls.loadSource(src.url);
    hls.attachMedia(video);
  };
  play(0);
  video.addEventListener('loadedmetadata', () => { if (data.resumeAt > 5 && data.resumeAt < video.duration - 5) video.currentTime = data.resumeAt; }, { once: true });
  let last = 0;
  const save = () => {
    const pos = Math.floor(video.currentTime);
    if (Math.abs(pos - last) < 5) return;
    last = pos;
    api('/api/play/progress', { method: 'POST', body: { episodeId: data.episode.id, position: pos } }).catch(() => {});
  };
  video.addEventListener('timeupdate', save);
  video.addEventListener('pause', save);
  video.addEventListener('ended', () => {
    if (data.next) ctx.navigate(`/assistir/${encodeURIComponent(data.episode.titleId)}/${data.next}`, { replace: true });
  });
  return () => { stopSessionCheck(); save(); alive = false; hls?.destroy(); };
};

// hls.js (public/vendor) só é baixado quando um episódio HLS é aberto fora do iPhone.
let hlsLib;
function loadHls() {
  if (window.Hls) return Promise.resolve(window.Hls);
  hlsLib ||= new Promise((resolve, reject) => {
    const s = Object.assign(document.createElement('script'), { src: '/vendor/hls.min.js?v=2b974c99d6e0', async: true });
    s.onload = () => resolve(window.Hls);
    s.onerror = () => { hlsLib = null; reject(new Error('hls.js indisponível')); };
    document.head.append(s);
  });
  return hlsLib;
}

// ============================================================ Favoritos / Histórico
export async function favorites() {
  const { titles } = await api('/api/favorites');
  return `<div class="page-head"><h1>Favoritos</h1><p>Títulos que você salvou para assistir depois.</p></div>
    ${titles.length ? `<p class="count-line">${titles.length} título${titles.length > 1 ? 's' : ''}</p><div class="grid">${titles.map((t) => card(t, { favorite: true })).join('')}</div>`
      : `<div class="wrap"><div class="empty">${icon.heart}<strong>Você ainda não tem favoritos</strong><p>Toque em “Favoritos” na página de um título para salvá-lo aqui.</p><a class="btn btn-primary" href="/inicio">Explorar o catálogo</a></div></div>`}`;
}

export async function watchHistory() {
  const { items } = await api('/api/history');
  return `<div class="page-head"><h1>Histórico</h1><p>Continue de onde parou.</p></div>
    ${items.length ? `<div class="grid">${items.map((i) => card({ id: i.id, name: `${i.name} · ep. ${i.number}`, cover: i.cover })).join('')}</div>`
      : `<div class="wrap"><div class="empty">${icon.clock}<strong>Você ainda não assistiu nada</strong><p>Quando começar um episódio, ele aparece aqui.</p><a class="btn btn-primary" href="/inicio">Começar a assistir</a></div></div>`}`;
}

// ============================================================ Erros
// ============================================================ Em breve
// Destino dos botões dos banners enquanto o catálogo não está publicado.
export async function comingSoon(ctx) {
  const t = ctx.query.get('t');
  return `<div class="wrap" style="padding-top:40px">
    <div class="empty">${icon.film}
      <strong>${t ? esc(t) : 'Este título'} chega em breve</strong>
      <p>A página de episódios e o player ainda não foram ligados ao catálogo. Assim que o título entrar, este botão abre direto nele.</p>
      <a class="btn btn-primary" href="/inicio">Voltar ao início</a>
    </div>
  </div>`;
}

export function notFound() {
  return `<div class="wrap" style="padding-top:40px"><div class="empty">${icon.film}<strong>Página não encontrada</strong><p>O endereço pode estar incorreto ou o título foi removido.</p><a class="btn btn-primary" href="/">Ir para o início</a></div></div>`;
}
export function errorPage(e) {
  if (e.status === 404) return notFound();
  return `<div class="wrap" style="padding-top:40px"><div class="empty">${icon.info}<strong>Algo deu errado</strong><p>${esc(e.message || 'Tente novamente em instantes.')}</p><a class="btn btn-ghost" href="${esc(location.pathname)}">Tentar de novo</a></div></div>`;
}
