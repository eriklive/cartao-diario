import type { Comportamento, Dia, Registro } from '@cartao/shared/models';
import {
  alvosAtivos,
  comportamentosDoPeriodo,
  podeAdicionarAlvo,
  proximaOrdem,
  validarNomeComportamento,
  visiveisNoDia,
} from './comportamentos';
import {
  exigeApoio,
  normalizarResposta,
  podeEscolherHabilidades,
  podeResponderSeguiu,
  resumirResposta,
} from './registro';
import {
  diaPreenchido,
  diasPendentes,
  faixaDaSemana,
  frequencia,
  habilidadesMaisUsadas,
  indexar,
  listarSemanas,
  maiorImpulso,
  podeEditarDia,
  tituloDoDia,
  ultimoDiaPreenchido,
} from './resumos';
import { periodoExportacao, semanasDoPeriodo } from './periodos';

const T = '2026-10-18T21:00:00.000Z';

function comportamento(p: Partial<Comportamento> & Pick<Comportamento, 'nome'>): Comportamento {
  return {
    id: crypto.randomUUID(),
    tipo: 'alvo',
    ordem: 0,
    ativoDesde: '2026-10-01',
    criadoEm: T,
    atualizadoEm: T,
    ...p,
  };
}

function registro(p: Partial<Registro> & Pick<Registro, 'data' | 'comportamentoId'>): Registro {
  return { intensidade: 2, seguiu: false, usoHabilidade: 0, habilidades: [], criadoEm: T, atualizadoEm: T, ...p };
}

describe('regras do formulário', () => {
  it('intensidade 0 zera o resto', () => {
    expect(
      normalizarResposta({ intensidade: 0, seguiu: true, usoHabilidade: 7, habilidades: ['tolerancia.tip'] }),
    ).toEqual({ intensidade: 0, seguiu: false, usoHabilidade: 0, habilidades: [] });
  });

  it('H abaixo de 4 limpa as habilidades; a partir de 4 mantém sem repetir', () => {
    const r = { intensidade: 3, seguiu: true, habilidades: ['tolerancia.tip', 'tolerancia.tip'] };
    expect(normalizarResposta({ ...r, usoHabilidade: 3 }).habilidades).toEqual([]);
    expect(normalizarResposta({ ...r, usoHabilidade: 4 }).habilidades).toEqual(['tolerancia.tip']);
  });

  it('libera as perguntas conforme as respostas', () => {
    expect(podeResponderSeguiu({ intensidade: 0 })).toBe(false);
    expect(podeResponderSeguiu({ intensidade: 1 })).toBe(true);
    expect(podeEscolherHabilidades({ intensidade: 1, usoHabilidade: 3 })).toBe(false);
    expect(podeEscolherHabilidades({ intensidade: 1, usoHabilidade: 4 })).toBe(true);
    expect(podeEscolherHabilidades({ intensidade: 0, usoHabilidade: 7 })).toBe(false);
  });

  it('mostra apoio só para "Me matar" com intensidade 4 ou mais', () => {
    expect(exigeApoio({ intensidade: 4 }, { chave: 'me-matar' })).toBe(true);
    expect(exigeApoio({ intensidade: 3 }, { chave: 'me-matar' })).toBe(false);
    expect(exigeApoio({ intensidade: 5 }, { chave: 'me-ferir' })).toBe(false);
    expect(exigeApoio({ intensidade: 5 }, {})).toBe(false);
  });

  it('resume a resposta para a lista do dia', () => {
    expect(resumirResposta(undefined)).toBe('Não registrado · conta como 0');
    expect(resumirResposta({ intensidade: 0, seguiu: false, usoHabilidade: 0, habilidades: [] })).toBe(
      'Impulso 0 · sem impulso',
    );
    expect(
      resumirResposta({ intensidade: 3, seguiu: false, usoHabilidade: 5, habilidades: ['a.b', 'c.d'] }),
    ).toBe('Impulso 3 · não seguiu · 2 habilidades');
    expect(resumirResposta({ intensidade: 1, seguiu: true, usoHabilidade: 2, habilidades: [] })).toBe(
      'Impulso 1 · seguiu · Pensei, não usei, mas gostaria',
    );
  });
});

