# Cartão Diário — plano de implementação

Fonte: canvas "Cartão Diário — caminhos e layouts" (16 pranchetas: mapa de caminhos, 8 telas funcionais, 2 exportações, 5 identidades visuais).
Alvo: web app instalável (PWA) em Angular, dados persistidos no aparelho, monorepo pronto para receber um backend NestJS depois.

---

## 1. Escopo, a partir do canvas

| Prancheta | O que vira | Fase |
|---|---|---|
| 1 · Primeiro acesso | Onboarding em 3 passos: nome → comportamentos-alvo (até 7) → lembrete | 1 |
| 2 · Início / Hoje | Faixa da semana, resumo do dia, atalho para fechamento, CVV 188 | 1 |
| 3 · Registro do dia (oficial) | Lista do dia + formulário por comportamento (I · A · H · habilidades) | 1 |
| Registro B (alternativa) | Só referência, **não implementar** | — |
| 7 · Meus comportamentos | Adicionar, renomear, arquivar, restaurar (limite 7 ativos) | 1 |
| 4 · Fechamento semanal | Tarefa, resultado, progresso −3..+3, 7 entradas em sessão, notas | 2 |
| 5 · Exportar + PDF + XLS | Período, formato, o que incluir, compartilhar | 2 |
| 6 · Ajustes | Lembrete, backup/restauração, contato do terapeuta, apoio | 2 |
| Mapa: Histórico | Lista de semanas (**sem tela desenhada ainda**) | 2 |
| Mapa: "Depois" | PIN/biometria, grade da semana, gráficos, envio direto ao terapeuta | 3–4 |
| Identidades A–E | Tokens de design; as telas funcionais usam a **A · Névoa** | 0 |

### Regras de negócio extraídas das telas

- 3 impulsos fixos (Me matar, Me ferir, Usar drogas) + até 7 comportamentos-alvo ativos.
- Item desmarcado no dia conta como 0. Marcar abre o formulário.
- Intensidade 0 encerra o formulário (seguiu = N, H = 0, sem habilidades).
- "Seguiu?" e "Uso de habilidades" só aparecem com intensidade > 0.
- "Quais habilidades" só aparece com H ≥ 4 ("Tentei, usei…" ou "Usei automaticamente…"). Baixar H para ≤ 3 limpa as habilidades.
- "Outra" existe em cada um dos 5 módulos e é registrada como "Outra (Módulo)".
- Banner de apoio (CVV 188) quando "Me matar" tem intensidade ≥ 4.
- Dá para editar até 6 dias para trás. Não dá para registrar dias futuros.
- Um alvo criado no registro do dia aparece a partir daquele dia. Arquivar tira o alvo do registro, mas mantém o histórico nas exportações. Renomear muda também os registros antigos, que guardam o id e não o nome.
- Desmarcar ou limpar apaga o registro daquele item no dia, com confirmação.
- Salvamento automático. Não existe botão de salvar na lista.
- Semana de segunda a domingo. A frequência ("6 de 7 dias") e o último registro são calculados.
- Exportações destacam células com impulso ≥ 3. O nome do arquivo segue `cartao-diario_AAAA-MM-DD_a_AAAA-MM-DD.(pdf|xlsx)`.

---

## 2. Arquitetura

### 2.1 Monorepo: Nx + pnpm

Recomendação: **Nx**. Ele tem geradores nativos para Angular e para NestJS, cache e `affected` no CI, e regras de fronteira entre libs que garantem que a pasta de modelos fique livre de framework.

```
cartao-diario/
├─ apps/
│  ├─ web/                    # Angular PWA (fase 0)
│  ├─ web-e2e/                # Playwright
│  └─ api/                    # NestJS — só na fase 4
├─ libs/
│  └─ shared/
│     ├─ models/              # ← pasta de modelos compartilhada
│     │                       #   tipos, schemas Zod, enums, catálogos
│     ├─ domain/              # regras puras: datas/semana, validações,
│     │                       #   cálculos (frequência, resumo), migração de backup
│     └─ export/              # monta o cartão semanal/planilha (modelo neutro)
│                             #   + renderizadores PDF e XLSX
├─ docs/
├─ nx.json · package.json · pnpm-workspace.yaml · tsconfig.base.json
```

Aliases: `@cartao/shared/models`, `@cartao/shared/domain`, `@cartao/shared/export`.

Fronteiras, aplicadas com `@nx/enforce-module-boundaries` e tags:

