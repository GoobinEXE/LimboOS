# AGENTS.md

> Guia de orientação para agentes de IA (Cursor, Copilot, Claude Code, etc.) trabalhando neste repositório.
> Leia este arquivo antes de editar código.

## O que é este projeto

**LimboOS** é um companion app web para campanhas de RPG de mesa. Jogadores interagem como **agentes** através de interfaces retro (walkman, Nokia, BIOS, Windows 95, Mac OS) para consumir **Intel** — conteúdo narrativo em áudio, texto, imagem, conquistas e, nos planos, vídeos e mapas interativos.

Não é um OS real: é uma **SPA fictícia** com imersão ARG, lore temporal (Limbo, fenda, bug do milênio) e painel administrativo para o mestre de jogo.

## Stack

| Camada | Tecnologia |
|--------|------------|
| UI | React 19, TypeScript, Tailwind CSS 4, Motion |
| Build | Vite 6 |
| Roteamento | React Router 7 |
| Backend | Firebase (Auth, Firestore, Storage, Analytics, Hosting) |
| Deploy | `npm run build` → `backend/dist` → Firebase Hosting |

## Repositórios relacionados (submódulos Git)

| Path | Conteúdo |
|------|----------|
| `backend/` | Firebase Hosting, rules, deploy (`LimboOS-backend`) |
| `mobile/` | App Flutter legado (`LimboOS-mobile`), substituído pelo shell Capacitor em `ios/` e `android/` |

Se `backend/` estiver vazio, inicialize submódulos: `git submodule update --init --recursive`.

## Estrutura do código

```
src/
├── App.tsx                 # Router: Player, Admin, Terminal
├── Player.tsx              # Entry fino do jogador (providers + shell)
├── main.tsx                # Entry point React
├── player/                 # Orquestração do app jogador
│   ├── context/            # PlayerSessionProvider + usePlayerSession/Playback
│   ├── hooks/              # auth, intel, sync, walkman playback, AppScreen history
│   ├── components/         # ScreenRouter, WalkmanShell, NokiaLayout...
│   └── types.ts            # Contratos de context
├── admin/                  # Painel administrativo (/admin)
│   ├── AdminApp.tsx
│   └── components/         # Dashboard, campanhas, intel, mídia, users...
├── terminal/               # Terminal fictício ARG (/terminal)
├── components/             # UI compartilhada e mini-apps
│   ├── player/             # Walkman, Nokia, controles, fitas
│   └── campaign/           # Seleção de campanha, dossiê, segurança
├── services/               # Lógica de negócio (singletons)
├── store/                  # Firestore CRUD + auth/profile
├── types/                  # Modelos TypeScript
├── data/                   # Registros estáticos (campanhas, intel, achievements)
├── lib/firebase.ts         # Inicialização Firebase (Auth sem popup no app nativo)
└── lib/native/             # Ponte Capacitor: isNative, haptics, login nativo, status bar/splash

ios/, android/              # Shell Capacitor (webDir: backend/dist), config em capacitor.config.ts

sms/                        # Diálogos de NPCs (conteúdo narrativo em Markdown)
```

## Três superfícies da aplicação

| Rota | Entry | Público |
|------|-------|---------|
| `/*` | `Player.tsx` | Jogadores |
| `/admin/*` | `admin/AdminApp.tsx` | Mestre / admin |
| `/terminal/*` | `terminal/TerminalApp.tsx` | ARG / easter egg |

Todas são lazy-loaded em `App.tsx` com `Suspense` + `RetroLoading`.

### Navegação interna (History API)

