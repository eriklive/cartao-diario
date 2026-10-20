import { Injectable, inject } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { TitleStrategy, type RouterStateSnapshot } from '@angular/router';

@Injectable({ providedIn: 'root' })
export class TituloDaPagina extends TitleStrategy {
  private readonly title = inject(Title);

  override updateTitle(estado: RouterStateSnapshot): void {
    const titulo = this.buildTitle(estado);
    this.title.setTitle(titulo ? `${titulo} · Cartão Diário` : 'Cartão Diário');
  }
}
