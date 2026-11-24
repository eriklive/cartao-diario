import { ChangeDetectionStrategy, Component, computed, inject, input, linkedSignal, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import type { Registro } from '@cartao/shared/models';
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
} from '@cartao/shared/domain';
import { CartaoStore } from '../../core/dados/cartao-store';
import { Avisos } from '../../ui/avisos';
import { Dialogo } from '../../ui/dialogo';
import { Icone } from '../../ui/icone';

interface Linha {
  registro: Registro;
  nome: string;
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

  /** Entradas do dia, na ordem em que foram feitas. */
  protected readonly entradas = computed(() => {
    const porId = new Map(this.store.comportamentos().map((c) => [c.id, c]));
    return [...registrosDoDia(this.store.indice(), this.data())]
      .sort((a, b) => a.criadoEm.localeCompare(b.criadoEm))
      .map((r) => ({
        registro: r,
        nome: porId.get(r.comportamentoId)?.nome ?? 'Comportamento removido',
        resumo: resumirResposta(r),
      }));
  });
  protected readonly quantidade = computed(() => this.entradas().length);

  /**
   * "Nada disso aconteceu": escolha explícita de que não houve nenhuma entrada.
   * Começa escolhida se o dia já foi concluído sem entradas; volta ao trocar de dia.
   */
  protected readonly nadaAconteceu = linkedSignal(
    () => this.store.indice().diasConcluidos.has(this.data()) && this.quantidade() === 0,
  );
  /** Só dá para concluir depois de adicionar uma entrada ou escolher "Nada disso aconteceu". */
  protected readonly podeConcluir = computed(() => this.quantidade() > 0 || this.nadaAconteceu());

  protected readonly removendo = signal<Linha | null>(null);
  protected readonly concluindo = signal(false);

  irPara(delta: number): void {
    void this.router.navigate(['/dia', somarDias(this.data(), delta)], { replaceUrl: true });
  }

  alternarNada(): void {
    if (this.quantidade() > 0) return;
    this.nadaAconteceu.update((v) => !v);
  }

  async confirmarRemocao(): Promise<void> {
    const linha = this.removendo();
    this.removendo.set(null);
    if (!linha) return;
    try {
      await this.store.removerEntrada(linha.registro.id);
    } catch (erro) {
      this.avisos.falha(erro);
    }
  }

  async concluir(): Promise<void> {
    if (this.concluindo() || !this.podeConcluir()) return;
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
