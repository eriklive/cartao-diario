import { Route } from '@angular/router';
import { exigeConfiguracao, exigeDiaEditavel, exigeSemConfiguracao } from './core/guardas';

export const appRoutes: Route[] = [
  {
    path: 'boas-vindas',
    title: 'Boas-vindas',
    canActivate: [exigeSemConfiguracao],
    loadComponent: () => import('./features/onboarding/onboarding').then((m) => m.OnboardingPagina),
  },
  {
    path: '',
    canActivate: [exigeConfiguracao],
    children: [
      {
        path: '',
        loadComponent: () => import('./ui/layout-abas').then((m) => m.LayoutAbas),
        children: [
          { path: '', pathMatch: 'full', redirectTo: 'hoje' },
          {
            path: 'hoje',
            title: 'Hoje',
            loadComponent: () => import('./features/hoje/hoje').then((m) => m.HojePagina),
          },
          {
            path: 'semana',
            title: 'Fechar a semana',
            loadComponent: () => import('./features/semana/semana').then((m) => m.SemanaPagina),
          },
          {
            path: 'semana/anteriores',
            title: 'Semanas',
            loadComponent: () => import('./features/historico/historico').then((m) => m.HistoricoPagina),
          },
          {
            path: 'semana/:inicio',
            title: 'Fechar a semana',
            loadComponent: () => import('./features/semana/semana').then((m) => m.SemanaPagina),
          },
          {
            path: 'exportar',
            title: 'Exportar',
            loadComponent: () => import('./features/exportar/exportar').then((m) => m.ExportarPagina),
          },
          {
            path: 'ajustes',
            title: 'Ajustes',
            loadComponent: () => import('./features/ajustes/ajustes').then((m) => m.AjustesPagina),
          },
          {
            path: 'ajustes/comportamentos',
            title: 'Meus comportamentos',
            loadComponent: () => import('./features/ajustes/comportamentos').then((m) => m.ComportamentosPagina),
          },
        ],
      },
      {
        path: 'dia/:data',
        title: 'Registro do dia',
        canActivate: [exigeDiaEditavel],
        loadComponent: () => import('./features/dia/dia').then((m) => m.DiaPagina),
      },
      {
        path: 'dia/:data/item/:id',
        title: 'Registro do dia',
        canActivate: [exigeDiaEditavel],
        loadComponent: () => import('./features/dia/formulario').then((m) => m.FormularioPagina),
      },
      {
        path: 'dia/:data/novo',
        title: 'Novo comportamento-alvo',
        canActivate: [exigeDiaEditavel],
        loadComponent: () => import('./features/dia/formulario').then((m) => m.FormularioPagina),
      },
    ],
  },
  { path: '**', redirectTo: 'hoje' },
];
