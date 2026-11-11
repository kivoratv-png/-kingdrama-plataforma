// Roteador, estado da sessão e layout.
import { api, esc, icon, initials, enhance } from './lib.js?v=2b974c99d6e0';
import * as pages from './pages.js?v=2b974c99d6e0';
import * as authPages from './auth-pages.js?v=2b974c99d6e0';
import { clearActivity, sendActivity } from './activity.js?v=2b974c99d6e0';
import { privacy } from './privacy.js?v=2b974c99d6e0';
import { profile } from './profile.js?v=2b974c99d6e0';
import { requests, mountRequestsPanel } from './requests.js?v=2b974c99d6e0';
import { offers, offerPath } from './offers.js?v=2b974c99d6e0';
import { referrals } from './referrals.js?v=2b974c99d6e0';
import { mountCategoryMenu } from './category-menu.js?v=2b974c99d6e0';

export const state = { me: null, site: null };
const app = document.getElementById('app');

// guard: 'public' (qualquer um) | 'guest' (só visitante) | 'user' (logado) | 'active' (acesso liberado)
const routes = [
  { re: /^\/indicacoes$/, guard: 'user', page: referrals, tab: 'perfil' },
  { re: /^\/ofertas$/, guard: 'user', page: offers },
  { re: /^\/pedidos$/, guard: 'user', page: requests, tab: 'pedidos' },
  { re: /^\/entrar-com-codigo$/, guard: 'guest', page: authPages.codeLogin, bare: true },
  { re: /^\/politica-de-privacidade$/, guard: 'public', page: privacy, bare: true },
  { re: /^\/admin$/, guard: 'public', page: () => { location.replace('/admin/'); return ''; }, bare: true },
  { re: /^\/$/, guard: 'root' },
  { re: /^\/inicio$/, guard: 'user', page: pages.home, tab: 'inicio', overHero: true },
  { re: /^\/buscar$/, guard: 'user', page: pages.search, tab: 'buscar' },
  { re: /^\/categorias$/, guard: 'user', page: pages.categories, tab: 'categorias' },
  { re: /^\/categoria\/([\w-]+)$/, guard: 'user', page: pages.category, tab: 'categorias' },
  { re: /^\/titulo\/([\w-]+)$/, guard: 'user', page: pages.title, overHero: true },
  { re: /^\/assistir\/([\w-]+)\/(\d+)$/, guard: 'active', page: pages.player, bare: true },
  { re: /^\/(?:favoritos|minha-lista)$/, guard: 'user', page: pages.favorites, tab: 'lista' },
  { re: /^\/em-breve$/, guard: 'user', page: pages.comingSoon },
  { re: /^\/historico$/, guard: 'user', page: pages.watchHistory, tab: 'perfil' },
  { re: /^\/perfil$/, guard: 'user', page: profile, tab: 'perfil' },
  { re: /^\/entrar$/, guard: 'guest', page: authPages.login, bare: true },
  { re: /^\/cadastro$/, guard: 'guest', page: authPages.signup, bare: true },
  { re: /^\/recuperar$/, guard: 'guest', page: authPages.recover, bare: true },
  { re: /^\/nova-senha$/, guard: 'public', page: authPages.newPassword, bare: true },
  { re: /^\/acesso$/, guard: 'user', page: (ctx) => { ctx.navigate('/ofertas', { replace: true }); return ''; } },
  { re: /^\/pagamento\/retorno$/, guard: 'user', page: authPages.checkoutReturn, bare: true },
];

export async function refreshMe() {
  state.me = await api('/api/me');
  return state.me;
}
export const isActive = () => Boolean(state.me?.user && state.me.access?.active);

