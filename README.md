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
pnpm e2e:pages        # o mesmo, simulando o GitHub Pages (subpasta /cartao-diario/, 404.html)
```

Se o Chromium do Playwright estiver em outro caminho, defina `CHROMIUM_PATH` (ex.: `CHROMIUM_PATH=/opt/pw-browsers/chromium pnpm e2e`).

## Publicar no GitHub Pages

Endereço: https://eriklive.github.io/cartao-diario/

O Pages usa **Deploy from a branch**, servindo o branch **`gh-pages`**, pasta **`/ (root)`** (Settings › Pages › Build and deployment). Esse branch guarda só o site compilado, e nada é editado nele à mão.

O workflow `.github/workflows/pages.yml` atualiza o `gh-pages` a cada push em `master`. Para publicar outro branch, rode à mão em Actions › Publicar no GitHub Pages › Run workflow e escolha o branch. Antes de publicar, ele roda os testes ponta a ponta contra o build que vai para o ar. Se algum falhar, o site continua na versão anterior.

Para publicar da sua máquina sem o workflow, rode `pnpm build:pages` e grave o conteúdo de `dist/apps/web/browser`, com um arquivo `.nojekyll` vazio, no branch `gh-pages`.

Diferenças do Pages tratadas no build (`pnpm build:pages`):

- **Subpasta:** o app fica em `/cartao-diario/`. O `<base href>` vem do workflow e o manifest usa caminhos relativos. Com domínio próprio, defina as variáveis do repositório `PAGES_BASE_HREF=/` e `PAGES_CNAME=seu.dominio` (Settings › Secrets and variables › Actions › Variables).
- **Jekyll desligado:** o arquivo `.nojekyll` faz o GitHub servir os arquivos como estão.
- **Links diretos:** o Pages não reescreve URLs, então `index.html` é copiado para `404.html`. Um link direto como `/cartao-diario/dia/2026-10-18` abre o app. Depois da primeira visita, quem responde é o service worker.
- **Cabeçalhos:** o Pages não envia cabeçalhos próprios. A CSP também vai em `<meta>` no `index.html`. Ficam de fora só `frame-ancestors` e `X-Frame-Options`, que só funcionam como cabeçalho.

## Testar num aparelho real

Abra o endereço publicado no celular.

No primeiro acesso pelo navegador, antes de qualquer pergunta, uma tela ilustrada convida a **levar o Cartão Diário para a tela de início**. Depois disso, o card **Adicione à tela de início** fica no topo de Hoje e em Ajustes enquanto o app estiver aberto no navegador. Os dois mostram o caminho certo para cada aparelho:

- **Android (Chrome):** botão "Adicionar à tela de início", quando o Chrome libera; antes disso, o caminho pelo menu ⋮ › Instalar app.
- **iPhone:** Compartilhar › Adicionar à Tela de Início. A tela do primeiro acesso avisa que, no iPhone, o app da tela de início guarda os registros separado do navegador. Por isso, vale instalar antes de começar.

Em Hoje, "Agora não" esconde o card por 30 dias.

Roteiro rápido:

1. **Instalação:** fazer o primeiro acesso com o app já instalado (abrindo pelo ícone) e conferir o ícone e a tela cheia, sem barra do navegador.
2. **Registro:** registrar hoje e ontem, fechar o app e abrir de novo: os dados continuam lá.
3. **Offline:** ligar o modo avião e abrir o app. Ele deve abrir, registrar e gerar o PDF.
4. **Exportação:** em Exportar › Gerar PDF › Compartilhar, conferir que abre o menu do sistema (WhatsApp, e-mail, Arquivos) e ver o PDF.
5. **Backup:** em Ajustes › Fazer backup, salvar em Arquivos. Depois, em outro aparelho ou navegador, usar "Restaurar backup" nas boas-vindas.
6. **Lembrete:** em Ajustes › Adicionar ao calendário, conferir se o evento diário entra no calendário.
7. **Botão voltar (Android):** voltar entre formulário, lista do dia e Hoje.

Para depurar no aparelho, use o Chrome DevTools (`chrome://inspect`, com o Android no cabo USB) ou o Safari no Mac (menu Desenvolvedor, com o iPhone no cabo).

## Outras hospedagens

Qualquer hospedagem estática com HTTPS serve. Publique `dist/apps/web/browser` depois de `pnpm build`. Os arquivos `_headers` (cabeçalhos de segurança) e `_redirects` (fallback de SPA) já saem no formato do Cloudflare Pages e do Netlify; os dois funcionam com repositório privado no plano gratuito.

## Decisões e limites conhecidos

- **Lembrete diário:** sem servidor, o navegador não dispara notificação num horário. O app gera um evento de calendário diário (`.ics`) para a pessoa adicionar ao celular. Notificação de verdade (Web Push) depende do backend.
- **Perda de dados:** tudo fica no aparelho. Para mitigar, o app pede armazenamento persistente, convida a instalar (no Safari, sites não instalados podem perder dados depois de 7 dias sem uso), oferece backup em JSON e lembra de fazê-lo depois de 14 dias.
- **Dia preenchido:** conta quando a pessoa toca "Concluir" ou responde ao menos um item. Dias antes do primeiro uso não contam como falta.
- **Exportação:** PDF e XLSX são gerados no aparelho. As bibliotecas (cerca de 2 MB) ficam fora do carregamento inicial, mas o service worker as guarda para uso offline.
- **Ainda não feito:** bloqueio por PIN/biometria, gráficos, grade da semana somente leitura, tema escuro e backend (sincronização, contas, envio ao terapeuta).
