// ============================================================================
// Liga os vídeos da Bunny aos títulos do catálogo e publica o que ficou pronto.
//
// É ESTE o comando para rodar depois de cada lote de envios:
//   node scripts/sincronizar-bunny.js
//
// O que ele faz, para cada vídeo da biblioteca que esteja PRONTO:
//   1. descobre de qual título ele é (pelo nome do arquivo, que é o slug, ou
//      pelo nome de exibição);
//   2. cria/atualiza o episódio 1 com a duração real do vídeo;
//   3. grava o id do vídeo na episode_sources — a tabela que o navegador nunca
//      enxerga e que só a Netlify Function lê para assinar a URL;
//   4. publica o título, que até então estava invisível no site.
//
// Vídeo ainda processando na Bunny é ignorado de propósito: publicar um título
// cujo vídeo não toca é pior do que esperar o próximo lote. Rode de novo quando
// terminarem — é tudo por id, nada duplica.
//
// Quando o mesmo título tem mais de um vídeo pronto (reenvio), fica o mais
// longo; empatando, o mais recente. Os descartados aparecem no relatório.
//
//   --simular       não grava nada, só mostra o que faria
//   --biblioteca=N  usa outra biblioteca da Bunny
// ============================================================================
'use strict';

const { exige, opcional } = require('./env');
const { semAcento } = require('./categorias');
const { idDoTitulo } = require('./id-do-titulo');

const args = process.argv.slice(2);
const simular = args.includes('--simular');
const bibArg = (args.find((a) => a.startsWith('--biblioteca=')) || '').split('=')[1];

const CHAVE = exige(['BUNNY_STREAM_KEY', 'BUNNY_API_KEY'], 'é a chave da API da Bunny Stream');
const BIBLIOTECA = bibArg || opcional(['BUNNY_LIBRARY_ID'], '803532');

const PRONTO = 4; // 0 criado, 1 enviado, 2 processando, 3 transcodificando, 4 pronto, 5 erro, 6 falhou
const NOME_STATUS = { 0: 'criado', 1: 'enviado', 2: 'processando', 3: 'transcodificando', 5: 'erro', 6: 'falha no envio' };

