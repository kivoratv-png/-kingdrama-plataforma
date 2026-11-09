// ============================================================================
// Copia as chaves do .env para as variáveis de ambiente do site na Netlify.
//
// É o caminho inverso do puxar-chaves.js, e serve para montar um site novo sem
// você ter que colar chave nenhuma no painel: o valor sai do .env e vai direto
// para a Netlify, sem passar pela tela.
//
//   node scripts/empurrar-chaves.js            manda para o site ligado à pasta
//   node scripts/empurrar-chaves.js --conferir  só diz o que falta, não grava
//
// Só vão as variáveis que a função do player realmente usa (veja
// netlify/functions/play.js). A chave de API da Bunny NÃO vai: ela é de
// carregar catálogo, roda aqui no seu computador, e não tem por que existir no
// servidor. Quanto menos chave no ar, melhor.
// ============================================================================
'use strict';

const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { opcional } = require('./env');

const raiz = path.join(__dirname, '..');
const conferir = process.argv.includes('--conferir');

// O que a função do player precisa para funcionar.
const PRECISA = [
  { nome: 'SUPABASE_URL', porque: 'endereço do banco' },
  { nome: 'SUPABASE_SERVICE_ROLE_KEY', porque: 'ler o id do vídeo sem passar pelo RLS' },
  { nome: 'BUNNY_TOKEN_KEY', porque: 'assinar a URL do vídeo — sem ela o "Assistir" não funciona' },
  { nome: 'BUNNY_LIBRARY_ID', porque: 'qual biblioteca da Bunny' },
];

function achaNetlify() {
  const candidatos = [
    path.join(process.env.APPDATA || '', 'npm', 'node_modules', 'netlify-cli', 'bin', 'run.js'),
    path.join(raiz, 'node_modules', 'netlify-cli', 'bin', 'run.js'),
    '/usr/local/lib/node_modules/netlify-cli/bin/run.js',
  ];
  const achado = candidatos.find((c) => c && fs.existsSync(c));
  if (!achado) { console.error('instale o netlify-cli:  npm i -g netlify-cli'); process.exit(1); }
  return achado;
}

const cli = achaNetlify();
const estado = JSON.parse(fs.readFileSync(path.join(raiz, '.netlify', 'state.json'), 'utf8'));

// Qual site vai receber — importante conferir antes de escrever em qualquer um.
let site = null;
try {
  const out = execFileSync(process.execPath, [cli, 'api', 'getSite', '--data', JSON.stringify({ site_id: estado.siteId })],
    { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
  site = JSON.parse(out.slice(out.indexOf('{')));
} catch {
  console.error('não consegui identificar o site ligado a esta pasta.');
  process.exit(1);
}
console.log(`site: ${site.name} (${site.ssl_url || site.url}) — conta ${site.account_slug}\n`);

const temos = {};
const faltam = [];
for (const v of PRECISA) {
  const valor = opcional([v.nome]);
  if (valor) temos[v.nome] = valor;
  else faltam.push(v);
}

for (const v of PRECISA) {
  console.log(`   ${temos[v.nome] ? 'tenho  ' : 'FALTA  '}  ${v.nome.padEnd(28)} ${v.porque}`);
}

if (faltam.length) {
  console.log(`\nfaltando ${faltam.length}. Ponha no .env e rode de novo:`);
  for (const v of faltam) console.log(`   ${v.nome}=`);
}

if (conferir) { console.log('\n(--conferir: nada foi gravado)'); process.exit(0); }
if (!Object.keys(temos).length) { console.log('\nnada a enviar.'); process.exit(0); }

console.log('');
let ok = 0;
for (const [nome, valor] of Object.entries(temos)) {
  try {
    // O valor vai como argumento do processo filho; não é impresso em lugar nenhum.
    execFileSync(process.execPath, [cli, 'env:set', nome, valor, '--force'],
      { cwd: raiz, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
    console.log(`   gravada  ${nome}`);
    ok++;
  } catch (e) {
    console.log(`   FALHOU   ${nome}: ${String(e.message).split('\n').find((l) => /Error|error/.test(l)) || 'erro'}`);
  }
}

console.log(`\n${ok} de ${Object.keys(temos).length} variáveis no site.`);
if (faltam.length) {
  console.log('O player só vai funcionar quando as que faltam estiverem lá.');
}
