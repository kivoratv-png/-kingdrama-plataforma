// ============================================================================
// Decide o id de um título — que é também o endereço dele no site
// (/titulo/<id>) e o nome do arquivo da capa.
//
// POR QUE NÃO USAR O SLUG DA ORIGEM DIRETO
// Dois defeitos reais no catálogo:
//
//   1. 52 slugs passam de 90 caracteres, e o pior tem 247. Isso vira uma URL
//      ilegível, e no Windows estoura o limite de caminho — a conversão das
//      capas falhou justamente nesse título.
//   2. Um slug é só "-1787841908": o nome ("Casei em Segredo com o Meu Chefe
//      Médico") se perdeu na geração e sobrou o número.
//
// A regra abaixo conserta os dois casos e não mexe em mais nada: slug normal
// sai daqui idêntico ao que entrou. Isso importa porque os 25 títulos que já
// estão no ar continuam com o mesmo id — ninguém perde favorito nem progresso.
//
// A MESMA função é usada pelo importador, pelo preparador de capas e pelo
// sincronizador. Tem de ser a mesma, senão o vídeo não encontra o título.
// ============================================================================
'use strict';

const LIMITE = 80;

const semAcento = (s) =>
  String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const comoSlug = (s) =>
  semAcento(s).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

/**
 * @param {string} slug    o slug que veio do catálogo
 * @param {string} titulo  o nome, usado só quando o slug está quebrado
 * @returns {string} o id definitivo
 */
function idDoTitulo(slug, titulo = '') {
  const original = String(slug || '').trim().toLowerCase();

  // Slug já utilizável sai daqui INTACTO, sem passar pela normalização. Não é
  // capricho: "a-herdeira-italo--o-noivo-..." tem hífen duplo, e normalizar
  // colapsaria para um hífen só — um id novo para um título que já está no ar,
  // ou seja, o mesmo drama duas vezes no catálogo.
  if (/^[a-z0-9][a-z0-9-]*$/.test(original) && original.length <= LIMITE) return original;

  let s = comoSlug(original);

  // Slug que começa com número solto perdeu o nome pelo caminho: remonta do
  // título e guarda o número do fim, que é o que identifica o item na origem.
  if (!s || /^\d+$/.test(s)) {
    const sufixo = (s.match(/\d{6,}$/) || [''])[0];
    const base = comoSlug(titulo);
    s = [base, sufixo].filter(Boolean).join('-') || s;
  }

  if (s.length <= LIMITE) return s;

  // Corta, mas preserva o número do fim (é ele que garante a unicidade) e não
  // parte palavra no meio.
  const sufixo = (s.match(/-(\d{6,})$/) || [])[1] || '';
  const espaco = LIMITE - (sufixo ? sufixo.length + 1 : 0);
  let corte = s.slice(0, espaco).replace(/-[^-]*$/, '').replace(/-+$/, '');
  if (!corte) corte = s.slice(0, espaco).replace(/-+$/, '');
  return sufixo ? `${corte}-${sufixo}` : corte;
}

module.exports = { idDoTitulo, comoSlug, LIMITE };
