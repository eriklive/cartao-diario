import { Injectable, inject } from '@angular/core';
import { lerBackup, nomeArquivoBackup, type LeituraBackup } from '@cartao/shared/domain';
import { CartaoStore } from '../dados/cartao-store';
import { Arquivos, type ResultadoEnvio } from './arquivos';

const TAMANHO_MAXIMO = 20 * 1024 * 1024;

@Injectable({ providedIn: 'root' })
export class Backups {
  private readonly store = inject(CartaoStore);
  private readonly arquivos = inject(Arquivos);

  /** Chame direto do toque: o menu de compartilhar abre antes de qualquer espera. */
  async salvar(): Promise<ResultadoEnvio> {
    const backup = this.store.montarBackup();
    const arquivo = new File([JSON.stringify(backup, null, 2)], nomeArquivoBackup(this.store.hoje()), {
      type: 'application/json',
    });
    const resultado = await this.arquivos.compartilharOuBaixar(arquivo, 'Backup do Cartão Diário');
    if (resultado !== 'cancelado') await this.store.registrarBackup(backup);
    return resultado;
  }

  async ler(arquivo: File): Promise<LeituraBackup> {
    if (arquivo.size > TAMANHO_MAXIMO)
      return { ok: false, erro: 'Este arquivo é grande demais para ser um backup do Cartão Diário.' };
    try {
      return lerBackup(await arquivo.text());
    } catch {
      return { ok: false, erro: 'Não foi possível ler o arquivo.' };
    }
  }
}
