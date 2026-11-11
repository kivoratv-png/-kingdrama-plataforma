// ============================================================================
// KingDrama — libera a reprodução de um episódio.
//
// Esta é a única parte do sistema que conhece o ID do vídeo na Bunny e a chave
// que assina o acesso. Ela roda no servidor da Netlify; o navegador só recebe
// a URL já assinada, com validade curta.
//
// O que ela faz, em ordem:
//   1. confere se quem pede está logado de verdade (valida o token no Supabase);
//   2. confere se a assinatura dessa pessoa está ativa;
//   3. só então busca o bunny_video_id (com a chave de serviço) e assina a URL.
//
// Qualquer passo que falhe devolve erro sem revelar nada sobre o vídeo.
//
// Variáveis de ambiente necessárias (Netlify > Environment variables):
//   SUPABASE_URL               https://xxxx.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY  chave de serviço (NUNCA no código nem no site)
//   BUNNY_TOKEN_KEY            Token Authentication Key da biblioteca
//                              (Stream > sua biblioteca > Security)
//   BUNNY_LIBRARY_ID           opcional; o padrão vem do banco
//   EMBED_TTL_SECONDS          opcional; validade do link, padrão 10800 (3h)
// ============================================================================
'use strict';

const crypto = require('node:crypto');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUNNY_TOKEN_KEY = process.env.BUNNY_TOKEN_KEY;
const BUNNY_LIBRARY_ID = process.env.BUNNY_LIBRARY_ID || '';
// Precisa cobrir o filme inteiro: o link é validado quando o player abre, mas
// uma pausa longa não pode deixar o espectador na mão. 3h cobre os mais longos.
const TTL = Number(process.env.EMBED_TTL_SECONDS) || 10800;

const json = (status, body) => ({
  statusCode: status,
  headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  body: JSON.stringify(body),
});

// Consulta a API do Supabase com a chave de serviço (ignora o RLS de propósito:
// a permissão já foi conferida antes de chegar aqui).
async function comoServico(caminho) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${caminho}`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, Accept: 'application/json' },
  });
  if (!r.ok) throw new Error(`supabase ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return r.json();
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') return json(405, { error: 'Método não permitido.' });

  if (!SUPABASE_URL || !SERVICE_KEY || !BUNNY_TOKEN_KEY) {
    console.error('play: faltam variáveis de ambiente');
    return json(500, { error: 'Reprodução indisponível no momento.' });
  }

  const titleId = String(event.queryStringParameters?.title || '').trim();
  const numero = parseInt(event.queryStringParameters?.number, 10);
  if (!/^[\w-]{1,120}$/.test(titleId) || !Number.isInteger(numero) || numero < 1) {
    return json(400, { error: 'Pedido inválido.' });
  }

  // ---- 1. Quem está pedindo?
  const auth = event.headers.authorization || event.headers.Authorization || '';
  const jwt = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!jwt) return json(401, { error: 'Entre na sua conta para assistir.', code: 'unauthenticated' });

  let userId;
  try {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${jwt}` },
    });
    if (!r.ok) return json(401, { error: 'Sua sessão expirou. Entre de novo.', code: 'unauthenticated' });
    userId = (await r.json()).id;
    if (!userId) throw new Error('sem id');
  } catch (e) {
    console.error('play/auth', e.message);
    return json(401, { error: 'Sua sessão expirou. Entre de novo.', code: 'unauthenticated' });
  }

  try {
    // ---- 2. A assinatura está ativa?
    const sessionCheck = await fetch(`${SUPABASE_URL}/rest/v1/rpc/account_session_allowed`, {
      method: 'POST', headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' },
      body: '{}', signal: AbortSignal.timeout(8000),
    });
    if (!sessionCheck.ok) return json(503, { error: 'Não foi possível validar o dispositivo.' });
    if ((await sessionCheck.json()) !== true) return json(403, {
      error: 'Limite de dispositivos atingido ou sessão desconectada. Gerencie seus dispositivos no Perfil.', code: 'device_limit',
    });
    const assinaturas = await comoServico(
      `subscriptions?select=status,ends_at&user_id=eq.${encodeURIComponent(userId)}&status=eq.active&limit=5`
    );
    const agora = Date.now();
    const liberado = assinaturas.some((s) => !s.ends_at || new Date(s.ends_at).getTime() > agora);
    if (!liberado) {
      return json(403, { error: 'Seu acesso ainda não foi liberado.', code: 'access_pending' });
    }

    // ---- 3. Qual é o vídeo?
    const eps = await comoServico(
      `episodes?select=id,number,name,title_id,published,titles!inner(id,name,cover,published)` +
      `&title_id=eq.${encodeURIComponent(titleId)}&number=eq.${numero}&published=is.true&limit=1`
    );
    const ep = eps[0];
    if (!ep || !ep.titles?.published) return json(404, { error: 'Episódio não disponível.' });

    const fontes = await comoServico(
      `episode_sources?select=bunny_video_id,bunny_library_id&episode_id=eq.${ep.id}&limit=1`
    );
    const fonte = fontes[0];
    if (!fonte?.bunny_video_id) return json(404, { error: 'Episódio ainda não disponível.' });

    const biblioteca = fonte.bunny_library_id || BUNNY_LIBRARY_ID;
    if (!biblioteca) {
      console.error('play: biblioteca da Bunny não definida para o episódio', ep.id);
      return json(500, { error: 'Reprodução indisponível no momento.' });
    }

    // ---- 4. Assina o acesso
    // Fórmula da Bunny: SHA256 em hexadecimal de (chave + id do vídeo + expiração).
    const expira = Math.floor(Date.now() / 1000) + TTL;
    const token = crypto
      .createHash('sha256')
      .update(BUNNY_TOKEN_KEY + fonte.bunny_video_id + expira)
      .digest('hex');
    // ATENÇÃO ao domínio: player.mediadelivery.net exige o token (sem ele, 403).
    // O antigo iframe.mediadelivery.net aceita qualquer coisa, inclusive nenhum
    // token — usá-lo deixaria a proteção só na aparência. Verificado na prática.
    const embedUrl =
      `https://player.mediadelivery.net/embed/${encodeURIComponent(biblioteca)}/` +
      `${encodeURIComponent(fonte.bunny_video_id)}?token=${token}&expires=${expira}` +
      `&autoplay=true&preload=true`;

    // Episódios vizinhos, para os botões de navegação
    const irmaos = await comoServico(
      `episodes?select=number&title_id=eq.${encodeURIComponent(titleId)}&published=is.true&order=number`
    );
    const numeros = irmaos.map((e) => e.number);
    const pos = numeros.indexOf(numero);

    return json(200, {
      episode: {
        number: ep.number,
        name: ep.name || null,
        titleId: ep.titles.id,
        titleName: ep.titles.name,
        cover: ep.titles.cover,
      },
      embedUrl,
      expiresAt: expira,
      prev: pos > 0 ? numeros[pos - 1] : null,
      next: pos >= 0 && pos < numeros.length - 1 ? numeros[pos + 1] : null,
    });
  } catch (e) {
    console.error('play', e.message);
    return json(500, { error: 'Não foi possível abrir o episódio. Tente de novo.' });
  }
};
