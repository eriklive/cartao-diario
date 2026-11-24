import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { Location } from '@angular/common';
import { Router } from '@angular/router';
import {
  ESCALA_USO_HABILIDADE,
  INTENSIDADE_MAX,
  LIMITE_ALVOS,
  MODULOS_HABILIDADES,
  nomeHabilidade,
  type RespostaRegistro,
} from '@cartao/shared/models';
import {
  NOMES_DIAS,
  diaDaSemana,
  diferencaEmDias,
  exigeApoio,
  formatarDiaMes,
  podeEscolherHabilidades,
  validarNomeComportamento,
  visiveisNoDia,
} from '@cartao/shared/domain';
import { CartaoStore } from '../../core/dados/cartao-store';
import { ApoioDestaque } from '../../ui/apoio';
import { Avisos } from '../../ui/avisos';
import { Dialogo } from '../../ui/dialogo';
import { Icone } from '../../ui/icone';
import { corIntensidade } from '../../ui/intensidade';

/** Escolha de alvo "novo": a pessoa digita o nome e o alvo é criado ao salvar. */
const NOVO = 'novo';

/**
 * Uma entrada do dia: um comportamento-alvo, a intensidade do impulso e se
 * seguiu. Sem `id` na rota é uma entrada nova e o formulário começa vazio
 * (o mesmo alvo pode ter várias entradas no dia); com `id`, edita aquela entrada.
 */
@Component({
  selector: 'cd-formulario',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ApoioDestaque, Dialogo, Icone],
  templateUrl: './formulario.html',
  styleUrl: './formulario.scss',
})
export class FormularioPagina implements OnInit {
  private readonly store = inject(CartaoStore);
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly avisos = inject(Avisos);

  /** Parâmetros da rota. Sem `id`: entrada nova. */
  readonly data = input.required<string>();
  readonly id = input<string>();

  protected readonly ehNova = computed(() => !this.id());

  protected readonly rotuloDia = computed(() => {
    const d = this.data();
    const distancia = diferencaEmDias(d, this.store.hoje());
    return `${NOMES_DIAS[diaDaSemana(d)]}, ${formatarDiaMes(d)}${distancia === 0 ? ' · hoje' : distancia === 1 ? ' · ontem' : ''}`;
  });

  /** Nada vem selecionado: cada campo começa `null` até a pessoa escolher. */
  protected readonly alvoId = signal<string | null>(null);
  protected readonly intensidade = signal<number | null>(null);
  protected readonly seguiu = signal<boolean | null>(null);
  protected readonly usoHabilidade = signal<number | null>(null);
  protected readonly habilidades = signal<string[]>([]);

  protected readonly nomeNovo = signal('');
  protected readonly erroNome = signal('');
  protected readonly modulo = signal(0);
  protected readonly confirmandoExclusao = signal(false);
  protected readonly salvando = signal(false);

  protected readonly NOVO = NOVO;
  protected readonly limite = LIMITE_ALVOS;
  protected readonly intensidades = Array.from({ length: INTENSIDADE_MAX + 1 }, (_, v) => ({
    v,
    cor: corIntensidade(v),
  }));
  protected readonly escalaUso = ESCALA_USO_HABILIDADE;
  protected readonly modulos = MODULOS_HABILIDADES;

  /** Alvos que dá para escolher neste dia (o da entrada em edição aparece mesmo se arquivado). */
  protected readonly alvos = computed(() => {
    const id = this.id();
    const atual = id ? this.store.registro(id)?.comportamentoId : undefined;
    return visiveisNoDia(this.store.comportamentos(), this.data(), new Set(atual ? [atual] : []));
  });
  protected readonly podeCriarAlvo = this.store.podeAdicionarAlvo;
  protected readonly criandoAlvo = computed(() => this.alvoId() === NOVO);
  protected readonly alvo = computed(() => {
    const id = this.alvoId();
    return id && id !== NOVO ? this.store.comportamento(id) : undefined;
  });

  private readonly resposta = computed<RespostaRegistro>(() => ({
    intensidade: this.intensidade() ?? 0,
    seguiu: this.seguiu() ?? false,
    usoHabilidade: this.usoHabilidade() ?? 0,
    habilidades: this.habilidades(),
  }));

  protected readonly temImpulso = computed(() => (this.intensidade() ?? 0) > 0);
  protected readonly liberaHabilidades = computed(
    () => this.usoHabilidade() !== null && podeEscolherHabilidades(this.resposta()),
  );
  protected readonly mostrarApoio = computed(() => {
    const c = this.alvo();
    return !!c && exigeApoio(this.resposta(), c);
  });
  protected readonly telefoneTerapeuta = this.store.telefoneTerapeuta;

