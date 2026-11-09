// ============================================================================
// Envia as capas convertidas para o Storage do Supabase.
//
// Rode depois de scripts/preparar-capas.js. É retomável: lê o que já está lá e
// só manda o que falta, então pode interromper e chamar de novo à vontade.
//
//   node scripts/subir-capas.js
//   node scripts/subir-capas.js --balde=capas --forcar
//
// ANTES DE RODAR, confira no painel do Supabase que o balde "capas" existe e
// está marcado como público (Storage > capas > Configuration > Public bucket).
// Sem isso o site mostra "Capa indisponível" em tudo.
//
// SOBRE O ESPAÇO: o plano gratuito do Supabase dá 1 GB de arquivos e 5 GB de
// tráfego por mês. O catálogo inteiro convertido fica em torno de 500 MB, então
// cabe — mas o tráfego é o que aperta primeiro: cada pessoa que rola o catálogo
// baixa dezenas de miniaturas. Se isso virar gargalo, o lugar certo das capas é
// a Bunny (que você já paga, e cobra bem menos por GB). Trocar depois é barato:
// o endereço da capa está numa coluna do banco, um UPDATE resolve.
// ============================================================================
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const sb = require('./supabase');

const args = process.argv.slice(2);
const forcar = args.includes('--forcar');
const balde = (args.find((a) => a.startsWith('--balde=')) || '').split('=')[1] || 'capas';
const PASTA = path.join(__dirname, '..', 'capas-para-subir');

if (!fs.existsSync(PASTA)) {
  console.error('não achei capas-para-subir/. Rode antes:  node scripts/preparar-capas.js');
  process.exit(1);
}

const locais = fs.readdirSync(PASTA).filter((f) => f.endsWith('.webp'));
if (!locais.length) {
  console.error('a pasta capas-para-subir/ está vazia. Rode antes:  node scripts/preparar-capas.js');
  process.exit(1);
}
const tamanhoTotal = locais.reduce((s, f) => s + fs.statSync(path.join(PASTA, f)).size, 0);
console.log(`capas no disco: ${locais.length} (${(tamanhoTotal / 1048576).toFixed(0)} MB)`);

async function jaEnviadas() {
  const nomes = new Set();
  for (let de = 0; ; de += 1000) {
    const parte = await sb.listarArquivos(balde, '', 1000, de);
    for (const a of parte) if (a?.name) nomes.add(a.name);
    if (parte.length < 1000) return nomes;
  }
}

(async () => {
  let existentes = new Set();
  if (!forcar) {
    process.stdout.write('conferindo o que já está no Storage... ');
    existentes = await jaEnviadas();
    console.log(`${existentes.size} arquivos`);
  }

  const faltando = locais.filter((f) => !existentes.has(f));
  console.log(`a enviar: ${faltando.length}\n`);
  if (!faltando.length) { console.log('nada a fazer.'); return; }

  let feitos = 0, falhas = 0, bytes = 0;
  const erros = [];
  const inicio = Date.now();
  const PARALELO = 10;

  for (let i = 0; i < faltando.length; i += PARALELO) {
    await Promise.all(faltando.slice(i, i + PARALELO).map(async (nome) => {
      const conteudo = fs.readFileSync(path.join(PASTA, nome));
      try {
        await sb.subirArquivo(balde, nome, conteudo, 'image/webp');
        feitos++; bytes += conteudo.length;
      } catch (e) {
        falhas++; erros.push(`${nome}: ${e.message}`);
      }
    }));
    const pronto = Math.min(i + PARALELO, faltando.length);
    if (pronto % 500 < PARALELO || pronto === faltando.length) {
      const s = (Date.now() - inicio) / 1000;
      const resto = s / Math.max(1, pronto) * (faltando.length - pronto);
      console.log(`  ${pronto}/${faltando.length}  (${(bytes / 1048576).toFixed(0)} MB, ${s.toFixed(0)}s, faltam ~${(resto / 60).toFixed(1)} min)`);
    }
  }

  console.log(`\nenviadas ${feitos} | falhas ${falhas} | ${(bytes / 1048576).toFixed(0)} MB`);
  if (erros.length) {
    const log = path.join(PASTA, '_erros-envio.txt');
    fs.writeFileSync(log, erros.join('\n') + '\n');
    console.log('erros em', log);
    for (const e of erros.slice(0, 5)) console.log('   ', e);
    console.log('rode de novo: ele reenvia só o que faltou.');
  }
  const exemplo = locais.find((f) => !f.endsWith('-sm.webp'));
  console.log('\nconfira uma no navegador:', sb.urlPublica(balde, exemplo));
})().catch((e) => { console.error('\nfalhou:', e.message); process.exit(1); });
