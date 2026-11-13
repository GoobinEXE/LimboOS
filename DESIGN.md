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

Archivo variável com eixo de largura: títulos (`.text-display`) a 116%, rótulos em `font-display` a 108% e texto corrido a 100%. Spline Sans Mono só para dados (códigos, horários, contagens). VT323 (`--font-lcd`) só na tela LCD do Nokia, com `font-size-adjust: 0.52` para não encolher. As três vêm do Google Fonts na web e embarcadas no nativo (`src/lib/native/fonts.ts`). Texto corrido com piso de 12 px e `line-height` 1.55; rótulos com piso de 10 px e espaçamento entre letras até 0.12em. Cinza de texto: `ash-500` (≥ 5:1); `ash-600` só para ícone e texto grande.

## Ícones

`lucide-react` em todo o app. No admin, `MIcon` (`src/admin/components/MIcon.tsx`) recebe os nomes antigos do Material Symbols e desenha o SVG em 1em, então as classes `text-*` definem o tamanho. Nenhuma fonte de ícone é carregada.

## Toque

Pressionar desce 1 px (`translateY`), nunca encolhe. Em tela de toque o controle também escurece no `:active`, e no app nativo todo botão dá vibração leve (`src/lib/native/nativeShell.ts`); o walkman fica de fora (`data-haptic="off"`) porque tem retorno próprio.

## Componentes base (`src/index.css`)

- `lmb-btn` (tom de carcaça com filete de luz), `lmb-btn-primary` (âmbar translúcido), `lmb-btn-solid` (âmbar), `lmb-btn-danger`, `lmb-btn-ghost`, `lmb-btn-icon`.
- `lmb-field`: campo afundado; o foco acende uma faixa âmbar de 2 px na base.
- `lmb-kbd`, `lmb-led`, `lmb-eyebrow` (rótulo de grupo dentro de formulário, nunca acima de título).

## Carregamento e abertura

- Abertura: tela nativa com a logo Dark Room em `#090A0C` (`ios/App/App/Assets.xcassets/Splash.imageset`, `android/app/src/main/res/drawable*/splash.png`), a mesma logo estática no HTML (`#initial-loader` em `index.html`) e o splash nativo só some depois que o JS roda. O WebView também usa `#090A0C`, para não aparecer um quadro de outra cor.
- `RetroLoading` (`src/components/player/RetroLoading.tsx`): carretel girando, uma linha de mensagem e barra de progresso, sempre centrado. `fullScreen` cobre a viewport (telas inteiras); sem ele, cobre o contêiner posicionado mais próximo (dentro do aparelho). Não tem submensagem.
