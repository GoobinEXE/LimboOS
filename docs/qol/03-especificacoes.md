# Especificações técnicas dos itens de qualidade de vida

Geradas em 18/11/2026 a partir de docs/qol/01-varredura.md, com cada item conferido no código (commit 3860322).

## Jogador

# Especificação técnica: Jogador (J01 a J16)

Convenções: `AE` = src/services/AudioEngine.ts, `UWP` = src/player/hooks/useWalkmanPlayback.ts. Fundações F1 (Toast com ação), F2 (useOnlineStatus e isNetworkError), F5 (persistência por agente), F6 (pilha de overlays). Ordem sugerida de implementação: F1, F2, F5, J13, J01, J03, J12, J14, depois o restante.

### J01 · Falha de carregamento de áudio sem aviso
- **Status:** confirmado. O listener `error` em `AE:28-31` só chama `console.warn`; o toast `toast.playbackFail` só dispara no `.catch` de `audioEngine.play()` em `UWP`. Se o `error` ocorre com a fita já em PLAYING, o status fica preso em PLAYING sem som.
- **Arquivos:** a mudança fica em `src/services/AudioEngine.ts`, `src/player/hooks/useWalkmanPlayback.ts`, `src/i18n/locales/{pt-BR,en}/player.json`.
- **Abordagem:** Adicionar `AE.setOnError(cb)` (mesmo padrão de `setOnEnded`) chamado no listener `error` quando `audio.src` é válido, com o `MediaError.code`. Em `UWP`, registrar o callback num `useEffect` ao lado do de `setOnEnded`: voltar `setWalkmanStatus('LOADED')`, chamar `addToast` com a nova chave `toast.tapeLoadFail` e `action` de F1 que executa `audioEngine.loadTrack(currentIntel.mediaUrl)` seguido de `setWalkmanStatus('PLAYING')`. Usar `isNetworkError`/`useOnlineStatus` (F2) para escolher entre mensagem de rede e de arquivo. Deduplicar com o toast do `.catch` do `play()` usando um ref `lastErrorToastAt` (janela de 1 s).
- **Depende de:** este item depende de F1, F2, J13.
- **Backend:** o item não altera Functions, regras nem configuração do Hosting.
- **Aceite:** (1) Inserir fita com `mediaUrl` quebrada no emulador: aparece o toast "FITA ILEGÍVEL" com botão e o status volta a LOADED. (2) Com a rede desligada durante a reprodução, o toast aparece uma vez só. (3) Corrigindo a URL e tocando o botão de ação, a fita toca.
- **Texto novo:** sim, com as chaves `toast.tapeLoadFail`, `toast.tapeLoadFailSub`, `toast.tapeLoadFailOffline`, `toast.action.retry` (compartilhada, em common).

### J02 · Erros de sincronização engolidos no console
- **Status:** confirmado. Cinco `onSnapshot` com `console.warn` em `PlayerSyncService.ts:95,136,155,190,201`. Um erro de snapshot encerra o listener, então a reassinatura é obrigatória, não só aviso.
- **Arquivos:** a mudança fica em `src/services/PlayerSyncService.ts`, `src/player/hooks/usePlayerSync.ts`, `src/player/types.ts`, `src/player/context/*` (expor `syncError` e `retrySync`), `src/player/components/PlayerRootShell.tsx` (faixa de aviso), `src/i18n/locales/{pt-BR,en}/player.json`.
- **Abordagem:** Em `PlayerSyncService`, trocar os cinco callbacks por um `reportError(source, error)` que notifica um listener opcional; `subscribeToPlayerData` (chamado em `usePlayerSync.ts:40`) recebe `onError`. `usePlayerSync` guarda `syncError` em estado e expõe `retrySync`, que faz `stopAll()` e chama `subscribeToPlayerData` de novo. Ignorar `permission-denied` durante logout/troca de agente (`stopAll` em curso). Renderizar uma faixa discreta no shell com botão; limpar `syncError` no primeiro snapshot bem-sucedido. Usar F2 para esconder a faixa e mostrar "sem rede" quando offline.
- **Depende de:** este item depende de F2.
- **Backend:** o item não altera Functions, regras nem configuração do Hosting.
- **Aceite:** (1) Com emuladores, derrubar o Firestore: faixa "SINAL INSTÁVEL" aparece em até alguns segundos. (2) Religar e tocar "Tentar de novo": faixa some e intel novo chega sem recarregar. (3) Logout não dispara a faixa.
- **Texto novo:** sim, com as chaves `sync.error.title`, `sync.error.body`, `sync.error.retry`, `sync.error.retrying`.

### J03 · Sem indicador de buffering na fita
- **Status:** confirmado. Não há listeners `waiting`/`stalled`/`canplay`/`playing` em `AE:19-32`. O estado `LOADING` do `WalkmanStatus` existe, mas só cobre os 400 ms do timer de inserção.
- **Arquivos:** a mudança fica em `src/services/AudioEngine.ts`, `src/player/hooks/useWalkmanPlayback.ts`, `src/components/player/CassetteVisor.tsx`, `src/components/player/NokiaPlayer.tsx`, `src/i18n/locales/{pt-BR,en}/player.json`.
- **Abordagem:** `AE` ganha `setOnBuffering(cb: (b: boolean) => void)`: `waiting`/`stalled` emitem true, `playing`/`canplay` emitem false. `UWP` guarda `isBuffering` (estado separado, sem criar status novo para não mexer em `analyticsTracker` nem em `screenHistoryModel`) e o devolve no retorno. `CassetteVisor` troca o texto do visor por `walkman.visor.buffering` e acelera/pausa a animação das engrenagens quando `isBuffering`; no Nokia, mostrar `nokia.state.buffering` no lugar de PLAYING. Respeitar `prefers-reduced-motion`.
- **Depende de:** o item não depende de outro item nem de fundação.
- **Backend:** o item não altera Functions, regras nem configuração do Hosting.
- **Aceite:** (1) Com throttling "Slow 3G" no preview, ao tocar a fita o visor mostra "CARREGANDO FITA..." e some quando o som começa. (2) Em rede normal o texto não pisca (atrasar a exibição em 300 ms). (3) Nokia mostra o equivalente.
- **Texto novo:** sim, com as chaves `walkman.visor.buffering`, `nokia.state.buffering`.

### J04 · Atalhos de mídia só no app nativo
- **Status:** confirmado. `session()` em `mediaSession.ts:11` exige `isNative()`.
- **Arquivos:** a mudança fica em `src/lib/native/mediaSession.ts` (ou mover para `src/lib/mediaSession.ts` mantendo o re-export), `src/player/hooks/useWalkmanPlayback.ts`.
- **Abordagem:** Remover `isNative()` de `session()`, mantendo a detecção `'mediaSession' in navigator`; o try/catch já protege `setActionHandler` com ações não suportadas. O efeito de `UWP` que chama `updateMediaSession` já cobre play e pause; adicionar `seekbackward`/`seekforward` (10 s) via `audioEngine.seekBy` (criado em J05) e tratar `MediaMetadata` ausente. Em `clearMediaSession`, limpar também as novas ações. O comentário "tela de bloqueio" deve passar a dizer "sistema".
- **Depende de:** este item depende de J05 (só para `seekBy`; sem ele, entregar apenas play e pause).
- **Backend:** o item não altera Functions, regras nem configuração do Hosting.
- **Aceite:** (1) No Chrome desktop, tocar uma fita: o painel de mídia do navegador mostra o título e a tecla Play/Pause do teclado controla a fita. (2) Ejetar a fita remove o card. (3) No simulador iOS o comportamento atual se mantém.
- **Texto novo:** o item não cria nem altera textos de interface.

### J05 · Teclado do player sem play, pausa e busca
- **Status:** confirmado. `useDesktopPlayerShortcuts.ts:34-60` trata só `Escape` e `P`. A assinatura atual não recebe nada de playback, então muda.
- **Arquivos:** a mudança fica em `src/player/hooks/useDesktopPlayerShortcuts.ts`, `src/player/components/PlayerRootShell.tsx` (chamada na linha 50), `src/services/AudioEngine.ts` (novo `seekBy(deltaSeconds)` com clamp em `[0, duration]`).
- **Abordagem:** Acrescentar um parâmetro opcional `media?: { isPlaying; toggle(); seekBy(s); toggleMute() }`, montado em `PlayerRootShell` a partir de `playback` (`handleSetIsPlaying(!isPlaying)`, `handleToggleMute`). Atalhos ativos só com `screen === 'player'`, sem `[aria-modal="true"]` aberto (F6 substitui essa checagem quando existir) e sem alvo digitável. Espaço ignora quando o foco está em `button`, `a` ou `[role=slider]` para não duplicar o clique nativo. Setas esquerda/direita fazem ±10 s só para `AudioIntel` (vídeo do Nokia fica fora, via `videoSurfaceRef` fora do escopo). `M` alterna mudo.
- **Depende de:** este item depende de F6 (opcional).
- **Backend:** o item não altera Functions, regras nem configuração do Hosting.
- **Aceite:** (1) Com fita carregada, Espaço alterna tocar e pausar sem rolar a página. (2) Setas avançam e recuam 10 s (`audio.currentTime` muda). (3) Digitar no campo de SMS do Nokia não dispara nada.
- **Texto novo:** o item não cria nem altera textos de interface.

### J06 · Login sem "esqueci a senha" nem mostrar senha
- **Status:** parcial. O botão de mostrar senha é viável. O link de recuperação por `sendPasswordResetEmail` não funciona: `masterIdToEmail` em `store/profile.ts:20` gera `slug@limboos.local`, um endereço inexistente, e a conta nem tem e-mail real. Além disso, `auth/invalid-credential` em `loginOrCreate` cai no fluxo de criar conta. Recuperação por e-mail exigiria coletar e verificar e-mail real (fora do escopo QoL). Proposta: texto de orientação, sem chamada de reset.
- **Arquivos:** a mudança fica em `src/components/LoginScreen.tsx`, `src/i18n/locales/{pt-BR,en}/player.json`.
- **Abordagem:** Estado `showPassword` alterna `type` entre `password` e `text` no input `#login-password`; botão `type="button"` à direita com ícones `Eye`/`EyeOff` de lucide, `aria-pressed`, alvo mínimo 44 px, `tabIndex` natural. Abaixo do campo, uma linha `login.hint.lostAccess` orientando a falar com o administrador (a Function `adminResetPassword` já permite ao admin da plataforma trocar a senha). Resetar `showPassword` ao enviar.
- **Depende de:** o item não depende de outro item nem de fundação.
- **Backend:** a parte de backend fica assim: não (decisão de produto pendente: coletar e-mail real para reset automático fica como item futuro).
- **Aceite:** (1) O botão revela e oculta a senha e o leitor de tela anuncia "pressionado". (2) A dica aparece sem deslocar o botão Entrar em 360 px. (3) Nenhuma chamada a `sendPasswordResetEmail` no bundle.
- **Texto novo:** sim, com as chaves `login.password.show`, `login.password.hide`, `login.hint.lostAccess`.

