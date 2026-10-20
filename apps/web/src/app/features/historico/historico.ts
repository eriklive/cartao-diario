import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  fimDaSemana,
  formatarPeriodoCurto,
  frequencia,
  listarSemanas,
  maiorImpulso,
  registrosDoPeriodo,
} from '@cartao/shared/domain';
import { CartaoStore } from '../../core/dados/cartao-store';
import { Cabecalho } from '../../ui/cabecalho';
import { Icone } from '../../ui/icone';
import { SeloIntensidade } from '../../ui/intensidade';

@Component({
  selector: 'cd-historico',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Cabecalho, Icone, SeloIntensidade],
  styles: `
    .situacao {
      display: inline-block;
      font-size: 12px;
      font-weight: 700;
      padding: 2px 8px;
      border-radius: 999px;
      background: var(--cd-divisor);
      color: var(--cd-texto-suave);
    }
    .situacao--fechada {
      background: var(--cd-primaria-suave);
      color: var(--cd-primaria);
    }
    .linha {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }
  `,
  template: `
    <main class="cd-tela">
      <cd-cabecalho titulo="Semanas" voltarPara="/semana" rotuloVoltar="Voltar ao fechamento">
        Semanas fechadas e em aberto, da mais recente para a mais antiga.
      </cd-cabecalho>
      <div class="cd-conteudo cd-conteudo--com-nav">
        <ul class="cd-lista">
          @for (s of semanas(); track s.inicio) {
            <li>
              <a class="cd-lista__item" [routerLink]="['/semana', s.inicio]">
                <span class="cd-lista__texto">
                  <span class="cd-lista__titulo">{{ s.periodo }}</span>
                  <span class="linha">
                    <span class="situacao" [class.situacao--fechada]="s.fechada">{{
                      s.fechada ? 'Fechada' : 'Em aberto'
                    }}</span>
                    <span class="cd-lista__detalhe">{{ s.dias }}</span>
                  </span>
                  @if (s.maior; as m) {
                    <span class="cd-lista__detalhe linha">
                      Maior impulso: <cd-selo-intensidade [valor]="m.intensidade" /> {{ m.nome }}
                    </span>
                  }
                </span>
                <cd-icone nome="avancar" [tamanho]="18" />
              </a>
            </li>
          }
        </ul>
      </div>
    </main>
  `,
})
export class HistoricoPagina {
  private readonly store = inject(CartaoStore);

  protected readonly semanas = computed(() => {
    const hoje = this.store.hoje();
    const indice = this.store.indice();
    return listarSemanas(this.store.primeiroDia(), hoje).map((inicio) => {
      const fim = fimDaSemana(inicio);
      const f = frequencia(indice, inicio, fim, hoje, this.store.primeiroDia());
      const maior = maiorImpulso(registrosDoPeriodo(indice, inicio, fim), this.store.comportamentos());
      return {
        inicio,
        periodo: formatarPeriodoCurto(inicio, fim),
        fechada: !!this.store.fechamento(inicio)?.fechadaEm,
        dias: f.total ? `${f.preenchidos} de ${f.total} dias preenchidos` : 'Nenhum dia ainda',
        maior: maior ? { intensidade: maior.intensidade, nome: maior.comportamento.nome } : null,
      };
    });
  });
}
