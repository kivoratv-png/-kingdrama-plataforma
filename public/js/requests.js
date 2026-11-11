import { api,esc,icon } from './lib.js?v=040e637f9962';
const labels={received:'Pedido recebido',reviewing:'Em análise',adding:'Sendo adicionado',available:'Já disponível',unavailable:'Indisponível no momento'};
export async function requests(ctx) {
  if(ctx.state.me.user.isAdmin)return `<div class="wrap narrow page-head"><h1>Pedidos de clientes</h1><p>Os pedidos são gerenciados na seção exclusiva do painel administrativo.</p></div>`;
  const data=await api('/api/requests');
  const blocked=!data.unlimited && data.used>=data.limit;
  return `<div class="page-head narrow"><h1>Pedir um dorama</h1><p>Sentiu falta de uma história? Conte para a gente.</p></div><div class="wrap narrow stack request-page">
    <section class="profile-card settings-section"><h2>Seu próximo dorama</h2><p class="hint">${data.unlimited?'Pedidos ilimitados ativos no seu plano.':`${data.used} de ${data.limit} pedidos utilizados. Cada conta pode pedir até 3 doramas.`} O envio de um pedido não garante sua inclusão no catálogo.</p>
    ${blocked?`<div class="alert alert-info">Você já utilizou seus 3 pedidos.</div><a class="btn btn-primary" href="mailto:kivoratv@gmail.com?subject=Adicionar%20Pedidos%20ilimitados%20ao%20meu%20plano">Adicionar Pedidos ilimitados ao plano</a><p class="hint">Fale com o suporte para consultar condições e ativar o adicional. Nenhuma cobrança é feita por este botão.</p>`:
    `<form class="stack" data-request-form><div class="field"><label for="drama-name">Nome do dorama</label><input class="input" id="drama-name" name="drama" minlength="2" maxlength="150" required placeholder="Ex: Pousando no Amor"></div><div class="field"><label for="drama-notes">Detalhes (opcional)</label><textarea class="input" id="drama-notes" name="notes" maxlength="1000" rows="3" placeholder="Ano, país ou outro nome do dorama"></textarea></div><button class="btn btn-primary" type="submit">${icon.request} Enviar pedido</button><p class="hint" data-message role="status"></p></form>`}</section>
    <section class="stack" aria-labelledby="my-requests"><h2 id="my-requests">Meus pedidos</h2>${data.requests.length?data.requests.map(r=>`<article class="profile-card settings-section"><div class="settings-heading"><h3>${esc(r.name)}</h3><span class="request-status">${esc(labels[r.display_status] || labels[r.status])}</span></div><p class="hint">Pedido em ${esc(new Date(r.created_at).toLocaleDateString('pt-BR'))}</p>${r.admin_note?`<p>${esc(r.admin_note)}</p>`:''}${r.title_id?`<a class="btn btn-ghost" href="/titulo/${encodeURIComponent(r.title_id)}">Ver no catálogo ${icon.chev}</a>`:''}</article>`).join(''):'<div class="profile-card"><p>Seus pedidos e as atualizações da equipe aparecerão aqui.</p></div>'}</section></div>`;
}
requests.mount=(root,ctx)=>{
  root.querySelector('[data-request-form]')?.addEventListener('submit',async e=>{
    e.preventDefault();const form=e.currentTarget,button=form.querySelector('button'),msg=form.querySelector('[data-message]');button.disabled=true;msg.textContent='Enviando…';
    try{await api('/api/requests',{method:'POST',body:{name:form.elements.drama.value,notes:form.elements.notes.value}});ctx.navigate('/pedidos',{replace:true});}catch(error){msg.textContent=error.message;button.disabled=false;}
  });
};
