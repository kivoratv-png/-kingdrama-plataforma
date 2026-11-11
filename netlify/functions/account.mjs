const reply = (status, body) => new Response(JSON.stringify(body), { status, headers: {
  'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store',
  'X-Content-Type-Options':'nosniff', 'Vary':'Authorization',
} });

export default async function account(request) {
  if (request.method !== 'POST') return reply(405,{error:'Método não permitido.'});
  const origin = request.headers.get('origin');
  if ((origin && origin !== new URL(request.url).origin) || request.headers.get('sec-fetch-site') === 'cross-site') return reply(403,{error:'Origem não permitida.'});
  const authorization=request.headers.get('authorization') || '';
  if (authorization.length>8192 || !/^Bearer [\w-]+\.[\w-]+\.[\w-]+$/.test(authorization)) return reply(401,{error:'Entre na sua conta.'});
  const base=process.env.SUPABASE_URL, key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) return reply(503,{error:'Serviço temporariamente indisponível.'});
  const call=(path,method='GET',body,auth=authorization)=>fetch(base+path,{method,
    headers:{apikey:key,Authorization:auth,'Content-Type':'application/json'},
    body:body===undefined?undefined:JSON.stringify(body),redirect:'error',signal:AbortSignal.timeout(12000)});
  try {
    const raw=await request.text();
    if(raw.length>4096) return reply(400,{error:'Pedido inválido.'});
    let body; try { body=JSON.parse(raw); } catch { return reply(400,{error:'Pedido inválido.'}); }
    if(!['password','delete'].includes(body?.action)) return reply(400,{error:'Ação inválida.'});
    if(typeof body.currentPassword!=='string' || !body.currentPassword || body.currentPassword.length>1024) return reply(400,{error:'Digite a senha atual.'});
    if(body.action==='password' && (typeof body.password!=='string' || body.password.length<8 || body.password.length>128 || body.password!==body.confirmPassword)) return reply(400,{error:'Repita a nova senha nos dois campos, com 8 a 128 caracteres.'});
    if(body.action==='delete' && body.confirmDelete!==true) return reply(400,{error:'Confirme a exclusão da conta.'});
    const userRes=await call('/auth/v1/user');
    if(!userRes.ok) return reply(401,{error:'Sua sessão expirou. Entre novamente.'});
    const user=await userRes.json();
    // Check session existence as well as the JWT (revoked tokens can remain unexpired).
    const devicesRes=await call('/rest/v1/rpc/account_devices','POST',{});
    if(!devicesRes.ok) return reply(503,{error:'Não foi possível validar sua sessão.'});
    const devices=await devicesRes.json();
    if(!devices.devices?.some(d=>d.current)) return reply(401,{error:'Sua sessão foi desconectada.'});
    const verifiedRes=await call('/auth/v1/token?grant_type=password','POST',{email:user.email,password:body.currentPassword},`Bearer ${key}`);
    if(!verifiedRes.ok) return reply(verifiedRes.status===429?429:400,{error:verifiedRes.status===429?'Muitas tentativas. Aguarde e tente novamente.':'Senha atual incorreta.'});
    const verified=await verifiedRes.json();
    // Verification must not leave a second logged-in device behind.
    if(verified.access_token) {
      const cleanup=await call('/auth/v1/logout?scope=local','POST',{},`Bearer ${verified.access_token}`);
      if(!cleanup.ok) return reply(503,{error:'Não foi possível concluir a confirmação. Tente novamente.'});
    }
    if(verified.user?.id!==user.id) return reply(403,{error:'Não foi possível confirmar a conta.'});
    const result=await call(`/auth/v1/admin/users/${encodeURIComponent(user.id)}`,
      body.action==='delete'?'DELETE':'PUT',body.action==='delete'?{should_soft_delete:false}:{password:body.password},`Bearer ${key}`);
    if(!result.ok) return reply(400,{error:body.action==='password'?'Não foi possível alterar a senha. Use uma senha diferente e tente novamente.':'Não foi possível excluir a conta. Entre em contato com o suporte.'});
    return reply(200,{ok:true});
  } catch { return reply(503,{error:'Não foi possível concluir. Tente novamente.'}); }
}
export const config={rateLimit:{windowLimit:6,windowSize:60,aggregateBy:'ip',action:'rate_limit'}};
