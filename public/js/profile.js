import { api, esc, icon, initials, toast } from './lib.js?v=48397e6a9d1c';

const date = value => value ? new Date(value).toLocaleString('pt-BR', { dateStyle: 'long', timeStyle: 'short' }) : 'Não informado';
const statuses = { active:'Ativa', pending:'Pendente', canceled:'Cancelada', refunded:'Reembolsada', expired:'Expirada', chargeback:'Contestada' };
const deviceName = agent => {
  const os = /Android/i.test(agent) ? 'Android' : /iPhone|iPad/i.test(agent) ? 'iPhone / iPad' : /Windows/i.test(agent) ? 'Windows' : /Mac/i.test(agent) ? 'Mac' : 'Dispositivo';
  const browser = /Edg/i.test(agent) ? 'Edge' : /Firefox/i.test(agent) ? 'Firefox' : /Chrome|CriOS/i.test(agent) ? 'Chrome' : /Safari/i.test(agent) ? 'Safari' : 'Navegador';
  return `${os} · ${browser}`;
};
const passwordField = (name, label, autocomplete) => `<div class="field"><label for="${name}">${label}</label><input class="input" type="password" id="${name}" name="${name}" required autocomplete="${autocomplete}" ${autocomplete==='new-password'?'minlength="8" maxlength="128"':'maxlength="1024"'}></div>`;

export function profile(ctx) {
  const { user, access } = ctx.state.me;
  const expired = access.periodEnd && new Date(access.periodEnd) <= new Date();
  const status = expired && access.status === 'active' ? 'expired' : access.status;
  return `<div class="page-head narrow"><h1>Perfil</h1><p>Sua conta, assinatura e segurança.</p></div>
  <div class="wrap narrow stack profile-settings">
    <section class="profile-card"><span class="avatar lg">${esc(initials(user))}</span><div class="who"><strong>${esc(user.name || 'Minha conta')}</strong><span>${esc(user.email)}</span></div></section>
    <section class="profile-card settings-section" aria-labelledby="subscription-heading">
      <div class="settings-heading"><h2 id="subscription-heading">Minha assinatura</h2><span class="status-badge ${access.active?'status-active':'status-other'}">${esc(statuses[status] || 'Sem assinatura')}</span></div>
      <dl class="account-facts"><div><dt>Plano</dt><dd>${esc(access.planCode || 'Ainda não contratado')}</dd></div><div><dt>${expired?'Expirou em':'Vencimento'}</dt><dd>${access.periodEnd?esc(date(access.periodEnd)):access.active?'Sem data de expiração':'Sem assinatura ativa'}</dd></div><div><dt>Conta criada em</dt><dd>${esc(date(user.createdAt))}</dd></div></dl>
      ${access.active?'':'<a class="btn btn-primary" href="/ofertas">Ver ofertas de assinatura</a>'}
    </section>
    <section class="profile-card settings-section referral-promo"><h2>Indique e ganhe dias grátis</h2><p class="hint">A cada amigo que pagar pelo seu link, você ganha 10 dias.</p><a class="btn btn-primary" href="/indicacoes">${icon.gift} ${access.active?'Ver minhas indicações':'Conhecer o benefício'}</a>${access.active?'':'<p class="hint">Geração de link exclusiva para assinantes com acesso ativo.</p>'}</section>
    ${user.isAdmin?'<section id="admin-requests" class="profile-card settings-section"><h2>Pedidos de clientes</h2><p class="hint">Para analisar os pedidos e vinculá-los ao catálogo, use a seção Pedidos no painel administrativo, acessado pelo link separado.</p></section>':''}
    <form class="profile-card settings-section" data-name-form>
      <h2>Dados da conta</h2><div class="field"><label for="profile-name">Nome de exibição</label><input class="input" id="profile-name" name="displayName" maxlength="60" value="${esc(user.name || '')}" autocomplete="name" required></div>
      <div class="field"><label for="profile-email">E-mail cadastrado</label><input class="input" id="profile-email" value="${esc(user.email)}" type="email" readonly aria-describedby="email-hint"><p class="hint" id="email-hint">O e-mail identifica sua conta e não pode ser alterado aqui.</p></div>
      <button class="btn btn-ghost" type="submit">Salvar nome</button><p class="hint" data-feedback role="status"></p>
    </form>
    <form class="profile-card settings-section" data-password-form>
      <h2>Alterar senha</h2><p class="hint">Confirme a senha atual e digite a nova senha duas vezes. Use pelo menos 8 caracteres.</p>
      ${passwordField('currentPassword','Senha atual','current-password')}${passwordField('password','Nova senha','new-password')}${passwordField('confirmPassword','Repita a nova senha','new-password')}
      <button class="btn btn-ghost" type="submit">Alterar senha</button><p class="hint" data-feedback role="status"></p>
    </form>
    <section class="profile-card settings-section" aria-labelledby="devices-heading"><div class="settings-heading"><h2 id="devices-heading">Dispositivos conectados</h2><button class="btn btn-ghost" type="button" data-refresh-devices>Atualizar</button></div>
      <p class="hint">O plano básico permite 1 dispositivo conectado. Ao entrar em outro dispositivo, o acesso anterior é encerrado. Cada navegador com login conta como um dispositivo.</p>
      <div data-devices aria-live="polite">Carregando dispositivos…</div>
    </section>
    <nav class="list-links" aria-label="Conta">${user.isAdmin?'':`<a href="/pedidos">${icon.request} Pedir doramas / Meus pedidos ${icon.chev}</a>`}<a href="/politica-de-privacidade">${icon.lock} Política de Privacidade ${icon.chev}</a><button type="button" data-logout>${icon.logout} Sair da conta</button></nav>
    <section class="profile-card settings-section danger-section"><h2>Excluir minha conta</h2><p class="hint">Esta ação é permanente: seu perfil, assinatura registrada, lista e histórico serão removidos. A exclusão não cancela cobranças de um provedor de pagamento; fale com o suporte se houver uma assinatura recorrente.</p>
      <details><summary class="delete-summary">Excluir conta</summary><form class="stack" data-delete-form>
        ${passwordField('deletePassword','Confirme sua senha','current-password')}
        <label class="delete-confirm"><input type="checkbox" name="confirmDelete" required> Entendo que minha conta e meus dados serão excluídos permanentemente.</label>
        <button class="btn btn-danger" type="submit">Excluir minha conta permanentemente</button><p class="hint" data-feedback role="status"></p>
      </form></details>
    </section>
    <p class="hint">A administração pode consultar sua página atual, título aberto e última atividade para acompanhar acessos e problemas de reprodução. O acompanhamento começa após o login.</p>
  </div>`;
}

