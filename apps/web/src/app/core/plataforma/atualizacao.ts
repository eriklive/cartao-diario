import { DestroyRef, Injectable, inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { SwUpdate } from '@angular/service-worker';
import { Avisos } from '../../ui/avisos';

/** Avisa quando há versão nova do app (service worker) e recarrega a pedido. */
@Injectable({ providedIn: 'root' })
export class Atualizacao {
  private readonly sw = inject(SwUpdate);
  private readonly avisos = inject(Avisos);
  private readonly documento = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);

  iniciar(): void {
    if (!this.sw.isEnabled) return;
    const inscricoes = [
      this.sw.versionUpdates.subscribe((evento) => {
        if (evento.type === 'VERSION_READY') {
          this.avisos.info('Nova versão do app disponível.', {
            rotulo: 'Atualizar',
            executar: () => this.documento.location.reload(),
          });
        }
      }),
      this.sw.unrecoverable.subscribe(() => this.documento.location.reload()),
    ];
    const verificar = () => {
      if (this.documento.visibilityState === 'visible') this.sw.checkForUpdate().catch(() => undefined);
    };
    this.documento.addEventListener('visibilitychange', verificar);
    this.destroyRef.onDestroy(() => {
      inscricoes.forEach((i) => i.unsubscribe());
      this.documento.removeEventListener('visibilitychange', verificar);
    });
  }
}