- **Admin:** rotas por caminho sob `/admin/*`: `/admin/live`, `/admin/missions[/new|/:id/:seção]`, `/admin/content/:seção?mission=`, `/admin/mesa/:seção[/:uid[/:charId]]`, `/admin/system/:seção`. A fonte única é `src/admin/lib/adminNavigation.ts` (destinos, seções, rótulos i18n, ícones, atalhos ⌘1–5, grupos da barra lateral, construtores `adminPath.*`, `parseAdminLocation` e o redirecionamento das URLs antigas `?tab=&sub=`). `Dashboard` lê `useLocation`, mantém destinos e seções montados (keep-alive) e lembra a última rota de cada destino. Navegue sempre com `useAdminNavigate()` (`src/admin/hooks/useAdminRoute.ts`); não chame `window.history` no admin. Trocar destino ou seção empilha no histórico; o filtro `?mission=` substitui.
- **Destinos do admin:** Ao Vivo (sessão e entregas), Missões (lista e página da missão), Conteúdo (Intel & Mídia, Conquistas, NPCs & SMS, QR & Links, com um filtro de missão único), Mesa (Esquadrões, Agentes & Contas, Acesso de hardware) e Sistema (Relatórios, Log e, só para quem tem o claim `platformAdmin`, Contas da plataforma em `PlatformAccountsPanel`). Abaixo de `lg` a barra lateral vira a gaveta `AdminNavDrawer`, aberta pelo menu do cabeçalho; o conteúdo ocupa a tela inteira, respeitando as áreas seguras. Trocas de rota animam com direção (`adminMotionHint`): aprofundar ou ir para a seção à direita entra pela direita, o inverso pela esquerda, troca de destino só faz fade.
- **Página da missão:** seções `recursos` (padrão), `dados`, `vinculos`, `inventario`, `apps` (mini-apps liberados na missão, `Campaign.features`) e `equipe` (convites, co-mestres e jogadores, `MissionTeamTab`); uma seção nova entra em `MISSION_SECTIONS` e no `render` de `MissionWorkspace`. Intel, conquistas e NPCs da missão são criados ali com os editores reutilizáveis (`useAchievementEditor`, `useNpcContactEditor`, `IntelEditorHost`). O vínculo esquadrão↔missão só é editado em Vínculos. Rascunhos de Dados sobrevivem à navegação; recarregar, sair ou abrir o modo jogador pedem confirmação (`src/admin/lib/unsavedChanges.ts`).
- **Player:** `useAppScreenHistory` espelha o histórico do navegador com o modelo puro `src/player/lib/screenHistoryModel.ts`. Voltar a uma tela já empilhada usa `history.go(-n)` e nunca duplica entradas; trocar de agente ou sair colapsa o histórico; mini-apps fecham para a tela de origem (`exitMiniApp`); o leitor de evidência ocupa uma entrada própria. Conta admin joga com `/?mode=play` (o parâmetro some no logout) e volta pelo "Voltar ao console" (seleção de agentes e perfil); o admin abre o modo jogo pelo atalho "Jogar como agente".
- Lazy de telas do jogador fica inline em `PlayerScreenRouter.tsx` / `MiniAppsOverlay.tsx` (não há `lazyScreens.ts`).

## Conceitos de domínio

| Termo | Significado |
|-------|-------------|
| **Intel** | Item colecionável unificado: `AUDIO`, `TEXT`, `VISUAL`, `META` (vídeo e mapas interativos planejados) |
| **AccessLevel** | Sigilo RPG: 1 RESTRITO → 4 TOP SECRET |
| **MasterAccount** | Conta Firebase (`users/{uid}`) |
| **CharacterData** | Agente/personagem do jogador |
| **Campaign** | Campanha de RPG com tema, sistema e `playerType` (`walkman` \| `nokia`) |
| **AppScreen** | Estado de navegação interna do Player (`login`, `player`, `bios`, `limbo`, etc.) |

### Fontes de Intel

1. **Local** — `src/data/intel_registry.ts` (hardcoded, lore fixa)
2. **Remota** — Firestore + admin (`MediaLibraryPanel`, `useIntelCatalog`, `IntelEditorHost`)
3. **Runtime** — `IntelService` mescla local + remoto; `IntelEngine` aplica Strategy/Factory por tipo

## Modelo Firestore (resumo)

O app é multi-tenant: cada mestre tem uma **pasta** (`workspaces/{uidDoDono}`) com todo o conteúdo das mesas dele. Coleções globais antigas (`campaigns`, `mediaAssets`, `groups`, `system/*` etc.) ficam só leitura para quem tem o claim legado `admin` e servem de origem para a migração.

