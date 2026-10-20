import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HorarioSchema, PerfilSchema, type Backup } from '@cartao/shared/models';
import { CartaoStore } from '../../core/dados/cartao-store';
import { Armazenamento } from '../../core/plataforma/armazenamento';
import { Backups } from '../../core/plataforma/backups';
import { Instalacao } from '../../core/plataforma/instalacao';
import { LembreteCalendario } from '../../core/plataforma/lembrete-calendario';
import { formatarInstante, tempoDesde } from '../../core/tempo';
import { Avisos } from '../../ui/avisos';
import { Cabecalho } from '../../ui/cabecalho';
import { ConviteInstalar } from '../../ui/convite-instalar';
import { Dialogo } from '../../ui/dialogo';
import { Icone } from '../../ui/icone';
import { Interruptor } from '../../ui/interruptor';

@Component({
  selector: 'cd-ajustes',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Cabecalho, ConviteInstalar, Dialogo, Icone, Interruptor],
  templateUrl: './ajustes.html',
  styleUrl: './ajustes.scss',
})
export class AjustesPagina {
  protected readonly store = inject(CartaoStore);
  protected readonly armazenamento = inject(Armazenamento);
  protected readonly instalacao = inject(Instalacao);
  private readonly backups = inject(Backups);
  private readonly calendario = inject(LembreteCalendario);
  private readonly avisos = inject(Avisos);

  protected readonly perfil = this.store.perfil;
  protected readonly resumoComportamentos = computed(() => {
    const n = this.store.alvosAtivos().length;
    return `${this.store.impulsos().length} impulsos · ${n} ${n === 1 ? 'comportamento-alvo' : 'comportamentos-alvo'}`;
  });
  protected readonly ultimoBackup = computed(() => {
    const em = this.perfil()?.ultimoBackupEm;
    return em ? `${tempoDesde(em, this.store.hoje())} (${formatarInstante(em)})` : 'nunca';
  });
  protected readonly telefone = this.store.telefoneTerapeuta;

  protected readonly editandoNome = signal(false);
  protected readonly rascunhoNome = signal('');
  protected readonly restaurando = signal<Backup | null>(null);

  async alternarLembrete(ativo: boolean): Promise<void> {
    const lembrete = this.perfil()?.lembrete;
    if (lembrete) await this.salvarPerfil({ lembrete: { ...lembrete, ativo } });
  }

  async mudarHorario(valor: string): Promise<void> {
    const lembrete = this.perfil()?.lembrete;
    if (!lembrete || !HorarioSchema.safeParse(valor).success) return;
    await this.salvarPerfil({ lembrete: { ...lembrete, horario: valor } });
    if (lembrete.ativo)
      this.avisos.info('Horário salvo. Adicione o lembrete de novo ao calendário para trocar o aviso.');
  }

  adicionarAoCalendario(): void {
    const lembrete = this.perfil()?.lembrete;
    if (lembrete) this.calendario.baixar(lembrete.horario);
  }

  async salvarContato(valor: string): Promise<void> {
    const contato = valor.trim();
    if (contato === (this.perfil()?.contatoTerapeuta ?? '')) return;
    await this.salvarPerfil({ contatoTerapeuta: contato || undefined });
    this.avisos.info(contato ? 'Contato do terapeuta salvo.' : 'Contato do terapeuta removido.');
  }

  editarNome(): void {
    this.rascunhoNome.set(this.perfil()?.nome ?? '');
    this.editandoNome.set(true);
  }

  async salvarNome(evento: Event): Promise<void> {
    evento.preventDefault();
    const r = PerfilSchema.shape.nome.safeParse(this.rascunhoNome());
    if (!r.success) {
      this.avisos.erro(r.error.issues[0]?.message ?? 'Nome inválido');
      return;
    }
    await this.salvarPerfil({ nome: r.data });
    this.editandoNome.set(false);
  }

  async fazerBackup(): Promise<void> {
    try {
      const r = await this.backups.salvar();
      if (r === 'baixado') this.avisos.info('Backup salvo em Downloads.');
      if (r === 'compartilhado') this.avisos.info('Backup salvo.');
    } catch (erro) {
      this.avisos.falha(erro, 'Não foi possível gerar o backup.');
    }
  }

  async escolherBackup(evento: Event): Promise<void> {
    const input = evento.target as HTMLInputElement;
    const arquivo = input.files?.[0];
    input.value = '';
    if (!arquivo) return;
    const leitura = await this.backups.ler(arquivo);
    if (leitura.ok) this.restaurando.set(leitura.backup);
    else this.avisos.erro(leitura.erro);
  }

  protected dataDoBackup(b: Backup | null): string {
    return b ? formatarInstante(b.exportadoEm) : '';
  }

  async confirmarRestauracao(): Promise<void> {
    const backup = this.restaurando();
    this.restaurando.set(null);
    if (!backup) return;
    try {
      await this.store.restaurarBackup(backup);
      this.avisos.info('Backup restaurado.');
    } catch (erro) {
      this.avisos.falha(erro, 'Não foi possível restaurar o backup.');
    }
  }

  async pedirPersistencia(): Promise<void> {
    const ok = await this.armazenamento.pedirPersistencia();
    if (ok === false) {
      this.avisos.info('O navegador não liberou agora. Instalar o app na tela de início costuma resolver.');
    }
  }

  private async salvarPerfil(alteracoes: Parameters<CartaoStore['atualizarPerfil']>[0]): Promise<void> {
    try {
      await this.store.atualizarPerfil(alteracoes);
    } catch (erro) {
      this.avisos.falha(erro);
    }
  }
}
