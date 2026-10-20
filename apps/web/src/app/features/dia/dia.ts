import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import type { Comportamento } from '@cartao/shared/models';
import {
  NOMES_DIAS,
  diaDaSemana,
  diferencaEmDias,
  formatarDiaMes,
  podeEditarDia,
  registrosDoDia,
  resumirResposta,
  somarDias,
  tituloDoDia,
  visiveisNoDia,
} from '@cartao/shared/domain';
import { CartaoStore } from '../../core/dados/cartao-store';
import { Avisos } from '../../ui/avisos';
import { Dialogo } from '../../ui/dialogo';
import { Icone } from '../../ui/icone';

interface Linha {
  comportamento: Comportamento;
  marcado: boolean;
  resumo: string;
}

@Component({
  selector: 'cd-dia',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Dialogo, Icone],
  templateUrl: './dia.html',
  styleUrl: './dia.scss',
})
export class DiaPagina {
  private readonly store = inject(CartaoStore);
  private readonly router = inject(Router);
  private readonly avisos = inject(Avisos);

  /** Parâmetro da rota (`AAAA-MM-DD`), já validado pela guarda. */
  readonly data = input.required<string>();

  protected readonly hoje = this.store.hoje;
  protected readonly rotuloDia = computed(() => {
    const d = this.data();
    const distancia = diferencaEmDias(d, this.hoje());
    const sufixo = distancia === 0 ? ' · hoje' : distancia === 1 ? ' · ontem' : '';
    return `${NOMES_DIAS[diaDaSemana(d)]}, ${formatarDiaMes(d)}${sufixo}`;
  });
  protected readonly titulo = computed(() => tituloDoDia(this.data(), this.hoje()));
  protected readonly ehPassado = computed(() => this.data() < this.hoje());
  protected readonly podeVoltar = computed(() => podeEditarDia(somarDias(this.data(), -1), this.hoje()));
  protected readonly podeAvancar = computed(() => this.data() < this.hoje());
  protected readonly podeAdicionarAlvo = this.store.podeAdicionarAlvo;

  private readonly registros = computed(
    () => new Map(registrosDoDia(this.store.indice(), this.data()).map((r) => [r.comportamentoId, r])),
  );

  protected readonly grupos = computed(() => {
    const registros = this.registros();
    const linhas: Linha[] = visiveisNoDia(this.store.comportamentos(), this.data(), new Set(registros.keys())).map(
      (c) => {
        const r = registros.get(c.id);
        return { comportamento: c, marcado: !!r, resumo: resumirResposta(r) };
      },
    );
    return [
      { titulo: 'Impulsos', alvos: false, linhas: linhas.filter((l) => l.comportamento.tipo === 'impulso') },
      { titulo: 'Comportamentos-alvo', alvos: true, linhas: linhas.filter((l) => l.comportamento.tipo === 'alvo') },
    ];
  });
  protected readonly marcados = computed(() => this.registros().size);

  protected readonly desmarcando = signal<Comportamento | null>(null);
  protected readonly concluindo = signal(false);

  irPara(delta: number): void {
    void this.router.navigate(['/dia', somarDias(this.data(), delta)], { replaceUrl: true });
  }

  abrir(c: Comportamento): void {
    void this.router.navigate(['/dia', this.data(), 'item', c.id]);
  }

  alternar(linha: Linha): void {
    if (linha.marcado) this.desmarcando.set(linha.comportamento);
    else this.abrir(linha.comportamento);
  }

  async confirmarDesmarcar(): Promise<void> {
    const c = this.desmarcando();
    this.desmarcando.set(null);
    if (!c) return;
    try {
      await this.store.limparResposta(this.data(), c.id);
    } catch (erro) {
      this.avisos.falha(erro);
    }
  }

  async concluir(): Promise<void> {
    if (this.concluindo()) return;
    this.concluindo.set(true);
    try {
      await this.store.concluirDia(this.data());
      const d = this.data();
      this.avisos.info(
        d === this.hoje() ? 'Dia registrado.' : `${NOMES_DIAS[diaDaSemana(d)]}, ${formatarDiaMes(d)} registrado.`,
      );
      await this.router.navigateByUrl('/hoje');
    } catch (erro) {
      this.avisos.falha(erro);
    } finally {
      this.concluindo.set(false);
    }
  }
}