```
users/{uid}                              → MasterAccount (conta pessoal, só a própria pessoa lê)
  ├── memberships/{wsId}                 → índice das pastas onde joga ou é co-mestre (escrito por Functions)
  └── characters/{characterId}           → CharacterData, com workspaceId da mesa
        ├── intel/{intelId}              → itens desbloqueados (só via Function unlockIntel)
        └── achievements/{achievementId} → conquistas (só via Function grantAchievements)

workspaces/{wsId}                        → pasta (ownerUid, name); wsId = uid do dono
  ├── campaigns/{c}                      → missões; features liga mini-apps por missão
  │     └── state/live                   → estado ao vivo (seized, readThreadIds, diskRepairAllowed)
  ├── members/{uid}                      → co-mestres e campanhas a que têm acesso (Functions)
  ├── players/{uid}                      → roster: campaignIds/characterIds derivados por trigger;
  │                                        o dono só edita notes e gmLabel
  ├── groups/{g}                         → esquadrões; campaignIds e memberUids derivados (syncGroup)
  ├── mediaAssets, mediaFolders, qrRedirects, playEvents, activityLog → escopo por campaignId (null = só dono)
  ├── achievementDefs, npcContacts, npcDialogues, jukeboxTracks       → escopo por lista (campaignIds[] + global)
  ├── config/settings                    → preferências do dono (persistentItemIds)
  └── stats/*                            → agregados escritos por Functions
invites/{hashDoToken}                    → convites de jogador ou co-mestre (só Functions leem)
```

Papéis: **dono** (tudo na própria pasta), **co-mestre** (só as campanhas listadas em `members/{uid}`; listas precisam filtrar por campanha), **jogador** (lê a própria linha do roster e as campanhas do agente; nunca lista mídia, que chega pelas Functions `resolveIntelCode`/`getMediaAssetsByIds`) e **admin da plataforma** (claim `platformAdmin`: gerencia contas pelas Functions `listAccounts`/`setAccountSuspended`/`adminResetPassword`/`adminCreateUser`, sem acesso ao conteúdo das pastas). Ninguém entra numa mesa sem convite (`/convite/:token`, `src/invite/InviteApp.tsx`).

No cliente, todo acesso à pasta passa por `src/lib/tenantScope.ts` (`wsCollection`/`wsDoc`, `subscribeScoped`/`getScopedDocs`, conversão do escopo `'global'` do cliente para `{ campaignIds: [], global: true }`). No admin, `useAdminScope()` (`src/admin/context/AdminScopeContext.tsx`) expõe papel e troca de pasta; a pasta ativa fica em `localStorage` (`limboos.admin.workspace`) e o `Dashboard` remonta com `key=wsId`. As rotas do admin não levam o id da pasta. Sync do jogador: `src/services/PlayerSyncService.ts` (`establishPlayerScope`). Persistência: `src/store/firestore.ts`.

**Conteúdo inicial:** cada pasta nasce vazia. O bundle só traz a intel embutida dos mini-apps (`src/data/intel_registry.ts`) e as conquistas globais dos mini-apps (`src/data/achievements.ts`). A lore das campanhas originais está em `backend/scripts/legacy-seed/*.json` e entra só pela migração. `CatalogStateService` virou stub (todo catálogo conta como inicializado) porque `system/*` é global.

**Regras e Functions:** `backend/firestore.rules`, `backend/storage.rules` e `backend/functions/index.js`. Mudou regra ou Function? Atualize os testes em `backend/rules-tests/firestore.rules.test.js`, `storage.rules.test.js` e `backend/functions/test/`.

## Serviços principais

| Serviço | Responsabilidade |
|---------|------------------|
| `IntelService` / `IntelEngine` | Catálogo, unlock, comportamento por tipo |
| `AudioEngine` | Reprodução de fitas |
| `CampaignService` | Campanhas do player, lidas da pasta do agente |
| `InviteService` | Convites, co-mestres e roster (via Functions) |
| `AchievementManager` | Regras e desbloqueio de conquistas |
| `PlayerSyncService` | Snapshot listeners do estado do jogador |
| `UserService` | CRUD de contas e personagens (admin) |
| `ActivityLogger` / `AnalyticsTracker` | Telemetria e logs |

Padrão predominante: **classes singleton** exportadas como instância (`export const foo = Foo.getInstance()`).

## Comandos

