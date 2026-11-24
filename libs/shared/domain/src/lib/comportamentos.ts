import {
  LIMITE_ALVOS,
  NomeComportamentoSchema,
  type Comportamento,
  type DataLocal,
  type Registro,
  type TipoComportamento,
} from '@cartao/shared/models';

/** Pela ordem (itens antigos do tipo `impulso`, se ainda houver, vêm antes). */
export function ordenarComportamentos<T extends Pick<Comportamento, 'tipo' | 'ordem'>>(lista: readonly T[]): T[] {
  return [...lista].sort((a, b) => (a.tipo === b.tipo ? a.ordem - b.ordem : a.tipo === 'impulso' ? -1 : 1));
}

/**
 * Migração: os impulsos fixos do cartão antigo viram comportamentos-alvo
 * comuns (renomeáveis e arquiváveis), no topo da lista. Idempotente.
 */
export function migrarImpulsosParaAlvos<T extends Pick<Comportamento, 'tipo' | 'ordem'>>(lista: readonly T[]): T[] {
  if (!lista.some((c) => c.tipo === 'impulso')) return [...lista];
  const ordenados = ordenarComportamentos(lista);
  const novaOrdem = new Map(ordenados.map((c, i) => [c, i]));
  return lista.map((c) => ({ ...c, tipo: 'alvo', ordem: novaOrdem.get(c) ?? c.ordem }));
}

export function vigentes(lista: readonly Comportamento[]): Comportamento[] {
  return lista.filter((c) => !c.removidoEm);
}

export function alvosAtivos(lista: readonly Comportamento[]): Comportamento[] {
  return ordenarComportamentos(lista.filter((c) => !c.removidoEm && !c.arquivadoEm));
}

export function alvosArquivados(lista: readonly Comportamento[]): Comportamento[] {
  return ordenarComportamentos(lista.filter((c) => !c.removidoEm && !!c.arquivadoEm));
}

export function podeAdicionarAlvo(lista: readonly Comportamento[]): boolean {
  return alvosAtivos(lista).length < LIMITE_ALVOS;
}

/**
 * O que aparece na lista de um dia: ativos desde aquela data. Arquivados
 * somem, a não ser que já tenham resposta naquele dia.
 */
export function visiveisNoDia(
  lista: readonly Comportamento[],
  data: DataLocal,
  idsComRegistro: ReadonlySet<string> = new Set(),
): Comportamento[] {
  return ordenarComportamentos(
    lista.filter((c) => !c.removidoEm && (idsComRegistro.has(c.id) || (c.ativoDesde <= data && !c.arquivadoEm))),
  );
}

/** Colunas de uma exportação: o que estava ativo no período ou tem resposta nele. */
export function comportamentosDoPeriodo(
  lista: readonly Comportamento[],
  registros: readonly Registro[],
  inicio: DataLocal,
  fim: DataLocal,
): Comportamento[] {
  const comResposta = new Set(
    registros.filter((r) => !r.removidoEm && r.data >= inicio && r.data <= fim).map((r) => r.comportamentoId),
  );
  return ordenarComportamentos(
    lista.filter(
      (c) =>
        !c.removidoEm &&
        (comResposta.has(c.id) || (c.ativoDesde <= fim && (!c.arquivadoEm || c.arquivadoEm >= inicio))),
    ),
  );
}

export function proximaOrdem(lista: readonly Comportamento[], tipo: TipoComportamento): number {
  return lista.filter((c) => c.tipo === tipo).reduce((max, c) => Math.max(max, c.ordem + 1), 0);
}

/** Mensagem de erro para um nome de alvo, ou `null` se estiver ok. */
export function validarNomeComportamento(
  nome: string,
  lista: readonly Comportamento[],
  ignorarId?: string,
): string | null {
  const resultado = NomeComportamentoSchema.safeParse(nome);
  if (!resultado.success) return resultado.error.issues[0]?.message ?? 'Nome inválido';
  const normalizado = resultado.data.toLocaleLowerCase('pt-BR');
  const repetido = lista.some(
    (c) => !c.removidoEm && c.id !== ignorarId && c.nome.toLocaleLowerCase('pt-BR') === normalizado,
  );
  return repetido ? 'Já existe um comportamento com esse nome' : null;
}