describe('comportamentos', () => {
  const matar = comportamento({ nome: 'Me matar', tipo: 'impulso', chave: 'me-matar', ordem: 0 });
  const ferir = comportamento({ nome: 'Me ferir', tipo: 'impulso', chave: 'me-ferir', ordem: 1 });
  const alvo1 = comportamento({ nome: 'Gastar demais', ordem: 0 });
  const alvoNovo = comportamento({ nome: 'Isolar-me', ordem: 1, ativoDesde: '2026-10-16' });
  const arquivado = comportamento({ nome: 'Brigar', ordem: 2, arquivadoEm: '2026-10-10' });
  const removido = comportamento({ nome: 'Apagado', ordem: 3, removidoEm: T });
  const todos = [alvoNovo, arquivado, alvo1, ferir, removido, matar];

  it('lista impulsos antes dos alvos e respeita ativoDesde', () => {
    expect(visiveisNoDia(todos, '2026-10-15').map((c) => c.nome)).toEqual(['Me matar', 'Me ferir', 'Gastar demais']);
    expect(visiveisNoDia(todos, '2026-10-16').map((c) => c.nome)).toContain('Isolar-me');
  });

  it('mostra um arquivado só no dia em que ele tem resposta', () => {
    expect(visiveisNoDia(todos, '2026-10-05', new Set([arquivado.id])).map((c) => c.nome)).toContain('Brigar');
    expect(visiveisNoDia(todos, '2026-10-05').map((c) => c.nome)).not.toContain('Brigar');
  });

  it('limita a 7 alvos ativos', () => {
    expect(alvosAtivos(todos).map((c) => c.nome)).toEqual(['Gastar demais', 'Isolar-me']);
    const sete = Array.from({ length: 7 }, (_, i) => comportamento({ nome: `A${i}`, ordem: i }));
    expect(podeAdicionarAlvo(sete)).toBe(false);
    expect(podeAdicionarAlvo(sete.slice(1))).toBe(true);
    expect(podeAdicionarAlvo([...sete.slice(1), { ...sete[0], arquivadoEm: '2026-10-10' }])).toBe(true);
  });

  it('inclui no período quem estava ativo ou tem resposta', () => {
    const nomes = comportamentosDoPeriodo(todos, [], '2026-10-12', '2026-10-18').map((c) => c.nome);
    expect(nomes).toEqual(['Me matar', 'Me ferir', 'Gastar demais', 'Isolar-me']);
    const comResposta = comportamentosDoPeriodo(
      todos,
      [registro({ data: '2026-10-13', comportamentoId: arquivado.id })],
      '2026-10-12',
      '2026-10-18',
    );
    expect(comResposta.map((c) => c.nome)).toContain('Brigar');
    expect(comportamentosDoPeriodo(todos, [], '2026-10-05', '2026-10-11').map((c) => c.nome)).toContain('Brigar');
  });

  it('valida nomes vazios e repetidos', () => {
    expect(validarNomeComportamento('  ', todos)).toBe('Dê um nome');
    expect(validarNomeComportamento('gastar DEMAIS', todos)).toBe('Já existe um comportamento com esse nome');
    expect(validarNomeComportamento('Gastar demais', todos, alvo1.id)).toBeNull();
    expect(validarNomeComportamento('Apagado', todos)).toBeNull();
    expect(proximaOrdem(todos, 'alvo')).toBe(4);
  });
});

