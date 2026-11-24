import { TestBed } from '@angular/core/testing';
import Dexie from 'dexie';
import { signal } from '@angular/core';
import { lerBackup } from '@cartao/shared/domain';
import { Relogio } from '../relogio';
import { CartaoRepository } from './cartao-repository';
import { CartaoStore, ErroDeValidacao } from './cartao-store';
import { BancoCartao, IndexedDbCartaoRepository } from './indexeddb-cartao-repository';

class RelogioFalso {
  readonly hoje = signal('2026-10-18');
  agora(): Date {
    return new Date('2026-10-18T21:00:00-03:00');
  }
  instante(): string {
    return this.agora().toISOString();
  }
}

let sequencia = 0;

async function criarStore(repo = new IndexedDbCartaoRepository(new BancoCartao(`teste-${++sequencia}`))) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      { provide: CartaoRepository, useValue: repo },
      { provide: Relogio, useClass: RelogioFalso },
    ],
  });
  const store = TestBed.inject(CartaoStore);
  await store.aguardarCarga();
  return { store, repo };
}

const resposta = { intensidade: 3, seguiu: false, usoHabilidade: 5, habilidades: ['atencao-plena.mente-sabia'] };

describe('CartaoStore', () => {
  it('começa vazio e sem configuração', async () => {
    const { store } = await criarStore();
    expect(store.carregado()).toBe(true);
    expect(store.configurado()).toBe(false);
    expect(store.comportamentos()).toEqual([]);
  });

  it('conclui o primeiro acesso com os alvos escolhidos, valendo para os dias que ainda dá para preencher', async () => {
    const { store, repo } = await criarStore();
    await store.concluirOnboarding({
      nome: '  Ana ',
      alvos: ['Vontade de me matar', 'Gastar demais', 'gastar DEMAIS', 'Isolar-me'],
      lembrete: { ativo: true, horario: '21:00' },
    });

    expect(store.configurado()).toBe(true);
    expect(store.perfil()?.nome).toBe('Ana');
    expect(store.alvosAtivos().map((c) => c.nome)).toEqual(['Vontade de me matar', 'Gastar demais', 'Isolar-me']);
    expect(store.alvosAtivos().map((c) => c.chave)).toEqual(['me-matar', undefined, undefined]);
    expect(store.comportamentos().every((c) => c.tipo === 'alvo' && c.ativoDesde === '2026-10-12')).toBe(true);
    expect(store.primeiroDia()).toBe('2026-10-18');

    const gravado = await repo.lerTudo();
    expect(gravado.comportamentos).toHaveLength(3);
  });

  it('guarda várias entradas do mesmo alvo no dia, edita, remove com lápide e puxa o início do uso para trás', async () => {
    const { store, repo } = await criarStore();
    await store.concluirOnboarding({
      nome: 'Ana',
      alvos: ['Vontade de me ferir'],
      lembrete: { ativo: false, horario: '21:00' },
    });
    const ferir = store.alvosAtivos()[0];

    const primeira = await store.salvarEntrada('2026-10-16', ferir.id, { ...resposta, usoHabilidade: 2 });
    const segunda = await store.salvarEntrada('2026-10-16', ferir.id, { ...resposta, intensidade: 5 });
    expect(primeira.id).not.toBe(segunda.id);
    expect(store.registro(primeira.id)).toMatchObject({ intensidade: 3, habilidades: [] });
    expect(store.indice().registrosPorData.get('2026-10-16')).toHaveLength(2);
    expect(store.primeiroDia()).toBe('2026-10-16');

    await store.salvarEntrada('2026-10-16', ferir.id, { ...resposta, intensidade: 1 }, primeira.id);
    expect(store.registro(primeira.id)).toMatchObject({ intensidade: 1, criadoEm: primeira.criadoEm });
    expect(store.indice().registrosPorData.get('2026-10-16')).toHaveLength(2);

    await store.removerEntrada(primeira.id);
    expect(store.registro(primeira.id)).toBeUndefined();
    expect(store.indice().registrosPorData.get('2026-10-16')).toHaveLength(1);
    const bruto = (await repo.lerTudo()).registros.find((r) => r.id === primeira.id);
    expect(bruto?.removidoEm).toBeTruthy();
  });

  it('cria alvos, respeita o limite de 10 e arquiva/restaura qualquer alvo', async () => {
    const { store } = await criarStore();
    await store.concluirOnboarding({
      nome: 'Ana',
      alvos: ['Vontade de me matar'],
      lembrete: { ativo: false, horario: '21:00' },
    });

    const alvo = await store.criarAlvo('Brigar', '2026-10-17');
    expect(alvo.ativoDesde).toBe('2026-10-17');
    await expect(store.criarAlvo('brigar', '2026-10-18')).rejects.toThrow(ErroDeValidacao);

    for (let i = 0; i < 8; i++) await store.criarAlvo(`Alvo ${i}`, '2026-10-18');
    expect(store.podeAdicionarAlvo()).toBe(false);
    await expect(store.criarAlvo('Mais um', '2026-10-18')).rejects.toThrow('limite de 10');

    await store.arquivarAlvo(alvo.id);
    expect(store.alvosArquivados().map((c) => c.nome)).toEqual(['Brigar']);
    expect(store.podeAdicionarAlvo()).toBe(true);
    await store.restaurarAlvo(alvo.id);
    expect(store.comportamento(alvo.id)?.arquivadoEm).toBeUndefined();
    const matar = store.alvosAtivos()[0];
    await store.arquivarAlvo(matar.id);
    expect(store.comportamento(matar.id)?.arquivadoEm).toBe('2026-10-18');
  });

  it('migra o banco antigo: uma resposta por item vira entrada com id e os impulsos viram alvos', async () => {
    const nome = `teste-migracao-${++sequencia}`;
    const T = '2026-10-18T21:00:00.000Z';
    const idMatar = crypto.randomUUID();
    const idAlvo = crypto.randomUUID();
    const antigo = new Dexie(nome);
    antigo.version(1).stores({
      perfil: '',
      comportamentos: 'id, tipo',
      dias: 'data',
      registros: '[data+comportamentoId], data, comportamentoId',
      fechamentos: 'semanaInicio',
    });
    const base = { ativoDesde: '2026-10-01', criadoEm: T, atualizadoEm: T };
    await antigo.table('comportamentos').bulkPut([
      { ...base, id: idAlvo, tipo: 'alvo', nome: 'Gastar demais', ordem: 0 },
      { ...base, id: idMatar, tipo: 'impulso', chave: 'me-matar', nome: 'Me matar', ordem: 0 },
    ]);
    await antigo.table('registros').put({
      data: '2026-10-17',
      comportamentoId: idMatar,
      ...resposta,
      criadoEm: T,
      atualizadoEm: T,
    });
    antigo.close();

    const dados = await new IndexedDbCartaoRepository(new BancoCartao(nome)).lerTudo();
    expect(dados.registros).toHaveLength(1);
    expect(dados.registros[0]).toMatchObject({ comportamentoId: idMatar, intensidade: 3 });
    expect(dados.registros[0].id).toMatch(/^[0-9a-f-]{36}$/);
    const porId = new Map(dados.comportamentos.map((c) => [c.id, c]));
    expect(porId.get(idMatar)).toMatchObject({ tipo: 'alvo', chave: 'me-matar', ordem: 0 });
    expect(porId.get(idAlvo)).toMatchObject({ tipo: 'alvo', ordem: 1 });
  });

  it('salva o fechamento como rascunho e depois fecha a semana', async () => {
    const { store } = await criarStore();
    await store.concluirOnboarding({ nome: 'Ana', alvos: [], lembrete: { ativo: false, horario: '21:00' } });
    const campos = {
      tarefaCasa: 'TIP',
      resultadoTarefa: '',
      progresso: 1,
      entradasSessao: { emocoes: 2 },
      notasTerapeuta: '',
    };
    await store.salvarFechamento('2026-10-12', campos, false);
    expect(store.fechamento('2026-10-12')?.fechadaEm).toBeUndefined();
    await store.salvarFechamento('2026-10-12', campos, true);
    const fechadaEm = store.fechamento('2026-10-12')?.fechadaEm;
    expect(fechadaEm).toBeTruthy();
    await store.salvarFechamento('2026-10-12', { ...campos, tarefaCasa: 'TIP e Mente Sábia' }, false);
    expect(store.fechamento('2026-10-12')).toMatchObject({ tarefaCasa: 'TIP e Mente Sábia', fechadaEm });
  });

  it('faz backup e restaura tudo em outro aparelho', async () => {
    const origem = await criarStore();
    await origem.store.concluirOnboarding({
      nome: 'Ana',
      alvos: ['Brigar'],
      lembrete: { ativo: true, horario: '22:00' },
    });
    await origem.store.salvarEntrada('2026-10-18', origem.store.alvosAtivos()[0].id, resposta);
    await origem.store.salvarEntrada('2026-10-18', origem.store.alvosAtivos()[0].id, resposta);
    await origem.store.concluirDia('2026-10-18');
    const backup = origem.store.montarBackup();
    await origem.store.registrarBackup(backup);
    expect(origem.store.perfil()?.ultimoBackupEm).toBe(backup.exportadoEm);

    const lido = lerBackup(JSON.stringify(backup));
    if (!lido.ok) throw new Error(lido.erro);
    const destino = await criarStore();
    await destino.store.restaurarBackup(lido.backup);
    expect(destino.store.configurado()).toBe(true);
    expect(destino.store.alvosAtivos().map((c) => c.nome)).toEqual(['Brigar']);
    expect(destino.store.indice().diasConcluidos.has('2026-10-18')).toBe(true);
    expect((await destino.repo.lerTudo()).registros).toHaveLength(2);
  });

  it('recarrega quando outra aba grava no mesmo banco', async () => {
    const nome = `teste-abas-${++sequencia}`;
    const outraAba = new IndexedDbCartaoRepository(new BancoCartao(nome));
    const { store } = await criarStore(new IndexedDbCartaoRepository(new BancoCartao(nome)));
    expect(store.perfil()).toBeNull();

    await outraAba.salvar({
      perfil: { nome: 'Ana', lembrete: { ativo: false, horario: '21:00' }, atualizadoEm: new Date().toISOString() },
    });
    await vi.waitFor(() => expect(store.perfil()?.nome).toBe('Ana'));
  });
});
