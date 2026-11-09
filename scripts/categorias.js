// ============================================================================
// As prateleiras do catálogo e a regra que decide em quais cada título entra.
//
// POR QUE EXISTE
// O catálogo de origem traz marcações próprias (is_anime, is_bl_gl, is_new...),
// mas elas não resistem a uma conferência: "A Princesa das Cinzas" vem marcada
// como anime, "Jiaojiao, Meu Amor" como BL & GL, "is_recommended" está em 99,7%
// dos registros e 28,7% dos títulos não têm marcação nenhuma. Usar aquilo como
// categoria encheria a vitrine de gaveta errada.
//
// O que é confiável no catálogo: idioma, sinopse, capa, ano e duração. Então a
// prateleira é decidida aqui, por palavra no NOME do título — que é curto e
// direto ao ponto nesse gênero ("A Herdeira...", "O CEO...", "Meu Marido...").
// A sinopse só entra como reforço em prateleiras onde o nome costuma calar.
//
// As marcações da origem entram só onde se mostraram seletivas (brasileiro,
// bebês), sempre como mais um sinal, nunca como o único.
//
// COMO MEXER
// Cada prateleira tem "nome" (como aparece no site), "posicao" (a ordem das
// fileiras na home) e as regras. Para criar uma nova, acrescente um item aqui:
// o importador e o sincronizador passam a usá-la sozinhos.
//   node scripts/medir-categorias.js   mostra quantos títulos caem em cada uma
// ============================================================================
'use strict';

const semAcento = (s) =>
  String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Texto comparável: sem acento, sem pontuação, com espaço nas bordas para
 *  que /\bpai\b/ não case dentro de "paixao". */
const normaliza = (s) => ' ' + semAcento(s).replace(/[^a-z0-9]+/g, ' ').trim() + ' ';

