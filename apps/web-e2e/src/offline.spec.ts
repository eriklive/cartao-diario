import { expect, test } from '@playwright/test';
import { configurar } from './apoio';

test('depois da primeira visita o app abre e exporta sem internet', async ({ page, context }) => {
  await configurar(page);
  // Espera o service worker assumir a página e terminar de baixar o app.
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise((ok) => navigator.serviceWorker.addEventListener('controllerchange', ok, { once: true }));
    }
  });
  // Todo o grupo "app" do ngsw.json (inclusive o pdfmake) precisa estar no cache.
  await expect
    .poll(
      () =>
        page.evaluate(async () => {
          const manifesto = await (
            await fetch(new URL(`ngsw.json?ngsw-cache-bust=${Math.random()}`, document.baseURI))
          ).json();
          const urls: string[] = manifesto.assetGroups.find((g: { name: string }) => g.name === 'app').urls;
          const nome = (await caches.keys()).find((n) => n.endsWith(':assets:app:cache'));
          if (!nome) return false;
          const guardados = new Set((await (await caches.open(nome)).keys()).map((r) => new URL(r.url).pathname));
          return urls.every((u) => guardados.has(u));
        }),
      { timeout: 30_000 },
    )
    .toBe(true);

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Olá, Ana' })).toBeVisible();
  await page.getByRole('link', { name: 'Exportar', exact: true }).click();
  await page.getByRole('button', { name: 'Gerar PDF' }).click();
  await expect(page.getByRole('dialog', { name: 'Arquivo pronto' })).toBeVisible();
});
