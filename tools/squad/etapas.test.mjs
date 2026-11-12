// node --test tools/squad
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  COLUNAS,
  decidirPosAgente,
  decidirReconciliacao,
  decidirRota,
  desbloqueadas,
  etapaAtual,
  interpretarComando,
  lerMarcador,
} from './etapas.mjs';

const issue = (numero, labels = [], extra = {}) => ({
  number: numero,
  state: 'open',
  labels: labels.map((name) => ({ name })),
  ...extra,
});

test('colunas na ordem do fluxo', () => {
  assert.deepEqual(COLUNAS, [
    'Pedidos',
    'Discovery',
    'UX',
    'Refinamento',
    'Em andamento',
    'Backlog técnico',
    'Pronto p/ dev',
    'Em revisão',
    'Concluído',
  ]);
});

test('etapa atual ignora rótulos que não são de etapa', () => {
  assert.equal(etapaAtual([{ name: 'tipo:feature' }, { name: 'etapa:ux' }]), 'ux');
  assert.equal(etapaAtual([{ name: 'etapa:inexistente' }]), null);
});

test('marcadores ocultos', () => {
  const corpo = 'texto\n<!-- squad:pai=12 -->\n<!-- squad:depende=#3, 4 -->';
  assert.deepEqual(lerMarcador(corpo, 'pai'), [12]);
  assert.deepEqual(lerMarcador(corpo, 'depende'), [3, 4]);
  assert.deepEqual(lerMarcador('nada', 'pai'), []);
});

test('comandos', () => {
  assert.deepEqual(interpretarComando('/refazer use cards maiores\nobrigado'), {
    comando: 'refazer',
    texto: 'use cards maiores\nobrigado',
  });
  assert.deepEqual(interpretarComando('  /aprovar'), { comando: 'aprovar', texto: '' });
  assert.equal(interpretarComando('ok /aprovar'), null);
  assert.equal(interpretarComando('/deploy'), null);
});

test('rótulo de etapa com agente dispara o agente e sincroniza o quadro', () => {
  const acoes = decidirRota('issues', {
    action: 'labeled',
    label: { name: 'etapa:ux' },
    issue: issue(7, ['tipo:feature', 'etapa:ux']),
  });
  assert.deepEqual(acoes, [
    { tipo: 'sincronizar', numero: 7 },
    { tipo: 'agente', agente: 'cx', modo: 'ux', numero: 7, etapa: 'ux', alvo: 'issue' },
  ]);
});

test('issue pausada só sincroniza', () => {
  const acoes = decidirRota('issues', {
    action: 'labeled',
    label: { name: 'etapa:discovery' },
    issue: issue(7, ['etapa:discovery', 'squad:pausado']),
  });
  assert.deepEqual(acoes, [{ tipo: 'sincronizar', numero: 7 }]);
});

test('rótulos que não são de etapa não fazem nada', () => {
  assert.deepEqual(decidirRota('issues', { action: 'labeled', label: { name: 'tipo:feature' }, issue: issue(1) }), []);
});

test('fechar issue conclui', () => {
  assert.deepEqual(decidirRota('issues', { action: 'closed', issue: issue(3) }), [{ tipo: 'concluir', numero: 3 }]);
});

test('PR com rótulo squad chama a revisão do tech lead', () => {
  const [a] = decidirRota('pull_request', {
    action: 'labeled',
    label: { name: 'squad' },
    pull_request: { number: 9, state: 'open', head: { ref: 'squad/5-x' } },
  });
  assert.equal(a.agente, 'tech-lead');
  assert.equal(a.modo, 'revisao');
  assert.equal(a.ref, 'squad/5-x');
});

const comentario = (body, issueObj, author_association = 'OWNER') => ({
  action: 'created',
  comment: { body, author_association },
  issue: issueObj,
});

test('/aprovar avança para a próxima etapa', () => {
  assert.deepEqual(decidirRota('issue_comment', comentario('/aprovar', issue(4, ['etapa:discovery']))), [
    { tipo: 'avancar', numero: 4, para: 'ux' },
  ]);
});