// ---------------------------------------------------------------------------
// As prateleiras.
//
//   nome      — como aparece no site
//   posicao   — ordem da fileira na home (menor primeiro)
//   titulo    — casa no nome do título (sinal forte: nome curto, pouca ambiguidade)
//   sinopse   — casa na sinopse (sinal fraco: sozinho não basta, só reforça)
//   sinopseForte — palavra da sinopse que não deixa dúvida ("maldição", "CEO",
//               "herança"). Vale tanto quanto o nome, porque o nome esconde o
//               assunto com frequência: "A Princesa das Cinzas" não avisa que
//               há maldição, mas a sinopse avisa.
//   marca     — marcação da origem que vale como sinal, quando ela é seletiva
//   excecao   — se casar com isto, NÃO entra (desfaz os falsos positivos conhecidos)
// ---------------------------------------------------------------------------
const PRATELEIRAS = [
  // ---- As da lista do dono, nas posições dele -----------------------------
  // 1 Novos Lançamentos e 10 Recomendados Para Você não entram aqui: são
  // fileiras calculadas (data de entrada e gosto de quem está olhando), não
  // marcação de título. Ficam no banco, vazias, prontas para quando virarem
  // automáticas.
  {
    id: 'bebes-e-gravidezes',
    nome: 'Bebês e Gravidezes',
    posicao: 3,
    sinopseForte: /\b(engravid\w*|gravidez|gravida|barriga de aluguel|mae de aluguel|recem nascido|trigemeos|parto)\b/,
    titulo: /\b(bebe|bebes|neném|nenem|gravida|gravidas|gravidez|gestante|barriga de aluguel|mae de aluguel|parto|gemeos|gemeas|trigemeos|quadrigemeos|amamentar|leite materno|berco|recem nascido|filho secreto|filha secreta|filhos secretos|engravidei|engravidou|concebido)\b/,
    sinopse: /\b(engravid\w*|gravidez|barriga de aluguel|mae de aluguel|filho secreto|filha secreta|recem nascido|trigemeos)\b/,
    marca: 'is_baby_pregnancy',
  },
  {
    id: 'relacionamento-tabu',
    nome: 'Relacionamento Tabu',
    posicao: 4,
    titulo: /\b(cunhado|cunhada|padrasto|madrasta|enteado|enteada|sogro|sogra|meu tio|meu sogro|do meu tio|da minha tia|o tio do|a tia do|irmao do meu|irma do meu|irmao da minha|irma da minha|melhor amigo do meu|melhor amiga do meu|amigo do meu pai|amiga da minha mae|ex do meu|ex da minha|marido da minha|esposa do meu|noivo da minha|noiva do meu|meu chefe|minha chefe|do meu chefe|meu professor|minha professora|meu aluno|minha aluna|proibid\w*|amante|trai\w*|infiel|caso secreto|sem compromisso|uma noite)\b/,
    marca: 'is_taboo_relationship',
  },
  {
    id: 'lobos-e-vampiros',
    nome: 'Lobos & Vampiros',
    posicao: 5,
    sinopseForte: /\b(lobisomem|alcateia|licantropo|vampir\w+|macho alfa|matilha)\b/,
    // Estrito de propósito: só lobo e vampiro. Dragão, bruxa e maldição têm
    // prateleira própria (Magia & Maldições), senão esta vira "sobrenatural".
    titulo: /\b(lobo|lobos|loba|lobinho|lobinhos|lobisomem|lobisomens|alcateia|alfa|omega|licantropo|vampiro|vampira|vampiros|presas|mordida|sangue puro|imortal|imortais|caçador de vampiros)\b/,
    sinopse: /\b(lobisomem|alcateia|licantropo|vampir\w+|macho alfa)\b/,
  },
  {
    id: 'bl-e-gl',
    nome: 'BL & GL',
    posicao: 6,
    // A marcação da origem não serve (marca "Jiaojiao, Meu Amor" e "O Amigo
    // Bilionário do Meu Pai"). Só entra com sinal explícito no nome; é melhor
    // esta prateleira nascer pequena e certa do que grande e errada.
    // Nada de "meu namorado é" / "minha namorada é": quem narra pode ser do
    // outro sexo, e isso trazia "O Pai do Meu Namorado É Meu Patrocinador".
    titulo: /\b(bl|gl|boys love|girls love|yaoi|yuri|danmei)\b/,
  },
  {
    id: 'brasileiros',
    nome: 'Brasileiros',
    posicao: 7,
    titulo: /\b(favela|sertanejo|carnaval|morro|funk|botafogo|flamengo|brasileir\w+|baiana|carioca|paulista|pantanal)\b/,
    marca: 'is_brasileiro',
  },
  {
    id: 'animes',
    nome: 'Animes',
    posicao: 8,
    // Nenhum título do catálogo é animação (a marcação da origem põe aqui
    // dramas com atores). Nasce vazia e só aparece no site quando tiver algo.
    // "mangá" perde o acento na normalização e vira "manga" — a fruta, a manga
    // da camisa. Casava com "Ela Escolheu a Manga em Vez do Nosso Casamento?".
    titulo: /\b(anime|animes|animacao|otaku|isekai|donghua)\b/,
  },
  {
    id: 'identidade-escondida',
    nome: 'Identidade Escondida',
    posicao: 9,
    sinopseForte: /\b(identidade secreta|verdadeira identidade|esconde(r|u) (sua|a) identidade|nome falso|se passa(r|ndo)? por|disfarc\w+)\b/,
    titulo: /\b(disfarc\w+|disfarce|identidade|secret\w+|segredo|segredos|fingi\w*|finge|fingindo|se passou por|se passa por|escondid\w+|escondeu|nome falso|mascara|mascarado|anonimo|incognito|sob outro nome|ninguem sabia|nao sabia que|descobriu que eu|na verdade e|na verdade era|verdadeira identidade|falsa|falso)\b/,
    marca: 'is_hidden_identity',
  },

  // ---- Específicas, tiradas dos próprios títulos ---------------------------
  {
    id: 'romance',
    nome: 'Romance',
    posicao: 19,
    // A mais larga de todas, e de propósito: 36% dos títulos não caíam em gaveta
    // nenhuma e quase todos eram romance puro ("Amor em Chamas", "Desta Vez,
    // Escolherei Você"). Num catálogo de 7 mil, uma prateleira com milhares de
    // títulos não incomoda — a home mostra 20 por fileira.
    titulo: /\b(amor|amar|amei|amou|amad\w+|apaixon\w+|paixao|coracao|beijo|beijar|beijou|namorad\w+|namorar|romance|romantic\w+|desejo|desejar|seduz\w+|sedut\w+|encontro|flerte|flertando|te amo|meu amor|para sempre|destino|alma gemea)\b/,
  },
  {
    id: 'herdeiras',
    nome: 'Herdeiras & Heranças',
    posicao: 20,
    sinopseForte: /\b(herdeir\w+|heranca|testamento|verdadeira filha|trocada na maternidade)\b/,
    titulo: /\b(herdeir\w+|heranca|herancas|herdar|herdou|fortuna|testamento|patrimonio|a verdadeira filha|filha legitima|trocada na maternidade|trocado na maternidade)\b/,
  },
  {
    id: 'bilionario',
    nome: 'Bilionários & CEOs',
    posicao: 21,
    sinopseForte: /\b(ceo|bilionari\w+|magnata|herdeiro de um imperio|imperio empresarial|conglomerado)\b/,
    titulo: /\b(ceo|bilionari\w+|milionari\w+|magnata|magnate|presidente da empresa|empresari\w+|executiv\w+|conglomerado|imperio empresarial|homem mais rico|mulher mais rica|chefe frio|patrao|a empresa|escritorio|contrato de casamento|secretaria)\b/,
  },
  {
    id: 'mafia',
    nome: 'Máfia & Submundo',
    posicao: 22,
    sinopseForte: /\b(mafia|mafioso|chefao|cartel|gangue|submundo|padrinho da|assassino de aluguel)\b/,
    titulo: /\b(mafia|mafioso|mafiosa|don|padrinho|chefao|chefona|gangue|cartel|submundo|capo|familia do crime|assassin\w+|matador|contrabando|guarda costas|seguranca particular|policial disfarcado|agente secreto|espiao|espia)\b/,
  },
  {
    id: 'vinganca',
    nome: 'Vingança & Virada de Jogo',
    posicao: 23,
    sinopseForte: /\b(vinganca|vingar(-se)?|se vingar|acerto de contas|se arrepender|humilha\w*|renasc\w+ para)\b/,
    titulo: /\b(vinganca|vingar|vinguei|vingativa|vingativo|acerto de contas|troco|revanche|renasci|renasceu|renascida|renascido|renascimento|voltei|voltou no tempo|segunda chance|de volta|arrependiment\w+|vao se arrepender|vai se arrepender|implora|implorando|suplica|humilh\w+|descartad\w+|descartou|me subestimou|subestimad\w+|me expulsaram|expulsa|divorcio|apos o divorcio|depois do divorcio)\b/,
  },
  {
    id: 'realeza',
    nome: 'Realeza & Época',
    posicao: 24,
    sinopseForte: /\b(palacio|trono|reino|imperador|imperatriz|dinastia|nobreza|concubina|corte imperial)\b/,
    titulo: /\b(rei|reis|rainha|rainhas|principe|princesa|principes|princesas|duque|duquesa|lorde|lady|conde|condessa|marques|marquesa|imperador|imperatriz|trono|coroa|coroada|palacio|reino|nobreza|nobre|imperial|real|dinastia|concubina|cortesa|serva|criada|governanta|cavaleiro|general|dinastia|antiga china|era feudal)\b/,
  },
  {
    id: 'magia',
    nome: 'Magia & Maldições',
    posicao: 25,
    sinopseForte: /\b(maldicao|amaldicoad\w+|feitic\w+|bruxa|dragao|fenix|reencarn\w+|imortal|poderes sobrenaturais|ser sobrenatural|sobrenatural)\b/,
    titulo: /\b(magia|magic\w+|mago|maga|feitic\w+|bruxa|bruxo|maldicao|maldito|maldita|amaldicoad\w+|dragao|dragoes|fenix|serpente|raposa|espirito|espiritos|fantasma|deusa|deus|divin\w+|imortalidade|profecia|reencarn\w+|outro mundo|sistema|poderes|poder sobrenatural|ler a mente|leio a mente|vidente|premonicao)\b/,
  },
  {
    id: 'casamento-em-crise',
    nome: 'Casamento em Crise',
    posicao: 26,
    titulo: /\b(marido|maridos|esposa|esposo|mulher dele|casament\w+|casad\w+|casar|casei|casou|noiv\w+|divorci\w+|separacao|separados|ex marido|ex esposa|lua de mel|altar|aliança|alianca)\b/,
  },
  {
    id: 'segredos-de-familia',
    nome: 'Segredos de Família',
    posicao: 27,
    titulo: /\b(pai|mae|filho|filha|filhos|filhas|familia|familias|irmao|irma|irmaos|irmas|avo|avos|vovo|vovó|neto|neta|tio|tia|primo|prima|papai|mamae|orfa|orfao|adotad\w+|adocao)\b/,
  },
  {
    id: 'amores-impossiveis',
    nome: 'Amores Impossíveis',
    posicao: 28,
    titulo: /\b(inimig\w+|rival|rivais|impossivel|impossiveis|odeio|odiava|amor e odio|nunca mais|nao posso|jamais|distancia|separad\w+|reencontro|primeiro amor|amor de infancia|amor antigo|amor perdido|amor proibido|paixao)\b/,
  },
  {
    id: 'contrato-e-arranjo',
    nome: 'Contratos & Casamentos Arranjados',
    posicao: 29,
    sinopseForte: /\b(casamento (de fachada|arranjado|por contrato)|contrato de casamento|noiva substituta|fingir (ser|que))\b/,
    titulo: /\b(contrato|contratad\w+|arranjad\w+|combinad\w+|de fachada|fingir|fingindo namorar|namorad\w+ de aluguel|substitut\w+|dubl\w+ de|trocada|trocado|acordo|aposta|negocio)\b/,
  },
  {
    id: 'escolar',
    nome: 'Escolar & Universitário',
    posicao: 31,
    titulo: /\b(colegio|escola|escolar|faculdade|universidade|universitari\w+|campus|formatura|vestibular|sala de aula|veterano|calouro|bolsista|internato)\b/,
  },
  {
    id: 'superacao',
    nome: 'Histórias de Superação',
    posicao: 30,
    titulo: /\b(do zero|do nada|ascensao|ascendeu|superacao|superou|venceu|vitoria|campea|campeao|genio|genia|prodigio|talento|medica|medico|doutora|doutor|advogada|advogado|chef|cozinheira|professora|cientista|engenheira|atleta|lutadora|lutador|quarterback|jogador|craque|livre|liberdade|recomecar|recomeco|nova vida|virei|me tornei|cheguei)\b/,
  },
];

