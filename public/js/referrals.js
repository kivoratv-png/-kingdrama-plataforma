import { api,esc,icon } from './lib.js?v=a55dbb2fcdc5';

export async function referrals() {
  const data=await api('/api/referrals');
  const link=data.eligible && data.code ? referralLink(data.code) : '';
  return `<div class="page-head narrow"><h1>Indique e ganhe dias grátis</h1><p>A cada amigo que pagar pelo seu link, você ganha 10 dias.</p></div>
    <div class="wrap narrow stack referral-page"><section class="profile-card settings-section">
      <span class="referral-gift" aria-hidden="true">${icon.gift}</span><h2>Compartilhe suas próximas histórias</h2>
      <p class="hint">Convide um amigo para criar uma conta pelo seu link. Os 10 dias são creditados somente após a confirmação do primeiro pagamento dele.</p>
      ${data.eligible?`<div data-referral-link ${link?'':'hidden'}><label for="referral-url">Seu link de indicação</label><div class="referral-copy"><input class="input" id="referral-url" type="url" readonly value="${esc(link)}"><button type="button" class="btn btn-primary" data-copy-referral>Copiar</button></div></div><button type="button" class="btn btn-primary" data-generate-referral ${link?'hidden':''}>Gerar meu link de indicação</button>`:
      `<div class="alert alert-info">Este benefício é exclusivo para assinantes com acesso ativo. Assine para gerar seu link e começar a indicar.</div><a class="btn btn-primary" href="/ofertas">Ver ofertas para assinar</a>`}
      <p class="hint" data-referral-feedback role="status" aria-live="polite"></p>
      <dl class="referral-stats"><div><dt>Indicações válidas</dt><dd>${esc(Number(data.validReferrals).toLocaleString('pt-BR'))}</dd></div><div><dt>Dias ganhos</dt><dd>${esc(Number(data.daysEarned).toLocaleString('pt-BR'))}</dd></div></dl>
    </section><section class="profile-card settings-section"><h2>Como funciona</h2><ol class="referral-steps"><li>Com sua assinatura ativa, gere e copie seu link.</li><li>Seu amigo cria uma nova conta pelo convite.</li><li>Quando o primeiro pagamento dele for confirmado, você ganha 10 dias na sua assinatura.</li></ol><p class="hint">Cada amigo gera uma recompensa. Somente criar a conta, gerar um Pix ou enviar um comprovante não libera dias.</p></section><a class="btn btn-ghost" href="/perfil">${icon.back} Voltar ao perfil</a></div>`;
}
function referralLink(code) { const url=new URL('/cadastro',location.origin);url.searchParams.set('ref',code);return url.href; }
referrals.mount=root=>{
  const feedback=root.querySelector('[data-referral-feedback]');if(!feedback)return;
  root.querySelector('[data-generate-referral]')?.addEventListener('click',async e=>{
    const button=e.currentTarget;button.disabled=true;feedback.textContent='Gerando seu link…';
    try {
      const {code}=await api('/api/referrals',{method:'POST'});
      root.querySelector('#referral-url').value=referralLink(code);root.querySelector('[data-referral-link]').hidden=false;button.hidden=true;feedback.textContent='Seu link está pronto para compartilhar.';
    }catch(error){feedback.textContent=error.message;}finally{button.disabled=false;}
  });
  root.querySelector('[data-copy-referral]')?.addEventListener('click',async()=>{
    const input=root.querySelector('#referral-url');
    try { await navigator.clipboard.writeText(input.value);feedback.textContent='Link copiado! Envie para seu amigo.'; }
    catch { input.focus();input.select();feedback.textContent='Selecione e copie o link acima para compartilhar.'; }
  });
};
