import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Instalacao } from '../core/plataforma/instalacao';
import { Icone } from './icone';

/** Passo a passo para adicionar à tela de início, conforme o aparelho. */
@Component({
  selector: 'cd-passos-instalacao',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icone],
  styles: `
    :host {
      display: block;
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
  `,
  template: `
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
          No menu do navegador, procure <b>Instalar app</b> ou <b>Adicionar à tela inicial</b>. No celular, abra este
          endereço no Chrome (Android) ou no Safari (iPhone).
        </p>
      }
    }
  `,
})
export class PassosInstalacao {
  protected readonly instalacao = inject(Instalacao);
}