### J07 · Falha de rede no login vira mensagem genérica
- **Status:** parcial. `loginOrCreate` já mapeia `auth/network*` para `auth.error.noConnection` (`profile.ts:187`), então o caso de rede no login por senha já funciona. Faltam: `auth/too-many-requests` (cai em `unexpected`), e o caminho de criação: um erro de rede no `createUserWithEmailAndPassword` (`profile.ts:167-169`) vira "Erro ao criar perfil." porque não passa por `startsWith('auth/network')`. Ocorre o mesmo em `loginWithProvider` para `too-many-requests`.
- **Arquivos:** a mudança fica em `src/store/profile.ts`, `src/i18n/locales/{pt-BR,en}/common.json`.
- **Abordagem:** Extrair `mapAuthError(code)` privado em `profile.ts` que devolve `{ error, message }` para `auth/network-request-failed`, `auth/too-many-requests`, `auth/user-disabled`; usá-lo no `catch` interno de criação (antes de `profileErrorMessage`), no `catch` externo e em `loginWithProvider`. Reutilizar `isNetworkError` (F2) para o teste de rede. Adicionar `'rate_limited'` ao union de `LoginResult.error`, sem mudar chamadores que só leem `message`.
- **Depende de:** este item depende de F2.
- **Backend:** o item não altera Functions, regras nem configuração do Hosting.
- **Aceite:** (1) Com rede desligada, login por senha e por criação mostram "SEM CONEXÃO". (2) Simular `too-many-requests` (emulador Auth permite forçar) mostra a mensagem de bloqueio. (3) Senha errada continua mostrando a mensagem atual.
- **Texto novo:** sim, com as chaves `auth.error.tooManyRequests` e ajuste opcional de `auth.error.noConnection`.

### J08 · Convite com falha só mostra "não encontrado"
- **Status:** confirmado. `.catch` em `InviteApp.tsx:38` força `reason: 'not-found'` para qualquer erro, e a tela inválida só oferece "Ir para o início". `inviteService.preview` usa `callFunction` (`getInvitePreview`), que lança em rede caída.
- **Arquivos:** a mudança fica em `src/invite/InviteApp.tsx`, `src/i18n/locales/{pt-BR,en}/common.json`.
- **Abordagem:** No `catch`, guardar `previewError` separado do `preview`, usando `isNetworkError` (F2) para escolher `invite.reason.network` ou `invite.reason.unexpected`. Extrair o efeito para uma função `loadPreview` com contador `attempt` no deps array; quando houver `previewError`, renderizar o mesmo cartão com botão "Tentar novamente" que incrementa `attempt`. Reentrar automaticamente quando `useOnlineStatus` voltar a true. O ramo `not-found` real (resposta do servidor) permanece inalterado.
- **Depende de:** este item depende de F2.
- **Backend:** o item não altera Functions, regras nem configuração do Hosting.
- **Aceite:** (1) Abrir `/convite/<token válido>` offline: cartão "SEM SINAL" com botão. (2) Religar e tocar o botão: aparece o convite válido. (3) Token inexistente continua mostrando "não encontrado".
- **Texto novo:** sim, com as chaves `invite.reason.network`, `invite.reason.unexpected`, `invite.retry`.

### J09 · ErrorBoundary só recarrega a página
- **Status:** confirmado. Há um único `ErrorBoundary` global (`App.tsx:43`) e `MiniAppsOverlay.tsx` não tem boundary próprio; o único recurso é `window.location.reload()` (`ErrorBoundary.tsx:48-54`).
- **Arquivos:** a mudança fica em `src/components/ErrorBoundary.tsx` (aceitar `onReset` e variante compacta), `src/player/components/MiniAppsOverlay.tsx`, `src/i18n/locales/{pt-BR,en}/common.json`.
- **Abordagem:** Adicionar props `onReset?: () => void` e `resetKey?: string` ao boundary (reseta o estado em `componentDidUpdate` quando a chave muda). Em `MiniAppsOverlay`, envolver o conteúdo dentro de `React.Suspense` com `<ErrorBoundary resetKey={screen} fallback={...} onReset={exitMiniApp}>`. O fallback usa o visual de placa existente com título `errorBoundary.miniApp.title` e botão que chama `exitMiniApp` (volta ao aparelho sem perder a fita, pois `PlayerProviders` continua montado). Logar o erro com `activityLogger.logSystem` se já disponível no contexto; senão manter `console.error`.
- **Depende de:** o item não depende de outro item nem de fundação.
- **Backend:** o item não altera Functions, regras nem configuração do Hosting.
- **Aceite:** (1) Forçar um `throw` em `BiosTerminal` no preview: aparece "CONEXÃO PERDIDA" dentro do overlay, o walkman segue ao fundo. (2) O botão volta ao player com a fita e o tempo intactos. (3) O boundary global continua valendo para erros fora dos mini-apps.
- **Texto novo:** sim, com as chaves `errorBoundary.miniApp.title`, `errorBoundary.miniApp.body`, `errorBoundary.miniApp.back`.

### J10 · Botões do walkman abaixo de 44 px
- **Status:** confirmado. `BottomControls.tsx:63-64`: no modo compacto `sideBtn = 'w-12 h-9'` (48x36) e `playBtn = 'w-16 h-10'` (64x40); no normal `h-10` e `h-12`. Os botões do Nokia (`w-8 h-8`, `w-10 h-9` em `NokiaPlayer.tsx:754-775`) também ficam abaixo de 44 px; o relato original só cita o walkman.
- **Arquivos:** a mudança fica em `src/components/player/BottomControls.tsx`, `src/components/player/NokiaPlayer.tsx` (botões de transporte e volume).
- **Abordagem:** Manter as dimensões visuais e ampliar a área com um pseudo-elemento `relative before:absolute before:-inset-1.5 before:content-['']` (calculando o inset por botão para chegar a 44 px em cada eixo), sem alterar `gap`. Garantir que áreas expandidas de botões vizinhos não se sobreponham (gap mínimo no Nokia é `gap-1.5`, então usar `before:-inset-x-0.5 before:-inset-y-1`).
- **Depende de:** o item não depende de outro item nem de fundação.
- **Backend:** o item não altera Functions, regras nem configuração do Hosting.
- **Aceite:** (1) Inspecionar no preview 375x812: `getBoundingClientRect` do pseudo-alvo (via hit test) tem pelo menos 44 px em altura. (2) Visual idêntico em captura antes e depois. (3) Tocar no limite superior do botão aciona o botão correto, sem acionar o vizinho.
- **Texto novo:** o item não cria nem altera textos de interface.

### J11 · Rótulos de acessibilidade ausentes nos controles
- **Status:** parcial. Confirmado para `NokiaPlayer.tsx`, `NokiaVideoSurface.tsx` e `TapeLibrary.tsx` (zero `aria-label`). Já corrigido em `BottomControls.tsx` e `SideControls.tsx` (existem `aria-label` para rewind, play/pause, volume, modo). `TapeLibrary` já tem `aria-current` nos itens.
- **Arquivos:** a mudança fica em `src/components/player/NokiaPlayer.tsx`, `src/components/player/NokiaVideoSurface.tsx`, `src/components/player/TapeLibrary.tsx`, `src/i18n/locales/{pt-BR,en}/player.json`.
- **Abordagem:** No Nokia, dar `aria-label` aos botões de ícone (rewind, play/pause com `aria-pressed={isPlaying}`, ejetar, volume, sair do scanner, back, home, mudo, DOS, perfil) reutilizando `walkman.rewind|play|pause|volume` e `nokia.nav.*`; criar só as chaves faltantes (`nokia.aria.eject`). No `TapeLibrary`, `aria-label` do item com título, tipo e estado (`walkman.library.itemAria`), e o indicador de tocando com `aria-hidden`. No `<video>` de `NokiaVideoSurface`, `aria-label` com o título e container com `role="group"`. O ícone de tipo com `title=` vira `aria-hidden` porque o tipo vai no label do item.
- **Depende de:** o item não depende de outro item nem de fundação.
- **Backend:** o item não altera Functions, regras nem configuração do Hosting.
- **Aceite:** (1) `read_page` no preview lista nome acessível para todos os botões do Nokia. (2) Item da fita é anunciado como "título, tipo, tocando agora". (3) Auditoria accesslint sem `button-name`.
- **Texto novo:** sim, com as chaves `nokia.aria.eject`, `nokia.aria.scanClose`, `walkman.library.itemAria`, `walkman.library.nowPlaying`, `nokia.aria.video`.

### J12 · Sem retomar de onde parou
- **Status:** confirmado. `AE.stop()` (`AE:77,83`) zera `currentTime` e nada persiste posição. Escopo só de áudio (`AudioIntel`); posição de vídeo não é guardada.
- **Arquivos:** a mudança fica em `src/services/AudioEngine.ts` (novos `seekTo(t)` e callback `onLoadedMetadata`), `src/player/hooks/useWalkmanPlayback.ts`, módulo F5 (novo, `src/lib/agentStorage.ts` ou o nome definido na F5), `src/i18n/locales/{pt-BR,en}/player.json`.
- **Abordagem:** Gravar `{intelId, t, savedAt}` pelo F5 (chave uid+characterId) a cada 5 s de reprodução, ao pausar e em `pagehide`. Ao carregar uma fita com posição guardada entre 5 s e `duration - 5 s`, chamar `audioEngine.seekTo(t)` no `loadedmetadata` e mostrar um toast com `action` "Do início" (F1) que zera. Limpar o registro em `ended`, em rewind concluído (`stop()`) e ao ejetar. Trocar de agente usa a chave nova, então não vaza.
- **Depende de:** este item depende de F5, F1, J14 (restaura qual fita estava dentro).
- **Backend:** o item não altera Functions, regras nem configuração do Hosting.
- **Aceite:** (1) Tocar uma fita por 30 s, recarregar, reinserir: o áudio retoma perto de 0:30 e o toast oferece "Do início". (2) Fita terminada reabre do início. (3) Dois agentes guardam posições independentes.
- **Texto novo:** sim, com as chaves `toast.resumeTape`, `toast.resumeTapeSub`, `toast.action.fromStart`.

