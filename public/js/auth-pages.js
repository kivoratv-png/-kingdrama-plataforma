// Cadastro, entrada com e-mail e senha, acesso pendente e retorno do checkout.
import { api, esc, icon } from './lib.js?v=75ad0bb5f98f';
import { statusBadge } from './pages.js?v=75ad0bb5f98f';

const top = (right = '') => `<header class="auth-top">
  <a href="/" class="logo" aria-label="KingDrama — página inicial"><img src="/img/logo.png" alt="" width="300" height="100"></a>${right}</header>`;
const frame = (inner, right) => `<div class="auth">${top(right)}<div class="auth-body"><div class="auth-card">${inner}</div></div></div>`;

function afterLoginPath() {
  let p = null;
  try { p = sessionStorage.getItem('kd_after_login'); sessionStorage.removeItem('kd_after_login'); } catch { /* indisponível */ }
  return p && p.startsWith('/') && !p.startsWith('//') ? p : '/';
}

// ------------------------------------------------------------ Entrar
export function login() {
  return frame(`<div data-card>
    <span class="eyebrow">Bem-vindo de volta</span>
    <h1>Entrar no KingDrama</h1>
    <p class="lead">Entre com e-mail ou WhatsApp e sua senha.</p>
    <div data-msg></div>
    <form data-email novalidate>
      <div class="field"><label for="email">E-mail ou WhatsApp</label>
        <input class="input" id="email" name="email" type="text" autocomplete="username" autocapitalize="off" spellcheck="false" required placeholder="11999999999 ou email@..." aria-describedby="login-hint"><span class="hint" id="login-hint">WhatsApp: use com DDD (somente números). E-mail: digite normal com @.</span></div>
      <div class="field"><label for="password">Senha</label>
        <input class="input" id="password" name="password" type="password" autocomplete="current-password" required placeholder="Sua senha">
        <span class="hint"><a class="link" href="/recuperar">Esqueci minha senha</a></span></div>
      <button class="btn btn-primary btn-block" type="submit">${icon.lock} Entrar</button>
    </form>
    <a class="btn btn-ghost btn-block" href="/entrar-com-codigo" style="margin-top:12px">${icon.mail} Entrar sem senha (código por e-mail)</a>
    <p class="foot">Ainda não tem conta? <a class="link" href="/cadastro">Criar conta</a></p>
  </div>`);
}
login.mount = (root, ctx) => mountEmailForm(root, ctx, 'login');

export async function codeLogin() {
  const response=await fetch('/config/auth.json',{cache:'no-store'});
  const config=response.ok?await response.json():{};
  return frame(`<span class="eyebrow">Entrar sem senha</span><h1>Código por e-mail</h1><p class="lead">Informe o e-mail cadastrado para receber um código de acesso.</p>${config.emailCodeEnabled?'':'<div class="alert alert-info">O acesso por código está temporariamente indisponível. Entre com sua senha enquanto preparamos esta opção.</div>'}<div data-msg role="status"></div>
    <form data-send-code><div class="field"><label for="code-email">E-mail cadastrado</label><input class="input" id="code-email" name="email" type="email" autocomplete="email" inputmode="email" required placeholder="seuemail@gmail.com"></div><button class="btn btn-primary btn-block" type="submit">Enviar código</button></form>
    <form data-verify-code hidden><div class="field"><label for="email-code">Código recebido por e-mail</label><input class="input" id="email-code" name="code" type="text" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6,10}" minlength="6" maxlength="10" required placeholder="Digite o código"></div><button class="btn btn-primary btn-block" type="submit">Confirmar e entrar</button><button class="btn btn-ghost btn-block" type="button" data-resend style="margin-top:12px">Reenviar código</button></form>
    <p class="foot"><a class="link" href="/entrar">Voltar para entrar com senha</a></p>`);
}
codeLogin.mount = (root,ctx) => {
  const send=root.querySelector('[data-send-code]'),verify=root.querySelector('[data-verify-code]'),msg=root.querySelector('[data-msg]');
  if(!send || !verify)return;
  let email='',nextSend=0;
  const sendCode=async()=>{
    const now=Date.now(); if(now<nextSend)throw new Error(`Aguarde ${Math.ceil((nextSend-now)/1000)} segundos para reenviar.`);
    await api('/api/auth/otp',{method:'POST',body:{email}});nextSend=Date.now()+60000;
    send.hidden=true;verify.hidden=false;msg.textContent='Se houver uma conta com este e-mail, você receberá um código. Confira também o spam.';verify.elements.code.focus();
  };
  const run=async(form,fn)=>{const button=form.querySelector('button');button.disabled=true;msg.textContent='Aguarde…';try{await fn();}catch(e){msg.textContent=e.message;}finally{button.disabled=false;}};
  send.addEventListener('submit',e=>{e.preventDefault();email=send.elements.email.value.trim().toLowerCase();run(send,sendCode);});
  verify.addEventListener('submit',e=>{e.preventDefault();run(verify,async()=>{await api('/api/auth/verify-code',{method:'POST',body:{email,code:verify.elements.code.value.trim()}});verify.reset();await ctx.refreshMe();ctx.navigate(afterLoginPath(),{replace:true});});});
  root.querySelector('[data-resend]').addEventListener('click',e=>{const button=e.currentTarget;button.disabled=true;sendCode().catch(error=>{msg.textContent=error.message;}).finally(()=>{button.disabled=false;});});
};

