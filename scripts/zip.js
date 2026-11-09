#!/usr/bin/env node
// ============================================================================
// Monta KingDrama-site.zip para envio manual em app.netlify.com
// (Sites > Add new site > Deploy manually / Netlify Drop).
//
// O zip leva o site inteiro na raiz, mais a pasta netlify/functions e um
// netlify.toml apontando para ela.
//
// LEIA ANTES DE USAR EM PRODUÇÃO
// O envio manual pelo navegador NÃO empacota funções: a Netlify só monta a
// função quando o deploy passa pela integração com o Git ou pelo CLI. Isso está
// na documentação e em vários relatos no fórum deles. Ou seja: muito
// provavelmente o site subirá sem /.netlify/functions/play — e sem ela o botão
// "Assistir" para de funcionar, porque é ela que assina a URL do vídeo.
//
// As funções vão no zip assim mesmo (não custa nada, e se um dia passarem a ser
// empacotadas, já está pronto). Mas, para apenas TESTAR se o envio manual
// escapa do bloqueio de deploy da conta, use um site descartável em
// app.netlify.com/drop — nunca o kingdrama.
//
// Para publicar de verdade enquanto a conta está travada, o caminho que
// funciona é:  node scripts/publicar.js
//
//   node scripts/zip.js
// ============================================================================
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const SITE = path.join(ROOT, 'public');
const FUNCOES = path.join(ROOT, 'netlify', 'functions');
const ZIP = path.join(ROOT, 'KingDrama-site.zip');

const conta = (dir) => fs.readdirSync(dir, { withFileTypes: true })
  .reduce((n, d) => n + (d.isDirectory() ? conta(path.join(dir, d.name)) : 1), 0);

// Pasta de montagem: o zip precisa do site na raiz E das funções ao lado, e
// isso não existe assim no projeto.
const palco = fs.mkdtempSync(path.join(os.tmpdir(), 'kingdrama-zip-'));
try {
  fs.cpSync(SITE, palco, { recursive: true });

  let temFuncoes = false;
  if (fs.existsSync(FUNCOES)) {
    fs.cpSync(FUNCOES, path.join(palco, 'netlify', 'functions'), { recursive: true });
    temFuncoes = true;
  }

  // Este netlify.toml manda no zip. O que existe dentro de public/ é para o
  // outro modo de publicação e seria ignorado aqui de qualquer forma.
  fs.writeFileSync(path.join(palco, 'netlify.toml'), [
    '# Gerado por scripts/zip.js para envio manual.',
    '[build]',
    '  publish = "."',
    '  command = ""',
    temFuncoes ? '  functions = "netlify/functions"' : '',
    '',
    '[build.environment]',
    '  NODE_VERSION = "22"',
    '',
  ].filter((l) => l !== '').join('\n'), 'utf8');

  const tarWin = process.platform === 'win32'
    ? path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'tar.exe')
    : null;

  fs.rmSync(ZIP, { force: true });
  const itens = fs.readdirSync(palco);
  if (tarWin && fs.existsSync(tarWin)) {
    // O tar do Windows (bsdtar) gera um zip que a Netlify aceita. Chamado pelo
    // caminho completo de propósito: o tar do Git Bash é o GNU tar, que não
    // aceita -a e ainda lê "C:\..." como se fosse um servidor remoto.
    execFileSync(tarWin, ['-a', '-c', '-f', ZIP, ...itens], { cwd: palco });
  } else if (process.platform === 'win32') {
    execFileSync('powershell', ['-NoProfile', '-Command',
      `Compress-Archive -Path '${palco}\\*' -DestinationPath '${ZIP}' -Force`]);
  } else {
    execFileSync('zip', ['-r', '-q', ZIP, ...itens], { cwd: palco });
  }

  if (!fs.existsSync(ZIP)) { console.error('O zip não foi criado.'); process.exit(1); }

  console.log(`${path.basename(ZIP)} — ${conta(palco)} arquivos, ${(fs.statSync(ZIP).size / 1048576).toFixed(1)} MB`);
  console.log(`Caminho: ${ZIP}`);
  console.log(temFuncoes
    ? 'Inclui netlify/functions (mas o envio manual provavelmente não vai montá-las — leia o topo deste arquivo).'
    : 'ATENÇÃO: não achei netlify/functions. O player não vai funcionar neste envio.');
} catch (e) {
  console.error('Não consegui gerar o zip:', e.message);
  process.exit(1);
} finally {
  fs.rmSync(palco, { recursive: true, force: true });
}
