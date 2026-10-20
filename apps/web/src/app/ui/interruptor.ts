import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';

@Component({
  selector: 'cd-interruptor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    button {
      width: 52px;
      height: 32px;
      border-radius: 16px;
      border: 0;
      padding: 3px;
      display: flex;
      align-items: center;
      justify-content: flex-start;
      background: var(--cd-borda-forte);
      flex-shrink: 0;
    }
    button[aria-checked='true'] {
      background: var(--cd-primaria);
      justify-content: flex-end;
    }
    span {
      display: block;
      width: 26px;
      height: 26px;
      border-radius: 13px;
      background: #ffffff;
    }
  `,
  template: `
    <button
      type="button"
      role="switch"
      [attr.aria-checked]="ligado()"
      [attr.aria-label]="rotulo()"
      [disabled]="desativado()"
      (click)="ligado.set(!ligado())"
    >
      <span></span>
    </button>
  `,
})
export class Interruptor {
  readonly ligado = model(false);
  readonly rotulo = input.required<string>();
  readonly desativado = input(false);
}