// ------------------------------------------------------------ Cadastro
export function signup() {
  return frame(`<div data-card>
    <span class="eyebrow">Nova conta</span>
    <h1>Criar sua conta</h1>
    <p class="lead">Preencha seus dados para entrar na plataforma, sem precisar confirmar o e-mail.</p>
    <div data-msg></div>
    <form data-email novalidate>
      <div class="field"><label for="name">Nome completo</label>
        <input class="input" id="name" name="name" autocomplete="name" required maxlength="60" placeholder="Ex: Maria Almeida"></div>
      <div class="field"><label for="email">E-mail</label>
        <input class="input" id="email" name="email" type="email" inputmode="email" autocomplete="email" autocapitalize="off" spellcheck="false" required placeholder="seuemail@gmail.com"></div>
      <div class="field"><label for="whatsapp">WhatsApp (DDD)</label><input class="input" id="whatsapp" name="whatsapp" type="tel" inputmode="tel" autocomplete="tel-national" required maxlength="16" placeholder="(11) 99999-9999"><span class="hint">Usamos seu WhatsApp apenas para avisos e promoções.</span></div>
      <div class="field"><label for="password">Senha</label>
        <input class="input" id="password" name="password" type="password" autocomplete="new-password" required minlength="8" maxlength="128" placeholder="Digite sua senha" aria-describedby="senha-dica">
        <span class="hint" id="senha-dica">Use 8 caracteres ou mais. Evite uma senha que você já usa em outro site.</span></div>
      <div class="field"><label for="confirmPassword">Confirmar senha</label><input class="input" id="confirmPassword" name="confirmPassword" type="password" autocomplete="new-password" required minlength="8" maxlength="128" placeholder="Repita sua senha"></div>
      <label class="check"><input type="checkbox" name="terms" required> <span>Li e aceito os termos de uso e a <a class="link" href="/politica-de-privacidade">política de privacidade</a>.</span></label>
      <button class="btn btn-primary btn-block" type="submit">Criar conta</button>
    </form>
    <p class="foot">Já tem conta? <a class="link" href="/entrar">Entrar</a></p>
  </div>`);
}
signup.mount = (root, ctx) => mountEmailForm(root, ctx, 'signup');

function mountEmailForm(root, ctx, mode) {
  const card = root.querySelector('[data-card]');
  const bind = () => {
    const form = card.querySelector('[data-email]');
    const msg = card.querySelector('[data-msg]');
    const erro = (txt) => { msg.innerHTML = `<div class="alert alert-error" role="alert">${esc(txt)}</div>`; };

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = form.elements.email.value.trim();
      const senha = form.elements.password.value;
      const name = form.elements.namedItem('name')?.value.trim() || undefined;

      if (mode === 'signup' || email.includes('@')) {
        if (!/^\S+@\S+\.\S{2,}$/.test(email)) { erro('Informe um e-mail válido.'); form.email.focus(); return; }
      } else if (!/^[1-9][0-9]{9,10}$/.test(email)) { erro('Informe o WhatsApp com DDD, somente números, ou seu e-mail.'); form.email.focus(); return; }
      if (!senha) { erro('Digite sua senha.'); form.password.focus(); return; }
      if (mode === 'signup' && senha.length < 8) { erro('A senha precisa ter pelo menos 8 caracteres.'); form.password.focus(); return; }
      if (mode === 'signup' && !form.elements.terms.checked) { erro('Aceite os termos para continuar.'); return; }
      if (mode === 'signup' && (!name || name.split(/\s+/).length < 2)) { erro('Informe seu nome completo.'); return; }
      if (mode === 'signup' && !/^[1-9][0-9]{9,10}$/.test(form.elements.whatsapp.value.replace(/\D/g,''))) { erro('Informe seu WhatsApp com DDD (10 ou 11 números).'); return; }
      if (mode === 'signup' && senha !== form.elements.confirmPassword.value) { erro('As senhas precisam ser iguais.'); return; }

      const btn = form.querySelector('button[type=submit]');
      const rotuloBtn = btn.innerHTML;
      btn.disabled = true;
      btn.textContent = mode === 'signup' ? 'Criando conta…' : 'Entrando…';
      msg.innerHTML = '';

      try {
        if (mode === 'signup') {
          await api('/api/auth/signup', { method: 'POST', body: { email, password: senha, confirmPassword: form.elements.confirmPassword.value, whatsapp: form.elements.whatsapp.value, name, acceptTerms: true } });
        } else {
          await api('/api/auth/login', { method: 'POST', body: { email, password: senha } });
        }
        await ctx.refreshMe();
        ctx.navigate(afterLoginPath(), { replace: true });
      } catch (err) {
        erro(err.message);
        btn.disabled = false; btn.innerHTML = rotuloBtn;
        form.password.select();
      }
    });
  };
  bind();
}

