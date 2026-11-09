// Cadastro, entrada por código/link, acesso pendente e retorno do checkout.
import { api, esc, icon } from './lib.js';
import { statusBadge } from './pages.js';

const top = (right = '') => `<header class="auth-top">
  <a href="/" class="logo" aria-label="KingDrama — página inicial"><img src="/img/logo.png" alt="" width="300" height="100"></a>${right}</header>`;
const frame = (inner, right) => `<div class="auth">${top(right)}<div class="auth-body"><div class="auth-card">${inner}</div></div></div>`;

function afterLoginPath() {
  let p = null;
  try { p = sessionStorage.getItem('kd_after_login'); sessionStorage.removeItem('kd_after_login'); } catch { /* indisponível */ }
  return p && p.startsWith('/') && !p.startsWith('//') ? p : '/';
}

// ------------------------------------------------------------ Etapa do código (comum a entrar e cadastro)
function codeStep(email) {
  return `<span class="eyebrow">Verifique seu e-mail</span>
    <h1>Digite o código</h1>
    <p class="lead">Se <span class="email-pill">${esc(email)}</span> estiver cadastrado, enviamos um código de 6 dígitos e um link de acesso. Ambos valem por 15 minutos e só podem ser usados uma vez.</p>
    <div data-msg></div>
    <form data-code novalidate>
      <div class="field"><label for="code">Código de acesso</label>
        <input class="input code" id="code" name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]*" maxlength="6" required aria-describedby="code-hint">
        <span class="hint" id="code-hint">Não chegou? Confira a caixa de spam ou promoções.</span></div>
      <button class="btn btn-primary btn-block" type="submit">Entrar</button>
    </form>
    <p class="foot"><button class="link" type="button" data-resend disabled>Reenviar código</button> · <button class="link" type="button" data-change>Usar outro e-mail</button></p>`;
}

function mountCodeStep(card, { email, resend, ctx, onChange }) {
  const msg = card.querySelector('[data-msg]');
  const form = card.querySelector('[data-code]');
  const input = form.code;
  const btn = form.querySelector('button[type=submit]');
  const resendBtn = card.querySelector('[data-resend]');
  input.focus();
  let wait = 30;
  const tick = setInterval(() => {
    if (!resendBtn.isConnected) return clearInterval(tick);
    wait -= 1;
    resendBtn.disabled = wait > 0;
    resendBtn.textContent = wait > 0 ? `Reenviar código (${wait}s)` : 'Reenviar código';
    if (wait <= 0) clearInterval(tick);
  }, 1000);
  const submit = async () => {
    const code = input.value.replace(/\D/g, '');
    if (code.length !== 6) { msg.innerHTML = '<div class="alert alert-error" role="alert">Digite os 6 dígitos do código.</div>'; return; }
    btn.disabled = true; btn.textContent = 'Verificando…';
    try {
      await api('/api/auth/verify', { method: 'POST', body: { email, code } });
      await ctx.refreshMe();
      ctx.navigate(afterLoginPath(), { replace: true });
    } catch (e) {
      msg.innerHTML = `<div class="alert alert-error" role="alert">${esc(e.message)}</div>`;
      btn.disabled = false; btn.textContent = 'Entrar';
      input.select();
    }
  };
  input.addEventListener('input', () => {
    input.value = input.value.replace(/\D/g, '').slice(0, 6);
    if (input.value.length === 6) submit();
  });
  form.addEventListener('submit', (e) => { e.preventDefault(); submit(); });
  resendBtn.addEventListener('click', async () => {
    resendBtn.disabled = true;
    try {
      await resend();
      msg.innerHTML = '<div class="alert alert-ok" role="status">Enviamos um novo código. O anterior deixou de valer.</div>';
      wait = 30;
    } catch (e) {
      msg.innerHTML = `<div class="alert alert-error" role="alert">${esc(e.message)}</div>`;
      resendBtn.disabled = false;
    }
  });
  card.querySelector('[data-change]').addEventListener('click', onChange);
}

// ------------------------------------------------------------ Entrar
export function login() {
  return frame(`<div data-card>
    <span class="eyebrow">Bem-vindo de volta</span>
    <h1>Entrar no KingDrama</h1>
    <p class="lead">Informe o e-mail da sua conta. Deixe a senha em branco para receber um código de acesso.</p>
    <div data-msg></div>
    <form data-email novalidate>
      <div class="field"><label for="email">E-mail</label>
        <input class="input" id="email" name="email" type="email" inputmode="email" autocomplete="email" autocapitalize="off" spellcheck="false" required placeholder="voce@email.com"></div>
      <div class="field"><label for="password">Senha <span style="color:var(--faint);font-weight:400">(opcional)</span></label>
        <input class="input" id="password" name="password" type="password" autocomplete="current-password" placeholder="Deixe em branco para receber o código"></div>
      <button class="btn btn-primary btn-block" type="submit">${icon.mail} Entrar</button>
    </form>
    <p class="foot">Ainda não tem conta? <a class="link" href="/cadastro">Criar conta</a></p>
  </div>`);
}
login.mount = (root, ctx) => mountEmailForm(root, ctx, 'login');

