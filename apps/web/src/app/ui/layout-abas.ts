import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NavInferior } from './nav-inferior';

/** Telas principais: conteúdo + navegação inferior. */
@Component({
  selector: 'cd-layout-abas',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, NavInferior],
  template: `
    <router-outlet />
    <cd-nav-inferior />
  `,
})
export class LayoutAbas {}
