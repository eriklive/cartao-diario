import { expect, test } from '@playwright/test';
import { configurar, verificarAcessibilidade } from './apoio';

test('adicionar, renomear, arquivar e restaurar comportamentos-alvo', async ({ page }) => {
  await configurar(page, ['Gastar demais']);
  await page.goto('/ajustes/comportamentos');
  await expect(page.getByText('Comportamentos-alvo · 1 de 7')).toBeVisible();
  await verificarAcessibilidade(page);

  await page.getByRole('button', { name: 'Adicionar comportamento-alvo' }).click();
  await page.getByLabel('Nome do novo comportamento-alvo').fill('Brigar');
  await page.getByRole('button', { name: 'Adicionar', exact: true }).click();
  await expect(page.getByText('“Brigar” adicionado ao registro do dia.')).toBeVisible();

  await page.getByRole('button', { name: 'Renomear Brigar' }).click();
  await page.getByLabel('Novo nome').fill('Brigar com a família');
  await page.getByRole('button', { name: 'Salvar' }).click();
  await expect(page.getByText('Nome atualizado.')).toBeVisible();

  await page.getByRole('button', { name: 'Arquivar Gastar demais' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Arquivar' }).click();
  await expect(page.getByText('“Gastar demais” arquivado.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Arquivados' })).toBeVisible();

  await page.goto('/dia/2026-10-18');
  await expect(page.getByRole('button', { name: 'Marcar Brigar com a família' })).toBeVisible();
  await expect(page.getByText('Gastar demais')).toBeHidden();

  await page.getByRole('link', { name: 'Gerenciar' }).click();
  await page.getByRole('button', { name: 'Restaurar Gastar demais' }).click();
  await expect(page.getByText('“Gastar demais” voltou ao registro do dia.')).toBeVisible();
});

test('limite de 7 comportamentos-alvo ativos', async ({ page }) => {
  await configurar(page, ['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7']);
  await page.goto('/ajustes/comportamentos');
  await expect(page.getByText('Comportamentos-alvo · 7 de 7')).toBeVisible();
  await expect(page.getByText('Você chegou ao limite de 7')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Adicionar comportamento-alvo' })).toBeHidden();
  await page.goto('/dia/2026-10-18');
  await expect(page.getByRole('link', { name: 'Novo comportamento-alvo' })).toBeHidden();
});
