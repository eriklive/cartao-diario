import * as z from 'zod';
import { InstanteSchema } from './comum';
import { ComportamentoSchema, DiaSchema, FechamentoSchema, PerfilSchema, RegistroSchema } from './entidades';

export const BACKUP_APP = 'cartao-diario';
export const BACKUP_SCHEMA_VERSION = 1;

/** Tudo o que o app guarda. É o formato do backup e, no futuro, da sincronização. */
export const DadosSchema = z.object({
  perfil: PerfilSchema.nullable(),
  comportamentos: z.array(ComportamentoSchema),
  dias: z.array(DiaSchema),
  registros: z.array(RegistroSchema),
  fechamentos: z.array(FechamentoSchema),
});
export type Dados = z.infer<typeof DadosSchema>;

export const BackupSchema = z.object({
  app: z.literal(BACKUP_APP),
  schemaVersion: z.literal(BACKUP_SCHEMA_VERSION),
  exportadoEm: InstanteSchema,
  dados: DadosSchema,
});
export type Backup = z.infer<typeof BackupSchema>;
