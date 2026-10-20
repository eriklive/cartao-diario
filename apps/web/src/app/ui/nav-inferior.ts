import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { Icone, type NomeIcone } from './icone';

@Component({
  selector: 'cd-nav-inferior',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive, Icone],
  styles: `
    nav {
      position: fixed;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 20;
      background: var(--cd-superficie);
      border-top: 1px solid var(--cd-borda);
      padding-bottom: var(--cd-seguro-baixo);
    }
    ul {
      list-style: none;
      margin: 0 auto;
      padding: 0;
      max-width: var(--cd-largura-max);
      height: var(--cd-altura-nav);
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }
    a {
      height: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 4px;
      font-size: 12px;
      color: var(--cd-texto-suave);
      text-decoration: none;
    }
    a.ativo {
      color: var(--cd-primaria);
      font-weight: 700;
    }
  `,
  template: `
    <nav aria-label="Principal">
      <ul>
        @for (aba of abas; track aba.rota) {
          <li>
            <a
              [routerLink]="aba.rota"
              routerLinkActive="ativo"
              [routerLinkActiveOptions]="{ exact: aba.exata }"
              ariaCurrentWhenActive="page"
            >
              <cd-icone [nome]="aba.icone" />
              {{ aba.rotulo }}
            </a>
          </li>
        }
      </ul>
    </nav>
  `,
})
export class NavInferior {
  protected readonly abas: { rota: string; rotulo: string; icone: NomeIcone; exata: boolean }[] = [
    { rota: '/hoje', rotulo: 'Hoje', icone: 'hoje', exata: true },
    { rota: '/semana', rotulo: 'Semana', icone: 'semana', exata: false },
    { rota: '/exportar', rotulo: 'Exportar', icone: 'exportar', exata: true },
    { rota: '/ajustes', rotulo: 'Ajustes', icone: 'ajustes', exata: false },
  ];
}
