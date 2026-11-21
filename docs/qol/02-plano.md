# Plano de execução da qualidade de vida do LimboOS

Base: varredura de 18/11/2026 sobre o commit 3860322. Os 50 itens estão em `01-varredura.md`, a especificação técnica de cada um em `03-especificacoes.md` e o plano de escrita para o Gemini em `04-plano-escrita-gemini.md`. Os textos provisórios usados no código ficam registrados por pacote em `textos/*.json`.

## Resultado das especificações

A conferência no código descartou dois itens e reduziu o escopo de doze. **P05** saiu porque o jogador não usa caminhos próprios e um rewrite `**` apagaria a página 404. **M07** saiu porque a seleção de agentes já persiste entre entregas; sobra apenas podar agentes que ficaram offline. **P13** foi absorvido por P03, que gera canonical e og:url por convite. **J06** perdeu a recuperação de senha por e-mail, porque o login usa endereços `slug@limboos.local`; o item vira "mostrar senha" e uma dica para falar com o mestre. Os demais parciais estão descritos no campo Status de cada especificação.

## Fundações

Sete peças transversais vêm antes das features que dependem delas, para que nenhum pacote invente a própria versão.

| Fundação | O que entrega | Consumidores |
|---|---|---|
| F1 Toast com ação | `action` opcional no toast do jogador e do admin | J01, J13, M04, M10, M15 |
| F2 Conectividade | `useOnlineStatus`, `isNetworkError` e a faixa "Sem sinal" | P01, J02, J07, J08 |
| F3 Guarda de rascunho | `useDraftGuard` sobre `unsavedChanges.ts` | M02, M05, M11 |
| F4 Kit de listas | `useListControls`, `useSelection`, `SortSelect`, `BulkActionBar` | M03, M06, M12 |
| F5 Persistência por agente | posição da fita e intel atual por uid+characterId | J12, J14 |
| F6 Pilha de overlays | registro de modais e leitores abertos | P09, J05, P07 |
| F7 Canal de versão | leitura de `/build-info.json` sem cache ao voltar o foco | P02, P04, P01 |

## Matriz de modelos

| Função | Modelo | Motivo |
|---|---|---|
| Orquestração, divisão em pacotes e integração | Opus 5.5 (sessão principal) | decide dependências e dono de arquivo, lendo só relatórios curtos |
| Casca do app, service worker, navegação nativa e Functions | Opus 5.5 | erro nessas peças atravessa as três superfícies ou afeta produção e privacidade |
| Pacotes de UI do jogador e do admin | Sonnet 5.5 | padrão de código já estabelecido e mudança local com critério de aceite claro |
| Arquivos estáticos, scripts npm e fusão de textos | Haiku 5.5 ou script | mudança mecânica sem decisão de design |
| Verificação no navegador com emuladores | Sonnet 5.5 | precisa julgar a tela, mas não redesenhar |
| Revisão das partes de risco | Opus 5.5 | service worker, reassinatura de listeners, Function pública e operações em lote |
| Commit, PR, deploy e `native:sync` | Haiku 5.5 | sequência de comandos conhecida, com regras explícitas de staging |
| Textos de voz imersiva, páginas públicas e e-mail | Gemini Pro | escrita longa e tom de época |
| Microcopy do admin, rótulos aria e versão em inglês | Gemini Flash | volume alto de textos curtos e padronizados |

Cada agente recebe só o brief comum, os IDs do pacote e a lista de arquivos que são dele. Ele lê a própria especificação por `awk`, abre código por trechos e devolve um relatório de no máximo doze linhas. A sessão principal nunca lê diffs inteiros.

## Ondas

Dentro de uma onda os pacotes rodam em paralelo no mesmo checkout, cada um dono de um conjunto de arquivos sem interseção. Um pacote que precisa de mudança em arquivo alheio registra a pendência, e a sessão principal a repassa ao dono na onda seguinte. Os textos novos não tocam os arquivos de locale durante a onda: cada pacote os escreve no próprio `textos/<pacote>.json` e um script os funde no fechamento.

### Onda 1: fundações e itens independentes

| Pacote | Modelo | IDs | Arquivos de dono |
|---|---|---|---|
| A1 casca | Opus | F2, F6, F7, P02, P04, P07, P08, P12 | `App.tsx`, `main.tsx`, `index.html`, `index.css` (zoom), `appInfo.ts`, `capacitor.config.ts`, `nativeShell.ts`, `fonts.ts`, novos em `src/lib` |
| A2 toasts | Sonnet | F1, J13 | `useToasts.ts`, `ToastNotification.tsx`, `ToastProvider.tsx`, `components/campaign/**` |
| A3 kit do admin | Sonnet | F3, F4, gancho de M05, modal de M14 | novos em `src/admin/hooks` e `components`, `ConfirmModal.tsx`, `unsavedChanges.ts` |
| A4 áudio | Sonnet | F5, J03, J04, J05, J12, J14, J16, P06 | `AudioEngine.ts`, `useWalkmanPlayback.ts`, `mediaSession.ts`, `useDesktopPlayerShortcuts.ts`, `CassetteVisor`, `PushService.ts`, `PushPermissionPrompt.tsx` |
| A5 estáticos e DX | Haiku | P14, P15, D01, D02, D03 | `404.html`, `site.webmanifest`, `package.json`, `vite.config.ts` (só D03), `.gitignore` |
| A6 backend | Opus | P03, P13, P16, cabeçalhos do service worker | `backend/functions/**`, `backend/firebase.json` |

