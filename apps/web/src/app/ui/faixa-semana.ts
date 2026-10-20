import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { INICIAIS_DIAS, NOMES_DIAS, diaDaSemana, formatarDiaMes, type DiaDaFaixa } from '@cartao/shared/domain';

type Estado = 'preenchido' | 'faltou' | 'hoje' | 'neutro';

/** Seg–Dom com os dias preenchidos; dias editáveis viram links para o registro. */
@Component({
  selector: 'cd-faixa-semana',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  styles: `
    ol {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      grid-template-columns: repeat(7, minmax(0, 1fr));
      gap: 4px;
    }
    li {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
    }
    .letra {
      font-size: 12px;
      color: var(--cd-texto-suave);
    }
    .dia {
      display: grid;
      place-items: center;
      width: 44px;
      height: 44px;
      max-width: 100%;
      border-radius: 12px;
      font-size: 14px;
      font-weight: 700;
      text-decoration: none;
      color: var(--cd-texto-suave);
      border: 1.5px solid transparent;
    }
    .preenchido {
      background: var(--cd-primaria);
      color: #ffffff;
    }
    .faltou {
      border: 1.5px dashed var(--cd-icone-inativo);
    }
    .hoje {
      background: var(--cd-superficie);
      color: var(--cd-texto);
      border: 2px solid var(--cd-texto);
    }
    .preenchido.hoje {
      background: var(--cd-primaria);
      color: #ffffff;
      box-shadow:
        0 0 0 2px var(--cd-superficie),
        0 0 0 4px var(--cd-texto);
      border-color: transparent;
    }
    .neutro {
      opacity: 0.6;
    }
  `,
  template: `
    <ol>
      @for (d of itens(); track d.data) {
        <li>
          <span class="letra" aria-hidden="true">{{ d.letra }}</span>
          @if (d.link) {
            <a class="dia" [class]="d.classes" [routerLink]="['/dia', d.data]" [attr.aria-label]="d.rotulo">{{
              d.numero
            }}</a>
          } @else {
            <span class="dia" [class]="d.classes" role="img" [attr.aria-label]="d.rotulo">{{ d.numero }}</span>
          }
        </li>
      }
    </ol>
  `,
})
export class FaixaSemana {
  readonly dias = input.required<DiaDaFaixa[]>();

  protected readonly itens = computed(() =>
    this.dias().map((d) => {
      const estados: Estado[] = [];
      if (d.preenchido) estados.push('preenchido');
      else if (!d.futuro && !d.ehHoje && !d.antesDoInicio) estados.push('faltou');
      if (d.ehHoje) estados.push('hoje');
      if (!estados.length) estados.push('neutro');
      const situacao = d.preenchido
        ? 'preenchido'
        : d.ehHoje
          ? 'ainda não preenchido'
          : d.futuro || d.antesDoInicio
            ? ''
            : 'não preenchido';
      return {
        data: d.data,
        letra: INICIAIS_DIAS[diaDaSemana(d.data)],
        numero: Number(d.data.slice(8)),
        classes: 'dia ' + estados.join(' '),
        link: d.editavel && !d.futuro,
        rotulo: `${NOMES_DIAS[diaDaSemana(d.data)]}, ${formatarDiaMes(d.data)}${d.ehHoje ? ', hoje' : ''}${situacao ? `: ${situacao}` : ''}`,
      };
    }),
  );
}
