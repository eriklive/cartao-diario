import { TestBed } from '@angular/core/testing';
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

  it('conclui o primeiro acesso com os 3 impulsos e os alvos, valendo para os dias que ainda dá para preencher', async () => {
    const { store, repo } = await criarStore();
    await store.concluirOnboarding({
      nome: '  Ana ',
      alvos: ['Gastar demais', 'gastar DEMAIS', 'Isolar-me'],
      lembrete: { ativo: true, horario: '21:00' },
    });

    expect(store.configurado()).toBe(true);
    expect(store.perfil()?.nome).toBe('Ana');
    expect(store.impulsos().map((c) => c.chave)).toEqual(['me-matar', 'me-ferir', 'usar-drogas']);
    expect(store.alvosAtivos().map((c) => c.nome)).toEqual(['Gastar demais', 'Isolar-me']);
    expect(store.comportamentos().every((c) => c.ativoDesde === '2026-10-12')).toBe(true);
    expect(store.primeiroDia()).toBe('2026-10-18');

    const gravado = await repo.lerTudo();
    expect(gravado.comportamentos).toHaveLength(5);
  });

  it('salva respostas normalizadas, limpa com lápide e puxa o início do uso para trás', async () => {
    const { store, repo } = await criarStore();
    await store.concluirOnboarding({ nome: 'Ana', alvos: [], lembrete: { ativo: false, horario: '21:00' } });
    const ferir = store.impulsos()[1];

    await store.salvarResposta('2026-10-16', ferir.id, { ...resposta, usoHabilidade: 2 });
    expect(store.registro('2026-10-16', ferir.id)).toMatchObject({ intensidade: 3, habilidades: [] });
    expect(store.primeiroDia()).toBe('2026-10-16');

    await store.limparResposta('2026-10-16', ferir.id);
    expect(store.registro('2026-10-16', ferir.id)).toBeUndefined();
    const bruto = (await repo.lerTudo()).registros[0];
    expect(bruto.removidoEm).toBeTruthy();

    await store.salvarResposta('2026-10-16', ferir.id, resposta);
    expect(store.registro('2026-10-16', ferir.id)?.removidoEm).toBeUndefined();
    expect(store.registro('2026-10-16', ferir.id)?.criadoEm).toBe(bruto.criadoEm);
  });

  it('cria alvos com resposta, respeita o limite de 7 e arquiva/restaura', async () => {
    const { store } = await criarStore();
    await store.concluirOnboarding({ nome: 'Ana', alvos: [], lembrete: { ativo: false, horario: '21:00' } });

    const alvo = await store.criarAlvo('Brigar', '2026-10-17', resposta);
    expect(alvo.ativoDesde).toBe('2026-10-17');
    expect(store.registro('2026-10-17', alvo.id)?.intensidade).toBe(3);
    await expect(store.criarAlvo('brigar', '2026-10-18')).rejects.toThrow(ErroDeValidacao);

    for (let i = 0; i < 6; i++) await store.criarAlvo(`Alvo ${i}`, '2026-10-18');
    expect(store.podeAdicionarAlvo()).toBe(false);
    await expect(store.criarAlvo('Mais um', '2026-10-18')).rejects.toThrow('limite de 7');

    await store.arquivarAlvo(alvo.id);
    expect(store.alvosArquivados().map((c) => c.nome)).toEqual(['Brigar']);
    expect(store.podeAdicionarAlvo()).toBe(true);
    await store.restaurarAlvo(alvo.id);
    expect(store.comportamento(alvo.id)?.arquivadoEm).toBeUndefined();
    await expect(store.arquivarAlvo(store.impulsos()[0].id)).rejects.toThrow(ErroDeValidacao);
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
    await origem.store.salvarResposta('2026-10-18', origem.store.alvosAtivos()[0].id, resposta);
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
    expect((await destino.repo.lerTudo()).registros).toHaveLength(1);
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
