import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';

/** Stepper − valor + (entradas em sessão). */
@Component({
  selector: 'cd-contador',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: flex;
      align-items: center;
      border: 1px solid var(--cd-borda-forte);
      border-radius: var(--cd-raio-p);
      overflow: hidden;
      flex-shrink: 0;
    }
    button {
      width: 44px;
      height: 44px;
      border: 0;
      background: var(--cd-superficie);
      font-size: 22px;
      line-height: 1;
    }
    button:disabled {
      opacity: 0.3;
    }
    output {
      width: 32px;
      text-align: center;
      font-weight: 700;
      font-size: 17px;
    }
  `,
  template: `
    <button type="button" [disabled]="valor() <= min()" [attr.aria-label]="'Diminuir ' + rotulo()" (click)="mudar(-1)">
      −
    </button>
    <output aria-live="polite" [attr.aria-label]="rotulo() + ': ' + valor()">{{ valor() }}</output>
    <button type="button" [disabled]="valor() >= max()" [attr.aria-label]="'Aumentar ' + rotulo()" (click)="mudar(1)">
      +
    </button>
  `,
})
export class Contador {
  readonly valor = model(0);
  readonly min = input(0);
  readonly max = input(5);
  readonly rotulo = input.required<string>();

  mudar(delta: number): void {
    this.valor.set(Math.min(this.max(), Math.max(this.min(), this.valor() + delta)));
  }
}
