# Design

Direção: **campos chapados de 1999**. A bancada escura da arte de referência (`docs/readme/`) virou um sistema de campos de cor sólidos: carvão quente, âmbar da fenda, osso do letreiro e fósforo de CRT. A fonte única dos tokens é `src/index.css` (`@theme`).

## Regras

- **Separação por campo, nunca por contorno.** Blocos, botões e cartões não têm borda, sombra, brilho, vidro fosco nem gradiente decorativo. Os tokens `--color-border*` são transparentes e `--shadow-*` valem `none`, para classes antigas não desenharem nada.
- **Junta (`border-seam`).** Divisórias de um lado só (linhas de lista, cabeçalho de painel) usam a cor do fundo da página: aparecem como um corte entre dois campos iguais.
- **Seleção inverte.** Item ativo ou em hover vira campo osso (`bg-field-bone` + `text-field-ink`) ou âmbar sólido (`bg-accent` + `text-field-ink`). Nada de tinta âmbar translúcida como estado ativo.
- **Cabeçalho de tela em campo âmbar.** Seleção de agente, login, identidade do perfil, missão no admin e a marca da barra lateral abrem com um bloco âmbar e título em tinta.
- **Foco de teclado:** contorno âmbar de 2 px com recuo de 2 px. É a única linha que o sistema desenha.
- **Exceções de época:** a tela LCD do Nokia (`lcd-ink`/`lcd-paper`) e os mini-apps (BIOS, Limbo Board, Disk Repair, Win95, Mac OS, terminal) mantêm suas linhas e relevos.

## Cor

| Papel | Token | Valor |
|---|---|---|
| Fundo da página | `surface` | `#131210` |
| Campo afundado (entrada) | `surface-sunken` | `#0b0a09` |
| Cartão | `surface-raised` | `#1f1c19` |
| Cartão sobre cartão | `surface-panel` | `#2a2622` |
| Degraus de controle | `surface-container` → `-highest` | `#25221e` → `#3a3631` |
| Âmbar (ação, cabeçalho) | `accent` | `#ff8c00` |
| Osso (seleção, ação secundária) | `field-bone` | `#e8e0d0` |
| Tinta sobre âmbar/osso | `field-ink` | `#141210` |
| Status | `phosphor-500`, `yellow-500`, `red-600` | etiquetas sólidas |

## Tipografia

- **Archivo** variável (eixo `wdth` 75–125). Títulos com `.text-display` (peso 820, largura 118%), rótulos com `.text-protocol` (650, 108%, caixa alta, tracking 0.07em). `font-display`/`font-headline` saem a 116% de largura.
- **JetBrains Mono** só para dados: códigos RM, horários, contagens, IDs.
- Piso de 10 px para qualquer texto de interface.
- Web carrega do Google Fonts (`index.html`); o app nativo embarca `@fontsource-variable/archivo` e `@fontsource/jetbrains-mono` (`src/lib/native/fonts.ts`).

## Componentes base (`src/index.css`)

- `lmb-btn` (carvão), `lmb-btn-primary`/`lmb-btn-solid` (âmbar), `lmb-btn-bone`, `lmb-btn-danger`, `lmb-btn-ghost`, `lmb-btn-icon`. Altura mínima 40 px, `:active` afunda por escala.
- `lmb-field`: campo preenchido; o foco acende uma faixa âmbar de 2 px na base.
- `lmb-tag`: etiqueta chapada em mono para status, nível e contagem.
- `lmb-eyebrow`: rótulo de grupo dentro de formulários e listas, nunca acima de título.
- `lmb-kbd`, `lmb-led`.

## Forma e movimento

Raios curtos: 2 px (inset), 3 px (controle), 4 px (cartão), 6 px (painel). Aparelhos (walkman, perfil) mantêm 24 px. Durações e curvas em `:root` (`--duration-*`, `--easing-*`), espelhadas em `src/lib/motion.ts`.
