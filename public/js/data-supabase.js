// ============================================================================
// KingDrama — camada de dados ligada ao Supabase.
//
// Substitui o data.js de demonstração. Continua respondendo às mesmas chamadas
// /api/*, então app.js, pages.js e auth-pages.js não precisam saber que o banco
// mudou — eles só conhecem esses endereços.
//
// O que é real agora: conta, senha, sessão, catálogo, minha lista e progresso.
// O que ainda não é: o vídeo. A URL da Bunny precisa ser assinada no servidor
// (ver /api/play no fim do arquivo).
// ============================================================================
(function () {
  'use strict';

  const CFG = window.__KD_CONFIG__ || {};
  if (!window.supabase || !CFG.supabaseUrl || !CFG.supabaseAnonKey) {
    console.error('KingDrama: configuração do Supabase ausente (js/config.js).');
    return;
  }

  const sb = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });
  window.__KD_SB__ = sb;

  const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  const naoEncontrado = () => json(404, { error: 'Não encontrado.' });
  const limpaNome = (n) => String(n || '').replace(/\s+/g, ' ').trim().slice(0, 60) || null;

  // Mensagens do Supabase vêm em inglês; traduz as mais comuns.
  function traduzErro(e) {
    const m = String(e?.message || e || '');
    if (/Invalid login credentials/i.test(m)) return 'E-mail ou senha incorretos.';
    if (/Email not confirmed/i.test(m)) return 'Confirme seu e-mail antes de entrar.';
    if (/User already registered/i.test(m)) return 'Já existe uma conta com este e-mail. Tente entrar.';
    if (/Password should be at least/i.test(m)) return 'A senha precisa ter pelo menos 6 caracteres.';
    if (/rate limit|too many/i.test(m)) return 'Muitas tentativas. Espere um minuto e tente de novo.';
    if (/Unable to validate email/i.test(m)) return 'Informe um e-mail válido.';
    if (/Failed to fetch|NetworkError/i.test(m)) return 'Sem conexão com o servidor. Verifique sua internet.';
    return m || 'Não foi possível concluir. Tente de novo.';
  }

  // ------------------------------------------------------- Cache de leitura
  // Antes, cada clique no menu repetia as consultas de perfil e assinatura, e a
  // página de título pedia o catálogo três vezes e os episódios duas na mesma
  // renderização. Em 4G isso custava de 600ms a 1,1s por navegação.
  //
  // O cache guarda a PROMESSA, não só o valor pronto: duas chamadas à mesma
  // consulta ao mesmo tempo compartilham uma única ida ao servidor (é isso que
  // mata as repetições dentro de uma mesma tela).
  //
  // Isto é só velocidade, não permissão. Quem decide o que cada pessoa pode ler
  // é o RLS do Postgres, em toda consulta: episódios exigem has_access() e
  // episode_sources não é legível por ninguém além do servidor. Guardar a
  // resposta no navegador não libera nada que o banco já não tivesse liberado.
  const TTL = { sessao: 30000, catalogo: 120000, usuario: 20000 };
  const cache = new Map();

  function comCache(chave, ttl, produz) {
    const guardado = cache.get(chave);
    if (guardado && Date.now() - guardado.nascido < ttl) return guardado.promessa;
    // Erro não fica guardado: a próxima tentativa vai ao servidor de novo.
    const promessa = produz().catch((e) => { cache.delete(chave); throw e; });
    cache.set(chave, { promessa, nascido: Date.now() });
    return promessa;
  }

  // Sem prefixo, esquece tudo (troca de conta). Com prefixo, só aquele grupo.
  function invalida(prefixo) {
    if (!prefixo) return cache.clear();
    for (const k of [...cache.keys()]) if (k.startsWith(prefixo)) cache.delete(k);
  }

  // Nada do usuário anterior pode sobrar quando se troca de conta. Mas o
  // Supabase avisa a cada mudança de estado da sessão, e a maioria desses
  // avisos não é troca de pessoa nenhuma:
  //   INITIAL_SESSION  - a sessão sendo relida do localStorage na abertura;
  //   TOKEN_REFRESHED  - o mesmo usuário renovando o token.
  // Limpar nesses casos apagava o cache recém-preenchido no meio do próprio
  // carregamento da página, e tudo era consultado duas vezes.
  //
  // O critério certo é a identidade: só limpa quando o dono da sessão muda.
  // Não dá para confiar no NOME do evento para saber se a página está abrindo:
  // ao restaurar uma sessão salva, o SDK emite SIGNED_IN *antes* de
  // INITIAL_SESSION (verificado no site publicado). Quem esperasse o
  // INITIAL_SESSION como primeiro aviso trataria aquele SIGNED_IN como login
  // de outra pessoa e limparia o cache no meio do carregamento.
  //
  // O que vale é a ordem: a primeira notificação de uma aba é sempre a sessão
  // dela sendo restaurada. A memória nasceu junto com a aba, não existe dado
  // de outra conta para vazar. Dali em diante, o critério é a identidade.
  let donoDaSessao = null;
  let primeiroAviso = true;
  sb.auth.onAuthStateChange((evento, sessao) => {
    const id = sessao?.user?.id || null;
    if (evento === 'TOKEN_REFRESHED') return; // mesma pessoa, token novo
    if (primeiroAviso) { primeiroAviso = false; donoDaSessao = id; return; }
    if (evento === 'USER_UPDATED') { invalida('sessao'); return; }
    if (id !== donoDaSessao) { donoDaSessao = id; invalida(); } // trocou ou saiu
  });

  // ---------------------------------------------------------------- Banners
  let bannersPromise = null;
  // Sem 'no-cache' de propósito: o _headers já manda revalidar /config/* a
  // cada visita, e forçar aqui faria o navegador ignorar o preload do
  // index.html e buscar o arquivo uma segunda vez.
  const carregaBanners = () => (bannersPromise ||= fetch('/config/banners.json')
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error('config'))))
    .catch(() => ({ rotationSeconds: 8, recommendedSizes: {}, slots: [] })));

  // ---------------------------------------------------------------- Sessão
  async function usuarioAtual() {
    const { data } = await sb.auth.getSession();
    return data?.session?.user || null;
  }

  // Perfil + assinatura: pedido por toda página protegida, muda muito pouco.
  const montaMe = () => comCache('sessao', TTL.sessao, montaMeAgora);

  async function montaMeAgora() {
    const user = await usuarioAtual();
    if (!user) return { user: null };

    const [{ data: perfil }, { data: assinatura }] = await Promise.all([
      sb.from('profiles').select('name, created_at').eq('id', user.id).maybeSingle(),
      sb.from('subscriptions').select('status, plan, ends_at, updated_at')
        .eq('user_id', user.id).order('updated_at', { ascending: false }).limit(1).maybeSingle(),
    ]);

    const ativa = Boolean(
      assinatura && assinatura.status === 'active' &&
      (!assinatura.ends_at || new Date(assinatura.ends_at) > new Date())
    );

    return {
      user: {
        id: user.id,
        email: user.email,
        name: perfil?.name || user.user_metadata?.name || null,
        createdAt: perfil?.created_at || user.created_at,
      },
      access: {
        status: assinatura?.status || 'pending',
        active: ativa,
        planCode: assinatura?.plan || null,
        periodEnd: assinatura?.ends_at || null,
        updatedAt: assinatura?.updated_at || null,
      },
    };
  }

  async function exigeLogin(precisaAcesso) {
    const me = await montaMe();
    if (!me.user) return { erro: json(401, { error: 'Entre na sua conta para continuar.', code: 'unauthenticated' }), me };
    if (precisaAcesso && !me.access.active) {
      return { erro: json(403, { error: 'Seu acesso ainda não foi liberado.', code: 'access_pending', access: me.access }), me };
    }
    return { erro: null, me };
  }

  // ---------------------------------------------------------------- Catálogo
  const paraCard = (t) => ({ id: t.id, name: t.name, cover: t.cover, episodes: t.episodes_count || 0 });

  // O catálogo inteiro cabe em uma consulta e serve a home, as categorias e os
  // "parecidos" da página de título. Filtrar por categoria é trabalho local
  // sobre a lista que já está em mãos — não precisa de outra ida ao banco.
  function buscaTitulos({ categoria = null, busca = null, limite = 500 } = {}) {
    // Busca por texto muda a cada letra digitada: essa não entra no cache.
    if (busca) return consultaTitulos({ busca, limite });
    return comCache(`catalogo:titulos:${limite}`, TTL.catalogo, () => consultaTitulos({ limite }))
      .then((lista) => (categoria ? lista.filter((t) => t.categories.includes(categoria)) : lista));
  }

  async function consultaTitulos({ busca = null, limite = 500 } = {}) {
    let q = sb.from('titles').select('id, name, cover, synopsis, title_categories(category_id)')
      .eq('published', true).order('name');
    if (busca) q = q.ilike('name', `%${busca}%`);
    q = q.limit(limite);
    const { data, error } = await q;
    if (error) throw error;
    return (data || []).map((t) => ({
      ...t,
      categories: (t.title_categories || []).map((c) => c.category_id),
    }));
  }

  const listaCategorias = () => comCache('catalogo:categorias', TTL.catalogo, consultaCategorias);

  async function consultaCategorias() {
    const [{ data: cats, error: e1 }, { data: vinculos, error: e2 }] = await Promise.all([
      sb.from('categories').select('id, name, position').order('position').order('name'),
      sb.from('title_categories').select('category_id, title_id'),
    ]);
    if (e1) throw e1;
    if (e2) throw e2;
    const contagem = new Map();
    for (const v of vinculos || []) contagem.set(v.category_id, (contagem.get(v.category_id) || 0) + 1);
    return (cats || [])
      .map((c) => ({ id: c.id, name: c.name, count: contagem.get(c.id) || 0, cover: null }))
      .filter((c) => c.count > 0);
  }

  const idsFavoritos = () => comCache('usuario:favoritos', TTL.usuario, async () => {
    const { data } = await sb.from('favorites').select('title_id').order('created_at', { ascending: false });
    return (data || []).map((f) => f.title_id);
  });

  // Lista de episódios de um título. O RLS continua exigindo assinatura ativa
  // aqui: sem acesso, o Postgres devolve vazio, e vazio não fica em cache.
  const episodiosDe = (id) => comCache(`catalogo:episodios:${id}`, TTL.catalogo, async () => {
    const { data, error } = await sb.from('episodes')
      .select('number, name, duration_s').eq('title_id', id).eq('published', true).order('number');
    if (error) throw error;
    const lista = data || [];
    // Vazio aqui pode ser falta de acesso (o RLS filtra sem reclamar), não um
    // título sem episódios. Não vale guardar: se o acesso for liberado agora,
    // a próxima visita já encontra a lista certa.
    if (!lista.length) invalida(`catalogo:episodios:${id}`);
    return lista;
  });

  const historico = () => comCache('usuario:historico', TTL.usuario, async () => {
    const { data } = await sb.from('watch_progress')
      .select('position_s, updated_at, episodes(number, title_id, titles(id, name, cover))')
      .order('updated_at', { ascending: false }).limit(30);
    return (data || []).filter((r) => r.episodes?.titles).map((r) => ({
      id: r.episodes.titles.id,
      name: r.episodes.titles.name,
      cover: r.episodes.titles.cover,
      number: r.episodes.number,
      position: r.position_s,
      updatedAt: r.updated_at,
    }));
  });

  const detalheTitulo = (id) => comCache(`catalogo:titulo:${id}`, TTL.catalogo, async () => {
    const { data, error } = await sb.from('titles')
      .select('id, name, cover, synopsis, title_categories(category_id, categories(id, name))')
      .eq('id', id).eq('published', true).maybeSingle();
    if (error) throw error;
    // Não guarda "não existe": o título pode ser publicado logo depois.
    if (!data) invalida(`catalogo:titulo:${id}`);
    return data;
  });

  // ---------------------------------------------------------------- Rotas
  async function trata(metodo, url, corpo) {
    const p = url.pathname;
    let m;

    // ---- Configuração do site
    if (metodo === 'GET' && p === '/api/site') {
      const b = await carregaBanners();
      return json(200, {
        checkoutConfigured: true,
        catalogReady: true,
        banners: {
          rotationSeconds: b.rotationSeconds || 8,
          showPlaceholderGuide: false,
          guide: b.recommendedSizes || {},
          slots: (b.slots || []).filter((s) => s.active && s.image && s.image.mobile && s.image.desktop),
        },
      });
    }

    if (metodo === 'GET' && p === '/api/me') return json(200, await montaMe());

    // ---- Vitrine da página de visitante (sem login)
    if (metodo === 'GET' && p === '/api/showcase') {
      const b = await carregaBanners();
      // O mural da tela de visitante mostra essas imagens a 150x200. Usa as
      // miniaturas: a versão cheia baixava mais de 1 MB na primeira tela que
      // o visitante vê — justamente onde se decide se ele fica ou desiste.
      const posters = (b.slots || []).filter((s) => s.active).map((s) => s.thumb || s.image.mobile);
      return json(200, { total: 0, titles: [], posters });
    }

    // ---- Criar conta
    if (metodo === 'POST' && p === '/api/auth/signup') {
      const email = String(corpo.email || '').trim().toLowerCase();
      const senha = String(corpo.password || '');
      if (corpo.acceptTerms !== true) return json(400, { error: 'Aceite os termos para criar a conta.' });
      if (senha.length < 8) return json(400, { error: 'A senha precisa ter pelo menos 8 caracteres.' });
      const { data, error } = await sb.auth.signUp({
        email, password: senha,
        options: { data: { name: limpaNome(corpo.name) } },
      });
      if (error) return json(400, { error: traduzErro(error) });
      // Sem sessão = o projeto está exigindo confirmação de e-mail.
      if (!data.session) return json(200, { ok: true, needsEmailConfirm: true });
      return json(200, { ok: true });
    }

    // ---- Entrar
    if (metodo === 'POST' && p === '/api/auth/login') {
      const email = String(corpo.email || '').trim().toLowerCase();
      const senha = String(corpo.password || '');
      if (!senha) return json(400, { error: 'Digite sua senha.' });
      const { error } = await sb.auth.signInWithPassword({ email, password: senha });
      if (error) return json(401, { error: traduzErro(error) });
      return json(200, { ok: true });
    }

    // ---- Esqueci a senha
    if (metodo === 'POST' && p === '/api/auth/recover') {
      const email = String(corpo.email || '').trim().toLowerCase();
      await sb.auth.resetPasswordForEmail(email, { redirectTo: `${location.origin}/nova-senha` });
      // Resposta igual para e-mail existente ou não: não revela quem tem conta.
      return json(200, { ok: true, message: 'Se houver uma conta com este e-mail, enviamos o link para criar uma nova senha.' });
    }

    // ---- Definir nova senha (depois do link do e-mail)
    if (metodo === 'POST' && p === '/api/auth/password') {
      const senha = String(corpo.password || '');
      if (senha.length < 8) return json(400, { error: 'A senha precisa ter pelo menos 8 caracteres.' });
      const { error } = await sb.auth.updateUser({ password: senha });
      if (error) return json(400, { error: traduzErro(error) });
      return json(200, { ok: true });
    }

    if (metodo === 'POST' && p === '/api/auth/logout') {
      await sb.auth.signOut();
      return json(200, { ok: true });
    }

    if (metodo === 'PATCH' && p === '/api/me') {
      const { erro, me } = await exigeLogin(false);
      if (erro) return erro;
      const nome = limpaNome(corpo.name);
      const { error } = await sb.from('profiles').update({ name: nome }).eq('id', me.user.id);
      if (error) return json(400, { error: traduzErro(error) });
      invalida('sessao'); // o nome mudou: a próxima leitura busca o novo
      return json(200, { ok: true });
    }

    // ---- Checkout (ainda sem gateway): não libera nada por conta própria.
    if (metodo === 'POST' && p === '/api/checkout') {
      const { erro } = await exigeLogin(false);
      if (erro) return erro;
      return json(503, { error: 'O pagamento ainda não está ligado. Fale com o suporte para liberar seu acesso.' });
    }

    if (!p.startsWith('/api/')) return naoEncontrado();

    // ---- Daqui para baixo, só com acesso liberado
    const { erro, me } = await exigeLogin(true);
    if (erro) return erro;

    if (metodo === 'GET' && p === '/api/home') {
      const [titulos, cats, favs] = await Promise.all([buscaTitulos(), listaCategorias(), idsFavoritos()]);
      const porId = new Map(titulos.map((t) => [t.id, t]));
      const rows = [];
      const destaques = titulos.slice(0, 20);
      if (destaques.length) rows.push({ id: 'destaques', title: 'Em destaque', titles: destaques.map(paraCard) });
      if (favs.length) {
        const lista = favs.map((id) => porId.get(id)).filter(Boolean);
        if (lista.length) rows.push({ id: 'minha-lista', title: 'Minha lista', link: '/minha-lista', titles: lista.slice(0, 30).map(paraCard) });
      }
      for (const c of cats) {
        const lista = titulos.filter((t) => t.categories.includes(c.id)).slice(0, 20);
        if (lista.length) rows.push({ id: `cat-${c.id}`, title: c.name, link: `/categoria/${c.id}`, titles: lista.map(paraCard) });
      }
      return json(200, { hero: destaques.slice(0, 8).map(paraCard), rows, total: titulos.length });
    }

    if (metodo === 'GET' && p === '/api/titles') {
      const lista = await buscaTitulos({ categoria: url.searchParams.get('category') });
      return json(200, { titles: lista.map(paraCard) });
    }

    if (metodo === 'GET' && p === '/api/search') {
      const q = String(url.searchParams.get('q') || '').trim().slice(0, 80);
      if (q.length < 2) return json(200, { titles: [] });
      const lista = await buscaTitulos({ busca: q, limite: 120 });
      return json(200, { titles: lista.map(paraCard) });
    }

    if (metodo === 'GET' && p === '/api/categories') return json(200, { categories: await listaCategorias() });

    if (metodo === 'GET' && (m = p.match(/^\/api\/titles\/([\w-]+)$/))) {
      const id = m[1];
      // As quatro consultas não dependem uma da outra: vão juntas. Antes o
      // título era esperado sozinho e só depois começavam as outras três —
      // uma ida e volta inteira de atraso, por nada.
      const [t, eps, favs, relacionados] = await Promise.all([
        detalheTitulo(id), episodiosDe(id), idsFavoritos(), buscaTitulos(),
      ]);
      if (!t) return json(404, { error: 'Título não encontrado.' });

      const categorias = (t.title_categories || []).map((c) => c.categories).filter(Boolean);
      const idsCats = categorias.map((c) => c.id);
      const parecidos = relacionados
        .filter((o) => o.id !== id && o.categories.some((c) => idsCats.includes(c)))
        .slice(0, 18);

      return json(200, {
        title: {
          id: t.id, name: t.name, cover: t.cover, synopsis: t.synopsis || null,
          categories: categorias,
          episodes: (eps || []).map((e) => ({ number: e.number, name: e.name, duration: e.duration_s })),
          favorite: favs.includes(t.id),
        },
        related: parecidos.map(paraCard),
      });
    }

    if (metodo === 'GET' && p === '/api/favorites') {
      const ids = await idsFavoritos();
      if (!ids.length) return json(200, { titles: [] });
      const { data } = await sb.from('titles').select('id, name, cover').in('id', ids).eq('published', true);
      const porId = new Map((data || []).map((t) => [t.id, t]));
      return json(200, { titles: ids.map((id) => porId.get(id)).filter(Boolean).map(paraCard) });
    }

    if ((m = p.match(/^\/api\/favorites\/([\w-]+)$/))) {
      const id = m[1];
      // A lista de favoritos e o coração da página de título saem do cache:
      // favoritar tem de aparecer na hora, não daqui a 20 segundos.
      if (metodo === 'PUT') {
        const { error } = await sb.from('favorites').upsert({ user_id: me.user.id, title_id: id });
        if (error) return json(400, { error: traduzErro(error) });
        invalida('usuario:favoritos');
        return json(200, { ok: true, favorite: true });
      }
      if (metodo === 'DELETE') {
        const { error } = await sb.from('favorites').delete().eq('user_id', me.user.id).eq('title_id', id);
        if (error) return json(400, { error: traduzErro(error) });
        invalida('usuario:favoritos');
        return json(200, { ok: true, favorite: false });
      }
    }

    if (metodo === 'GET' && p === '/api/history') {
      return json(200, { items: await historico() });
    }

    if (metodo === 'POST' && p === '/api/play/progress') {
      const { titleId, number, position } = corpo || {};
      const { data: ep } = await sb.from('episodes').select('id').eq('title_id', titleId).eq('number', number).maybeSingle();
      if (!ep) return json(404, { error: 'Episódio não encontrado.' });
      await sb.from('watch_progress').upsert({
        user_id: me.user.id, episode_id: ep.id,
        position_s: Math.max(0, Math.floor(Number(position) || 0)), updated_at: new Date().toISOString(),
      });
      invalida('usuario:historico'); // avançou no episódio: o histórico mudou
      return json(200, { ok: true });
    }


    // ---- Reprodução do vídeo
    // Quem decide é a função no servidor (netlify/functions/play.js): ela confere
    // a assinatura e devolve a URL já assinada. Aqui só repassamos o pedido com o
    // token da sessão. O bunny_video_id nunca chega ao navegador.
    if (metodo === 'GET' && (m = p.match(/^\/api\/play\/([\w-]+)\/(\d+)$/))) {
      const { data } = await sb.auth.getSession();
      const jwt = data?.session?.access_token;
      if (!jwt) return json(401, { error: 'Entre na sua conta para assistir.', code: 'unauthenticated' });
      const r = await fetchOriginal(
        `/.netlify/functions/play?title=${encodeURIComponent(m[1])}&number=${encodeURIComponent(m[2])}`,
        { headers: { Authorization: `Bearer ${jwt}` } }
      );
      const corpoResposta = await r.text();
      return new Response(corpoResposta, { status: r.status, headers: { 'Content-Type': 'application/json' } });
    }
    if (p.startsWith('/api/play/')) return naoEncontrado();

    return naoEncontrado();
  }

  const fetchOriginal = window.fetch.bind(window);
  window.fetch = async function (input, init = {}) {
    const url = new URL(typeof input === 'string' ? input : input.url, location.href);
    if (url.origin !== location.origin || !url.pathname.startsWith('/api/')) return fetchOriginal(input, init);
    let corpo = {};
    try { corpo = init.body ? JSON.parse(init.body) : {}; } catch { /* sem corpo */ }
    try {
      return await trata(String(init.method || 'GET').toUpperCase(), url, corpo);
    } catch (e) {
      console.error('KingDrama/api', url.pathname, e);
      return json(500, { error: traduzErro(e) });
    }
  };

  // Pré-aquecimento. Quem já tem sessão salva quase sempre cai na home, e a
  // home precisa do catálogo. Disparando aqui, essa consulta corre junto com a
  // verificação da sessão em vez de esperar por ela: some uma ida e volta
  // inteira da abertura do site. Só para quem tem sessão — sem ela o RLS
  // devolveria vazio, e vazio em cache seria pior que lento.
  sb.auth.getSession().then(({ data }) => {
    if (!data?.session) return;
    buscaTitulos().catch(() => {});
    listaCategorias().catch(() => {});
    idsFavoritos().catch(() => {}); // a home marca os corações com isto
  }).catch(() => {});

  window.__KD__ = { version: 'supabase-1.0', catalogReady: true };
})();
