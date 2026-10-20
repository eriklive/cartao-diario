import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { Instalacao } from '../core/plataforma/instalacao';
import { Avisos } from './avisos';
import { Icone } from './icone';

/**
 * Card "Adicione à tela de início". Mostra o botão nativo quando o navegador
 * oferece; senão, o passo a passo do aparelho (iPhone, Android ou outro).
 */
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
    .passos {
      margin: 0;
      padding-left: 22px;
      font-size: 15px;
      line-height: 1.5;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .simbolo {
      display: inline-flex;
      vertical-align: -3px;
      margin: 0 2px;
      color: var(--cd-primaria);
    }
    .aviso-ios {
      font-size: 14px;
      padding: 10px 12px;
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
        @switch (instalacao.plataforma) {
          @case ('ios') {
            <ol class="passos">
              <li>
                Toque em
                <span class="simbolo" aria-hidden="true"><cd-icone nome="exportar" [tamanho]="18" /></span>
                <b>Compartilhar</b>, na barra do navegador.
              </li>
              <li>Role a lista e toque em <b>Adicionar à Tela de Início</b>.</li>
              <li>Toque em <b>Adicionar</b> e abra o app pelo novo ícone.</li>
            </ol>
            @if (contexto() === 'primeiro-acesso') {
              <p class="cd-aviso cd-aviso--alerta aviso-ios">
                No iPhone, faça isso antes de começar: o app da tela de início guarda os registros separado do
                navegador.
              </p>
            }
          }
          @case ('android') {
            <ol class="passos">
              <li>
                Toque no menu
                <span class="simbolo" aria-hidden="true"><cd-icone nome="menu" [tamanho]="18" /></span>
                do navegador.
              </li>
              <li>Escolha <b>Instalar app</b> ou <b>Adicionar à tela inicial</b>.</li>
            </ol>
          }
          @case ('navegador-interno') {
            <p class="cd-ajuda">
              Este navegador, aberto dentro de outro app, não instala aplicativos. Abra este endereço no
              <b>Chrome</b> (Android) ou no <b>Safari</b> (iPhone).
            </p>
          }
          @default {
            <p class="cd-ajuda">
              No menu do navegador, procure <b>Instalar app</b> ou <b>Adicionar à tela inicial</b>. No celular, abra
              este endereço no Chrome (Android) ou no Safari (iPhone).
            </p>
          }
        }
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
  /** No primeiro acesso, o iPhone ganha um aviso a mais (armazenamento separado do Safari). */
  readonly contexto = input<'inicio' | 'primeiro-acesso'>('inicio');

  async instalar(): Promise<void> {
    if (await this.instalacao.instalar()) this.avisos.info('App adicionado. Abra pelo ícone na tela de início.');
  }
}