### J13 · Nenhuma ação de "tentar de novo" em erros
- **Status:** confirmado. `Toast` em `ToastNotification.tsx` não tem `action`, e `useToasts.ts` só repassa. É o lado jogador da fundação F1.
- **Arquivos:** a mudança fica em `src/components/ToastNotification.tsx`, `src/player/hooks/useToasts.ts`, `src/player/hooks/useWalkmanPlayback.ts` (usos em `playbackFail`, `unknownCode`, `qrError`), `src/components/campaign/*` (erros de carregamento de campanha), `src/i18n/locales/{pt-BR,en}/{player,common}.json`.
- **Abordagem:** Estender `Toast` com `action?: { label: string; onClick: () => void }`. Em `ToastItem`, renderizar um `<button>` com 44 px de alvo; `pointer-events-auto` (o contêiner usa `pointer-events-none`); pausar o timer de 3500 ms enquanto houver foco ou hover, e subir a duração para 8 s quando há ação. Anunciar via `aria-live` já existente; `Esc` dispensa. Aplicar em `playbackFail` (replay), `unknownCode` ("Escanear de novo" reabre o scanner via `handleScanClick`) e `qrError` (repete `handleQrDetected(code)`). O formato deve coincidir com o do admin (F1) para compartilhar tipo, se o arquiteto extrair.
- **Depende de:** este item depende de F1 (é o lado jogador de F1).
- **Backend:** o item não altera Functions, regras nem configuração do Hosting.
- **Aceite:** (1) Código QR inválido mostra toast com "Escanear de novo" que reabre o scanner. (2) O toast não some enquanto o ponteiro está sobre ele. (3) Toasts sem ação mantêm o comportamento atual.
- **Texto novo:** sim, com as chaves `toast.action.retry`, `toast.action.scanAgain`, `toast.action.dismiss` (ver planilha).

### J14 · Estado do walkman não persiste
- **Status:** parcial. A tela já persiste na URL: `buildScreenSearch` grava `?s=<screen>` e `useAppScreenHistory` restaura (exceto `player` e `characterSelection`, que são o padrão). Falta a fita atual (`intelId`) e a missão: o `activeCampaign` deriva de `playerData.character.campaignId` (`useActiveCampaign.ts`), então a missão já volta. Por isso o escopo real é `intelId` por agente. Detalhe adicional: `nokia_active_tab` e `nokia_active_conv` usam chave global em `sessionStorage` (`NokiaPlayer.tsx:205-213,579`), então vazam entre agentes na mesma aba.
- **Arquivos:** a mudança fica em módulo F5, `src/player/hooks/useWalkmanPlayback.ts`, `src/components/player/NokiaPlayer.tsx`.
- **Abordagem:** Gravar `intelId` pelo F5 sempre que `currentIntel?.id` mudar (e limpar no eject e em `resetPlayback`). Após `playerData` e o catálogo de intel carregarem, em um efeito de montagem, resolver o id entre os intel desbloqueados (catálogo de `usePlayerIntel`) e chamar `setCurrentIntel` + `setWalkmanStatus('LOADED')` sem tocar automaticamente. Pular a restauração se `activeEvidence` ou missão não bater. Migrar as duas chaves do Nokia para o módulo F5 (por uid+characterId).
- **Depende de:** este item depende de F5.
- **Backend:** o item não altera Functions, regras nem configuração do Hosting.
- **Aceite:** (1) Inserir uma fita, recarregar: a mesma fita aparece em LOADED, sem tocar. (2) Trocar de agente e recarregar: cada agente restaura a sua fita. (3) Fita removida do catálogo: nenhuma restauração e nenhum erro.
- **Texto novo:** o item não cria nem altera textos de interface.

### J15 · Progresso da fita sem teclado fino
- **Status:** parcial. O slider em `TapeProgress.tsx` não é a barra de tempo de uma fita: indexa as campanhas em `CampaignSelection` (`total=campaigns.length`). Tem `role=slider` e `aria-valuemin/max/now`, mas falta `tabIndex={0}`, `onKeyDown` e `aria-valuetext`; sem `tabIndex` ele não recebe foco. Setas de 5 s não se aplicam; o passo é 1 registro.
- **Arquivos:** a mudança fica em `src/components/campaign/TapeProgress.tsx`, `src/i18n/locales/{pt-BR,en}/player.json`.
- **Abordagem:** Adicionar `tabIndex={onChange ? 0 : -1}` e `onKeyDown`: ArrowLeft/ArrowDown e ArrowRight/ArrowUp mudam ±1, PageUp/PageDown ±3, Home e End vão aos extremos, todos com `preventDefault` e clamp em `[0, total-1]`. Incluir `aria-valuetext` com `campaign.progressValueText` (posição e total), `aria-orientation="horizontal"` e foco visível pelo estilo `focus-visible` do projeto. Corrigir o `aria-label` para algo como "Navegação entre campanhas" (já existe).
- **Depende de:** o item não depende de outro item nem de fundação.
- **Backend:** o item não altera Functions, regras nem configuração do Hosting.
- **Aceite:** (1) Tab foca o slider e o anel de foco aparece. (2) Setas trocam a campanha centralizada; Home e End vão à primeira e à última. (3) Leitor anuncia "Missão 2 de 5".
- **Texto novo:** sim, com as chaves `campaign.progressValueText`.

### J16 · Tela sempre acesa durante a escuta
- **Status:** confirmado. Não há `wakeLock` no código.
- **Arquivos:** a mudança fica em `src/lib/wakeLock.ts` (novo), `src/player/hooks/useWalkmanPlayback.ts`.
- **Abordagem:** Helper `acquireWakeLock(): Promise<() => void>` que usa `navigator.wakeLock?.request('screen')` dentro de try/catch (falha em bateria baixa e em iframe) e devolve a função de liberação. Em `UWP`, um `useEffect` com dependência `walkmanStatus === 'PLAYING'` e `currentIntel instanceof AudioIntel` adquire e libera no cleanup. O sistema libera o lock quando a aba fica oculta, então ouvir `visibilitychange` e readquirir ao voltar visível enquanto ainda tocando. Sem dependência nativa; no WebView iOS 16.4 ou superior funciona, abaixo disso falha silenciosamente.
- **Depende de:** o item não depende de outro item nem de fundação.
- **Backend:** o item não altera Functions, regras nem configuração do Hosting.
- **Aceite:** (1) No Chrome, tocar a fita e executar `navigator.wakeLock` não é possível inspecionar direto; verificar via flag de teste exposta em `window.__wakeLockActive` apenas em dev. Esperado: true enquanto toca, false ao pausar e ao ejetar. (2) Em navegador sem suporte, nenhum erro no console. (3) Voltar à aba reativa o lock.
- **Texto novo:** o item não cria nem altera textos de interface.

## Painel do mestre

# Especificação técnica: Painel do mestre (M01 a M15)

Notas gerais confirmadas no código:
- Toast do admin: `src/admin/components/ToastProvider.tsx` (`useToast()` com `success/error/info(message)`, máximo 3, `AUTO_DISMISS_MS = 4000`, cada toast é um único `<motion.button>` que descarta ao clicar). F1 se aplica assim: `ToastContextValue` ganha um segundo parâmetro `opts?: { action?: { label: string; onClick: () => void }; durationMs?: number }`; `AdminToast` deixa de ser um `<button>` (botão dentro de botão é inválido) e vira `<div role="status">` com um botão de dispensar e, se houver `action`, um segundo botão; a barra `toast-countdown` e o timer usam `toast.durationMs ?? AUTO_DISMISS_MS`; o fallback fora do provider também aceita o segundo argumento. Ação com `durationMs` de 8000 para desfazer.
- Confirmação: `useModal()` em `ConfirmModal.tsx` expõe só `showConfirm(title, message, confirmLabel)`; não há checkbox nem terceiro botão (relevante para M14).
- Destinos e seções do admin ficam montados (keep-alive em `Dashboard.tsx` e `AdminSectionPanels.tsx`, estado `visited`), então estados locais de `useState` sobrevivem à troca de seção e de destino (relevante para M07 e M12).
- i18n do admin tem `pt-BR/admin.json` e `en/admin.json` com as mesmas chaves (1044 linhas cada); toda chave nova entra nos dois. Vários painéis ainda têm texto fixo em português dentro do JSX e dos hooks (`useIntelCatalog.ts`, `IntelEditorModal.tsx`, `MediaLibraryPanel.tsx`, `RedirectsPanel.tsx`); texto novo deve sair já em i18n, sem migrar o legado.
- Regras do Firestore: `users/{uid}/characters/{c}/intel/*` e `.../achievements/*` aceitam escrita direta de quem é GM do personagem (`isGmOfChar`, `backend/firestore.rules` linhas 475 a 482), então revogar entrega no cliente funciona sem Function nova. Nenhum item abaixo exige mudar `backend/`.

### M01 · Duplicar intel, conquista, NPC e missão
- **Status:** confirmado. Nenhum `duplicate` existe em `src/admin`. Dois cuidados que a varredura não cita: a cópia de intel de mídia aponta para o mesmo arquivo do Storage, e a missão não tem editor modal (usa o rascunho `drafts['new']` do `CampaignsPanel`).
- **Arquivos:** a mudança fica em `src/admin/hooks/useIntelCatalog.ts` (novo `handleDuplicateItem`), `src/admin/components/intel/IntelCatalogPane.tsx` (nova prop `onDuplicate` e `IconBtn` ao lado de "Editar", linha 239), `src/admin/components/MediaLibraryPanel.tsx` (repassa `intel.handleDuplicateItem`), `src/admin/hooks/useAchievementEditor.tsx` (novo `openDuplicate`), `src/admin/components/AchievementsPanel.tsx` (botão perto da linha 355), `src/admin/hooks/useNpcContactEditor.tsx` (novo `openDuplicate`), `src/admin/components/NpcSmsPanel.tsx` (botão perto da linha 459), `src/admin/components/CampaignsPanel.tsx` (novo `handleDuplicateCampaign`, botão no rodapé do card, linha 452).
- **Abordagem:** Intel: reutilizar o corpo de `handleEditItem` com `setEditingItem(null)`, `id: item-${Date.now()}` (mesmo formato de `handleNewItem`) e `title` com sufixo "(cópia)", de modo que o salvar passe por `intelService.persistChanges` como item novo. Conquista e NPC: `openDuplicate(def)` chama `formFromDef(def)` / copia o contato com `isEdit=false`, gera id novo (`${id}_COPIA`, `_COPIA2` se já existir em `defs`/`contacts`, em maiúsculas para o NPC como em `saveContact`) e zera `source` para `custom`. Missão: `setDraft(NEW_MISSION_SEGMENT, { ...campaign, id: createNewCampaignDraft().id, name: `${name} (cópia)` })` e `nav.go(adminPath.newMission())`; o efeito da linha 130 só recria o rascunho em branco quando `drafts[new]` não existe, então o rascunho copiado é preservado. Não copiar vínculos (esquadrões, intel, conquistas, NPCs da missão): só os campos de Dados. Na cópia de intel com `mediaUrl`, não copiar `storagePath` (só a URL), para que "Apagar também o arquivo" na cópia nunca apague o arquivo da origem; avisar o inverso no texto do rascunho.
- **Depende de:** o item não depende de outro item nem de fundação.
- **Backend:** o item não altera Functions, regras nem configuração do Hosting.
- **Aceite:** (1) Na lista de intel, "Duplicar" abre o editor com todos os campos preenchidos, título terminando em "(cópia)" e id diferente; salvar cria um segundo item sem alterar o original. (2) Duplicar uma conquista e um NPC abre o editor em modo criação (título "Nova conquista" / "Novo contato") e o id não colide com o original. (3) Duplicar uma missão abre `/admin/missions/new` com os dados copiados e o nome com "(cópia)"; salvar cria uma missão sem esquadrões nem recursos vinculados.
- **Texto novo:** sim, com as chaves `intel.catalog.duplicate`, `achievements.duplicate`, `npcSms.duplicate`, `missions.duplicate`, `common.copySuffix`.

