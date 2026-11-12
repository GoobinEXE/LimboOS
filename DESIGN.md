# Design

Direção: **bancada escura de 1999, sem contorno**. É o visual original do LimboOS (carvão quente, âmbar da fenda, fósforo de CRT, brilho curto e relevo de aparelho), com botões e blocos separados por tom e relevo em vez de linha. A fonte única dos tokens é `src/index.css` (`@theme`).

## Regras

- **Sem contorno de quatro lados.** Botões, cartões, campos e painéis não têm `border` em volta. A separação vem do degrau de tom (`surface-sunken` → `surface-raised` → `surface-panel`), de `shadow-hairline`/`shadow-panel` e do fundo do estado (`bg-accent-10` no ativo).
- **Divisórias de um lado continuam.** `border-b`/`border-t` em listas, cabeçalhos e rodapés de painel, e a linha de aba ativa, ficam como estavam.
- **Sem slogan, subtítulo ou numeração.** Título de tela, de seção ou de item de menu fica sozinho: nada de linha de apoio embaixo ("Trocar a realidade ativa"), rótulo acima ("Terminal RM-84 · Registro de agentes"), índice ("01", "02") ou rodapé de efeito ("Sincronização em tempo real", "Grid online"). Texto que ensina a usar um campo ou explica um estado vazio continua.
- **Walkman intocado.** `WalkmanShell`, `CassetteVisor`, `TapeLibrary`, `SideControls`, `BottomControls` e `Screw` mantêm textura, relevo e contornos de aparelho.
- **Exceções de época:** a tela LCD do Nokia (`lcd-ink`/`lcd-paper`) e os mini-apps (BIOS, Limbo Board, Disk Repair, Win95, Mac OS, terminal) mantêm suas linhas.
- **Foco de teclado:** contorno âmbar de 1 px; é a única linha que todo controle pode desenhar.

## Tipografia

Space Grotesk (títulos e rótulos), Inter (texto) e JetBrains Mono (dados). Piso de 10 px fora do walkman e dos sistemas de época.

## Componentes base (`src/index.css`)

- `lmb-btn` (tom de carcaça com filete de luz), `lmb-btn-primary` (âmbar translúcido), `lmb-btn-solid` (âmbar), `lmb-btn-danger`, `lmb-btn-ghost`, `lmb-btn-icon`.
- `lmb-field`: campo afundado; o foco acende uma faixa âmbar de 2 px na base.
- `lmb-kbd`, `lmb-led`, `lmb-eyebrow` (rótulo de grupo dentro de formulário, nunca acima de título).

## Carregamento e abertura

- Abertura: tela nativa com a logo Dark Room em `#090A0C` (`ios/App/App/Assets.xcassets/Splash.imageset`, `android/app/src/main/res/drawable*/splash.png`), a mesma logo estática no HTML (`#initial-loader` em `index.html`) e o splash nativo só some depois que o JS roda. O WebView também usa `#090A0C`, para não aparecer um quadro de outra cor.
- `RetroLoading` (`src/components/player/RetroLoading.tsx`): carretel girando, uma linha de mensagem e barra de progresso, sempre centrado. `fullScreen` cobre a viewport (telas inteiras); sem ele, cobre o contêiner posicionado mais próximo (dentro do aparelho). Não tem submensagem.
