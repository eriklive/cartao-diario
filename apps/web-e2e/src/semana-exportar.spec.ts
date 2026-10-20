import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { configurar, responder, verificarAcessibilidade } from './apoio';

async function preencherSemana(page: Page) {
  await configurar(page, ['Gastar demais']);
  await page.goto('./dia/2026-10-14');
  await responder(page, 'Me ferir', {
    intensidade: 4,
    uso: 'Usei automaticamente, ajudou',
    habilidades: [['Atenção Plena', 'Mente Sábia']],
  });
  await page.goto('./dia/2026-10-18');
  await responder(page, 'Gastar demais', { intensidade: 1, seguiu: true });
}

test('fechamento semanal salva sozinho e depois fecha a semana', async ({ page }) => {
  await preencherSemana(page);
  await page.getByRole('link', { name: 'Voltar ao início' }).click();
  await page.getByRole('link', { name: /Fechar a semana/ }).click();
  await expect(page.getByText('12 a 18 out · esta semana')).toBeVisible();
  await expect(page.getByText(/2 de 5 dias preenchidos · maior impulso: Me ferir, 4 \(quarta\)/)).toBeVisible();
  await verificarAcessibilidade(page);

  await page.getByLabel('Tarefa de casa da semana').fill('Praticar TIP');
  await page.getByRole('button', { name: '+2' }).click();
  await page.getByRole('button', { name: 'Aumentar Emoções' }).click();
  await page.getByRole('button', { name: 'Aumentar Emoções' }).click();
  await page.getByLabel('O que é importante seu terapeuta saber na próxima sessão?').fill('Semana difícil.');
  await expect(page.getByText('Rascunho salvo automaticamente.')).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Tarefa de casa da semana')).toHaveValue('Praticar TIP');
  await expect(page.getByRole('button', { name: '+2' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByLabel('Emoções: 2')).toBeVisible();
  await expect(page.getByText('Preencha antes da sessão.')).toBeVisible();

  await page.getByRole('button', { name: 'Salvar semana' }).click();
  await expect(page.getByText('Semana salva. Já entra na próxima exportação.')).toBeVisible();
  await page.getByRole('link', { name: 'Semanas' }).click();
  await expect(page).toHaveURL(/\/semana\/anteriores$/);
  await expect(page.getByText('Fechada', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Semana', exact: true })).toHaveAttribute('aria-current', 'page');
});

test('exporta PDF e planilha gerados no aparelho', async ({ page }) => {
  await preencherSemana(page);
  await page.goto('./exportar');
  await expect(page.getByText('12 a 18 out · 2 dias registrados')).toBeVisible();
  await verificarAcessibilidade(page);

  await page.getByRole('button', { name: 'Gerar PDF' }).click();
  const folha = page.getByRole('dialog', { name: 'Arquivo pronto' });
  await expect(folha.getByText('cartao-diario_2026-10-12_a_2026-10-18.pdf')).toBeVisible();
  const [pdf] = await Promise.all([
    page.waitForEvent('download'),
    folha.getByRole('button', { name: 'Baixar' }).click(),
  ]);
  expect(pdf.suggestedFilename()).toBe('cartao-diario_2026-10-12_a_2026-10-18.pdf');
  const conteudoPdf = await readFile(await pdf.path());
  expect(conteudoPdf.subarray(0, 4).toString()).toBe('%PDF');
  expect(conteudoPdf.toString('latin1').match(/\/Type \/Page\b/g)).toHaveLength(2);
  await folha.getByRole('button', { name: 'Fechar' }).click();

  await page.getByText('Últimas 4 semanas').click();
  await page.getByText('XLS', { exact: true }).click();
  await page.getByRole('checkbox', { name: 'Anotações para o terapeuta' }).uncheck();
  await page.getByRole('button', { name: 'Gerar planilha' }).click();
  const [xlsx] = await Promise.all([
    page.waitForEvent('download'),
    folha.getByRole('button', { name: 'Baixar' }).click(),
  ]);
  expect(xlsx.suggestedFilename()).toBe('cartao-diario_2026-09-21_a_2026-10-18.xlsx');
  expect((await readFile(await xlsx.path())).subarray(0, 2).toString()).toBe('PK');
});

test('sem nada em "Incluir" não dá para gerar', async ({ page }) => {
  await configurar(page);
  await page.goto('./exportar');
  for (const nome of [
    'Impulsos, comportamentos-alvo e habilidades usadas',
    'Fechamento semanal',
    'Anotações para o terapeuta',
  ]) {
    await page.getByRole('checkbox', { name: nome }).uncheck();
  }
  await expect(page.getByText('Escolha pelo menos um item.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Gerar PDF' })).toBeDisabled();
});
