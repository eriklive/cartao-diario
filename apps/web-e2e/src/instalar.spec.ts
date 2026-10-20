import { devices, expect, test, type Page } from '@playwright/test';
import { abrirNoDia, configurar, passarSplash, verificarAcessibilidade } from './apoio';

const card = (page: Page) => page.getByRole('region', { name: 'Adicione à tela de início' });
const splash = (page: Page) => page.getByRole('heading', { name: 'Leve o Cartão Diário para a tela de início' });

function liberarBotaoNativo(page: Page) {
  return page.evaluate(() => {
    const evento = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
      prompt: async () => undefined,
      userChoice: Promise.resolve({ outcome: 'accepted' }),
    });
    window.dispatchEvent(evento);
  });
}

test.describe('no Android, sem o botão nativo do navegador', () => {
  test('a splash mostra o caminho pelo menu; depois o card fica em Hoje e em Ajustes', async ({ page }) => {
    await abrirNoDia(page);
    await expect(splash(page)).toBeVisible();
    await expect(page.getByText('Instalar app')).toBeVisible();
    await expect(page.getByText('guarda os registros separado')).toBeHidden();
    await verificarAcessibilidade(page);
    await passarSplash(page);
    await expect(card(page)).toBeHidden();

    await configurar(page);
    await expect(card(page)).toBeVisible();
    await card(page).getByRole('button', { name: 'Agora não' }).click();
    await expect(card(page)).toBeHidden();
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Olá, Ana' })).toBeVisible();
    await expect(card(page)).toBeHidden();

    // Em Ajustes o convite continua, sem "Agora não".
    await page.getByRole('link', { name: 'Ajustes' }).click();
    await expect(card(page)).toBeVisible();
    await expect(card(page).getByRole('button', { name: 'Agora não' })).toBeHidden();
  });
});

test('quando o navegador libera, a splash instala com um toque e segue para o primeiro acesso', async ({ page }) => {
  await abrirNoDia(page);
  await expect(splash(page)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Adicionar à tela de início' })).toBeHidden();

  await liberarBotaoNativo(page);
  await page.getByRole('button', { name: 'Adicionar à tela de início' }).click();
  await expect(page.getByText('App adicionado. Abra pelo ícone na tela de início.')).toBeVisible();
  await expect(page.getByLabel('Como quer ser chamado(a)?')).toBeVisible();
});

test('em Hoje, o card também usa o botão nativo quando disponível', async ({ page }) => {
  await configurar(page);
  await expect(card(page).getByRole('button', { name: 'Adicionar à tela de início' })).toBeHidden();
  await liberarBotaoNativo(page);
  await card(page).getByRole('button', { name: 'Adicionar à tela de início' }).click();
  await expect(page.getByText('App adicionado. Abra pelo ícone na tela de início.')).toBeVisible();
  await expect(card(page)).toBeHidden();
});

test.describe('no iPhone', () => {
  test.use({ userAgent: devices['iPhone 13'].userAgent, viewport: devices['iPhone 13'].viewport });

  test('a splash mostra o caminho pelo Compartilhar e avisa do armazenamento separado', async ({ page }) => {
    await abrirNoDia(page);
    await expect(splash(page)).toBeVisible();
    await expect(page.getByText('Adicionar à Tela de Início')).toBeVisible();
    await expect(page.getByText('No iPhone, o app da tela de início guarda os registros separado')).toBeVisible();
    await verificarAcessibilidade(page);

    await configurar(page);
    await expect(card(page).getByText('Adicionar à Tela de Início')).toBeVisible();
    await expect(card(page).getByText('guarda os registros separado')).toBeHidden();
  });
});

test('aberto pela tela de início (já instalado), não mostra splash nem card', async ({ page }) => {
  await page.addInitScript(() => {
    const original = window.matchMedia.bind(window);
    window.matchMedia = (consulta: string) =>
      consulta.includes('display-mode: standalone')
        ? ({
            matches: true,
            media: consulta,
            addEventListener: () => undefined,
            removeEventListener: () => undefined,
          } as unknown as MediaQueryList)
        : original(consulta);
  });
  await abrirNoDia(page);
  await expect(page.getByLabel('Como quer ser chamado(a)?')).toBeVisible();
  await expect(splash(page)).toBeHidden();
  await configurar(page);
  await expect(card(page)).toBeHidden();
});
