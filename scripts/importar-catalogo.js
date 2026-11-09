// ============================================================================
// Põe o catálogo inteiro no banco: nome, sinopse, capa, ano e prateleiras.
//
// O QUE ESTE SCRIPT FAZ E O QUE ELE NÃO FAZ
// Ele cria o título. NÃO cria o episódio nem liga o vídeo — isso é trabalho do
// sincronizar-bunny.js, que roda depois, quando o vídeo existir na Bunny.
//
// E, de propósito, o título nasce DESPUBLICADO (published = false).
// Um título sem vídeo é uma página com um botão "Assistir" que não leva a
// lugar nenhum. Publicar 7 mil deles seria encher a vitrine de porta fechada
// logo na estreia. O sincronizador publica cada um no momento em que o vídeo
// aparece — então o catálogo vai abrindo sozinho, conforme o envio avança.
//
// Os títulos que JÁ estão publicados continuam publicados: o campo "published"
// não é enviado, e o que não é enviado não é alterado.
//
// Rode quantas vezes quiser: é tudo por id, nada duplica.
//
//   node scripts/importar-catalogo.js            catálogo inteiro
//   node scripts/importar-catalogo.js --limite=50  só os 50 primeiros (teste)
//   node scripts/importar-catalogo.js --simular    não grava nada, só mostra
// ============================================================================
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { classifica, idioma, todasAsCategorias } = require('./categorias');
const { idDoTitulo } = require('./id-do-titulo');

const args = process.argv.slice(2);
const simular = args.includes('--simular');
const limite = Number((args.find((a) => a.startsWith('--limite=')) || '').split('=')[1]) || 0;
const caminho = args.find((a) => !a.startsWith('--'))
  || path.join(process.env.USERPROFILE || process.env.HOME || '', 'Desktop', 'DORAMAS PLUS', 'catalogo_completo.json');

// Nomes que vieram com defeito da origem. O id não muda, então URL, favorito e
// progresso continuam valendo.
const NOMES_CORRIGIDOS = {
  'a-vida-secreta-do-meu-marido-bilionario': 'A Vida Secreta do Meu Marido Bilionário',
  'bom-demais-pra-demitir-a-medica-genio-1794173619': 'Bom Demais pra Demitir: A Médica Gênio',
  'jogo-na-ilha-a-obsessao-do-meu-ceo-1794154998': 'Jogo na Ilha: A Obsessão do Meu CEO',
  'a-herdeira-italo--o-noivo-que-me-substimou-1794178743': 'A Herdeira Ítalo-Brasileira: O Noivo que Me Subestimou',
};

// Entradas que não são título de drama: nome de arquivo de vídeo que entrou no
// acervo por engano. Duas no catálogo de hoje, e uma delas é um rip de cinema
// ("Spider-man...telesync...mp4") — isso não é o acervo que a plataforma
// licencia, e publicar um rip é um problema de outra natureza. Fica de fora.
const LIXO = /(\.mp4|\.mkv|\.avi|1080p|720p|2160p|telesync|hdcam|camrip|web-?dl|bluray|br-?rip|hdrip|x264|h\.?264|h\.?265|hevc|ddp\d|-dks|yts|rarbg)/i;

if (!fs.existsSync(caminho)) { console.error('não encontrei o catálogo em:', caminho); process.exit(1); }
const bruto = JSON.parse(fs.readFileSync(caminho, 'utf8'));

// Um registro por id. O catálogo tem nomes repetidos; o id é a chave real.
// Ele quase sempre é o próprio slug — veja scripts/id-do-titulo.js para os
// poucos casos em que o slug da origem não serve como endereço.
const porSlug = new Map();
const recusados = [];
for (const item of bruto) {
  if (LIXO.test(item.title || '') || LIXO.test(item.slug || '')) { recusados.push(item.title); continue; }
  const id = idDoTitulo(item.slug, item.title);
  if (id && !porSlug.has(id)) porSlug.set(id, { ...item, _id: id });
}
if (recusados.length) {
  console.log(`recusados por não serem título de drama: ${recusados.length}`);
  for (const r of recusados) console.log('   -', String(r).slice(0, 90));
}
let itens = [...porSlug.values()];
if (limite) itens = itens.slice(0, limite);

