import { expect, test } from '@playwright/test';
import { AGORA, configurar, passarSplash, responder, verificarAcessibilidade } from './apoio';

test('backup feito num aparelho é restaurado em outro', async ({ page, browser }) => {
  await configurar(page, ['Gastar demais'], 'Bia');
  await page.goto('./dia/2026-10-18');
  await responder(page, 'Gastar demais', { intensidade: 2, seguiu: true });
  await page.goto('./ajustes');
  await expect(page.getByText('Último backup: nunca')).toBeVisible();
  await verificarAcessibilidade(page);

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Fazer backup' }).click(),
  ]);
  expect(download.suggestedFilename()).toBe('cartao-diario-backup-2026-10-18.json');
  const caminho = await download.path();
  await expect(page.getByText('Último backup: hoje (18/10/2026)')).toBeVisible();

  // Aparelho novo: restaura direto das boas-vindas.
  const outro = await browser.newContext({ locale: 'pt-BR', timezoneId: 'America/Sao_Paulo' });
  const novo = await outro.newPage();
  await novo.clock.setFixedTime(AGORA);
  await novo.goto('./');
  await passarSplash(novo);
  await novo.locator('input[type=file]').setInputFiles(caminho);
  await expect(novo).toHaveURL(/\/hoje$/);
  await expect(novo.getByRole('heading', { name: 'Olá, Bia' })).toBeVisible();
  await expect(novo.getByText('Gastar demais')).toBeVisible();
  await outro.close();
});

test('restaurar em Ajustes pede confirmação e recusa arquivos inválidos', async ({ page }) => {
  await configurar(page);
  await page.goto('./ajustes');
  await page.locator('input[type=file]').setInputFiles({
    name: 'qualquer.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"oi": 1}'),
  });
  await expect(page.getByText('Este arquivo não é um backup do Cartão Diário.')).toBeVisible();

  const backup = {
    app: 'cartao-diario',
    schemaVersion: 1,
    exportadoEm: '2026-10-10T12:00:00.000Z',
    dados: {
      perfil: {
        nome: 'Caio',
        lembrete: { ativo: false, horario: '21:00' },
        onboardingConcluidoEm: '2026-10-01T12:00:00.000Z',
        atualizadoEm: '2026-10-10T12:00:00.000Z',
      },
      comportamentos: [],
      dias: [],
      registros: [],
      fechamentos: [],
    },
  };
  await page.locator('input[type=file]').setInputFiles({
    name: 'backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(backup)),
  });
  const dialogo = page.getByRole('dialog', { name: 'Restaurar o backup de 10/10/2026?' });
  await expect(dialogo).toBeVisible();
  await dialogo.getByRole('button', { name: 'Restaurar' }).click();
  await expect(page.getByText('Backup restaurado.')).toBeVisible();
  await page.getByRole('link', { name: 'Hoje' }).click();
  await expect(page.getByRole('heading', { name: 'Olá, Caio' })).toBeVisible();
});
