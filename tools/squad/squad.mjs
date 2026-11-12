#!/usr/bin/env node
// Executor do fluxo da squad, chamado pelos workflows em .github/workflows/squad*.yml.
//
//   node tools/squad/squad.mjs rota          decide o que fazer com o evento atual (GITHUB_EVENT_*)
//   node tools/squad/squad.mjs prompt        monta o prompt do agente (env AGENTE, MODO, NUMERO...)
//   node tools/squad/squad.mjs pos-agente    transição de etapa depois que o agente termina
//   node tools/squad/squad.mjs falha         avisa na issue/PR que o agente falhou
//   node tools/squad/squad.mjs sincronizar N põe a issue N na coluna certa do quadro
//   node tools/squad/squad.mjs reconciliar   quadro -> rótulos (cartões movidos à mão no quadro)
//
// Variáveis: SQUAD_GH_TOKEN (PAT), GITHUB_REPOSITORY, SQUAD_PROJECT_NUMBER, SQUAD_PROJECT_OWNER,
// SQUAD_PROJECT_FIELD (padrão "Etapa"), SQUAD_MODO (auto | manual).

import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { criarCliente } from './github.mjs';
import {
  ETAPAS,
  PREFIXO_ETAPA,
  ROTULOS,
  decidirPosAgente,
  decidirReconciliacao,
  decidirRota,
  desbloqueadas,
  etapaAtual,
  etapaDoRotulo,
  lerMarcador,
  rotuloDaEtapa,
} from './etapas.mjs';

const env = process.env;
const REPO = env.GITHUB_REPOSITORY;
const MARCA_BOT = '<!-- squad:bot -->';
const urlDoRun = () =>
  env.GITHUB_RUN_ID ? `${env.GITHUB_SERVER_URL}/${REPO}/actions/runs/${env.GITHUB_RUN_ID}` : '(local)';

function saida(chave, valor) {
  const texto = String(valor ?? '');
  if (!env.GITHUB_OUTPUT) return console.log(`${chave}=${texto}`);
  const delim = `FIM_${Math.random().toString(36).slice(2)}`;
  appendFileSync(env.GITHUB_OUTPUT, `${chave}<<${delim}\n${texto}\n${delim}\n`);
}

const gh = () => criarCliente({ token: env.SQUAD_GH_TOKEN, repo: REPO });

// ---------- issues e rótulos ----------

async function comentar(c, numero, texto) {
  await c.rest('POST', `/{repo}/issues/${numero}/comments`, { body: `${texto}\n\n${MARCA_BOT}` });
}

async function mudarRotulos(c, numero, { adicionar = [], remover = [] }) {
  for (const nome of remover) {
    await c.rest('DELETE', `/{repo}/issues/${numero}/labels/${encodeURIComponent(nome)}`).catch((e) => {
      if (e.status !== 404) throw e;
    });
  }
  if (adicionar.length) await c.rest('POST', `/{repo}/issues/${numero}/labels`, { labels: adicionar });
}

/** Troca a etapa: tira os outros rótulos etapa:* e os de espera, põe o novo (isso dispara o próximo agente). */
async function avancar(c, numero, para) {
  const issue = await c.rest('GET', `/{repo}/issues/${numero}`);
  const nomes = issue.labels.map((l) => l.name);
  const novo = rotuloDaEtapa(para);
  const remover = nomes.filter(
    (n) => (n.startsWith(PREFIXO_ETAPA) && n !== novo) || n === ROTULOS.aguardando || n === ROTULOS.bloqueado,
  );
  await mudarRotulos(c, numero, { remover, adicionar: nomes.includes(novo) ? [] : [novo] });
  console.log(`#${numero}: etapa -> ${para}`);
}

