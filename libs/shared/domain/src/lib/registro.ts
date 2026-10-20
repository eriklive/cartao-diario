import {
  ESCALA_USO_HABILIDADE,
  LIMIAR_APOIO,
  USO_MINIMO_PARA_HABILIDADES,
  type Comportamento,
  type RespostaRegistro,
} from '@cartao/shared/models';

export const RESPOSTA_EM_BRANCO: Readonly<RespostaRegistro> = Object.freeze({
  intensidade: 0,
  seguiu: false,
  usoHabilidade: 0,
  habilidades: [],
});

export function podeResponderSeguiu(r: Pick<RespostaRegistro, 'intensidade'>): boolean {
  return r.intensidade > 0;
}

export function podeEscolherHabilidades(r: Pick<RespostaRegistro, 'intensidade' | 'usoHabilidade'>): boolean {
  return r.intensidade > 0 && r.usoHabilidade >= USO_MINIMO_PARA_HABILIDADES;
}

/**
 * Aplica as regras do formulário antes de gravar:
 * intensidade 0 zera o resto; H abaixo de 4 limpa as habilidades.
 */
export function normalizarResposta(r: RespostaRegistro): RespostaRegistro {
  if (r.intensidade <= 0) return { ...RESPOSTA_EM_BRANCO, habilidades: [] };
  return {
    intensidade: r.intensidade,
    seguiu: r.seguiu,
    usoHabilidade: r.usoHabilidade,
    habilidades: podeEscolherHabilidades(r) ? [...new Set(r.habilidades)] : [],
  };
}

/** Apoio em destaque: "Me matar" com intensidade alta. */
export function exigeApoio(r: Pick<RespostaRegistro, 'intensidade'>, c: Pick<Comportamento, 'chave'>): boolean {
  return c.chave === 'me-matar' && r.intensidade >= LIMIAR_APOIO;
}

export function rotuloUsoHabilidade(valor: number): string {
  return ESCALA_USO_HABILIDADE[valor]?.rotulo ?? String(valor);
}

/** Linha de resumo da lista do dia. */
export function resumirResposta(r: RespostaRegistro | undefined): string {
  if (!r) return 'Não registrado · conta como 0';
  if (r.intensidade === 0) return 'Impulso 0 · sem impulso';
  const n = r.habilidades.length;
  const habilidades = n ? `${n} ${n === 1 ? 'habilidade' : 'habilidades'}` : rotuloUsoHabilidade(r.usoHabilidade);
  return `Impulso ${r.intensidade} · ${r.seguiu ? 'seguiu' : 'não seguiu'} · ${habilidades}`;
}
