// Executa squad.mjs contra uma API do GitHub falsa (REST + GraphQL) e confere os efeitos.
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, beforeEach, test } from 'node:test';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const SCRIPT = new URL('./squad.mjs', import.meta.url).pathname;
const dir = mkdtempSync(join(tmpdir(), 'squad-'));

let issues;
let chamadas;
let quadro;
let servidor;
let api;

const labels = (...nomes) => nomes.map((name) => ({ name }));

function estado() {
  issues = new Map();
  chamadas = [];
  quadro = new Map(); // nodeId da issue -> coluna
  const add = (number, nomes, body = '', state = 'open') =>
    issues.set(number, { number, node_id: `I_${number}`, labels: labels(...nomes), body, state, comments: [] });
  add(1, ['tipo:pedido', 'etapa:em-andamento']);
  add(2, ['tipo:feature', 'etapa:em-andamento'], '<!-- squad:pai=1 -->');
  add(10, ['tipo:historia', 'etapa:em-revisao'], '<!-- squad:pai=2 -->');
  add(11, ['tipo:historia', 'etapa:backlog'], '<!-- squad:pai=2 -->\n<!-- squad:depende=10 -->');
  add(20, ['tipo:feature', 'etapa:discovery'], '<!-- squad:pai=1 -->');
}

const OPCOES = [
  'Pedidos',
  'Discovery',
  'UX',
  'Refinamento',
  'Em andamento',
  'Backlog técnico',
  'Pronto p/ dev',
  'Em revisão',
  'Concluído',
];

function responder(req, corpo) {
  const url = new URL(req.url, 'http://x');
  const caminho = url.pathname;
  chamadas.push(`${req.method} ${caminho}`);
  let m;
  if (caminho === '/graphql') {
    const { query, variables } = corpo;
    if (query.includes('repositoryOwner'))
      return {
        data: {
          repositoryOwner: {
            projectV2: { id: 'P1', field: { id: 'F1', options: OPCOES.map((n) => ({ id: n, name: n })) } },
          },
        },
      };
    if (query.includes('addProjectV2ItemById'))
      return { data: { addProjectV2ItemById: { item: { id: `item_${variables.c}` } } } };
    if (query.includes('updateProjectV2ItemFieldValue')) {
      quadro.set(variables.i.replace('item_', ''), variables.o);
      return { data: { updateProjectV2ItemFieldValue: { projectV2Item: { id: variables.i } } } };
    }
    if (query.includes('items(first'))
      return {
        data: {
          node: {
            items: {
              pageInfo: { hasNextPage: false, endCursor: null },
              nodes: [
                {
                  // issue 20 movida no quadro para UX depois da última troca de rótulo
                  fieldValueByName: { name: 'UX', updatedAt: '2026-11-12T10:10:00Z' },
                  content: {
                    number: 20,
                    state: 'OPEN',
                    repository: { nameWithOwner: 'eu/repo' },
                    labels: { nodes: issues.get(20).labels },
                    timelineItems: {
                      nodes: [{ createdAt: '2026-11-12T10:00:00Z', label: { name: 'etapa:discovery' } }],
                    },
                  },
                },
              ],
            },
          },
        },
      };
  }
  if (req.method === 'GET' && caminho === '/repos/eu/repo/issues') {
    const pagina = Number(url.searchParams.get('page'));
    return pagina === 1 ? [...issues.values()] : [];
  }
  if ((m = /^\/repos\/eu\/repo\/issues\/(\d+)$/.exec(caminho))) {
    const i = issues.get(Number(m[1]));
    if (req.method === 'PATCH') Object.assign(i, corpo);
    return i;
  }
  if ((m = /^\/repos\/eu\/repo\/issues\/(\d+)\/labels$/.exec(caminho))) {
    const i = issues.get(Number(m[1]));
    i.labels.push(...labels(...corpo.labels));
    return i.labels;
  }
  if ((m = /^\/repos\/eu\/repo\/issues\/(\d+)\/labels\/(.+)$/.exec(caminho))) {
    const i = issues.get(Number(m[1]));
    const nome = decodeURIComponent(m[2]);
    i.labels = i.labels.filter((l) => l.name !== nome);
    return i.labels;
  }
  if ((m = /^\/repos\/eu\/repo\/issues\/(\d+)\/comments$/.exec(caminho))) {
    issues.get(Number(m[1])).comments.push(corpo.body);
    return {};
  }
  return null;
}

before(async () => {
  servidor = createServer((req, res) => {
    let dados = '';
    req.on('data', (d) => (dados += d));
    req.on('end', () => {
      const r = responder(req, dados ? JSON.parse(dados) : null);
      res.writeHead(r === null ? 404 : 200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(r ?? { message: 'Not Found' }));
    });
  });
  await new Promise((ok) => servidor.listen(0, ok));
  api = `http://127.0.0.1:${servidor.address().port}`;
});
after(() => servidor.close());
beforeEach(estado);