### Onda 2: features sobre as fundações

| Pacote | Modelo | IDs | Arquivos de dono |
|---|---|---|---|
| A4 áudio (retomada) | Sonnet | J01, J13 no hook da fita | os mesmos da onda 1 |
| A7 Nokia e controles | Sonnet | J03 no Nokia, J10, J11, J14 no Nokia, J15 | `NokiaPlayer.tsx`, `NokiaVideoSurface.tsx`, `TapeLibrary.tsx`, `BottomControls.tsx`, `TapeProgress.tsx` |
| A8 sincronização | Sonnet | J02, J05 na casca do jogador, P09 no jogador, P01 no jogador | `PlayerSyncService.ts`, `usePlayerSync.ts`, `player/types.ts`, `PlayerRootShell.tsx` |
| A9 entrada | Sonnet | J06, J07, J08, J09 | `LoginScreen.tsx`, `store/profile.ts`, `InviteApp.tsx`, `ErrorBoundary.tsx`, `MiniAppsOverlay.tsx` |
| A10 intel e mídia | Sonnet | M01, M02, M03, M05, M06, M12, M14 na parte de intel e mídia | `useIntelCatalog.ts`, `IntelCatalogPane.tsx`, `MediaLibraryPanel.tsx`, `IntelEditorModal.tsx` |
| A11 conquistas, NPCs e utilitários | Sonnet | M01, M02, M04, M05, M06, M12, M15 | `useAchievementEditor`, `AchievementsPanel`, `AchievementEditorModal`, `useNpcContactEditor`, `NpcSmsPanel`, `NpcContactEditorModal`, `RedirectsPanel`, `JukeboxPanel` |
| A12 missões e ao vivo | Sonnet | M01, M05, M06, M07, M08, M10, M13 na parte de missão | `CampaignsPanel`, `MissionDataTab`, `MissionResourcesTab`, `MissionTeamTab`, `LiveWorkspace`, `LiveDeliverDrawer`, `IntelDistributionDrawer` |

### Onda 3: peças estruturais

| Pacote | Modelo | IDs | Arquivos de dono |
|---|---|---|---|
| A1 casca (retomada) | Opus | P01 (service worker), P09 (listener nativo), P10, P11 | `main.tsx`, `public/sw.js`, `registerServiceWorker.ts`, `deepLinks.ts`, `nativeShell.ts`, `capacitor.config.ts`, `package.json` (plugin de teclado) |
| A10 intel e mídia (retomada) | Sonnet | M09, M11 | `MediaUploadZone.tsx`, `MediaService.ts`, `MediaLibraryPanel.tsx`, `IntelEditorModal.tsx`, `NpcContactEditorModal.tsx`, novo `IntelPlayerPreview.tsx` |

### Onda 4: verificação, revisão e textos

Três agentes rodam em paralelo. Um Sonnet sobe o preview `limboos-web-emulators` com a seed de `scripts/readme-shots` e confere os critérios de aceite visíveis no jogador e no admin. Um Opus revisa só as partes de risco listadas na matriz e devolve defeitos confirmados, que voltam ao dono do arquivo. Um Sonnet escreve `04-plano-escrita-gemini.md` a partir de `textos/*.json` e do tom de DESIGN.md e PRODUCT.md.

### Onda 5: entrega

Um Haiku audita os documentos com o script anti-chatbotese, roda `npm run native:sync`, cria a branch `etapa-6-qol`, faz commits por área (submódulo backend primeiro, depois jogador, admin, plataforma e documentos), envia para o remoto, abre os PRs e publica Hosting e Functions. Ele nunca adiciona `graphify-out/`, `.impeccable/` nem logs.

## Portões de cada onda

1. `node scripts/qol-merge-keys.mjs` funde os textos provisórios nos arquivos de locale sem sobrescrever chaves existentes.
2. `npx tsc --noEmit` no projeto inteiro; cada erro volta ao dono do arquivo pelo mesmo agente, que mantém o contexto.
3. Na onda 1 e na onda 3, `npm run test:functions` em `backend/rules-tests`; na onda 3, também `npm run build`.

## Decisões que ficam com o dono do projeto

O e-mail de suporte da tela de consentimento do Google (P16) não existe no repositório e precisa ser informado. O texto definitivo de todas as chaves registradas em `textos/` vem do Gemini, conforme o plano 04, e entra por uma nova rodada de fusão com `node scripts/qol-merge-keys.mjs --dir <pasta da resposta> --replace`. Os itens nativos (P08 a P11) dependem de teste em aparelho ou simulador depois do `native:sync`, porque a verificação automática cobre só o web.
