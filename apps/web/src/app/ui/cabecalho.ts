import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Icone } from './icone';

/** Título da tela com voltar opcional. Conteúdo projetado vira o subtítulo. */
@Component({
  selector: 'cd-cabecalho',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icone],
  styles: `
    header {
      padding: 20px var(--cd-margem) 4px;
      display: flex;
      align-items: flex-start;
      gap: 6px;
    }
    a {
      margin: -6px 0 0 -10px;
      color: var(--cd-texto);
    }
    .textos {
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 0;
    }
  `,
  template: `
    <header>
      @if (voltarPara(); as destino) {
        <a class="cd-botao-icone" [routerLink]="destino" [attr.aria-label]="rotuloVoltar()">
          <cd-icone nome="voltar" [tamanho]="22" />
        </a>
      }
      <div class="textos">
        <h1 class="cd-titulo-tela">{{ titulo() }}</h1>
        <div class="cd-subtitulo"><ng-content /></div>
      </div>
    </header>
  `,
})
export class Cabecalho {
  readonly titulo = input.required<string>();
  readonly voltarPara = input<string | null>(null);
  readonly rotuloVoltar = input('Voltar');
}
