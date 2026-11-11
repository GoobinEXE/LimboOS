# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

O mesmo bundle roda no navegador e dentro do shell Capacitor (`ios/`, `android/`); a linguagem visual é a da web, sem adotar controles nativos de cada sistema.

## Users

Jogadores de RPG de mesa, durante a sessão ou entre sessões, no celular, consumindo Intel (fitas de áudio, textos, imagens, conquistas) como agentes de uma organização fictícia. Mestres de jogo no desktop ou no celular, preparando missões e entregando conteúdo ao vivo pelo painel `/admin`.

## Product Purpose

Companion app de campanha: o mestre organiza missões, agentes e Intel numa pasta própria e libera conteúdo em tempo real; o jogador recebe esse conteúdo dentro de aparelhos fictícios de 1999 (walkman, Nokia) e mini-apps de época. Sucesso é a mesa sentir o conteúdo como peça da ficção e o mestre entregar sem atrito durante a sessão.

## Positioning

A Intel chega dentro de aparelhos e sistemas de 1999 com lore própria (Limbo, a fenda, o bug do milênio), multi-tenant por mestre, com entrega ao vivo e push.

## Operating Context

Sessões presenciais ou online, luz baixa, celular na mão do jogador; mestre alternando entre missão, mesa e entrega ao vivo. Convites por link (`/convite/:token`). QR codes físicos levam a Intel.

## Capabilities and Constraints

Superfícies: jogador (`/`), admin (`/admin/*`), terminal ARG (`/terminal/*`), convite. Mini-apps de época (BIOS, Limbo Board, Disk Repair, Win95, Mac OS, terminal) imitam sistemas reais e mantêm a aparência de época. React 19, Tailwind 4, Firebase. UI, lore e comentários em português (BR).

## Brand Commitments

Nome LimboOS, logo Dark Room, acento âmbar `#FF8C00`, fósforo verde de CRT, LCD verde do Nokia. Atmosfera de bancada escura de 1999 (`docs/readme/*.png`). Tom imersivo de ficção de agência.

## Evidence on Hand

Arte de referência em `docs/readme/` (hero, walkman, Nokia, fenda). Lore legada em `backend/scripts/legacy-seed/`.

## Product Principles

- A ficção vem primeiro: todo texto e tela fala como equipamento da agência.
- O mestre opera ao vivo: nada no admin pode exigir mais de um passo extra durante a sessão.
- Os aparelhos são o produto: walkman e Nokia não viram listas genéricas.
- Mini-apps de época não se modernizam.

## Accessibility & Inclusion

Contraste mínimo WCAG AA no texto, foco de teclado visível, respeito a `prefers-reduced-motion`.
