import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { Icone } from './icone';

/** Atalho fixo para o CVV (188). */
@Component({
  selector: 'cd-apoio-cvv',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icone],
  styles: `
    a {
      display: flex;
      gap: 10px;
      align-items: center;
      justify-content: center;
      min-height: 44px;
      font-size: 14px;
      color: var(--cd-texto-suave);
      text-decoration: none;
    }
    b {
      color: var(--cd-texto);
    }
  `,
  template: `
    <a href="tel:188">
      <cd-icone nome="apoio" [tamanho]="16" />
      Precisa de apoio agora? <b>CVV 188</b>
    </a>
  `,
})
export class ApoioCvv {}

/** Destaque quando "Me matar" é registrado com intensidade alta. */
@Component({
  selector: 'cd-apoio-destaque',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: 6px;
      background: var(--cd-alerta-fundo);
      color: var(--cd-texto);
      border-radius: var(--cd-raio-m);
      padding: 14px;
      font-size: 15px;
      line-height: 1.4;
    }
    .acoes {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 4px;
    }
    a {
      min-height: 44px;
      padding: 0 16px;
      border-radius: 22px;
      background: var(--cd-alerta-texto);
      color: #ffffff;
      font-weight: 700;
      display: inline-flex;
      align-items: center;
      text-decoration: none;
    }
    a.secundario {
      background: transparent;
      color: var(--cd-alerta-texto);
      border: 1px solid var(--cd-alerta-texto);
    }
  `,
  template: `
    <b>Você não precisa passar por isso sozinho(a).</b>
    <span>Ligue para o CVV no 188 (24h, gratuito) ou fale com seu terapeuta.</span>
    <div class="acoes">
      <a href="tel:188">Ligar para o 188</a>
      @if (telefoneTerapeuta(); as tel) {
        <a class="secundario" [href]="'tel:' + tel">Ligar para o terapeuta</a>
      }
    </div>
  `,
})
export class ApoioDestaque {
  readonly telefoneTerapeuta = input<string | undefined>();
}
