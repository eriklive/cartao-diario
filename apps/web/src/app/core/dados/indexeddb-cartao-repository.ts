import Dexie, { type EntityTable, type Table } from 'dexie';
import type { Comportamento, Dados, Dia, Fechamento, Perfil, Registro } from '@cartao/shared/models';
import { CartaoRepository, type Mudancas, type Observavel } from './cartao-repository';

const CHAVE_PERFIL = 'perfil';

export class BancoCartao extends Dexie {
  perfil!: Table<Perfil, string>;
  comportamentos!: EntityTable<Comportamento, 'id'>;
  dias!: EntityTable<Dia, 'data'>;
  registros!: Table<Registro, [string, string]>;
  fechamentos!: EntityTable<Fechamento, 'semanaInicio'>;

  constructor(nome = 'cartao-diario') {
    super(nome);
    // Novas versões entram aqui com .upgrade(); nunca altere uma versão publicada.
    this.version(1).stores({
      perfil: '',
      comportamentos: 'id, tipo',
      dias: 'data',
      registros: '[data+comportamentoId], data, comportamentoId',
      fechamentos: 'semanaInicio',
    });
  }

  get tabelas() {
    return [this.perfil, this.comportamentos, this.dias, this.registros, this.fechamentos];
  }
}

export class IndexedDbCartaoRepository extends CartaoRepository {
  private readonly banco: BancoCartao;
  /** Avisa outras abas/janelas do app que os dados mudaram (não chega na própria). */
  private readonly canal: BroadcastChannel | null;

  constructor(banco?: BancoCartao) {
    super();
    this.banco = banco ?? new BancoCartao();
    this.canal = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(`${this.banco.name}-mudancas`);
  }

  override observar(): Observavel<Dados> {
    return {
      subscribe: ({ next, error }) => {
        let ativo = true;
        const carregar = () =>
          this.lerTudo().then(
            (dados) => ativo && next?.(dados),
            (erro) => ativo && error?.(erro),
          );
        void carregar();
        this.canal?.addEventListener('message', carregar);
        return {
          unsubscribe: () => {
            ativo = false;
            this.canal?.removeEventListener('message', carregar);
          },
        };
      },
    };
  }

  override async lerTudo(): Promise<Dados> {
    const b = this.banco;
    return b.transaction('r', b.tabelas, async () => {
      const [perfil, comportamentos, dias, registros, fechamentos] = await Promise.all([
        b.perfil.get(CHAVE_PERFIL),
        b.comportamentos.toArray(),
        b.dias.toArray(),
        b.registros.toArray(),
        b.fechamentos.toArray(),
      ]);
      return { perfil: perfil ?? null, comportamentos, dias, registros, fechamentos };
    });
  }

  override async salvar(m: Mudancas): Promise<void> {
    const b = this.banco;
    await b.transaction('rw', b.tabelas, async () => {
      if (m.perfil) await b.perfil.put(m.perfil, CHAVE_PERFIL);
      if (m.comportamentos?.length) await b.comportamentos.bulkPut(m.comportamentos);
      if (m.registros?.length) await b.registros.bulkPut(m.registros);
      if (m.dias?.length) await b.dias.bulkPut(m.dias);
      if (m.fechamentos?.length) await b.fechamentos.bulkPut(m.fechamentos);
    });
    this.canal?.postMessage('salvo');
  }

  override async substituirTudo(dados: Dados): Promise<void> {
    const b = this.banco;
    await b.transaction('rw', b.tabelas, async () => {
      await Promise.all(b.tabelas.map((t) => t.clear()));
      if (dados.perfil) await b.perfil.put(dados.perfil, CHAVE_PERFIL);
      await b.comportamentos.bulkPut(dados.comportamentos);
      await b.registros.bulkPut(dados.registros);
      await b.dias.bulkPut(dados.dias);
      await b.fechamentos.bulkPut(dados.fechamentos);
    });
    this.canal?.postMessage('substituido');
  }
}