test('/refazer roda de novo o agente da etapa com a instrução', () => {
  const acoes = decidirRota('issue_comment', comentario('/refazer foque no iPhone', issue(4, ['etapa:ux'])));
  assert.equal(acoes[1].agente, 'cx');
  assert.equal(acoes[1].instrucao, 'foque no iPhone');
});

test('comando de quem não é colaborador é ignorado', () => {
  assert.deepEqual(decidirRota('issue_comment', comentario('/aprovar', issue(4, ['etapa:ux']), 'NONE')), []);
});

test('/corrigir só vale em PR', () => {
  assert.deepEqual(decidirRota('issue_comment', comentario('/corrigir x', issue(4))), []);
  const [a] = decidirRota('issue_comment', comentario('/corrigir x', issue(4, [], { pull_request: {} })));
  assert.equal(a.agente, 'fullstack');
  assert.equal(a.modo, 'correcao');
});

test('pós-agente: avança, aguarda ou bloqueia', () => {
  const ok = { status: 'ok' };
  assert.deepEqual(decidirPosAgente({ alvo: 'issue', etapa: 'discovery', resultado: ok, modoSquad: 'auto' }), {
    tipo: 'avancar',
    para: 'ux',
  });
  assert.deepEqual(decidirPosAgente({ alvo: 'issue', etapa: 'discovery', resultado: ok, modoSquad: 'manual' }), {
    tipo: 'aguardar',
    proxima: 'ux',
  });
  // refinamento só cria histórias: segue mesmo no manual
  assert.equal(
    decidirPosAgente({ alvo: 'issue', etapa: 'refinamento', resultado: ok, modoSquad: 'manual' }).tipo,
    'avancar',
  );
  assert.equal(
    decidirPosAgente({ alvo: 'issue', etapa: 'ux', resultado: { status: 'bloqueado', perguntas: ['a?'] } }).tipo,
    'bloquear',
  );
  // sem arquivo de resultado conta como ok
  assert.equal(decidirPosAgente({ alvo: 'issue', etapa: 'pronto-dev', resultado: null }).para, 'em-revisao');
});

test('pós-revisão: uma rodada automática de correção', () => {
  const base = { alvo: 'pr', modo: 'revisao', resultado: { status: 'mudancas' }, modoSquad: 'auto' };
  assert.equal(decidirPosAgente(base).tipo, 'auto-corrigir');
  assert.equal(decidirPosAgente({ ...base, rotulosPr: [{ name: 'squad:auto-corrigido' }] }).tipo, 'nada');
  assert.equal(decidirPosAgente({ ...base, modoSquad: 'manual' }).tipo, 'nada');
});

test('reconciliação: vale quem mudou por último', () => {
  const r = (o) => decidirReconciliacao({ etapaRotulo: 'discovery', coluna: 'UX', ...o });
  assert.equal(r({ colunaEm: '2026-11-12T10:05:00Z', rotuloEm: '2026-11-12T10:00:00Z' }), 'rotulo');
  assert.equal(r({ colunaEm: '2026-11-12T10:00:00Z', rotuloEm: '2026-11-12T10:05:00Z' }), 'quadro');
  assert.equal(decidirReconciliacao({ etapaRotulo: 'ux', coluna: 'UX' }), null);
  assert.equal(decidirReconciliacao({ etapaRotulo: null, coluna: 'Pedidos', colunaEm: 'x' }), 'rotulo');
  assert.equal(decidirReconciliacao({ etapaRotulo: 'ux', coluna: undefined }), 'quadro');
});

test('histórias em backlog liberadas quando as dependências fecham', () => {
  const lista = [
    { number: 1, state: 'closed', labels: [], body: '' },
    { number: 2, state: 'open', labels: [{ name: 'etapa:pronto-dev' }], body: '' },
    { number: 3, state: 'open', labels: [{ name: 'etapa:backlog' }], body: '<!-- squad:depende=1 -->' },
    { number: 4, state: 'open', labels: [{ name: 'etapa:backlog' }], body: '<!-- squad:depende=1,2 -->' },
  ];
  assert.deepEqual(
    desbloqueadas(lista).map((i) => i.number),
    [3],
  );
});
