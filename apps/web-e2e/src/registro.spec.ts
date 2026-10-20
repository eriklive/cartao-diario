import { expect, test } from '@playwright/test';
import { configurar, responder, verificarAcessibilidade } from './apoio';

test.beforeEach(async ({ page }) => {
  await configurar(page, ['Gastar demais']);
});

test('o formulário segue as regras do cartão e o resumo aparece na lista', async ({ page }) => {
  await page.getByRole('link', { name: 'Abrir registro do dia' }).click();
  await expect(page).toHaveURL(/\/dia\/2026-10-18$/);
  await expect(page.getByRole('heading', { name: 'Como foi hoje?' })).toBeVisible();
  await verificarAcessibilidade(page);

  await page.getByRole('button', { name: 'Marcar Me ferir' }).click();
  await expect(page.getByRole('heading', { name: 'Me ferir' })).toBeVisible();
  // Intensidade 0: sem "Seguiu?" e sem habilidades.
  await expect(page.getByText('Você seguiu o impulso?')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Não pensei' })).toBeDisabled();

  await page.getByRole('button', { name: '3', exact: true }).click();
  await expect(page.getByText('Você seguiu o impulso?')).toBeVisible();
  await page.getByRole('button', { name: 'Pensei, não usei, mas gostaria' }).click();
  await expect(page.getByRole('button', { name: 'Mente Sábia' })).toBeDisabled();
  await page.getByRole('button', { name: 'Tentei, usei, ajudaram' }).click();
  await page.getByRole('button', { name: 'Mente Sábia' }).click();
  await page.getByRole('button', { name: /^Tolerância ao Mal-estar/ }).click();
  await page.getByRole('button', { name: 'TIP' }).click();
  await expect(page.getByText('2 selecionadas: Mente Sábia, TIP')).toBeVisible();
  await verificarAcessibilidade(page);
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();

  await expect(page.getByText('Impulso 3 · não seguiu · 2 habilidades')).toBeVisible();
  await expect(page.getByText('1 marcado')).toBeVisible();

  // Editar mantém as respostas.
  await page.getByRole('button', { name: 'Editar resposta de Me ferir' }).click();
  await expect(page.getByRole('button', { name: '3', exact: true })).toHaveAttribute('aria-pressed', 'true');
  // Abre no primeiro módulo com habilidade marcada.
  await expect(page.getByRole('button', { name: 'Mente Sábia' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: /^Tolerância ao Mal-estar/ }).click();
  await expect(page.getByRole('button', { name: 'TIP' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Voltar à lista sem salvar' }).click();

  // Desmarcar pede confirmação e zera o item.
  await page.getByRole('button', { name: 'Desmarcar Me ferir' }).click();
  const dialogo = page.getByRole('dialog', { name: 'Desmarcar Me ferir?' });
  await expect(dialogo).toBeVisible();
  await dialogo.getByRole('button', { name: 'Manter' }).click();
  await expect(page.getByText('1 marcado')).toBeVisible();
  await page.getByRole('button', { name: 'Desmarcar Me ferir' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Desmarcar' }).click();
  await expect(page.getByText('0 marcados')).toBeVisible();
  await expect(page.getByText('Não registrado · conta como 0')).toHaveCount(4);
});

test('"Me matar" com intensidade alta mostra o apoio no formulário e em Hoje', async ({ page }) => {
  await page.goto('./dia/2026-10-18');
  await page.getByRole('button', { name: 'Marcar Me matar' }).click();
  await page.getByRole('button', { name: '3', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Ligar para o 188' })).toBeHidden();
  await page.getByRole('button', { name: '4', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Ligar para o 188' })).toHaveAttribute('href', 'tel:188');
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  await page.getByRole('button', { name: 'Concluir' }).click();
  await expect(page).toHaveURL(/\/hoje$/);
  await expect(page.getByText('Você não precisa passar por isso sozinho(a).')).toBeVisible();
});

test('dá para voltar até 6 dias, não para o futuro, e Concluir conta o dia', async ({ page }) => {
  await page.goto('./dia/2026-10-18');
  await expect(page.getByRole('button', { name: 'Próximo dia' })).toBeDisabled();
  for (let i = 0; i < 6; i++) await page.getByRole('button', { name: 'Dia anterior' }).click();
  await expect(page.getByText('Segunda, 12 out')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Como foi na segunda?' })).toBeVisible();
  await expect(page.getByText('Você está editando um dia anterior.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Dia anterior' })).toBeDisabled();

  await page.goto('./dia/2026-10-11');
  await expect(page).toHaveURL(/\/dia\/2026-10-18$/);
  await page.goto('./dia/2026-10-19');
  await expect(page).toHaveURL(/\/dia\/2026-10-18$/);

  // Dia sem nada marcado também conta, se a pessoa concluir.
  await page.goto('./dia/2026-10-17');
  await page.getByRole('button', { name: 'Concluir' }).click();
  await expect(page.getByText('Sábado, 17 out registrado.')).toBeVisible();
  await expect(page.getByText('1 de 1 dia preenchido')).toBeVisible();
  await expect(page.getByRole('link', { name: /Sábado, 17 out: preenchido/ })).toBeVisible();
});

test('novo comportamento-alvo criado no dia aparece a partir daquele dia', async ({ page }) => {
  await page.goto('./dia/2026-10-17');
  await page.getByRole('link', { name: 'Novo comportamento-alvo' }).click();
  await expect(page.getByRole('button', { name: 'Salvar', exact: true })).toBeDisabled();
  await page.getByLabel('Novo comportamento-alvo').fill('Gastar demais');
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(page.getByText('Já existe um comportamento com esse nome')).toBeVisible();
  await page.getByLabel('Novo comportamento-alvo').fill('Isolar-me');
  await page.getByRole('button', { name: '2', exact: true }).click();
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();

  await expect(page).toHaveURL(/\/dia\/2026-10-17$/);
  await expect(page.getByRole('button', { name: 'Desmarcar Isolar-me' })).toBeVisible();
  await page.getByRole('button', { name: 'Dia anterior' }).click();
  await expect(page.getByText('Isolar-me')).toBeHidden();
  await page.getByRole('button', { name: 'Próximo dia' }).click();
  await page.getByRole('button', { name: 'Próximo dia' }).click();
  await expect(page.getByRole('button', { name: 'Marcar Isolar-me' })).toBeVisible();
});

test('Hoje resume o dia e a semana', async ({ page }) => {
  await page.goto('./dia/2026-10-16');
  await responder(page, 'Usar drogas', { intensidade: 2, seguiu: true });
  await page.goto('./dia/2026-10-18');
  await responder(page, 'Me ferir', {
    intensidade: 3,
    uso: 'Tentei, usei, ajudaram',
    habilidades: [['Atenção Plena', 'Mente Sábia']],
  });
  await page.getByRole('link', { name: 'Voltar ao início' }).click();
  await expect(page.getByText('2 de 3 dias preenchidos · faltou sábado')).toBeVisible();
  await expect(page.getByText('1 marcado')).toBeVisible();
  await expect(page.getByText('1 habilidade')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Revisar registro do dia' })).toBeVisible();
});