// ------------------------------------------------------- Versão desta aba
// Uma aba aberta continua rodando o código que baixou quando abriu. Publicar
// não alcança quem já está com o site aberto, e aí a tela antiga conversa com
// o servidor novo: dá erro sem sentido, como pedir um código de acesso que o
// site não usa mais.
//
// A aba compara a versão publicada com a que leu ao abrir. Quando muda, a
// próxima navegação deixa de ser por dentro e vira um carregamento de
// verdade. Esperar o clique é de propósito: a pessoa já estava saindo
// daquela tela, então nada do que ela digitou se perde — bem diferente de
// recarregar por baixo dela no meio de um formulário.
let versaoDaAba = new URL(import.meta.url).searchParams.get('v') || document.querySelector('meta[name="kingdrama-version"]')?.content || null;
let saiuVersaoNova = false;
let ultimaConferida = 0;

async function confereVersao(forcar = false) {
  if (saiuVersaoNova || (!forcar && Date.now() - ultimaConferida < 60000)) return;
  ultimaConferida = Date.now();
  let publicada = null;
  try {
    const r = await fetch('/config/versao.json', { cache: 'no-store' });
    if (r.ok) publicada = (await r.json())?.versao || null;
  } catch { /* sem rede: fica como está */ }
  if (!publicada) return;
  if (!versaoDaAba) { versaoDaAba = publicada; return; }
  if (publicada !== versaoDaAba) saiuVersaoNova = true;
}

// Voltar para uma aba esquecida é justamente quando ela tende a estar velha.
document.addEventListener('visibilitychange', () => { if (!document.hidden) confereVersao(true); });
window.addEventListener('pageshow', () => confereVersao(true));

export function navigate(to, { replace = false } = {}) {
  // Saiu versão nova enquanto esta aba estava aberta: carrega de verdade, em
  // vez de trocar a tela por dentro mantendo o código antigo rodando.
  if (saiuVersaoNova) { location.href = to; return; }
  if (replace) history.replaceState({}, '', to);
  else {
    history.replaceState({ ...history.state, scrollY: window.scrollY }, '');
    history.pushState({}, '', to);
  }
  render();
}

let renderSeq = 0;
let unmountCurrent = null; // limpeza da página anterior (ex.: parar o player HLS)
let unmountCategoryMenu = null;
let requestsPanel=null;
export async function render() {
  confereVersao(); // sem await: não atrasa a tela, só marca para a próxima
  const seq = ++renderSeq;
  unmountCurrent?.();
  unmountCurrent = null;
  const path = location.pathname.replace(/\/+$/, '') || '/';
  const route = routes.find((r) => r.re.test(path));
  if(path==='/pedidos' && state.me?.user)return navigate('/inicio?pedidos=1',{replace:true});
  const me = state.me;
  const logged = Boolean(me?.user);

  if (!route) return shell(pages.notFound(), {});
  const params = path.match(route.re).slice(1).map(decodeURIComponent);

  // Guardas de acesso. A liberação real é sempre verificada pelo servidor (as APIs devolvem 401/403).
  if (route.guard === 'root') {
    if (!logged) return shellBare(await pages.landing(), { landing: true });
    return navigate('/inicio', { replace: true });
  }
  if (route.guard === 'guest' && logged) return navigate('/inicio', { replace: true });
  if ((route.guard === 'user' || route.guard === 'active') && !logged) {
    sessionStorageSet('kd_after_login', location.pathname + location.search);
    return navigate('/entrar', { replace: true });
  }
  if (route.guard === 'active' && !isActive()) return navigate(offerPath(path), { replace: true });

  const ctx = { params, query: new URLSearchParams(location.search), state, navigate, refreshMe };
  if (route.bare) {
    app.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';
  } else {
    shell('<div class="page-loading"><div class="spinner" role="status" aria-label="Carregando"></div></div>', route);
  }
  let html;
  try {
    html = await route.page(ctx);
  } catch (e) {
    if (e.status === 401) { await refreshMe(); return navigate('/entrar', { replace: true }); }
    if (e.status === 403 && e.code === 'access_pending') { await refreshMe(); return navigate(offerPath(path), { replace: true }); }
    if (e.status === 403 && e.code === 'device_limit') return navigate('/perfil', { replace: true });
    html = pages.errorPage(e);
  }
  if (seq !== renderSeq) return; // navegação mais recente em andamento
  if (route.bare) shellBare(html, route); else shell(html, route);
  const main = document.getElementById('main');
  const cleanup = route.page.mount?.(main, ctx);
  if (typeof cleanup === 'function') unmountCurrent = cleanup;
  restoreScroll();
  if(ctx.query.get('pedidos')==='1' && requestsPanel){requestsPanel.open();const clean=new URL(location.href);clean.searchParams.delete('pedidos');history.replaceState(history.state,'',clean.pathname+clean.search);}
  sendActivity();
}