console.log(`catálogo: ${bruto.length} registros | ${porSlug.size} slugs únicos | importando ${itens.length}`);

const sb = simular ? null : require('./supabase');
const capaDe = (slug) => (simular ? `…/capas/${slug}.webp` : sb.urlPublica('capas', `${slug}.webp`));

const titulos = [];
const vinculos = [];
const semAno = [];
for (const item of itens) {
  const slug = item._id;
  const nome = NOMES_CORRIGIDOS[slug] || String(item.title || '').trim();
  const ano = Number(item.release_year) || null;
  if (!ano) semAno.push(slug);
  titulos.push({
    id: slug,
    name: nome,
    synopsis: String(item.description || '').trim() || null,
    cover: capaDe(slug),
    year: ano,
    // "published" fica de fora de propósito — veja o comentário do topo.
  });
  const cats = new Set(classifica(item));
  const lingua = idioma(item);
  if (lingua) cats.add(lingua);
  for (const c of cats) vinculos.push({ title_id: slug, category_id: c });
}

const categorias = todasAsCategorias().map((c) => ({ id: c.id, name: c.nome, position: c.posicao }));

console.log(`prateleiras: ${categorias.length} | títulos: ${titulos.length} | vínculos: ${vinculos.length}`);
console.log(`média de ${(vinculos.length / titulos.length).toFixed(1)} prateleiras por título`);
if (semAno.length) console.log(`sem ano: ${semAno.length}`);

if (simular) {
  console.log('\n--- simulação, nada foi gravado ---');
  console.log('exemplo de título:', JSON.stringify(titulos[0], null, 2));
  console.log('prateleiras dele:', vinculos.filter((v) => v.title_id === titulos[0].id).map((v) => v.category_id).join(', '));
  process.exit(0);
}

const LOTE_TITULOS = 300;
const LOTE_VINCULOS = 1000;

(async () => {
  const inicio = Date.now();

  console.log('\n1/3  prateleiras');
  await sb.gravar('categories', categorias, { conflito: 'id' });
  console.log('     ok');

  console.log('2/3  títulos (sem mexer no que já está publicado)');
  for (let i = 0; i < titulos.length; i += LOTE_TITULOS) {
    await sb.gravar('titles', titulos.slice(i, i + LOTE_TITULOS), { conflito: 'id' });
    const feito = Math.min(i + LOTE_TITULOS, titulos.length);
    if (feito % 1500 < LOTE_TITULOS || feito === titulos.length) console.log(`     ${feito}/${titulos.length}`);
  }

  console.log('3/3  prateleiras de cada título');
  for (let i = 0; i < vinculos.length; i += LOTE_VINCULOS) {
    await sb.gravar('title_categories', vinculos.slice(i, i + LOTE_VINCULOS), { conflito: 'title_id,category_id' });
    const feito = Math.min(i + LOTE_VINCULOS, vinculos.length);
    if (feito % 5000 < LOTE_VINCULOS || feito === vinculos.length) console.log(`     ${feito}/${vinculos.length}`);
  }

  const [t, p, c] = await Promise.all([
    sb.ler('titles', 'select=id&limit=1'),
    sb.ler('titles', 'select=id&published=eq.true&limit=1'),
    sb.ler('categories', 'select=id'),
  ]);
  void t; void p;
  console.log(`\npronto em ${((Date.now() - inicio) / 1000).toFixed(0)}s — ${c.length} prateleiras no banco.`);
  console.log('Os títulos entraram despublicados. Rode scripts/sincronizar-bunny.js para');
  console.log('ligar os vídeos que já estão na Bunny e publicar esses títulos.');
})().catch((e) => { console.error('\nfalhou:', e.message); process.exit(1); });
