import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CartaoStore } from './core/dados/cartao-store';
import { ApoioCvv } from './ui/apoio';
import { AvisosRegiao } from './ui/avisos';

@Component({
  selector: 'cd-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, AvisosRegiao, ApoioCvv],
  template: `
    @if (store.erro()) {
      <main class="cd-tela">
        <div class="cd-conteudo">
          <h1 class="cd-titulo-tela">Não foi possível abrir seus dados</h1>
          <p class="cd-subtitulo">
            Este navegador bloqueou o armazenamento do app. Isso costuma acontecer em janelas anônimas ou com dados de
            sites desativados. Abra o app numa janela normal ou instale-o na tela de início.
          </p>
          <cd-apoio-cvv />
        </div>
      </main>
    } @else {
      <router-outlet />
    }
    <cd-avisos />
  `,
})
export class App {
  protected readonly store = inject(CartaoStore);
}