function restoreScroll() {
  const y = history.state?.scrollY;
  window.scrollTo(0, typeof y === 'number' ? y : 0);
}

function sessionStorageSet(k, v) { try { sessionStorage.setItem(k, v); } catch { /* indisponível */ } }

function supportButton(bare = false) {
  return `<a class="support-whatsapp ${bare?'support-whatsapp-bare':''}" href="https://wa.me/5551920048910?text=${encodeURIComponent('Olá! Preciso de ajuda com o KINGDRAMA.')}" target="_blank" rel="noopener noreferrer" aria-label="Falar com o suporte KINGDRAMA no WhatsApp, abre em outra aba" title="Suporte KINGDRAMA · (51) 92004-8910">${icon.whatsapp}<span>Suporte</span></a>`;
}

function shellBare(html) {
  unmountCategoryMenu?.();unmountCategoryMenu=null;
  requestsPanel?.dispose();requestsPanel=null;
  const showSupport=!/^\/assistir\//.test(location.pathname);
  app.innerHTML = `<main id="main" class="no-tabbar ${showSupport?'with-support':''}">${html}</main>${showSupport?supportButton(true):''}`;
  enhance(app);
}

function shell(html, route) {
  unmountCategoryMenu?.();unmountCategoryMenu=null;
  requestsPanel?.dispose();requestsPanel=null;
  const u = state.me?.user;
  const tab = route.tab;
  const cur = (t) => (tab === t ? 'aria-current="page"' : '');
  app.innerHTML = `
  <header class="topbar ${route.overHero ? 'is-over-hero' : ''}">
    <a href="/inicio" class="logo" aria-label="KingDrama — início"><img src="/img/logo.png" alt="" width="300" height="100"></a>
    <nav class="topnav" aria-label="Principal">
      <a href="/inicio" ${cur('inicio')}>Início</a>
      <button type="button" class="category-toggle" data-category-toggle aria-expanded="false" aria-controls="category-menu-panel" ${tab==='categorias'?'data-category-active':''}>Categorias ${icon.chev}</button>
      <a href="/favoritos" ${cur('lista')}>Favoritos</a>
      <button type="button" class="category-toggle" data-requests-toggle aria-haspopup="dialog">Pedir Dorama</button>
    </nav>
    <div class="spacer"></div>
    <form class="top-search" role="search" action="/buscar">
      ${icon.search}<label class="sr-only" for="top-q">Buscar títulos</label>
      <input id="top-q" name="q" type="search" placeholder="Buscar títulos" autocomplete="off" enterkeyhint="search">
    </form>
    <div class="user-menu">
      <button type="button" aria-haspopup="true" aria-expanded="false" aria-label="Menu da conta">
        <span class="avatar">${esc(initials(u))}</span>
      </button>
      <div class="menu-pop" role="menu">
        <div class="who"><strong>${esc(u?.name || 'Minha conta')}</strong><span>${esc(u?.email || '')}</span></div>
        <a role="menuitem" href="/favoritos">${icon.heart} Favoritos</a>
        <a role="menuitem" href="/historico">${icon.clock} Histórico</a>
        <a role="menuitem" href="/perfil">${icon.user} Perfil e assinatura</a>
        <a role="menuitem" href="/indicacoes">${icon.gift} Indique e ganhe dias grátis</a>
        <a role="menuitem" href="/perfil">${icon.lock} Excluir conta</a>
        <button role="menuitem" type="button" class="danger" data-logout>${icon.logout} Sair</button>
      </div>
    </div>
  </header>
  <main id="main" class="with-support" tabindex="-1">${html}</main>
  <nav class="tabbar with-requests" aria-label="Navegação">
    <a href="/inicio" ${cur('inicio')}>${icon.home}<span>Início</span></a>
    <a href="/buscar" ${cur('buscar')}>${icon.search}<span>Buscar</span></a>
    <button type="button" class="category-toggle" data-category-toggle aria-expanded="false" aria-controls="category-menu-panel" ${tab==='categorias'?'data-category-active':''}>${icon.grid}<span>Categorias</span></button>
    <a href="/favoritos" ${cur('lista')}>${icon.heart}<span>Favoritos</span></a>
    <button type="button" class="category-toggle" data-requests-toggle aria-haspopup="dialog">${icon.request}<span>Pedir Dorama</span></button>
    <a href="/perfil" ${cur('perfil')}>${icon.user}<span>Perfil</span></a>
  </nav><nav id="category-menu-panel" class="category-menu-panel" data-category-panel aria-label="Escolher categoria" hidden></nav>${supportButton()}`;
  enhance(app);
  unmountCategoryMenu=mountCategoryMenu(app);
  requestsPanel=mountRequestsPanel(app,{state,navigate});

  const menu = app.querySelector('.user-menu');
  const btn = menu.querySelector('button'), pop = menu.querySelector('.menu-pop');
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const open = pop.classList.toggle('open');
    btn.setAttribute('aria-expanded', String(open));
  });
  const topQ = app.querySelector('#top-q');
  const q = new URLSearchParams(location.search).get('q');
  if (q && location.pathname === '/buscar') topQ.value = q;
  app.querySelector('.top-search').addEventListener('submit', (e) => {
    e.preventDefault();
    navigate(`/buscar?q=${encodeURIComponent(topQ.value.trim())}`);
  });
}