async function rodar(args, extra = {}) {
  const saida = join(dir, `out-${Math.random()}`);
  writeFileSync(saida, '');
  await exec('node', [SCRIPT, ...args], {
    env: {
      ...process.env,
      GITHUB_API_URL: api,
      GITHUB_REPOSITORY: 'eu/repo',
      GITHUB_OUTPUT: saida,
      SQUAD_GH_TOKEN: 'x',
      SQUAD_PROJECT_NUMBER: '1',
      ...extra,
    },
  });
  const out = {};
  const linhas = readFileSync(saida, 'utf8').split('\n');
  for (let k = 0; k < linhas.length; k++) {
    const m = /^(\w+)<<(\S+)$/.exec(linhas[k]);
    if (!m) continue;
    const fim = linhas.indexOf(m[2], k + 1);
    out[m[1]] = linhas.slice(k + 1, fim).join('\n');
    k = fim;
  }
  return out;
}

function evento(nome, payload) {
  const caminho = join(dir, `ev-${Math.random()}.json`);
  writeFileSync(caminho, JSON.stringify(payload));
  return { GITHUB_EVENT_NAME: nome, GITHUB_EVENT_PATH: caminho };
}

const nomes = (n) => issues.get(n).labels.map((l) => l.name);

test('rota: rótulo etapa:ux sincroniza o quadro e devolve o agente CX', async () => {
  issues.get(20).labels = labels('tipo:feature', 'etapa:ux');
  const out = await rodar(['rota'], {
    SQUAD_ATIVO: 'true',
    ...evento('issues', { action: 'labeled', label: { name: 'etapa:ux' }, issue: { ...issues.get(20) } }),
  });
  assert.equal(out.agente, 'cx');
  assert.equal(out.modo, 'ux');
  assert.equal(out.numero, '20');
  assert.equal(quadro.get('I_20'), 'UX');
});

test('rota: sem SQUAD_ATIVO não chama agente, mas sincroniza', async () => {
  const out = await rodar(
    ['rota'],
    evento('issues', { action: 'labeled', label: { name: 'etapa:discovery' }, issue: issues.get(20) }),
  );
  assert.equal(out.agente, undefined);
  assert.equal(quadro.get('I_20'), 'Discovery');
});

test('pós-agente: discovery ok avança para ux; no modo manual aguarda aprovação', async () => {
  const resultado = join(dir, 'r.json');
  writeFileSync(resultado, JSON.stringify({ status: 'ok', resumo: 'feito' }));
  const base = {
    NUMERO: '20',
    ALVO: 'issue',
    ETAPA: 'discovery',
    MODO: 'discovery',
    AGENTE: 'pm',
    RESULTADO: resultado,
  };
  await rodar(['pos-agente'], { ...base, SQUAD_MODO: 'auto' });
  assert.deepEqual(nomes(20), ['tipo:feature', 'etapa:ux']);

  estado();
  await rodar(['pos-agente'], { ...base, SQUAD_MODO: 'manual' });
  assert.ok(nomes(20).includes('squad:aguardando-aprovacao'));
  assert.ok(nomes(20).includes('etapa:discovery'));
  assert.match(issues.get(20).comments[0], /\/aprovar/);
});

test('pós-agente: bloqueado põe o rótulo e lista as perguntas', async () => {
  const resultado = join(dir, 'b.json');
  writeFileSync(resultado, JSON.stringify({ status: 'bloqueado', perguntas: ['PDF ou planilha?'] }));
  await rodar(['pos-agente'], {
    NUMERO: '20',
    ALVO: 'issue',
    ETAPA: 'discovery',
    MODO: 'discovery',
    AGENTE: 'pm',
    RESULTADO: resultado,
  });
  assert.ok(nomes(20).includes('squad:bloqueado'));
  assert.match(issues.get(20).comments[0], /1\. PDF ou planilha\?/);
});

test('concluir: libera a dependente, e o pai fecha quando todas as filhas fecham', async () => {
  issues.get(10).state = 'closed';
  await rodar(['rota'], evento('issues', { action: 'closed', issue: issues.get(10) }));
  assert.deepEqual(nomes(10), ['tipo:historia', 'etapa:concluido']);
  assert.deepEqual(nomes(11), ['tipo:historia', 'etapa:pronto-dev']);
  assert.equal(issues.get(2).state, 'open');

  issues.get(11).state = 'closed';
  await rodar(['rota'], evento('issues', { action: 'closed', issue: issues.get(11) }));
  assert.equal(issues.get(2).state, 'closed');
  assert.equal(issues.get(2).state_reason, 'completed');
  // o pedido (#1) ainda tem a feature #20 aberta
  assert.equal(issues.get(1).state, 'open');
});

test('reconciliar: cartão movido no quadro muda o rótulo', async () => {
  await rodar(['reconciliar']);
  assert.deepEqual(nomes(20), ['tipo:feature', 'etapa:ux']);
});

test('/aprovar avança a etapa', async () => {
  issues.get(20).labels.push({ name: 'squad:aguardando-aprovacao' });
  await rodar(
    ['rota'],
    evento('issue_comment', {
      action: 'created',
      comment: { body: '/aprovar', author_association: 'OWNER' },
      issue: issues.get(20),
    }),
  );
  assert.deepEqual(nomes(20), ['tipo:feature', 'etapa:ux']);
});