// ------------------------------------------------------------ Cadastro
export function signup() {
  return frame(`<div data-card>
    <span class="eyebrow">Nova conta</span>
    <h1>Criar sua conta</h1>
    <p class="lead">Leva menos de um minuto. Depois de confirmar o e-mail, você segue para o pagamento.</p>
    <div data-msg></div>
    <form data-email novalidate>
      <div class="field"><label for="name">Nome <span style="color:var(--faint);font-weight:400">(opcional)</span></label>
        <input class="input" id="name" name="name" autocomplete="name" maxlength="60" placeholder="Como quer ser chamado(a)"></div>
      <div class="field"><label for="email">E-mail</label>
        <input class="input" id="email" name="email" type="email" inputmode="email" autocomplete="email" autocapitalize="off" spellcheck="false" required placeholder="voce@email.com"></div>
      <label class="check"><input type="checkbox" name="terms" required> <span>Li e aceito os termos de uso e a política de privacidade.</span></label>
      <button class="btn btn-primary btn-block" type="submit">Criar conta</button>
    </form>
    <p class="foot">Já tem conta? <a class="link" href="/entrar">Entrar</a></p>
  </div>`);
}
signup.mount = (root, ctx) => mountEmailForm(root, ctx, 'signup');

function mountEmailForm(root, ctx, mode) {
  const card = root.querySelector('[data-card]');
  const original = card.innerHTML;
  const bind = () => {
    const form = card.querySelector('[data-email]');
    const msg = card.querySelector('[data-msg]');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = form.elements.email.value.trim();
      const name = form.elements.namedItem('name')?.value.trim() || undefined;
      if (!/^\S+@\S+\.\S{2,}$/.test(email)) { msg.innerHTML = '<div class="alert alert-error" role="alert">Informe um e-mail válido.</div>'; form.email.focus(); return; }
      if (mode === 'signup' && !form.elements.terms.checked) { msg.innerHTML = '<div class="alert alert-error" role="alert">Aceite os termos para continuar.</div>'; return; }
      const btn = form.querySelector('button[type=submit]');
      const rotuloBtn = btn.innerHTML;
      btn.disabled = true; btn.textContent = 'Enviando…';
      const send = () => api('/api/auth/start', { method: 'POST', body: { email, name, mode, acceptTerms: mode === 'signup' ? true : undefined } });

      // Senha preenchida: entra direto, sem a etapa do código.
      const senha = form.elements.namedItem('password')?.value || '';
      if (mode === 'login' && senha) {
        btn.textContent = 'Entrando…';
        try {
          await api('/api/auth/login', { method: 'POST', body: { email, password: senha } });
          await ctx.refreshMe();
          ctx.navigate(afterLoginPath(), { replace: true });
          return;
        } catch (err) {
          msg.innerHTML = `<div class="alert alert-error" role="alert">${esc(err.message)}</div>`;
          btn.disabled = false; btn.innerHTML = rotuloBtn;
          form.elements.password.select();
          return;
        }
      }

      try {
        await send();
        card.innerHTML = codeStep(email);
        mountCodeStep(card, { email, resend: send, ctx, onChange: () => { card.innerHTML = original; bind(); } });
      } catch (err) {
        msg.innerHTML = `<div class="alert alert-error" role="alert">${esc(err.message)}</div>`;
        btn.disabled = false; btn.innerHTML = rotuloBtn;
      }
    });
  };
  bind();
}

// ------------------------------------------------------------ Link de acesso (confirmação explícita)
export function magicLink(ctx) {
  const token = ctx.query.get('t');
  if (!token) return frame('<h1>Link incompleto</h1><p class="lead">Abra o link exatamente como veio no e-mail ou peça um novo acesso.</p><a class="btn btn-primary btn-block" href="/entrar">Entrar com e-mail</a>');
  return frame(`<div data-card><span class="eyebrow">Link de acesso</span>
    <h1>Confirmar entrada</h1>
    <p class="lead">Toque no botão para entrar neste dispositivo. O link só funciona uma vez.</p>
    <div data-msg></div>
    <button class="btn btn-primary btn-block" type="button" data-go>Entrar no KingDrama</button></div>`);
}
magicLink.mount = (root, ctx) => {
  const btn = root.querySelector('[data-go]');
  if (!btn) return;
  const token = ctx.query.get('t');
  // Remove o token da barra de endereço (não fica no histórico nem em capturas de tela).
  history.replaceState(history.state, '', '/entrar/link?t=' + '•'.repeat(6));
  btn.addEventListener('click', async () => {
    btn.disabled = true; btn.textContent = 'Entrando…';
    try {
      await api('/api/auth/link', { method: 'POST', body: { token } });
      await ctx.refreshMe();
      ctx.navigate(afterLoginPath(), { replace: true });
    } catch (e) {
      root.querySelector('[data-msg]').innerHTML = `<div class="alert alert-error" role="alert">${esc(e.message)}</div>`;
      btn.outerHTML = '<a class="btn btn-primary btn-block" href="/entrar">Pedir novo acesso</a>';
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
      <li class="done"><span class="n">${icon.check}</span><div><strong>Conta criada</strong>E-mail confirmado.</div></li>
      <li class="current"><span class="n">2</span><div><strong>Pagamento</strong>Conclua no checkout seguro.</div></li>
      <li><span class="n">3</span><div><strong>Acesso liberado</strong>Automático após a confirmação.</div></li>
    </ol>
    <div data-msg></div>
    ${checkout
      ? `<button class="btn btn-primary btn-block" type="button" data-checkout>${icon.card} Ir para o pagamento</button>`
      : '<div class="alert alert-info">O pagamento ainda não está disponível. Volte em breve.</div>'}
    <button class="btn btn-ghost btn-block" type="button" data-check style="margin-top:10px">${icon.refresh} Já paguei — verificar</button>
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
