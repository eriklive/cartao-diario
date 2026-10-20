import { Injectable, inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import type { Horario } from '@cartao/shared/models';
import { gerarIcsLembrete } from '@cartao/shared/domain';
import { Relogio } from '../relogio';
import { Arquivos } from './arquivos';

/** Lembrete diário como evento de calendário (.ics): funciona sem servidor no iOS e no Android. */
@Injectable({ providedIn: 'root' })
export class LembreteCalendario {
  private readonly arquivos = inject(Arquivos);
  private readonly relogio = inject(Relogio);
  private readonly documento = inject(DOCUMENT);

  baixar(horario: Horario): void {
    const ics = gerarIcsLembrete({
      horario,
      inicio: this.relogio.hoje(),
      url: new URL('/hoje', this.documento.baseURI).href,
      agora: this.relogio.agora(),
    });
    const arquivo = new File([ics], 'lembrete-cartao-diario.ics', { type: 'text/calendar;charset=utf-8' });
    this.arquivos.baixar(arquivo);
  }
}
