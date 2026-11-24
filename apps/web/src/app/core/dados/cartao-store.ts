import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import {
  ALVOS_SUGERIDOS,
  JANELA_EDICAO_DIAS,
  LIMITE_ALVOS,
  type Backup,
  type Comportamento,
  type DataLocal,
  type Dados,
  type Fechamento,
  type Lembrete,
  type Perfil,
  type Registro,
  type RespostaRegistro,
} from '@cartao/shared/models';
import {
  alvosArquivados,
  alvosAtivos,
  criarBackup,
  indexar,
  menorData,
  normalizarResposta,
  paraDataLocal,
  podeAdicionarAlvo,
  proximaOrdem,
  somarDias,
  validarNomeComportamento,
  vigentes,
} from '@cartao/shared/domain';
import { Relogio } from '../relogio';
import { CartaoRepository, type Mudancas } from './cartao-repository';
import { novoId } from './ids';

/** Erro de regra de negócio, com mensagem pronta para a pessoa. */
export class ErroDeValidacao extends Error {
  override readonly name = 'ErroDeValidacao';
}

export type CamposFechamento = Pick<
  Fechamento,
  'tarefaCasa' | 'resultadoTarefa' | 'progresso' | 'entradasSessao' | 'notasTerapeuta'
>;

function substituirPor<T>(lista: T[], novos: T[] | undefined, id: (x: T) => string): T[] {
  if (!novos?.length) return lista;
  const porId = new Map(lista.map((x) => [id(x), x]));
  for (const n of novos) porId.set(id(n), n);
  return [...porId.values()];
}

function mesclar(d: Dados, m: Mudancas): Dados {
  return {
    perfil: m.perfil ?? d.perfil,
    comportamentos: substituirPor(d.comportamentos, m.comportamentos, (c) => c.id),
    registros: substituirPor(d.registros, m.registros, (r) => r.id),
    dias: substituirPor(d.dias, m.dias, (x) => x.data),
    fechamentos: substituirPor(d.fechamentos, m.fechamentos, (f) => f.semanaInicio),
  };
}

/**
 * Estado do app em signals, alimentado pelo repositório, e as ações que o
 * alteram. As telas leem daqui e chamam as ações; ninguém fala com o banco.
 */
@Injectable({ providedIn: 'root' })
export class CartaoStore {
  private readonly repo = inject(CartaoRepository);
  private readonly relogio = inject(Relogio);

  private readonly _dados = signal<Dados | null>(null);
  private readonly _erro = signal<unknown>(null);
  private readonly primeiraCarga: Promise<void>;

  readonly dados = this._dados.asReadonly();
  readonly erro = this._erro.asReadonly();
  readonly carregado = computed(() => this._dados() !== null);
  readonly hoje = this.relogio.hoje;

  readonly perfil = computed(() => this._dados()?.perfil ?? null);
  readonly configurado = computed(() => !!this.perfil()?.onboardingConcluidoEm);
  /** Só dígitos e "+", pronto para `tel:`. */
  readonly telefoneTerapeuta = computed(() => this.perfil()?.contatoTerapeuta?.replace(/[^\d+]/g, '') || undefined);
  readonly comportamentos = computed(() => vigentes(this._dados()?.comportamentos ?? []));
  readonly alvosAtivos = computed(() => alvosAtivos(this.comportamentos()));
  readonly alvosArquivados = computed(() => alvosArquivados(this.comportamentos()));
  readonly podeAdicionarAlvo = computed(() => podeAdicionarAlvo(this.comportamentos()));
  readonly indice = computed(() => indexar(this._dados()?.dias ?? [], this._dados()?.registros ?? []));
  readonly fechamentos = computed(
    () => new Map((this._dados()?.fechamentos ?? []).filter((f) => !f.removidoEm).map((f) => [f.semanaInicio, f])),
  );
  /**
   * Início do uso: o dia do primeiro acesso ou o dia mais antigo já preenchido
   * (quem preenche dias anteriores puxa o início para trás). Antes dele, nada
   * conta como falta.
   */
  readonly primeiroDia = computed(() => {
    const indice = this.indice();
    const concluido = this.perfil()?.onboardingConcluidoEm;
    let inicio = concluido ? menorData(paraDataLocal(new Date(concluido)), this.hoje()) : this.hoje();
    for (const d of indice.registrosPorData.keys()) inicio = menorData(inicio, d);
    for (const d of indice.diasConcluidos) inicio = menorData(inicio, d);
    return inicio;
  });
  readonly temRegistros = computed(
    () => this.indice().registrosPorData.size > 0 || this.indice().diasConcluidos.size > 0,
  );

