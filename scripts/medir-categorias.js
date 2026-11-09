// ============================================================================
// Confere as regras de scripts/categorias.js contra o catálogo inteiro.
//
// Serve para olhar o resultado ANTES de gravar qualquer coisa no banco: quantos
// títulos caem em cada prateleira, quantos ficam sem nenhuma, e uma amostra de
// cada uma para ler com os próprios olhos e ver se a gaveta faz sentido.
//
//   node scripts/medir-categorias.js [caminho-do-catalogo.json] [--amostra N]
// ============================================================================
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { classifica, idioma, PRATELEIRAS } = require('./categorias');

const args = process.argv.slice(2);
const nAmostra = Number((args.find((a) => a.startsWith('--amostra=')) || '').split('=')[1]) || 6;
const caminho = args.find((a) => !a.startsWith('--'))
  || path.join(process.env.USERPROFILE || process.env.HOME || '', 'Desktop', 'DORAMAS PLUS', 'catalogo_completo.json');

if (!fs.existsSync(caminho)) {
  console.error('não encontrei o catálogo em:', caminho);
  process.exit(1);
}

const catalogo = JSON.parse(fs.readFileSync(caminho, 'utf8'));
console.log('catálogo:', catalogo.length, 'registros\n');

const conta = new Map();
const exemplos = new Map();
const quantas = new Map();
const semNada = [];

for (const item of catalogo) {
  const cats = classifica(item);
  quantas.set(cats.length, (quantas.get(cats.length) || 0) + 1);
  if (!cats.length) semNada.push(item);
  for (const c of cats) {
    conta.set(c, (conta.get(c) || 0) + 1);
    if (!exemplos.has(c)) exemplos.set(c, []);
    if (exemplos.get(c).length < nAmostra) exemplos.get(c).push(item.title);
  }
}

const larg = Math.max(...PRATELEIRAS.map((p) => p.nome.length));
console.log('PRATELEIRA'.padEnd(larg + 2), 'TÍTULOS');
for (const p of [...PRATELEIRAS].sort((a, b) => a.posicao - b.posicao)) {
  const n = conta.get(p.id) || 0;
  const pct = (100 * n / catalogo.length).toFixed(1);
  console.log(p.nome.padEnd(larg + 2), String(n).padStart(5), `(${pct}%)`);
}

const dub = catalogo.filter((c) => idioma(c) === 'dublado').length;
const leg = catalogo.filter((c) => idioma(c) === 'legendado').length;
console.log('\nidioma: dublado', dub, '| legendado', leg, '| sem idioma', catalogo.length - dub - leg);

console.log('\nquantas prateleiras por título:');
for (const [k, v] of [...quantas.entries()].sort((a, b) => a[0] - b[0])) {
  console.log('  ', k, 'prateleira(s):', v, `(${(100 * v / catalogo.length).toFixed(1)}%)`);
}

console.log('\n--- amostra de cada prateleira (ler e julgar) ---');
for (const p of [...PRATELEIRAS].sort((a, b) => a.posicao - b.posicao)) {
  const ex = exemplos.get(p.id) || [];
  console.log(`\n${p.nome} (${conta.get(p.id) || 0})`);
  for (const t of ex) console.log('   -', t);
}

console.log(`\n--- ${semNada.length} títulos sem prateleira nenhuma (amostra) ---`);
for (const item of semNada.slice(0, 25)) console.log('   -', item.title);
