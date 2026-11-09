// ============================================================================
// Camada de dados do KingDrama — ESTRUTURA (sem catálogo e sem servidor).
//
// Hoje: intercepta as chamadas /api/* e responde dentro do próprio navegador,
// para o site rodar em hospedagem estática (Netlify) sem backend.
//   - Banners: lidos de /config/banners.json (edite o arquivo e publique de novo).
//   - Catálogo: VAZIO de propósito. Entra depois, vindo do Supabase.
//   - Conta e "Minha lista": ficam no localStorage de quem está visitando.
//     Isso é só para navegar pelas telas. NÃO é autenticação de verdade:
//     qualquer e-mail entra e qualquer código de 6 dígitos é aceito.
//
// Depois (Supabase + Bunny): troque o corpo de cada rota abaixo por chamadas ao
// Supabase. O resto do site (app.js, pages.js, auth-pages.js) não muda, porque
// só conhece estes endereços /api/*.
//
// ATENÇÃO antes de publicar com conteúdo pago: a URL do vídeo na Bunny tem de
// ser assinada no servidor (Netlify Function / Supabase Edge Function), nunca
// aqui no navegador — senão qualquer pessoa copia o link e assiste fora do site.
// ============================================================================
(function () {
  'use strict';

  const K_USER = 'kd_user';
  const K_FAV = 'kd_favs';
  const K_PENDING = 'kd_pending';

  // ---------------------------------------------------------------- Contas de teste
  // Estes e-mails entram com o acesso JÁ LIBERADO, sem passar pela tela de pagamento.
  // Serve para você percorrer as telas internas rapidamente.
  //
  // Não é um perfil de administrador: não existe painel nem permissão a mais.
  // E não é segredo — este arquivo é público, qualquer pessoa que abrir o
  // inspetor do navegador lê a lista. Enquanto o login for de demonstração isso
  // não muda nada (qualquer e-mail já entra), mas APAGUE esta lista quando o
  // Supabase entrar, senão vira uma porta aberta de verdade.
  const ACESSO_DIRETO = [
    'admin@kingdrama.com',
    'teste@kingdrama.com',
  ];
  const temAcessoDireto = (email) => ACESSO_DIRETO.includes(String(email || '').trim().toLowerCase());

  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* indisponível */ } },
    del(k) { try { localStorage.removeItem(k); } catch { /* indisponível */ } },
  };

  const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  const notFound = () => json(404, { error: 'Não encontrado.' });
  const cleanName = (n) => String(n || '').replace(/\s+/g, ' ').trim().slice(0, 60) || null;
  const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/;

  // ---------------------------------------------------------------- Banners
  let bannersPromise = null;
  function loadBanners() {
    if (!bannersPromise) {
      bannersPromise = fetch('/config/banners.json', { cache: 'no-cache' })
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error('config'))))
        .catch(() => ({ rotationSeconds: 8, recommendedSizes: {}, slots: [] }));
    }
    return bannersPromise;
  }

  async function site() {
    const b = await loadBanners();
    return {
      checkoutConfigured: true,
      catalogReady: false, // vira true quando o catálogo entrar
      banners: {
        rotationSeconds: b.rotationSeconds || 8,
        showPlaceholderGuide: false,
        guide: b.recommendedSizes || {},
        slots: (b.slots || []).filter((s) => s.active && s.image && s.image.mobile && s.image.desktop),
      },
    };
  }

  // ---------------------------------------------------------------- Sessão
  function me() {
    const u = store.get(K_USER, null);
    if (!u) return { user: null };
    const liberado = u.active || temAcessoDireto(u.email);
    const access = liberado
      ? { status: 'active', active: true, planCode: null, periodEnd: null, updatedAt: u.createdAt }
      : { status: 'pending', active: false, planCode: null, periodEnd: null, updatedAt: u.createdAt };
    return { user: { id: 1, email: u.email, name: u.name, createdAt: u.createdAt }, access };
  }

  function guard(needActive) {
    const m = me();
    if (!m.user) return json(401, { error: 'Entre na sua conta para continuar.', code: 'unauthenticated' });
    if (needActive && !m.access.active) return json(403, { error: 'Seu acesso ainda não foi liberado.', code: 'access_pending', access: m.access });
    return null;
  }

  const favs = () => store.get(K_FAV, []);

  // ---------------------------------------------------------------- Rotas
  async function handle(method, url, body) {
    const p = url.pathname;

    if (method === 'GET' && p === '/api/site') return json(200, await site());
    if (method === 'GET' && p === '/api/me') return json(200, me());

    // Vitrine da página de visitante: enquanto não há catálogo, usa os banners.
    if (method === 'GET' && p === '/api/showcase') {
      const s = await site();
      return json(200, { total: 0, titles: [], posters: s.banners.slots.map((x) => x.image.mobile) });
    }

    // --- Entrada (demonstração): qualquer código de 6 dígitos é aceito.
    if (method === 'POST' && p === '/api/auth/start') {
      const email = String(body.email || '').trim().toLowerCase();
      if (!EMAIL_RE.test(email)) return json(400, { error: 'Informe um e-mail válido.' });
      if (body.mode === 'signup' && body.acceptTerms !== true) return json(400, { error: 'Aceite os termos para criar a conta.' });
      store.set(K_PENDING, { email, name: cleanName(body.name) });
      return json(200, { ok: true, message: 'Esta é a versão de estrutura: digite qualquer código de 6 dígitos para entrar.' });
    }
    if (method === 'POST' && p === '/api/auth/verify') {
      const email = String(body.email || '').trim().toLowerCase();
      if (String(body.code || '').replace(/\D/g, '').length !== 6) return json(400, { error: 'Digite os 6 dígitos do código.' });
      const prev = store.get(K_USER, null);
      const pending = store.get(K_PENDING, {});
      const base = prev && prev.email === email
        ? prev
        : { email, name: pending.name || null, active: false, createdAt: new Date().toISOString() };
      if (temAcessoDireto(email)) { base.active = true; base.name = base.name || 'Administrador'; }
      store.set(K_USER, base);
      store.del(K_PENDING);
      return json(200, { ok: true });
    }
    if (method === 'POST' && p === '/api/auth/link') return json(400, { error: 'Este link já foi usado ou expirou. Peça um novo acesso.' });
    if (method === 'POST' && p === '/api/auth/logout') { store.del(K_USER); return json(200, { ok: true }); }
    if (method === 'PATCH' && p === '/api/me') {
      const g = guard(false); if (g) return g;
      store.set(K_USER, { ...store.get(K_USER, {}), name: cleanName(body.name) });
      return json(200, { ok: true });
    }

    // --- Pagamento simulado: libera o acesso para dar para ver as telas internas.
    if (method === 'POST' && p === '/api/checkout') {
      const g = guard(false); if (g) return g;
      store.set(K_USER, { ...store.get(K_USER, {}), active: true });
      return json(200, { url: '/pagamento/retorno' });
    }

    if (!p.startsWith('/api/')) return notFound();
    const g = guard(true); if (g) return g;

    // --- Catálogo: vazio por enquanto (entra pelo Supabase).
    if (method === 'GET' && p === '/api/home') return json(200, { hero: [], rows: [], total: 0 });
    if (method === 'GET' && p === '/api/titles') return json(200, { titles: [] });
    if (method === 'GET' && p === '/api/search') return json(200, { titles: [] });
    if (method === 'GET' && p === '/api/categories') return json(200, { categories: [] });
    if (method === 'GET' && /^\/api\/titles\/[\w-]+$/.test(p)) return json(404, { error: 'Título não encontrado.' });
    if (method === 'GET' && p === '/api/favorites') return json(200, { titles: [] });
    if (/^\/api\/favorites\/[\w-]+$/.test(p)) return json(404, { error: 'Título não encontrado.' });
    if (method === 'GET' && p === '/api/history') return json(200, { items: [] });
    if (method === 'POST' && p === '/api/play/progress') return json(200, { ok: true });
    if (p.startsWith('/api/play/')) return json(404, { error: 'Episódio não disponível.' });

    return notFound();
  }

  const realFetch = window.fetch.bind(window);
  window.fetch = async function (input, init = {}) {
    const url = new URL(typeof input === 'string' ? input : input.url, location.href);
    if (url.origin !== location.origin || !url.pathname.startsWith('/api/')) return realFetch(input, init);
    let body = {};
    try { body = init.body ? JSON.parse(init.body) : {}; } catch { /* sem corpo */ }
    await new Promise((r) => setTimeout(r, 80)); // imita a ida ao servidor
    try {
      return await handle(String(init.method || 'GET').toUpperCase(), url, body);
    } catch (e) {
      return json(500, { error: e.message || 'Erro inesperado.' });
    }
  };

  window.__KD__ = { version: 'estrutura-1.0', catalogReady: false, favs };
})();
