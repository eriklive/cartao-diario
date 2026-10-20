import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import type { Comportamento, Dados, Registro } from '@cartao/shared/models';
import { contarDiasRegistrados, montarExportacao, nomeArquivoExportacao, type OpcoesExportacao } from './modelo';
import { criarDocumentoPdf } from './pdf';
import { criarPlanilha } from './planilha';

const T = '2026-10-18T21:00:00.000Z';

function comportamento(p: Partial<Comportamento> & Pick<Comportamento, 'nome'>): Comportamento {
  return {
    id: crypto.randomUUID(),
    tipo: 'alvo',
    ordem: 0,
    ativoDesde: '2026-10-06',
    criadoEm: T,
    atualizadoEm: T,
    ...p,
  };
}

const matar = comportamento({ nome: 'Me matar', tipo: 'impulso', chave: 'me-matar', ordem: 0 });
const ferir = comportamento({ nome: 'Me ferir', tipo: 'impulso', chave: 'me-ferir', ordem: 1 });
const drogas = comportamento({ nome: 'Usar drogas', tipo: 'impulso', chave: 'usar-drogas', ordem: 2 });
const alvo = comportamento({ nome: 'Gastar demais', ordem: 0 });
const arquivado = comportamento({ nome: 'Brigar', ordem: 1, arquivadoEm: '2026-10-09' });

function registro(p: Partial<Registro> & Pick<Registro, 'data' | 'comportamentoId'>): Registro {
  return { intensidade: 1, seguiu: false, usoHabilidade: 0, habilidades: [], criadoEm: T, atualizadoEm: T, ...p };
}

const dados: Dados = {
  perfil: { nome: 'Ana', lembrete: { ativo: true, horario: '21:00' }, atualizadoEm: T },
  comportamentos: [matar, ferir, drogas, alvo, arquivado],
  dias: [{ data: '2026-10-13', concluidoEm: T, criadoEm: T, atualizadoEm: T }],
  registros: [
    registro({ data: '2026-10-07', comportamentoId: arquivado.id, intensidade: 2 }),
    registro({
      data: '2026-10-12',
      comportamentoId: ferir.id,
      intensidade: 3,
      usoHabilidade: 5,
      habilidades: ['atencao-plena.mente-sabia', 'tolerancia.tip'],
    }),
    registro({ data: '2026-10-14', comportamentoId: drogas.id, intensidade: 1, seguiu: true }),
  ],
  fechamentos: [
    {
      semanaInicio: '2026-10-12',
      tarefaCasa: 'Praticar TIP',
      resultadoTarefa: 'Consegui duas vezes',
      progresso: 1,
      entradasSessao: { 'deixar-terapia': 1, 'fazer-melhor': 4 },
      notasTerapeuta: 'Semana difícil no trabalho',
      fechadaEm: T,
      criadoEm: T,
      atualizadoEm: T,
    },
  ],
};

const opcoes: OpcoesExportacao = {
  periodo: { inicio: '2026-10-06', fim: '2026-10-15' },
  incluir: { registros: true, fechamento: true, notas: true },
  hoje: '2026-10-15',
  primeiroDia: '2026-10-06',
};

describe('montarExportacao', () => {
  const modelo = montarExportacao(dados, opcoes);

  it('gera uma semana por segunda-feira do período', () => {
    expect(modelo.semanas.map((s) => s.semanaInicio)).toEqual(['2026-10-05', '2026-10-12']);
    expect(modelo.nome).toBe('Ana');
    expect(modelo.ultimoRegistro).toBe('2026-10-14');
  });

  it('inclui o arquivado só na semana em que ele estava ativo', () => {
    expect(modelo.semanas[0].colunas.map((c) => c.nome)).toEqual([
      'Me matar',
      'Me ferir',
      'Usar drogas',
      'Gastar demais',
      'Brigar',
    ]);
    expect(modelo.semanas[1].colunas.map((c) => c.nome)).toEqual([
      'Me matar',
      'Me ferir',
      'Usar drogas',
      'Gastar demais',
    ]);
  });

  it('preenche zeros nos dias preenchidos e deixa vazio o resto', () => {
    const semana = modelo.semanas[1];
    const [seg, ter, qua, qui] = semana.linhas;
    expect(seg.celulas[1]).toEqual({ i: 3, a: 'N', h: 5, destaque: true });
    expect(seg.celulas[0]).toEqual({ i: 0, a: 'N', h: 0, destaque: false });
    expect(ter.preenchido).toBe(true);
    expect(ter.celulas.every((c) => c?.i === 0)).toBe(true);
    expect(qua.celulas[2]).toMatchObject({ i: 1, a: 'S' });
    expect(qui.preenchido).toBe(false);
    expect(qui.celulas.every((c) => c === null)).toBe(true);
    expect(semana.linhas[4].foraDoPeriodo).toBe(true);
  });

  it('monta o cartão de habilidades e o resumo da semana', () => {
    const semana = modelo.semanas[1];
    const mente = semana.habilidades[0].habilidades.find((h) => h.nome === 'Mente Sábia');
    expect(mente?.usada).toEqual([true, false, false, false, false, false, false]);
    expect(semana.habilidadesMaisUsadas.map((h) => h.nome)).toEqual(['Mente Sábia', 'TIP']);
    expect(semana.frequencia).toEqual({ preenchidos: 3, total: 3, faltaram: [] });
    expect(semana.fechamento?.tarefaCasa).toBe('Praticar TIP');
  });

  it('gera uma linha por dia preenchido × item', () => {
    expect(modelo.linhas).toHaveLength(5 + 4 * 3);
    expect(modelo.linhas.find((l) => l.item === 'Me ferir' && l.data === '2026-10-12')).toMatchObject({
      intensidade: 3,
      habilidades: ['atencao-plena.mente-sabia', 'tolerancia.tip'],
      destaque: true,
      semanaIso: 42,
    });
  });

  it('nomeia o arquivo e conta os dias registrados', () => {
    expect(nomeArquivoExportacao(opcoes.periodo, 'pdf')).toBe('cartao-diario_2026-10-06_a_2026-10-15.pdf');
    expect(contarDiasRegistrados(dados, opcoes.periodo)).toBe(4);
  });
});

