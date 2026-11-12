# AGENTS.md

Guia para agentes de código (Claude Code, Codex, Cursor e afins) que trabalham neste repositório. Para pessoas, comece pelo [`README.md`](README.md); o passo a passo de uso da squad está em [`docs/squad.md`](docs/squad.md).

## O projeto

Cartão Diário é um PWA para o cartão diário da Terapia Comportamental Dialética (DBT). Os dados ficam **só no aparelho** (IndexedDB): sem contas, servidor, analytics nem chamadas de rede. Funciona offline. Público: pessoas em tratamento, muitas vezes em sofrimento, então fricção, culpa e linguagem técnica pesam mais que em outros apps.

Monorepo Nx + pnpm:

- `apps/web`: Angular 22 (standalone, signals, zoneless) + service worker.
  - `core/dados`: `CartaoRepository` + `IndexedDbCartaoRepository` (Dexie). `CartaoStore` em signals; as telas só falam com o store.
  - `core/plataforma`: compartilhar/baixar, instalação, persistência, service worker, exportação, backup, lembrete.
  - `ui`: componentes da identidade **A · Névoa** (tokens em `src/styles.scss`). `features/<tela>`: uma pasta por tela.
- `apps/web-e2e`: Playwright (fluxos, axe, offline, exportação).
- `libs/shared/{models,domain,export}`: roda no navegador e no Node. **Não importa** Angular, NestJS, Dexie nem RxJS (o lint barra).
- `tools/`: servidor estático, gerador de ícones e `tools/squad` (automação da squad).

## Comandos

```sh
pnpm install
pnpm start                                            # dev em http://localhost:4200
pnpm exec nx affected -t lint typecheck test --base=origin/master
pnpm test | pnpm lint | pnpm e2e                      # tudo
CHROMIUM_PATH=/opt/pw-browsers/chromium pnpm e2e      # Chromium em outro caminho
pnpm test:squad                                       # testes da automação da squad
```

Branch padrão: `master`. Commits no estilo `feat: ...`, `fix: ...`, `test: ...`, `docs: ...`, em português. Textos de interface, documentação e issues em português do Brasil.

## Squad agêntica

Todo pedido de produto passa por uma squad de quatro agentes, definidos em [`.claude/agents/`](.claude/agents):

| Agente     | Arquivo        | Decide                                                          | Entrega                                                                      |
| ---------- | -------------- | --------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| PM         | `pm.md`        | o quê e por quê                                                 | intake: pedido → features (issues); discovery: problema, referências, regras |
| CX         | `cx.md`        | como a pessoa usa                                               | benchmark, fluxo, wireframes, caminho feliz, erros, estados, microcopy, a11y |
| Tech Lead  | `tech-lead.md` | como construir e em que ordem: **a quebra em histórias é dele** | desenho técnico, histórias com dependências (issues); revisão dos PRs        |
| Full stack | `fullstack.md` | nada de escopo: só implementa a história                        | código + testes + PR com o rótulo `squad`                                    |

### Etapas, rótulos e quadro

Os rótulos `etapa:*` são a fonte da verdade. O quadro (GitHub Projects, campo **Etapa**) espelha os rótulos, e cartões movidos à mão no quadro voltam para os rótulos em até ~10 minutos.

| Rótulo               | Coluna          | Quem trabalha         | Depois                                                        |
| -------------------- | --------------- | --------------------- | ------------------------------------------------------------- |
| `etapa:pedido`       | Pedidos         | PM (intake)           | pedido → `em-andamento`; features nascem em `discovery`       |
| `etapa:discovery`    | Discovery       | PM (discovery)        | `ux`                                                          |
| `etapa:ux`           | UX              | CX                    | `refinamento`                                                 |
| `etapa:refinamento`  | Refinamento     | Tech Lead             | feature → `em-andamento`; histórias em `pronto-dev`/`backlog` |
| `etapa:em-andamento` | Em andamento    | —                     | fecha sozinha quando todas as filhas fecham                   |
| `etapa:backlog`      | Backlog técnico | —                     | `pronto-dev` quando as dependências fecham                    |
| `etapa:pronto-dev`   | Pronto p/ dev   | Full stack            | `em-revisao` (PR aberto)                                      |
| `etapa:em-revisao`   | Em revisão      | Tech Lead revisa o PR | merge do humano fecha a história → `concluido`                |
| `etapa:concluido`    | Concluído       | —                     | —                                                             |

