import {
  JANELA_EDICAO_DIAS,
  nomeHabilidade,
  type Comportamento,
  type DataLocal,
  type Dia,
  type Registro,
} from '@cartao/shared/models';
import {
  NOMES_DIAS,
  diaDaSemana,
  diasDaSemana,
  diferencaEmDias,
  inicioDaSemana,
  intervalo,
  maiorData,
  menorData,
  somarDias,
} from './datas';

/** Registros e dias concluídos indexados por data, já sem lápides. */
export interface Indice {
  registrosPorData: ReadonlyMap<DataLocal, readonly Registro[]>;
  diasConcluidos: ReadonlySet<DataLocal>;
}

export function indexar(dias: readonly Dia[], registros: readonly Registro[]): Indice {
  const registrosPorData = new Map<DataLocal, Registro[]>();
  for (const r of registros) {
    if (r.removidoEm) continue;
    const lista = registrosPorData.get(r.data);
    if (lista) lista.push(r);
    else registrosPorData.set(r.data, [r]);
  }
  const diasConcluidos = new Set(dias.filter((d) => !d.removidoEm && d.concluidoEm).map((d) => d.data));
  return { registrosPorData, diasConcluidos };
}

export function registrosDoDia(indice: Indice, data: DataLocal): readonly Registro[] {
  return indice.registrosPorData.get(data) ?? [];
}

export function registrosDoPeriodo(indice: Indice, inicio: DataLocal, fim: DataLocal): Registro[] {
  return intervalo(inicio, fim).flatMap((d) => registrosDoDia(indice, d));
}

/** Preenchido = a pessoa tocou "Concluir" ou respondeu pelo menos um item. */
export function diaPreenchido(indice: Indice, data: DataLocal): boolean {
  return indice.diasConcluidos.has(data) || registrosDoDia(indice, data).length > 0;
}

export function podeEditarDia(data: DataLocal, hoje: DataLocal): boolean {
  const d = diferencaEmDias(data, hoje);
  return d >= 0 && d <= JANELA_EDICAO_DIAS;
}

/** "Como foi hoje?", "Como foi ontem?", "Como foi na quarta?", "Como foi no sábado?" */
export function tituloDoDia(data: DataLocal, hoje: DataLocal): string {
  const d = diferencaEmDias(data, hoje);
  if (d === 0) return 'Como foi hoje?';
  if (d === 1) return 'Como foi ontem?';
  const dia = diaDaSemana(data);
  return `Como foi ${dia === 0 || dia === 6 ? 'no' : 'na'} ${NOMES_DIAS[dia].toLowerCase()}?`;
}

export interface DiaDaFaixa {
  data: DataLocal;
  preenchido: boolean;
  ehHoje: boolean;
  futuro: boolean;
  /** Antes do primeiro dia de uso: não conta como falta. */
  antesDoInicio: boolean;
  editavel: boolean;
}

export function faixaDaSemana(
  semanaInicio: DataLocal,
  hoje: DataLocal,
  indice: Indice,
  primeiroDia: DataLocal,
): DiaDaFaixa[] {
  return diasDaSemana(semanaInicio).map((data) => ({
    data,
    preenchido: diaPreenchido(indice, data),
    ehHoje: data === hoje,
    futuro: data > hoje,
    antesDoInicio: data < primeiroDia,
    editavel: podeEditarDia(data, hoje),
  }));
}

export interface Frequencia {
  preenchidos: number;
  total: number;
  faltaram: DataLocal[];
}

/**
 * Dias preenchidos no período, contando só do primeiro dia de uso até hoje.
 * Hoje entra no total apenas se já foi preenchido (o dia ainda não acabou).
 */
export function frequencia(
  indice: Indice,
  inicio: DataLocal,
  fim: DataLocal,
  hoje: DataLocal,
  primeiroDia: DataLocal,
): Frequencia {
  const ini = maiorData(inicio, primeiroDia);
  const fimContado = menorData(fim, hoje);
  const dias = intervalo(ini, fimContado).filter((d) => d < hoje || diaPreenchido(indice, d));
  const faltaram = dias.filter((d) => !diaPreenchido(indice, d));
  return { preenchidos: dias.length - faltaram.length, total: dias.length, faltaram };
}

/** Dias ainda editáveis e não preenchidos (inclui hoje). Alimenta o badge do ícone. */
export function diasPendentes(indice: Indice, hoje: DataLocal, primeiroDia: DataLocal): DataLocal[] {
  const inicio = maiorData(somarDias(hoje, -JANELA_EDICAO_DIAS), primeiroDia);
  return intervalo(inicio, hoje).filter((d) => !diaPreenchido(indice, d));
}

export function ultimoDiaPreenchido(indice: Indice): DataLocal | null {
  const datas = [...indice.diasConcluidos, ...indice.registrosPorData.keys()];
  return datas.length ? datas.reduce(maiorData) : null;
}

export interface UsoDeHabilidade {
  id: string;
  nome: string;
  /** Em quantos dias diferentes foi usada. */
  dias: number;
}

export function habilidadesMaisUsadas(registros: readonly Registro[]): UsoDeHabilidade[] {
  const dias = new Map<string, Set<DataLocal>>();
  for (const r of registros) {
    if (r.removidoEm) continue;
    for (const h of r.habilidades) {
      const conjunto = dias.get(h) ?? new Set<DataLocal>();
      conjunto.add(r.data);
      dias.set(h, conjunto);
    }
  }
  return [...dias.entries()]
    .map(([id, d]) => ({ id, nome: nomeHabilidade(id), dias: d.size }))
    .sort((a, b) => b.dias - a.dias || a.nome.localeCompare(b.nome, 'pt-BR'));
}

export interface MaiorImpulso {
  comportamento: Comportamento;
  intensidade: number;
  data: DataLocal;
}

export function maiorImpulso(
  registros: readonly Registro[],
  comportamentos: readonly Comportamento[],
): MaiorImpulso | null {
  const porId = new Map(comportamentos.map((c) => [c.id, c]));
  let maior: MaiorImpulso | null = null;
  for (const r of registros) {
    const c = porId.get(r.comportamentoId);
    if (!c || r.removidoEm || r.intensidade === 0) continue;
    if (!maior || r.intensidade > maior.intensidade || (r.intensidade === maior.intensidade && r.data < maior.data)) {
      maior = { comportamento: c, intensidade: r.intensidade, data: r.data };
    }
  }
  return maior;
}

/** Semanas (segundas-feiras) do primeiro dia de uso até hoje, da mais recente para a mais antiga. */
export function listarSemanas(primeiroDia: DataLocal, hoje: DataLocal): DataLocal[] {
  const semanas: DataLocal[] = [];
  const primeira = inicioDaSemana(menorData(primeiroDia, hoje));
  for (let s = inicioDaSemana(hoje); s >= primeira; s = somarDias(s, -7)) semanas.push(s);
  return semanas;
}
