import { z } from 'zod';

/** Data de calendário no fuso do usuário, `AAAA-MM-DD`. Nunca `Date`/UTC. */
export const DataLocalSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/, 'Data inválida (AAAA-MM-DD)');
export type DataLocal = z.infer<typeof DataLocalSchema>;

/** Instante ISO 8601 (ex.: `2026-10-18T21:04:00.000Z`). */
export const InstanteSchema = z.iso.datetime({ offset: true });
export type Instante = z.infer<typeof InstanteSchema>;

/** Horário `HH:mm`. */
export const HorarioSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Horário inválido (HH:mm)');
export type Horario = z.infer<typeof HorarioSchema>;

export const IdSchema = z.uuid();
export type Id = z.infer<typeof IdSchema>;

/**
 * Campos de controle de versão presentes em tudo que é persistido.
 * `removidoEm` é uma lápide: o item some das telas, mas continua
 * existindo para a sincronização futura.
 */
export const VersionadoSchema = z.object({
  criadoEm: InstanteSchema,
  atualizadoEm: InstanteSchema,
  removidoEm: InstanteSchema.optional(),
});
export type Versionado = z.infer<typeof VersionadoSchema>;
