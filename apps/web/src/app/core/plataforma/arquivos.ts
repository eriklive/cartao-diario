import { Injectable, inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';

export type ResultadoEnvio = 'compartilhado' | 'baixado' | 'cancelado';

/** Compartilhar (menu do celular), baixar e abrir arquivos gerados no aparelho. */
@Injectable({ providedIn: 'root' })
export class Arquivos {
  private readonly documento = inject(DOCUMENT);

  private get navegador(): Navigator | undefined {
    return this.documento.defaultView?.navigator;
  }

  podeCompartilhar(arquivo: File): boolean {
    const nav = this.navegador;
    return (
      !!nav &&
      typeof nav.share === 'function' &&
      typeof nav.canShare === 'function' &&
      nav.canShare({ files: [arquivo] })
    );
  }

  /**
   * Abre o menu de compartilhar do sistema (WhatsApp, e-mail, Arquivos).
   * Precisa vir direto de um toque: chame dentro do handler de clique.
   * Sem suporte, baixa o arquivo.
   */
  async compartilharOuBaixar(arquivo: File, titulo: string): Promise<ResultadoEnvio> {
    const nav = this.navegador;
    if (!nav || !this.podeCompartilhar(arquivo)) {
      this.baixar(arquivo);
      return 'baixado';
    }
    try {
      await nav.share({ files: [arquivo], title: titulo });
      return 'compartilhado';
    } catch (erro) {
      if (erro instanceof DOMException && erro.name === 'AbortError') return 'cancelado';
      this.baixar(arquivo);
      return 'baixado';
    }
  }

  baixar(arquivo: Blob, nome = arquivo instanceof File ? arquivo.name : 'arquivo'): void {
    const url = URL.createObjectURL(arquivo);
    const link = this.documento.createElement('a');
    link.href = url;
    link.download = nome;
    link.rel = 'noopener';
    this.documento.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  /** Abre o arquivo numa nova aba (prévia do PDF). */
  abrir(arquivo: Blob): void {
    const url = URL.createObjectURL(arquivo);
    const janela = this.documento.defaultView?.open(url, '_blank');
    if (!janela) this.baixar(arquivo);
    setTimeout(() => URL.revokeObjectURL(url), 5 * 60_000);
  }
}
