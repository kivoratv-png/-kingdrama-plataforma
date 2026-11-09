// ============================================================================
// Copia as chaves que já estão na Netlify para o .env local.
//
// As chaves do projeto (Supabase service_role, Bunny) vivem nas variáveis de
// ambiente do site na Netlify. Os scripts de catálogo rodam aqui no computador
// e precisam delas — este script faz a ponte, sem você ter que copiar e colar
// chave nenhuma à mão.
//
// Ele NÃO imprime valor nenhum: mostra só o nome de cada variável e se ela foi
// encontrada. O .env fica no .gitignore, então não vai para o GitHub.
//
//   node scripts/puxar-chaves.js
//
// Pré-requisito: netlify-cli instalado e conectado à conta certa
//   npx netlify login     (uma vez)
//   npx netlify status    (confere qual site está ligado a esta pasta)
// ============================================================================
'use strict';

const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const raiz = path.join(__dirname, '..');
const destino = path.join(raiz, '.env');

// Chama o arquivo de entrada do netlify-cli com o node. No Windows o Node se
// recusa a executar um .cmd direto, e passar pelo shell atrapalha as aspas.
function achaNetlify() {
  const candidatos = [
    path.join(process.env.APPDATA || '', 'npm', 'node_modules', 'netlify-cli', 'bin', 'run.js'),
    path.join(raiz, 'node_modules', 'netlify-cli', 'bin', 'run.js'),
    '/usr/local/lib/node_modules/netlify-cli/bin/run.js',
  ];
  const achado = candidatos.find((c) => c && fs.existsSync(c));
  if (!achado) {
    console.error('não encontrei o netlify-cli. Instale com:  npm i -g netlify-cli');
    process.exit(1);
  }
  return achado;
}

// Nome na Netlify -> nome que os scripts daqui procuram.
const QUERO = {
  SUPABASE_URL: 'SUPABASE_URL',
  SUPABASE_SERVICE_ROLE_KEY: 'SUPABASE_SERVICE_ROLE_KEY',
  BUNNY_LIBRARY_ID: 'BUNNY_LIBRARY_ID',
  BUNNY_STREAM_KEY: 'BUNNY_STREAM_KEY',
  BUNNY_API_KEY: 'BUNNY_STREAM_KEY',
};

const cli = achaNetlify();

/** Roda o netlify-cli e devolve a saída SÓ na memória deste processo. */
function netlify(args) {
  return execFileSync(process.execPath, [cli, ...args], {
    cwd: raiz, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function comoJson(texto) {
  const i = Math.min(...[texto.indexOf('{'), texto.indexOf('[')].filter((n) => n >= 0));
  if (!Number.isFinite(i)) return null;
  try { return JSON.parse(texto.slice(i)); } catch { return null; }
}

// Três lugares onde as variáveis podem estar, porque a Netlify mudou o formato
// no caminho e sites antigos ficaram com elas dentro das configurações de build
// — onde o "env:list" não enxerga.
const fontes = [];

try {
  const j = comoJson(netlify(['env:list', '--json']));
  if (j && !Array.isArray(j)) fontes.push({ de: 'env:list', vars: j });
} catch { /* segue para a próxima */ }

let site = null;
try {
  const estado = JSON.parse(fs.readFileSync(path.join(raiz, '.netlify', 'state.json'), 'utf8'));
  site = comoJson(netlify(['api', 'getSite', '--data', JSON.stringify({ site_id: estado.siteId })]));
  const antigas = site?.build_settings?.env;
  if (antigas && typeof antigas === 'object') fontes.push({ de: 'configurações de build', vars: antigas });
} catch { /* segue */ }

try {
  if (site?.account_slug) {
    const lista = comoJson(netlify(['api', 'getEnvVars', '--data',
      JSON.stringify({ account_id: site.account_slug, site_id: site.id })]));
    if (Array.isArray(lista)) {
      const vars = {};
      for (const v of lista) {
        const valor = v?.values?.find((x) => x?.value)?.value;
        if (v?.key && valor) vars[v.key] = valor;
      }
      if (Object.keys(vars).length) fontes.push({ de: 'variáveis da conta', vars });
    }
  }
} catch { /* segue */ }

if (!fontes.length) {
  console.error('não consegui ler as variáveis da Netlify.');
  console.error('confira se você está conectado:  npx netlify status');
  process.exit(1);
}

const dados = {};
for (const f of fontes) {
  console.log(`${f.de}: ${Object.keys(f.vars).length} variáveis`);
  Object.assign(dados, f.vars);
}

const encontrados = {};
for (const [naNetlify, aqui] of Object.entries(QUERO)) {
  const v = dados[naNetlify];
  if (typeof v === 'string' && v.trim() && !encontrados[aqui]) encontrados[aqui] = v.trim();
}

// Com --todas, traz também o resto das variáveis do site. Serve para recriar a
// configuração em outro site da Netlify sem precisar olhar valor nenhum: o
// player, por exemplo, depende de BUNNY_TOKEN_KEY, que não está na lista acima.
if (process.argv.includes('--todas')) {
  for (const [k, v] of Object.entries(dados)) {
    if (typeof v === 'string' && v.trim() && !encontrados[k]) encontrados[k] = v.trim();
  }
}

console.log(`\nno total, ${Object.keys(dados).length} variáveis. Das que preciso:`);
for (const nome of Object.keys(QUERO)) {
  console.log(`   ${dados[nome] ? 'achei  ' : 'não tem'}  ${nome}`);
}

// O que a Netlify não tiver, pega do .bunny.env que já existe no computador.
const bunnyEnv = path.join(process.env.USERPROFILE || process.env.HOME || '', 'Desktop', 'DORAMAS PLUS', '.bunny.env');
if (fs.existsSync(bunnyEnv)) {
  for (const linha of fs.readFileSync(bunnyEnv, 'utf8').split(/\r?\n/)) {
    const corte = linha.indexOf('=');
    if (corte < 1) continue;
    const k = linha.slice(0, corte).trim();
    const v = linha.slice(corte + 1).trim();
    if (v && QUERO[k] && !encontrados[QUERO[k]]) {
      encontrados[QUERO[k]] = v;
      console.log(`   do .bunny.env  ${k}`);
    }
  }
}

const faltando = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'].filter((k) => !encontrados[k]);
if (faltando.length) {
  console.error(`\nfaltou: ${faltando.join(', ')}`);
  console.error('Ponha no .env à mão (veja .env.exemplo) ou crie a variável na Netlify.');
}

// Preserva o que já estiver no .env e não veio da Netlify.
const atual = {};
if (fs.existsSync(destino)) {
  for (const linha of fs.readFileSync(destino, 'utf8').split(/\r?\n/)) {
    const corte = linha.indexOf('=');
    if (corte > 0 && !linha.trim().startsWith('#')) atual[linha.slice(0, corte).trim()] = linha.slice(corte + 1);
  }
}
const final = { ...atual, ...encontrados };

const texto = [
  '# Gerado por scripts/puxar-chaves.js a partir das variáveis do site na Netlify.',
  '# Não versionar: o .gitignore já ignora este arquivo.',
  `# Gerado em ${new Date().toISOString()}`,
  '',
  ...Object.entries(final).map(([k, v]) => `${k}=${v}`),
  '',
].join('\n');

fs.writeFileSync(destino, texto, { encoding: 'utf8' });
console.log(`\n.env gravado com ${Object.keys(final).length} variáveis (valores não exibidos).`);
