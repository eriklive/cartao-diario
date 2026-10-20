import type { Content, CustomTableLayout, TableCell, TDocumentDefinitions } from 'pdfmake/interfaces';
import { ENTRADAS_SESSAO, ESCALA_USO_HABILIDADE } from '@cartao/shared/models';
import { formatarDataNumerica, formatarPeriodoLongo, formatarDiaMes } from '@cartao/shared/domain';
import type { CartaoSemanal, ModeloExportacao } from './modelo';

/*
 * Definição do PDF (pdfmake), igual ao cartão de papel: A4 paisagem,
 * uma página por semana e, em seguida, o cartão de habilidades.
 * Só monta a definição; quem renderiza é o app (navegador) ou o servidor.
 */

const COR = {
  texto: '#1A2230',
  suave: '#5A6475',
  borda: '#DDE2EA',
  forte: '#1A2230',
  fundo: '#F2F4F7',
  primaria: '#2F4A78',
  primariaSuave: '#E3EAF5',
  destaqueFundo: '#F7EBDD',
  destaqueTexto: '#7A3D0C',
};

const vazio = (): TableCell => ({});

function cabecalho(modelo: ModeloExportacao, semana: CartaoSemanal, subtitulo: string): Content {
  const freq = semana.frequencia;
  return {
    columns: [
      {
        width: '*',
        stack: [
          { text: 'TERAPIA COMPORTAMENTAL DIALÉTICA', style: 'rotulo' },
          { text: `${subtitulo} · ${formatarPeriodoLongo(semana.semanaInicio, semana.semanaFim)}`, style: 'titulo' },
        ],
      },
      {
        width: 'auto',
        table: {
          body: [
            [
              { text: 'Nome', style: 'rotulo' },
              { text: modelo.nome || '—', bold: true },
            ],
            [
              { text: 'Frequência', style: 'rotulo' },
              { text: freq.total ? `${freq.preenchidos} de ${freq.total} dias (calculado)` : '—', bold: true },
            ],
            [
              { text: 'Último registro', style: 'rotulo' },
              { text: modelo.ultimoRegistro ? formatarDataNumerica(modelo.ultimoRegistro) : '—', bold: true },
            ],
          ],
        },
        layout: 'noBorders',
      },
    ],
    columnGap: 24,
    margin: [0, 0, 0, 10],
  };
}

function gradeDaSemana(semana: CartaoSemanal): Content {
  const nImpulsos = semana.colunas.filter((c) => c.tipo === 'impulso').length;
  const nAlvos = semana.colunas.length - nImpulsos;
  const widths: (number | string)[] = [62, ...semana.colunas.flatMap(() => ['*', '*', '*'])];

  const grupos: TableCell[] = [{ text: '', border: [false, false, false, false] }];
  if (nImpulsos) {
    grupos.push(
      { text: 'IMPULSOS', colSpan: nImpulsos * 3, style: 'grupo' },
      ...Array.from({ length: nImpulsos * 3 - 1 }, vazio),
    );
  }
  if (nAlvos) {
    grupos.push(
      { text: 'COMPORTAMENTOS-ALVO', colSpan: nAlvos * 3, style: 'grupo' },
      ...Array.from({ length: nAlvos * 3 - 1 }, vazio),
    );
  }

  const nomes: TableCell[] = [
    { text: 'Dia', rowSpan: 2, style: 'cabecalhoTabela', alignment: 'left' },
    ...semana.colunas.flatMap((c): TableCell[] => [
      { text: c.nome, colSpan: 3, style: 'cabecalhoTabela' },
      vazio(),
      vazio(),
    ]),
  ];
  const letras: TableCell[] = [
    vazio(),
    ...semana.colunas.flatMap((): TableCell[] => ['I', 'A', 'H'].map((t) => ({ text: t, style: 'letra' }))),
  ];

  const linhas: TableCell[][] = semana.linhas.map((l) => {
    const fundo = l.preenchido ? undefined : COR.fundo;
    const rotulo: TableCell = {
      text: [
        { text: `${l.dia}\n`, bold: true },
        { text: formatarDiaMes(l.data), color: COR.suave, fontSize: 7 },
      ],
      fillColor: fundo,
    };
    const celulas = l.celulas.flatMap((c): TableCell[] => {
      if (!c) return [0, 1, 2].map(() => ({ text: '', fillColor: fundo }));
      const destaque = c.destaque ? { fillColor: COR.destaqueFundo, color: COR.destaqueTexto, bold: true } : {};
      return [
        { text: String(c.i), alignment: 'center', ...destaque },
        { text: c.a, alignment: 'center' },
        { text: String(c.h), alignment: 'center' },
      ];
    });
    return [rotulo, ...celulas];
  });

  const inicioDeGrupo = (i: number) => i <= 1 || (i - 1) % 3 === 0;
  const layout: CustomTableLayout = {
    hLineWidth: (i) => (i <= 1 ? 0 : 0.5),
    vLineWidth: (i) => (i === 0 ? 0 : inicioDeGrupo(i) ? 1 : 0.5),
    hLineColor: () => COR.borda,
    vLineColor: (i) => (inicioDeGrupo(i) ? COR.forte : COR.borda),
    paddingTop: () => 3,
    paddingBottom: () => 3,
    paddingLeft: () => 2,
    paddingRight: () => 2,
  };

  return {
    table: { headerRows: 3, widths, body: [grupos, nomes, letras, ...linhas], dontBreakRows: true },
    layout,
    fontSize: 8,
  };
}

