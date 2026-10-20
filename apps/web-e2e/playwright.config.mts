import { resolve } from 'node:path';
import { defineConfig, devices } from '@playwright/test';

// Os testes rodam contra o build de produção (service worker ligado), servido
// com os mesmos cabeçalhos de segurança da hospedagem (tools/servidor-estatico.mjs).
// Sem importar @nx/*: o Playwright carrega este arquivo como ESM.
const raiz = resolve(import.meta.dirname, '../..');
const saida = resolve(raiz, 'dist/.playwright/apps/web-e2e');
const porta = 4300;
const baseURL = process.env['BASE_URL'] || `http://localhost:${porta}`;

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
    command: `node tools/servidor-estatico.mjs dist/apps/web/browser ${porta}`,
    url: baseURL,
    reuseExistingServer: !process.env['CI'],
    cwd: raiz,
  },
  projects: [{ name: 'celular', use: { ...devices['Pixel 7'] } }],
});
