'use strict';
const {exige}=require('./env');
(async()=>{
  const url='https://api.supabase.com/v1/projects/yvwdhuphzyjfhfsqdeho/config/auth';
  const headers={Authorization:`Bearer ${exige('SUPABASE_ACCESS_TOKEN','configurar código por e-mail')}`,'Content-Type':'application/json'};
  const template='<h2>Seu código de acesso ao KINGDRAMA</h2><p>Digite este código na plataforma para entrar:</p><p style="font-size:32px;font-weight:bold;letter-spacing:5px">{{ .Token }}</p><p>O código é de uso único. Se você não solicitou o acesso, ignore este e-mail. Não compartilhe seu código.</p>';
  const response=await fetch(url,{method:'PATCH',headers,body:JSON.stringify({mailer_autoconfirm:true,mailer_templates_magic_link_content:template,mailer_subjects_magic_link:'Seu código de acesso ao KINGDRAMA'}),signal:AbortSignal.timeout(15000),redirect:'error'});
  if(!response.ok){const error=await response.json().catch(()=>({}));throw Error(`Configuração: HTTP ${response.status} ${JSON.stringify(error).slice(0,600)}`);}
  const data=await response.json();
  if(data.smtp_host && data.mailer_templates_magic_link_content?.includes('{{ .Token }}')) {
    require('node:fs').writeFileSync(require('node:path').join(__dirname,'../public/config/auth.json'),JSON.stringify({emailCodeEnabled:true},null,2)+'\n');
  }
  console.log(JSON.stringify({signupWithoutEmailConfirmation:data.mailer_autoconfirm,codeTemplate:data.mailer_templates_magic_link_content?.includes('{{ .Token }}'),customSMTP:!!data.smtp_host}));
})().catch(e=>{console.error(e.message);process.exitCode=1;});