function legendaEHabilidades(semana: CartaoSemanal): Content {
  const metade = Math.ceil(ESCALA_USO_HABILIDADE.length / 2);
  const coluna = (inicio: number) =>
    ESCALA_USO_HABILIDADE.slice(inicio, inicio + metade)
      .map((e) => `${e.valor} – ${e.curto}`)
      .join('\n');
  const mais = semana.habilidadesMaisUsadas.slice(0, 5);
  return {
    stack: [
      { text: 'Nível de uso de habilidades (H)', style: 'secao' },
      { columns: [{ text: coluna(0) }, { text: coluna(metade) }], columnGap: 8, fontSize: 7.5, color: COR.suave },
      { text: 'Habilidades mais usadas', style: 'secao', margin: [0, 8, 0, 2] },
      {
        text: mais.length
          ? mais.map((h) => `${h.nome} (${h.dias} ${h.dias === 1 ? 'dia' : 'dias'})`).join(' · ')
          : 'Nenhuma habilidade marcada nesta semana.',
        fontSize: 8,
      },
    ],
  };
}

function tarefaEProgresso(semana: CartaoSemanal): Content {
  const f = semana.fechamento;
  const progresso = f?.progresso;
  return {
    stack: [
      { text: 'Tarefa de casa', style: 'secao' },
      { text: f?.tarefaCasa || '—', fontSize: 8.5 },
      { text: 'Resultado', style: 'secao', margin: [0, 6, 0, 2] },
      { text: f?.resultadoTarefa || '—', fontSize: 8.5 },
      { text: 'Progresso nos objetivos', style: 'secao', margin: [0, 6, 0, 2] },
      {
        text: progresso == null ? '—' : `${progresso > 0 ? '+' : ''}${progresso} (escala -3 a +3)`,
        fontSize: 8.5,
      },
    ],
  };
}

function entradasEmSessao(semana: CartaoSemanal): Content {
  const f = semana.fechamento;
  return {
    stack: [
      { text: 'Entradas em sessão (0–5)', style: 'secao' },
      {
        table: {
          widths: ['*', 16],
          body: ENTRADAS_SESSAO.map((e) => [
            { text: e.rotulo, fontSize: 8 },
            { text: f ? String(f.entradasSessao[e.id] ?? 0) : '—', bold: true, alignment: 'right', fontSize: 8 },
          ]),
        },
        layout: 'noBorders',
      },
    ],
  };
}

function paginaDaSemana(modelo: ModeloExportacao, semana: CartaoSemanal): Content[] {
  const { incluir } = modelo;
  const conteudo: Content[] = [cabecalho(modelo, semana, 'Cartão Diário')];
  if (incluir.registros) conteudo.push(gradeDaSemana(semana));

  const colunas: Content[] = [];
  if (incluir.registros) colunas.push(legendaEHabilidades(semana));
  if (incluir.fechamento) colunas.push(tarefaEProgresso(semana), entradasEmSessao(semana));
  if (colunas.length) conteudo.push({ columns: colunas, columnGap: 20, margin: [0, 12, 0, 0] });

  if (incluir.notas) {
    conteudo.push(
      { text: 'Para o terapeuta', style: 'secao', margin: [0, 12, 0, 2] },
      { text: semana.fechamento?.notasTerapeuta || '—', fontSize: 9 },
    );
  }
  return conteudo;
}