```bash
npm run dev          # Dev server (Vite)
npm run build        # Build de produção → backend/dist
npm run preview      # Preview do build
npm run lint         # Type-check (tsc --noEmit) — não há ESLint separado
npm run deploy       # Build + Firebase Hosting (main)
npm run native:sync  # Build + cap sync (copia o web para ios/ e android/)
npm run native:ios   # native:sync + abre o Xcode
npm run native:android # native:sync + abre o Android Studio (Gradle exige JDK 21)

# Backend (Java e firebase-tools instalados)
cd backend/rules-tests && npm test                # regras Firestore + Storage no emulador
cd backend/rules-tests && npm run test:functions  # Functions + script de migração no emulador
cd backend && firebase emulators:start --only auth,firestore,functions,storage --project demo-limboos
```

Teste ponta a ponta local: suba os emuladores (portas em `backend/firebase.json`) e rode o app com `VITE_USE_EMULATORS=true` e `VITE_FIREBASE_PROJECT_ID=demo-limboos` (configuração `limboos-web-emulators` em `.claude/launch.json`, porta 5190).

Migração das coleções globais para a pasta do mestre original: `backend/scripts/migrate-to-workspaces.cjs` (simula por padrão; grava só com `--apply`; idempotente; não move agente que já tem `workspaceId` de outra pasta). Contra produção, só o usuário roda, depois de exportar o Firestore.

Após alterações de código, rode `npm run lint` no escopo alterado (ou no projeto inteiro).

## App nativo (Capacitor)

- `capacitor.config.ts` usa o appId `com.limboos.limboOs`, o mesmo dos apps já registrados no Firebase. `GoogleService-Info.plist` (`ios/App/App/`) e `google-services.json` (`android/app/`) ficam fora do git; copie de `mobile/` ou baixe do console.
- Código que depende de plataforma passa por `src/lib/native/` e carrega plugins com `import()` atrás de `isNative()`, para o bundle web não mudar. Feedback tátil usa `haptic()`, nunca `navigator.vibrate`.
- Login Google/Apple no app usa `@capacitor-firebase/authentication` com `skipNativeAuth` e `signInWithCredential`; `onAuthStateChanged` do SDK web continua sendo a fonte da sessão.
- Depois de alterar `src/`, rode `npm run native:sync` antes de testar no Xcode ou Android Studio.
- **Push:** `src/services/PushService.ts` guarda o aparelho em `users/{uid}/devices/{deviceId}` e as preferências em `users/{uid}.notificationPrefs`. O envio fica em `backend/functions/push.js` e nas Functions `pushOn*`, `adminSendPush`, `schedulePush`, `cancelScheduledPush`, `listPushActivity` e `dispatchScheduledPushes`. Só notificam entregas com `source: 'admin'` (intel, conquista), mensagens com `notifyUid` (a primeira fala do NPC) e vídeo transmitido com `pendingVideoPlay.notify`. `workspaces/{ws}/pushLog` e `scheduledPushes` só são acessados por Functions. Não há emulador de FCM: os testes injetam o envio com `setMessagingForTests`.
- **Links universais:** só `/convite/*`. `public/well-known/` traz os arquivos, servidos em `/.well-known/` por rewrite no alvo `main` do Hosting; `assetlinks.json` tem só a chave de debug, adicione a de release antes da Play Store.

## Variáveis de ambiente

Copie `.env.example` → `.env`. Prefixo `VITE_` é obrigatório para variáveis consumidas no frontend.

| Variável | Uso |
|----------|-----|
| `VITE_FIREBASE_*` | Config Firebase (obrigatório) |
| `VITE_USE_EMULATORS` | `true` liga Auth, Firestore, Storage e Functions nos emuladores locais (`VITE_EMULATOR_HOST`, `VITE_EMULATOR_<AUTH\|FIRESTORE\|STORAGE\|FUNCTIONS>_PORT` opcionais) |
| `VITE_NATIVE_APP_CHECK` | `true` liga o App Check no app nativo, depois de registrar App Attest e Play Integrity no console |
| `GEMINI_API_KEY` | Integrações de IA (quando aplicável) |
| `APP_URL` | URL de hospedagem |

Nunca commite `.env` com credenciais reais.

## Convenções de código