  private readonly registrosBrutos = computed(() => new Map((this._dados()?.registros ?? []).map((r) => [r.id, r])));

  constructor() {
    let resolver!: () => void;
    this.primeiraCarga = new Promise((r) => (resolver = r));
    const inscricao = this.repo.observar().subscribe({
      next: (dados) => {
        this._dados.set(dados);
        resolver();
      },
      error: (erro) => {
        console.error('Falha ao abrir os dados', erro);
        this._erro.set(erro);
        resolver();
      },
    });
    inject(DestroyRef).onDestroy(() => inscricao.unsubscribe());
  }

  aguardarCarga(): Promise<void> {
    return this.primeiraCarga;
  }

  /* Leitura */

  comportamento(id: string): Comportamento | undefined {
    return this.comportamentos().find((c) => c.id === id);
  }

  /** Uma entrada pelo `id` (sem as removidas). */
  registro(id: string): Registro | undefined {
    const r = this.registrosBrutos().get(id);
    return r && !r.removidoEm ? r : undefined;
  }

  fechamento(semanaInicio: DataLocal): Fechamento | undefined {
    return this.fechamentos().get(semanaInicio);
  }

  /* Ações */

  async concluirOnboarding(entrada: { nome: string; alvos: string[]; lembrete: Lembrete }): Promise<void> {
    const agora = this.relogio.instante();
    // Os itens do primeiro acesso valem também para os dias que ainda dá para preencher.
    const ativoDesde = somarDias(this.hoje(), -JANELA_EDICAO_DIAS);
    const existentes = this.comportamentos();
    const novos: Comportamento[] = [];
    let ordem = proximaOrdem(existentes, 'alvo');
    for (const nome of entrada.alvos) {
      const erro = validarNomeComportamento(nome, [...existentes, ...novos]);
      if (erro) continue;
      const chave = ALVOS_SUGERIDOS.find((s) => s.nome === nome.trim())?.chave;
      if (chave && [...existentes, ...novos].some((c) => c.chave === chave)) continue;
      novos.push({
        id: novoId(),
        tipo: 'alvo',
        ...(chave ? { chave } : {}),
        nome: nome.trim(),
        ordem: ordem++,
        ativoDesde,
        criadoEm: agora,
        atualizadoEm: agora,
      });
    }
    const perfil: Perfil = {
      ...this.perfil(),
      nome: entrada.nome.trim(),
      lembrete: entrada.lembrete,
      onboardingConcluidoEm: agora,
      atualizadoEm: agora,
    };
    await this.salvar({ perfil, comportamentos: novos });
  }

  /**
   * Grava uma entrada do dia. Sem `id`: entrada nova (o mesmo alvo pode ter
   * várias no dia). Com `id`: edita a entrada existente.
   */
  async salvarEntrada(
    data: DataLocal,
    comportamentoId: string,
    resposta: RespostaRegistro,
    id?: string,
  ): Promise<Registro> {
    this.exigirComportamento(comportamentoId);
    const agora = this.relogio.instante();
    const existente = id ? this.registrosBrutos().get(id) : undefined;
    const registro: Registro = {
      id: existente?.id ?? novoId(),
      data,
      comportamentoId,
      ...normalizarResposta(resposta),
      criadoEm: existente?.criadoEm ?? agora,
      atualizadoEm: agora,
    };
    await this.salvar({ registros: [registro] });
    return registro;
  }

  /** Remove uma entrada do dia. */
  async removerEntrada(id: string): Promise<void> {
    const existente = this.registrosBrutos().get(id);
    if (!existente || existente.removidoEm) return;
    const agora = this.relogio.instante();
    await this.salvar({ registros: [{ ...existente, removidoEm: agora, atualizadoEm: agora }] });
  }

  /** Cria um comportamento-alvo que aparece a partir de `ativoDesde`. */
  async criarAlvo(nome: string, ativoDesde: DataLocal): Promise<Comportamento> {
    if (!this.podeAdicionarAlvo()) {
      throw new ErroDeValidacao(
        `Você chegou ao limite de ${LIMITE_ALVOS} comportamentos-alvo. Arquive um para abrir espaço.`,
      );
    }
    const erro = validarNomeComportamento(nome, this.comportamentos());
    if (erro) throw new ErroDeValidacao(erro);
    const agora = this.relogio.instante();
    const alvo: Comportamento = {
      id: novoId(),
      tipo: 'alvo',
      nome: nome.trim(),
      ordem: proximaOrdem(this.comportamentos(), 'alvo'),
      ativoDesde,
      criadoEm: agora,
      atualizadoEm: agora,
    };
    await this.salvar({ comportamentos: [alvo] });
    return alvo;
  }