### M02 · Proteger editores modais contra perda de rascunho (F3)
- **Status:** confirmado. `IntelEditorModal` fecha por Esc (via `OverlayPortal`) e `onClose`; `AchievementEditorModal` e `NpcContactEditorModal` fecham por clique no fundo (`onMouseDown`), X e "Cancelar" sem comparar nada, e só `MissionWorkspace` usa `setUnsavedChanges`. Os dois últimos modais não usam `OverlayPortal`, logo não fecham com Esc hoje.
- **Arquivos:** a mudança fica em novo `src/admin/hooks/useDraftGuard.ts`; edita `src/admin/hooks/useIntelCatalog.ts` (ou `intel/IntelEditorHost.tsx`), `src/admin/hooks/useAchievementEditor.tsx`, `src/admin/hooks/useNpcContactEditor.tsx`, e os três modais para chamar `requestClose` no lugar de `onClose` no fundo, X, Cancelar e Esc.
- **Abordagem:** `useDraftGuard({ key, open, value, extraDirty })` guarda um snapshot (`JSON.stringify(value)`) no instante em que `open` vira `true`, calcula `dirty`, chama `setUnsavedChanges(`modal:${key}`, dirty)` (para o `beforeunload` e a saída para o modo jogador) e devolve `requestClose(close)`, que só chama `close` direto quando limpo; sujo, abre `showConfirm(t('draft.title'), t('draft.body'), t('draft.discard'))` do `useModal` do host. `extraDirty` cobre arquivos fora do formulário (`avatarFile` no NPC, ícone no editor de conquista, upload em andamento na intel). Salvar com sucesso e descartar confirmado limpam a chave. Esc: registrar no `AchievementEditorModal` e no `NpcContactEditorModal` o mesmo `OverlayPortal` já usado pelo de intel, para o comportamento ser igual nos três. `saving` continua bloqueando o fechamento.
- **Depende de:** este item depende de é a própria F3. Usa `showConfirm` existente.
- **Backend:** o item não altera Functions, regras nem configuração do Hosting.
- **Aceite:** (1) Abrir "Nova conquista", digitar um título e clicar no fundo abre a confirmação; "Continuar editando" mantém o texto, "Descartar" fecha. (2) Abrir e fechar sem digitar nada fecha direto, sem diálogo. (3) Com o editor de intel sujo, recarregar a página dispara o aviso do navegador e, depois de salvar, não dispara mais.
- **Texto novo:** sim, com as chaves `draft.title`, `draft.body`, `draft.discard`, `draft.keep`.

### M03 · Seleção em massa e ações em lote no catálogo
- **Status:** confirmado, com ajuste de escopo. Hoje há três superfícies diferentes: a grade de mídia (`MediaLibraryPanel`, seleção única `selectedAssetId`, pasta via `mediaFolderService.setAssetFolders`), o catálogo de intel (`IntelCatalogPane`, vínculo de missão por `campaignId` em `persistChanges`) e a remoção (`handleDeleteItem` com duas confirmações). Proposta: lote só no catálogo de intel (remover, vincular a missão) e na grade de mídia (mover para pasta, remover), com barra única em cada.
- **Arquivos:** a mudança fica em `src/admin/components/intel/IntelCatalogPane.tsx` (checkbox por linha, barra de lote), `src/admin/components/MediaLibraryPanel.tsx` (checkbox por cartão na grade da linha 481, barra, reuso de `MediaFolderAssignModal`), `src/admin/hooks/useIntelCatalog.ts` (`handleBulkDelete(items)`, `handleBulkLink(items, campaignId)`), novo `src/admin/components/BulkActionBar.tsx`.
- **Abordagem:** `useSelection<string>()` de F4 em cada superfície, limpa ao mudar filtro ou pasta. `handleBulkDelete` mostra um único `showConfirm` com contagem e a caixa de arquivo de M14, depois chama `intelService.deleteIntel` em sequência e reporta falhas por item em um único toast (`n removidos, m falharam`). `handleBulkLink` usa `CampaignScopeSelect`/`CampaignBindingPicker` já existentes e roda `intelService.persistChanges({ ...item, campaignId })`. Mover para pasta chama `setAssetFolders` por ativo, mesclando as pastas já existentes. Co-mestre só pode escolher missões de `useAdminScope()`; itens fora do escopo dele já nem aparecem na lista.
- **Depende de:** este item depende de F4 (`useSelection`), M14 (diálogo único com caixa de arquivo).
- **Backend:** o item não altera Functions, regras nem configuração do Hosting.
- **Aceite:** (1) Marcar três intels e escolher "Vincular a missão" grava `campaignId` nos três com um único toast. (2) "Remover" com três marcados mostra um único diálogo com "3 itens". (3) Trocar o filtro de tipo limpa a seleção e esconde a barra.
- **Texto novo:** sim, com as chaves `bulk.selected`, `bulk.clear`, `bulk.moveToFolder`, `bulk.linkMission`, `bulk.remove`, `bulk.removeBody`, `bulk.result`, `bulk.resultPartial`.

### M04 · Confirmar remoção de redirecionamento QR
- **Status:** confirmado. `handleDelete` (linha 80) apaga direto; só o botão que o chama precisa passar por `showConfirm` (já importado no painel via `useModal`). `QrRedirect` (`types/player.ts`) não guarda `campaignId`, então o desfazer recalcula a missão pelo item de destino, como `handleAddRedirect` já faz.
- **Arquivos:** a mudança fica em `src/admin/components/RedirectsPanel.tsx`, `src/admin/components/ToastProvider.tsx` (F1).
- **Abordagem:** `handleDelete(r: QrRedirect)` pede `showConfirm(t('redirects.removeTitle'), t('redirects.removeBody', { sourceId }), t('redirects.removeAction'))`, apaga com `deleteQrRedirect(sourceId)` e dispara `toast.info(t('redirects.removed'), { durationMs: 8000, action: { label: t('common.undo'), onClick: () => saveQrRedirect(r.sourceId, r.targetId, r.reason, intelRegistry.get(r.targetId)?.campaignId ?? null) } })`. O log `qr_redirect_remove` continua; o desfazer registra `qr_redirect_add`.
- **Depende de:** este item depende de F1.
- **Backend:** o item não altera Functions, regras nem configuração do Hosting.
- **Aceite:** (1) Clicar em remover abre o diálogo com o código de origem. (2) Confirmar remove a linha e mostra o toast com "Desfazer". (3) "Desfazer" recria a linha com o mesmo destino e motivo.
- **Texto novo:** sim, com as chaves `redirects.removeTitle`, `redirects.removeBody`, `redirects.removeAction`, `redirects.removed`, `common.undo`.

### M05 · Atalho ⌘S e ⌘Enter para salvar
- **Status:** confirmado. O handler global em `Dashboard.tsx` (linha 369) cobre só ⌘K, ⌘1 a ⌘5 e ⌘\. `MissionDataTab` já é um `<form onSubmit={onSave}>` (linha 47), então basta `requestSubmit()`.
- **Arquivos:** a mudança fica em novo `src/admin/hooks/useSaveShortcut.ts`; edita `IntelEditorModal.tsx`, `AchievementEditorModal.tsx`, `NpcContactEditorModal.tsx`, `mission/MissionDataTab.tsx`. `Dashboard.tsx` não muda.
- **Abordagem:** `useSaveShortcut(active, onSave)` registra um `keydown` em `window` na fase de captura com uma pilha de módulo (o último registrado vence, como `overlayStack` em `OverlayPortal`). Reage a `(meta||ctrl)+S` e `(meta||ctrl)+Enter`, chama `preventDefault` (evita o "Salvar página" do navegador) e ignora quando `saving` ou quando a validação do formulário falharia, que já devolve toast. Cada modal passa o seu `handleSave`; `MissionDataTab` passa `() => formRef.current?.requestSubmit()`. ⌘Enter em `textarea` também salva.
- **Depende de:** este item depende de nada (combina bem com M02, que fecha o modal depois de salvar).
- **Backend:** o item não altera Functions, regras nem configuração do Hosting.
- **Aceite:** (1) Com o editor de conquista aberto, ⌘S salva e fecha, sem abrir o diálogo do navegador. (2) Na seção Dados da missão, ⌘Enter salva. (3) Com dois modais empilhados, só o de cima reage.
- **Texto novo:** sim: dica `saveShortcutHint` no botão salvar (opcional, em `title`).

