import { Injectable, inject, signal } from '@angular/core';
import { DOCUMENT } from '@angular/common';

/** Pede ao navegador para não apagar os dados quando faltar espaço. */
@Injectable({ providedIn: 'root' })
export class Armazenamento {
  private readonly storage = inject(DOCUMENT).defaultView?.navigator.storage;

  /** `null` = o navegador não informa. */
  readonly persistente = signal<boolean | null>(null);

  async verificar(): Promise<void> {
    if (!this.storage?.persisted) return;
    try {
      this.persistente.set(await this.storage.persisted());
    } catch {
      this.persistente.set(null);
    }
  }

  async pedirPersistencia(): Promise<boolean | null> {
    if (!this.storage?.persist) return null;
    try {
      const ok = await this.storage.persist();
      this.persistente.set(ok);
      return ok;
    } catch {
      return null;
    }
  }
}
