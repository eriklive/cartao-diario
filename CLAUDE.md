@AGENTS.md

## Claude Code

- Os agentes da squad são subagentes de projeto em `.claude/agents/` (`pm`, `cx`, `tech-lead`, `fullstack`). Chame com a Agent tool usando o nome como `subagent_type`.
- Pedido de produto → siga a seção "Orquestração (sessão interativa)" do AGENTS.md: a primeira ação é chamar o `pm` em modo intake.
- No GitHub Actions, os mesmos arquivos são usados pelo workflow `.github/workflows/squad-agente.yml`.
