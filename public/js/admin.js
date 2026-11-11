import { esc } from './lib.js?v=b202261b30d2';
import { mountAdminRequests } from './admin-requests.js?v=b202261b30d2';

let pageToken=null;
async function requestDashboard(params={},body){
  const response=await fetch('/.netlify/functions/admin?'+new URLSearchParams(params),{
    method:body?'POST':'GET',credentials:'same-origin',cache:'no-store',
    headers:{...(pageToken?{'X-Admin-Session':pageToken}:{}),...(body?{'Content-Type':'application/json'}:{})},
    body:body?JSON.stringify(body):undefined,
  });
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw Object.assign(new Error(data.error||'Não foi possível acessar o painel.'),{status:response.status});
  return data;
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
  return `<div class="adm-shell"><header class="adm-header"><div><a href="/inicio" class="adm-back">← Voltar ao KingDrama</a><h1>Administração</h1></div><button type="button" class="btn btn-ghost" data-admin-logout hidden>Sair do painel</button></header><div data-admin-content></div></div>`;
}

dashboard.mount = root => {
  const content=root.querySelector('[data-admin-content]');
  if(!content)return;
  let disposed=false,busy=false,timer,page=0,search='';
  pageToken=null;
  const bootstrap=new URLSearchParams(location.hash.slice(1)).get('configurar');
  if(bootstrap)history.replaceState(null,'',location.pathname);
  const logoutButton=root.querySelector('[data-admin-logout]');
  const revoke=()=>{
    pageToken=null;
    return fetch('/.netlify/functions/admin',{method:'POST',credentials:'same-origin',keepalive:true,headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'logout'})}).catch(()=>{});
  };
  const endSession=async()=>{clearInterval(timer);await revoke();if(!disposed)loginGate();};
  logoutButton.addEventListener('click',endSession);
  const authField=(name,label,type='text',autocomplete='off')=>`<div class="field"><label for="adm-${name}">${label}</label><input class="input" id="adm-${name}" name="${name}" type="${type}" autocomplete="${autocomplete}" required ${name==='code'?'inputmode="numeric" pattern="[0-9]{6}" minlength="6" maxlength="6"':type==='password'?'maxlength="128"': 'minlength="3" maxlength="40" autocapitalize="none" spellcheck="false"'}></div>`;
  function loginGate(message=''){
    pageToken=null;logoutButton.hidden=true;clearInterval(timer);
    content.innerHTML=`<section class="adm-gate"><div class="adm-lock" aria-hidden="true">2FA</div><h2>Entrar no painel</h2><p>Use as credenciais exclusivas do painel e o código do aplicativo autenticador. O login da plataforma não dá acesso a esta área.</p><form class="stack" data-console-login>${authField('username','Usuário','text','username')}${authField('password','Senha','password','current-password')}${authField('code','Código do autenticador','text','one-time-code')}<button class="btn btn-primary" type="submit">Entrar no painel</button><p class="adm-error" data-login-error role="alert">${esc(message)}</p></form></section>`;
    content.querySelector('[data-console-login]').addEventListener('submit',async event=>{
      event.preventDefault();const form=event.currentTarget,button=form.querySelector('button');button.disabled=true;
      try{const result=await requestDashboard({},{action:'login',username:form.elements.username.value.trim(),password:form.elements.password.value,code:form.elements.code.value.trim()});form.reset();if(!disposed)startDashboard(result.pageToken);}
      catch(error){if(!disposed){content.querySelector('[data-login-error]').textContent=error.message;form.elements.code.value='';button.disabled=false;}}
    });
  }
  function setupGate(){
    content.innerHTML=`<section class="adm-gate"><h2>Configurar o acesso exclusivo</h2><p>Crie o usuário e a senha deste painel. Eles não pertencem a nenhuma conta da plataforma.</p><form class="stack" data-console-setup>${authField('username','Escolha um usuário','text','username')}${authField('password','Crie uma senha (mínimo de 12 caracteres)','password','new-password')}${authField('confirmPassword','Repita a senha','password','new-password')}<button class="btn btn-primary" type="submit">Configurar autenticador</button><p class="adm-error" data-setup-error role="alert"></p></form></section>`;
    const form=content.querySelector('[data-console-setup]');
    for(const input of form.querySelectorAll('input[type="password"]'))input.minLength=12;
    form.addEventListener('submit',async event=>{
      event.preventDefault();const button=form.querySelector('button');button.disabled=true;
      try{const data=await requestDashboard({},{action:'setup-begin',token:bootstrap,username:form.elements.username.value.trim(),password:form.elements.password.value,confirmPassword:form.elements.confirmPassword.value});form.reset();if(!disposed)authenticatorSetup(data);}
      catch(error){if(!disposed){content.querySelector('[data-setup-error]').textContent=error.message;button.disabled=false;}}
    });
  }
  function authenticatorSetup(data){
    content.innerHTML=`<section class="adm-gate"><h2>Cadastre o autenticador do painel</h2><p>No Google Authenticator ou Microsoft Authenticator, adicione uma conta e escaneie este QR code.</p><div class="adm-qr-local" data-console-qr></div><details><summary>Inserir a chave manualmente</summary><p>Nome: KINGDRAMA Painel · ${esc(data.username)}. Tipo: baseado em tempo.</p><code class="adm-totp-key">${esc(data.secret)}</code></details><p>Este é um novo autenticador, separado do login da plataforma. Guarde a chave em um local seguro.</p><form class="stack" data-console-confirm>${authField('code','Código do novo autenticador','text','one-time-code')}<button class="btn btn-primary" type="submit">Confirmar e abrir painel</button><p class="adm-error" data-setup-error role="alert"></p></form></section>`;
    const uri='otpauth://totp/'+encodeURIComponent('KINGDRAMA Painel:'+data.username)+'?secret='+encodeURIComponent(data.secret)+'&issuer=KINGDRAMA%20Painel&algorithm=SHA1&digits=6&period=30';
    if(window.QRCode)new window.QRCode(content.querySelector('[data-console-qr]'),{text:uri,width:220,height:220,correctLevel:window.QRCode.CorrectLevel.M});
    content.querySelector('[data-console-confirm]').addEventListener('submit',async event=>{
      event.preventDefault();const form=event.currentTarget,button=form.querySelector('button');button.disabled=true;
      try{const result=await requestDashboard({},{action:'setup-finish',token:bootstrap,code:form.elements.code.value.trim()});form.reset();if(!disposed)startDashboard(result.pageToken);}
      catch(error){if(!disposed){content.querySelector('[data-setup-error]').textContent=error.message;button.disabled=false;}}
    });
  }
  function startDashboard(token){pageToken=token;logoutButton.hidden=false;buildDashboard();load();timer=setInterval(load,15000);}
  async function load() {
    if (busy || disposed || document.hidden || !pageToken) return;
    const requestToken=pageToken;
    busy = true;
    const previousControls = content.querySelector('[data-refresh]');
    if (previousControls) previousControls.disabled = true;
    try {
      const data = await requestDashboard({ search, page: String(page) });
      if (disposed || requestToken!==pageToken) return;
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
      if (disposed || requestToken!==pageToken) return;
      if (error.status === 401) {
        content.replaceChildren();
        loginGate('Sua sessão terminou. Informe novamente usuário, senha e autenticador.');
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
    mountAdminRequests(content.querySelector('[data-admin-requests]'),requestDashboard);
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

  const onVisibility=()=>{if(!document.hidden&&pageToken)load();};
  const onExit=()=>{clearInterval(timer);revoke();};
  document.addEventListener('visibilitychange',onVisibility);window.addEventListener('pagehide',onExit);
  if(bootstrap&&/^[\w-]{43}$/.test(bootstrap))setupGate();else loginGate();
  return ()=>{disposed=true;clearInterval(timer);pageToken=null;content.replaceChildren();document.removeEventListener('visibilitychange',onVisibility);window.removeEventListener('pagehide',onExit);revoke();};
};
