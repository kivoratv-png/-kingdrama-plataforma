// ============================================================================
// Grava a identidade desta versão do site em public/config/versao.json.
//
// Serve para o site saber que ele mesmo envelheceu. Uma aba aberta continua
// rodando o código que baixou quando abriu: publicar não alcança quem já está
// com o site aberto. A aba compara este valor com o que leu ao abrir e, quando
// muda, se recarrega na próxima navegação.
//
// POR QUE NÃO RODA NA NETLIFY: preencher o "command" do netlify.toml faz o
// deploy virar um build de verdade, e a conta Free não tem crédito para isso
// ("Skipped due to account credit usage exceeded" — verificado na prática).
// Sem command, a publicação é só o envio dos arquivos e não consome nada.
// Então o arquivo é gerado aqui e versionado junto com o código.
//
// Roda sozinho no pre-commit (.githooks/pre-commit). Para rodar à mão:
//   node scripts/gera-versao.js
//
// A versão é o resumo do conteúdo que o navegador baixa. Assim ela muda
// quando o site muda de verdade, e não a cada commit de texto ou SQL — abas
// abertas só se recarregam quando há motivo.
// ============================================================================
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

function normalize(text) {
  return text.replace(/\r\n/g, '\n')
    .replace(/\?v=[a-f0-9]{12}(?=['"])/g, '')
    .replace(/(<meta name="kingdrama-version" content=")[^"]*(">)/g, '$1development$2');
}

function generateVersion(root) {
  const files = ['index.html', 'admin/index.html', '_headers', '_redirects', 'manifest.webmanifest']
    .map(name => path.join(root, name)).filter(file => fs.existsSync(file));
  for (const folder of ['js', 'css', 'config', 'vendor']) {
    const directory = path.join(root, folder);
    if (!fs.existsSync(directory)) continue;
    for (const name of fs.readdirSync(directory).sort()) {
      const file = path.join(directory, name);
      if (fs.statSync(file).isFile() && !(folder === 'config' && name === 'versao.json')) files.push(file);
    }
  }
  const hash = crypto.createHash('sha256');
  for (const file of files.sort()) {
    hash.update(path.relative(root, file).replace(/\\/g, '/'));
    hash.update(normalize(fs.readFileSync(file, 'utf8')));
  }
  const version = hash.digest('hex').slice(0, 12);
  const rewritten = [];
  // Include transitive imports and the on-demand HLS script in this release.
  for (const file of files.filter(file => file.endsWith('.html') || path.dirname(file) === path.join(root, 'js'))) {
    const before = fs.readFileSync(file, 'utf8');
    const after = normalize(before)
      .replace(/(['"])((?:\.{1,2}\/|\/)[^'"\s?]+\.(?:js|css))\1/g, (_, quote, url) => `${quote}${url}?v=${version}${quote}`)
      .replace(/(<meta name="kingdrama-version" content=")development(">)/g, `$1${version}$2`);
    if (before !== after) { fs.writeFileSync(file, after); rewritten.push(file); }
  }
  const destination = path.join(root, 'config', 'versao.json');
  let previous;
  try { previous = JSON.parse(fs.readFileSync(destination, 'utf8')).versao; } catch { /* First release. */ }
  if (previous !== version) {
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, JSON.stringify({ versao: version, publicado: new Date().toISOString() }, null, 2) + '\n');
  }
  return { version, changed: previous !== version, rewritten: rewritten.length };
}

module.exports = { generateVersion };
if (require.main === module) {
  const result = generateVersion(path.join(__dirname, '..', 'public'));
  console.log(`${result.changed ? 'versão gerada' : 'versão inalterada'}: ${result.version} (${result.rewritten} arquivos atualizados)`);
}
