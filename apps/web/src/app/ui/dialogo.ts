import { ChangeDetectionStrategy, Component, ElementRef, effect, input, output, viewChild } from '@angular/core';

/**
 * Diálogo de confirmação sobre `<dialog>` nativo: foco preso, Esc fecha,
 * fundo inerte. Abre e fecha pelo input `aberto`.
 */
@Component({
  selector: 'cd-dialogo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    dialog {
      width: min(100% - 48px, 420px);
      border: 0;
      border-radius: var(--cd-raio-modal);
      padding: 22px;
      background: var(--cd-superficie);
      color: var(--cd-texto);
    }
    dialog::backdrop {
      background: rgba(26, 34, 48, 0.45);
    }
    .corpo {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    h2 {
      font-size: 22px;
    }
    .acoes {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      margin-top: 8px;
    }
  `,
  template: `
    <dialog #dialogo [attr.aria-labelledby]="idTitulo" (cancel)="aoCancelar($event)">
      <div class="corpo">
        <h2 [id]="idTitulo">{{ titulo() }}</h2>
        <p class="cd-ajuda">{{ mensagem() }}</p>
        <ng-content />
        <div class="acoes">
          <button type="button" class="cd-botao" (click)="cancelar.emit()">{{ rotuloCancelar() }}</button>
          <button
            type="button"
            class="cd-botao"
            [class.cd-botao--perigo]="perigoso()"
            [class.cd-botao--primario]="!perigoso()"
            (click)="confirmar.emit()"
          >
            {{ rotuloConfirmar() }}
          </button>
        </div>
      </div>
    </dialog>
  `,
})
export class Dialogo {
  private static contador = 0;
  readonly idTitulo = `cd-dialogo-${++Dialogo.contador}`;

  readonly aberto = input(false);
  readonly titulo = input.required<string>();
  readonly mensagem = input('');
  readonly rotuloConfirmar = input('Confirmar');
  readonly rotuloCancelar = input('Cancelar');
  readonly perigoso = input(false);
  readonly confirmar = output<void>();
  readonly cancelar = output<void>();

  private readonly dialogo = viewChild.required<ElementRef<HTMLDialogElement>>('dialogo');

  constructor() {
    effect(() => {
      const el = this.dialogo().nativeElement;
      if (this.aberto() && !el.open) el.showModal();
      if (!this.aberto() && el.open) el.close();
    });
  }

  /** Esc: quem decide fechar é o pai, pelo input `aberto`. */
  aoCancelar(evento: Event): void {
    evento.preventDefault();
    this.cancelar.emit();
  }
}
