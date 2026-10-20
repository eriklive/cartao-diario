import type { DataLocal } from '@cartao/shared/models';
import { diferencaEmDias, formatarDataNumerica, paraDataLocal } from '@cartao/shared/domain';

/** "hoje", "ontem", "há 12 dias" a partir de um instante ISO. */
export function tempoDesde(instante: string, hoje: DataLocal): string {
  const dias = diferencaEmDias(paraDataLocal(new Date(instante)), hoje);
  if (dias <= 0) return 'hoje';
  if (dias === 1) return 'ontem';
  return `há ${dias} dias`;
}

export function diasDesde(instante: string, hoje: DataLocal): number {
  return diferencaEmDias(paraDataLocal(new Date(instante)), hoje);
}

/** "18/10/2026" no fuso do aparelho, a partir de um instante ISO. */
export function formatarInstante(instante: string): string {
  return formatarDataNumerica(paraDataLocal(new Date(instante)));
}
