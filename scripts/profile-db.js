'use strict';
const fs=require('node:fs');
const path=require('node:path');
const {exige}=require('./env');
(async()=>{
  const testing=process.argv.includes('--test');
  const customers=process.argv.includes('--customers');
  const browse=process.argv.includes('--browse');
  const categories=process.argv.includes('--categories');
  const referrals=process.argv.includes('--referrals');
  const sql=referrals?(testing?'referral-security.sql':'../supabase/09-referrals.sql'):categories?(testing?'category-security.sql':'../supabase/08-category-art.sql'):browse?(testing?'browse-security.sql':'../supabase/07-browse-before-payment.sql'):customers?(testing?'customer-security.sql':'../supabase/06-customer-features.sql'):(testing?'profile-security.sql':'../supabase/05-profile.sql');
  const response=await fetch('https://api.supabase.com/v1/projects/yvwdhuphzyjfhfsqdeho/database/query',{
    method:'POST',headers:{Authorization:`Bearer ${exige('SUPABASE_ACCESS_TOKEN','configurar perfil')}`,'Content-Type':'application/json'},
    body:JSON.stringify({query:fs.readFileSync(path.join(__dirname,sql),'utf8'),read_only:false}),
    signal:AbortSignal.timeout(60000),redirect:'error',
  });
  if(!response.ok)throw new Error(`Migração: HTTP ${response.status} ${String((await response.json()).message || '').slice(0,250)}`);
  console.log(testing?'Testes de segurança aprovados; dados de teste revertidos.':referrals?'Indicações habilitadas; confirmação Lowify permanece pendente.':categories?'Capas de categorias habilitadas.':browse?'Navegação sem pagamento habilitada; vídeos permanecem protegidos.':customers?'Migração de sessões e pedidos aplicada.':'Migração de perfil e dispositivos aplicada.');
})().catch(e=>{console.error(e.message);process.exitCode=1;});
