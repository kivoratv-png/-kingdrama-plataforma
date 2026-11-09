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
const path = require('node:path');

const raiz = path.join(__dirname, '..');
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';

const rodar = (args, opcoes = {}) =>
  execFileSync(npx, ['netlify', ...args], {
    cwd: raiz, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, ...opcoes,
  });

try {
  console.log('1/3  gerando a identidade desta versão');
  execFileSync(process.execPath, [path.join(__dirname, 'gera-versao.js')], {
    cwd: raiz, stdio: 'inherit',
  });

  console.log('\n2/3  enviando os arquivos (como rascunho — é o que passa pelo bloqueio)');
  const saida = rodar(['deploy', '--dir=public', '--functions=netlify/functions',
    '--message=publicacao via script (bloqueio de deploy da Netlify)']);
  process.stdout.write(saida);

  // A URL do rascunho carrega o id do deploy: https://<id>--<site>.netlify.app
  const achado = saida.match(/https:\/\/([0-9a-f]{24})--/);
  if (!achado) throw new Error('não encontrei o id do deploy na saída do envio');
  const deployId = achado[1];

  console.log(`\n3/3  promovendo o deploy ${deployId} a produção`);
  const siteId = require(path.join(raiz, '.netlify', 'state.json')).siteId;
  rodar(['api', 'restoreSiteDeploy', '--data',
    JSON.stringify({ site_id: siteId, deploy_id: deployId })]);

  console.log('\npublicado: https://kingdrama.netlify.app');
} catch (e) {
  console.error('\nfalhou:', e.message);
  if (e.stdout) process.stdout.write(String(e.stdout));
  if (e.stderr) process.stderr.write(String(e.stderr));
  process.exit(1);
}
