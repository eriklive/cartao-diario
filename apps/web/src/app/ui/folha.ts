import { ChangeDetectionStrategy, Component, ElementRef, effect, input, output, viewChild } from '@angular/core';

/** Folha que sobe do rodapé, sobre `<dialog>` nativo (foco preso, Esc fecha). */
@Component({
  selector: 'cd-folha',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    dialog {
      width: 100%;
      max-width: var(--cd-largura-max);
      margin: auto auto 0;
      border: 0;
      border-radius: 24px 24px 0 0;
      padding: 20px 20px calc(24px + var(--cd-seguro-baixo));
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
  `,
  template: `
    <dialog #dialogo [attr.aria-labelledby]="rotuladoPor()" (cancel)="$event.preventDefault(); fechar.emit()">
      <div class="corpo"><ng-content /></div>
    </dialog>
  `,
})
export class Folha {
  readonly aberta = input(false);
  readonly rotuladoPor = input<string>();
  readonly fechar = output<void>();

  private readonly dialogo = viewChild.required<ElementRef<HTMLDialogElement>>('dialogo');

  constructor() {
    effect(() => {
      const el = this.dialogo().nativeElement;
      if (this.aberta() && !el.open) el.showModal();
      if (!this.aberta() && el.open) el.close();
    });
  }
}
