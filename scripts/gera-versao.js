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

const raiz = path.join(__dirname, '..', 'public');
const destino = path.join(raiz, 'config', 'versao.json');

// O que o navegador executa. index.html entra porque é ele que lista os
// scripts; versao.json fica de fora, senão o resumo mudaria a cada geração.
const alvos = ['js', 'css'];
const arquivos = [path.join(raiz, 'index.html')];

for (const pasta of alvos) {
  const dir = path.join(raiz, pasta);
  if (!fs.existsSync(dir)) continue;
  for (const nome of fs.readdirSync(dir).sort()) {
    const completo = path.join(dir, nome);
    if (fs.statSync(completo).isFile()) arquivos.push(completo);
  }
}

const resumo = crypto.createHash('sha256');
for (const arquivo of arquivos.sort()) {
  resumo.update(path.relative(raiz, arquivo).replace(/\\/g, '/'));
  resumo.update(fs.readFileSync(arquivo));
}
const versao = resumo.digest('hex').slice(0, 12);

let anterior = null;
try { anterior = JSON.parse(fs.readFileSync(destino, 'utf8')).versao; } catch { /* primeira vez */ }

if (anterior === versao) {
  console.log('versao inalterada:', versao, `(${arquivos.length} arquivos)`);
} else {
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  fs.writeFileSync(
    destino,
    JSON.stringify({ versao, publicado: new Date().toISOString() }, null, 2) + '\n'
  );
  console.log(`versao: ${anterior || '(nenhuma)'} -> ${versao}  (${arquivos.length} arquivos)`);
}