### M06 · Busca e ordenação nas listas do admin
- **Status:** parcial. O catálogo de intel já tem busca (`search`, linha 118 de `IntelCatalogPane`; falta só ordenar). `AchievementsPanel` e `NpcSmsPanel` já têm busca e `useMemo` de filtro; `RedirectsPanel` também. A aba Recursos da missão mostra no máximo `LIST_LIMIT = 6` itens por coluna e leva ao catálogo filtrado por "Ver no catálogo", então busca ali não se justifica e sai do escopo. Só intel, conquista e NPC não têm ordenação; apenas mídia tem `createdAt` (`types/media.ts`). Intel, conquista e NPC não guardam data, então "mais recentes" vale só para mídia; as demais ordenam por título, tipo e id.
- **Arquivos:** a mudança fica em `src/admin/hooks/useIntelCatalog.ts` (`sort` aplicado em `filteredItems`), `intel/IntelCatalogPane.tsx` (seletor), `MediaLibraryPanel.tsx` (`filteredAssets`, linha 280), `AchievementsPanel.tsx` (`filteredDefs`), `NpcSmsPanel.tsx` (`filteredContacts`/`filteredDialogues`), novo `src/admin/components/SortSelect.tsx`. `mission/MissionResourcesTab.tsx` não muda.
- **Abordagem:** `useListControls({ storageKey, defaultSort, sorters })` de F4 devolve `{ query, setQuery, sortKey, setSortKey, apply }`; cada painel passa o seu filtro e os comparadores (`localeCompare('pt-BR')` para texto). Ordem padrão preserva o comportamento atual para não mexer na grade ao abrir.
- **Depende de:** este item depende de F4.
- **Backend:** o item não altera Functions, regras nem configuração do Hosting.
- **Aceite:** (1) Em Mídia, "Mais recentes" põe o último upload primeiro e "Título" ordena de A a Z. (2) Em Conquistas, ordenar por título reordena dentro de cada categoria. (3) A ordem escolhida continua após trocar de seção e voltar.
- **Texto novo:** sim, com as chaves `list.sort`, `list.sort.recent`, `list.sort.title`, `list.sort.type`, `list.sort.id`.

### M07 · Reenviar para a mesma seleção de agentes
- **Status:** descartado como especificado. `selectedUids` é estado de `LiveWorkspace` (linha 73) e nenhum caminho o zera depois da entrega (o `onSuccess` da linha 708 só limpa `deliverKind` e `deliverTargets`); a seleção já persiste entre entregas. Resíduo real, pequeno: uids de agentes que ficaram offline continuam em `selectedUids`, são ignorados em silêncio por `resolveDeliverTargets` (linha 196, `if (!row?.character) continue`) e inflam o contador "n marcados".
- **Arquivos:** a mudança fica em `src/admin/components/LiveWorkspace.tsx`.
- **Abordagem:** efeito que remove de `selectedUids` os uids que saíram de `allOnlineRows`, e `selectAll` comparar `selectedUids.size === onlineUids.length` em vez de `rows.length`.
- **Depende de:** o item não depende de outro item nem de fundação.
- **Backend:** o item não altera Functions, regras nem configuração do Hosting.
- **Aceite:** (1) Marcar dois agentes, entregar uma intel e abrir de novo mostra os mesmos dois marcados. (2) Quando um marcado fica offline, o contador cai de 2 para 1.
- **Texto novo:** o item não cria nem altera textos de interface.

### M08 · Convites: copiar link já criado
- **Status:** parcial. O aviso "mostrado uma vez" já existe (`lastLink` com `team.linkOnce`, `MissionTeamTab.tsx` linhas 206 a 214). Falta só "Gerar igual" em cada linha de convite ativo. O token realmente não é recuperável (o servidor guarda só `hashToken`), então não se muda `createInvite` em `backend/functions/index.js`.
- **Arquivos:** a mudança fica em `src/admin/components/mission/MissionTeamTab.tsx`.
- **Abordagem:** `duplicateInvite(inv)` chama `inviteService.create({ kind: inv.kind, campaignId: campaign.id, ...(inv.kind === 'player' ? { squadId: inv.squadId ?? null, maxUses: inv.maxUses } : { maxUses: 1 }), expiresInDays: Math.max(1, Math.ceil((expiresAt - Date.now()) / 86_400_000)) })`, atualiza `lastLink`, copia para a área de transferência como `createInvite` já faz e recarrega a lista. Botão "Gerar igual" ao lado de "Revogar".
- **Depende de:** o item não depende de outro item nem de fundação.
- **Backend:** o item não altera Functions, regras nem configuração do Hosting.
- **Aceite:** (1) Cada linha tem "Gerar igual". (2) Clicar cria um convite novo com o mesmo esquadrão, usos e prazo restante e mostra o novo link no bloco superior. (3) O convite original continua listado e válido.
- **Texto novo:** sim, com as chaves `team.duplicateInvite`, `team.toast.duplicated`.

### M09 · Upload de mídia com progresso e erro por arquivo
- **Status:** confirmado. `handleUpload` (`MediaLibraryPanel.tsx` linha 173) envia em laço com um único `uploadProgress` e um `catch` que aborta tudo; arquivos sem MIME válido são pulados em silêncio e o overlay bloqueia a tela. `MediaUploadZone` só é usado em `MediaLibraryPanel`. Limite real: 100 MB (`MAX_UPLOAD_BYTES` em `MediaService.ts`, hoje não exportado; `storage.rules` linha 53 repete 100 MB).
- **Arquivos:** a mudança fica em `src/services/MediaService.ts` (exportar `MAX_UPLOAD_BYTES` e `validateUploadFile(file): string | null`, usado por `assertAllowedUpload`), `src/admin/components/media/MediaUploadZone.tsx`, `src/admin/components/MediaLibraryPanel.tsx`.
- **Abordagem:** estado `jobs: UploadJob[]` (`id`, `file`, `status: 'queued'|'uploading'|'done'|'error'`, `progress`, `error?`) no painel; `handleUpload(files)` valida cada arquivo com `validateUploadFile` antes de enfileirar (rejeitados já entram como `error` com motivo) e processa um de cada vez, atualizando só o job corrente via `onProgress`. `MediaUploadZone` troca o overlay bloqueante por uma lista docked com barra por arquivo, "Tentar de novo" por job com erro e "Limpar concluídos". O editor de intel só abre para o primeiro arquivo bem-sucedido, como hoje.
- **Depende de:** o item não depende de outro item nem de fundação.
- **Backend:** o item não altera Functions, regras nem configuração do Hosting.
- **Aceite:** (1) Enviar três arquivos mostra três linhas com barras independentes. (2) Um arquivo de 120 MB aparece com erro de tamanho antes de qualquer envio e não impede os outros. (3) "Tentar de novo" reenvia só o arquivo que falhou.
- **Texto novo:** sim, com as chaves `media.queue.title`, `media.queue.tooLarge`, `media.queue.badType`, `media.queue.retry`, `media.queue.clearDone`, `media.queue.done`.

### M10 · Desfazer em entregas ao vivo
- **Status:** parcial. A lista de "últimas entregas" já existe como `SystemLogPanel compact` em `LiveWorkspace.tsx` (linha 670, seção `live.recentLog`), então só o desfazer é novo. Desfazer cabe para intel e conquistas (a escrita é direta e a regra permite apagar); SMS, vídeo transmitido e push não têm reversão confiável e ficam de fora. As entregas de intel acontecem em `IntelDistributionDrawer.tsx` (feedback inline, fecha em 1 s), não em `LiveDeliverDrawer.tsx` (só conquistas).
- **Arquivos:** a mudança fica em `src/admin/components/LiveDeliverDrawer.tsx` (conquista), `src/admin/components/IntelDistributionDrawer.tsx` (intel), `src/admin/components/LiveWorkspace.tsx` (recebe o recibo no `onSuccess` da linha 708 e dispara o toast), `src/admin/components/ToastProvider.tsx` (F1).
- **Abordagem:** os drawers passam a chamar `onSuccess(receipt)` com `{ kind, ids: [{ uid, characterId, docId }] }`; antes de conceder, lêem quais pares já existem (um `getDoc` por par, ou `getDocs` da subcoleção) e só incluem no recibo os que são novos, para o desfazer nunca revogar item que o agente já tinha. `LiveWorkspace` mostra `toast.success(msg, { durationMs: 8000, action: { label: t('common.undo'), onClick } })`; o `onClick` chama `intelService.revokeIntel(uid, characterId, intelId)` ou `userService.revokeUserAchievement(uid, characterId, achievementGrantDocId(id, campaignId))` e registra `activityLogger.logAdmin('mestre', 'delivery_undo', ...)`. A entrada de log já cumpre o histórico. Limitação a declarar na interface: push ou notificação já enviada não é recolhida.
- **Depende de:** este item depende de F1.
- **Backend:** a parte de backend fica assim: não (a regra de `intel` e `achievements` já permite `delete` ao GM do personagem; adicionar caso em `backend/rules-tests/firestore.rules.test.js` só se faltar um teste de `delete` por GM).
- **Aceite:** (1) Conceder uma conquista a dois agentes mostra o toast com "Desfazer" por 8 segundos. (2) "Desfazer" remove o documento só desses dois agentes e o log registra a reversão. (3) Se um agente já tinha a intel, o desfazer não a remove.
- **Texto novo:** sim, com as chaves `live.undo.done`, `live.undo.fail`, `live.undo.pushNote`, `common.undo`.

### M11 · Atalho para pré-visualizar como o jogador vê
- **Status:** parcial. Não há componente de jogador reutilizável sem o contexto da sessão. `EvidenceReader` (`src/components/EvidenceReader.tsx`) só recebe `{ evidence: IntelBase, onClose }` e já renderiza TEXT, VISUAL e META; áudio e vídeo dependem de `usePlayerPlayback`, e o contato de NPC do Nokia depende do layout do jogador. Escopo viável: prévia lateral para intel TEXT/VISUAL/META via `IntelFactory` e uma prévia estática do cartão do contato NPC; áudio e vídeo continuam com o `onPlayAudio` existente.
- **Arquivos:** a mudança fica em novo `src/admin/components/intel/IntelPlayerPreview.tsx`, `src/admin/components/intel/IntelEditorModal.tsx`, `src/admin/components/NpcContactEditorModal.tsx`; leitura de `IntelFactory` em `src/services/IntelEngine.ts` (linha 178).
- **Abordagem:** botão "Ver como jogador" abre um painel lateral dentro do modal que monta `IntelFactory.create(formDataComoIntelItem)` e renderiza `EvidenceReader` com `onClose` fechando o painel. A prévia usa o rascunho (não o salvo), sem escrever nada. Sem alteração no atalho "Jogar como agente" do `Dashboard.tsx`.
- **Depende de:** este item depende de M02 (a prévia não pode zerar o rascunho).
- **Backend:** o item não altera Functions, regras nem configuração do Hosting.
- **Aceite:** (1) Em uma intel de texto, o painel mostra o texto exatamente como o leitor do jogador. (2) Alterar o título no formulário e reabrir a prévia reflete a alteração sem salvar. (3) Em intel de áudio o botão fica oculto.
- **Texto novo:** sim, com as chaves `intel.editor.previewAsPlayer`, `intel.editor.previewClose`, `intel.editor.previewUnavailable`.

