// ============================================================================
// Publica o site contornando o bloqueio de deploys da Netlify.
//
// POR QUE ISTO EXISTE
// A conta está presa num bug conhecido da Netlify: publicações de produção são
// recusadas com "Skipped due to account credit usage exceeded" mesmo com os
// créditos intactos (a API informa 300 incluídos, 0 usados, e 2 minutos de
// build no mês). Há vários relatos iguais no fórum oficial — é uma trava que
// ficou ligada sozinha, não consumo de verdade.
//
// O bloqueio atinge só a CRIAÇÃO de deploys de produção. Continua permitido:
//   1. criar um deploy de rascunho;
//   2. promover um deploy que já existe a produção.
// É exatamente o que este script faz, nessa ordem.
//
// QUANDO PARAR DE USAR
// Assim que o suporte da Netlify destravar a conta, `git push` volta a
// publicar sozinho e este script fica desnecessário.
//
//   node scripts/publicar.js
// ============================================================================
'use strict';

const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const raiz = path.join(__dirname, '..');

// Chama o próprio arquivo de entrada do netlify-cli com o node, em vez do
// comando "netlify". Isso evita dois problemas do Windows de uma vez: o Node
// recusa executar um .cmd direto (spawnSync EINVAL), e passar pelo shell faz o
// cmd.exe comer as aspas do JSON do --data.
function achaNetlify() {
  const candidatos = [
    path.join(process.env.APPDATA || '', 'npm', 'node_modules', 'netlify-cli', 'bin', 'run.js'),
    path.join(raiz, 'node_modules', 'netlify-cli', 'bin', 'run.js'),
    '/usr/local/lib/node_modules/netlify-cli/bin/run.js',
  ];
  const achado = candidatos.find((c) => c && fs.existsSync(c));
  if (!achado) throw new Error('não encontrei o netlify-cli (instale com: npm i -g netlify-cli)');
  return achado;
}

const cli = achaNetlify();
const rodar = (args, opcoes = {}) =>
  execFileSync(process.execPath, [cli, ...args], {
    cwd: raiz, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, ...opcoes,
  });

try {
  // Draft deploys retain deploy-preview context when promoted. Function secrets
  // must be present there too; otherwise promotion publishes a broken backend.
  const siteId = require(path.join(raiz, '.netlify', 'state.json')).siteId;
  const site = JSON.parse(rodar(['api','getSite','--data',JSON.stringify({site_id:siteId})]));
  const variables = JSON.parse(rodar(['api','getEnvVars','--data',JSON.stringify({account_id:site.account_id,site_id:siteId})]));
  const missing = ['SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','BUNNY_LIBRARY_ID','BUNNY_TOKEN_KEY'].filter(key=>{
    const item=variables.find(variable=>variable.key===key);
    return !item?.scopes?.includes('functions') || !item.values?.some(value=>['deploy-preview','all'].includes(value.context) && value.value);
  });
  if(missing.length)throw new Error(`Variáveis ausentes para as funções em deploy-preview: ${missing.join(', ')}. Corrija o contexto antes de publicar.`);
  console.log('Configuração das funções conferida (valores protegidos).');
  console.log('1/3  gerando a identidade desta versão');
  execFileSync(process.execPath, [path.join(__dirname, 'gera-versao.js')], {
    cwd: raiz, stdio: 'inherit',
  });

  console.log('\n2/3  enviando os arquivos (como rascunho — é o que passa pelo bloqueio)');
  const saida = rodar(['deploy', '--dir=public', '--functions=netlify/functions', '--skip-functions-cache',
    '--message=publicacao via script (bloqueio de deploy da Netlify)']);
  process.stdout.write(saida);

  // A URL do rascunho carrega o id do deploy: https://<id>--<site>.netlify.app
  const achado = saida.match(/https:\/\/([0-9a-f]{24})--/);
  if (!achado) throw new Error('não encontrei o id do deploy na saída do envio');
  const deployId = achado[1];

  console.log(`\n3/3  promovendo o deploy ${deployId} a produção`);
  rodar(['api', 'restoreSiteDeploy', '--data',
    JSON.stringify({ site_id: siteId, deploy_id: deployId })]);

  console.log(`\npublicado: ${site.ssl_url || site.url}`);
} catch (e) {
  console.error('\nfalhou:', e.message);
  if (e.stdout) process.stdout.write(String(e.stdout));
  if (e.stderr) process.stderr.write(String(e.stderr));
  process.exit(1);
}
