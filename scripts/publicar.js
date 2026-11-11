'use strict';
// Production deploys are working again. Publish directly so server functions
// receive the production-only secrets; never copy masked values between contexts.
const {execFileSync}=require('node:child_process');
const fs=require('node:fs'),path=require('node:path');
const raiz=path.join(__dirname,'..');
function achaNetlify(){
 const candidates=[path.join(process.env.APPDATA||'','npm/node_modules/netlify-cli/bin/run.js'),path.join(raiz,'node_modules/netlify-cli/bin/run.js'),'/usr/local/lib/node_modules/netlify-cli/bin/run.js'];
 const cli=candidates.find(file=>fs.existsSync(file));if(!cli)throw Error('Instale o netlify-cli para publicar.');return cli;
}
try{
 const cli=achaNetlify();
 const run=args=>execFileSync(process.execPath,[cli,...args],{cwd:raiz,encoding:'utf8',stdio:['ignore','pipe','pipe'],maxBuffer:32*1024*1024});
 const siteId=require(path.join(raiz,'.netlify/state.json')).siteId;
 const site=JSON.parse(run(['api','getSite','--data',JSON.stringify({site_id:siteId})]));
 const variables=JSON.parse(run(['api','getEnvVars','--data',JSON.stringify({account_id:site.account_id,site_id:siteId})]));
 const missing=['SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','BUNNY_LIBRARY_ID','BUNNY_TOKEN_KEY'].filter(key=>{
  const item=variables.find(variable=>variable.key===key);
  return !item?.scopes?.includes('functions')||!item.values?.some(value=>['production','all'].includes(value.context)&&value.value);
 });
 if(missing.length)throw Error('Variáveis ausentes nas funções de produção: '+missing.join(', '));
 console.log('Configuração de produção conferida; valores protegidos.');
 execFileSync(process.execPath,[path.join(__dirname,'gera-versao.js')],{cwd:raiz,stdio:'inherit'});
 process.stdout.write(run(['deploy','--prod','--dir=public','--functions=netlify/functions','--skip-functions-cache','--message=Publicação KingDrama em produção']));
 console.log('Publicado: '+(site.ssl_url||site.url));
}catch(error){console.error('Publicação não concluída: '+(error.status||error.code||error.message));process.exitCode=1;}
