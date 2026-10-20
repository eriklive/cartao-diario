import { BACKUP_SCHEMA_VERSION, type Dados } from '@cartao/shared/models';
import { criarBackup, lerBackup } from './backup';
import { gerarIcsLembrete } from './lembrete';

const T = '2026-10-18T21:00:00.000Z';
const idFerir = crypto.randomUUID();

const dados: Dados = {
  perfil: { nome: 'Ana', lembrete: { ativo: true, horario: '21:00' }, atualizadoEm: T },
  comportamentos: [
    {
      id: idFerir,
      tipo: 'impulso',
      chave: 'me-ferir',
      nome: 'Me ferir',
      ordem: 1,
      ativoDesde: '2026-10-01',
      criadoEm: T,
      atualizadoEm: T,
    },
  ],
  dias: [],
  registros: [
    {
      data: '2026-10-18',
      comportamentoId: idFerir,
      intensidade: 0,
      seguiu: true,
      usoHabilidade: 6,
      habilidades: ['tolerancia.tip'],
      criadoEm: T,
      atualizadoEm: T,
    },
  ],
  fechamentos: [],
};

describe('backup', () => {
  it('faz a ida e volta e normaliza respostas inconsistentes', () => {
    const texto = JSON.stringify(criarBackup(dados, new Date(T)));
    const lido = lerBackup(texto);
    expect(lido.ok).toBe(true);
    if (!lido.ok) return;
    expect(lido.backup.schemaVersion).toBe(BACKUP_SCHEMA_VERSION);
    expect(lido.backup.dados.perfil?.nome).toBe('Ana');
    expect(lido.backup.dados.registros[0]).toMatchObject({
      intensidade: 0,
      seguiu: false,
      usoHabilidade: 0,
      habilidades: [],
    });
  });

  it('recusa arquivos que não são backup', () => {
    expect(lerBackup('não é json')).toEqual({ ok: false, erro: 'Este arquivo não é um backup do Cartão Diário.' });
    expect(lerBackup({ app: 'outro' }).ok).toBe(false);
    expect(lerBackup(JSON.stringify({ app: 'cartao-diario', schemaVersion: 0 })).ok).toBe(false);
  });

  it('avisa quando o backup é de uma versão mais nova', () => {
    const r = lerBackup({ ...criarBackup(dados, new Date(T)), schemaVersion: BACKUP_SCHEMA_VERSION + 1 });
    expect(r).toEqual({ ok: false, erro: expect.stringContaining('versão mais nova') });
  });

  it('recusa backup corrompido ou inconsistente', () => {
    const backup = criarBackup(dados, new Date(T));
    expect(lerBackup({ ...backup, dados: { ...backup.dados, registros: [{ data: 'x' }] } }).ok).toBe(false);
    const orfao = { ...dados.registros[0], comportamentoId: crypto.randomUUID() };
    expect(lerBackup({ ...backup, dados: { ...backup.dados, registros: [orfao] } }).ok).toBe(false);
  });
});

describe('lembrete', () => {
  it('gera um evento diário no horário local', () => {
    const ics = gerarIcsLembrete({
      horario: '21:30',
      inicio: '2026-10-20',
      url: 'https://cartao.example/hoje',
      agora: new Date(T),
    });
    expect(ics).toContain('DTSTART:20261020T213000\r\n');
    expect(ics).toContain('RRULE:FREQ=DAILY\r\n');
    expect(ics).toContain('DTSTAMP:20261018T210000Z\r\n');
    expect(ics).toContain('DESCRIPTION:Hora de registrar como foi o dia.\\nhttps://cartao.example/hoje');
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
  });
});
