import {
  ApplicationConfig,
  inject,
  isDevMode,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import {
  TitleStrategy,
  provideRouter,
  withComponentInputBinding,
  withInMemoryScrolling,
  withRouterConfig,
} from '@angular/router';
import { provideServiceWorker } from '@angular/service-worker';
import { appRoutes } from './app.routes';
import { CartaoRepository } from './core/dados/cartao-repository';
import { IndexedDbCartaoRepository } from './core/dados/indexeddb-cartao-repository';
import { Armazenamento } from './core/plataforma/armazenamento';
import { Atualizacao } from './core/plataforma/atualizacao';
import { Instalacao } from './core/plataforma/instalacao';
import { SeloIcone } from './core/plataforma/selo-icone';
import { TituloDaPagina } from './core/titulo';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(
      appRoutes,
      withComponentInputBinding(),
      withInMemoryScrolling({ scrollPositionRestoration: 'top' }),
      withRouterConfig({ paramsInheritanceStrategy: 'always' }),
    ),
    { provide: TitleStrategy, useClass: TituloDaPagina },
    { provide: CartaoRepository, useFactory: () => new IndexedDbCartaoRepository() },
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:5000',
    }),
    provideAppInitializer(() => {
      // Instalação escuta `beforeinstallprompt` desde o início.
      inject(Instalacao);
      inject(Atualizacao).iniciar();
      inject(SeloIcone).iniciar();
      void inject(Armazenamento).verificar();
    }),
  ],
};