| Projeto | Tags | Pode depender de |
|---|---|---|
| shared/models | `scope:shared`, `type:models` | só `zod` |
| shared/domain | `scope:shared`, `type:domain` | models |
| shared/export | `scope:shared`, `type:export` | models, domain |
| apps/web | `scope:web` | qualquer `scope:shared` |
| apps/api | `scope:api` | qualquer `scope:shared` |

As libs `scope:shared` proíbem `@angular/*`, `@nestjs/*`, `dexie` e APIs de DOM (`bannedExternalImports`). Assim elas rodam igual no navegador e no Node.

### 2.2 Pasta de modelos compartilhada (`libs/shared/models`)

Cada tipo é `z.infer<>` de um schema Zod. O mesmo schema valida o arquivo de backup na restauração (fase 2) e os DTOs do NestJS (fase 4). Esboço:

```ts
export type DataLocal = string;            // 'AAAA-MM-DD' no fuso do usuário (nunca Date/UTC)

export interface Entidade {
  id: string;                              // UUID gerado no cliente (crypto.randomUUID)
  criadoEm: string;                        // instante ISO 8601
  atualizadoEm: string;
  removidoEm?: string;                     // soft delete — prepara a sincronização
}

export interface Comportamento extends Entidade {
  tipo: 'impulso' | 'alvo';
  chave?: 'me-matar' | 'me-ferir' | 'usar-drogas'; // só impulsos fixos
  nome: string;
  ordem: number;
  ativoDesde: DataLocal;
  arquivadoEm?: DataLocal;
}

export interface Dia extends Entidade {    // existe quando o dia foi aberto/concluído
  data: DataLocal;
  concluidoEm?: string;                    // "Concluir" → dia conta como preenchido
}

export interface RegistroComportamento extends Entidade {
  data: DataLocal;
  comportamentoId: string;
  intensidade: 0 | 1 | 2 | 3 | 4 | 5;      // I
  seguiu: boolean;                         // A (S/N)
  usoHabilidade: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7; // H
  habilidades: HabilidadeId[];             // vazio se usoHabilidade < 4
}

export interface FechamentoSemanal extends Entidade {
  semanaInicio: DataLocal;                 // segunda-feira
  tarefaCasa: string;
  resultadoTarefa: string;
  progresso: -3 | -2 | -1 | 0 | 1 | 2 | 3;
  entradasSessao: Record<EntradaSessaoId, 0 | 1 | 2 | 3 | 4 | 5>;
  notasTerapeuta: string;
}

export interface Perfil {
  nome: string;
  lembrete: { ativo: boolean; horario: string /* 'HH:mm' */ };
  contatoTerapeuta?: string;
  onboardingConcluidoEm?: string;
  ultimoBackupEm?: string;
}
```

Catálogos (constantes `as const`, com ids estáveis e rótulos à parte):

- `MODULOS_HABILIDADES`: 5 módulos (Atenção Plena, Caminho do Meio, Tolerância ao Mal-estar, Regulação Emocional, Efetividade Interpessoal) e suas habilidades. O id tem o formato `modulo.habilidade` (ex.: `tolerancia.tip`, `atencao-plena.outra`).
- `ESCALA_USO_HABILIDADE`: os 8 rótulos de H (0–7).
- `ENTRADAS_SESSAO`: os 7 itens (deixar a terapia, posso fazer melhor, faltar, ocultar/mentir, emoções, ações, pensamentos).
- `IMPULSOS_FIXOS`, `LIMITE_ALVOS = 7`, `JANELA_EDICAO_DIAS = 6`, `LIMIAR_APOIO = 4`, `LIMIAR_DESTAQUE = 3`.

Os registros guardam **ids**, nunca rótulos. Assim renomear e traduzir não quebram o histórico.

### 2.3 Regras puras (`libs/shared/domain`)

Funções sem efeito colateral, com 100% de teste unitário:

- Datas: `inicioDaSemana`, `diasDaSemana`, `semanaIso`, `podeEditarDia(data, hoje)` (janela de 6 dias).
- Registro: `normalizarRegistro`, que aplica as regras de I = 0, H < 4 etc. e é chamada antes de toda gravação. `exigeApoio(registro, comportamento)`.
- Comportamentos: `visiveisNoDia(lista, data)` (ativo, `ativoDesde ≤ data`, não arquivado), `podeAdicionarAlvo`, `podeRestaurar`.
- Resumos: `frequencia(dias, periodo)`, `ultimoRegistro`, `resumoSemana`, que dá o maior impulso e o dia dele e a habilidade mais usada (o que a tela de fechamento mostra).
- Backup: `migrarBackup(json)`, que leva qualquer `schemaVersion` antiga até a atual.

