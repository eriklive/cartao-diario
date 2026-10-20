// Gera os ícones do PWA a partir de um SVG, renderizado no Chromium.
// Uso: node tools/gerar-icones.mjs apps/web/public/icons  (CHROMIUM_PATH opcional)
import { chromium } from '@playwright/test';
import { writeFileSync, mkdirSync } from 'node:fs';

const destino = process.argv[2];
mkdirSync(destino, { recursive: true });

// Glifo: cartão-calendário com check (o mesmo do primeiro acesso), contorno branco.
const glifo = (escala) => `
  <g transform="translate(256 256) scale(${escala}) translate(-12 -12.5)" fill="none" stroke="#FFFFFF"
     stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
    <rect x="4" y="4" width="16" height="17" rx="2"/>
    <path d="M8 2v4M16 2v4M4 10h16M8 15l2.5 2.5L16 13"/>
  </g>`;

const svgs = {
  // "any": cantos arredondados, fundo transparente fora do quadrado.
  qualquer: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="112" fill="#2F4A78"/>${glifo(13)}</svg>`,
  // "maskable" e Apple: fundo cheio; glifo dentro da zona segura (80%).
  cheio: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="#2F4A78"/>${glifo(10)}</svg>`,
};

writeFileSync(`${destino}/favicon.svg`, svgs.qualquer);

const navegador = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const pagina = await navegador.newPage();
const alvos = [
  ['icon-192.png', 'qualquer', 192],
  ['icon-512.png', 'qualquer', 512],
  ['maskable-192.png', 'cheio', 192],
  ['maskable-512.png', 'cheio', 512],
  ['apple-touch-icon.png', 'cheio', 180],
  ['favicon-32.png', 'qualquer', 32],
];
for (const [nome, tipo, tamanho] of alvos) {
  await pagina.setViewportSize({ width: tamanho, height: tamanho });
  await pagina.setContent(
    `<html><body style="margin:0;background:transparent">${svgs[tipo].replace('<svg ', `<svg width="${tamanho}" height="${tamanho}" `)}</body></html>`,
  );
  await pagina.screenshot({
    path: `${destino}/${nome}`,
    omitBackground: true,
    clip: { x: 0, y: 0, width: tamanho, height: tamanho },
  });
}
await navegador.close();
console.log('ok');