describe('resumos', () => {
  const ferir = comportamento({ nome: 'Me ferir', tipo: 'impulso', chave: 'me-ferir' });
  const drogas = comportamento({ nome: 'Usar drogas', tipo: 'impulso', chave: 'usar-drogas', ordem: 1 });
  const registros: Registro[] = [
    registro({ data: '2026-10-12', comportamentoId: ferir.id, intensidade: 2, usoHabilidade: 5, habilidades: ['atencao-plena.mente-sabia'] }),
    registro({ data: '2026-10-14', comportamentoId: ferir.id, intensidade: 4, usoHabilidade: 4, habilidades: ['atencao-plena.mente-sabia', 'tolerancia.tip'] }),
    registro({ data: '2026-10-15', comportamentoId: drogas.id, intensidade: 4 }),
    registro({ data: '2026-10-16', comportamentoId: drogas.id, intensidade: 5, removidoEm: T }),
  ];
  const dias: Dia[] = [{ data: '2026-10-17', concluidoEm: T, criadoEm: T, atualizadoEm: T }];
  const indice = indexar(dias, registros);

  it('considera preenchido o dia concluído ou com resposta, ignorando lápides', () => {
    expect(diaPreenchido(indice, '2026-10-12')).toBe(true);
    expect(diaPreenchido(indice, '2026-10-17')).toBe(true);
    expect(diaPreenchido(indice, '2026-10-16')).toBe(false);
    expect(diaPreenchido(indice, '2026-10-13')).toBe(false);
    expect(ultimoDiaPreenchido(indice)).toBe('2026-10-17');
  });

  it('conta a frequência sem punir hoje nem os dias antes do início', () => {
    expect(frequencia(indice, '2026-10-12', '2026-10-18', '2026-10-18', '2026-10-01')).toEqual({
      preenchidos: 4,
      total: 6,
      faltaram: ['2026-10-13', '2026-10-16'],
    });
    expect(frequencia(indice, '2026-10-12', '2026-10-18', '2026-10-18', '2026-10-14').total).toBe(4);
  });

  it('monta a faixa da semana', () => {
    const faixa = faixaDaSemana('2026-10-12', '2026-10-16', indice, '2026-10-01');
    expect(faixa.map((d) => d.preenchido)).toEqual([true, false, true, true, false, true, false]);
    expect(faixa[4].ehHoje).toBe(true);
    expect(faixa[5].futuro).toBe(true);
    expect(faixa[0].editavel).toBe(true);
  });

  it('lista os dias pendentes dentro da janela de edição', () => {
    expect(diasPendentes(indice, '2026-10-18', '2026-10-01')).toEqual(['2026-10-13', '2026-10-16', '2026-10-18']);
    expect(diasPendentes(indice, '2026-10-18', '2026-10-18')).toEqual(['2026-10-18']);
  });

  it('acha o maior impulso (o primeiro em caso de empate) e as habilidades mais usadas', () => {
    expect(maiorImpulso(registros, [ferir, drogas])).toMatchObject({ intensidade: 4, data: '2026-10-14' });
    expect(habilidadesMaisUsadas(registros)).toEqual([
      { id: 'atencao-plena.mente-sabia', nome: 'Mente Sábia', dias: 2 },
      { id: 'tolerancia.tip', nome: 'TIP', dias: 1 },
    ]);
  });

  it('limita a edição a 6 dias para trás e nada no futuro', () => {
    expect(podeEditarDia('2026-10-12', '2026-10-18')).toBe(true);
    expect(podeEditarDia('2026-10-11', '2026-10-18')).toBe(false);
    expect(podeEditarDia('2026-10-19', '2026-10-18')).toBe(false);
  });

  it('dá título ao dia', () => {
    expect(tituloDoDia('2026-10-18', '2026-10-18')).toBe('Como foi hoje?');
    expect(tituloDoDia('2026-10-17', '2026-10-18')).toBe('Como foi ontem?');
    expect(tituloDoDia('2026-10-14', '2026-10-18')).toBe('Como foi na quarta?');
    expect(tituloDoDia('2026-10-11', '2026-10-18')).toBe('Como foi no domingo?');
  });

  it('lista semanas e períodos', () => {
    expect(listarSemanas('2026-09-30', '2026-10-18')).toEqual(['2026-10-12', '2026-10-05', '2026-09-28']);
    expect(periodoExportacao('semana', '2026-10-18', '2026-09-01')).toEqual({ inicio: '2026-10-12', fim: '2026-10-18' });
    expect(periodoExportacao('quatro-semanas', '2026-10-18', '2026-09-01').inicio).toBe('2026-09-21');
    expect(periodoExportacao('tudo', '2026-10-18', '2026-09-01').inicio).toBe('2026-09-01');
    expect(semanasDoPeriodo({ inicio: '2026-09-30', fim: '2026-10-13' })).toEqual([
      '2026-09-28',
      '2026-10-05',
      '2026-10-12',
    ]);
  });
});