async function concluir(c, numero) {
  const issue = await c.rest('GET', `/{repo}/issues/${numero}`);
  if (issue.pull_request) return;
  if (issue.state_reason === 'not_planned') return;
  await avancar(c, numero, 'concluido');

  const todas = (await c.paginar('/{repo}/issues?state=all')).filter((i) => !i.pull_request);

  for (const h of desbloqueadas(todas)) {
    await avancar(c, h.number, 'pronto-dev');
    await comentar(
      c,
      h.number,
      `Dependências concluídas (a última foi #${numero}). História liberada para desenvolvimento.`,
    );
  }

  for (const pai of lerMarcador(issue.body, 'pai')) {
    const filhas = todas.filter((i) => lerMarcador(i.body, 'pai').includes(pai));
    const abertas = filhas.filter((i) => i.state === 'open');
    const issuePai = todas.find((i) => i.number === pai);
    if (!issuePai || issuePai.state !== 'open') continue;
    if (abertas.length) {
      console.log(`#${pai}: ainda faltam ${abertas.map((i) => `#${i.number}`).join(', ')}`);
      continue;
    }
    await comentar(c, pai, `Todos os itens filhos foram concluídos (${filhas.map((i) => `#${i.number}`).join(', ')}).`);
    await c.rest('PATCH', `/{repo}/issues/${pai}`, { state: 'closed', state_reason: 'completed' });
  }
}

// ---------- quadro (GitHub Projects) ----------

const FRAGMENTO_PROJETO = `projectV2(number: $numero) { id field(name: $campo) {
  ... on ProjectV2SingleSelectField { id options { id name } } } }`;

async function lerProjeto(c) {
  const numero = Number(env.SQUAD_PROJECT_NUMBER);
  if (!numero) return null;
  const dono = env.SQUAD_PROJECT_OWNER || c.dono;
  const campo = env.SQUAD_PROJECT_FIELD || 'Etapa';
  const dados = await c.graphql(
    `query($dono: String!, $numero: Int!, $campo: String!) { repositoryOwner(login: $dono) {
      ... on User { ${FRAGMENTO_PROJETO} } ... on Organization { ${FRAGMENTO_PROJETO} } } }`,
    { dono, numero, campo },
  );
  const p = dados.repositoryOwner?.projectV2;
  if (!p?.field?.id) throw new Error(`Projeto ${dono}#${numero} sem o campo de seleção "${campo}".`);
  return { id: p.id, campo, campoId: p.field.id, opcoes: new Map(p.field.options.map((o) => [o.name, o.id])) };
}

async function sincronizar(c, numero, projeto) {
  projeto ??= await lerProjeto(c);
  if (!projeto) return console.log('Quadro não configurado (SQUAD_PROJECT_NUMBER); nada a sincronizar.');
  const issue = await c.rest('GET', `/{repo}/issues/${numero}`);
  const etapa = etapaAtual(issue.labels);
  if (!etapa) return;
  const opcao = projeto.opcoes.get(ETAPAS[etapa].coluna);
  if (!opcao) throw new Error(`O campo "${projeto.campo}" não tem a opção "${ETAPAS[etapa].coluna}".`);
  const { addProjectV2ItemById } = await c.graphql(
    `mutation($p: ID!, $c: ID!) { addProjectV2ItemById(input: { projectId: $p, contentId: $c }) { item { id } } }`,
    { p: projeto.id, c: issue.node_id },
  );
  await c.graphql(
    `mutation($p: ID!, $i: ID!, $f: ID!, $o: String!) { updateProjectV2ItemFieldValue(input: {
      projectId: $p, itemId: $i, fieldId: $f, value: { singleSelectOptionId: $o } }) { projectV2Item { id } } }`,
    { p: projeto.id, i: addProjectV2ItemById.item.id, f: projeto.campoId, o: opcao },
  );
  console.log(`#${numero}: quadro -> ${ETAPAS[etapa].coluna}`);
}

async function reconciliar(c) {
  const projeto = await lerProjeto(c);
  if (!projeto) return console.log('Quadro não configurado; nada a reconciliar.');
  let depois = null;
  do {
    const { node } = await c.graphql(
      `query($id: ID!, $campo: String!, $depois: String) { node(id: $id) { ... on ProjectV2 {
        items(first: 100, after: $depois) { pageInfo { hasNextPage endCursor } nodes {
          fieldValueByName(name: $campo) { ... on ProjectV2ItemFieldSingleSelectValue { name updatedAt } }
          content { ... on Issue { number state repository { nameWithOwner } labels(first: 30) { nodes { name } }
            timelineItems(itemTypes: [LABELED_EVENT, UNLABELED_EVENT], last: 15) { nodes {
              ... on LabeledEvent { createdAt label { name } } ... on UnlabeledEvent { createdAt label { name } } } } } } } } } } }`,
      { id: projeto.id, campo: projeto.campo, depois },
    );
    for (const item of node.items.nodes) {
      const issue = item.content;
      if (!issue?.number || issue.repository.nameWithOwner !== REPO || issue.state !== 'OPEN') continue;
      const etapaRotulo = etapaAtual(issue.labels.nodes);
      const eventos = issue.timelineItems.nodes.filter((e) => etapaDoRotulo(e.label?.name));
      const decisao = decidirReconciliacao({
        etapaRotulo,
        coluna: item.fieldValueByName?.name,
        colunaEm: item.fieldValueByName?.updatedAt,
        rotuloEm: eventos.at(-1)?.createdAt,
      });
      if (decisao === 'quadro') await sincronizar(c, issue.number, projeto);
      if (decisao === 'rotulo') {
        const para = Object.keys(ETAPAS).find((id) => ETAPAS[id].coluna === item.fieldValueByName.name);
        console.log(`#${issue.number}: movida no quadro para "${item.fieldValueByName.name}"`);
        await avancar(c, issue.number, para);
      }
    }
    depois = node.items.pageInfo.hasNextPage ? node.items.pageInfo.endCursor : null;
  } while (depois);
}

// ---------- comandos ----------

async function rota() {
  const evento = env.GITHUB_EVENT_NAME;
  const payload = JSON.parse(readFileSync(env.GITHUB_EVENT_PATH, 'utf8'));
  const acoes = decidirRota(evento, payload);
  console.log(`Evento ${evento}.${payload.action}: ${JSON.stringify(acoes)}`);
  if (!acoes.length) return;
  if (!env.SQUAD_GH_TOKEN) {
    return console.log('::notice::Sem o secret SQUAD_GH_TOKEN: a squad no Actions está desligada.');
  }

  const c = gh();
  for (const a of acoes) {
    if (a.tipo === 'sincronizar') {
      await sincronizar(c, a.numero).catch((e) => console.log(`::warning::Quadro: ${e.message}`));
    } else if (a.tipo === 'rotulos') {
      await mudarRotulos(c, a.numero, a);
    } else if (a.tipo === 'avancar') {
      await avancar(c, a.numero, a.para);
    } else if (a.tipo === 'concluir') {
      await concluir(c, a.numero);
    } else if (a.tipo === 'agente') {
      if (env.SQUAD_ATIVO !== 'true') {
        console.log('::notice::SQUAD_ATIVO não é "true": agentes desligados no Actions (rode no Claude Code).');
        continue;
      }
      let ref = a.ref ?? '';
      if (a.alvo === 'pr' && !ref) ref = (await c.rest('GET', `/{repo}/pulls/${a.numero}`)).head.ref;
      for (const chave of ['agente', 'modo', 'numero', 'alvo', 'etapa', 'instrucao']) saida(chave, a[chave] ?? '');
      saida('ref', ref);
    }
  }
}

// Modelo e esforço vêm do cabeçalho YAML do agente (model/effort); "inherit" ou ausente = padrão.
function cabecalhoDoAgente(agente) {
  const arquivo = new URL(`../../.claude/agents/${agente}.md`, import.meta.url);
  if (!existsSync(arquivo)) return {};
  const bloco = /^---\n([\s\S]*?)\n---/.exec(readFileSync(arquivo, 'utf8'))?.[1] ?? '';
  const campo = (nome) => {
    const v = new RegExp(`^${nome}:\\s*(\\S+)\\s*$`, 'm').exec(bloco)?.[1];
    return v && v !== 'inherit' ? v : '';
  };
  return { modelo: campo('model'), esforco: campo('effort') };
}

function prompt() {
  const { AGENTE, MODO, NUMERO, ALVO, ETAPA, INSTRUCAO, RESULTADO } = env;
  const alvo = ALVO === 'pr' ? `o pull request #${NUMERO}` : `a issue #${NUMERO}`;
  const doAlvo = ALVO === 'pr' ? `do pull request #${NUMERO}` : `da issue #${NUMERO}`;
  const texto = `Você é o agente **${AGENTE}** da squad do Cartão Diário e está rodando no GitHub Actions, sem humano por perto.

1. Leia \`AGENTS.md\` (convenções do repositório e do fluxo da squad).
2. Leia \`.claude/agents/${AGENTE}.md\` e siga como as suas instruções (ignore o cabeçalho YAML).
3. Execute o **modo ${MODO}** para ${alvo} do repositório ${REPO}${ETAPA ? ` (etapa atual: ${ETAPA})` : ''}.
${INSTRUCAO ? `\nO humano pediu, ao refazer/corrigir:\n> ${INSTRUCAO.replace(/\n/g, '\n> ')}\nLeve isso em conta acima de tudo e leia os comentários mais recentes da issue/PR.\n` : ''}
Ambiente:
- Use o CLI \`gh\` (já autenticado) para ler e escrever no GitHub. Não há ferramentas MCP aqui.
- Não mude os rótulos \`etapa:*\` ${doAlvo}: o workflow faz a transição quando você terminar.
- Ao terminar, grave em \`${RESULTADO}\` um JSON: {"status": "ok" | "bloqueado" | "mudancas", "resumo": "uma frase", "perguntas": ["..."]}.
  Use "bloqueado" só quando faltar uma decisão do humano sem a qual não dá para seguir; ponha as perguntas na lista.
  "mudancas" é só para o modo revisao, quando o PR precisa de ajustes antes do merge.`;
  saida('texto', texto);
  const { modelo, esforco } = cabecalhoDoAgente(AGENTE);
  saida('modelo', modelo);
  saida('esforco', esforco);
}

async function posAgente() {
  const { NUMERO, ALVO, ETAPA, MODO, RESULTADO, AGENTE } = env;
  const resultado = RESULTADO && existsSync(RESULTADO) ? JSON.parse(readFileSync(RESULTADO, 'utf8')) : null;
  const c = gh();
  const numero = Number(NUMERO);
  const rotulosPr = ALVO === 'pr' ? (await c.rest('GET', `/{repo}/issues/${numero}`)).labels : [];
  const d = decidirPosAgente({ alvo: ALVO, etapa: ETAPA, modo: MODO, resultado, modoSquad: env.SQUAD_MODO, rotulosPr });
  console.log(`Resultado ${JSON.stringify(resultado)} -> ${JSON.stringify(d)}`);

  if (d.tipo === 'avancar') return avancar(c, numero, d.para);
  if (d.tipo === 'aguardar') {
    await mudarRotulos(c, numero, { adicionar: [ROTULOS.aguardando] });
    return comentar(
      c,
      numero,
      `**${AGENTE}** terminou a etapa **${ETAPAS[ETAPA].coluna}**. ${resultado?.resumo ?? ''}\n\n` +
        `Comente \`/aprovar\` para seguir para **${ETAPAS[d.proxima].coluna}**, ou \`/refazer <o que mudar>\`.`,
    );
  }
  if (d.tipo === 'bloquear') {
    await mudarRotulos(c, numero, { adicionar: [ROTULOS.bloqueado] });
    const perguntas = d.perguntas.map((p, i) => `${i + 1}. ${p}`).join('\n');
    return comentar(
      c,
      numero,
      `**${AGENTE}** precisa de uma decisão sua antes de seguir:\n\n${perguntas || resultado?.resumo || ''}\n\n` +
        `Responda com \`/refazer <suas respostas>\`.`,
    );
  }
  if (d.tipo === 'auto-corrigir') {
    await mudarRotulos(c, numero, { adicionar: [ROTULOS.autoCorrigido] });
    // Comentário do PAT começa com /corrigir: dispara o fullstack uma vez (o rótulo impede repetir).
    return c.rest('POST', `/{repo}/issues/${numero}/comments`, {
      body: '/corrigir Aplique os pontos da revisão do Tech Lead acima (rodada automática, só uma).',
    });
  }
}

async function falha() {
  await comentar(
    gh(),
    Number(env.NUMERO),
    `⚠️ O agente **${env.AGENTE}** (modo ${env.MODO}) falhou: ${urlDoRun()}\n\nComente \`/refazer\` para tentar de novo.`,
  );
}

const [comando, arg] = process.argv.slice(2);
const comandos = {
  rota,
  prompt: async () => prompt(),
  'pos-agente': posAgente,
  falha,
  sincronizar: () => sincronizar(gh(), Number(arg)),
  reconciliar: () => reconciliar(gh()),
};

if (!comandos[comando]) {
  console.error(`Uso: squad.mjs <${Object.keys(comandos).join(' | ')}>`);
  process.exit(2);
}
comandos[comando]().catch((e) => {
  console.error(e);
  process.exit(1);
});
