import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { Location } from '@angular/common';
import { Router } from '@angular/router';
import {
  ESCALA_USO_HABILIDADE,
  INTENSIDADE_MAX,
  MODULOS_HABILIDADES,
  nomeHabilidade,
  type RespostaRegistro,
} from '@cartao/shared/models';
import {
  NOMES_DIAS,
  RESPOSTA_EM_BRANCO,
  diaDaSemana,
  diferencaEmDias,
  exigeApoio,
  formatarDiaMes,
  podeEscolherHabilidades,
  podeResponderSeguiu,
  validarNomeComportamento,
} from '@cartao/shared/domain';
import { CartaoStore } from '../../core/dados/cartao-store';
import { ApoioDestaque } from '../../ui/apoio';
import { Avisos } from '../../ui/avisos';
import { Dialogo } from '../../ui/dialogo';
import { Icone } from '../../ui/icone';
import { corIntensidade } from '../../ui/intensidade';

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

  /** Parâmetros da rota. Sem `id`: novo comportamento-alvo. */
  readonly data = input.required<string>();
  readonly id = input<string>();

  protected readonly ehNovo = computed(() => !this.id());
  protected readonly comportamento = computed(() => {
    const id = this.id();
    return id ? this.store.comportamento(id) : undefined;
  });
  protected readonly temResposta = computed(() => {
    const id = this.id();
    return !!id && !!this.store.registro(this.data(), id);
  });

  protected readonly rotuloDia = computed(() => {
    const d = this.data();
    const distancia = diferencaEmDias(d, this.store.hoje());
    return `${NOMES_DIAS[diaDaSemana(d)]}, ${formatarDiaMes(d)}${distancia === 0 ? ' · hoje' : distancia === 1 ? ' · ontem' : ''}`;
  });

  protected readonly resposta = signal<RespostaRegistro>({ ...RESPOSTA_EM_BRANCO, habilidades: [] });
  protected readonly nomeNovo = signal('');
  protected readonly erroNome = signal('');
  protected readonly modulo = signal(0);
  protected readonly confirmandoLimpeza = signal(false);
  protected readonly salvando = signal(false);

  protected readonly intensidades = Array.from({ length: INTENSIDADE_MAX + 1 }, (_, v) => ({
    v,
    cor: corIntensidade(v),
  }));
  protected readonly escalaUso = ESCALA_USO_HABILIDADE;
  protected readonly modulos = MODULOS_HABILIDADES;

  protected readonly temImpulso = computed(() => podeResponderSeguiu(this.resposta()));
  protected readonly liberaHabilidades = computed(() => podeEscolherHabilidades(this.resposta()));
  protected readonly mostrarApoio = computed(() => {
    const c = this.comportamento();
    return !!c && exigeApoio(this.resposta(), c);
  });
  protected readonly telefoneTerapeuta = this.store.telefoneTerapeuta;

  protected readonly selecionadas = computed(() => new Set(this.resposta().habilidades));
  protected readonly contagemPorModulo = computed(() =>
    this.modulos.map((m) => m.habilidades.filter((h) => this.selecionadas().has(h.id)).length),
  );
  protected readonly textoHabilidades = computed(() => {
    if (!this.temImpulso()) return 'Disponível quando o impulso for maior que 0.';
    if (!this.liberaHabilidades())
      return 'Disponível se você usou alguma habilidade (“Tentei, usei…” ou “Usei automaticamente…”).';
    const sel = this.resposta().habilidades;
    if (!sel.length) return 'Toque para marcar uma ou mais.';
    return `${sel.length} ${sel.length === 1 ? 'selecionada' : 'selecionadas'}: ${sel.map(nomeHabilidade).join(', ')}`;
  });
  protected readonly podeSalvar = computed(() => !this.ehNovo() || !!this.nomeNovo().trim());

  ngOnInit(): void {
    const id = this.id();
    if (id && !this.comportamento()) {
      void this.router.navigate(['/dia', this.data()], { replaceUrl: true });
      return;
    }
    if (this.ehNovo() && !this.store.podeAdicionarAlvo()) {
      this.avisos.erro('Você chegou ao limite de 7 comportamentos-alvo. Arquive um para abrir espaço.');
      void this.router.navigate(['/dia', this.data()], { replaceUrl: true });
      return;
    }
    const existente = id ? this.store.registro(this.data(), id) : undefined;
    if (existente) {
      const { intensidade, seguiu, usoHabilidade, habilidades } = existente;
      this.resposta.set({ intensidade, seguiu, usoHabilidade, habilidades: [...habilidades] });
      const primeiro = this.modulos.findIndex((m) => m.habilidades.some((h) => habilidades.includes(h.id)));
      if (primeiro >= 0) this.modulo.set(primeiro);
    }
  }

  escolherIntensidade(v: number): void {
    this.resposta.update((r) => (v === 0 ? { ...RESPOSTA_EM_BRANCO, habilidades: [] } : { ...r, intensidade: v }));
  }

  escolherSeguiu(seguiu: boolean): void {
    this.resposta.update((r) => ({ ...r, seguiu }));
  }

  escolherUso(v: number): void {
    this.resposta.update((r) => ({ ...r, usoHabilidade: v, habilidades: v < 4 ? [] : r.habilidades }));
  }

  alternarHabilidade(id: string): void {
    this.resposta.update((r) => ({
      ...r,
      habilidades: r.habilidades.includes(id) ? r.habilidades.filter((h) => h !== id) : [...r.habilidades, id],
    }));
  }

  async salvar(): Promise<void> {
    if (!this.podeSalvar() || this.salvando()) return;
    this.salvando.set(true);
    try {
      if (this.ehNovo()) {
        const erro = validarNomeComportamento(this.nomeNovo(), this.store.comportamentos());
        if (erro) {
          this.erroNome.set(erro);
          return;
        }
        await this.store.criarAlvo(this.nomeNovo(), this.data(), this.resposta());
      } else {
        const id = this.id();
        if (id) await this.store.salvarResposta(this.data(), id, this.resposta());
      }
      this.voltarParaLista();
    } catch (erro) {
      this.avisos.falha(erro);
    } finally {
      this.salvando.set(false);
    }
  }

  acaoEsquerda(): void {
    if (this.temResposta()) this.confirmandoLimpeza.set(true);
    else this.voltarParaLista();
  }

  async limpar(): Promise<void> {
    this.confirmandoLimpeza.set(false);
    const id = this.id();
    if (!id) return;
    try {
      await this.store.limparResposta(this.data(), id);
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
