import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { paraDataLocal } from '@cartao/shared/domain';

/** "Hoje" como sinal: vira sozinho à meia-noite e quando o app volta do segundo plano. */
@Injectable({ providedIn: 'root' })
export class Relogio {
  private readonly _hoje = signal(paraDataLocal(new Date()));
  readonly hoje = this._hoje.asReadonly();

  constructor() {
    const documento = inject(DOCUMENT);
    const atualizar = () => this._hoje.set(paraDataLocal(this.agora()));
    const intervalo = setInterval(atualizar, 30_000);
    documento.addEventListener('visibilitychange', atualizar);
    inject(DestroyRef).onDestroy(() => {
      clearInterval(intervalo);
      documento.removeEventListener('visibilitychange', atualizar);
    });
  }

  agora(): Date {
    return new Date();
  }

  instante(): string {
    return this.agora().toISOString();
  }
}