### M12 · Filtro e busca persistentes ao trocar de destino
- **Status:** parcial, valor menor que o descrito. Os destinos e as seções do Conteúdo ficam montados (keep-alive), então `search` e `categoryFilter` já sobrevivem à troca de destino e de seção. O `setSearch('')` da linha 85 de `AchievementsPanel` roda só quando chega um `scopeRequest` ("Ver no catálogo" da missão), de propósito. Perdas reais: recarregar a página e trocar de pasta (`Dashboard` remonta com `key=wsId`).
- **Arquivos:** a mudança fica em `AchievementsPanel.tsx`, `NpcSmsPanel.tsx`, `RedirectsPanel.tsx`, `hooks/useIntelCatalog.ts`, usando o hook de F4.
- **Abordagem:** `useListControls({ storageKey: 'achievements' })` grava `search` e categoria em `sessionStorage` (chave `limboos.admin.list.<painel>`), dentro de `try/catch`. Manter o reset do `scopeRequest`.
- **Depende de:** este item depende de F4 (`useListControls`), M06 (mesmo hook).
- **Backend:** o item não altera Functions, regras nem configuração do Hosting.
- **Aceite:** (1) Digitar uma busca em Conquistas e recarregar a página mantém o texto. (2) Chegar por "Ver no catálogo" continua limpando a busca. (3) Trocar de pasta de trabalho limpa o filtro (chave inclui `wsId`).
- **Texto novo:** o item não cria nem altera textos de interface.

### M13 · Estado vazio sem ação direta
- **Status:** parcial. `ResourceColumn` (`MissionResourcesTab.tsx` linha 284) já tem um botão "+" no cabeçalho (`onCreate`, `createLabel`), só que o bloco vazio (linha 304) mostra apenas `emptyText`. No Ao Vivo o estado vazio já tem botões ("Ver todos online" e "Abrir acesso", linhas 463 a 474 de `LiveWorkspace.tsx`), então essa metade está descartada. Falta o equivalente em `MissionTeamTab` (`team.noInvites`).
- **Arquivos:** a mudança fica em `src/admin/components/mission/MissionResourcesTab.tsx`, `src/admin/components/mission/MissionTeamTab.tsx`.
- **Abordagem:** quando `count === 0`, renderizar abaixo do `emptyText` um `lmb-btn` com `createLabel` e `onCreate`; em `MissionTeamTab`, o vazio de convites ganha um botão que rola até o formulário de convite ou chama `createInvite('player')`.
- **Depende de:** o item não depende de outro item nem de fundação.
- **Backend:** o item não altera Functions, regras nem configuração do Hosting.
- **Aceite:** (1) Missão sem intel mostra, no bloco vazio, o botão que abre o editor de intel vinculado à missão. (2) Missão sem convites mostra o botão para gerar o primeiro. (3) Com itens, o botão do bloco vazio some.
- **Texto novo:** sim, com as chaves `team.noInvitesAction`. As ações de recursos reaproveitam `missions.resources.action.create*`.

### M14 · Dois diálogos para apagar intel com arquivo
- **Status:** confirmado (`useIntelCatalog.ts` linhas 220 a 233). `useModal`/`ConfirmModal` não suportam caixa de seleção, então o item exige estender o modal.
- **Arquivos:** a mudança fica em `src/admin/components/ConfirmModal.tsx` (`showConfirm` aceita `options?: { checkbox?: { label: string; defaultChecked: boolean } }` e resolve `{ confirmed, checked }` por uma nova função `showConfirmWithOption`, mantendo `showConfirm` intacto), `src/admin/hooks/useIntelCatalog.ts`.
- **Abordagem:** `ModalState` ganha `checkbox` e `checked`; o `ConfirmModal` renderiza `<input type="checkbox">` antes dos botões. `handleDeleteItem` consulta `mediaAssetMap[item.id]?.storagePath`: sem arquivo, mantém um diálogo simples; com arquivo, um diálogo com a caixa "Apagar também o arquivo do Storage" marcada por padrão apenas quando o item não é compartilhado com cópias (comparar `mediaUrl` em `allItems`; se houver outro item com a mesma URL, desmarcada e com aviso). O valor vai para `deleteStorageFile`.
- **Depende de:** este item depende de nada (M03 reutiliza).
- **Backend:** o item não altera Functions, regras nem configuração do Hosting.
- **Aceite:** (1) Remover uma intel com arquivo abre um único diálogo com a caixa. (2) Desmarcar a caixa remove o item e mantém o arquivo no Storage. (3) Intel sem arquivo não mostra a caixa.
- **Texto novo:** sim, com as chaves `intel.delete.storageCheckbox`, `intel.delete.sharedFileWarning`.

### M15 · Erros de remoção silenciosos no Jukebox
- **Status:** confirmado (`JukeboxPanel.tsx` linhas 224 a 237). `deleteObject` está em `catch {}` mudo e `deleteDoc` fora de `try`; o painel só tem `showAlert` e `showConfirm` (sem `useToast`).
- **Arquivos:** a mudança fica em `src/admin/components/JukeboxPanel.tsx`.
- **Abordagem:** importar `useToast`; mover o fluxo para `try/catch`. Apagar o documento primeiro e, só então, o arquivo: se o `deleteDoc` falhar, `toast.error(t('jukebox.removeFail'))` e retornar sem mexer na reprodução; se só o `deleteObject` falhar, `toast.error(t('jukebox.removeOrphan', { path }))` com o caminho do arquivo órfão e `console.error`. Limpar o player só depois do sucesso do documento.
- **Depende de:** o item não depende de outro item nem de fundação.
- **Backend:** o item não altera Functions, regras nem configuração do Hosting.
- **Aceite:** (1) Com permissão negada simulada no emulador, aparece o toast de erro e a faixa continua listada. (2) Se o arquivo não pôde ser apagado, o toast cita o caminho. (3) Remoção normal segue sem toast de erro.
- **Texto novo:** sim, com as chaves `jukebox.removeFail`, `jukebox.removeOrphan`.

## Site, app nativo e desenvolvimento

# Especificação técnica: Site e app nativo (P01 a P16) e Desenvolvimento (D01 a D03)

Nenhum item exige mexer em `vite.config.ts`, salvo o D03 (plugin do visualizer, motivo explícito: o item pede a análise de bundle). Mexer no bloco `server.hmr` não é necessário em nenhum item. A CSP real de produção vive em `backend/firebase.json`; o `vite.config.ts` só a espelha para o dev server.

### P01 · Estado offline, faixa "Sem sinal" e service worker
- **Status:** confirmado. Não existe `navigator.onLine`, evento `online`/`offline` nem service worker em `src/` ou `public/`. `usePlayerSync.ts` não tem tratamento de erro nas assinaturas.
- **Arquivos:** a mudança fica em criar `src/lib/connectivity.ts` (`useOnlineStatus`, `isNetworkError`), `src/components/OfflineBanner.tsx`, `public/sw.js`, `src/lib/registerServiceWorker.ts`; editar `src/App.tsx` (montar a faixa), `src/main.tsx` (registrar o SW), `src/player/hooks/usePlayerSync.ts` (toast de queda e de retorno), `backend/firebase.json` (header de `/sw.js`), `src/i18n/locales/{pt-BR,en}/common.json`.
- **Abordagem:** `useOnlineStatus` usa `useSyncExternalStore` sobre `online`/`offline`; `isNetworkError` reconhece `unavailable`, `network-request-failed` e `TypeError: Failed to fetch`. No jogador, a transição offline/online dispara um toast "SEM SINAL" e depois "SINAL RESTABELECIDO"; a faixa global fica fixa no topo respeitando `safe-area-inset-top`. O `sw.js` só roda no web (`!isNative()` e `import.meta.env.PROD`): navegação em network-first com fallback ao `/index.html` em cache, `/assets/**` em cache-first (já são imutáveis), e nunca intercepta `/build-info.json`, métodos não GET, nem hosts de Firebase.
- **Depende de:** este item depende de F2 (este item é a própria F2), F1 (toast de retorno pode usar `action` "Tentar de novo").
- **Backend:** a parte de backend fica assim: sim, só config do Hosting: header `Cache-Control: no-cache` para `/sw.js` em `backend/firebase.json` (a regra `**/*.html` não o cobre). `worker-src 'self'` da CSP já permite. Sem Function.
- **Aceite:** no build de produção local (`npm run build && npm run preview`), com DevTools em offline a faixa aparece em menos de 1 s e recarregar a página ainda mostra o shell; ao voltar a rede a faixa some e o toast "SINAL RESTABELECIDO" aparece uma vez; no simulador iOS o SW não é registrado (`navigator.serviceWorker` ausente no log).
- **Texto novo:** sim, com as chaves `common:offline.banner`, `common:offline.restored`; `player:offline.lost`, `player:offline.restored`.

### P02 · Aviso de nova versão
- **Status:** confirmado. `readBuildInfo` em `src/lib/appInfo.ts:36` só alimenta a tela Sobre e o resultado de `getAppInfo` é cacheado para sempre.
- **Arquivos:** a mudança fica em criar `src/lib/versionChannel.ts` (F7) e `src/hooks/useVersionUpdate.ts`; editar `src/App.tsx`, `src/lib/appInfo.ts` (exportar `fetchBuildInfo` sem cache, reaproveitando `readBuildInfo`), i18n `common.json`.
- **Abordagem:** guardar `commit` e `builtAt` do primeiro `/build-info.json` lido no boot como baseline; em `visibilitychange` para visível (e a cada 15 min com a aba aberta) buscar de novo com `cache: 'no-store'` e comparar o `commit`. Se diferente, mostrar toast persistente com `action` "Atualizar" (F1) que chama `location.reload()`. No nativo o `webDir` é empacotado, então a checagem fica desligada com `isNative()` (a versão nova chega pela loja).
- **Depende de:** este item depende de F7, F1.
- **Backend:** a parte de backend fica assim: não. `/build-info.json` já é servido sem header de cache especial; confirmar no Hosting que não herda `max-age` (hoje não herda).
- **Aceite:** com o preview aberto, rodar `node scripts/build-info.mjs` com outro commit e voltar o foco à aba mostra o aviso uma única vez; tocar "Atualizar" recarrega; sem mudança nenhuma não aparece nada.
- **Texto novo:** sim, com as chaves `common:update.available`, `common:update.action`.

