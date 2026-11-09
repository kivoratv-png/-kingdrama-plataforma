// ============================================================================
// O mínimo de Supabase que os scripts precisam: gravar linha em tabela e
// arquivo no Storage, usando a chave service_role.
//
// Por que não a biblioteca oficial: o projeto não tem node_modules e o site
// inteiro roda sem etapa de build. Duas funções de fetch resolvem, e continua
// não havendo nada para instalar.
//
// A chave service_role passa por cima do RLS — ela existe para o servidor, não
// para o navegador. Por isso ela só aparece aqui, lida do .env, e nunca é
// impressa nem gravada em lugar nenhum.
// ============================================================================
'use strict';

const { exige } = require('./env');

const URL_BASE = exige(['SUPABASE_URL'], 'é o endereço do projeto no Supabase').replace(/\/+$/, '');
const CHAVE = exige(['SUPABASE_SERVICE_ROLE_KEY', 'SERVICE_KEY'], 'é a chave service_role (Supabase > Settings > API)');

const cabecalho = (extra = {}) => ({
  apikey: CHAVE,
  Authorization: `Bearer ${CHAVE}`,
  ...extra,
});

async function tentar(descricao, fn, tentativas = 4) {
  let ultimo;
  for (let i = 1; i <= tentativas; i++) {
    try {
      return await fn();
    } catch (e) {
      ultimo = e;
      if (i < tentativas) {
        const espera = 400 * 2 ** (i - 1);
        await new Promise((r) => setTimeout(r, espera));
      }
    }
  }
  throw new Error(`${descricao}: ${ultimo.message}`);
}

/**
 * Grava linhas numa tabela. As colunas que você NÃO mandar ficam como estão
 * nas linhas que já existem — é assim que o importador consegue reescrever o
 * catálogo sem despublicar o que já está no ar.
 */
async function gravar(tabela, linhas, { conflito = 'id', retorno = false } = {}) {
  if (!linhas.length) return [];
  const url = `${URL_BASE}/rest/v1/${tabela}?on_conflict=${encodeURIComponent(conflito)}`;
  return tentar(`gravar em ${tabela}`, async () => {
    const r = await fetch(url, {
      method: 'POST',
      headers: cabecalho({
        'Content-Type': 'application/json',
        Prefer: `resolution=merge-duplicates,return=${retorno ? 'representation' : 'minimal'}`,
      }),
      body: JSON.stringify(linhas),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status} ${(await r.text()).slice(0, 300)}`);
    return retorno ? r.json() : [];
  });
}

/** Lê linhas. `consulta` é a parte depois do "?" do PostgREST. */
async function ler(tabela, consulta = 'select=*') {
  const url = `${URL_BASE}/rest/v1/${tabela}?${consulta}`;
  return tentar(`ler ${tabela}`, async () => {
    const r = await fetch(url, { headers: cabecalho({ Accept: 'application/json' }) });
    if (!r.ok) throw new Error(`HTTP ${r.status} ${(await r.text()).slice(0, 300)}`);
    return r.json();
  });
}

/** Lê tudo, de mil em mil, porque o PostgREST limita o tamanho da resposta. */
async function lerTudo(tabela, consulta = 'select=*', passo = 1000) {
  const tudo = [];
  for (let de = 0; ; de += passo) {
    const url = `${URL_BASE}/rest/v1/${tabela}?${consulta}`;
    const parte = await tentar(`ler ${tabela}`, async () => {
      const r = await fetch(url, {
        headers: cabecalho({ Accept: 'application/json', Range: `${de}-${de + passo - 1}` }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status} ${(await r.text()).slice(0, 300)}`);
      return r.json();
    });
    tudo.push(...parte);
    if (parte.length < passo) return tudo;
  }
}

/** Atualiza linhas que casem com a consulta. */
async function atualizar(tabela, consulta, campos) {
  const url = `${URL_BASE}/rest/v1/${tabela}?${consulta}`;
  return tentar(`atualizar ${tabela}`, async () => {
    const r = await fetch(url, {
      method: 'PATCH',
      headers: cabecalho({ 'Content-Type': 'application/json', Prefer: 'return=minimal' }),
      body: JSON.stringify(campos),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status} ${(await r.text()).slice(0, 300)}`);
  });
}

/** Sobe um arquivo para um balde do Storage. */
async function subirArquivo(balde, caminho, conteudo, tipo = 'image/webp') {
  const url = `${URL_BASE}/storage/v1/object/${balde}/${caminho}`;
  return tentar(`subir ${caminho}`, async () => {
    const r = await fetch(url, {
      method: 'POST',
      headers: cabecalho({ 'Content-Type': tipo, 'x-upsert': 'true', 'cache-control': 'public, max-age=31536000, immutable' }),
      body: conteudo,
    });
    if (!r.ok) throw new Error(`HTTP ${r.status} ${(await r.text()).slice(0, 200)}`);
  });
}

/** Lista o que já existe num balde (para não subir duas vezes). */
async function listarArquivos(balde, prefixo = '', limite = 100, deslocamento = 0) {
  const url = `${URL_BASE}/storage/v1/object/list/${balde}`;
  return tentar(`listar ${balde}`, async () => {
    const r = await fetch(url, {
      method: 'POST',
      headers: cabecalho({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ prefix: prefixo, limit: limite, offset: deslocamento, sortBy: { column: 'name', order: 'asc' } }),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status} ${(await r.text()).slice(0, 200)}`);
    return r.json();
  });
}

const urlPublica = (balde, caminho) => `${URL_BASE}/storage/v1/object/public/${balde}/${caminho}`;

module.exports = { gravar, ler, lerTudo, atualizar, subirArquivo, listarArquivos, urlPublica, URL_BASE };
