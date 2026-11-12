// Regras puras do fluxo da squad: etapas, colunas do quadro, comandos e rotas.
// Sem rede e sem dependências: é o que os testes (etapas.test.mjs) cobrem.

export const PREFIXO_ETAPA = 'etapa:';

export const ROTULOS = {
  pausado: 'squad:pausado',
  aguardando: 'squad:aguardando-aprovacao',
  bloqueado: 'squad:bloqueado',
  autoCorrigido: 'squad:auto-corrigido',
  pr: 'squad',
};

// Ordem = ordem das colunas no quadro.
export const ETAPAS = {
  pedido: { coluna: 'Pedidos', agente: 'pm', modo: 'intake', proxima: 'em-andamento' },
  discovery: { coluna: 'Discovery', agente: 'pm', modo: 'discovery', proxima: 'ux' },
  ux: { coluna: 'UX', agente: 'cx', modo: 'ux', proxima: 'refinamento' },
  refinamento: { coluna: 'Refinamento', agente: 'tech-lead', modo: 'refinamento', proxima: 'em-andamento' },
  'em-andamento': { coluna: 'Em andamento', agente: null, modo: null, proxima: null },
  backlog: { coluna: 'Backlog técnico', agente: null, modo: null, proxima: 'pronto-dev' },
  'pronto-dev': { coluna: 'Pronto p/ dev', agente: 'fullstack', modo: 'implementacao', proxima: 'em-revisao' },
  'em-revisao': { coluna: 'Em revisão', agente: null, modo: null, proxima: null },
  concluido: { coluna: 'Concluído', agente: null, modo: null, proxima: null },
};

export const COLUNAS = Object.values(ETAPAS).map((e) => e.coluna);

export const rotuloDaEtapa = (id) => `${PREFIXO_ETAPA}${id}`;

export function etapaDoRotulo(nome) {
  if (!nome?.startsWith(PREFIXO_ETAPA)) return null;
  const id = nome.slice(PREFIXO_ETAPA.length);
  return id in ETAPAS ? id : null;
}

const nomesDe = (labels = []) => labels.map((l) => (typeof l === 'string' ? l : l.name));

export function etapaAtual(labels) {
  for (const nome of nomesDe(labels)) {
    const id = etapaDoRotulo(nome);
    if (id) return id;
  }
  return null;
}

export const temRotulo = (labels, nome) => nomesDe(labels).includes(nome);

export function etapaDaColuna(coluna) {
  const alvo = coluna?.trim().toLowerCase();
  for (const [id, e] of Object.entries(ETAPAS)) if (e.coluna.toLowerCase() === alvo) return id;
  return null;
}

/** Marcadores ocultos no corpo da issue: <!-- squad:pai=12 --> e <!-- squad:depende=3,4 -->. */
export function lerMarcador(corpo, chave) {
  const m = new RegExp(`<!--\\s*squad:${chave}\\s*=\\s*([#\\d,\\s]+?)\\s*-->`, 'i').exec(corpo ?? '');
  if (!m) return [];
  return m[1]
    .split(',')
    .map((s) => Number(s.replace('#', '').trim()))
    .filter((n) => Number.isInteger(n) && n > 0);
}

const COMANDOS = ['aprovar', 'refazer', 'pausar', 'retomar', 'corrigir', 'revisar'];

/** Primeira linha do comentário no formato "/comando texto livre". */
export function interpretarComando(corpo) {
  const texto = (corpo ?? '').trim();
  const m = /^\/([a-zçã]+)\b[ \t]*([\s\S]*)$/i.exec(texto);
  if (!m) return null;
  const comando = m[1].toLowerCase();
  if (!COMANDOS.includes(comando)) return null;
  return { comando, texto: m[2].trim() };
}

const QUEM_PODE = ['OWNER', 'MEMBER', 'COLLABORATOR'];

/**
 * Decide o que fazer com um evento do GitHub. Devolve uma lista de ações para o executor
 * (squad.mjs). No máximo uma ação é do tipo "agente".
 */
