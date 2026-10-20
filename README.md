# Cartão Diário

Web app instalável (PWA) para o **Cartão Diário da Terapia Comportamental Dialética**: a pessoa registra impulsos, comportamentos-alvo e habilidades usadas, um dia de cada vez, e exporta tudo em PDF (igual ao cartão de papel) ou planilha antes da sessão.

Os dados ficam **só no aparelho** (IndexedDB). Não há contas, servidor, analytics nem chamadas de rede: depois da primeira visita, o app funciona sem internet.

Desenho de referência: canvas "Cartão Diário — caminhos e layouts". Plano: [`docs/plano-de-implementacao.md`](docs/plano-de-implementacao.md).

## O que tem

| Tela                | Rota                                     | O que faz                                                                                                       |
| ------------------- | ---------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Primeiro acesso     | `/boas-vindas`                           | Nome, comportamentos-alvo (até 7), lembrete; ou restaurar um backup                                             |
| Hoje                | `/hoje`                                  | Faixa da semana, registro de hoje, atalho para o fechamento, lembrete de backup, convite para instalar, CVV 188 |
| Registro do dia     | `/dia/:data`                             | Lista do dia (hoje e até 6 dias atrás), marcar/desmarcar, novo alvo, Concluir                                   |
| Formulário          | `/dia/:data/item/:id`, `/dia/:data/novo` | Intensidade 0–5, seguiu?, uso de habilidades 0–7, habilidades por módulo, apoio em destaque                     |
| Fechamento semanal  | `/semana`, `/semana/:inicio`             | Tarefa, resultado, progresso −3..+3, entradas em sessão, notas; salva sozinho                                   |
| Semanas             | `/semana/anteriores`                     | Semanas fechadas e em aberto                                                                                    |
| Exportar            | `/exportar`                              | Período, PDF ou XLSX, o que incluir; compartilhar (menu do celular) ou baixar                                   |
| Ajustes             | `/ajustes`                               | Comportamentos, nome, lembrete (evento de calendário), backup/restauração, contato do terapeuta                 |
| Meus comportamentos | `/ajustes/comportamentos`                | Adicionar, renomear, arquivar e restaurar alvos                                                                 |

## Estrutura (monorepo Nx + pnpm)

```
apps/
  web/            Angular 22 (standalone, signals, zoneless) + service worker
  web-e2e/        Playwright: fluxos, acessibilidade (axe), offline, exportação
libs/shared/      Roda no navegador e no Node (futuro backend NestJS)
  models/         Schemas Zod, tipos e catálogos (habilidades, escalas, limites)
  domain/         Regras puras: datas, formulário, resumos, backup, lembrete .ics
  export/         Monta o cartão semanal e define o PDF (pdfmake) e a planilha
tools/            Servidor estático com os cabeçalhos de produção; gerador de ícones
```

As libs em `libs/shared` não podem importar Angular, NestJS, Dexie ou RxJS: a regra `@nx/enforce-module-boundaries` barra no lint.

Dentro do app:

- `core/dados`: `CartaoRepository` (interface) e `IndexedDbCartaoRepository` (Dexie). `CartaoStore` guarda o estado em signals e expõe as ações. As telas só falam com o store.
- `core/plataforma`: compartilhar e baixar arquivos, instalação, persistência do armazenamento, atualização do service worker, badge do ícone, exportação, backup e lembrete.
- `ui`: componentes da Identidade A · Névoa (tokens em `src/styles.scss`).
- `features`: uma pasta por tela.

## Comandos

```sh
pnpm install
pnpm start            # desenvolvimento em http://localhost:4200 (sem service worker)
pnpm preview          # build de produção + servidor com CSP em http://localhost:4300
pnpm test             # testes unitários (libs e app)
pnpm lint             # lint + checagem de tipos
pnpm e2e              # Playwright contra o build de produção
```

Se o Chromium do Playwright estiver em outro caminho, defina `CHROMIUM_PATH` (ex.: `CHROMIUM_PATH=/opt/pw-browsers/chromium pnpm e2e`).

## Publicar

Qualquer hospedagem estática com HTTPS. O service worker exige HTTPS.

- Build: `pnpm exec nx build web`
- Pasta publicada: `dist/apps/web/browser`
- `_headers` (CSP e outros cabeçalhos de segurança) e `_redirects` (fallback de SPA) já vão no build no formato do Cloudflare Pages e do Netlify. Em outra hospedagem, replique os dois.

## Decisões e limites conhecidos

- **Lembrete diário:** sem servidor, o navegador não dispara notificação num horário. O app gera um evento de calendário diário (`.ics`) para a pessoa adicionar ao celular. Notificação de verdade (Web Push) depende do backend.
- **Perda de dados:** tudo fica no aparelho. Para mitigar, o app pede armazenamento persistente, convida a instalar (no Safari, sites não instalados podem perder dados depois de 7 dias sem uso), oferece backup em JSON e lembra de fazê-lo depois de 14 dias.
- **Dia preenchido:** conta quando a pessoa toca "Concluir" ou responde ao menos um item. Dias antes do primeiro uso não contam como falta.
- **Exportação:** PDF e XLSX são gerados no aparelho. As bibliotecas (cerca de 2 MB) ficam fora do carregamento inicial, mas o service worker as guarda para uso offline.
- **Ainda não feito:** bloqueio por PIN/biometria, gráficos, grade da semana somente leitura, tema escuro e backend (sincronização, contas, envio ao terapeuta).
