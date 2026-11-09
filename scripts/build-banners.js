#!/usr/bin/env node
// Converte as artes da pasta BANNERS/ para o site (public/banners/*.webp),
// carimba o logo do KingDrama no canto e preenche "image" e "thumb" de cada
// slot em public/config/banners.json.
//
//   slot.source.desktop : arte larga   (1920 x 640)  -> banner no computador
//   slot.source.mobile  : capa em pé   (1080 x 1440) -> banner no celular
//
// Uso: npm run banners
'use strict';
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.join(__dirname, '..');
const SRC_DIR = path.join(ROOT, 'BANNERS');
const OUT = path.join(ROOT, 'public', 'banners');
const CONFIG = path.join(ROOT, 'public', 'config', 'banners.json');
const LOGO = path.join(ROOT, 'public', 'img', 'logo.png');

// Carimba o logo no canto superior direito, abaixo de onde fica a barra do topo.
// width: largura do logo como fração da imagem. margin/top: distância das bordas.
async function brand(file, { width, margin = 0.04, top = 0.15 }) {
  const img = sharp(file);
  const { width: W, height: H } = await img.metadata();
  const logoW = Math.round(W * width);
  const logo = await sharp(LOGO).resize({ width: logoW }).png().toBuffer();
  const logoH = (await sharp(logo).metadata()).height;
  return img
    .composite([{
      input: logo,
      left: Math.max(0, W - logoW - Math.round(W * margin)),
      top: Math.max(0, Math.min(Math.round(H * top), H - logoH)),
    }])
    .toBuffer();
}

async function main() {
  if (!fs.existsSync(SRC_DIR)) throw new Error(`Pasta não encontrada: ${SRC_DIR}`);
  const config = JSON.parse(fs.readFileSync(CONFIG, 'utf8'));
  fs.mkdirSync(OUT, { recursive: true });

  let feitos = 0;
  for (const s of config.slots) {
    if (!s.source || !s.source.desktop || !s.source.mobile) {
      console.log(`${s.id}: sem "source" — pulado`);
      continue;
    }
    const files = [s.source.desktop, s.source.mobile].map((f) => path.join(SRC_DIR, f));
    const faltando = files.filter((f) => !fs.existsSync(f));
    if (faltando.length) {
      console.log(`${s.id}: arquivo não encontrado em BANNERS/ -> ${faltando.map((f) => path.basename(f)).join(', ')}`);
      continue;
    }

    const desktop = await brand(files[0], { width: 0.10, margin: 0.15, top: 0.17 });
    const mobile = await brand(files[1], { width: 0.22, margin: 0.04, top: 0.15 });
    await sharp(desktop).resize({ width: 1920, withoutEnlargement: true }).webp({ quality: 80 }).toFile(path.join(OUT, `${s.id}-desktop.webp`));
    await sharp(mobile).resize({ width: 900, withoutEnlargement: true }).webp({ quality: 80 }).toFile(path.join(OUT, `${s.id}-mobile.webp`));

    s.image = { mobile: `/banners/${s.id}-mobile.webp`, desktop: `/banners/${s.id}-desktop.webp` };
    s.thumb = s.image.mobile; // enquanto não há capas do catálogo, a miniatura é o próprio banner
    if (!s.alt) s.alt = s.headline || s.id;
    feitos++;
    console.log(`${s.id}: ${s.headline || '(sem título)'}`);
  }

  fs.writeFileSync(CONFIG, `${JSON.stringify(config, null, 2)}\n`);
  const ativos = config.slots.filter((s) => s.active && s.image && s.image.mobile && s.image.desktop).length;
  console.log(`\n${feitos} banner(es) gerado(s). Ativos no site: ${ativos}.`);
}

main().catch((e) => { console.error('Erro:', e.message); process.exit(1); });
