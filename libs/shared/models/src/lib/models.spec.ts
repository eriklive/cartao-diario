import {
  BACKUP_SCHEMA_VERSION,
  BackupSchema,
  ComportamentoSchema,
  DataLocalSchema,
  ENTRADAS_SESSAO,
  ESCALA_USO_HABILIDADE,
  MODULOS_HABILIDADES,
  RegistroSchema,
  buscarHabilidade,
  nomeHabilidade,
} from '../index';

const agora = '2026-10-18T21:00:00.000Z';

describe('catálogos', () => {
  it('tem ids de habilidade únicos e no formato modulo.habilidade', () => {
    const ids = MODULOS_HABILIDADES.flatMap((m) => m.habilidades.map((h) => h.id));
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9-]+\.[a-z0-9-]+$/);
  });

  it('tem os 5 módulos, cada um com "Outra"', () => {
    expect(MODULOS_HABILIDADES).toHaveLength(5);
    for (const m of MODULOS_HABILIDADES) expect(m.habilidades.at(-1)?.nome).toBe('Outra');
  });

  it('nomeia "Outra" com o módulo e devolve ids desconhecidos como estão', () => {
    expect(nomeHabilidade('atencao-plena.mente-sabia')).toBe('Mente Sábia');
    expect(nomeHabilidade('tolerancia.outra')).toBe('Outra (Tolerância ao Mal-estar)');
    expect(nomeHabilidade('x.y')).toBe('x.y');
    expect(buscarHabilidade('tolerancia.tip')?.moduloId).toBe('tolerancia');
  });

  it('tem 8 níveis de H e 7 entradas em sessão', () => {
    expect(ESCALA_USO_HABILIDADE.map((e) => e.valor)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(ENTRADAS_SESSAO).toHaveLength(7);
  });
});

describe('schemas', () => {
  it('aceita só datas AAAA-MM-DD', () => {
    expect(DataLocalSchema.safeParse('2026-10-18').success).toBe(true);
    expect(DataLocalSchema.safeParse('2026-13-01').success).toBe(false);
    expect(DataLocalSchema.safeParse('18/10/2026').success).toBe(false);
  });

  it('valida comportamento e limita o nome', () => {
    const base = {
      id: crypto.randomUUID(),
      tipo: 'alvo',
      nome: '  Gastar demais ',
      ordem: 0,
      ativoDesde: '2026-10-12',
      criadoEm: agora,
      atualizadoEm: agora,
    };
    const ok = ComportamentoSchema.parse(base);
    expect(ok.nome).toBe('Gastar demais');
    expect(ComportamentoSchema.safeParse({ ...base, nome: '   ' }).success).toBe(false);
    expect(ComportamentoSchema.safeParse({ ...base, tipo: 'outro' }).success).toBe(false);
  });

  it('valida as faixas de I e H', () => {
    const base = {
      data: '2026-10-18',
      comportamentoId: crypto.randomUUID(),
      intensidade: 3,
      seguiu: false,
      usoHabilidade: 5,
      habilidades: ['atencao-plena.mente-sabia'],
      criadoEm: agora,
      atualizadoEm: agora,
    };
    expect(RegistroSchema.safeParse(base).success).toBe(true);
    expect(RegistroSchema.safeParse({ ...base, intensidade: 6 }).success).toBe(false);
    expect(RegistroSchema.safeParse({ ...base, usoHabilidade: 8 }).success).toBe(false);
    expect(RegistroSchema.safeParse({ ...base, intensidade: 2.5 }).success).toBe(false);
  });

  it('valida um backup vazio', () => {
    const backup = {
      app: 'cartao-diario',
      schemaVersion: BACKUP_SCHEMA_VERSION,
      exportadoEm: agora,
      dados: { perfil: null, comportamentos: [], dias: [], registros: [], fechamentos: [] },
    };
    expect(BackupSchema.safeParse(backup).success).toBe(true);
    expect(BackupSchema.safeParse({ ...backup, app: 'outro' }).success).toBe(false);
  });
});
