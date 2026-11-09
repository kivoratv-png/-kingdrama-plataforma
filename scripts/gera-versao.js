// ============================================================================
// Grava a identidade desta publicação em public/config/versao.json.
//
// Serve para o site saber que ele mesmo envelheceu. Uma aba aberta continua
// rodando o código que baixou quando abriu: publicar uma versão nova não
// alcança quem já está com o site aberto. A aba compara este valor com o que
// leu ao abrir e, quando muda, se recarrega na próxima navegação.
//
// Roda no build da Netlify (ver netlify.toml), antes de publicar. Não pode
// falhar: sem este arquivo o site funciona igual, só perde a atualização
// automática — então todo erro aqui é engolido de propósito.
// ============================================================================
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const destino = path.join(__dirname, '..', 'public', 'config', 'versao.json');

// Na Netlify, COMMIT_REF é o commit publicado. Fora dela, a data serve.
const versao = process.env.COMMIT_REF || process.env.DEPLOY_ID || String(Date.now());

try {
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  fs.writeFileSync(
    destino,
    JSON.stringify({ versao, publicado: new Date().toISOString() }, null, 2) + '\n'
  );
  console.log('versao desta publicacao:', versao);
} catch (e) {
  console.warn('nao foi possivel gravar versao.json (o site segue funcionando):', e.message);
}
