import type { Comportamento, Dados, Dia, Fechamento, Perfil, Registro } from '@cartao/shared/models';

export interface Inscricao {
  unsubscribe(): void;
}

export interface Observavel<T> {
  subscribe(observer: { next?: (valor: T) => void; error?: (erro: unknown) => void }): Inscricao;
}

/** Gravações que acontecem juntas, numa só transação. Tudo é upsert. */
export interface Mudancas {
  perfil?: Perfil;
  comportamentos?: Comportamento[];
  registros?: Registro[];
  dias?: Dia[];
  fechamentos?: Fechamento[];
}

/**
 * Onde os dados moram. Hoje: IndexedDB no aparelho. Na fase com servidor,
 * outra implementação (local + sincronização) entra no lugar e as telas não mudam.
 */
export abstract class CartaoRepository {
  /** Emite tudo de novo a cada mudança (o volume é pequeno: anos cabem em memória). */
  abstract observar(): Observavel<Dados>;
  abstract lerTudo(): Promise<Dados>;
  abstract salvar(mudancas: Mudancas): Promise<void>;
  /** Restauração de backup: apaga tudo e grava `dados`, atomicamente. */
  abstract substituirTudo(dados: Dados): Promise<void>;
}
