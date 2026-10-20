import { ChangeDetectionStrategy, Component, inject, output } from '@angular/core';
import { Instalacao } from '../../core/plataforma/instalacao';
import { Avisos } from '../../ui/avisos';
import { Icone } from '../../ui/icone';
import { IlustracaoTelaInicio } from '../../ui/ilustracao-tela-inicio';
import { PassosInstalacao } from '../../ui/passos-instalacao';

/**
 * Primeira tela do primeiro acesso no navegador: convida a adicionar o app
 * à tela de início antes de começar. No iPhone isso importa ainda mais: o app
 * da tela de início guarda os dados separado do navegador.
 */
@Component({
  selector: 'cd-splash-instalar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icone, IlustracaoTelaInicio, PassosInstalacao],
  styles: `
    :host {
      flex: 1;
      display: flex;
      flex-direction: column;
    }
    .arte {
      border-radius: 0 0 32px 32px;
      overflow: hidden;
      background: #0d1b3d;
      aspect-ratio: 390 / 340;
      max-height: 44dvh;
    }
    .corpo {
      flex: 1;
      padding: 24px 24px 8px;
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    h1 {
      font-size: 28px;
      line-height: 1.15;
    }
    .beneficios {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 8px;
      font-size: 16px;
      color: var(--cd-texto-2);
    }
    .beneficios li {
      display: flex;
      gap: 10px;
      align-items: center;
    }
    .marca {
      width: 26px;
      height: 26px;
      border-radius: 13px;
      background: var(--cd-primaria-suave);
      color: var(--cd-primaria);
      display: grid;
      place-items: center;
      flex-shrink: 0;
    }
    .aviso-ios {
      font-size: 14px;
      padding: 10px 12px;
    }
    .rodape {
      padding: 8px 24px calc(24px + var(--cd-seguro-baixo));
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
  `,
  template: `
    <div class="arte"><cd-ilustracao-tela-inicio /></div>

    <section class="corpo" aria-labelledby="splash-titulo">
      <p class="cd-rotulo-secao">Antes de começar</p>
      <h1 id="splash-titulo">Leve o Cartão Diário para a tela de início</h1>
      <ul class="beneficios">
        @for (b of beneficios; track b) {
          <li>
            <span class="marca" aria-hidden="true"><cd-icone nome="check" [tamanho]="16" [espessura]="2.5" /></span>
            {{ b }}
          </li>
        }
      </ul>

      @if (!instalacao.podeInstalarDireto()) {
        <cd-passos-instalacao />
        @if (instalacao.plataforma === 'ios') {
          <p class="cd-aviso cd-aviso--alerta aviso-ios">
            No iPhone, o app da tela de início guarda os registros separado do navegador. Adicione agora e comece pelo
            novo ícone.
          </p>
        }
      }
    </section>

    <div class="rodape">
      @if (instalacao.podeInstalarDireto()) {
        <button type="button" class="cd-botao cd-botao--primario cd-botao--largo" (click)="instalar()">
          <cd-icone nome="instalar" [tamanho]="20" />
          Adicionar à tela de início
        </button>
      }
      <button
        type="button"
        class="cd-botao cd-botao--largo"
        [class.cd-botao--texto]="instalacao.podeInstalarDireto()"
        (click)="continuar.emit()"
      >
        Continuar no navegador
      </button>
    </div>
  `,
})
export class SplashInstalar {
  protected readonly instalacao = inject(Instalacao);
  private readonly avisos = inject(Avisos);
  readonly continuar = output<void>();

  protected readonly beneficios = [
    'Abre como um app, direto do ícone',
    'Funciona sem internet',
    'O navegador não apaga seus registros',
  ];

  async instalar(): Promise<void> {
    if (await this.instalacao.instalar()) {
      this.avisos.info('App adicionado. Abra pelo ícone na tela de início.');
      this.continuar.emit();
    }
  }
}
