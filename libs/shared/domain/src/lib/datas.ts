import type { DataLocal } from '@cartao/shared/models';

/*
 * Datas de calendário são strings `AAAA-MM-DD`. As contas são feitas em UTC
 * sobre a data pura, então fuso e horário de verão não interferem.
 */

const DIA_MS = 86_400_000;

export const NOMES_DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'] as const;
export const NOMES_DIAS_CURTOS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'] as const;
export const INICIAIS_DIAS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'] as const;
export const NOMES_MESES = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
] as const;

function partes(data: DataLocal): [number, number, number] {
  const [a, m, d] = data.split('-').map(Number);
  return [a, m, d];
}

function paraUtc(data: DataLocal): number {
  const [a, m, d] = partes(data);
  return Date.UTC(a, m - 1, d);
}

function deUtc(ms: number): DataLocal {
  const dt = new Date(ms);
  return [dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate()]
    .map((n, i) => String(n).padStart(i === 0 ? 4 : 2, '0'))
    .join('-');
}

/** Data de calendário do instante no fuso local do aparelho. */
export function paraDataLocal(instante: Date): DataLocal {
  return [instante.getFullYear(), instante.getMonth() + 1, instante.getDate()]
    .map((n, i) => String(n).padStart(i === 0 ? 4 : 2, '0'))
    .join('-');
}

export function somarDias(data: DataLocal, dias: number): DataLocal {
  return deUtc(paraUtc(data) + dias * DIA_MS);
}

/** `b − a` em dias. */
export function diferencaEmDias(a: DataLocal, b: DataLocal): number {
  return Math.round((paraUtc(b) - paraUtc(a)) / DIA_MS);
}

/** 0 = domingo … 6 = sábado. */
export function diaDaSemana(data: DataLocal): number {
  return new Date(paraUtc(data)).getUTCDay();
}

/** Segunda-feira da semana da data (semanas de segunda a domingo). */
export function inicioDaSemana(data: DataLocal): DataLocal {
  return somarDias(data, -((diaDaSemana(data) + 6) % 7));
}

export function fimDaSemana(data: DataLocal): DataLocal {
  return somarDias(inicioDaSemana(data), 6);
}

export function diasDaSemana(semanaInicio: DataLocal): DataLocal[] {
  return Array.from({ length: 7 }, (_, i) => somarDias(semanaInicio, i));
}

/** Datas de `inicio` a `fim`, inclusive. */
export function intervalo(inicio: DataLocal, fim: DataLocal): DataLocal[] {
  const n = diferencaEmDias(inicio, fim);
  return n < 0 ? [] : Array.from({ length: n + 1 }, (_, i) => somarDias(inicio, i));
}

/** Número da semana ISO 8601. */
export function semanaIso(data: DataLocal): number {
  const quinta = somarDias(inicioDaSemana(data), 3);
  const primeiraQuinta = somarDias(inicioDaSemana(`${quinta.slice(0, 4)}-01-04`), 3);
  return diferencaEmDias(primeiraQuinta, quinta) / 7 + 1;
}

export function menorData(a: DataLocal, b: DataLocal): DataLocal {
  return a <= b ? a : b;
}

export function maiorData(a: DataLocal, b: DataLocal): DataLocal {
  return a >= b ? a : b;
}

/* Formatação pt-BR */

/** "18 out" */
export function formatarDiaMes(data: DataLocal): string {
  const [, m, d] = partes(data);
  return `${d} ${NOMES_MESES[m - 1].slice(0, 3)}`;
}

/** "18 de outubro" */
export function formatarDiaMesLongo(data: DataLocal): string {
  const [, m, d] = partes(data);
  return `${d} de ${NOMES_MESES[m - 1]}`;
}

/** "Domingo, 18 de outubro" */
export function formatarDataLonga(data: DataLocal): string {
  return `${NOMES_DIAS[diaDaSemana(data)]}, ${formatarDiaMesLongo(data)}`;
}

/** "18/10/2026" */
export function formatarDataNumerica(data: DataLocal): string {
  const [a, m, d] = partes(data);
  return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${a}`;
}

/** "12 a 18 out", "28 set a 4 out", "29 dez 2025 a 4 jan 2026" */
export function formatarPeriodoCurto(inicio: DataLocal, fim: DataLocal): string {
  const [ai, , di] = partes(inicio);
  const [af] = partes(fim);
  if (ai !== af) return `${formatarDiaMes(inicio)} ${ai} a ${formatarDiaMes(fim)} ${af}`;
  if (inicio.slice(0, 7) === fim.slice(0, 7)) return `${di} a ${formatarDiaMes(fim)}`;
  return `${formatarDiaMes(inicio)} a ${formatarDiaMes(fim)}`;
}

/** "12 a 18 de outubro de 2026" */
export function formatarPeriodoLongo(inicio: DataLocal, fim: DataLocal): string {
  const [ai, , di] = partes(inicio);
  const [af] = partes(fim);
  if (ai !== af) return `${formatarDiaMesLongo(inicio)} de ${ai} a ${formatarDiaMesLongo(fim)} de ${af}`;
  if (inicio.slice(0, 7) === fim.slice(0, 7)) return `${di} a ${formatarDiaMesLongo(fim)} de ${af}`;
  return `${formatarDiaMesLongo(inicio)} a ${formatarDiaMesLongo(fim)} de ${af}`;
}

/** Junta nomes em português: "terça", "terça e quarta", "segunda, terça e quarta". */
export function juntarLista(itens: readonly string[]): string {
  if (itens.length <= 1) return itens.join('');
  return `${itens.slice(0, -1).join(', ')} e ${itens.at(-1)}`;
}