describe('PDF', () => {
  it('tem uma página de cartão e uma de habilidades por semana', () => {
    const doc = criarDocumentoPdf(montarExportacao(dados, opcoes));
    expect(doc.pageOrientation).toBe('landscape');
    expect(doc.content).toHaveLength(4);
  });

  it('omite o cartão de habilidades sem registros', () => {
    const doc = criarDocumentoPdf(
      montarExportacao(dados, { ...opcoes, incluir: { registros: false, fechamento: true, notas: false } }),
    );
    expect(doc.content).toHaveLength(2);
  });

  it('renderiza de verdade com o pdfmake', async () => {
    const require = createRequire(import.meta.url);
    const pdfmake = require('pdfmake');
    const fontes = join(dirname(require.resolve('pdfmake/package.json')), 'build', 'fonts', 'Roboto');
    pdfmake.setFonts({
      Roboto: {
        normal: join(fontes, 'Roboto-Regular.ttf'),
        bold: join(fontes, 'Roboto-Medium.ttf'),
        italics: join(fontes, 'Roboto-Italic.ttf'),
        bolditalics: join(fontes, 'Roboto-MediumItalic.ttf'),
      },
    });
    pdfmake.setUrlAccessPolicy(() => false);
    pdfmake.setLocalAccessPolicy((caminho: string) => caminho.startsWith(fontes));
    const buffer: Buffer = await pdfmake.createPdf(criarDocumentoPdf(montarExportacao(dados, opcoes))).getBuffer();
    const texto = buffer.toString('latin1');
    expect(texto.startsWith('%PDF')).toBe(true);
    expect(texto.match(/\/Type \/Page\b/g)?.length).toBe(4);
  });
});

describe('planilha', () => {
  it('tem as abas do desenho e destaca impulso 3 ou mais', () => {
    const abas = criarPlanilha(montarExportacao(dados, opcoes));
    expect(abas.map((a) => a.sheet)).toEqual(['Diário', 'Habilidades', 'Semanal', 'Legenda']);
    const diario = abas[0].data;
    expect(diario).toHaveLength(1 + 17);
    const celulaDestacada = diario
      .flat()
      .find((c) => typeof c === 'object' && c && 'backgroundColor' in c && c.value === 3);
    expect(celulaDestacada).toBeTruthy();
    expect(abas[1].data).toHaveLength(1 + 2);
    expect(abas[2].data[1][2]).toBe('1 de 6');
    expect(abas[2].data[2]).toContain(1);
  });

  it('respeita o que foi escolhido em "Incluir"', () => {
    const abas = criarPlanilha(
      montarExportacao(dados, { ...opcoes, incluir: { registros: false, fechamento: false, notas: true } }),
    );
    expect(abas.map((a) => a.sheet)).toEqual(['Semanal', 'Legenda']);
    expect(abas[0].data[0]).toHaveLength(4);
  });

  it('gera um .xlsx válido', async () => {
    const { default: writeXlsxFile } = await import('write-excel-file/node');
    const buffer = await writeXlsxFile(criarPlanilha(montarExportacao(dados, opcoes))).toBuffer();
    expect(buffer.subarray(0, 2).toString()).toBe('PK');
  });
});
