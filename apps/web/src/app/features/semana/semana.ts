import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  DataLocalSchema,
  ENTRADAS_SESSAO,
  PROGRESSO_MAX,
  PROGRESSO_MIN,
  type EntradaSessaoId,
  type EntradasSessao,
} from '@cartao/shared/models';
import {
  NOMES_DIAS,
  diaDaSemana,
  fimDaSemana,
  formatarPeriodoCurto,
  frequencia,
  habilidadesMaisUsadas,
  inicioDaSemana,
  maiorImpulso,
  registrosDoPeriodo,
  somarDias,
} from '@cartao/shared/domain';
import { CartaoStore, type CamposFechamento } from '../../core/dados/cartao-store';
import { formatarInstante } from '../../core/tempo';
import { Avisos } from '../../ui/avisos';
import { Contador } from '../../ui/contador';
import { Icone } from '../../ui/icone';

const ESPERA_AUTOSALVAR_MS = 700;

@Component({
  selector: 'cd-semana',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Contador, Icone],
  templateUrl: './semana.html',
  styleUrl: './semana.scss',
})
export class SemanaPagina {
  private readonly store = inject(CartaoStore);
  private readonly router = inject(Router);
  private readonly avisos = inject(Avisos);

  /** Parâmetro opcional da rota: qualquer data da semana. */
  readonly inicio = input<string>();

  private readonly semanaAtual = computed(() => inicioDaSemana(this.store.hoje()));
  protected readonly semanaInicio = computed(() => {
    const p = this.inicio();
    const escolhida = p && DataLocalSchema.safeParse(p).success ? inicioDaSemana(p) : this.semanaAtual();
    return escolhida > this.semanaAtual() ? this.semanaAtual() : escolhida;
  });
  protected readonly periodo = computed(() =>
    formatarPeriodoCurto(this.semanaInicio(), fimDaSemana(this.semanaInicio())),
  );
  protected readonly ehAtual = computed(() => this.semanaInicio() === this.semanaAtual());
  protected readonly temAnterior = computed(() => this.semanaInicio() > inicioDaSemana(this.store.primeiroDia()));
  protected readonly fechadaEm = computed(() => this.store.fechamento(this.semanaInicio())?.fechadaEm);

  protected readonly resumo = computed(() => {
    const inicio = this.semanaInicio();
    const fim = fimDaSemana(inicio);
    const indice = this.store.indice();
    const f = frequencia(indice, inicio, fim, this.store.hoje(), this.store.primeiroDia());
    const registros = registrosDoPeriodo(indice, inicio, fim);
    const partes = [`${f.preenchidos} de ${f.total} ${f.total === 1 ? 'dia preenchido' : 'dias preenchidos'}`];
    const maior = maiorImpulso(registros, this.store.comportamentos());
    if (maior) {
      partes.push(
        `maior impulso: ${maior.comportamento.nome}, ${maior.intensidade} (${NOMES_DIAS[diaDaSemana(maior.data)].toLowerCase()})`,
      );
    }
    const habilidade = habilidadesMaisUsadas(registros)[0];
    if (habilidade) partes.push(`habilidade mais usada: ${habilidade.nome}`);
    return partes.join(' · ');
  });

  protected readonly entradasSessao = ENTRADAS_SESSAO;
  protected readonly escalaProgresso = Array.from({ length: PROGRESSO_MAX - PROGRESSO_MIN + 1 }, (_, i) => {
    const v = PROGRESSO_MIN + i;
    return { v, rotulo: v > 0 ? `+${v}` : String(v) };
  });

  protected readonly tarefaCasa = signal('');
  protected readonly resultadoTarefa = signal('');
  protected readonly progresso = signal<number | null>(null);
  protected readonly entradas = signal<EntradasSessao>({});
  protected readonly notasTerapeuta = signal('');
  protected readonly salvaAgora = signal(false);

  private semanaCarregada: string | null = null;
  private temporizador: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    effect(() => {
      const semana = this.semanaInicio();
      untracked(() => this.carregar(semana));
    });
    inject(DestroyRef).onDestroy(() => void this.salvarPendente());
  }

  protected formatarData(instante: string): string {
    return formatarInstante(instante);
  }

  irPara(semanas: number): void {
    void this.router.navigate(['/semana', somarDias(this.semanaInicio(), semanas * 7)], { replaceUrl: true });
  }

  valorEntrada(id: EntradaSessaoId): number {
    return this.entradas()[id] ?? 0;
  }

  mudarEntrada(id: EntradaSessaoId, valor: number): void {
    this.entradas.update((e) => ({ ...e, [id]: valor }));
    this.mudou();
  }

  mudou(): void {
    this.salvaAgora.set(false);
    if (this.temporizador) clearTimeout(this.temporizador);
    this.temporizador = setTimeout(() => void this.salvarPendente(), ESPERA_AUTOSALVAR_MS);
  }

  async salvarSemana(): Promise<void> {
    if (this.temporizador) clearTimeout(this.temporizador);
    this.temporizador = null;
    try {
      await this.store.salvarFechamento(this.semanaInicio(), this.campos(), true);
      this.salvaAgora.set(true);
    } catch (erro) {
      this.avisos.falha(erro);
    }
  }

  private campos(): CamposFechamento {
    return {
      tarefaCasa: this.tarefaCasa(),
      resultadoTarefa: this.resultadoTarefa(),
      progresso: this.progresso(),
      entradasSessao: { ...this.entradas() },
      notasTerapeuta: this.notasTerapeuta(),
    };
  }

  /** Grava o rascunho (sem fechar a semana) se houver mudança pendente. */
  private async salvarPendente(): Promise<void> {
    if (!this.temporizador || !this.semanaCarregada) return;
    clearTimeout(this.temporizador);
    this.temporizador = null;
    try {
      await this.store.salvarFechamento(this.semanaCarregada, this.campos(), false);
    } catch (erro) {
      this.avisos.falha(erro);
    }
  }

  private carregar(semana: string): void {
    void this.salvarPendente();
    const f = this.store.fechamento(semana);
    this.tarefaCasa.set(f?.tarefaCasa ?? '');
    this.resultadoTarefa.set(f?.resultadoTarefa ?? '');
    this.progresso.set(f?.progresso ?? null);
    this.entradas.set({ ...(f?.entradasSessao ?? {}) });
    this.notasTerapeuta.set(f?.notasTerapeuta ?? '');
    this.salvaAgora.set(false);
    this.semanaCarregada = semana;
  }
}
