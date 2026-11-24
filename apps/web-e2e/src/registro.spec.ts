import { expect, test } from '@playwright/test';
import { configurar, responder, verificarAcessibilidade } from './apoio';

test.beforeEach(async ({ page }) => {
  await configurar(page, ['Gastar demais']);
});

test('cada entrada começa vazia e o mesmo alvo pode ter várias entradas no dia', async ({ page }) => {
  await page.getByRole('link', { name: 'Abrir registro do dia' }).click();
  await expect(page).toHaveURL(/\/dia\/2026-10-18$/);
  await expect(page.getByRole('heading', { name: 'Como foi hoje?' })).toBeVisible();
  await verificarAcessibilidade(page);

  await page.getByRole('link', { name: 'Adicionar entrada' }).click();
  await expect(page.getByRole('heading', { name: 'Nova entrada' })).toBeVisible();
  const salvar = page.getByRole('button', { name: 'Salvar', exact: true });
  // Nada vem selecionado.
  await expect(page.locator('.cd-opcao[aria-pressed="true"], .habilidade[aria-pressed="true"]')).toHaveCount(0);
  await expect(salvar).toBeDisabled();

  await page.getByRole('button', { name: 'Vontade de me ferir', exact: true }).click();
  await expect(salvar).toBeDisabled();
  await expect(page.getByText('Você seguiu o impulso?')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Não pensei' })).toBeDisabled();

  await page.getByRole('button', { name: '3', exact: true }).click();
  await expect(page.getByText('Você seguiu o impulso?')).toBeVisible();
  // Com impulso, "seguiu?" é obrigatório.
  await expect(salvar).toBeDisabled();
  await page.getByRole('button', { name: 'Não', exact: true }).click();
  await expect(salvar).toBeEnabled();
  await page.getByRole('button', { name: 'Pensei, não usei, mas gostaria' }).click();
  await expect(page.getByRole('button', { name: 'Mente Sábia' })).toBeDisabled();
  await page.getByRole('button', { name: 'Tentei, usei, ajudaram' }).click();
  await page.getByRole('button', { name: 'Mente Sábia' }).click();
  await page.getByRole('button', { name: /^Tolerância ao Mal-estar/ }).click();
  await page.getByRole('button', { name: 'TIP' }).click();
  await expect(page.getByText('2 selecionadas: Mente Sábia, TIP')).toBeVisible();
  await verificarAcessibilidade(page);
  await salvar.click();

  await expect(page.getByText('Impulso 3 · não seguiu · 2 habilidades')).toBeVisible();
  await expect(page.getByText('1 entrada', { exact: true })).toBeVisible();

  // Uma nova entrada do mesmo alvo vem limpa.
  await page.getByRole('link', { name: 'Adicionar entrada' }).click();
  await expect(page.locator('.cd-opcao[aria-pressed="true"], .habilidade[aria-pressed="true"]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Vontade de me ferir', exact: true }).click();
  await page.getByRole('button', { name: '2', exact: true }).click();
  await page.getByRole('button', { name: 'Sim', exact: true }).click();
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(page.getByText('2 entradas')).toBeVisible();
  await expect(page.getByText('Impulso 2 · seguiu')).toBeVisible();

  // Editar mantém as respostas daquela entrada.
  await page.getByRole('link', { name: /Impulso 3 · não seguiu/ }).click();
  await expect(page.getByRole('heading', { name: 'Editar entrada' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Vontade de me ferir', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByRole('button', { name: '3', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Mente Sábia' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Voltar à lista sem salvar' }).click();

  // Remover pede confirmação e apaga só aquela entrada.
  await page.getByRole('button', { name: 'Remover entrada de Vontade de me ferir' }).first().click();
  const dialogo = page.getByRole('dialog', { name: 'Remover entrada de Vontade de me ferir?' });
  await expect(dialogo).toBeVisible();
  await dialogo.getByRole('button', { name: 'Manter' }).click();
  await expect(page.getByText('2 entradas')).toBeVisible();
  await page.getByRole('button', { name: 'Remover entrada de Vontade de me ferir' }).first().click();
  await page.getByRole('dialog').getByRole('button', { name: 'Remover' }).click();
  await expect(page.getByText('1 entrada', { exact: true })).toBeVisible();
  await expect(page.getByText('Impulso 2 · seguiu')).toBeVisible();
});

test('"Vontade de me matar" com intensidade alta mostra o apoio no formulário e em Hoje', async ({ page }) => {
  await page.goto('./dia/2026-10-18');
  await page.getByRole('link', { name: 'Adicionar entrada' }).click();
  await page.getByRole('button', { name: 'Vontade de me matar', exact: true }).click();
  await page.getByRole('button', { name: '3', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Ligar para o 188' })).toBeHidden();
  await page.getByRole('button', { name: '4', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Ligar para o 188' })).toHaveAttribute('href', 'tel:188');
  await page.getByRole('button', { name: 'Não', exact: true }).click();
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

  // Concluir só habilita depois de adicionar uma entrada ou escolher "Nada disso aconteceu".
  await page.goto('./dia/2026-10-17');
  const concluir = page.getByRole('button', { name: 'Concluir' });
  await expect(concluir).toBeDisabled();
  const nada = page.getByRole('button', { name: 'Nada disso aconteceu' });
  await nada.click();
  await expect(nada).toHaveAttribute('aria-pressed', 'true');
  await expect(concluir).toBeEnabled();
  await nada.click();
  await expect(concluir).toBeDisabled();
  await nada.click();
  await concluir.click();
  await expect(page.getByText('Sábado, 17 out registrado.')).toBeVisible();
  await expect(page.getByText('1 de 1 dia preenchido')).toBeVisible();
  await expect(page.getByRole('link', { name: /Sábado, 17 out: preenchido/ })).toBeVisible();
});

test('novo comportamento-alvo criado numa entrada aparece a partir daquele dia', async ({ page }) => {
  await page.goto('./dia/2026-10-17');
  await page.getByRole('link', { name: 'Adicionar entrada' }).click();
  await page.getByRole('button', { name: 'Novo comportamento-alvo' }).click();
  await page.getByRole('button', { name: '2', exact: true }).click();
  await page.getByRole('button', { name: 'Não', exact: true }).click();
  const salvar = page.getByRole('button', { name: 'Salvar', exact: true });
  await expect(salvar).toBeDisabled();
  await page.getByLabel('Nome do novo comportamento-alvo').fill('Gastar demais');
  await salvar.click();
  await expect(page.getByText('Já existe um comportamento com esse nome')).toBeVisible();
  await page.getByLabel('Nome do novo comportamento-alvo').fill('Isolar-me');
  await salvar.click();

  await expect(page).toHaveURL(/\/dia\/2026-10-17$/);
  await expect(page.getByRole('link', { name: /Isolar-me/ })).toBeVisible();
  await page.goto('./dia/2026-10-16');
  await page.getByRole('link', { name: 'Adicionar entrada' }).click();
  await expect(page.getByRole('button', { name: 'Isolar-me', exact: true })).toBeHidden();
  await page.goto('./dia/2026-10-18');
  await page.getByRole('link', { name: 'Adicionar entrada' }).click();
  await expect(page.getByRole('button', { name: 'Isolar-me', exact: true })).toBeVisible();
});

test('Hoje resume o dia e a semana', async ({ page }) => {
  await page.goto('./dia/2026-10-16');
  await responder(page, 'Vontade de usar drogas', { intensidade: 2, seguiu: true });
  await page.goto('./dia/2026-10-18');
  await responder(page, 'Vontade de me ferir', {
    intensidade: 3,
    uso: 'Tentei, usei, ajudaram',
    habilidades: [['Atenção Plena', 'Mente Sábia']],
  });
  await page.getByRole('link', { name: 'Voltar ao início' }).click();
  await expect(page.getByText('2 de 3 dias preenchidos · faltou sábado')).toBeVisible();
  await expect(page.getByText('1 entrada', { exact: true })).toBeVisible();
  await expect(page.getByText('1 habilidade')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Revisar registro do dia' })).toBeVisible();
});