  protected readonly selecionadas = computed(() => new Set(this.habilidades()));
  protected readonly contagemPorModulo = computed(() =>
    this.modulos.map((m) => m.habilidades.filter((h) => this.selecionadas().has(h.id)).length),
  );
  protected readonly textoHabilidades = computed(() => {
    if (!this.temImpulso()) return 'Disponível quando o impulso for maior que 0.';
    if (!this.liberaHabilidades())
      return 'Disponível se você usou alguma habilidade (“Tentei, usei…” ou “Usei automaticamente…”).';
    const sel = this.habilidades();
    if (!sel.length) return 'Toque para marcar uma ou mais.';
    return `${sel.length} ${sel.length === 1 ? 'selecionada' : 'selecionadas'}: ${sel.map(nomeHabilidade).join(', ')}`;
  });

  /** Alvo, intensidade e (se houve impulso) "seguiu" são obrigatórios; habilidades, não. */
  protected readonly podeSalvar = computed(() => {
    const alvoOk = this.criandoAlvo() ? !!this.nomeNovo().trim() : !!this.alvo();
    const i = this.intensidade();
    return alvoOk && i !== null && (i === 0 || this.seguiu() !== null);
  });

  ngOnInit(): void {
    const id = this.id();
    if (!id) return;
    const existente = this.store.registro(id);
    if (!existente || existente.data !== this.data()) {
      void this.router.navigate(['/dia', this.data()], { replaceUrl: true });
      return;
    }
    const { comportamentoId, intensidade, seguiu, usoHabilidade, habilidades } = existente;
    this.alvoId.set(comportamentoId);
    this.intensidade.set(intensidade);
    if (intensidade > 0) {
      this.seguiu.set(seguiu);
      this.usoHabilidade.set(usoHabilidade);
      this.habilidades.set([...habilidades]);
    }
    const primeiro = this.modulos.findIndex((m) => m.habilidades.some((h) => habilidades.includes(h.id)));
    if (primeiro >= 0) this.modulo.set(primeiro);
  }

  escolherAlvo(id: string): void {
    this.alvoId.set(id);
    this.erroNome.set('');
  }

  escolherIntensidade(v: number): void {
    this.intensidade.set(v);
    if (v === 0) {
      this.seguiu.set(null);
      this.usoHabilidade.set(null);
      this.habilidades.set([]);
    }
  }

  escolherUso(v: number): void {
    this.usoHabilidade.set(v);
    if (v < 4) this.habilidades.set([]);
  }

  alternarHabilidade(id: string): void {
    this.habilidades.update((h) => (h.includes(id) ? h.filter((x) => x !== id) : [...h, id]));
  }

  async salvar(): Promise<void> {
    if (!this.podeSalvar() || this.salvando()) return;
    this.salvando.set(true);
    try {
      let alvoId = this.alvo()?.id;
      if (this.criandoAlvo()) {
        const erro = validarNomeComportamento(this.nomeNovo(), this.store.comportamentos());
        if (erro) {
          this.erroNome.set(erro);
          return;
        }
        alvoId = (await this.store.criarAlvo(this.nomeNovo(), this.data())).id;
      }
      if (!alvoId) return;
      await this.store.salvarEntrada(this.data(), alvoId, this.resposta(), this.id());
      this.voltarParaLista();
    } catch (erro) {
      this.avisos.falha(erro);
    } finally {
      this.salvando.set(false);
    }
  }

  acaoEsquerda(): void {
    if (this.ehNova()) this.voltarParaLista();
    else this.confirmandoExclusao.set(true);
  }

  async excluir(): Promise<void> {
    this.confirmandoExclusao.set(false);
    const id = this.id();
    if (!id) return;
    try {
      await this.store.removerEntrada(id);
      this.voltarParaLista();
    } catch (erro) {
      this.avisos.falha(erro);
    }
  }

  /** Volta pelo histórico quando veio da lista (o "voltar" do Android continua coerente). */
  voltarParaLista(): void {
    const anterior = this.router.lastSuccessfulNavigation()?.previousNavigation?.finalUrl;
    const lista = this.router.createUrlTree(['/dia', this.data()]);
    if (anterior && this.router.serializeUrl(anterior) === this.router.serializeUrl(lista)) this.location.back();
    else void this.router.navigateByUrl(lista, { replaceUrl: true });
  }
}
