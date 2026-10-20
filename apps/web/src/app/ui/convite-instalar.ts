import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { Instalacao } from '../core/plataforma/instalacao';
import { Avisos } from './avisos';
import { Icone } from './icone';

@Component({
  selector: 'cd-convite-instalar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icone],
  styles: `
    .topo {
      display: flex;
      gap: 14px;
      align-items: flex-start;
    }
    .icone {
      width: 44px;
      height: 44px;
      border-radius: 12px;
      background: var(--cd-primaria-suave);
      color: var(--cd-primaria);
      display: grid;
      place-items: center;
      flex-shrink: 0;
    }
    .textos {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .acoes {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }
    ol {
      margin: 0;
      padding-left: 20px;
      font-size: 15px;
      line-height: 1.5;
    }
  `,
  template: `
    <section class="cd-cartao" aria-labelledby="convite-titulo">
      <div class="topo">
        <span class="icone" aria-hidden="true"><cd-icone nome="instalar" /></span>
        <div class="textos">
          <h2 id="convite-titulo" class="cd-lista__titulo">Instale o app na tela de início</h2>
          <p class="cd-ajuda">Assim ele abre sem internet e o navegador não apaga seus registros.</p>
        </div>
      </div>
      @if (instalacao.podeInstalarDireto()) {
        <div class="acoes">
          <button type="button" class="cd-botao cd-botao--primario cd-botao--pequeno" (click)="instalar()">
            Instalar
          </button>
          @if (dispensavel()) {
            <button type="button" class="cd-botao cd-botao--texto" (click)="instalacao.dispensar()">Agora não</button>
          }
        </div>
      } @else if (instalacao.ehIos) {
        <ol>
          <li>Abra este app no <b>Safari</b>.</li>
          <li>Toque em <b>Compartilhar</b> (o quadrado com a seta para cima).</li>
          <li>Escolha <b>Adicionar à Tela de Início</b>.</li>
        </ol>
        @if (dispensavel()) {
          <div class="acoes">
            <button type="button" class="cd-botao cd-botao--texto" (click)="instalacao.dispensar()">Agora não</button>
          </div>
        }
      }
    </section>
  `,
})
export class ConviteInstalar {
  protected readonly instalacao = inject(Instalacao);
  private readonly avisos = inject(Avisos);
  readonly dispensavel = input(true);

  async instalar(): Promise<void> {
    if (await this.instalacao.instalar()) this.avisos.info('App instalado. Abra pela tela de início.');
  }
}
