import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { contarDiasRegistrados, type FormatoExportacao, type Inclusoes } from '@cartao/shared/export';
import { ROTULOS_PERIODO, formatarPeriodoCurto, periodoExportacao, type TipoPeriodo } from '@cartao/shared/domain';
import { CartaoStore } from '../../core/dados/cartao-store';
import { Arquivos } from '../../core/plataforma/arquivos';
import { Exportacao } from '../../core/plataforma/exportacao';
import { Avisos } from '../../ui/avisos';
import { Cabecalho } from '../../ui/cabecalho';
import { Folha } from '../../ui/folha';
import { Icone } from '../../ui/icone';

const FORMATOS: { id: FormatoExportacao; rotulo: string; descricao: string }[] = [
  { id: 'pdf', rotulo: 'PDF', descricao: 'Igual ao cartão de papel, uma página por semana. Para levar à sessão.' },
  { id: 'xlsx', rotulo: 'XLS', descricao: 'Planilha com uma linha por dia e comportamento. Para análise.' },
];

const INCLUSOES: { chave: keyof Inclusoes; rotulo: string }[] = [
  { chave: 'registros', rotulo: 'Impulsos, comportamentos-alvo e habilidades usadas' },
  { chave: 'fechamento', rotulo: 'Fechamento semanal' },
  { chave: 'notas', rotulo: 'Anotações para o terapeuta' },
];

@Component({
  selector: 'cd-exportar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Cabecalho, Folha, Icone],
  templateUrl: './exportar.html',
  styleUrl: './exportar.scss',
})
export class ExportarPagina {
  private readonly store = inject(CartaoStore);
  private readonly exportacao = inject(Exportacao);
  private readonly arquivos = inject(Arquivos);
  private readonly avisos = inject(Avisos);

  protected readonly tiposPeriodo = Object.entries(ROTULOS_PERIODO) as [TipoPeriodo, string][];
  protected readonly formatos = FORMATOS;
  protected readonly inclusoes = INCLUSOES;

  protected readonly tipoPeriodo = signal<TipoPeriodo>('semana');
  protected readonly formato = signal<FormatoExportacao>('pdf');
  protected readonly incluir = signal<Inclusoes>({ registros: true, fechamento: true, notas: true });
  protected readonly gerando = signal(false);
  protected readonly arquivo = signal<File | null>(null);

  protected readonly periodo = computed(() =>
    periodoExportacao(this.tipoPeriodo(), this.store.hoje(), this.store.primeiroDia()),
  );
  protected readonly infoPeriodo = computed(() => {
    const p = this.periodo();
    const dados = this.store.dados();
    const n = dados ? contarDiasRegistrados(dados, p) : 0;
    return `${formatarPeriodoCurto(p.inicio, p.fim)} · ${n} ${n === 1 ? 'dia registrado' : 'dias registrados'}`;
  });
  protected readonly algoIncluido = computed(() => Object.values(this.incluir()).some(Boolean));
  protected readonly podeCompartilhar = computed(() => {
    const a = this.arquivo();
    return !!a && this.arquivos.podeCompartilhar(a);
  });

  alternarInclusao(chave: keyof Inclusoes): void {
    this.incluir.update((i) => ({ ...i, [chave]: !i[chave] }));
  }

  async gerar(): Promise<void> {
    if (this.gerando() || !this.algoIncluido()) return;
    this.gerando.set(true);
    try {
      const arquivo = await this.exportacao.gerar(this.formato(), {
        periodo: this.periodo(),
        incluir: this.incluir(),
        hoje: this.store.hoje(),
        primeiroDia: this.store.primeiroDia(),
      });
      this.arquivo.set(arquivo);
    } catch (erro) {
      this.avisos.falha(
        erro,
        'Não foi possível gerar o arquivo. Verifique a conexão na primeira exportação e tente de novo.',
      );
    } finally {
      this.gerando.set(false);
    }
  }

  async compartilhar(): Promise<void> {
    const a = this.arquivo();
    if (!a) return;
    const resultado = await this.arquivos.compartilharOuBaixar(a, 'Cartão Diário');
    if (resultado === 'baixado') this.avisos.info('Arquivo salvo em Downloads.');
    if (resultado !== 'cancelado') this.arquivo.set(null);
  }

  baixar(): void {
    const a = this.arquivo();
    if (a) this.arquivos.baixar(a);
  }

  previa(): void {
    const a = this.arquivo();
    if (a) this.arquivos.abrir(a);
  }
}
