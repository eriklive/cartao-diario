import { expect, test } from '@playwright/test';
import { abrirNoDia, verificarAcessibilidade } from './apoio';

test('primeiro acesso leva a Hoje e fica guardado no aparelho', async ({ page }) => {
  await abrirNoDia(page);
  await expect(page).toHaveURL(/\/boas-vindas$/);
  await verificarAcessibilidade(page);

  const continuar = page.getByRole('button', { name: 'Continuar' });
  await expect(continuar).toBeDisabled();
  await page.getByLabel('Como quer ser chamado(a)?').fill('Ana');
  await continuar.click();

  await expect(page.getByText('Comportamentos-alvo · 3 de 10')).toBeVisible();
  await page.getByRole('button', { name: 'Remover Vontade de usar drogas' }).click();
  await page.getByLabel('Novo comportamento-alvo').fill('Gastar demais');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Remover Gastar demais' })).toBeVisible();
  await page.getByLabel('Novo comportamento-alvo').fill('gastar DEMAIS');
  await page.getByRole('button', { name: 'Adicionar' }).click();
  await expect(page.getByText('Esse comportamento já está na lista.')).toBeVisible();
  await expect(page.getByText('Comportamentos-alvo · 3 de 10')).toBeVisible();
  await page.getByRole('button', { name: 'Continuar' }).click();

  await expect(page.getByRole('switch', { name: 'Lembrete diário' })).toHaveAttribute('aria-checked', 'true');
  await page.getByRole('button', { name: '22h' }).click();
  await verificarAcessibilidade(page);
  await page.getByRole('button', { name: 'Começar' }).click();

  await expect(page).toHaveURL(/\/hoje$/);
  await expect(page.getByText('Domingo, 18 de outubro')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Olá, Ana' })).toBeVisible();
  await expect(page.getByText('Comece registrando hoje.')).toBeVisible();
  await verificarAcessibilidade(page);

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Olá, Ana' })).toBeVisible();
  await page.goto('./boas-vindas');
  await expect(page).toHaveURL(/\/hoje$/);

  await page.getByRole('link', { name: 'Ajustes' }).click();
  await expect(page.getByText('Todos os dias às 22:00')).toBeVisible();
  await expect(page.getByText('3 comportamentos-alvo')).toBeVisible();
});

test('sem primeiro acesso, qualquer tela leva às boas-vindas', async ({ page }) => {
  await abrirNoDia(page, './exportar');
  await expect(page).toHaveURL(/\/boas-vindas$/);
});

test('tirar todos os sugeridos e pular os alvos também conclui o primeiro acesso', async ({ page }) => {
  await abrirNoDia(page);
  await page.getByLabel('Como quer ser chamado(a)?').fill('Ana');
  await page.getByRole('button', { name: 'Continuar' }).click();
  for (const nome of ['Vontade de me matar', 'Vontade de me ferir', 'Vontade de usar drogas'])
    await page.getByRole('button', { name: `Remover ${nome}` }).click();
  await page.getByRole('button', { name: 'Pular por enquanto' }).click();
  await page.getByRole('button', { name: 'Começar' }).click();
  await page.getByRole('link', { name: 'Ajustes' }).click();
  await expect(page.getByText('0 comportamentos-alvo')).toBeVisible();
});
