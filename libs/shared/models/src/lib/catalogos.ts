/** Comportamentos-alvo ativos ao mesmo tempo, como no cartão de papel. */
export const LIMITE_ALVOS = 7;

/** Quantos dias para trás ainda dá para preencher. */
export const JANELA_EDICAO_DIAS = 6;

/** Intensidade de "Me matar" a partir da qual o apoio aparece em destaque. */
export const LIMIAR_APOIO = 4;

/** Intensidade destacada nas exportações. */
export const LIMIAR_DESTAQUE = 3;

/** Nível de uso a partir do qual a pessoa escolhe quais habilidades usou. */
export const USO_MINIMO_PARA_HABILIDADES = 4;

export const INTENSIDADE_MAX = 5;
export const USO_HABILIDADE_MAX = 7;
export const ENTRADA_SESSAO_MAX = 5;
export const PROGRESSO_MIN = -3;
export const PROGRESSO_MAX = 3;

export const CHAVES_IMPULSO = ['me-matar', 'me-ferir', 'usar-drogas'] as const;
export type ChaveImpulso = (typeof CHAVES_IMPULSO)[number];

export const IMPULSOS_FIXOS: readonly { chave: ChaveImpulso; nome: string }[] = [
  { chave: 'me-matar', nome: 'Me matar' },
  { chave: 'me-ferir', nome: 'Me ferir' },
  { chave: 'usar-drogas', nome: 'Usar drogas' },
];

/** Escala H (uso de habilidades), 0 a 7, com rótulo completo e curto. */
export const ESCALA_USO_HABILIDADE: readonly { valor: number; rotulo: string; curto: string }[] = [
  { valor: 0, rotulo: 'Não pensei', curto: 'Não pensei' },
  { valor: 1, rotulo: 'Pensei, não usei, não quis usar', curto: 'Pensei, não usei, não quis' },
  { valor: 2, rotulo: 'Pensei, não usei, mas gostaria', curto: 'Pensei, não usei, gostaria' },
  { valor: 3, rotulo: 'Tentei, mas não consegui usar', curto: 'Tentei, não consegui' },
  { valor: 4, rotulo: 'Tentei, usei, mas não funcionou', curto: 'Tentei, usei, não funcionou' },
  { valor: 5, rotulo: 'Tentei, usei, ajudaram', curto: 'Tentei, usei, ajudaram' },
  { valor: 6, rotulo: 'Usei automaticamente, não ajudou', curto: 'Automático, não ajudou' },
  { valor: 7, rotulo: 'Usei automaticamente, ajudou', curto: 'Automático, ajudou' },
];

export const ENTRADAS_SESSAO = [
  { id: 'deixar-terapia', rotulo: 'Impulso de deixar a terapia' },
  { id: 'fazer-melhor', rotulo: 'Acredito que posso fazer melhor' },
  { id: 'faltar-sessao', rotulo: 'Impulso de faltar na sessão' },
  { id: 'ocultar-mentir', rotulo: 'Impulso de ocultar / mentir' },
  { id: 'emocoes', rotulo: 'Emoções' },
  { id: 'acoes', rotulo: 'Ações' },
  { id: 'pensamentos', rotulo: 'Pensamentos' },
] as const;
export type EntradaSessaoId = (typeof ENTRADAS_SESSAO)[number]['id'];
export const IDS_ENTRADAS_SESSAO = ENTRADAS_SESSAO.map((e) => e.id) as [EntradaSessaoId, ...EntradaSessaoId[]];

export interface Habilidade {
  /** `modulo.habilidade`, estável: é o que fica gravado. */
  id: string;
  nome: string;
  moduloId: string;
}

export interface ModuloHabilidades {
  id: string;
  nome: string;
  habilidades: readonly Habilidade[];
}

function modulo(id: string, nome: string, habilidades: [string, string][]): ModuloHabilidades {
  return {
    id,
    nome,
    habilidades: habilidades.map(([slug, nomeHabilidade]) => ({
      id: `${id}.${slug}`,
      nome: nomeHabilidade,
      moduloId: id,
    })),
  };
}

export const MODULOS_HABILIDADES: readonly ModuloHabilidades[] = [
  modulo('atencao-plena', 'Atenção Plena', [
    ['mente-sabia', 'Mente Sábia'],
    ['observe', 'Observe'],
    ['descreva', 'Descreva'],
    ['participe', 'Participe'],
    ['nao-julgamento', 'Não julgamento'],
    ['uma-coisa-por-vez', 'Uma coisa por vez'],
    ['ser-efetivo', 'Ser efetivo'],
    ['outra', 'Outra'],
  ]),
  modulo('caminho-do-meio', 'Caminho do Meio', [
    ['dialeticas', 'Dialéticas'],
    ['validacao', 'Validação'],
    ['aumentar-comportamento', 'Aumentar o comportamento'],
    ['diminuir-comportamento', 'Diminuir o comportamento'],
    ['outra', 'Outra'],
  ]),
  modulo('tolerancia', 'Tolerância ao Mal-estar', [
    ['tip', 'TIP'],
    ['distraindo-se', 'Distraindo-se'],
    ['autoacalmando-se', 'Autoacalmando-se'],
    ['melhore-o-momento', 'Melhore o Momento (IMPROVE)'],
    ['aceitacao-radical', 'Aceitação Radical'],
    ['estar-disposto', 'Estar Disposto'],
    ['meio-sorriso', 'Meio Sorriso, Mãos Dispostas'],
    ['mindfulness-pensamentos', 'Mindfulness dos Pensamentos'],
    ['outra', 'Outra'],
  ]),
  modulo('regulacao', 'Regulação Emocional', [
    ['verificar-fatos', 'Verificar os Fatos'],
    ['acao-oposta', 'Ação Oposta'],
    ['resolucao-problemas', 'Resolução de Problemas'],
    ['abc-saber', 'ABC SABER'],
    ['construir-maestria', 'Construir Maestria'],
    ['antecipacao', 'Antecipação'],
    ['mindfulness-emocoes', 'Mindfulness das Emoções'],
    ['outra', 'Outra'],
  ]),
  modulo('interpessoal', 'Efetividade Interpessoal', [
    ['clarificando-objetivos', 'Clarificando Objetivos'],
    ['dear', 'DEAR'],
    ['man', 'MAN'],
    ['give', 'GIVE'],
    ['fast', 'FAST'],
    ['outra', 'Outra'],
  ]),
];

const HABILIDADES_POR_ID = new Map<string, Habilidade>(
  MODULOS_HABILIDADES.flatMap((m) => m.habilidades.map((h) => [h.id, h] as const)),
);
const MODULOS_POR_ID = new Map(MODULOS_HABILIDADES.map((m) => [m.id, m] as const));

export function buscarHabilidade(id: string): Habilidade | undefined {
  return HABILIDADES_POR_ID.get(id);
}

/** Nome para exibir; "Outra" leva o módulo junto, como no papel. Ids desconhecidos aparecem como estão. */
export function nomeHabilidade(id: string): string {
  const h = HABILIDADES_POR_ID.get(id);
  if (!h) return id;
  if (h.id.endsWith('.outra')) return `Outra (${MODULOS_POR_ID.get(h.moduloId)?.nome ?? h.moduloId})`;
  return h.nome;
}
