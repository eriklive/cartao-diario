import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { DOCUMENT } from '@angular/common';

interface EventoInstalacao extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const CHAVE_DISPENSADO = 'cd.convite-instalar-dispensado-em';
/** "Agora não" esconde o convite em Hoje por este tempo; depois ele volta. */
const DIAS_DISPENSADO = 30;

/** Como instalar neste aparelho, quando o navegador não oferece o botão nativo. */
export type PlataformaInstalacao = 'ios' | 'android' | 'navegador-interno' | 'outra';

/**
 * Instalar na tela de início protege os dados (o Safari pode apagar dados
 * de sites não instalados após 7 dias sem uso) e deixa o app offline.
 * Chrome/Edge: botão com o prompt nativo, quando o navegador libera.
 * Nos demais: instruções para o aparelho.
 */
@Injectable({ providedIn: 'root' })
export class Instalacao {
  private readonly janela = inject(DOCUMENT).defaultView as Window & {
    navigator: Navigator & { standalone?: boolean };
  };
  private readonly evento = signal<EventoInstalacao | null>(null);

  readonly instalado = signal(this.estaInstalado());
  readonly plataforma = this.detectarPlataforma();
  /** O navegador já ofereceu o prompt nativo (Chrome libera depois de algum uso do site). */
  readonly podeInstalarDireto = computed(() => !!this.evento());
  readonly dispensado = signal(this.lerDispensado());
  /** Vale mostrar o convite: o app está aberto no navegador, não instalado. */
  readonly convidar = computed(() => !this.instalado());

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
    if (outcome === 'accepted') this.instalado.set(true);
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
      const em = this.janela.localStorage.getItem(CHAVE_DISPENSADO);
      return !!em && Date.now() - Date.parse(em) < DIAS_DISPENSADO * 86_400_000;
    } catch {
      return false;
    }
  }

  private detectarPlataforma(): PlataformaInstalacao {
    const nav = this.janela.navigator;
    const ua = nav.userAgent;
    // Navegadores embutidos em outros apps (Instagram, Facebook…) não instalam PWAs.
    if (/FBAN|FBAV|Instagram|Line\/|; wv\)/.test(ua)) return 'navegador-interno';
    if (/iPad|iPhone|iPod/.test(ua) || (nav.platform === 'MacIntel' && nav.maxTouchPoints > 1)) return 'ios';
    if (/Android/.test(ua)) return 'android';
    return 'outra';
  }
}