// ------------------------------------------------------------ Esqueci minha senha
export function recover() {
  return frame(`<div data-card>
    <span class="eyebrow">Recuperar acesso</span>
    <h1>Esqueceu a senha?</h1>
    <p class="lead">Informe o e-mail da sua conta. Enviamos um link para você criar uma nova.</p>
    <div data-msg></div>
    <form data-form novalidate>
      <div class="field"><label for="email">E-mail</label>
        <input class="input" id="email" name="email" type="email" inputmode="email" autocomplete="email" autocapitalize="off" spellcheck="false" required placeholder="voce@email.com"></div>
      <button class="btn btn-primary btn-block" type="submit">${icon.mail} Enviar link</button>
    </form>
    <p class="foot">Lembrou? <a class="link" href="/entrar">Voltar para entrar</a></p>
  </div>`);
}
recover.mount = (root) => {
  const card = root.querySelector('[data-card]');
  const form = card.querySelector('[data-form]');
  const msg = card.querySelector('[data-msg]');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = form.elements.email.value.trim();
    if (!/^\S+@\S+\.\S{2,}$/.test(email)) {
      msg.innerHTML = '<div class="alert alert-error" role="alert">Informe um e-mail válido.</div>';
      return;
    }
    const btn = form.querySelector('button[type=submit]');
    btn.disabled = true; btn.textContent = 'Enviando…';
    const r = await api('/api/auth/recover', { method: 'POST', body: { email } }).catch(() => ({}));
    // Mensagem igual existindo a conta ou não: não revela quem é cliente.
    card.innerHTML = `<span class="eyebrow">Verifique seu e-mail</span>
      <h1>Link enviado</h1>
      <p class="lead">${esc(r.message || 'Se houver uma conta com este e-mail, enviamos o link para criar uma nova senha.')}</p>
      <p class="lead">Não chegou em alguns minutos? Confira a caixa de spam ou promoções.</p>
      <a class="btn btn-ghost btn-block" href="/entrar">Voltar para entrar</a>`;
  });
};

// ------------------------------------------------------------ Definir nova senha
// O link do e-mail traz a sessão de recuperação no endereço; o SDK do Supabase
// a reconhece sozinho (detectSessionInUrl), então aqui só pedimos a senha nova.
export function newPassword() {
  return frame(`<div data-card>
    <span class="eyebrow">Recuperar acesso</span>
    <h1>Criar nova senha</h1>
    <p class="lead">Escolha uma senha que você não use em outro site.</p>
    <div data-msg></div>
    <form data-form novalidate>
      <div class="field"><label for="password">Nova senha</label>
        <input class="input" id="password" name="password" type="password" autocomplete="new-password" required minlength="8" placeholder="Pelo menos 8 caracteres"></div>
      <button class="btn btn-primary btn-block" type="submit">${icon.lock} Salvar e entrar</button>
    </form>
  </div>`);
}
newPassword.mount = (root, ctx) => {
  const card = root.querySelector('[data-card]');
  const form = card.querySelector('[data-form]');
  const msg = card.querySelector('[data-msg]');
  // Tira os tokens da barra de endereço: não ficam no histórico nem em prints.
  if (location.hash) history.replaceState(history.state, '', '/nova-senha');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const senha = form.elements.password.value;
    if (senha.length < 8) {
      msg.innerHTML = '<div class="alert alert-error" role="alert">A senha precisa ter pelo menos 8 caracteres.</div>';
      return;
    }
    const btn = form.querySelector('button[type=submit]');
    btn.disabled = true; btn.textContent = 'Salvando…';
    try {
      await api('/api/auth/password', { method: 'POST', body: { password: senha } });
      await ctx.refreshMe();
      ctx.navigate('/', { replace: true });
    } catch (err) {
      msg.innerHTML = `<div class="alert alert-error" role="alert">${esc(err.message)} Peça um novo link em <a class="link" href="/recuperar">Esqueci minha senha</a>.</div>`;
      btn.disabled = false; btn.textContent = 'Salvar e entrar';
    }
  });
};

// ------------------------------------------------------------ Acesso pendente
const logoutBtn = '<button class="btn btn-ghost" type="button" data-logout style="min-height:44px;padding:0 16px">Sair</button>';

