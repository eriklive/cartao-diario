import {
  MODULOS_HABILIDADES,
  buscarHabilidade,
  type Comportamento,
  type Dados,
  type DataLocal,
  type Fechamento,
  type Registro,
  type TipoComportamento,
  LIMIAR_DESTAQUE,
} from '@cartao/shared/models';
import {
  NOMES_DIAS,
  NOMES_DIAS_CURTOS,
  comportamentosDoPeriodo,
  diaDaSemana,
  diaPreenchido,
  diasDaSemana,
  fimDaSemana,
  frequencia,
  habilidadesMaisUsadas,
  indexar,
  registrosDoPeriodo,
  semanaIso,
  semanasDoPeriodo,
  somarDias,
  ultimoDiaPreenchido,
  type Frequencia,
  type Periodo,
  type UsoDeHabilidade,
} from '@cartao/shared/domain';

export type FormatoExportacao = 'pdf' | 'xlsx';

export interface Inclusoes {
  /** Impulsos, comportamentos-alvo e habilidades usadas. */
  registros: boolean;
  fechamento: boolean;
  /** Anotações para o terapeuta (do fechamento semanal). */
  notas: boolean;
}

export interface OpcoesExportacao {
  periodo: Periodo;
  incluir: Inclusoes;
  hoje: DataLocal;
  /** Primeiro dia de uso do app: antes dele, nada conta como falta. */
  primeiroDia: DataLocal;
}

export interface Coluna {
  id: string;
  nome: string;
  tipo: TipoComportamento;
}

/** I · A · H de um item num dia. `null` = sem dado (dia não preenchido ou item inativo). */
export interface CelulaIah {
  i: number;
  a: 'S' | 'N';
  h: number;
  destaque: boolean;
}

export interface LinhaDia {
  data: DataLocal;
  dia: string;
  diaCurto: string;
  preenchido: boolean;
  /** Fora do período exportado, futuro ou antes do primeiro uso. */
  foraDoPeriodo: boolean;
  celulas: (CelulaIah | null)[];
}

export interface HabilidadeNaSemana {
  id: string;
  nome: string;
  /** Uma posição por dia (segunda a domingo). */
  usada: boolean[];
}

export interface CartaoSemanal {
  semanaInicio: DataLocal;
  semanaFim: DataLocal;
  semanaIso: number;
  colunas: Coluna[];
  linhas: LinhaDia[];
  frequencia: Frequencia;
  habilidadesMaisUsadas: UsoDeHabilidade[];
  habilidades: { modulo: string; habilidades: HabilidadeNaSemana[] }[];
  fechamento: Fechamento | null;
}

export interface LinhaRegistro {
  data: DataLocal;
  dia: string;
  semanaIso: number;
  item: string;
  tipo: TipoComportamento;
  intensidade: number;
  seguiu: 'S' | 'N';
  usoHabilidade: number;
  habilidades: string[];
  destaque: boolean;
}

export interface ModeloExportacao {
  nome: string;
  periodo: Periodo;
  hoje: DataLocal;
  incluir: Inclusoes;
  ultimoRegistro: DataLocal | null;
  semanas: CartaoSemanal[];
  /** Uma linha por dia preenchido × item visível naquele dia (itens sem resposta contam 0). */
  linhas: LinhaRegistro[];
}

function celula(r: Registro | undefined): CelulaIah {
  if (!r) return { i: 0, a: 'N', h: 0, destaque: false };
  return { i: r.intensidade, a: r.seguiu ? 'S' : 'N', h: r.usoHabilidade, destaque: r.intensidade >= LIMIAR_DESTAQUE };
}

function ativoNoDia(c: Comportamento, data: DataLocal, temResposta: boolean): boolean {
  return temResposta || (c.ativoDesde <= data && (!c.arquivadoEm || c.arquivadoEm > data));
}

