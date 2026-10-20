import { resolve } from 'node:path';
import { defineConfig, devices } from '@playwright/test';

// Os testes rodam contra o build de produção (service worker ligado), servido
// com os mesmos cabeçalhos de segurança da hospedagem (tools/servidor-estatico.mjs).
// E2E_BASE=/cartao-diario/ e E2E_PAGES=1 simulam o GitHub Pages: app numa
// subpasta, sem cabeçalhos próprios e com 404.html no lugar do fallback de SPA.
// Sem importar @nx/*: o Playwright carrega este arquivo como ESM.
const raiz = resolve(import.meta.dirname, '../..');
const saida = resolve(raiz, 'dist/.playwright/apps/web-e2e');
const porta = 4300;
const base = (process.env['E2E_BASE'] || '/').replace(/\/?$/, '/');
const modoPages = process.env['E2E_PAGES'] === '1';
const baseURL = process.env['BASE_URL'] || `http://localhost:${porta}${base}`;

export default defineConfig({
  testDir: './src',
  testMatch: '**/*.spec.ts',
  outputDir: resolve(saida, 'test-output'),
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 1 : 0,
  reporter: [['list'], ['html', { outputFolder: resolve(saida, 'playwright-report'), open: 'never' }]],
  use: {
    baseURL,
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    trace: 'on-first-retry',
    acceptDownloads: true,
    // Ambientes com Chromium pré-instalado em outro caminho (ex.: CHROMIUM_PATH=/opt/pw-browsers/chromium).
    launchOptions: { executablePath: process.env['CHROMIUM_PATH'] || undefined },
  },
  webServer: {
    command: `node tools/servidor-estatico.mjs dist/apps/web/browser ${porta} --base ${base}${modoPages ? ' --pages' : ''}`,
    url: baseURL,
    reuseExistingServer: !process.env['CI'],
    cwd: raiz,
  },
  projects: [{ name: 'celular', use: { ...devices['Pixel 7'] } }],
});