const POR_ID = new Map(PRATELEIRAS.map((p) => [p.id, p]));

/**
 * Decide em quais prateleiras um título entra.
 * @param {{title: string, description?: string}} item  registro do catálogo
 * @param {number} limite  no máximo quantas prateleiras (fora idioma)
 * @returns {string[]} ids das prateleiras
 */
function classifica(item, limite = 4) {
  const nome = normaliza(item.title);
  const sinopse = normaliza(item.description);
  const pontos = [];

  for (const p of PRATELEIRAS) {
    if (p.excecao && p.excecao.test(nome)) continue;
    let ponto = 0;
    if (p.titulo && p.titulo.test(nome)) ponto += 3;              // nome: sinal forte
    if (p.sinopseForte && p.sinopseForte.test(sinopse)) ponto += 3; // sinopse inequívoca
    if (p.sinopse && p.sinopse.test(sinopse)) ponto += 2;          // sinopse: reforço
    if (p.marca && item[p.marca] === true) ponto += 1;             // origem: só desempata
    if (ponto >= 3) pontos.push({ id: p.id, ponto, posicao: p.posicao });
  }

  // Mais específico primeiro: maior pontuação e, empatando, a prateleira que
  // vem antes na home.
  pontos.sort((a, b) => b.ponto - a.ponto || a.posicao - b.posicao);
  // Rede de segurança: num catálogo de drama vertical, título que não deu sinal
  // de nada é romance. Melhor isso do que título sem prateleira alguma, que só
  // apareceria na fileira de idioma.
  if (!pontos.length) return ['romance'];
  return pontos.slice(0, limite).map((p) => p.id);
}

/** A prateleira de idioma, que vem do campo confiável do catálogo. */
function idioma(item) {
  const l = semAcento(item.language);
  if (l.startsWith('dub')) return 'dublado';
  if (l.startsWith('leg')) return 'legendado';
  return null;
}

// Prateleiras que existem no banco mas não são marcação de título.
const CALCULADAS = [
  { id: 'novos-lancamentos', nome: 'Novos Lançamentos', posicao: 1 },
  { id: 'recomendados', nome: 'Recomendados Para Você', posicao: 10 },
];

const IDIOMAS = [
  { id: 'dublado', nome: 'Séries Dubladas', posicao: 2 },
  { id: 'legendado', nome: 'Séries Legendadas', posicao: 91 },
];

/** Todas as prateleiras que devem existir na tabela categories. */
function todasAsCategorias() {
  return [...CALCULADAS, ...IDIOMAS, ...PRATELEIRAS.map((p) => ({ id: p.id, nome: p.nome, posicao: p.posicao }))]
    .sort((a, b) => a.posicao - b.posicao);
}

module.exports = { PRATELEIRAS, POR_ID, classifica, idioma, todasAsCategorias, normaliza, semAcento };
