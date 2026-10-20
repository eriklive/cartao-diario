import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { DataLocalSchema } from '@cartao/shared/models';
import { podeEditarDia } from '@cartao/shared/domain';
import { CartaoStore } from './dados/cartao-store';

/** Telas do app: só depois do primeiro acesso. */
export const exigeConfiguracao: CanActivateFn = async () => {
  const store = inject(CartaoStore);
  const router = inject(Router);
  await store.aguardarCarga();
  return store.configurado() || store.erro() ? true : router.parseUrl('/boas-vindas');
};

/** Primeiro acesso: só enquanto não foi concluído. */
export const exigeSemConfiguracao: CanActivateFn = async () => {
  const store = inject(CartaoStore);
  const router = inject(Router);
  await store.aguardarCarga();
  return store.configurado() ? router.parseUrl('/hoje') : true;
};

/** Só dias de hoje até 6 dias atrás podem ser abertos; o resto cai em hoje. */
export const exigeDiaEditavel: CanActivateFn = (rota) => {
  const store = inject(CartaoStore);
  const router = inject(Router);
  const data = rota.paramMap.get('data') ?? '';
  const valida = DataLocalSchema.safeParse(data).success && podeEditarDia(data, store.hoje());
  return valida ? true : router.createUrlTree(['/dia', store.hoje()]);
};
