import { expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/** Domingo, 18 de outubro de 2026, 21h em São Paulo. */
export const AGORA = new Date('2026-10-18T21:00:00-03:00');

export async function abrirNoDia(pagina: Page, caminho = './', agora = AGORA): Promise<void> {
  await pagina.clock.setFixedTime(agora);
  await pagina.goto(caminho);
}

/** Faz o primeiro acesso completo (mantendo os 3 alvos sugeridos) e para em Hoje. */
export async function configurar(pagina: Page, alvos: string[] = [], nome = 'Ana'): Promise<void> {
  await abrirNoDia(pagina);
  await pagina.waitForURL('**/boas-vindas');
  await pagina.getByLabel('Como quer ser chamado(a)?').fill(nome);
  await pagina.getByRole('button', { name: 'Continuar' }).click();
  for (const alvo of alvos) {
    await pagina.getByLabel('Novo comportamento-alvo').fill(alvo);
    await pagina.getByRole('button', { name: 'Adicionar' }).click();
  }
  await pagina.getByRole('button', { name: 'Continuar' }).click();
  await pagina.getByRole('button', { name: 'Começar' }).click();
  await pagina.waitForURL('**/hoje');
  await expect(pagina.getByRole('heading', { name: `Olá, ${nome}` })).toBeVisible();
}

/** Na lista do dia aberta, adiciona uma entrada para o alvo e volta à lista. */
export async function responder(
  pagina: Page,
  alvo: string,
  r: { intensidade: number; seguiu?: boolean; uso?: string; habilidades?: [string, string][] },
): Promise<void> {
  await pagina.getByRole('link', { name: 'Adicionar entrada' }).click();
  await pagina.getByRole('button', { name: alvo, exact: true }).click();
  await pagina.getByRole('button', { name: String(r.intensidade), exact: true }).click();
  if (r.intensidade > 0) await pagina.getByRole('button', { name: r.seguiu ? 'Sim' : 'Não', exact: true }).click();
  if (r.uso) await pagina.getByRole('button', { name: r.uso, exact: true }).click();
  for (const [modulo, habilidade] of r.habilidades ?? []) {
    await pagina.getByRole('button', { name: new RegExp(`^${modulo}`) }).click();
    await pagina.getByRole('button', { name: habilidade, exact: true }).click();
  }
  await pagina.getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(pagina.getByRole('heading', { level: 1, name: /^Como foi/ })).toBeVisible();
}

/** Falha em violações sérias ou críticas de acessibilidade (axe). */
export async function verificarAcessibilidade(pagina: Page): Promise<void> {
  const resultado = await new AxeBuilder({ page: pagina }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  const graves = resultado.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(graves.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
}