  async renomearComportamento(id: string, nome: string): Promise<void> {
    const atual = this.exigirComportamento(id);
    const erro = validarNomeComportamento(nome, this.comportamentos(), id);
    if (erro) throw new ErroDeValidacao(erro);
    await this.salvar({ comportamentos: [{ ...atual, nome: nome.trim(), atualizadoEm: this.relogio.instante() }] });
  }

  async arquivarAlvo(id: string): Promise<void> {
    const atual = this.exigirComportamento(id);
    await this.salvar({
      comportamentos: [{ ...atual, arquivadoEm: this.hoje(), atualizadoEm: this.relogio.instante() }],
    });
  }

  async restaurarAlvo(id: string): Promise<void> {
    const atual = this.exigirComportamento(id);
    if (!this.podeAdicionarAlvo()) {
      throw new ErroDeValidacao(
        `Você já tem ${LIMITE_ALVOS} comportamentos-alvo ativos. Arquive um antes de restaurar.`,
      );
    }
    const { arquivadoEm: _, ...restaurado } = atual;
    await this.salvar({ comportamentos: [{ ...restaurado, atualizadoEm: this.relogio.instante() }] });
  }

  /** "Concluir": o dia passa a contar como preenchido, mesmo sem nada marcado. */
  async concluirDia(data: DataLocal): Promise<void> {
    const agora = this.relogio.instante();
    const existente = this._dados()?.dias.find((d) => d.data === data);
    await this.salvar({
      dias: [
        {
          data,
          concluidoEm: existente?.concluidoEm ?? agora,
          criadoEm: existente?.criadoEm ?? agora,
          atualizadoEm: agora,
        },
      ],
    });
  }

  async salvarFechamento(semanaInicio: DataLocal, campos: CamposFechamento, fechar: boolean): Promise<void> {
    const agora = this.relogio.instante();
    const existente = this._dados()?.fechamentos.find((f) => f.semanaInicio === semanaInicio);
    const fechadaEm = fechar ? agora : existente && !existente.removidoEm ? existente.fechadaEm : undefined;
    const fechamento: Fechamento = {
      semanaInicio,
      ...campos,
      criadoEm: existente?.criadoEm ?? agora,
      atualizadoEm: agora,
      ...(fechadaEm ? { fechadaEm } : {}),
    };
    await this.salvar({ fechamentos: [fechamento] });
  }

  async atualizarPerfil(alteracoes: Partial<Omit<Perfil, 'atualizadoEm'>>): Promise<void> {
    const atual = this.perfil();
    if (!atual) throw new ErroDeValidacao('Conclua o primeiro acesso antes.');
    await this.salvar({ perfil: { ...atual, ...alteracoes, atualizadoEm: this.relogio.instante() } });
  }

  /**
   * Monta o backup na hora, a partir do que já está em memória: assim o
   * "compartilhar" pode ser chamado ainda dentro do toque da pessoa.
   * O perfil dentro do backup já sai com a data deste backup.
   */
  montarBackup(): Backup {
    const dados = this._dados();
    if (!dados) throw new ErroDeValidacao('Os dados ainda estão carregando.');
    const agora = this.relogio.agora();
    const perfil = dados.perfil ? { ...dados.perfil, ultimoBackupEm: agora.toISOString() } : null;
    return criarBackup({ ...dados, perfil }, agora);
  }

  async registrarBackup(backup: Backup): Promise<void> {
    if (backup.dados.perfil) await this.salvar({ perfil: backup.dados.perfil });
  }

  async restaurarBackup(backup: Backup): Promise<void> {
    await this.repo.substituirTudo(backup.dados);
    this._dados.set(backup.dados);
  }

  /** Grava e, depois do commit, aplica a mesma mudança no estado em memória. */
  private async salvar(mudancas: Mudancas): Promise<void> {
    await this.repo.salvar(mudancas);
    this._dados.update((d) => (d ? mesclar(d, mudancas) : d));
  }

  private exigirComportamento(id: string): Comportamento {
    const c = this.comportamento(id);
    if (!c) throw new ErroDeValidacao('Comportamento não encontrado.');
    return c;
  }
}
