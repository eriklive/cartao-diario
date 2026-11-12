#!/usr/bin/env bash
# Prepara o GitHub para a squad: rótulos, quadro (GitHub Projects) e variáveis do Actions.
# Rode uma vez, na sua máquina, com o gh logado na sua conta:
#
#   gh auth refresh -s project      # o gh precisa do escopo "project" para criar o quadro
#   bash tools/squad/setup.sh
#
# Variáveis opcionais: REPO (dono/nome), TITULO do quadro, PROJETO (número de um quadro que já existe),
# MODO (auto | manual).
set -euo pipefail

REPO="${REPO:-$(gh repo view --json nameWithOwner -q .nameWithOwner)}"
DONO="${REPO%%/*}"
TITULO="${TITULO:-Squad · Cartão Diário}"
CAMPO="Etapa"
MODO="${MODO:-auto}"
COLUNAS="Pedidos,Discovery,UX,Refinamento,Em andamento,Backlog técnico,Pronto p/ dev,Em revisão,Concluído"

echo "› Repositório: $REPO"

echo "› Rótulos"
rotulo() { gh label create "$1" --repo "$REPO" --color "$2" --description "$3" --force >/dev/null && echo "  $1"; }
rotulo "etapa:pedido"               "ededed" "Squad: pedido aguardando a PM (intake)"
rotulo "etapa:discovery"            "c5def5" "Squad: PM fazendo discovery"
rotulo "etapa:ux"                   "d4c5f9" "Squad: CX desenhando fluxo e telas"
rotulo "etapa:refinamento"          "bfdadc" "Squad: Tech Lead quebrando em histórias"
rotulo "etapa:em-andamento"         "fef2c0" "Squad: filhas em andamento"
rotulo "etapa:backlog"              "e4e669" "Squad: história esperando dependências"
rotulo "etapa:pronto-dev"           "0e8a16" "Squad: pronta para o full stack"
rotulo "etapa:em-revisao"           "fbca04" "Squad: PR aberto, em revisão"
rotulo "etapa:concluido"            "5319e7" "Squad: concluído"
rotulo "tipo:pedido"                "1d76db" "Pedido de produto (épico)"
rotulo "tipo:feature"               "0052cc" "Feature criada pela PM"
rotulo "tipo:historia"              "006b75" "História criada pelo Tech Lead"
rotulo "squad"                      "000000" "PR aberto pela squad (chama a revisão do Tech Lead)"
rotulo "squad:pausado"              "b60205" "Squad: automação pausada neste item"
rotulo "squad:aguardando-aprovacao" "d93f0b" "Squad: comente /aprovar para seguir"
rotulo "squad:bloqueado"            "b60205" "Squad: agente precisa de uma decisão (responda com /refazer)"
rotulo "squad:auto-corrigido"       "c2e0c6" "Squad: rodada automática de correção já feita"

echo "› Quadro"
if [ -z "${PROJETO:-}" ]; then
  PROJETO="$(gh project list --owner "$DONO" --format json -q ".projects[] | select(.title == \"$TITULO\") | .number" | head -n1)"
fi
if [ -z "$PROJETO" ]; then
  PROJETO="$(gh project create --owner "$DONO" --title "$TITULO" --format json -q .number)"
  echo "  criado: #$PROJETO"
else
  echo "  usando o existente: #$PROJETO"
fi
gh project link "$PROJETO" --owner "$DONO" --repo "$REPO" >/dev/null 2>&1 || true

if gh project field-list "$PROJETO" --owner "$DONO" --format json -q '.fields[].name' | grep -qx "$CAMPO"; then
  echo "  campo \"$CAMPO\" já existe (confira se as opções são: $COLUNAS)"
else
  gh project field-create "$PROJETO" --owner "$DONO" --name "$CAMPO" \
    --data-type SINGLE_SELECT --single-select-options "$COLUNAS" >/dev/null
  echo "  campo \"$CAMPO\" criado com as colunas: $COLUNAS"
fi

echo "› Variáveis do Actions"
gh variable set SQUAD_PROJECT_NUMBER --repo "$REPO" --body "$PROJETO"
gh variable set SQUAD_PROJECT_OWNER --repo "$REPO" --body "$DONO"
gh variable set SQUAD_MODO --repo "$REPO" --body "$MODO"

cat <<FIM

Pronto. Faltam três passos manuais:

1. Secrets do repositório (Settings › Secrets and variables › Actions):
   - SQUAD_GH_TOKEN: um token clássico (github.com/settings/tokens) com os escopos repo, workflow e project.
       gh secret set SQUAD_GH_TOKEN --repo $REPO
   - CLAUDE_CODE_OAUTH_TOKEN (usa a sua assinatura do Claude; gere com "claude setup-token")
       gh secret set CLAUDE_CODE_OAUTH_TOKEN --repo $REPO
     ou ANTHROPIC_API_KEY (cobrança por uso da API).

2. No quadro (https://github.com/users/$DONO/projects/$PROJETO, ou /orgs/ se for organização):
   crie uma visualização "Board" e, em "Column by", escolha "$CAMPO".

3. Ligue os agentes no Actions e avise as sessões do Claude Code:
       gh variable set SQUAD_ATIVO --repo $REPO --body true
   e troque "execucao" para "actions" em .claude/squad.json.
FIM