- **TypeScript estrito** — tipos em `src/types/`; evite `any` sem necessidade.
- **Lazy loading** — telas pesadas e mini-apps via `React.lazy`.
- **Estilo visual** — bancada escura de 1999 (`DESIGN.md`): sem contorno de quatro lados em botões e blocos (separação por tom, relevo e `shadow-hairline`), sem slogans, subtítulos ou numeração de itens; fontes Space Grotesk, Inter e JetBrains Mono; accent `#FF8C00`. O walkman, a tela LCD do Nokia e os mini-apps de época mantêm seus contornos e texturas.
- **Idioma** — UI, lore e comentários em **português (BR)**; identificadores de código em inglês.
- **Escopo mínimo** — altere só o necessário; não refatore áreas não relacionadas à tarefa.
- **Testes** — o front não tem suíte; valide com `npm run lint`. Regras e Functions têm testes no emulador (`backend/rules-tests`).

## Onde mexer para tarefas comuns

| Tarefa | Onde olhar |
|--------|------------|
| Fluxo do jogador / walkman | `src/Player.tsx`, `src/player/`, `src/components/player/` |
| Nova tela do jogador (`AppScreen`) | `src/player/components/PlayerScreenRouter.tsx` (+ lazy inline) e `useAppScreenHistory` |
| Nova campanha | Admin (Missões → Nova missão), gravada em `workspaces/{ws}/campaigns` |
| Novo intel hardcoded | `src/data/intel_registry.ts` |
| Lógica de unlock / intel | `src/services/IntelService.ts`, `IntelEngine.ts` |
| Auth e perfil | `src/store/profile.ts`, `LoginScreen.tsx` |
| CRUD Firestore | `src/store/firestore.ts` |
| Painel admin | `src/admin/components/`; destinos, seções e caminhos em `src/admin/lib/adminNavigation.ts` |
| Nova seção do admin | `adminNavigation.ts` (config + `adminPath`) e o painel do destino (`ContentPanel`, `MesaPanel`, `OperationsPanel` ou `MissionWorkspace`) |
| Conteúdo narrativo SMS | `sms/*.md` |
| Deploy / hosting | submódulo `backend/` |

## Guardrails

- **Não** modifique `vite.config.ts` (HMR/disabled) sem motivo explícito — comentário indica uso em AI Studio.
- **Não** commite secrets, `.env` ou `firebase-applet-config.json` com chaves reais.
- **Não** crie commits ou PRs sem o usuário pedir explicitamente.
- **Não** adicione README/docs extras sem solicitação — este `AGENTS.md` é o índice para IAs.
- Respeite o modelo **conta → personagem → intel**; progresso fica em `users/{uid}/characters/{charId}/intel`, e o agente pertence a uma pasta (`workspaceId`).
- **Não** leia nem grave coleções globais de conteúdo no cliente: use `wsCollection`/`wsDoc` de `src/lib/tenantScope.ts`. Escritas de roster, co-mestres, convites, intel e conquistas do jogador passam pelas Functions.
- **Não** rode `migrate-to-workspaces.cjs --apply` contra produção sem o usuário pedir.
- Mini-apps (`BiosTerminal`, `LimboBoard`, `DiskRepairApp`, etc.) são experiências narrativas — preserve tom e imersão ao editar textos.

## Fluxo mental do jogador

```
Convite (/convite/:token) → Login → Seleção de personagem (com a mesa de cada agente) → Seleção de campanha → Dispositivo (walkman/nokia)
  → Consumo de Intel → Mini-apps desbloqueáveis (bios, limbo, terminal, win95...)
```

## Arquivos de entrada recomendados para contexto rápido

1. `AGENTS.md` (este arquivo)
2. `src/App.tsx` — rotas
3. `src/Player.tsx` — entry do jogador
4. `src/player/context/PlayerProviders.tsx` — estado de sessão e playback
5. `src/types/player.ts` + `src/types/intel.ts` — modelos
6. `src/services/IntelEngine.ts` — arquitetura do sistema Intel
7. `src/store/firestore.ts` — persistência

---

*Última revisão: nov/2026 (multi-tenant: pastas por mestre, convites, co-mestres). Atualize este arquivo quando a arquitetura ou comandos mudarem.*
