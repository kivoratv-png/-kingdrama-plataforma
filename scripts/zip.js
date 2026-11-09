#!/usr/bin/env node
// Compacta a pasta public/ em KingDrama-site.zip, pronto para arrastar em
// app.netlify.com (Sites > Add new site > Deploy manually).
// Os arquivos ficam na raiz do zip, que é o formato que a Netlify espera.
// Uso: npm run zip
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const DIR = path.join(ROOT, 'public');
const ZIP = path.join(ROOT, 'KingDrama-site.zip');

const conta = (dir) => fs.readdirSync(dir, { withFileTypes: true })
  .reduce((n, d) => n + (d.isDirectory() ? conta(path.join(dir, d.name)) : 1), 0);

// O tar do Windows (bsdtar, em System32) gera um zip compatível com a Netlify.
// Chamamos ele pelo caminho completo de propósito: o "tar" do Git Bash é o GNU tar,
// que não aceita -a e ainda entende "C:\..." como se fosse um servidor remoto.
const tarWin = process.platform === 'win32'
  ? path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'tar.exe')
  : null;

fs.rmSync(ZIP, { force: true });
const itens = fs.readdirSync(DIR);
try {
  if (tarWin && fs.existsSync(tarWin)) {
    execFileSync(tarWin, ['-a', '-c', '-f', ZIP, ...itens], { cwd: DIR });
  } else if (process.platform === 'win32') {
    // Reserva: PowerShell.
    execFileSync('powershell', ['-NoProfile', '-Command',
      `Compress-Archive -Path '${DIR}\\*' -DestinationPath '${ZIP}' -Force`]);
  } else {
    execFileSync('zip', ['-r', '-q', ZIP, ...itens], { cwd: DIR });
  }
} catch (e) {
  console.error('Não consegui gerar o zip automaticamente. Compacte o conteúdo de public/ à mão.');
  console.error(e.message);
  process.exit(1);
}
if (!fs.existsSync(ZIP)) { console.error('O zip não foi criado.'); process.exit(1); }

console.log(`${path.basename(ZIP)} — ${conta(DIR)} arquivos, ${(fs.statSync(ZIP).size / 1048576).toFixed(1)} MB`);
console.log(`Caminho: ${ZIP}`);
