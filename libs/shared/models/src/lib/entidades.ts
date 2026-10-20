import { z } from 'zod';
import {
  CHAVES_IMPULSO,
  ENTRADA_SESSAO_MAX,
  IDS_ENTRADAS_SESSAO,
  INTENSIDADE_MAX,
  PROGRESSO_MAX,
  PROGRESSO_MIN,
  USO_HABILIDADE_MAX,
} from './catalogos';
import { DataLocalSchema, HorarioSchema, IdSchema, InstanteSchema, VersionadoSchema } from './comum';

export const TipoComportamentoSchema = z.enum(['impulso', 'alvo']);
export type TipoComportamento = z.infer<typeof TipoComportamentoSchema>;

export const NomeComportamentoSchema = z.string().trim().min(1, 'Dê um nome').max(60, 'Use até 60 caracteres');

/** Um item da lista do dia: impulso fixo do cartão ou comportamento-alvo da pessoa. */
export const ComportamentoSchema = VersionadoSchema.extend({
  id: IdSchema,
  tipo: TipoComportamentoSchema,
  /** Só nos impulsos fixos. */
  chave: z.enum(CHAVES_IMPULSO).optional(),
  nome: NomeComportamentoSchema,
  ordem: z.int().min(0),
  /** Aparece no registro do dia a partir desta data. */
  ativoDesde: DataLocalSchema,
  /** Arquivado: sai do registro do dia, mas o histórico continua nas exportações. */
  arquivadoEm: DataLocalSchema.optional(),
});
export type Comportamento = z.infer<typeof ComportamentoSchema>;

export const HabilidadeIdSchema = z.string().regex(/^[a-z0-9-]+\.[a-z0-9-]+$/, 'Habilidade inválida');

/**
 * Resposta de um comportamento num dia (I · A · H + habilidades).
 * A chave natural é `[data, comportamentoId]`: no máximo um por dia.
 * Item sem registro no dia conta como 0.
 */
export const RegistroSchema = VersionadoSchema.extend({
  data: DataLocalSchema,
  comportamentoId: IdSchema,
  /** I: intensidade do impulso, 0 a 5. */
  intensidade: z.int().min(0).max(INTENSIDADE_MAX),
  /** A: seguiu o impulso? */
  seguiu: z.boolean(),
  /** H: uso de habilidades, 0 a 7. */
  usoHabilidade: z.int().min(0).max(USO_HABILIDADE_MAX),
  habilidades: z.array(HabilidadeIdSchema),
});
export type Registro = z.infer<typeof RegistroSchema>;

/** Respostas do formulário, sem os campos de controle. */
export type RespostaRegistro = Pick<Registro, 'intensidade' | 'seguiu' | 'usoHabilidade' | 'habilidades'>;

/** Marca que o dia foi revisado ("Concluir"), mesmo sem nada marcado. */
export const DiaSchema = VersionadoSchema.extend({
  data: DataLocalSchema,
  concluidoEm: InstanteSchema.optional(),
});
export type Dia = z.infer<typeof DiaSchema>;

export const EntradasSessaoSchema = z.record(z.enum(IDS_ENTRADAS_SESSAO), z.int().min(0).max(ENTRADA_SESSAO_MAX));
export type EntradasSessao = z.infer<typeof EntradasSessaoSchema>;

/** Fechamento de uma semana (segunda a domingo), preenchido antes da sessão. */
export const FechamentoSchema = VersionadoSchema.extend({
  /** Segunda-feira da semana. */
  semanaInicio: DataLocalSchema,
  tarefaCasa: z.string().max(2000),
  resultadoTarefa: z.string().max(2000),
  /** −3 a +3; `null` enquanto não respondido. */
  progresso: z.int().min(PROGRESSO_MIN).max(PROGRESSO_MAX).nullable(),
  entradasSessao: EntradasSessaoSchema,
  notasTerapeuta: z.string().max(4000),
  /** Preenchido ao tocar "Salvar semana": a semana passa a contar como fechada. */
  fechadaEm: InstanteSchema.optional(),
});
export type Fechamento = z.infer<typeof FechamentoSchema>;

export const LembreteSchema = z.object({
  ativo: z.boolean(),
  horario: HorarioSchema,
});
export type Lembrete = z.infer<typeof LembreteSchema>;

export const PerfilSchema = z.object({
  nome: z.string().trim().min(1, 'Diga como quer ser chamado(a)').max(40),
  lembrete: LembreteSchema,
  contatoTerapeuta: z.string().max(40).optional(),
  onboardingConcluidoEm: InstanteSchema.optional(),
  ultimoBackupEm: InstanteSchema.optional(),
  atualizadoEm: InstanteSchema,
});
export type Perfil = z.infer<typeof PerfilSchema>;
