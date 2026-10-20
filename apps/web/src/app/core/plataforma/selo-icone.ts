import { Injectable, Injector, effect, inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { diasPendentes } from '@cartao/shared/domain';
import { CartaoStore } from '../dados/cartao-store';

/** Número no ícone do app instalado: dias que ainda dá para preencher e estão em branco. */
@Injectable({ providedIn: 'root' })
export class SeloIcone {
  private readonly store = inject(CartaoStore);
  private readonly injector = inject(Injector);
  private readonly navegador = inject(DOCUMENT).defaultView?.navigator as
    | (Navigator & { setAppBadge?: (n?: number) => Promise<void>; clearAppBadge?: () => Promise<void> })
    | undefined;

  iniciar(): void {
    const nav = this.navegador;
    if (!nav?.setAppBadge || !nav.clearAppBadge) return;
    const definir = nav.setAppBadge.bind(nav);
    const limpar = nav.clearAppBadge.bind(nav);
    effect(
      () => {
        if (!this.store.configurado()) return;
        const n = diasPendentes(this.store.indice(), this.store.hoje(), this.store.primeiroDia()).length;
        (n > 0 ? definir(n) : limpar()).catch(() => undefined);
      },
      { injector: this.injector },
    );
  }
}
