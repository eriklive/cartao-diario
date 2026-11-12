# Squad agêntica: como usar

Uma squad de quatro agentes do Claude Code transforma um pedido seu em features, discovery, telas, histórias e PRs. Você conversa, aprova e faz o merge; o resto anda sozinho por um quadro do GitHub.

```
você ─► PM (intake) ─► features
                         │ etapa:discovery ─► PM: problema, referências, regras
                         │ etapa:ux        ─► CX: benchmark, fluxo, telas, erros
                         │ etapa:refinamento ► Tech Lead: desenho técnico + histórias
                         ▼
                   histórias ─ etapa:pronto-dev ─► Full stack: código + testes + PR
                                                        │ rótulo "squad"
                                                        ▼
                                               Tech Lead revisa ─► você faz o merge
                                                        │
                       história concluída ─► libera dependentes ─► fecha a feature ─► fecha o pedido
```

As definições dos agentes estão em `.claude/agents/` e as regras do fluxo em [`AGENTS.md`](../AGENTS.md).

## Dois jeitos de rodar

|                       | **Local** (padrão)                                       | **GitHub Actions**                                                                               |
| --------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Onde os agentes rodam | Na sua sessão do Claude Code, como subagentes            | Num runner do Actions, um job por etapa                                                          |
| Como começa           | Você pede no chat                                        | Você pede no chat **ou** abre uma issue "Pedido para a squad" **ou** cria um cartão em "Pedidos" |
| Quem move as etapas   | O orquestrador (a sessão principal)                      | O workflow, ao fim de cada agente                                                                |
| Bom para              | Acompanhar de perto, testar o fluxo, sem configurar nada | Deixar a squad trabalhando sozinha                                                               |
| Configuração          | Nenhuma                                                  | `tools/squad/setup.sh` + 2 secrets + `SQUAD_ATIVO=true`                                          |

O modo fica em `.claude/squad.json` (`"execucao": "local"` ou `"actions"`).

## Uso no dia a dia

Peça como você pediria para uma pessoa:

> Quero um gráfico da intensidade dos impulsos na semana, para levar para a sessão.

O Claude chama a PM, que cria a issue `[Pedido]` e as `[Feature]` com links. Daí:

- **Local:** a sessão roda PM → CX → Tech Lead para cada feature, mostra o resumo e pede um "ok" antes de implementar. Diga "pode seguir direto" para pular as paradas.
- **Actions:** cada troca de rótulo dispara o próximo agente. Acompanhe pelo quadro.

Para fazer algo direto, sem squad (um typo, uma dúvida, uma mudança de infra), diga "direto" ou "sem squad".

### Comandos nos comentários (modo Actions)

Só valem para dono, membros e colaboradores do repositório.

| Onde     | Comando                   | O que faz                                                                                        |
| -------- | ------------------------- | ------------------------------------------------------------------------------------------------ |
| Issue    | `/aprovar`                | Segue para a próxima etapa (no modo manual, ou depois de revisar)                                |
| Issue    | `/refazer <o que mudar>`  | Roda de novo o agente da etapa atual com a sua instrução; também responde a um `squad:bloqueado` |
| Issue/PR | `/pausar` · `/retomar`    | Liga/desliga a automação nesse item                                                              |
| PR       | `/corrigir <o que mudar>` | O full stack aplica as mudanças no mesmo branch                                                  |
| PR       | `/revisar`                | O Tech Lead revisa de novo                                                                       |

### Mover cartões no quadro

Você pode arrastar um cartão de coluna: em até ~10 minutos o rótulo acompanha e o agente da nova coluna começa. Para algo imediato, troque o rótulo `etapa:*` direto na issue. Cartão novo em "Pedidos" (precisa ser issue, não rascunho) vira um pedido para a PM.

### Modo manual

Com a variável `SQUAD_MODO=manual`, depois de discovery e UX a issue ganha `squad:aguardando-aprovacao` e espera o seu `/aprovar`. Intake e refinamento só criam issues e seguem sozinhos; o PR sempre espera o seu merge.