const chaveSlug = (s) => semAcento(s).trim()
  .replace(/\.(mp4|mkv|avi|mov|m4v|ts|webm)$/i, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

// Tira o número do fim e junta hífens repetidos: serve para comparar um nome de
// arquivo com um id do banco quando um dos dois perdeu o número pelo caminho.
const semNumero = (s) => chaveSlug(s).replace(/-+/g, '-').replace(/-?\d{6,}$/, '').replace(/-+$/, '');

const chaveNome = (s) => semAcento(s)
  .replace(/\.(mp4|mkv|avi|mov|m4v|ts|webm)$/i, '')
  .replace(/[^a-z0-9]+/g, ' ').trim();

async function listaDaBunny() {
  const todos = [];
  for (let pagina = 1; ; pagina++) {
    const url = `https://video.bunnycdn.com/library/${BIBLIOTECA}/videos?page=${pagina}&itemsPerPage=100&orderBy=date`;
    const r = await fetch(url, { headers: { AccessKey: CHAVE, accept: 'application/json' } });
    if (!r.ok) throw new Error(`Bunny respondeu ${r.status} — confira a chave e a biblioteca ${BIBLIOTECA}`);
    const dados = await r.json();
    todos.push(...(dados.items || []));
    if (!dados.items?.length || todos.length >= (dados.totalItems || 0)) return todos;
  }
}

(async () => {
  console.log(`biblioteca ${BIBLIOTECA}`);
  const videos = await listaDaBunny();
  const prontos = videos.filter((v) => v.status === PRONTO);
  const esperando = videos.filter((v) => v.status !== PRONTO);
  console.log(`vídeos: ${videos.length} | prontos: ${prontos.length} | ainda não: ${esperando.length}`);
  for (const v of esperando) {
    console.log(`   aguardando (${NOME_STATUS[v.status] || v.status}): ${v.title}`);
  }

  const sb = require('./supabase');
  const titulos = await sb.lerTudo('titles', 'select=id,name,published');
  console.log(`títulos no banco: ${titulos.length} (${titulos.filter((t) => t.published).length} publicados)`);
  if (!titulos.length) {
    console.log('\nO banco está vazio. Rode antes:  node scripts/importar-catalogo.js');
    process.exit(1);
  }

  // Quatro formas de reconhecer de quem é o vídeo, da mais exata para a mais
  // tolerante. O nome do arquivo na Bunny é o slug da origem, que nem sempre é
  // igual ao id do título (uns eram longos ou estavam quebrados — veja
  // id-do-titulo.js), por isso não basta comparar texto com texto.
  const porId = new Map(titulos.map((t) => [t.id, t]));
  const porIdLimpo = new Map(titulos.map((t) => [chaveSlug(t.id), t]));
  const porNumero = new Map();   // o número do fim do slug identifica o item na origem
  const porNome = new Map();
  const porBase = new Map();     // id sem o número do fim e sem hífen repetido
  for (const t of titulos) {
    const n = (t.id.match(/(\d{6,})$/) || [])[1];
    if (n && !porNumero.has(n)) porNumero.set(n, t);
    const k = chaveNome(t.name);
    if (k && !porNome.has(k)) porNome.set(k, t);
    const base = semNumero(t.id);
    if (base) porBase.set(base, [...(porBase.get(base) || []), t]);
  }

  function donoDoVideo(v) {
    const arquivo = chaveSlug(v.title);
    const numero = (arquivo.match(/(\d{6,})$/) || [])[1];
    // Última tentativa: comparar sem o número do fim e com hífens repetidos
    // colapsados. Resolve o caso do arquivo que veio com o nome de exibição
    // enquanto o título foi renomeado no banco — foi o que aconteceu com
    // "A Herdeira Ítalo-...", cujo id tem hífen duplo e número, e o arquivo não
    // tem nenhum dos dois. Só vale quando sobra um candidato único, senão dois
    // títulos que só diferem pelo número acabariam trocados.
    const base = semNumero(arquivo);
    const porAproximacao = base && porBase.get(base);

    return porId.get(arquivo)
      || porIdLimpo.get(arquivo)
      || porId.get(idDoTitulo(arquivo, v.title))
      || (numero ? porNumero.get(numero) : null)
      || porNome.get(chaveNome(v.title))
      || (porAproximacao && porAproximacao.length === 1 ? porAproximacao[0] : null)
      || null;
  }

  // Um vídeo por título: o mais longo e, empatando, o mais recente.
  const escolhido = new Map();
  const descartados = [];
  const semDono = [];
  for (const v of prontos) {
    const t = donoDoVideo(v);
    if (!t) { semDono.push(v); continue; }
    const atual = escolhido.get(t.id);
    const melhor = !atual
      || (v.length || 0) > (atual.video.length || 0)
      || ((v.length || 0) === (atual.video.length || 0)
          && new Date(v.dateUploaded || 0) > new Date(atual.video.dateUploaded || 0));
    if (melhor) {
      if (atual) descartados.push({ titulo: t.id, video: atual.video });
      escolhido.set(t.id, { titulo: t, video: v });
    } else {
      descartados.push({ titulo: t.id, video: v });
    }
  }

  console.log(`\ncasaram com um título: ${escolhido.size}`);
  console.log(`reenvios descartados:  ${descartados.length}`);
  console.log(`sem título no catálogo:${semDono.length}`);
  for (const v of semDono.slice(0, 20)) console.log(`   - ${v.title}`);
  if (semDono.length > 20) console.log(`   ... e mais ${semDono.length - 20}`);
  for (const d of descartados.slice(0, 10)) {
    console.log(`   reenvio ignorado em ${d.titulo}: ${d.video.guid} (${d.video.length}s)`);
  }

  const novos = [...escolhido.values()].filter((e) => !e.titulo.published);
  console.log(`\nserão publicados agora: ${novos.length} (os outros já estavam no ar)`);

  if (simular) {
    console.log('\n--- simulação, nada foi gravado ---');
    for (const e of [...escolhido.values()].slice(0, 5)) {
      console.log(`   ${e.titulo.id}  <-  ${e.video.guid}  (${Math.round(e.video.length)}s)`);
    }
    return;
  }

  const lista = [...escolhido.values()];
  const LOTE = 300;

  console.log('\n1/3  episódios');
  const episodios = [];
  for (let i = 0; i < lista.length; i += LOTE) {
    const parte = lista.slice(i, i + LOTE).map((e) => ({
      title_id: e.titulo.id,
      number: 1,
      duration_s: Math.round(e.video.length || 0) || null,
      published: true,
    }));
    const volta = await sb.gravar('episodes', parte, { conflito: 'title_id,number', retorno: true });
    episodios.push(...volta);
    console.log(`     ${Math.min(i + LOTE, lista.length)}/${lista.length}`);
  }

  const idDoEpisodio = new Map(episodios.map((e) => [e.title_id, e.id]));

  console.log('2/3  vídeo de cada episódio');
  const fontes = [];
  for (const e of lista) {
    const idEp = idDoEpisodio.get(e.titulo.id);
    if (!idEp) continue;
    fontes.push({
      episode_id: idEp,
      bunny_library_id: String(BIBLIOTECA),
      bunny_video_id: e.video.guid,
      license_note: `Sincronizado da Bunny em ${new Date().toISOString().slice(0, 10)}`,
    });
  }
  for (let i = 0; i < fontes.length; i += LOTE) {
    await sb.gravar('episode_sources', fontes.slice(i, i + LOTE), { conflito: 'episode_id' });
    console.log(`     ${Math.min(i + LOTE, fontes.length)}/${fontes.length}`);
  }

  console.log('3/3  publicando os títulos que ganharam vídeo');
  const ids = lista.map((e) => e.titulo.id);
  for (let i = 0; i < ids.length; i += 200) {
    const parte = ids.slice(i, i + 200).map((id) => `"${id}"`).join(',');
    await sb.atualizar('titles', `id=in.(${encodeURIComponent(parte)})`, { published: true });
  }

  const publicados = await sb.lerTudo('titles', 'select=id&published=is.true');
  console.log(`\npronto. ${publicados.length} títulos publicados no site.`);
  if (semDono.length) {
    console.log(`${semDono.length} vídeos continuam sem título no catálogo — rode o importador ou confira o nome do arquivo.`);
  }
  if (esperando.length) {
    console.log(`${esperando.length} vídeos ainda estão processando na Bunny. Rode de novo quando terminarem.`);
  }
})().catch((e) => { console.error('\nfalhou:', e.message); process.exit(1); });