### P03 · Prévia de link de convite
- **Status:** confirmado, com restrição de privacidade (abaixo).
- **Arquivos:** a mudança fica em editar `backend/functions/index.js` (nova `invitePage`, `onRequest`, região `southamerica-east1`), `backend/firebase.json` (trocar o rewrite `/convite/**` por `{ "source": "/convite/**", "function": { "functionId": "invitePage", "region": "southamerica-east1" } }`), `backend/functions/test/functions.test.js`; criar nada no `src/`.
- **Abordagem:** a Function busca o `index.html` do próprio Hosting (cache em memória por 5 min, com cabeçalho `Cache-Control: no-store` na resposta para não congelar hashes de assets), lê o token do último segmento do path, valida o tamanho como em `getInvitePreview` (10 a 64) e consulta `invites/{hashToken(token)}` e `workspaces/{wsId}`. Troca `og:title`, `twitter:title`, `og:description`, `twitter:description`, `<title>`, `og:url` e `canonical` por valores escapados (HTML escape de `& < > " '`) e injeta `<meta name="robots" content="noindex">`. Reaproveita `hashToken` e `inviteStatus` já existentes.
- **Privacidade (o que a prévia revela a quem só tem o link):** o `getInvitePreview` já devolve `workspaceName` e `campaignName` a qualquer pessoa com o token, mas uma prévia é copiada por clientes de chat, indexada por bots de grupo e fica em cache de terceiros, então é mais exposta que a tela do convite. Regras: (1) mostrar só o nome da mesa (`workspaceName`), nunca o da missão, que pode ser spoiler de lore; (2) não distinguir convite de jogador e de co-mestre; (3) para token inexistente, expirado, revogado ou esgotado, devolver a prévia genérica atual, sem "expirado" nem nome algum, para não servir de oráculo de validade; (4) manter a imagem genérica `og-image.png`; (5) não colocar o token em `canonical` (usar `og:url` com a URL recebida, que o remetente já compartilhou, e omitir `canonical` porque a página é noindex); (6) nada de e-mail, uid ou contagem de vagas. Risco residual aceito: quem tiver o link e um crawler vê o nome da mesa, o que a tela do convite já mostraria sem login.
- **Depende de:** o item não depende de outro item nem de fundação.
- **Backend:** a parte de backend fica assim: sim. Nova Function HTTP `invitePage` mais o rewrite do Hosting. Testes em `backend/functions/test/functions.test.js`: token válido devolve `og:title` com o nome escapado; nome com `"><script>` sai escapado; token inválido, expirado e revogado devolvem o HTML genérico (corpo idêntico entre si); resposta traz `Cache-Control: no-store`. Rodar com `cd backend/rules-tests && npm run test:functions`. A Function precisa da permissão de invocação pública (padrão de `onRequest` v2 com `invoker: 'public'`).
- **Aceite:** `curl -s https://<host>/convite/<token válido> | grep og:title` mostra "Convite para a mesa X" no emulador de Hosting+Functions; `curl` com token falso devolve o título genérico com status 200; o app abre normalmente no navegador a partir do mesmo link (SPA continua hidratando).
- **Texto novo:** sim, com as chaves `functions:og.invite.title`, `functions:og.invite.description` (strings no código da Function, fora do i18n do app).

### P04 · Recarga de chunk uma vez por sessão
- **Status:** confirmado. `vite_reload` é gravada em `src/main.tsx:16-18` e `:24-29` e nunca removida.
- **Arquivos:** a mudança fica em `src/main.tsx`.
- **Abordagem:** trocar o flag por um timestamp (`vite_reload_at`) e recarregar só se o último reload tiver mais de 30 s; extrair a lógica duplicada dos dois listeners para uma função `reloadOnce()`. Limpar a chave em `releaseBootSplash()` depois de 5 s de boot saudável, para que um segundo deploy na mesma sessão tenha direito a outra tentativa. Se o reload falhar de novo dentro da janela, deixar o erro subir ao ErrorBoundary em vez de reciclar em laço.
- **Depende de:** este item depende de F7 (opcional: o aviso de P02 reduz a chance do erro).
- **Backend:** o item não altera Functions, regras nem configuração do Hosting.
- **Aceite:** no preview, simular `vite:preloadError` duas vezes com 31 s de intervalo recarrega duas vezes; duas vezes em 5 s recarrega só uma; nenhum laço de recarga infinito.
- **Texto novo:** o item não cria nem altera textos de interface.

### P05 · 404 do Hosting não cobre rotas do SPA
- **Status:** descartado. O `Player` ocupa `/*` mas nunca grava caminho no histórico (`grep pushState` fora do admin não acha nada; o histórico do jogador usa o mesmo path com estado), e `/?mode=play` é a raiz `/`, que o Hosting serve com `index.html` independentemente da query. `/admin/` com barra final casa `/admin/**`. Um `**` genérico apagaria a `404.html` útil.
- **Arquivos:** a mudança fica em nenhum.
- **Abordagem:** nada a fazer. Se o admin ou o jogador passarem a usar caminhos próprios, o novo prefixo entra no `rewrites` junto do PR que o criar.
- **Depende de:** o item não depende de outro item nem de fundação.
- **Backend:** o item não altera Functions, regras nem configuração do Hosting.
- **Aceite:** `curl -I /?mode=play` e `/admin/live/` devolvem 200 com o HTML do app no preview do Hosting.
- **Texto novo:** o item não cria nem altera textos de interface.

### P06 · Push pedido logo ao entrar no player
- **Status:** parcial. O adiamento já espera 7 dias (`ASK_LATER_MS` em `PushService.ts:21`), então só muda o gatilho. O aviso monta em `PlayerRootShell.tsx:119` assim que `screen === 'player'`.
- **Arquivos:** a mudança fica em `src/services/PushService.ts` (flag `markPushMoment()` / `hasPushMoment()` em `localStorage`), `src/player/hooks/useWalkmanPlayback.ts` (chamar `markPushMoment()` após `intelService.unlock` bem-sucedido nas linhas ~190 e ~363), `src/components/campaign/PushPermissionPrompt.tsx` (só abrir se `hasPushMoment()`), e o ponto onde a primeira fala de NPC é entregue.
- **Abordagem:** o jogador só vê o diálogo depois do primeiro desbloqueio de intel ou da primeira mensagem de NPC, quando "o mestre enviar arquivos" já faz sentido. O prompt escuta um `CustomEvent('limboos:push-moment')` para abrir sem recarregar a tela. O texto do prompt não muda.
- **Depende de:** o item não depende de outro item nem de fundação.
- **Backend:** o item não altera Functions, regras nem configuração do Hosting.
- **Aceite:** no simulador iOS com conta nova, entrar no player não abre o diálogo; abrir a primeira fita abre; tocar "Agora não" não reabre antes de 7 dias.
- **Texto novo:** o item não cria nem altera textos de interface.

### P07 · Zoom desativado no viewport
- **Status:** confirmado. `index.html:5` tem `maximum-scale=1.0, user-scalable=no`.
- **Arquivos:** a mudança fica em `index.html`, `src/lib/viewportZoom.ts` (novo, `setZoomLocked(boolean)` altera a meta), `src/App.tsx` (efeito por rota), `src/index.css` (`touch-action: manipulation` no player).
- **Abordagem:** a meta estática passa a `width=device-width, initial-scale=1.0, viewport-fit=cover`. Na rota do Player a trava volta por script no boot (`maximum-scale=1`), e some quando o leitor de evidência (`EvidenceReader`) está aberto, via F6 (overlay aberto libera o zoom). `/convite/*`, `/admin/*` e `/terminal/*` ficam sem trava. O iOS ignora `user-scalable=no` no Safari, mas o WKWebView do Capacitor respeita.
- **Depende de:** este item depende de F6 (para o leitor de evidência).
- **Backend:** a parte de backend fica assim: não, e `vite.config.ts` não muda.
- **Aceite:** no simulador iOS, pinça no `/convite/x` e no leitor de evidência amplia; no walkman não amplia e o duplo toque não dá zoom.
- **Texto novo:** o item não cria nem altera textos de interface.

### P08 · Splash nativa fixa em 4 s
- **Status:** parcial. Com `launchAutoHide: false` o `launchShowDuration` é ignorado pelo plugin: o teto real não é 4 s, a splash fica até o `hide()` ser chamado, ou seja, para sempre se o boot falhar.
- **Arquivos:** a mudança fica em `capacitor.config.ts`, `src/lib/native/nativeShell.ts`, `src/main.tsx`.
- **Abordagem:** manter `launchAutoHide: false` e adicionar em `initNativeShell` um `hideSplash()` idempotente chamado pelo `requestAnimationFrame` atual, por `window.addEventListener('error')`, por `unhandledrejection` e por um `setTimeout` de segurança de 2 500 ms. Remover `launchShowDuration` do config (propriedade morta).
- **Depende de:** o item não depende de outro item nem de fundação.
- **Backend:** o item não altera Functions, regras nem configuração do Hosting.
- **Aceite:** no simulador Android, forçar um `throw` no topo de `main.tsx` esconde a splash em menos de 3 s; boot normal esconde a splash no primeiro quadro como hoje.
- **Texto novo:** o item não cria nem altera textos de interface.

### P09 · Botão voltar do Android
- **Status:** confirmado. Não há `backButton` em `src/` (`grep` só acha `appUrlOpen` e `appStateChange`).
- **Arquivos:** a mudança fica em criar `src/lib/overlayStack.ts` (F6), editar `src/lib/native/nativeShell.ts` (ou novo `backButton.ts` carregado por ele), `src/player/components/PlayerRootShell.tsx` e os modais existentes para registrar na pilha.
- **Abordagem:** `App.addListener('backButton', ({ canGoBack }) => ...)`: se `overlayStack.closeTop()` fechou algo, para; senão, se `canGoBack`, `history.back()` (o `useAppScreenHistory` já espelha as telas); senão `App.exitApp()`. Registro só em `getPlatform() === 'android'`.
- **Depende de:** este item depende de F6.
- **Backend:** o item não altera Functions, regras nem configuração do Hosting.
- **Aceite:** no emulador Android, com o leitor de evidência aberto o botão voltar fecha o leitor e não sai do app; na raiz sem overlays o app fecha; em um mini-app volta à tela de origem.
- **Texto novo:** o item não cria nem altera textos de interface.

### P10 · Deep link recarrega a página inteira
- **Status:** confirmado. `deepLinks.ts:12` usa `window.location.assign`; `getLaunchUrl` não é chamado.
- **Arquivos:** a mudança fica em `src/lib/native/deepLinks.ts`.
- **Abordagem:** extrair `openInternalPath(path)` que faz `history.pushState({}, '', path)` e `dispatchEvent(new PopStateEvent('popstate'))`, que o `BrowserRouter` já escuta. No boot, chamar `App.getLaunchUrl()` e tratar o mesmo URL (o evento `appUrlOpen` do cold start pode disparar antes do listener existir). Manter o filtro de host e do prefixo `/convite/`. Efeito colateral aceito: o `Player` desmonta ao ir para `/convite/:token`, mas a sessão do Firebase permanece e não há nova splash.
- **Depende de:** o item não depende de outro item nem de fundação.
- **Backend:** a parte de backend fica assim: não (os arquivos `well-known` não mudam).
- **Aceite:** no simulador iOS, `xcrun simctl openurl booted https://terminalhubrpg.web.app/convite/<token>` com o app em uso abre o convite sem splash nem nova tela de login; com o app fechado abre direto no convite.
- **Texto novo:** o item não cria nem altera textos de interface.

