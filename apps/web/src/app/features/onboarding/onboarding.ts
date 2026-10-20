import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { IMPULSOS_FIXOS, LIMITE_ALVOS, PerfilSchema, type Horario } from '@cartao/shared/models';
import { CartaoStore } from '../../core/dados/cartao-store';
import { Armazenamento } from '../../core/plataforma/armazenamento';
import { Backups } from '../../core/plataforma/backups';
import { LembreteCalendario } from '../../core/plataforma/lembrete-calendario';
import { Avisos } from '../../ui/avisos';
import { Icone } from '../../ui/icone';
import { Interruptor } from '../../ui/interruptor';

const HORARIOS: Horario[] = ['20:00', '21:00', '22:00', '23:00'];

@Component({
  selector: 'cd-onboarding',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icone, Interruptor],
  templateUrl: './onboarding.html',
  styleUrl: './onboarding.scss',
})
export class OnboardingPagina {
  private readonly store = inject(CartaoStore);
  private readonly router = inject(Router);
  private readonly avisos = inject(Avisos);
  private readonly armazenamento = inject(Armazenamento);
  private readonly backups = inject(Backups);
  private readonly calendario = inject(LembreteCalendario);

  protected readonly impulsos = IMPULSOS_FIXOS;
  protected readonly limite = LIMITE_ALVOS;
  protected readonly horarios = HORARIOS.map((valor) => ({ valor, rotulo: `${Number(valor.slice(0, 2))}h` }));

  protected readonly passo = signal(0);
  protected readonly nome = signal('');
  protected readonly alvos = signal<string[]>([]);
  protected readonly rascunho = signal('');
  protected readonly erroAlvo = signal('');
  protected readonly lembreteAtivo = signal(true);
  protected readonly horario = signal<Horario>('21:00');
  protected readonly salvando = signal(false);

  protected readonly nomeValido = computed(() => PerfilSchema.shape.nome.safeParse(this.nome()).success);
  protected readonly podeAdicionar = computed(() => this.alvos().length < LIMITE_ALVOS);
  protected readonly horarioPersonalizado = computed(() => !HORARIOS.includes(this.horario()));

  voltar(): void {
    this.passo.update((p) => Math.max(0, p - 1));
  }

  continuar(): void {
    if (this.passo() === 0 && !this.nomeValido()) return;
    this.passo.update((p) => Math.min(2, p + 1));
  }

  adicionarAlvo(evento?: Event): void {
    evento?.preventDefault();
    const nome = this.rascunho().trim();
    if (!nome) return;
    const todos = [...this.impulsos.map((i) => i.nome), ...this.alvos()];
    if (todos.some((t) => t.toLocaleLowerCase('pt-BR') === nome.toLocaleLowerCase('pt-BR'))) {
      this.erroAlvo.set('Esse comportamento já está na lista.');
      return;
    }
    if (nome.length > 60) {
      this.erroAlvo.set('Use até 60 caracteres.');
      return;
    }
    this.alvos.update((a) => [...a, nome]);
    this.rascunho.set('');
    this.erroAlvo.set('');
  }

  removerAlvo(indice: number): void {
    this.alvos.update((a) => a.filter((_, i) => i !== indice));
  }

  escolherHorario(valor: string): void {
    if (/^([01]\d|2[0-3]):[0-5]\d$/.test(valor)) this.horario.set(valor);
  }

  adicionarAoCalendario(): void {
    this.calendario.baixar(this.horario());
  }

  async comecar(): Promise<void> {
    if (this.salvando()) return;
    this.salvando.set(true);
    try {
      await this.store.concluirOnboarding({
        nome: this.nome(),
        alvos: this.alvos(),
        lembrete: { ativo: this.lembreteAtivo(), horario: this.horario() },
      });
      void this.armazenamento.pedirPersistencia();
      await this.router.navigateByUrl('/hoje');
    } catch (erro) {
      this.avisos.falha(erro);
    } finally {
      this.salvando.set(false);
    }
  }

  async restaurar(evento: Event): Promise<void> {
    const input = evento.target as HTMLInputElement;
    const arquivo = input.files?.[0];
    input.value = '';
    if (!arquivo) return;
    const leitura = await this.backups.ler(arquivo);
    if (!leitura.ok) {
      this.avisos.erro(leitura.erro);
      return;
    }
    try {
      await this.store.restaurarBackup(leitura.backup);
      void this.armazenamento.pedirPersistencia();
      if (leitura.backup.dados.perfil?.onboardingConcluidoEm) {
        this.avisos.info('Backup restaurado.');
        await this.router.navigateByUrl('/hoje');
      } else {
        this.avisos.info('Backup restaurado. Termine o primeiro acesso para começar.');
      }
    } catch (erro) {
      this.avisos.falha(erro, 'Não foi possível restaurar o backup.');
    }
  }
}