function cartaoDeHabilidades(modelo: ModeloExportacao, semana: CartaoSemanal): Content[] {
  const dias = semana.linhas.map((l) => l.diaCurto);
  const tabela = (modulos: CartaoSemanal['habilidades']): Content => ({
    table: {
      headerRows: 1,
      widths: ['*', ...dias.map(() => 22), 26],
      body: [
        [
          { text: 'Habilidade', style: 'cabecalhoTabela', alignment: 'left' },
          ...dias.map((d) => ({ text: d, style: 'cabecalhoTabela' })),
          { text: 'Dias', style: 'cabecalhoTabela' },
        ],
        ...modulos.flatMap((m): TableCell[][] => [
          [
            { text: m.modulo.toUpperCase(), colSpan: dias.length + 2, style: 'grupo', alignment: 'left' },
            ...Array.from({ length: dias.length + 1 }, vazio),
          ],
          ...m.habilidades.map((h): TableCell[] => {
            const total = h.usada.filter(Boolean).length;
            return [
              { text: h.nome },
              ...h.usada.map(
                (u): TableCell =>
                  u
                    ? { text: 'X', alignment: 'center', bold: true, color: COR.primaria, fillColor: COR.primariaSuave }
                    : { text: '' },
              ),
              { text: total ? String(total) : '', alignment: 'center', bold: true },
            ];
          }),
        ]),
      ],
    },
    layout: {
      hLineWidth: () => 0.5,
      vLineWidth: () => 0.5,
      hLineColor: () => COR.borda,
      vLineColor: () => COR.borda,
      paddingTop: () => 2.5,
      paddingBottom: () => 2.5,
    },
    fontSize: 8,
  });

  const [ap, cm, tol, reg, inter] = semana.habilidades;
  return [
    cabecalho(modelo, semana, 'Cartão de habilidades'),
    {
      text: 'Montado a partir das habilidades marcadas em cada impulso.',
      fontSize: 8,
      color: COR.suave,
      margin: [0, -4, 0, 8],
    },
    { columns: [tabela([ap, cm, inter].filter(Boolean)), tabela([tol, reg].filter(Boolean))], columnGap: 16 },
  ];
}

export function criarDocumentoPdf(modelo: ModeloExportacao): TDocumentDefinitions {
  const paginas: Content[] = [];
  modelo.semanas.forEach((semana, i) => {
    const conteudo = paginaDaSemana(modelo, semana);
    paginas.push(i === 0 ? conteudo : [{ text: '', pageBreak: 'before' }, ...conteudo]);
    if (modelo.incluir.registros)
      paginas.push([{ text: '', pageBreak: 'before' }, ...cartaoDeHabilidades(modelo, semana)]);
  });

  return {
    pageSize: 'A4',
    pageOrientation: 'landscape',
    pageMargins: [28, 26, 28, 34],
    info: {
      title: `Cartão Diário ${formatarPeriodoLongo(modelo.periodo.inicio, modelo.periodo.fim)}`,
      creator: 'Cartão Diário',
    },
    content: paginas,
    footer: (pagina, total) => ({
      columns: [
        {
          text: `Gerado pelo app em ${formatarDataNumerica(modelo.hoje)} · em destaque: impulso 3 ou mais · I = intensidade (0–5), A = seguiu o impulso (S/N), H = uso de habilidades (0–7)`,
        },
        { text: `Página ${pagina} de ${total}`, alignment: 'right', width: 'auto' },
      ],
      margin: [28, 10, 28, 0],
      fontSize: 7,
      color: COR.suave,
    }),
    defaultStyle: { font: 'Roboto', fontSize: 9, color: COR.texto, lineHeight: 1.15 },
    styles: {
      rotulo: { fontSize: 7, color: COR.suave, bold: true, characterSpacing: 0.4 },
      titulo: { fontSize: 15, bold: true, margin: [0, 2, 0, 0] },
      secao: { fontSize: 9, bold: true, margin: [0, 0, 0, 2] },
      grupo: { fontSize: 7, bold: true, color: COR.primaria, alignment: 'center', characterSpacing: 0.4 },
      cabecalhoTabela: { fontSize: 7.5, bold: true, alignment: 'center' },
      letra: { fontSize: 7, color: COR.suave, alignment: 'center' },
    },
  };
}
