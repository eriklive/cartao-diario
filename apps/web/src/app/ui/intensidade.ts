import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** Cor da escala 0–5: o mesmo azul, só muda a claridade (legível para daltônicos). */
export function corIntensidade(i: number): { fundo: string; texto: string } {
  const n = Math.max(0, Math.min(5, i));
  return { fundo: `var(--cd-i${n})`, texto: n >= 4 ? '#ffffff' : 'var(--cd-texto)' };
}

@Component({
  selector: 'cd-selo-intensidade',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[style.background]': 'cor().fundo',
    '[style.color]': 'cor().texto',
    '[attr.aria-label]': '"Intensidade " + valor()',
    role: 'img',
  },
  styles: `
    :host {
      display: inline-grid;
      place-items: center;
      width: 28px;
      height: 28px;
      border-radius: 8px;
      font-weight: 700;
      font-size: 14px;
      flex-shrink: 0;
      border: 1px solid var(--cd-borda);
    }
  `,
  template: `{{ valor() }}`,
})
export class SeloIntensidade {
  readonly valor = input.required<number>();
  protected readonly cor = computed(() => corIntensidade(this.valor()));
}
