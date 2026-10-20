import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { LIMITE_ALVOS, type Comportamento } from '@cartao/shared/models';
import { formatarDiaMes } from '@cartao/shared/domain';
import { CartaoStore } from '../../core/dados/cartao-store';
import { Avisos } from '../../ui/avisos';
import { Cabecalho } from '../../ui/cabecalho';
import { Dialogo } from '../../ui/dialogo';
import { Icone } from '../../ui/icone';

@Component({
  selector: 'cd-comportamentos',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Cabecalho, Dialogo, Icone],
  templateUrl: './comportamentos.html',
  styleUrl: './comportamentos.scss',
})
export class ComportamentosPagina {
  protected readonly store = inject(CartaoStore);
  private readonly avisos = inject(Avisos);

  protected readonly limite = LIMITE_ALVOS;
  protected readonly editando = signal<string | null>(null);
  protected readonly textoEdicao = signal('');
  protected readonly adicionando = signal(false);
  protected readonly textoNovo = signal('');
  protected readonly arquivando = signal<Comportamento | null>(null);
  protected readonly mensagem = signal('');

  protected desde(c: Comportamento): string {
    return c.ativoDesde <= this.store.primeiroDia() ? 'Desde o início' : `Desde ${formatarDiaMes(c.ativoDesde)}`;
  }

  renomear(c: Comportamento): void {
    this.adicionando.set(false);
    this.mensagem.set('');
    this.textoEdicao.set(c.nome);
    this.editando.set(c.id);
  }

  async salvarNome(evento: Event, c: Comportamento): Promise<void> {
    evento.preventDefault();
    try {
      await this.store.renomearComportamento(c.id, this.textoEdicao());
      this.editando.set(null);
      this.mensagem.set('Nome atualizado.');
    } catch (erro) {
      this.avisos.falha(erro);
    }
  }

  comecarAdicao(): void {
    this.editando.set(null);
    this.mensagem.set('');
    this.textoNovo.set('');
    this.adicionando.set(true);
  }

  async adicionar(evento: Event): Promise<void> {
    evento.preventDefault();
    try {
      const alvo = await this.store.criarAlvo(this.textoNovo(), this.store.hoje());
      this.adicionando.set(false);
      this.mensagem.set(`“${alvo.nome}” adicionado ao registro do dia.`);
    } catch (erro) {
      this.avisos.falha(erro);
    }
  }

  async confirmarArquivamento(): Promise<void> {
    const c = this.arquivando();
    this.arquivando.set(null);
    if (!c) return;
    try {
      await this.store.arquivarAlvo(c.id);
      this.mensagem.set(`“${c.nome}” arquivado.`);
    } catch (erro) {
      this.avisos.falha(erro);
    }
  }

  async restaurar(c: Comportamento): Promise<void> {
    try {
      await this.store.restaurarAlvo(c.id);
      this.mensagem.set(`“${c.nome}” voltou ao registro do dia.`);
    } catch (erro) {
      this.avisos.falha(erro);
    }
  }
}
