import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { DOCUMENT } from '@angular/common';

interface EventoInstalacao extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const CHAVE_DISPENSADO = 'cd.convite-instalar-dispensado-em';

/**
 * Instalar na tela de início protege os dados (o Safari pode apagar dados
 * de sites não instalados após 7 dias sem uso) e deixa o app offline.
 * Android/Chrome: botão com o prompt nativo. iOS: instruções.
 */
@Injectable({ providedIn: 'root' })
export class Instalacao {
  private readonly janela = inject(DOCUMENT).defaultView as Window & {
    navigator: Navigator & { standalone?: boolean };
  };
  private readonly evento = signal<EventoInstalacao | null>(null);

  readonly instalado = signal(this.estaInstalado());
  readonly ehIos =
    /iPad|iPhone|iPod/.test(this.janela.navigator.userAgent) ||
    (this.janela.navigator.platform === 'MacIntel' && this.janela.navigator.maxTouchPoints > 1);
  readonly podeInstalarDireto = computed(() => !!this.evento());
  readonly dispensado = signal(this.lerDispensado());
  /** Vale mostrar o convite: não instalado e há como instalar (prompt ou instruções do iOS). */
  readonly convidar = computed(() => !this.instalado() && (this.podeInstalarDireto() || this.ehIos));

  constructor() {
    const aoPedir = (e: Event) => {
      e.preventDefault();
      this.evento.set(e as EventoInstalacao);
    };
    const aoInstalar = () => {
      this.instalado.set(true);
      this.evento.set(null);
    };
    this.janela.addEventListener('beforeinstallprompt', aoPedir);
    this.janela.addEventListener('appinstalled', aoInstalar);
    inject(DestroyRef).onDestroy(() => {
      this.janela.removeEventListener('beforeinstallprompt', aoPedir);
      this.janela.removeEventListener('appinstalled', aoInstalar);
    });
  }

  async instalar(): Promise<boolean> {
    const e = this.evento();
    if (!e) return false;
    await e.prompt();
    const { outcome } = await e.userChoice;
    this.evento.set(null);
    return outcome === 'accepted';
  }

  dispensar(): void {
    this.dispensado.set(true);
    try {
      this.janela.localStorage.setItem(CHAVE_DISPENSADO, new Date().toISOString());
    } catch {
      // Sem armazenamento local: o convite só some nesta sessão.
    }
  }

  private estaInstalado(): boolean {
    return this.janela.matchMedia?.('(display-mode: standalone)').matches || this.janela.navigator.standalone === true;
  }

  private lerDispensado(): boolean {
    try {
      return !!this.janela.localStorage.getItem(CHAVE_DISPENSADO);
    } catch {
      return false;
    }
  }
}
