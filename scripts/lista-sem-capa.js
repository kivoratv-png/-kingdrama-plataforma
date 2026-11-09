// ============================================================================
// Monta, na Área de Trabalho, a lista dos títulos que estão sem capa.
//
// Serve para você identificar cada um e procurar a arte certa. O arquivo sai em
// CSV com ponto e vírgula e acentuação do Excel brasileiro, então abre com dois
// cliques, e junto vai uma pasta onde você larga as imagens.
//
//   node scripts/lista-sem-capa.js
//
// A coluna que mais importa é "salve_a_capa_como": o site procura a capa por
// esse nome exato. Largue o arquivo (JPG ou PNG, pode ser do tamanho que for)
// na pasta "KingDrama - capas novas" com esse nome, e depois rode:
//
//   node scripts/preparar-capas.js     corta nos dois tamanhos e converte
//   node scripts/subir-capas.js        manda para o Supabase
// ============================================================================
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { idDoTitulo } = require('./id-do-titulo');

const lar = process.env.USERPROFILE || process.env.HOME || '';
const mesa = path.join(lar, 'Desktop');
const CATALOGO = path.join(mesa, 'DORAMAS PLUS', 'catalogo_completo.json');
const ACERVO = path.join(mesa, 'DORAMAS PLUS', 'capas_backup');
const SAIDA = path.join(mesa, 'KingDrama - capas que faltam.csv');
const PASTA_NOVAS = path.join(mesa, 'KingDrama - capas novas');

const LIXO = /(\.mp4|\.mkv|\.avi|1080p|720p|2160p|telesync|hdcam|camrip|web-?dl|bluray|br-?rip|hdrip|x264|h\.?264|h\.?265|hevc|ddp\d|-dks|yts|rarbg)/i;

if (!fs.existsSync(CATALOGO)) { console.error('não encontrei', CATALOGO); process.exit(1); }
const catalogo = JSON.parse(fs.readFileSync(CATALOGO, 'utf8'));

const noAcervo = new Set();
if (fs.existsSync(ACERVO)) {
  for (const nome of fs.readdirSync(ACERVO)) noAcervo.add(nome.replace(/\.(jpe?g|png|webp)$/i, ''));
}
const jaConvertidas = new Set();
const convertidas = path.join(__dirname, '..', 'capas-para-subir');
if (fs.existsSync(convertidas)) {
  for (const nome of fs.readdirSync(convertidas)) {
    if (nome.endsWith('.webp') && !nome.endsWith('-sm.webp')) jaConvertidas.add(nome.replace(/\.webp$/, ''));
  }
}

const faltando = [];
for (const item of catalogo) {
  if (LIXO.test(item.title || '') || LIXO.test(item.slug || '')) continue;
  const id = idDoTitulo(item.slug, item.title);
  if (!id || jaConvertidas.has(id)) continue;
  const base = path.basename(item.cover_url || '').replace(/\.(jpe?g|png|webp)$/i, '');
  if (noAcervo.has(base) || noAcervo.has(String(item.slug || '').trim()) || noAcervo.has(id)) continue;
  faltando.push({ id, item });
}

const campo = (v) => {
  const s = String(v == null ? '' : v).replace(/\s+/g, ' ').trim();
  return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const linhas = [
  ['n', 'titulo', 'salve_a_capa_como', 'ano', 'idioma', 'duracao_min', 'endereco_no_site', 'sinopse'].join(';'),
];
faltando.forEach(({ id, item }, i) => {
  linhas.push([
    i + 1,
    campo(item.title),
    campo(`${id}.jpg`),
    campo(item.release_year),
    campo(item.language),
    campo(item.duration_minutes),
    campo(`/titulo/${id}`),
    campo(String(item.description || '').slice(0, 300)),
  ].join(';'));
});

// O BOM faz o Excel brasileiro abrir com os acentos certos.
fs.writeFileSync(SAIDA, '﻿' + linhas.join('\r\n') + '\r\n', 'utf8');

fs.mkdirSync(PASTA_NOVAS, { recursive: true });
fs.writeFileSync(path.join(PASTA_NOVAS, 'LEIA-ME.txt'), [
  'Capas que faltam no KingDrama',
  '',
  'Largue aqui a arte de cada título, com o nome EXATO que está na coluna',
  '"salve_a_capa_como" da planilha "KingDrama - capas que faltam.csv"',
  '(na Área de Trabalho).',
  '',
  'Pode ser JPG ou PNG, de qualquer tamanho — o corte e a conversão são',
  'automáticos. O ideal é uma imagem em pé, proporção 3x4, com pelo menos',
  '600 x 800 pixels.',
  '',
  'Depois de largar os arquivos aqui, rode na pasta do projeto:',
  '',
  '   node scripts/preparar-capas.js',
  '   node scripts/subir-capas.js',
  '',
  'Pronto: as capas entram no site sem precisar publicar nada.',
  '',
].join('\r\n'), 'utf8');

console.log(`títulos sem capa: ${faltando.length}`);
for (const { id, item } of faltando) console.log(`   ${item.title}  ->  ${id}.jpg`);
console.log(`\nplanilha: ${SAIDA}`);
console.log(`pasta para largar as imagens: ${PASTA_NOVAS}`);