Outros rótulos: `tipo:pedido`, `tipo:feature`, `tipo:historia`; `squad` (PR da squad); `squad:pausado`, `squad:aguardando-aprovacao`, `squad:bloqueado`, `squad:auto-corrigido`.

### Contratos entre agentes

- **Um agente não muda o rótulo `etapa:*` do item em que trabalha.** Quem faz a transição é o workflow (`tools/squad/squad.mjs pos-agente`) ou, numa sessão, o orquestrador. Agentes podem criar issues novas já com a etapa inicial.
- Cada agente publica o trabalho num comentário que começa com um marcador, para o próximo achar: `<!-- squad:discovery -->`, `<!-- squad:ux -->`, `<!-- squad:refinamento -->`.
- Hierarquia por marcador no corpo: `<!-- squad:pai=12 -->` (feature → pedido, história → feature) e `<!-- squad:depende=3,4 -->` (história → histórias). Além disso, vincule como sub-issue quando der.
- Fim de trabalho: no Actions, o agente grava `{"status": "ok" | "bloqueado" | "mudancas", "resumo": "...", "perguntas": []}` no arquivo indicado no prompt. Numa sessão, devolve o mesmo em texto para o orquestrador.

### Acesso ao GitHub

Repositório: `eriklive/cartao-diario`.

- **CLI `gh` autenticado** (GitHub Actions, máquina local): `gh issue create/edit/comment/view`, `gh pr create/diff/review/comment`, `gh api`. Sub-issue: `gh api repos/{owner}/{repo}/issues/<pai>/sub_issues -X POST -F sub_issue_id=<id numérico da filha>` (o `id`, não o número: `gh api repos/{owner}/{repo}/issues/<n> -q .id`).
- **Sessão do Claude Code na nuvem** (sem `gh`): ferramentas MCP do GitHub (`mcp__github__issue_write`, `add_issue_comment`, `issue_read`, `list_issues`, `sub_issue_write`, `create_pull_request`, `pull_request_read`...). Carregue com ToolSearch se não estiverem visíveis. Só dá push no branch da sessão.

## Orquestração (sessão interativa)

Quando você é a sessão principal e a pessoa pede uma **mudança de produto** (feature, melhoria, ajuste de comportamento ou de tela), siga o fluxo da squad em vez de implementar direto. Exceções, quando você pode agir direto: perguntas, explicações, investigação, correção pontual e óbvia (typo, bug com causa clara em um arquivo), mudanças de infraestrutura/documentação, ou quando a pessoa disser "direto", "sem squad" ou equivalente. Na dúvida, pergunte em uma linha.

O modo de execução está em [`.claude/squad.json`](.claude/squad.json) (`execucao`):

1. **Sempre**: chame o agente `pm` em modo **intake** com o pedido literal. Ele cria a issue do pedido e as features no GitHub (features em `etapa:discovery`). Mostre à pessoa a lista com links.
2. **`execucao: "actions"`** (squad ligada no GitHub Actions): pare aqui. Os rótulos disparam PM (discovery) → CX → Tech Lead → Full stack no Actions, e o quadro anda sozinho. Diga como acompanhar e os comandos (`/aprovar`, `/refazer`, `/pausar`).
3. **`execucao: "local"`** (padrão até o Actions estar configurado): rode a cadeia aqui, uma feature por vez, sempre com subagentes (Agent tool, `subagent_type` = nome do agente), passando número da issue e modo:
   1. `pm` modo discovery → você muda o rótulo para `etapa:ux`.
   2. `cx` modo ux → `etapa:refinamento`.
   3. `tech-lead` modo refinamento → feature `etapa:em-andamento`.
   4. Para cada história em `etapa:pronto-dev`, na ordem de dependência: `fullstack` modo implementacao → história `etapa:em-revisao`; depois `tech-lead` modo revisao; se vier `mudancas`, `fullstack` modo correcao uma vez.
   5. Se um agente devolver `bloqueado`, pare, mostre as perguntas e espere a pessoa.
   6. Por padrão, mostre um resumo e peça um "ok" antes do refinamento e antes de implementar (a pessoa pode dispensar: "pode seguir direto").
4. No fim, resuma: issues e PRs criados, decisões, o que ficou pendente.

Mantenha o seu contexto enxuto: os agentes publicam o trabalho no GitHub e devolvem só um resumo; leia os detalhes da issue quando precisar.
