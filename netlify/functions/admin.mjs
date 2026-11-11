const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'private, no-store, max-age=0',
  'X-Content-Type-Options': 'nosniff',
  'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
  'Referrer-Policy': 'no-referrer',
  Vary: 'Authorization',
};

const reply = (status, body) => new Response(JSON.stringify(body), {
  status,
  headers: JSON_HEADERS,
});

export default async function admin(request) {
  if (request.method !== 'GET') return reply(405, { error: 'Método não permitido.' });
  const url = new URL(request.url);
  const origin = request.headers.get('origin');
  if ((origin && origin !== url.origin) || request.headers.get('sec-fetch-site') === 'cross-site') {
    return reply(403, { error: 'Origem não permitida.' });
  }
  const authorization = request.headers.get('authorization') || '';
  if (authorization.length > 8192 || !/^Bearer [A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(authorization)) {
    return reply(401, { error: 'Entre na sua conta para continuar.' });
  }
  const base = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) return reply(503, { error: 'Painel temporariamente indisponível.' });
  const headers = { apikey: key, Authorization: authorization, 'Content-Type': 'application/json' };
  try {
    const userResponse = await fetch(`${base}/auth/v1/user`, {
      headers, redirect: 'error', signal: AbortSignal.timeout(8000),
    });
    if (!userResponse.ok) {
      return reply(userResponse.status >= 500 ? 503 : 401, { error: 'Não foi possível validar a sessão. Entre novamente.' });
    }
    const user = await userResponse.json();
    if (!user.id || !user.email_confirmed_at) return reply(403, { error: 'Acesso restrito à administração.' });

    // Forward the user's verified JWT. The database independently checks the
    // administrator registry and AAL2 before returning administrative data.
    const statusResponse = await fetch(`${base}/rest/v1/rpc/platform_admin_status`, {
      method: 'POST', headers, body: '{}', redirect: 'error', signal: AbortSignal.timeout(8000),
    });
    if (!statusResponse.ok) return reply(503, { error: 'Não foi possível conferir a permissão.' });
    if ((await statusResponse.json()) !== true) return reply(403, { error: 'Acesso restrito à administração.' });
    const token = authorization.slice(7);
    const claims = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
    const hasSecondFactor = user.factors?.some((factor) => factor.status === 'verified') === true;
    if (url.searchParams.get('view') === 'status') {
      return reply(200, { authorized: true, mfa_required: claims.aal !== 'aal2' || !hasSecondFactor });
    }
    if (claims.aal !== 'aal2' || !hasSecondFactor) return reply(403, { error: 'Confirme o código do autenticador.', code: 'mfa_required' });
    const search = (url.searchParams.get('search') || '').trim();
    const pageValue = url.searchParams.get('page') || '0';
    if (search.length > 100 || !/^\d{1,6}$/.test(pageValue) || Number(pageValue) > 100000) {
      return reply(400, { error: 'Filtro inválido.' });
    }
    const response = await fetch(`${base}/rest/v1/rpc/admin_dashboard`, {
      method: 'POST', headers,
      body: JSON.stringify({ p_search: search, p_page: Number(pageValue) }),
      redirect: 'error', signal: AbortSignal.timeout(10000),
    });
    if (response.status === 403 || response.status === 401) {
      return reply(403, { error: 'Acesso administrativo não autorizado.' });
    }
    if (!response.ok) return reply(503, { error: 'Não foi possível carregar o painel.' });
    return reply(200, await response.json());
  } catch {
    return reply(503, { error: 'Painel temporariamente indisponível. Tente novamente.' });
  }
}

export const config = {
  rateLimit: { windowLimit: 60, windowSize: 60, aggregateBy: 'ip', action: 'rate_limit' },
};