### 2.4 Exportação (`libs/shared/export`)

A exportação tem duas camadas, para rodar no navegador agora e no NestJS depois sem reescrever nada:

1. **Montagem** (pura). `montarCartaoSemanal` gera a grade dia × comportamento × I/A/H, com destaques e legenda. `montarCartaoHabilidades` gera a página 2 do PDF. `montarPlanilha` gera as abas Diário, Habilidades, Semanal e Legenda.
2. **Renderização**. **pdfmake** gera o PDF em A4 paisagem, uma página por semana, com a fonte embutida. **write-excel-file** gera o XLSX, com estilos nas células; a alternativa é o ExcelJS. As duas bibliotecas funcionam no navegador e no Node. No app web elas carregam só quando a pessoa exporta (`import()` dinâmico), para não pesar o carregamento inicial.

### 2.5 App Angular (`apps/web`)

Stack: componentes standalone, **signals**, zoneless, control flow novo (`@if`/`@for`), SCSS com tokens em CSS custom properties.

```
apps/web/src/app/
├─ core/
│  ├─ db/            # Dexie: schema, versões/migrações
│  ├─ repos/         # interfaces (tokens de DI) + implementação IndexedDB
│  ├─ platform/      # share, instalação, storage.persist, arquivo .ics, data "hoje"
│  └─ guards/        # onboardingConcluido
├─ ui/               # design system: escala 0–5, chip, pílula de habilidade, switch,
│                    #   stepper −/+, diálogo de confirmação, nav inferior, cartão, toast
├─ features/
│  ├─ onboarding/
│  ├─ hoje/
│  ├─ registro/      # lista do dia + formulário
│  ├─ semana/        # fechamento
│  ├─ historico/
│  ├─ exportar/
│  └─ ajustes/       # ajustes + meus comportamentos + backup
├─ app.routes.ts
└─ app.config.ts
```

Rotas. Usar rota em vez de estado interno faz o botão "voltar" do Android funcionar:

| Rota | Tela |
|---|---|
| `/boas-vindas` | Onboarding (passo na query `?passo=`) |
| `/hoje` | Início (padrão) |
| `/dia/:data` | Lista do dia |
| `/dia/:data/item/:id` · `/dia/:data/novo` | Formulário do comportamento / novo alvo |
| `/semana` · `/semana/:inicio` | Fechamento semanal |
| `/historico` | Lista de semanas |
| `/exportar` · `/exportar/previa` | Exportar e prévia |
| `/ajustes` · `/ajustes/comportamentos` | Ajustes / Meus comportamentos |

Estado: um *store* por feature, que é um serviço com `signal`/`computed`, alimentado por `liveQuery` do Dexie convertido com `toSignal`. Assim uma gravação atualiza todas as telas sem NgRx. Formulários: o formulário do comportamento é uma máquina de estados pequena (rascunho → normalizar → gravar), validada pelo schema Zod.

### 2.6 Persistência no aparelho

- **IndexedDB via Dexie.js**, banco `cartao-diario`:

  | Store | Chave / índices |
  |---|---|
  | `perfil` | chave fixa `'perfil'` |
  | `comportamentos` | `id`, `tipo`, `arquivadoEm` |
  | `dias` | `data` |
  | `registros` | `id`, `[data+comportamentoId]` (único), `data`, `comportamentoId` |
  | `fechamentos` | `semanaInicio` |
  | `meta` | chave/valor (`schemaVersion`, etc.) |

- **Repositórios atrás de interfaces** (`ComportamentoRepository`, `RegistroRepository`…), injetados por token. As features não sabem que é IndexedDB. Na fase 4 a implementação troca para "local + sync" e as telas não mudam.
- **Contra perda de dados.** Os dados só existem no celular, e esse é o maior risco do produto.
  - Pedir `navigator.storage.persist()` ao fim do onboarding e mostrar o resultado em Ajustes.
  - Incentivar a **instalação**. No Safari, um site não instalado pode ter os dados apagados depois de 7 dias sem uso. Instalado na tela de início, isso não acontece.
  - Backup em arquivo JSON (`{ app, schemaVersion, exportadoEm, dados }`). A restauração valida com Zod, roda `migrarBackup` e substitui tudo depois de uma confirmação.
  - Lembrete de backup em Ajustes ("Último backup: há 12 dias") e, se ficar velho demais, em Início.
