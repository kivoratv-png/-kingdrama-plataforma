import { esc } from './lib.js?v=86226756385f';
const labels={received:'Recebido',reviewing:'Em análise',adding:'Adicionando',available:'Disponível',unavailable:'Indisponível'};
export function mountAdminRequests(container) {
  const client=window.__KD_SB__;
  const load=async()=>{
    container.innerHTML='<p role="status">Carregando pedidos…</p>';
    const { data,error }=await client.rpc('admin_drama_requests');
    if(!container.isConnected)return;
    if(error){container.textContent='Não foi possível carregar os pedidos. Atualize o painel.';return;}
    container.innerHTML=`<div class="settings-heading"><p>${data.requests.length} pedido(s)</p><button type="button" class="btn btn-ghost" data-request-refresh>Atualizar pedidos</button></div><p class="adm-note">Vincule o título do catálogo ao pedido. Quando esse título estiver publicado, o cliente verá “Já disponível” em Meus pedidos.</p><div class="stack">`+
      data.requests.map(r=>`<article class="adm-request"><div class="settings-heading"><h3>${esc(r.name)}</h3><span>${esc(new Date(r.created_at).toLocaleDateString('pt-BR'))}</span></div><p class="adm-note">${esc(r.customer_name || 'Cliente')} · ${esc(r.customer_email)}</p>${r.notes?`<p>${esc(r.notes)}</p>`:''}
      <form class="stack" data-admin-request="${esc(r.id)}"><div class="field"><label for="request-status-${esc(r.id)}">Andamento</label><select class="input" id="request-status-${esc(r.id)}" name="status">${Object.entries(labels).map(([key,label])=>`<option value="${key}" ${key===r.status?'selected':''}>${label}</option>`).join('')}</select></div>
      <div class="field"><label for="request-title-${esc(r.id)}">Título no catálogo</label><select class="input" id="request-title-${esc(r.id)}" name="title"><option value="">Ainda sem título vinculado</option>${data.titles.map(t=>`<option value="${esc(t.id)}" ${t.id===r.title_id?'selected':''}>${esc(t.name)}${t.published?'':' (não publicado)'}</option>`).join('')}</select></div>
      <div class="field"><label for="request-note-${esc(r.id)}">Atualização para o cliente</label><textarea class="input" id="request-note-${esc(r.id)}" name="note" rows="2" maxlength="1000">${esc(r.admin_note)}</textarea></div><button class="btn btn-primary" type="submit">Salvar andamento</button><p data-feedback role="status"></p></form>
      <details><summary class="delete-summary">Gerenciar adicional de pedidos ilimitados</summary><form class="stack" data-addon="${esc(r.user_id)}"><div class="field"><label for="addon-${esc(r.id)}">Ativar até</label><input class="input" type="date" name="until" id="addon-${esc(r.id)}" required></div><p class="adm-note">Ative somente após combinar o adicional com o cliente. Esta ação não realiza cobranças.</p><button class="btn btn-ghost" type="submit">Ativar pedidos ilimitados</button><button class="btn btn-ghost" type="button" data-remove-addon>Remover adicional</button><p data-feedback role="status"></p></form></details></article>`).join('')+'</div>';
    if(!data.requests.length)container.insertAdjacentHTML('beforeend','<p class="adm-note">Nenhum pedido de cliente recebido ainda.</p>');
    container.querySelector('[data-request-refresh]').addEventListener('click',()=>{load().catch(showError);});
    container.querySelectorAll('[data-admin-request]').forEach(form=>form.addEventListener('submit',async e=>{
      e.preventDefault();const button=form.querySelector('button'),message=form.querySelector('[data-feedback]');button.disabled=true;
      const { error }=await client.rpc('admin_update_drama_request',{p_id:form.dataset.adminRequest,p_status:form.elements.status.value,p_title:form.elements.title.value || null,p_note:form.elements.note.value});
      message.textContent=error?error.message:'Andamento salvo. O cliente já pode acompanhar a atualização.';button.disabled=false;
    }));
    const saveAddon=async(form,until)=>{
      const message=form.querySelector('[data-feedback]');form.querySelectorAll('button').forEach(b=>{b.disabled=true;});
      const { error }=await client.rpc('admin_set_request_addon',{p_user:form.dataset.addon,p_until:until});
      message.textContent=error?error.message:until?'Pedidos ilimitados ativados.':'Adicional removido.';form.querySelectorAll('button').forEach(b=>{b.disabled=false;});
    };
    container.querySelectorAll('[data-addon]').forEach(form=>{
      form.addEventListener('submit',e=>{e.preventDefault();saveAddon(form,new Date(form.elements.until.value+'T23:59:59-03:00').toISOString()).catch(showError);});
      form.querySelector('[data-remove-addon]').addEventListener('click',()=>{saveAddon(form,null).catch(showError);});
    });
  };
  const showError=()=>{if(container.isConnected)container.textContent='Falha de conexão. Recarregue o painel para tentar novamente.';};
  load().catch(showError);
}
