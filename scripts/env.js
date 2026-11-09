// ============================================================================
// Lê as chaves de um arquivo .env, sem depender de biblioteca nenhuma.
//
// As chaves ficam SÓ no .env, que o .gitignore já ignora — nunca dentro de um
// script, nunca num commit. Os scripts leem daqui e usam; nada é impresso na
// tela, para que uma chave não apareça num log ou numa captura de tela.
//
// Procura, nesta ordem:
//   1. as variáveis que já estiverem no ambiente
//   2. .env na raiz do projeto
//   3. .bunny.env, para reaproveitar o que já existia na pasta DORAMAS PLUS
//
// Veja .env.exemplo para saber quais chaves cada script precisa.
// ============================================================================
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const raiz = path.join(__dirname, '..');

function leArquivo(caminho) {
  const fora = {};
  if (!caminho || !fs.existsSync(caminho)) return fora;
  for (const linha of fs.readFileSync(caminho, 'utf8').split(/\r?\n/)) {
    const limpa = linha.trim();
    if (!limpa || limpa.startsWith('#')) continue;
    const corte = limpa.indexOf('=');
    if (corte < 1) continue;
    const chave = limpa.slice(0, corte).trim().replace(/^export\s+/, '');
    let valor = limpa.slice(corte + 1).trim();
    if ((valor.startsWith('"') && valor.endsWith('"')) || (valor.startsWith("'") && valor.endsWith("'"))) {
      valor = valor.slice(1, -1);
    }
    if (chave) fora[chave] = valor;
  }
  return fora;
}

const lar = process.env.USERPROFILE || process.env.HOME || '';
const fontes = [
  leArquivo(path.join(lar, 'Desktop', 'DORAMAS PLUS', '.bunny.env')),
  leArquivo(path.join(raiz, '.env')),
  process.env,
];

const valores = Object.assign({}, ...fontes);

/** Pega a primeira chave que existir, ou morre com um recado claro. */
function exige(nomes, paraQue) {
  const lista = [].concat(nomes);
  for (const n of lista) {
    if (valores[n] && String(valores[n]).trim()) return String(valores[n]).trim();
  }
  console.error(`\nFalta ${lista.join(' ou ')} — ${paraQue}.`);
  console.error(`Crie o arquivo .env na raiz do projeto (veja .env.exemplo) e ponha a chave lá.`);
  console.error(`O .env já está no .gitignore, então não vai parar no GitHub.\n`);
  process.exit(2);
}

function opcional(nomes, padrao = null) {
  for (const n of [].concat(nomes)) {
    if (valores[n] && String(valores[n]).trim()) return String(valores[n]).trim();
  }
  return padrao;
}

module.exports = { exige, opcional };