- Sem chaves auto-incrementais. Todo id é UUID gerado no cliente, com `atualizadoEm` e `removidoEm`. É isso que viabiliza a sincronização futura sem migrar ids.

### 2.7 PWA

- `ng add @angular/pwa`. O manifest leva `lang: pt-BR`, `display: standalone`, `theme_color` da identidade e ícones *maskable*. O service worker (`ngsw-config.json`) faz *prefetch* do app shell e das fontes. O app funciona 100% offline.
- **Fontes self-hosted** (`@fontsource/atkinson-hyperlegible`, `@fontsource/instrument-sans`), sem Google Fonts em tempo de execução. Isso garante o funcionamento offline e não vaza o IP de quem usa um app de saúde mental para terceiros.
- Instalação: no Android/Chrome, capturar `beforeinstallprompt` e oferecer um botão "Instalar". No iOS, mostrar um cartão com instruções (Compartilhar → Adicionar à Tela de Início). Isso **ainda não está desenhado no canvas**.
- Compartilhar exportação: Web Share API com arquivo (`navigator.share({ files })`). Se não houver suporte, cai para download.
- Atualização do app: `SwUpdate`, com aviso discreto do tipo "nova versão, toque para atualizar".

### 2.8 Lembrete diário, uma limitação importante

Sem servidor, um PWA **não consegue** disparar uma notificação confiável às 21h. A Notification Triggers API foi abandonada, e o Periodic Background Sync só existe no Chromium e não respeita horário. Proposta:

- **Fases 1 e 2:** o toggle e o horário ficam salvos. O app gera um evento recorrente de calendário (`.ics`, diário no horário escolhido) que a pessoa adiciona ao calendário do celular. Funciona no iOS e no Android. Além disso, Início mostra os dias que faltam e o app instalado ganha um *badge* (`navigator.setAppBadge`) onde houver suporte.
- **Fase 4:** notificação de verdade via Web Push (VAPID) disparada pelo NestJS. No iOS só funciona com o app instalado (16.4+).

### 2.9 Privacidade e segurança

Os dados são de saúde mental e incluem ideação suicida. Pela LGPD (art. 11) são dados sensíveis. Fases 0 a 3:

- Nenhum analytics, nenhum SDK de terceiros e nenhum log remoto.
- CSP restritiva, sem CDNs.
- O texto do onboarding ("ficam só neste celular") precisa continuar verdadeiro.

Fase 3: backup criptografado com senha (Web Crypto AES-GCM + PBKDF2) e bloqueio por PIN/biometria. Fase 4: consentimento explícito, criptografia em repouso e política de retenção.

---

## 3. Fases e entregas

### Fase 0 — Fundação
- [ ] Workspace Nx com pnpm no repositório atual (`npx nx@latest init` ou `create-nx-workspace --preset=apps`, depois `nx add @nx/angular`).
- [ ] `apps/web` (Angular, SCSS, esbuild) e `apps/web-e2e` (Playwright).
- [ ] Libs `shared/models`, `shared/domain` e `shared/export` (`@nx/js`, Vitest), com tags e regras de fronteira.
- [ ] ESLint, Prettier, Vitest nas libs e no app.
- [ ] `@angular/pwa`, manifest, ícones e fontes self-hosted.
- [ ] Tokens da Identidade A (cores, tipografia, raios, alvos de toque ≥ 44 px) e componentes base de `ui/`.
- [ ] CI no GitHub Actions: `nx affected -t lint test build e2e`.
- [ ] Deploy estático com HTTPS e *fallback* de SPA (Cloudflare Pages ou Netlify).

**Pronto quando:** o app vazio instala no Android e no iPhone, abre em modo avião e o CI está verde.

### Fase 1 — Núcleo do registro (MVP, parte 1)
- [ ] `shared/models`: schemas Zod, tipos e catálogos.
- [ ] `shared/domain`: todas as regras da seção 1, com testes.
- [ ] Banco Dexie, repositórios, *seed* dos 3 impulsos fixos e `storage.persist()`.
- [ ] Onboarding com 3 passos e guard.
- [ ] Início: faixa da semana, resumo de hoje, atalhos, CVV.
- [ ] Registro do dia: lista, formulário, navegação de até 6 dias, novo alvo, desmarcar/limpar, salvamento automático, banner de apoio.
- [ ] Meus comportamentos: adicionar, renomear, arquivar, restaurar e limite de 7.
- [ ] E2E: onboarding → registrar dia → recarregar → os dados continuam lá, também offline.

