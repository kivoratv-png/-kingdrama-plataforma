// ============================================================================
// Converte as capas do catálogo antigo para o formato que o site usa.
//
// POR QUE EXISTE
// O catálogo tem 7.421 capas em JPG, 912 MB no total, e o CDN de onde elas
// vinham (doramasplus.b-cdn.net) responde 403 — morreu. Então as capas têm de
// ser republicadas, e republicar 912 MB de JPG seria desperdício: o site mostra
// a capa pequena na grade (uns 120 px de largura no celular) e a grande só na
// página do título.
//
// Daqui saem dois arquivos por título, no mesmo padrão dos 25 que já estão no
// ar (o site deriva o nome do menor sozinho, em lib.js: smallCover()):
//   <slug>.webp      720x960  — página do título
//   <slug>-sm.webp   360x480  — grade e fileiras
//
// ATENÇÃO AO NOME DO ARQUIVO: no catálogo antigo o nome da capa NÃO é o slug
// (a capa de "a-princesa-das-cinzas-1794185796" é "...-1794185791.jpg", outro
// número). Por isso o de-para é feito pelo campo cover_url, não pelo slug.
//
// É retomável: arquivo que já existe na saída é pulado. Pode interromper e
// rodar de novo.
//
//   node scripts/preparar-capas.js [--qualidade=72] [--forcar]
// ============================================================================
'use strict';

const fs = require('node:fs');
const path = require('node:path');

let sharp;
try {
  sharp = require('sharp');
} catch {
  console.error('falta a biblioteca de imagem. Instale com:  npm i sharp');
  process.exit(1);
}

const lar = (f) => path.join(process.env.USERPROFILE || process.env.HOME || '', 'Desktop', 'DORAMAS PLUS', f);
const CATALOGO = lar('catalogo_completo.json');
const ORIGEM = lar('capas_backup');
const DESTINO = path.join(__dirname, '..', 'capas-para-subir');

const args = process.argv.slice(2);
// Sem --qualidade, cada tamanho usa a sua (veja TAMANHOS). O argumento serve
// só para experimentar um valor único em todos.
const argQualidade = args.find((a) => a.startsWith('--qualidade='));
const qualidade = argQualidade ? Number(argQualidade.split('=')[1]) : null;
const forcar = args.includes('--forcar');

if (!fs.existsSync(CATALOGO)) { console.error('não encontrei', CATALOGO); process.exit(1); }
if (!fs.existsSync(ORIGEM)) { console.error('não encontrei', ORIGEM); process.exit(1); }
fs.mkdirSync(DESTINO, { recursive: true });

const catalogo = JSON.parse(fs.readFileSync(CATALOGO, 'utf8'));

// Índice dos arquivos que existem, pelo nome sem extensão.
const existentes = new Map();
for (const nome of fs.readdirSync(ORIGEM)) {
  existentes.set(nome.replace(/\.(jpe?g|png|webp)$/i, ''), nome);
}

const { idDoTitulo } = require('./id-do-titulo');

const tarefas = [];
const semCapa = [];
for (const item of catalogo) {
  // O arquivo SAI com o mesmo id que o título terá no banco, senão a capa não
  // encontra o título. Mas ele ENTRA pelo nome antigo: no acervo a capa está
  // gravada ora pelo nome do cover_url, ora pelo slug original. Procurar pelo
  // id novo deixaria 100 títulos sem capa (os que tiveram o slug consertado).
  const original = String(item.slug || '').trim();
  const slug = idDoTitulo(original, item.title);
  if (!slug) continue;
  const base = path.basename(item.cover_url || '').replace(/\.(jpe?g|png|webp)$/i, '');
  const arquivo = existentes.get(base) || existentes.get(original) || existentes.get(slug);
  if (!arquivo) { semCapa.push(slug); continue; }
  tarefas.push({ slug, origem: path.join(ORIGEM, arquivo) });
}

console.log('catálogo:', catalogo.length, '| com capa no disco:', tarefas.length, '| sem capa:', semCapa.length);
if (semCapa.length) {
  fs.writeFileSync(path.join(DESTINO, '_sem-capa.txt'), semCapa.join('\n') + '\n');
  console.log('a lista dos sem capa ficou em capas-para-subir/_sem-capa.txt');
}

// Medidos na amostra: estas capas são pôsteres fotográficos com texto, que
// comprimem mal — mesmo em qualidade baixa a miniatura não desce de ~20 KB.
// Daí 600x800 em vez de 720x960 na grande: economiza ~130 MB no catálogo
// inteiro e ninguém vê diferença num celular.
const TAMANHOS = [
  { sufixo: '', largura: 600, altura: 800, qualidade: 60 },
  { sufixo: '-sm', largura: 360, altura: 480, qualidade: 54 },
];

let feitos = 0, pulados = 0, falhas = 0, bytes = 0;
const erros = [];

async function converte(t) {
  for (const tam of TAMANHOS) {
    const saida = path.join(DESTINO, `${t.slug}${tam.sufixo}.webp`);
    if (!forcar && fs.existsSync(saida)) { pulados++; bytes += fs.statSync(saida).size; continue; }
    try {
      await sharp(t.origem)
        .resize(tam.largura, tam.altura, { fit: 'cover', position: 'attention' })
        .webp({ quality: qualidade ? qualidade : tam.qualidade })
        .toFile(saida);
      feitos++;
      bytes += fs.statSync(saida).size;
    } catch (e) {
      falhas++;
      erros.push(`${t.slug}${tam.sufixo}: ${e.message}`);
    }
  }
}

(async () => {
  const inicio = Date.now();
  const LOTE = 8; // o sharp já usa várias linhas de execução; não adianta exagerar
  for (let i = 0; i < tarefas.length; i += LOTE) {
    await Promise.all(tarefas.slice(i, i + LOTE).map(converte));
    const pronto = Math.min(i + LOTE, tarefas.length);
    if (pronto % 400 < LOTE || pronto === tarefas.length) {
      const s = (Date.now() - inicio) / 1000;
      const resto = s / Math.max(1, pronto) * (tarefas.length - pronto);
      console.log(`  ${pronto}/${tarefas.length}  (${(bytes / 1048576).toFixed(0)} MB, ${s.toFixed(0)}s, faltam ~${resto.toFixed(0)}s)`);
    }
  }
  console.log(`\nconvertidos ${feitos} | já existiam ${pulados} | falhas ${falhas}`);
  console.log(`tamanho total: ${(bytes / 1048576).toFixed(0)} MB em ${DESTINO}`);
  if (erros.length) {
    fs.writeFileSync(path.join(DESTINO, '_erros.txt'), erros.join('\n') + '\n');
    console.log('erros em capas-para-subir/_erros.txt');
    for (const e of erros.slice(0, 5)) console.log('   ', e);
  }
})();