export function montarExportacao(dados: Dados, opcoes: OpcoesExportacao): ModeloExportacao {
  const { periodo, hoje, primeiroDia } = opcoes;
  const indice = indexar(dados.dias, dados.registros);
  const fechamentos = new Map(dados.fechamentos.filter((f) => !f.removidoEm).map((f) => [f.semanaInicio, f]));
  const dentro = (d: DataLocal) => d >= periodo.inicio && d <= periodo.fim && d <= hoje && d >= primeiroDia;

  const semanas = semanasDoPeriodo(periodo).map((semanaInicio): CartaoSemanal => {
    const semanaFim = fimDaSemana(semanaInicio);
    const registrosSemana = registrosDoPeriodo(indice, semanaInicio, semanaFim).filter((r) => dentro(r.data));
    const comportamentos = comportamentosDoPeriodo(dados.comportamentos, registrosSemana, semanaInicio, semanaFim);
    const dias = diasDaSemana(semanaInicio);

    const linhas = dias.map((data): LinhaDia => {
      const fora = !dentro(data);
      const preenchido = !fora && diaPreenchido(indice, data);
      const doDia = new Map(registrosSemana.filter((r) => r.data === data).map((r) => [r.comportamentoId, r]));
      return {
        data,
        dia: NOMES_DIAS[diaDaSemana(data)],
        diaCurto: NOMES_DIAS_CURTOS[diaDaSemana(data)],
        preenchido,
        foraDoPeriodo: fora,
        celulas: comportamentos.map((c) =>
          preenchido && ativoNoDia(c, data, doDia.has(c.id)) ? celula(doDia.get(c.id)) : null,
        ),
      };
    });

    const usadasPorDia = dias.map((d) => new Set(registrosSemana.filter((r) => r.data === d).flatMap((r) => r.habilidades)));
    return {
      semanaInicio,
      semanaFim,
      semanaIso: semanaIso(semanaInicio),
      colunas: comportamentos.map((c) => ({ id: c.id, nome: c.nome, tipo: c.tipo })),
      linhas,
      frequencia: frequencia(
        indice,
        semanaInicio > periodo.inicio ? semanaInicio : periodo.inicio,
        semanaFim < periodo.fim ? semanaFim : periodo.fim,
        hoje,
        primeiroDia,
      ),
      habilidadesMaisUsadas: habilidadesMaisUsadas(registrosSemana),
      habilidades: MODULOS_HABILIDADES.map((m) => ({
        modulo: m.nome,
        habilidades: m.habilidades.map((h) => ({ id: h.id, nome: h.nome, usada: usadasPorDia.map((s) => s.has(h.id)) })),
      })),
      fechamento: fechamentos.get(semanaInicio) ?? null,
    };
  });

  const porId = new Map(dados.comportamentos.map((c) => [c.id, c]));
  const linhas: LinhaRegistro[] = [];
  for (const semana of semanas) {
    for (const linha of semana.linhas) {
      if (!linha.preenchido) continue;
      semana.colunas.forEach((coluna, k) => {
        const c = linha.celulas[k];
        if (!c) return;
        const r = (indice.registrosPorData.get(linha.data) ?? []).find((x) => x.comportamentoId === coluna.id);
        linhas.push({
          data: linha.data,
          dia: linha.diaCurto,
          semanaIso: semana.semanaIso,
          item: porId.get(coluna.id)?.nome ?? coluna.nome,
          tipo: coluna.tipo,
          intensidade: c.i,
          seguiu: c.a,
          usoHabilidade: c.h,
          habilidades: r?.habilidades ?? [],
          destaque: c.destaque,
        });
      });
    }
  }

  const ultimo = ultimoDiaPreenchido(indice);
  return {
    nome: dados.perfil?.nome ?? '',
    periodo,
    hoje,
    incluir: opcoes.incluir,
    ultimoRegistro: ultimo && ultimo <= periodo.fim ? ultimo : null,
    semanas,
    linhas,
  };
}

/** `cartao-diario_2026-09-22_a_2026-10-18.pdf` */
export function nomeArquivoExportacao(periodo: Periodo, formato: FormatoExportacao): string {
  return `cartao-diario_${periodo.inicio}_a_${periodo.fim}.${formato}`;
}

/** Dias com algum registro ou concluídos no período (para "6 dias registrados"). */
export function contarDiasRegistrados(dados: Dados, periodo: Periodo): number {
  const indice = indexar(dados.dias, dados.registros);
  let n = 0;
  for (let d = periodo.inicio; d <= periodo.fim; d = somarDias(d, 1)) if (diaPreenchido(indice, d)) n++;
  return n;
}

export function rotuloHabilidadeComModulo(id: string): { modulo: string; nome: string } {
  const h = buscarHabilidade(id);
  const modulo = MODULOS_HABILIDADES.find((m) => m.id === h?.moduloId);
  return { modulo: modulo?.nome ?? '', nome: h?.nome ?? id };
}
