import {
  BACKUP_APP,
  BACKUP_SCHEMA_VERSION,
  BackupSchema,
  type Backup,
  type Dados,
} from '@cartao/shared/models';
import { normalizarResposta } from './registro';

export function criarBackup(dados: Dados, agora: Date): Backup {
  return { app: BACKUP_APP, schemaVersion: BACKUP_SCHEMA_VERSION, exportadoEm: agora.toISOString(), dados };
}

export function nomeArquivoBackup(data: string): string {
  return `cartao-diario-backup-${data}.json`;
}

export type LeituraBackup = { ok: true; backup: Backup } | { ok: false; erro: string };

/**
 * Migrações de versões antigas do backup: cada função leva da versão `n`
 * para `n + 1`. Vazio enquanto só existe a versão 1.
 */
const MIGRACOES: Record<number, (bruto: Record<string, unknown>) => Record<string, unknown>> = {};

const NAO_E_BACKUP = 'Este arquivo não é um backup do Cartão Diário.';

/** Lê, migra, valida e normaliza um backup. Nunca lança exceção. */
export function lerBackup(conteudo: unknown): LeituraBackup {
  let bruto: unknown = conteudo;
  if (typeof conteudo === 'string') {
    try {
      bruto = JSON.parse(conteudo);
    } catch {
      return { ok: false, erro: NAO_E_BACKUP };
    }
  }
  if (!bruto || typeof bruto !== 'object' || (bruto as { app?: unknown }).app !== BACKUP_APP) {
    return { ok: false, erro: NAO_E_BACKUP };
  }

  let atual = bruto as Record<string, unknown>;
  let versao = atual['schemaVersion'];
  if (typeof versao !== 'number' || !Number.isInteger(versao) || versao < 1) {
    return { ok: false, erro: NAO_E_BACKUP };
  }
  if (versao > BACKUP_SCHEMA_VERSION) {
    return { ok: false, erro: 'Este backup foi feito por uma versão mais nova do app. Atualize o app e tente de novo.' };
  }
  while (versao < BACKUP_SCHEMA_VERSION) {
    const migrar = MIGRACOES[versao];
    if (!migrar) return { ok: false, erro: NAO_E_BACKUP };
    atual = { ...migrar(atual), schemaVersion: versao + 1 };
    versao += 1;
  }

  const resultado = BackupSchema.safeParse(atual);
  if (!resultado.success) {
    return { ok: false, erro: 'O backup está incompleto ou corrompido e não pode ser restaurado.' };
  }

  const { dados } = resultado.data;
  const ids = new Set(dados.comportamentos.map((c) => c.id));
  if (dados.registros.some((r) => !ids.has(r.comportamentoId))) {
    return { ok: false, erro: 'O backup tem respostas de comportamentos que não existem e não pode ser restaurado.' };
  }

  return {
    ok: true,
    backup: {
      ...resultado.data,
      dados: {
        ...dados,
        registros: dados.registros.map((r) => ({ ...r, ...normalizarResposta(r) })),
      },
    },
  };
}
