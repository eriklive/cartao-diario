import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { Instalacao } from '../core/plataforma/instalacao';
import { Avisos } from './avisos';
import { Icone } from './icone';
import { PassosInstalacao } from './passos-instalacao';

/**
 * Card "Adicione à tela de início". Mostra o botão nativo quando o navegador
 * oferece; senão, o passo a passo do aparelho (iPhone, Android ou outro).
 */
@Component({
  selector: 'cd-convite-instalar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icone, PassosInstalacao],
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
  `,
  template: `
    <section class="cd-cartao" aria-labelledby="convite-titulo">
      <div class="topo">
        <span class="icone" aria-hidden="true"><cd-icone nome="instalar" /></span>
        <div class="textos">
          <h2 id="convite-titulo" class="cd-lista__titulo">Adicione à tela de início</h2>
          <p class="cd-ajuda">Ele abre como um app, funciona sem internet e o navegador não apaga seus registros.</p>
        </div>
      </div>

      @if (instalacao.podeInstalarDireto()) {
        <button type="button" class="cd-botao cd-botao--primario" (click)="instalar()">
          <cd-icone nome="instalar" [tamanho]="20" />
          Adicionar à tela de início
        </button>
      } @else {
        <cd-passos-instalacao />
      }

      @if (dispensavel()) {
        <button type="button" class="cd-botao cd-botao--texto" (click)="instalacao.dispensar()">Agora não</button>
      }
    </section>
  `,
})
export class ConviteInstalar {
  protected readonly instalacao = inject(Instalacao);
  private readonly avisos = inject(Avisos);
  readonly dispensavel = input(true);

  async instalar(): Promise<void> {
    if (await this.instalacao.instalar()) this.avisos.info('App adicionado. Abra pelo ícone na tela de início.');
  }
}