**Pronto quando:** dá para substituir a parte diária do cartão de papel.

### Fase 2 — Semana, exportação e dados (MVP, parte 2)
- [ ] Fechamento semanal com resumo calculado.
- [ ] Histórico: lista de semanas, abertas e fechadas.
- [ ] `shared/export`: montagem com testes de snapshot. PDF (página 1: grade; página 2: cartão de habilidades) e XLSX (4 abas).
- [ ] Tela Exportar: período, formato, incluir, prévia e compartilhar.
- [ ] Ajustes: lembrete (com troca de horário, que hoje só existe no onboarding), backup/restauração, contato do terapeuta, apoio.
- [ ] Lembrete via `.ics`, *badge* e convite para instalar.
- [ ] Testes em aparelhos reais (Safari no iOS e Chrome no Android). Auditoria Lighthouse de PWA e acessibilidade.

**Pronto quando:** o PDF exportado substitui o cartão de papel na sessão e um backup restaurado em outro aparelho reproduz tudo.

### Fase 3 — Pós-MVP, ainda só cliente
- [ ] Grade da semana (somente leitura) e gráficos de tendência de intensidade.
- [ ] Bloqueio por PIN/biometria e backup criptografado.
- [ ] Tema escuro, se a Identidade C · Noite for adotada como variante.

### Fase 4 — Backend NestJS (futuro)
- [ ] `nx add @nx/nest` e `apps/api`, com Postgres (ORM a decidir: Prisma ou Drizzle).
- [ ] Validação de DTOs com os mesmos schemas Zod de `shared/models`.
- [ ] Contas e consentimento (LGPD). Papel de terapeuta, se fizer sentido.
- [ ] Sincronização *local-first*: tabela *outbox* no Dexie, endpoints `push`/`pull` por `atualizadoEm`, *last-write-wins* por registro e `removidoEm` como lápide.
- [ ] Web Push para o lembrete no horário local de cada pessoa.
- [ ] Envio direto ao terapeuta, com o PDF gerado no servidor pela mesma `shared/export`.

---

## 4. Testes

| Camada | Ferramenta | Foco |
|---|---|---|
| shared/models, domain | Vitest | regras, datas e fusos, migração de backup |
| shared/export | Vitest + snapshot | grade semanal, destaques, abas da planilha |
| Repositórios | Vitest + `fake-indexeddb` | gravação, índices, soft delete |
| Componentes | Vitest + Angular Testing Library | formulário do comportamento (estados condicionais) |
| Fluxos | Playwright (perfis mobile) | onboarding, registro, exportação, uso offline |

---

## 5. Riscos

| Risco | Mitigação |
|---|---|
| Perda de dados (só no aparelho) | `persist()`, incentivo a instalar, backup com lembrete, exportação |
| Lembrete não dispara sem servidor | `.ics` e aviso no app agora, Web Push na fase 4 (seção 2.8) |
| Diferenças do iOS (instalação, armazenamento, share) | Testes em iPhone real desde a fase 0 |
| Virada do dia, fuso, registro após a meia-noite | `DataLocal` como string, janela de 6 dias, "Como foi ontem?" |
| Evolução do schema | Versões do Dexie e `schemaVersion` no backup com `migrarBackup` |
| Dado sensível | Zero terceiros, fontes locais, CSP; LGPD na fase 4 |

---

## 6. Decisões em aberto

1. **Identidade visual:** a A · Névoa é a base de todas as telas funcionais. Confirmar ou escolher B–E. Os tokens permitem trocar depois.
2. **Lembrete na fase 1:** aceitar `.ics` mais aviso no app até existir backend?
3. **"Dia preenchido":** proposta: conta quando a pessoa toca "Concluir" ou salva pelo menos um item. Um dia bom sem nada marcado precisa poder contar como preenchido.
4. **Fechamento:** qual semana a tela abre se a sessão é na segunda? Proposta: a semana mais recente sem fechamento, com seletor.
5. **Telas não desenhadas:** Histórico (lista de semanas), convite para instalar, fluxo de restauração de backup e troca de horário do lembrete em Ajustes.
6. **Hospedagem e domínio** do PWA.
7. **Limite de colunas no PDF:** o desenho mostra 3 impulsos e 4 alvos (21 colunas). Com 7 alvos são 30 colunas em A4 paisagem. Validar a legibilidade ou dividir em duas faixas.