### P11 · Teclado cobrindo campos no nativo
- **Status:** confirmado. `@capacitor/keyboard` não está em `package.json` e `capacitor.config.ts` não tem `Keyboard`. `NokiaPlayer.tsx:389` já ouve `visualViewport` para o Nokia.
- **Arquivos:** a mudança fica em `package.json`, `capacitor.config.ts` (plugin `Keyboard: { resize: 'body', resizeOnFullScreen: true }`), `src/lib/native/keyboard.ts` (novo), `src/lib/native/nativeShell.ts`.
- **Abordagem:** instalar `@capacitor/keyboard` e, em `keyboard.ts`, ouvir `focusin` em `input, textarea` para chamar `el.scrollIntoView({ block: 'center', behavior: 'smooth' })` depois de `keyboardDidShow`. Depende de P07 resolver o `maximum-scale` fora do player. Rodar `npm run native:sync` depois da instalação.
- **Depende de:** este item depende de P07 (parcial), `npm run native:sync`.
- **Backend:** o item não altera Functions, regras nem configuração do Hosting.
- **Aceite:** no simulador iOS e no emulador Android, focar o campo de senha do login e o campo de mensagem do SMS deixa o campo visível acima do teclado; sair do campo restaura o layout.
- **Texto novo:** o item não cria nem altera textos de interface.

### P12 · Fontes do Google sem fallback local
- **Status:** parcial. As três famílias já estão no bundle nativo por `@fontsource` (`src/lib/native/fonts.ts`); falta o web.
- **Arquivos:** a mudança fica em `index.html:46-54` (remover os links do Google), `src/main.tsx` (importar `@fontsource-variable/archivo/wdth.css`, `@fontsource/spline-sans-mono/{400,600,700}.css`, `@fontsource/vt323/400.css`) e `src/lib/native/fonts.ts` (apagar, pois o import passa a ser comum), `src/lib/native/nativeShell.ts` (tirar o `import('./fonts')`).
- **Abordagem:** o Vite empacota os woff2 em `assets/` com hash e cache imutável (já configurado no Hosting), o `@fontsource` usa `font-display: swap`. Não é preciso copiar nada para `public/`. O `preload` da fonte principal pode ser emitido por um `<link rel="preload" as="font">` gerado com `?url` se o CLS persistir; medir antes de adicionar. A CSP do Hosting continua válida e pode, em um passo posterior, perder `fonts.googleapis.com`/`fonts.gstatic.com`.
- **Depende de:** o item não depende de outro item nem de fundação.
- **Backend:** a parte de backend fica assim: não obrigatório; limpeza opcional da CSP em `backend/firebase.json`.
- **Aceite:** no build de produção local com rede offline após o primeiro carregamento, as três famílias renderizam sem requisição a `fonts.googleapis.com` (aba Network); o CLS do Lighthouse não piora.
- **Texto novo:** o item não cria nem altera textos de interface.

### P13 · Canonical e og:url sempre na raiz
- **Status:** parcial, absorvido por P03. Crawlers não executam JS, então atualizar em runtime não resolve a prévia. `/admin` e `/terminal` já saem com `X-Robots-Tag: noindex` pelo Hosting, então o canonical da home neles é inofensivo.
- **Arquivos:** a mudança fica em nenhum além dos de P03.
- **Abordagem:** o canonical e o `og:url` por rota de convite saem da Function de P03. Para admin e terminal, não fazer nada.
- **Depende de:** este item depende de P03.
- **Backend:** a parte de backend fica assim: coberto por P03.
- **Aceite:** o mesmo critério de P03 (`og:url` do convite igual à URL pedida e sem `canonical`).
- **Texto novo:** o item não cria nem altera textos de interface.

### P14 · 404.html sem ação para convite
- **Status:** confirmado. `public/404.html` tem um botão só.
- **Arquivos:** a mudança fica em `public/404.html`.
- **Abordagem:** adicionar um segundo parágrafo estático e curto antes do botão, com a mesma classe `p`. A 404 serve qualquer URL, então o texto fala de convite sem afirmar que a URL era de convite. Opcional: se `location.pathname` começa com `/convite`, mostrar o parágrafo; senão ocultá-lo (script inline de duas linhas).
- **Depende de:** o item não depende de outro item nem de fundação.
- **Backend:** a parte de backend fica assim: não (o Hosting serve o arquivo como está).
- **Aceite:** abrir `/rota-que-nao-existe` e `/convite` mostra o parágrafo conforme a regra escolhida, em largura de 360 px sem rolagem horizontal.
- **Texto novo:** sim, com as chaves `404.html:convite`.

### P15 · Manifest sem recursos de instalação
- **Status:** parcial. A recomendação de `orientation: any` contradiz o walkman retrô, que depende de retrato, mas o manifest afeta só o PWA instalado, e o app nativo usa a orientação do projeto. Aplicar `id`, `lang`, `categories`; `shortcuts` e screenshots ficam fora (o app não tem rotas de atalho públicas).
- **Arquivos:** a mudança fica em `public/site.webmanifest`.
- **Abordagem:** adicionar `"id": "/"`, `"lang": "pt-BR"`, `"categories": ["games", "entertainment"]`, trocar `orientation` para `"any"` e manter o jogador em retrato por CSS (já existe `useLandscapeLayout`). Verificar que o walkman em paisagem tem layout (a hook existe) antes de soltar a trava.
- **Depende de:** o item não depende de outro item nem de fundação.
- **Backend:** o item não altera Functions, regras nem configuração do Hosting.
- **Aceite:** o painel Application > Manifest do Chrome não mostra erro e lista id e lang; o PWA instalado gira em tablet.
- **Texto novo:** sim, com as chaves `site.webmanifest:description` (sem mudança de texto, só validação) e nenhum texto novo obrigatório.

### P16 · supportEmail inválido no Auth
- **Status:** confirmado. `backend/firebase.json:157-158` tem `"HUB RPG"` e `support@undefined.firebaseapp.com`.
- **Arquivos:** a mudança fica em `backend/firebase.json`.
- **Abordagem:** trocar `oAuthBrandDisplayName` por `"LimboOS"`. O e-mail de suporte real precisa vir do dono; nenhum endereço aparece no repositório (README, LICENSE, i18n). Deixar a decisão como pendência do usuário. O bloco só vale em `firebase deploy --only auth`; o nome e o e-mail da tela de consentimento também podem estar definidos no console, que prevalece se divergir.
- **Depende de:** este item depende de decisão do dono sobre o e-mail.
- **Backend:** a parte de backend fica assim: sim, config (`firebase.json`); sem teste automatizado.
- **Aceite:** depois do deploy de auth, a tela de consentimento do Google mostra "LimboOS" e o e-mail configurado.
- **Texto novo:** sim, com as chaves `firebase.json:oAuthBrandDisplayName` e `firebase.json:supportEmail`.

### D01 · Emuladores em um comando
- **Status:** confirmado. Não há `concurrently` nem `firebase-tools` em `package.json`; `.claude/launch.json` já tem a configuração `limboos-web-emulators`, mas depende de os emuladores estarem de pé.
- **Arquivos:** a mudança fica em `package.json` (script `dev:emu` e `emu`), `.claude/launch.json` (nenhuma mudança necessária).
- **Abordagem:** `"emu": "cd backend && firebase emulators:start --only auth,firestore,functions,storage --project demo-limboos"` e `"dev:emu": "concurrently -k -n emu,vite \"npm run emu\" \"VITE_USE_EMULATORS=true VITE_FIREBASE_PROJECT_ID=demo-limboos VITE_FIREBASE_STORAGE_BUCKET=demo-limboos.appspot.com vite --port 5190 --strictPort\""` (usar `cross-env` se o time usar Windows). `emulators:exec` não serve porque encerra ao fim do comando. Adicionar `concurrently` como devDependency. O seed (`scripts/readme-shots/seed-demo.cjs`) continua um passo manual documentado.
- **Depende de:** o item não depende de outro item nem de fundação.
- **Backend:** a parte de backend fica assim: não (usa `backend/firebase.json` atual).
- **Aceite:** `npm run dev:emu` sobe emuladores e Vite na porta 5190 e o login usa o emulador (Auth em 9099); Ctrl+C encerra os dois processos.
- **Texto novo:** o item não cria nem altera textos de interface.

### D02 · Lint e deploy sem trava
- **Status:** confirmado. `package.json:18` é `npm run build && cd backend && firebase deploy --only hosting:main`.
- **Arquivos:** a mudança fica em `package.json`.
- **Abordagem:** `"deploy": "npm run lint && npm run build && cd backend && firebase deploy --only hosting:main"` e o mesmo para `deploy:full`. A checagem de branch fica de fora (o deploy atual sai de qualquer branch por escolha do dono, e o guardrail do repositório proíbe automatizar ações sem pedido).
- **Depende de:** o item não depende de outro item nem de fundação.
- **Backend:** o item não altera Functions, regras nem configuração do Hosting.
- **Aceite:** com um erro de tipo introduzido de propósito, `npm run deploy` falha em `tsc` antes do build; sem erro, o fluxo segue como hoje.
- **Texto novo:** o item não cria nem altera textos de interface.

### D03 · Script de análise de bundle
- **Status:** confirmado. `stats.html` está versionado (um arquivo em `git ls-files`) e `.gitignore` não o ignora; `vite.config.ts` não tem visualizer e `manualChunks` ignora admin e mini-apps.
- **Arquivos:** a mudança fica em `package.json` (devDependency `rollup-plugin-visualizer`, script `analyze`), `vite.config.ts`, `.gitignore`; remover `stats.html` do índice com `git rm --cached stats.html`.
- **Abordagem:** em `vite.config.ts`, adicionar o plugin só quando `process.env.ANALYZE === 'true'`, escrevendo `stats.html` em `dist-stats/` (ignorado). Script: `"analyze": "ANALYZE=true vite build --outDir /tmp/limbo-analyze --emptyOutDir"` para não sujar `backend/dist`. Não mexer em `manualChunks` neste item. É o único item que toca `vite.config.ts`, e o motivo é explícito: o pedido é a análise.
- **Depende de:** o item não depende de outro item nem de fundação.
- **Backend:** o item não altera Functions, regras nem configuração do Hosting.
- **Aceite:** `npm run analyze` gera o treemap fora do git, `git status` limpo depois, `npm run build` sem diferença de saída.
- **Texto novo:** o item não cria nem altera textos de interface.