export function decidirRota(evento, payload) {
  const acoes = [];

  if (evento === 'issues') {
    const issue = payload.issue;
    if (payload.action === 'closed') return [{ tipo: 'concluir', numero: issue.number }];
    if (payload.action !== 'labeled') return [];
    const etapa = etapaDoRotulo(payload.label?.name);
    if (!etapa) return [];
    acoes.push({ tipo: 'sincronizar', numero: issue.number });
    const def = ETAPAS[etapa];
    if (def.agente && issue.state === 'open' && !temRotulo(issue.labels, ROTULOS.pausado)) {
      acoes.push({ tipo: 'agente', agente: def.agente, modo: def.modo, numero: issue.number, etapa, alvo: 'issue' });
    }
    return acoes;
  }

  if (evento === 'pull_request') {
    const pr = payload.pull_request;
    if (payload.action === 'labeled' && payload.label?.name === ROTULOS.pr && pr.state === 'open') {
      acoes.push({
        tipo: 'agente',
        agente: 'tech-lead',
        modo: 'revisao',
        numero: pr.number,
        alvo: 'pr',
        ref: pr.head.ref,
      });
    }
    return acoes;
  }

  if (evento === 'issue_comment' && payload.action === 'created') {
    if (!QUEM_PODE.includes(payload.comment.author_association)) return [];
    const cmd = interpretarComando(payload.comment.body);
    if (!cmd) return [];
    const issue = payload.issue;
    const ehPr = Boolean(issue.pull_request);
    const etapa = etapaAtual(issue.labels);

    switch (cmd.comando) {
      case 'pausar':
        return [{ tipo: 'rotulos', numero: issue.number, adicionar: [ROTULOS.pausado], remover: [] }];
      case 'retomar':
        return [{ tipo: 'rotulos', numero: issue.number, adicionar: [], remover: [ROTULOS.pausado] }];
      case 'aprovar':
        if (ehPr || !etapa || !ETAPAS[etapa].proxima) return [];
        return [{ tipo: 'avancar', numero: issue.number, para: ETAPAS[etapa].proxima }];
      case 'refazer': {
        if (ehPr || !etapa || !ETAPAS[etapa].agente) return [];
        const def = ETAPAS[etapa];
        return [
          { tipo: 'rotulos', numero: issue.number, adicionar: [], remover: [ROTULOS.aguardando, ROTULOS.bloqueado] },
          {
            tipo: 'agente',
            agente: def.agente,
            modo: def.modo,
            numero: issue.number,
            etapa,
            alvo: 'issue',
            instrucao: cmd.texto,
          },
        ];
      }
      case 'corrigir':
        if (!ehPr) return [];
        return [
          {
            tipo: 'agente',
            agente: 'fullstack',
            modo: 'correcao',
            numero: issue.number,
            alvo: 'pr',
            instrucao: cmd.texto,
          },
        ];
      case 'revisar':
        if (!ehPr) return [];
        return [{ tipo: 'agente', agente: 'tech-lead', modo: 'revisao', numero: issue.number, alvo: 'pr' }];
    }
  }

  return [];
}

/**
 * O que fazer depois que um agente termina numa issue.
 * resultado: { status: 'ok' | 'bloqueado' | 'mudancas', resumo?, perguntas? } (ou null se o agente não gravou).
 */
export function decidirPosAgente({ alvo, etapa, modo, resultado, modoSquad, rotulosPr = [] }) {
  const status = resultado?.status ?? 'ok';

  if (alvo === 'pr') {
    if (
      modo === 'revisao' &&
      status === 'mudancas' &&
      modoSquad !== 'manual' &&
      !temRotulo(rotulosPr, ROTULOS.autoCorrigido)
    ) {
      return { tipo: 'auto-corrigir' };
    }
    return { tipo: 'nada' };
  }

  if (status === 'bloqueado') return { tipo: 'bloquear', perguntas: resultado?.perguntas ?? [] };
  const proxima = ETAPAS[etapa]?.proxima;
  if (!proxima) return { tipo: 'nada' };
  // O intake e o refinamento só criam issues filhas: seguir é automático mesmo no modo manual.
  if (modoSquad === 'manual' && !['pedido', 'refinamento'].includes(etapa)) return { tipo: 'aguardar', proxima };
  return { tipo: 'avancar', para: proxima };
}

/**
 * Quadro x rótulo, quando divergem: vale quem mudou por último.
 * Devolve 'rotulo' (o quadro manda, mudar o rótulo), 'quadro' (o rótulo manda) ou null.
 */
export function decidirReconciliacao({ etapaRotulo, coluna, colunaEm, rotuloEm }) {
  const etapaColuna = etapaDaColuna(coluna);
  if (etapaColuna === etapaRotulo) return null;
  if (!etapaColuna) return etapaRotulo ? 'quadro' : null;
  if (!etapaRotulo) return 'rotulo';
  if (!rotuloEm) return 'rotulo';
  if (!colunaEm) return 'quadro';
  return new Date(colunaEm) > new Date(rotuloEm) ? 'rotulo' : 'quadro';
}

/** Histórias em backlog cujas dependências já fecharam. */
export function desbloqueadas(issues) {
  const estado = new Map(issues.map((i) => [i.number, i.state]));
  return issues.filter(
    (i) =>
      i.state === 'open' &&
      etapaAtual(i.labels) === 'backlog' &&
      lerMarcador(i.body, 'depende').every((n) => estado.get(n) === 'closed'),
  );
}
