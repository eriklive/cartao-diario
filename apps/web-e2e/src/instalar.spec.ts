import { devices, expect, test, type Page } from '@playwright/test';
import { abrirNoDia, configurar, verificarAcessibilidade } from './apoio';

const card = (page: Page) => page.getByRole('region', { name: 'Adicione à tela de início' });

test.describe('no Android, sem o botão nativo do navegador', () => {
  test('mostra o passo a passo no primeiro acesso, em Hoje e em Ajustes', async ({ page }) => {
    await abrirNoDia(page);
    await expect(card(page)).toBeVisible();
    await expect(card(page).getByText('Instalar app')).toBeVisible();
    await expect(card(page).getByText('guarda os registros separado')).toBeHidden();
    await expect(card(page).getByRole('button', { name: 'Agora não' })).toBeHidden();
    await verificarAcessibilidade(page);

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

test('quando o navegador libera, o botão abre o pedido de instalação', async ({ page }) => {
  await configurar(page);
  await expect(card(page).getByRole('button', { name: 'Adicionar à tela de início' })).toBeHidden();

  await page.evaluate(() => {
    const evento = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
      prompt: async () => undefined,
      userChoice: Promise.resolve({ outcome: 'accepted' }),
    });
    window.dispatchEvent(evento);
  });
  await card(page).getByRole('button', { name: 'Adicionar à tela de início' }).click();
  await expect(page.getByText('App adicionado. Abra pelo ícone na tela de início.')).toBeVisible();
  await expect(card(page)).toBeHidden();
});

test.describe('no iPhone', () => {
  test.use({ userAgent: devices['iPhone 13'].userAgent, viewport: devices['iPhone 13'].viewport });

  test('mostra o caminho pelo Compartilhar e avisa para instalar antes de começar', async ({ page }) => {
    await abrirNoDia(page);
    await expect(card(page).getByText('Adicionar à Tela de Início')).toBeVisible();
    await expect(card(page).getByText('No iPhone, faça isso antes de começar')).toBeVisible();
    await verificarAcessibilidade(page);

    await configurar(page);
    await expect(card(page).getByText('Adicionar à Tela de Início')).toBeVisible();
    await expect(card(page).getByText('No iPhone, faça isso antes de começar')).toBeHidden();
  });
});

test('aberto pela tela de início (já instalado), não mostra o convite', async ({ page }) => {
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
  await expect(card(page)).toBeHidden();
  await configurar(page);
  await expect(card(page)).toBeHidden();
});
