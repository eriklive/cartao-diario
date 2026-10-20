import { ChangeDetectionStrategy, Component, Injectable, inject, signal } from '@angular/core';
import { Icone } from './icone';

export interface Aviso {
  id: number;
  texto: string;
  tipo: 'info' | 'erro';
  acao?: { rotulo: string; executar: () => void };
}

/** Mensagens curtas (toasts), lidas por leitores de tela. */
@Injectable({ providedIn: 'root' })
export class Avisos {
  private seq = 0;
  readonly lista = signal<Aviso[]>([]);

  info(texto: string, acao?: Aviso['acao'], duracaoMs = 5000): void {
    this.mostrar({ texto, tipo: 'info', acao }, acao ? 0 : duracaoMs);
  }

  erro(texto: string): void {
    this.mostrar({ texto, tipo: 'erro' }, 8000);
  }

  /** Mostra a mensagem de um erro de validação, ou uma genérica para falhas inesperadas. */
  falha(erro: unknown, generico = 'Não foi possível salvar. Tente de novo.'): void {
    const deValidacao = erro instanceof Error && erro.name === 'ErroDeValidacao';
    if (!deValidacao) console.error(erro);
    this.erro(deValidacao ? erro.message : generico);
  }

  fechar(id: number): void {
    this.lista.update((l) => l.filter((a) => a.id !== id));
  }

  private mostrar(aviso: Omit<Aviso, 'id'>, duracaoMs: number): void {
    const id = ++this.seq;
    this.lista.update((l) => [...l.slice(-2), { ...aviso, id }]);
    if (duracaoMs > 0) setTimeout(() => this.fechar(id), duracaoMs);
  }
}

@Component({
  selector: 'cd-avisos',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icone],
  styles: `
    :host {
      position: fixed;
      left: 0;
      right: 0;
      bottom: calc(var(--cd-altura-nav) + var(--cd-seguro-baixo) + 12px);
      z-index: 50;
      pointer-events: none;
    }
    .pilha {
      max-width: var(--cd-largura-max);
      margin: 0 auto;
      padding: 0 var(--cd-margem);
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .aviso {
      pointer-events: auto;
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 8px 8px 16px;
      min-height: 52px;
      border-radius: var(--cd-raio-m);
      background: var(--cd-texto);
      color: #ffffff;
      font-size: 15px;
      line-height: 1.35;
    }
    .aviso--erro {
      background: var(--cd-perigo);
    }
    .texto {
      flex: 1;
    }
    .acao {
      min-height: 44px;
      padding: 0 12px;
      border: 0;
      border-radius: 10px;
      background: #ffffff;
      color: var(--cd-texto);
      font-weight: 700;
    }
    .fechar {
      color: #ffffff;
    }
  `,
  template: `
    <div class="pilha" role="status" aria-live="polite">
      @for (aviso of avisos.lista(); track aviso.id) {
        <div class="aviso" [class.aviso--erro]="aviso.tipo === 'erro'">
          <span class="texto">{{ aviso.texto }}</span>
          @if (aviso.acao; as acao) {
            <button type="button" class="acao" (click)="acao.executar(); avisos.fechar(aviso.id)">
              {{ acao.rotulo }}
            </button>
          }
          <button
            type="button"
            class="cd-botao-icone fechar"
            aria-label="Fechar aviso"
            (click)="avisos.fechar(aviso.id)"
          >
            <cd-icone nome="fechar" [tamanho]="18" />
          </button>
        </div>
      }
    </div>
  `,
})
export class AvisosRegiao {
  protected readonly avisos = inject(Avisos);
}