// Topo transparente sobre o destaque, sólido ao rolar.
window.addEventListener('scroll', () => {
  document.querySelector('.topbar.is-over-hero')?.classList.toggle('scrolled', window.scrollY > 40);
}, { passive: true });

document.addEventListener('click', async (e) => {
  if (!e.target.closest('.user-menu')) document.querySelectorAll('.menu-pop.open').forEach((p) => p.classList.remove('open'));
  if (e.target.closest('[data-logout]')) {
    e.preventDefault();
    await clearActivity();
    await api('/api/auth/logout', { method: 'POST' }).catch(() => {});
    await refreshMe();
    navigate('/', { replace: true });
    return;
  }
  const a = e.target.closest('a[href]');
  if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || a.target || a.hasAttribute('download')) return;
  const url = new URL(a.href, location.href);
  if (url.origin !== location.origin || url.pathname.startsWith('/dev/') || url.pathname.startsWith('/api/')) return;
  e.preventDefault();
  if(url.pathname==='/pedidos' && requestsPanel){requestsPanel.open();return;}
  navigate(url.pathname + url.search);
});

window.addEventListener('popstate', render);
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

(async function boot() {
  await confereVersao(true);
  if (saiuVersaoNova) {
    // A versioned navigation also bypasses an HTML response cached before this release.
    const target = new URL(location.href);
    const published = await fetch('/config/versao.json', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).catch(() => null);
    if (published?.versao && target.searchParams.get('_kdv') !== published.versao) {
      target.searchParams.set('_kdv', published.versao);
      location.replace(target.href);
      return;
    }
  } else if (new URL(location.href).searchParams.has('_kdv')) {
    const clean = new URL(location.href); clean.searchParams.delete('_kdv');
    history.replaceState(history.state, '', clean.pathname + clean.search + clean.hash);
  }
  try {
    [state.site] = await Promise.all([api('/api/site'), refreshMe()]);
  } catch {
    app.innerHTML = '<div class="page-loading"><p>Não foi possível conectar. Verifique sua internet e recarregue.</p></div>';
    return;
  }
  render();
})();
