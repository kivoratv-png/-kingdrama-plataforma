#!/usr/bin/env node
// Servidor local só para ver o site no navegador (http://localhost:3000).
// Serve a pasta public/ e, como na Netlify, devolve o index.html para
// qualquer endereço que não seja um arquivo. Sem dependências.
// Uso: npm start
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '..', 'public');
const PORT = Number(process.env.PORT) || 3000;

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  let rel = decodeURIComponent(url.pathname).replace(/^\/+/, '');
  let file = path.join(DIR, rel);

  // Nunca sair de public/
  if (!file.startsWith(DIR)) { res.writeHead(403).end('Acesso negado'); return; }

  if (!rel || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    file = path.join(DIR, 'index.html'); // fallback da SPA
  }

  const tipo = TIPOS[path.extname(file).toLowerCase()] || 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': tipo, 'Cache-Control': 'no-cache' });
  fs.createReadStream(file).pipe(res);
}).listen(PORT, () => {
  console.log(`KingDrama rodando em http://localhost:${PORT}`);
  console.log('Para ver como fica no celular: F12 > ícone de celular (Ctrl+Shift+M).');
});