profile.mount = (root, ctx) => {
  let disposed=false;
  const run = async (form, action) => {
    const button=form.querySelector('button[type="submit"]'), feedback=form.querySelector('[data-feedback]');
    button.disabled=true; feedback.textContent='Aguarde…';
    try { await action(feedback); } catch(error) { feedback.textContent=error.message; }
    finally { button.disabled=false; }
  };
  root.querySelector('[data-name-form]').addEventListener('submit',e=>{
    e.preventDefault(); const form=e.currentTarget;
    run(form,async feedback=>{await api('/api/me',{method:'PATCH',body:{name:form.elements.displayName.value}}); await ctx.refreshMe(); feedback.textContent='Nome atualizado.'; ctx.navigate('/perfil',{replace:true});});
  });
  root.querySelector('[data-password-form]').addEventListener('submit',e=>{
    e.preventDefault(); const form=e.currentTarget, fields=form.elements;
    run(form,async feedback=>{
      if(fields.password.value!==fields.confirmPassword.value) throw new Error('As duas novas senhas precisam ser iguais.');
      if(fields.password.value===fields.currentPassword.value) throw new Error('Escolha uma senha diferente da atual.');
      await api('/api/account',{method:'POST',body:{action:'password',currentPassword:fields.currentPassword.value,password:fields.password.value,confirmPassword:fields.confirmPassword.value}});
      form.reset(); feedback.textContent='Senha alterada com sucesso.';
    });
  });
  const loadDevices=async()=>{
    const container=root.querySelector('[data-devices]');
    try {
      const data=await api('/api/devices'); if(disposed)return;
      container.innerHTML=`<p class="hint">Limite do seu plano: ${esc(data.limit)} dispositivo(s).${data.allowed?'':' Desconecte outro dispositivo para liberar o acesso neste navegador.'}</p>`+
        (data.devices.length?data.devices.map(d=>`<div class="device-row"><div><strong>${esc(deviceName(d.agent || ''))}${d.current?' · Este dispositivo':''}</strong><span>Conectado em ${esc(date(d.createdAt))}</span><span>Última atividade: ${esc(date(d.lastSeen))}</span></div><button class="btn btn-ghost" type="button" data-revoke="${esc(d.id)}" data-current="${d.current}">Desconectar</button></div>`).join(''):'<p class="hint">Esta sessão foi desconectada. Entre novamente.</p>');
    } catch(error) { if(!disposed)container.textContent=error.message; }
  };
  root.querySelector('[data-refresh-devices]').addEventListener('click',loadDevices);
  root.querySelector('[data-devices]').addEventListener('click',async e=>{
    const button=e.target.closest('[data-revoke]'); if(!button)return;
    button.disabled=true;
    try {
      const result=await api('/api/devices',{method:'DELETE',body:{sessionId:button.dataset.revoke}});
      if(!result.ok)throw new Error('O dispositivo já foi desconectado. Atualize a lista.');
      if(button.dataset.current==='true') { await api('/api/auth/logout',{method:'POST'});await ctx.refreshMe();ctx.navigate('/entrar',{replace:true}); }
      else { toast('Dispositivo desconectado');await loadDevices(); }
    } catch(error){toast(error.message);button.disabled=false;}
  });
  root.querySelector('[data-delete-form]').addEventListener('submit',e=>{
    e.preventDefault();const form=e.currentTarget;
    run(form,async()=>{
      await api('/api/account',{method:'POST',body:{action:'delete',currentPassword:form.elements.deletePassword.value,confirmDelete:form.elements.confirmDelete.checked}});
      await api('/api/auth/logout',{method:'POST'}).catch(()=>{});await ctx.refreshMe();ctx.navigate('/',{replace:true});toast('Sua conta foi excluída.');
    });
  });
  loadDevices();
  return ()=>{disposed=true;};
};