export async function pending(ctx) {
  const me = await ctx.refreshMe();
  if (me.access?.active) { ctx.navigate('/inicio', { replace: true }); return ''; }
  const s = me.access?.status || 'pending';
  const checkout = ctx.state.site?.checkoutConfigured;
  const ended = s !== 'pending';
  return frame(`<span class="eyebrow">Sua conta</span>
    <h1>${ended ? 'Acesso encerrado' : 'Falta pouco!'}</h1>
    <p class="lead">${ended
      ? 'Sua assinatura não está ativa no momento. Para voltar a assistir, conclua um novo pagamento.'
      : 'Sua conta foi criada. O catálogo é liberado automaticamente assim que o pagamento for confirmado pelo nosso servidor.'}</p>
    <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:6px">
      <span style="color:var(--muted);font-size:14px;overflow-wrap:anywhere">${esc(me.user.email)}</span>${statusBadge(s)}</div>
    <ol class="steps">
      <li class="done"><span class="n">${icon.check}</span><div><strong>Conta criada</strong>Cadastro concluído.</div></li>
      <li class="current"><span class="n">2</span><div><strong>Pagamento</strong>Conclua no checkout seguro.</div></li>
      <li><span class="n">3</span><div><strong>Acesso liberado</strong>Automático após a confirmação.</div></li>
    </ol>
    <div data-msg></div>
    ${checkout
      ? `<button class="btn btn-primary btn-block" type="button" data-checkout>${icon.card} Ir para o pagamento</button>`
      : '<div class="alert alert-info">O pagamento ainda não está disponível. Volte em breve.</div>'}
    <button class="btn btn-ghost btn-block" type="button" data-check style="margin-top:10px">${icon.refresh} Já paguei — verificar</button>
    <p class="foot"><a class="link" href="/perfil">Meu perfil</a> · <a class="link" href="/pedidos">Meus pedidos de doramas</a></p>
    <p class="foot">Pagou com outro e-mail? O acesso é liberado para o e-mail informado no pagamento — entre com ele.</p>`, logoutBtn);
}
pending.mount = (root, ctx) => {
  const msg = root.querySelector('[data-msg]');
  root.querySelector('[data-checkout]')?.addEventListener('click', async (e) => {
    const b = e.currentTarget;
    b.disabled = true;
    try {
      const { url } = await api('/api/checkout', { method: 'POST' });
      location.href = url;
    } catch (err) {
      msg.innerHTML = `<div class="alert alert-error" role="alert">${esc(err.message)}</div>`;
      b.disabled = false;
    }
  });
  const check = async () => {
    const me = await ctx.refreshMe();
    if (me.access?.active) { ctx.navigate('/inicio', { replace: true }); return true; }
    return false;
  };
  root.querySelector('[data-check]').addEventListener('click', async (e) => {
    const b = e.currentTarget;
    b.disabled = true;
    if (!(await check())) msg.innerHTML = '<div class="alert alert-info" role="status">Ainda não recebemos a confirmação do pagamento. Isso pode levar alguns minutos (boleto e alguns métodos demoram mais).</div>';
    b.disabled = false;
  });
  // Verificação periódica leve enquanto a página estiver aberta.
  const timer = setInterval(() => (root.isConnected && !document.hidden ? check() : !root.isConnected && clearInterval(timer)), 15000);
};

// ------------------------------------------------------------ Retorno do checkout
// Parâmetros na URL são ignorados de propósito: só o servidor (via webhook) libera o acesso.
export function checkoutReturn() {
  return frame(`<div style="display:grid;justify-items:center;text-align:center;gap:12px">
    <div class="spinner" style="width:40px;height:40px;border-width:4px" aria-hidden="true"></div>
    <h1>Confirmando pagamento…</h1>
    <p class="lead" data-status role="status">Estamos aguardando a confirmação do pagamento. Você pode fechar esta página: o acesso será liberado automaticamente.</p>
    <a class="btn btn-ghost btn-block" href="/acesso">Ver situação da conta</a></div>`, logoutBtn);
}
checkoutReturn.mount = (root, ctx) => {
  history.replaceState(history.state, '', '/pagamento/retorno');
  const started = Date.now();
  const poll = async () => {
    if (!root.isConnected) return;
    const me = await ctx.refreshMe().catch(() => null);
    if (me?.access?.active) return ctx.navigate('/inicio', { replace: true });
    if (Date.now() - started > 5 * 60e3) {
      root.querySelector('[data-status]').textContent = 'A confirmação está demorando mais que o normal. Você receberá acesso assim que ela chegar — confira mais tarde em “Ver situação da conta”.';
      root.querySelector('.spinner')?.remove();
      return;
    }
    setTimeout(poll, 4000);
  };
  poll();
};
