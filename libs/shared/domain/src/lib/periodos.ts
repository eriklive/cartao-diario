import type { DataLocal } from '@cartao/shared/models';
import { fimDaSemana, inicioDaSemana, menorData, somarDias } from './datas';

export type TipoPeriodo = 'semana' | 'quatro-semanas' | 'tudo';

export interface Periodo {
  inicio: DataLocal;
  fim: DataLocal;
}

export const ROTULOS_PERIODO: Record<TipoPeriodo, string> = {
  semana: 'Esta semana',
  'quatro-semanas': 'Últimas 4 semanas',
  tudo: 'Desde o início',
};

/** Período de exportação. Termina hoje; o PDF mostra semanas inteiras. */
export function periodoExportacao(tipo: TipoPeriodo, hoje: DataLocal, primeiroDia: DataLocal): Periodo {
  const semanaAtual = inicioDaSemana(hoje);
  switch (tipo) {
    case 'semana':
      return { inicio: semanaAtual, fim: hoje };
    case 'quatro-semanas':
      return { inicio: somarDias(semanaAtual, -21), fim: hoje };
    case 'tudo':
      return { inicio: menorData(primeiroDia, hoje), fim: hoje };
  }
}

/** Segundas-feiras das semanas que tocam o período, em ordem cronológica. */
export function semanasDoPeriodo(periodo: Periodo): DataLocal[] {
  const semanas: DataLocal[] = [];
  for (let s = inicioDaSemana(periodo.inicio); s <= periodo.fim; s = somarDias(s, 7)) semanas.push(s);
  return semanas;
}

export function periodoDaSemana(semanaInicio: DataLocal): Periodo {
  return { inicio: semanaInicio, fim: fimDaSemana(semanaInicio) };
}
