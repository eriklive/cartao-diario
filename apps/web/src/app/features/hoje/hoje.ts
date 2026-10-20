import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  NOMES_DIAS,
  diaDaSemana,
  exigeApoio,
  faixaDaSemana,
  fimDaSemana,
  formatarDataLonga,
  formatarPeriodoCurto,
  frequencia,
  inicioDaSemana,
  juntarLista,
  registrosDoDia,
} from '@cartao/shared/domain';
import { CartaoStore } from '../../core/dados/cartao-store';
import { Backups } from '../../core/plataforma/backups';
import { Instalacao } from '../../core/plataforma/instalacao';
import { diasDesde, tempoDesde } from '../../core/tempo';
import { ApoioCvv, ApoioDestaque } from '../../ui/apoio';
import { Avisos } from '../../ui/avisos';
import { ConviteInstalar } from '../../ui/convite-instalar';
import { FaixaSemana } from '../../ui/faixa-semana';
import { Icone } from '../../ui/icone';
import { SeloIntensidade } from '../../ui/intensidade';

/** Depois de quantos dias sem backup o lembrete aparece em Hoje. */
const DIAS_PARA_LEMBRAR_BACKUP = 14;

@Component({
  selector: 'cd-hoje',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, ApoioCvv, ApoioDestaque, ConviteInstalar, FaixaSemana, Icone, SeloIntensidade],
  templateUrl: './hoje.html',
  styleUrl: './hoje.scss',
})
export class HojePagina {
  protected readonly store = inject(CartaoStore);
  protected readonly instalacao = inject(Instalacao);
  private readonly backups = inject(Backups);
  private readonly avisos = inject(Avisos);

  protected readonly hoje = this.store.hoje;
  protected readonly dataLonga = computed(() => formatarDataLonga(this.hoje()));
  protected readonly semanaInicio = computed(() => inicioDaSemana(this.hoje()));
  protected readonly rotuloSemana = computed(() =>
    formatarPeriodoCurto(this.semanaInicio(), fimDaSemana(this.semanaInicio())),
  );
  protected readonly faixa = computed(() =>
    faixaDaSemana(this.semanaInicio(), this.hoje(), this.store.indice(), this.store.primeiroDia()),
  );

  protected readonly resumoSemana = computed(() => {
    const f = frequencia(
      this.store.indice(),
      this.semanaInicio(),
      fimDaSemana(this.semanaInicio()),
      this.hoje(),
      this.store.primeiroDia(),
    );
    if (f.total === 0) return 'Comece registrando hoje.';
    const base = `${f.preenchidos} de ${f.total} ${f.total === 1 ? 'dia preenchido' : 'dias preenchidos'}`;
    if (!f.faltaram.length) return base;
    const nomes = f.faltaram.map((d) => NOMES_DIAS[diaDaSemana(d)].toLowerCase());
    return `${base} · ${f.faltaram.length === 1 ? 'faltou' : 'faltaram'} ${juntarLista(nomes)}`;
  });

  protected readonly marcadosHoje = computed(() => {
    const porId = new Map(this.store.comportamentos().map((c) => [c.id, c]));
    return registrosDoDia(this.store.indice(), this.hoje())
      .flatMap((r) => {
        const c = porId.get(r.comportamentoId);
        if (!c) return [];
        const n = r.habilidades.length;
        return [
          {
            id: c.id,
            nome: c.nome,
            intensidade: r.intensidade,
            detalhe: n ? `${n} ${n === 1 ? 'habilidade' : 'habilidades'}` : '',
          },
        ];
      })
      .sort((a, b) => b.intensidade - a.intensidade);
  });
  /** "Me matar" com intensidade alta hoje: o apoio sobe para o topo. */
  protected readonly apoioEmDestaque = computed(() =>
    registrosDoDia(this.store.indice(), this.hoje()).some((r) => {
      const c = this.store.comportamento(r.comportamentoId);
      return !!c && exigeApoio(r, c);
    }),
  );
  protected readonly hojeConcluido = computed(() => this.store.indice().diasConcluidos.has(this.hoje()));

  protected readonly backupPendente = computed(() => {
    if (!this.store.temRegistros()) return null;
    const ultimo = this.store.perfil()?.ultimoBackupEm;
    if (ultimo && diasDesde(ultimo, this.hoje()) < DIAS_PARA_LEMBRAR_BACKUP) return null;
    return ultimo ? `Último backup ${tempoDesde(ultimo, this.hoje())}.` : 'Você ainda não fez nenhum backup.';
  });

  protected readonly mostrarConvite = computed(() => this.instalacao.convidar() && !this.instalacao.dispensado());

  async fazerBackup(): Promise<void> {
    try {
      const r = await this.backups.salvar();
      if (r !== 'cancelado') this.avisos.info('Backup salvo.');
    } catch (erro) {
      this.avisos.falha(erro, 'Não foi possível gerar o backup.');
    }
  }
}