### Quando um agente trava

- **`squad:bloqueado`:** o agente deixou perguntas num comentário. Responda com `/refazer <respostas>`.
- **Falha no job:** aparece um comentário com o link do run. Comente `/refazer`.
- **Revisão com bloqueantes:** o full stack faz uma rodada automática de correção (rótulo `squad:auto-corrigido`). Depois disso, só com `/corrigir`.

## Configurar o modo Actions

1. Com o `gh` logado na sua conta:

   ```sh
   gh auth refresh -s project
   bash tools/squad/setup.sh
   ```

   Cria os rótulos, o quadro "Squad · Cartão Diário" com o campo **Etapa** (as 9 colunas), liga o quadro ao repositório e grava as variáveis `SQUAD_PROJECT_NUMBER`, `SQUAD_PROJECT_OWNER` e `SQUAD_MODO`.

2. Secrets (Settings › Secrets and variables › Actions):
   - `SQUAD_GH_TOKEN`: token clássico com os escopos `repo`, `workflow` e `project`. É obrigatório: o GitHub não deixa uma ação feita com o `GITHUB_TOKEN` disparar outro workflow, e a cadeia PM → CX → Tech Lead → Dev é feita de rótulos que disparam workflows.
   - `CLAUDE_CODE_OAUTH_TOKEN` (gere com `claude setup-token`, usa a sua assinatura) **ou** `ANTHROPIC_API_KEY`.

3. No quadro, crie uma visualização **Board** com "Column by: Etapa".

4. Ligue: `gh variable set SQUAD_ATIVO --body true` e troque `execucao` para `"actions"` em `.claude/squad.json`.

Modelo e esforço de cada agente ficam no cabeçalho do arquivo em `.claude/agents/` (`model`, `effort`): PM e CX usam `sonnet` com esforço `high`; Tech Lead e full stack herdam o modelo da sessão. O Actions lê o mesmo cabeçalho.

Variáveis opcionais: `SQUAD_MODEL` (modelo no Actions para os agentes com `model: inherit`), `SQUAD_PROJECT_FIELD` (se o campo não se chamar "Etapa").

## Peças

| Arquivo                                         | Papel                                                                    |
| ----------------------------------------------- | ------------------------------------------------------------------------ |
| `AGENTS.md`                                     | Convenções do repositório, etapas, contratos entre agentes, orquestração |
| `CLAUDE.md`                                     | Importa o AGENTS.md para o Claude Code                                   |
| `.claude/agents/{pm,cx,tech-lead,fullstack}.md` | Os agentes                                                               |
| `.claude/squad.json`                            | Modo de execução (local/actions)                                         |
| `.github/ISSUE_TEMPLATE/pedido.yml`             | Formulário "Pedido para a squad"                                         |
| `.github/workflows/squad.yml`                   | Roteador: evento → ação                                                  |
| `.github/workflows/squad-agente.yml`            | Roda um agente com `anthropics/claude-code-action` e faz a transição     |
| `.github/workflows/squad-quadro.yml`            | A cada 10 min, traz movimentos do quadro para os rótulos                 |
| `tools/squad/etapas.mjs`                        | Regras puras (etapas, comandos, rotas, reconciliação)                    |
| `tools/squad/squad.mjs`                         | Executor (API do GitHub, quadro, transições)                             |
| `tools/squad/setup.sh`                          | Configuração inicial                                                     |

Testes: `pnpm test:squad` (regras e um GitHub falso de ponta a ponta).

## Custos e segurança

- Cada etapa é uma execução do Claude Code: uma feature completa custa em torno de 4 execuções + 2 por história. O modo manual e `/pausar` ajudam a controlar.
- Só quem tem permissão de escrita consegue pôr rótulos, e os comandos só valem para dono/membros/colaboradores, então ninguém de fora dispara agentes.
- Os agentes de produto não editam código; o full stack só tem as ferramentas de que precisa e nunca faz push no `master`. O merge é sempre seu.
