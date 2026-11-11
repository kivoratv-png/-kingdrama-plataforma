import { esc } from './lib.js?v=69eeb26e4b0b';
import { mountAdminRequests } from './admin-requests.js?v=69eeb26e4b0b';

const client = window.__KD_SB__;
let status;

async function requestDashboard(params = {}) {
  const { data, error } = await client.auth.getSession();
  if (error || !data?.session?.access_token) throw Object.assign(new Error('Entre na sua conta.'), { status: 401 });
  const response = await fetch(`/.netlify/functions/admin?${new URLSearchParams(params)}`, {
    headers: { Authorization: `Bearer ${data.session.access_token}` },
    cache: 'no-store',
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(body.error || 'Não foi possível carregar o painel.'), { status: response.status, code: body.code });
  return body;
}

const dateTime = (value) => value ? new Date(value).toLocaleString('pt-BR') : '—';
const userName = (user) => `<strong>${esc(user.name || 'Sem nome')}</strong><span>${esc(user.email || '')}</span>`;
const stateName = { page: 'Navegando', player_open: 'Player aberto', playing: 'Reproduzindo', paused: 'Pausado', ended: 'Concluído', error: 'Erro no player' };
const subscriptionName = { active: 'Ativa', pending: 'Pendente', canceled: 'Cancelada', refunded: 'Reembolsada', expired: 'Expirada', chargeback: 'Contestada' };
const emptyRow = (columns, message) => `<tr><td colspan="${columns}" class="adm-empty">${esc(message)}</td></tr>`;

function activityRows(rows) {
  return rows.map((user) => `<tr>
    <td data-label="Usuário"><div class="adm-user">${userName(user)}</div></td>
    <td data-label="Estado"><span class="adm-state ${user.player_state === 'error' ? 'is-error' : ''}">${esc(stateName[user.player_state] || 'Navegando')}</span>${user.page_visible ? '' : '<small>Em segundo plano</small>'}</td>
    <td data-label="Título">${user.title_name ? `<strong>${esc(user.title_name)}</strong><small>Episódio ${esc(user.episode_number)}</small>` : '—'}</td>
    <td data-label="Página acessada"><a class="adm-path" href="${esc(user.path)}" target="_blank" rel="noopener noreferrer">${esc(user.path)}</a></td>
    <td data-label="Posição">${user.position_seconds == null ? '—' : `${Math.floor(user.position_seconds / 60)}:${String(user.position_seconds % 60).padStart(2, '0')}`}</td>
    <td data-label="Último sinal" class="adm-time">${esc(dateTime(user.last_seen))}</td>
  </tr>`).join('') || emptyRow(6, 'Nenhum usuário conectado nos últimos 90 segundos.');
}

function usersRows(rows) {
  return rows.map((user) => {
    const sub = user.subscription;
    const label = user.has_access ? 'Ativo' : sub?.status === 'active' ? 'Expirado' : subscriptionName[sub?.status] || 'Sem assinatura';
    return `<tr><td data-label="Usuário"><div class="adm-user">${userName(user)}</div></td>
      <td data-label="Acesso"><span class="adm-state ${user.has_access ? '' : 'is-muted'}">${esc(label)}</span></td>
      <td data-label="Plano">${esc(sub?.plan || '—')}</td><td data-label="Vencimento">${sub ? sub.ends_at ? esc(dateTime(sub.ends_at)) : 'Sem prazo definido' : '—'}</td>
      <td data-label="Cadastro" class="adm-time">${esc(dateTime(user.created_at))}</td><td data-label="Último login" class="adm-time">${esc(dateTime(user.last_sign_in_at))}</td></tr>`;
  }).join('') || emptyRow(6, 'Nenhum usuário encontrado.');
}

export async function dashboard() {
  status = await requestDashboard({ view: 'status' });
  return `<div class="adm-shell">
    <header class="adm-header"><div><a href="/inicio" class="adm-back">← Voltar ao KingDrama</a><h1>Administração</h1></div>
      <span class="adm-security">Conta autorizada · autenticação em duas etapas</span></header>
    <div data-admin-content>${status.mfa_required ? '' : '<p role="status">Carregando o painel…</p>'}</div>
  </div>`;
}

dashboard.mount = (root, ctx) => {
  const content = root.querySelector('[data-admin-content]');
  let disposed = false;
  let busy = false;
  let timer;
  let page = 0;
  let search = '';
  let factorId;

  async function load() {
    if (busy || disposed || document.hidden) return;
    busy = true;
    const previousControls = content.querySelector('[data-refresh]');
    if (previousControls) previousControls.disabled = true;
    try {
      const data = await requestDashboard({ search, page: String(page) });
      if (disposed) return;
      if (!content.querySelector('[data-dashboard]')) buildDashboard();
      const counts = data.counts;
      for (const [key, value] of Object.entries(counts)) {
        const element = content.querySelector(`[data-count="${key}"]`);
        if (element) element.textContent = Number(value).toLocaleString('pt-BR');
      }
      content.querySelector('[data-online]').innerHTML = activityRows(data.online);
      content.querySelector('[data-users]').innerHTML = usersRows(data.users);
      content.querySelector('[data-errors]').innerHTML = data.errors.map((item) => `<tr>
        <td data-label="Usuário"><div class="adm-user">${userName(item)}</div></td><td data-label="Título">${esc(item.title_name || '—')}</td>
        <td data-label="Erro">${esc(item.last_error_code)}</td><td data-label="Página" class="adm-path">${esc(item.path)}</td>
        <td data-label="Horário" class="adm-time">${esc(dateTime(item.error_at))}</td></tr>`).join('') || emptyRow(5, 'Nenhum erro comunicado nas últimas 24 horas.');
      content.querySelector('[data-updated]').textContent = `Atualizado em ${dateTime(data.generated_at)}`;
      const pages = Math.max(1, Math.ceil(data.users_total / data.page_size));
      content.querySelector('[data-pagination]').textContent = `${data.users_total} usuários · página ${page + 1} de ${pages}`;
      content.querySelector('[data-prev]').disabled = page === 0;
      content.querySelector('[data-next]').disabled = (page + 1) * data.page_size >= data.users_total;
      content.querySelector('[data-admin-message]').textContent = '';
    } catch (error) {
      if (disposed) return;
      if (error.status === 401) {
        content.replaceChildren();
        ctx.navigate('/entrar', { replace: true });
        return;
      }
      if (error.status === 403) {
        content.innerHTML = '<div class="adm-gate"><h2>Confirme sua autorização</h2><p>A sessão precisa ser validada novamente.</p><a class="btn btn-primary" href="/admin">Validar acesso</a></div>';
        clearInterval(timer);
        return;
      }
      if (!content.querySelector('[data-dashboard]')) buildDashboard();
      content.querySelector('[data-admin-message]').textContent = error.message;
    } finally {
      busy = false;
      const button = content.querySelector('[data-refresh]');
      if (button) button.disabled = false;
    }
  }

  function buildDashboard() {
    content.innerHTML = `<div data-dashboard>
      <div class="adm-toolbar"><p data-updated role="status"></p><button type="button" class="btn btn-ghost" data-refresh>Atualizar agora</button></div>
      <p data-admin-message class="adm-error" role="alert"></p>
      <section class="adm-stats" aria-label="Visão geral">
        ${[['online','Conectados agora'],['watching','No player'],['users','Contas cadastradas'],['active_subscriptions','Acessos ativos'],['titles','Títulos publicados']].map(([key,label])=>`<div class="adm-stat"><span>${label}</span><strong data-count="${key}">—</strong></div>`).join('')}
      </section>
      <section class="adm-section"><div class="adm-section-head"><h2>Pedidos de doramas</h2><span>Área exclusiva da administração</span></div><div data-admin-requests></div></section>
      <section class="adm-section"><div class="adm-section-head"><h2>Atividade ao vivo</h2><span>Atualização a cada 15 segundos</span></div>
        <p class="adm-note">Contas com atividade nos últimos 90 segundos. Cada aba aparece em uma linha. “Player aberto” indica a página de reprodução. A posição é exibida quando o player informa esse dado.</p>
        <div class="adm-table-wrap"><table><thead><tr><th>Usuário</th><th>Estado</th><th>Título</th><th>Página acessada</th><th>Posição</th><th>Último sinal</th></tr></thead><tbody data-online></tbody></table></div>
      </section>
      <section class="adm-section"><div class="adm-section-head"><h2>Usuários e assinaturas</h2>
        <form data-user-search role="search"><label class="sr-only" for="adm-search">Buscar por nome ou e-mail</label><input class="input" id="adm-search" name="search" type="search" maxlength="100" placeholder="Nome ou e-mail" autocomplete="off"><button class="btn btn-ghost">Buscar</button></form></div>
        <div class="adm-table-wrap"><table><thead><tr><th>Usuário</th><th>Acesso</th><th>Plano</th><th>Vencimento</th><th>Cadastro</th><th>Último login</th></tr></thead><tbody data-users></tbody></table></div>
        <div class="adm-pagination"><span data-pagination></span><div><button class="btn btn-ghost" type="button" data-prev>Anterior</button><button class="btn btn-ghost" type="button" data-next>Próxima</button></div></div>
      </section>
      <section class="adm-section"><div class="adm-section-head"><h2>Erros recentes</h2><span>Últimas 24 horas</span></div>
        <p class="adm-note">Último erro de reprodução comunicado por cada aba. Erros exibidos dentro do iframe da Bunny podem exigir consulta aos logs da Bunny.</p>
        <div class="adm-table-wrap"><table><thead><tr><th>Usuário</th><th>Título</th><th>Erro</th><th>Página</th><th>Horário</th></tr></thead><tbody data-errors></tbody></table></div>
      </section>
    </div>`;
    mountAdminRequests(content.querySelector('[data-admin-requests]'));
    content.querySelector('[data-refresh]').addEventListener('click', load);
    content.querySelector('[data-user-search]').addEventListener('submit', (event) => {
      event.preventDefault();
      if (busy) return;
      search = event.currentTarget.elements.search.value.trim();
      page = 0;
      load();
    });
    content.querySelector('[data-prev]').addEventListener('click', () => { if (!busy && page) { page--; load(); } });
    content.querySelector('[data-next]').addEventListener('click', () => { if (!busy) { page++; load(); } });
  }

  async function mfaGate() {
    content.innerHTML = `<section class="adm-gate"><div class="adm-lock" aria-hidden="true">2FA</div><h2>Proteja o acesso à administração</h2>
      <p>Use um aplicativo autenticador, como Google Authenticator ou Microsoft Authenticator, para confirmar sua identidade.</p>
      <div data-mfa-setup><p role="status">Conferindo o autenticador…</p></div><p class="adm-error" data-mfa-error role="alert"></p></section>`;
    const setup = content.querySelector('[data-mfa-setup]');
    try {
      const { data, error } = await client.auth.mfa.listFactors();
      if (error) throw error;
      if (disposed) return;
      const verified = data.totp.find((factor) => factor.status === 'verified');
      if (verified) {
        factorId = verified.id;
        codeForm();
      } else {
        setup.innerHTML = '<button class="btn btn-primary" type="button" data-enroll>Configurar autenticador</button>';
        setup.querySelector('[data-enroll]').addEventListener('click', async (event) => {
          event.currentTarget.disabled = true;
          try {
            // Remove only unfinished enrollments for this panel, which cannot
            // be resumed because Supabase returns their secret only once.
            for (const factor of data.all.filter((f) => f.factor_type === 'totp' && f.status === 'unverified' && f.friendly_name === 'KingDrama Administração')) {
              const result = await client.auth.mfa.unenroll({ factorId: factor.id });
              if (result.error) throw result.error;
            }
            const result = await client.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'KingDrama Administração' });
            if (result.error) throw result.error;
            if (disposed) return;
            factorId = result.data.id;
            codeForm(result.data.totp);
          } catch (failure) {
            if (!disposed) {
              content.querySelector('[data-mfa-error]').textContent = 'Não foi possível configurar o autenticador. Recarregue e tente novamente.';
              const button = setup.querySelector('[data-enroll]');
              if (button) button.disabled = false;
            }
          }
        });
      }
    } catch {
      if (!disposed) content.querySelector('[data-mfa-error]').textContent = 'Não foi possível consultar os fatores. Recarregue e tente novamente.';
    }
  }

  function codeForm(totp) {
    const setup = content.querySelector('[data-mfa-setup]');
    const qr = totp?.qr_code?.startsWith('data:image/svg+xml') ? totp.qr_code : '';
    setup.innerHTML = `${totp ? `<p>Escaneie este QR code no aplicativo autenticador.</p>${qr ? `<img class="adm-qr" src="${esc(qr)}" alt="QR code para cadastrar o autenticador" width="220" height="220">` : ''}
      <details><summary>Inserir chave manualmente</summary><code class="adm-totp-key">${esc(totp.secret)}</code></details>` : ''}
      <form data-mfa-form><label for="adm-code">Código de seis dígitos</label><input class="input" id="adm-code" name="code" inputmode="numeric" pattern="[0-9]{6}" minlength="6" maxlength="6" autocomplete="one-time-code" required>
      <button class="btn btn-primary" type="submit">Confirmar e abrir painel</button></form>`;
    setup.querySelector('[data-mfa-form]').addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const button = form.querySelector('button');
      button.disabled = true;
      const code = form.elements.code.value.trim();
      content.querySelector('[data-mfa-error]').textContent = '';
      try {
        const { error } = await client.auth.mfa.challengeAndVerify({ factorId, code });
        form.reset();
        if (error) throw error;
        if (disposed) return;
        setup.replaceChildren();
        ctx.navigate('/admin', { replace: true });
      } catch {
        if (!disposed) {
          content.querySelector('[data-mfa-error]').textContent = 'Código inválido ou expirado. Use o código atual do aplicativo.';
          button.disabled = false;
        }
      }
    });
  }

  const onVisibility = () => { if (!document.hidden && !status.mfa_required) load(); };
  document.addEventListener('visibilitychange', onVisibility);
  if (status.mfa_required) mfaGate();
  else { load(); timer = setInterval(load, 15000); }
  const { data: authListener } = client.auth.onAuthStateChange((event, session) => {
    if (!session && !disposed) {
      content.replaceChildren();
      clearInterval(timer);
      ctx.navigate('/entrar', { replace: true });
    }
  });
  return () => {
    disposed = true;
    clearInterval(timer);
    content.replaceChildren();
    document.removeEventListener('visibilitychange', onVisibility);
    authListener.subscription.unsubscribe();
  };
};
