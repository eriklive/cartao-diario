import type { Cell, Row, Sheet } from 'write-excel-file/universal';
import { ENTRADAS_SESSAO, ESCALA_USO_HABILIDADE, LIMIAR_DESTAQUE } from '@cartao/shared/models';
import { formatarDataNumerica } from '@cartao/shared/domain';
import { rotuloHabilidadeComModulo, type ModeloExportacao } from './modelo';

/*
 * Planilha (write-excel-file): abas Diário, Habilidades, Semanal e Legenda.
 * Só monta os dados; quem grava o arquivo é o app ou o servidor.
 */

type Aba = Sheet<never>;

const CABECALHO = {
  fontWeight: 'bold',
  backgroundColor: '#E3EAF5',
  textColor: '#2F4A78',
} as const;

const DESTAQUE = { backgroundColor: '#F7EBDD', textColor: '#7A3D0C', fontWeight: 'bold' } as const;

function cabecalho(titulos: string[]): Row {
  return titulos.map((value) => ({ value, ...CABECALHO }));
}

/** Data como data de verdade no Excel (meia-noite UTC), exibida como dd/mm/aaaa. */
function data(valor: string): Cell {
  const [a, m, d] = valor.split('-').map(Number);
  return { value: new Date(Date.UTC(a, m - 1, d)), type: Date, format: 'dd/mm/yyyy' };
}

function abaDiario(modelo: ModeloExportacao): Aba {
  return {
    sheet: 'Diário',
    stickyRowsCount: 1,
    columns: [{ width: 12 }, { width: 6 }, { width: 8 }, { width: 28 }, { width: 20 }, { width: 14 }, { width: 13 }, { width: 17 }],
    data: [
      cabecalho(['Data', 'Dia', 'Semana', 'Item', 'Tipo', 'Impulso (0–5)', 'Seguiu (S/N)', 'Habilidades (0–7)']),
      ...modelo.linhas.map((l): Row => [
        data(l.data),
        l.dia,
        l.semanaIso,
        l.item,
        l.tipo === 'impulso' ? 'Impulso' : 'Comportamento-alvo',
        l.destaque ? { value: l.intensidade, ...DESTAQUE } : l.intensidade,
        l.seguiu,
        l.usoHabilidade,
      ]),
    ],
  };
}

function abaHabilidades(modelo: ModeloExportacao): Aba {
  return {
    sheet: 'Habilidades',
    stickyRowsCount: 1,
    columns: [{ width: 12 }, { width: 6 }, { width: 28 }, { width: 26 }, { width: 32 }, { width: 17 }],
    data: [
      cabecalho(['Data', 'Dia', 'Item', 'Módulo', 'Habilidade', 'Habilidades (0–7)']),
      ...modelo.linhas.flatMap((l) =>
        l.habilidades.map((id): Row => {
          const h = rotuloHabilidadeComModulo(id);
          return [data(l.data), l.dia, l.item, h.modulo, h.nome, l.usoHabilidade];
        }),
      ),
    ],
  };
}

function abaSemanal(modelo: ModeloExportacao): Aba {
  const { fechamento, notas } = modelo.incluir;
  const titulos = ['Semana (início)', 'Fim', 'Dias preenchidos'];
  if (fechamento) {
    titulos.push('Tarefa de casa', 'Resultado', 'Progresso (−3 a +3)', ...ENTRADAS_SESSAO.map((e) => `${e.rotulo} (0–5)`));
  }
  if (notas) titulos.push('Para o terapeuta');

  return {
    sheet: 'Semanal',
    stickyRowsCount: 1,
    columns: titulos.map((t) => ({ width: t.length > 24 ? 22 : Math.max(12, t.length + 2) })),
    data: [
      cabecalho(titulos),
      ...modelo.semanas.map((s): Row => {
        const f = s.fechamento;
        const linha: Row = [data(s.semanaInicio), data(s.semanaFim), `${s.frequencia.preenchidos} de ${s.frequencia.total}`];
        if (fechamento) {
          linha.push(
            { value: f?.tarefaCasa ?? '', wrap: true },
            { value: f?.resultadoTarefa ?? '', wrap: true },
            f?.progresso ?? null,
            ...ENTRADAS_SESSAO.map((e) => (f ? (f.entradasSessao[e.id] ?? 0) : null)),
          );
        }
        if (notas) linha.push({ value: f?.notasTerapeuta ?? '', wrap: true });
        return linha;
      }),
    ],
  };
}

function abaLegenda(modelo: ModeloExportacao): Aba {
  const linhas: Row[] = [
    [{ value: 'Cartão Diário', fontWeight: 'bold', fontSize: 14 }],
    [`Período: ${formatarDataNumerica(modelo.periodo.inicio)} a ${formatarDataNumerica(modelo.periodo.fim)}`],
    [`Nome: ${modelo.nome || '—'}`],
    [`Gerado em ${formatarDataNumerica(modelo.hoje)}`],
    [],
    cabecalho(['Campo', 'Significado']),
    ['Impulso (I)', 'Intensidade do impulso, de 0 (nenhum) a 5 (muito intenso). Item não marcado no dia conta como 0.'],
    ['Seguiu (A)', 'S = seguiu o impulso, N = não seguiu.'],
    ['Habilidades (H)', 'Nível de uso de habilidades, de 0 a 7 (abaixo).'],
    ['Destaque', `Impulso ${LIMIAR_DESTAQUE} ou mais.`],
    [],
    cabecalho(['H', 'Nível de uso de habilidades']),
    ...ESCALA_USO_HABILIDADE.map((e): Row => [e.valor, e.rotulo]),
  ];
  return { sheet: 'Legenda', columns: [{ width: 18 }, { width: 90 }], data: linhas };
}

export function criarPlanilha(modelo: ModeloExportacao): Aba[] {
  const abas: Aba[] = [];
  if (modelo.incluir.registros) abas.push(abaDiario(modelo), abaHabilidades(modelo));
  if (modelo.incluir.fechamento || modelo.incluir.notas) abas.push(abaSemanal(modelo));
  abas.push(abaLegenda(modelo));
  return abas;
}
