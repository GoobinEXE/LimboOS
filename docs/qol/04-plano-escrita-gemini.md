# Plano de escrita dos textos de interface com o Gemini

Este documento é um briefing completo. Cole o documento inteiro, junto com as tabelas do lote que você quer processar, em uma conversa nova do Gemini. Cada lote tem o seu modelo indicado e a sua tabela. O Gemini deve responder com um único JSON por lote, no formato descrito na seção 6.

## 1. O que é o LimboOS

LimboOS é um companion app web para campanhas de RPG de mesa, ambientado em 1999. Os jogadores interagem como agentes por meio de interfaces retrô (walkman, Nokia, BIOS, Windows 95, Mac OS) e consomem intel: áudio, texto, imagem e conquistas entregues pelo mestre. A história gira em torno do Limbo, de uma fenda temporal e do bug do milênio. O mestre usa um painel administrativo para montar missões, entregar intel ao vivo, organizar esquadrões e gerar convites; ninguém entra numa mesa sem convite. O visual é uma bancada escura de 1999, com acento âmbar, fósforo verde de CRT e LCD verde do Nokia. A interface existe em português do Brasil e em inglês.

Os 109 textos deste briefing nasceram com um texto provisório escrito às pressas. Sua tarefa é substituir cada provisório por um texto definitivo nas duas línguas.

## 2. Vozes por público

Cada chave da tabela traz a coluna `publico`. Ela decide a voz.

### 2.1 Jogador (voz imersiva)

O jogador está dentro de um aparelho de 1999: um terminal, um walkman, um Nokia. As mensagens parecem saídas da própria máquina. Frases curtas, secas e técnicas, sem jargão de informática moderna ("servidor", "Firestore", "cache", "token"). Nunca culpe o jogador por uma falha. Informe o efeito, não a causa técnica. Use caixa alta quando o padrão vizinho usa (rótulos de visor, prefixos de erro, botões de LCD); a coluna `onde` avisa quando a caixa alta vem do CSS, e nesse caso escreva em caixa normal. Reticências são três pontos simples, sem emoji.

Exemplos reais do projeto (português e inglês):

- `SINCRONIZANDO...` e `SYNCING...`
- `Não foi possível iniciar a câmera. Tente de novo.` e `Could not start the camera. Please try again.`
- `Falha ao sincronizar agente. Tente novamente.` e `Failed to sync agent. Try again.`
- `CONTA SUSPENSA: Contate o administrador.` e `ACCOUNT SUSPENDED: Contact the administrator.`
- `Convite não encontrado. Confira o link.` e `Invite not found. Check the link.`
- `Progresso: {{pct}}% - Analisando trilhas magnéticas` e `Progress: {{pct}}% - Analyzing magnetic tracks`

Na lore, os NPCs falam como gente comum do começo dos anos 2000, com gíria leve ("noob", "tá", "mano"). Isso vale para os diálogos em `sms/`, não para a interface. A interface fala como o aparelho, não como um personagem.

### 2.2 Mestre (ferramenta de trabalho)

O mestre abre o painel para preparar e conduzir uma sessão. A voz é de ferramenta: direta, clara, previsível. Verbo no infinitivo ou no imperativo curto nos botões, frase completa nas mensagens, nada de brincadeira nem de lore. Diga o que aconteceu e o que a pessoa pode fazer em seguida. Siga a capitalização do painel: rótulos de menu e de abas em maiúscula inicial, mensagens como frase.

Exemplos reais:

- `Nenhum agente vinculado para receber SMS` e `No linked agents to receive SMS`
- `Convite igual gerado. Link copiado.` e `Matching invite created. Link copied.`
- `Mover para pasta` e `Move to folder`
- `Últimos envios` e `Recent sends`
- `Carregar mais` e `Load more`
- `Nenhum registro` e `No records`

### 2.3 Visitante (prévia de link, página 404, manifest)

O visitante ainda não conhece o LimboOS: recebeu um link no WhatsApp, caiu numa página que não existe ou instalou o app pelo navegador. O texto precisa fazer sentido sem nenhuma noção da lore. Tom neutro e acolhedor, frases completas, nenhum termo interno sem explicação. Respeite o que cada superfície revela: a prévia de convite não pode expor missão, papel nem validade, e o texto é o mesmo quando o token é inválido. A página 404 mantém o tom seco que já tem. O `manifest` precisa combinar com a descrição da página inicial.

Exemplo real do `manifest`: `Aparelho oficial dos agentes. Uma porta disfarçada de máquina.`

### 2.4 Sistema (e-mail, consentimento, avisos de versão e de rede)

Avisos que aparecem em qualquer tela, inclusive no painel do mestre e no convite, ou fora do app (tela de consentimento do Google). Tom neutro e curto, sem imersão, porque o mesmo texto serve a jogador e a mestre. Diga o estado ("Sem sinal"), o que o app faz sozinho ("Tentando reconectar") e, quando existir, a ação do botão. Quando a coluna `onde` disser que a faixa é exibida em caixa alta por CSS, escreva em caixa normal.

## 3. Glossário de termos fixos

Use sempre estas formas. Elas já existem em `src/i18n/locales`. Não invente sinônimos nem traduza de outro jeito no inglês.

| Português | Inglês já usado | Observação |
|---|---|---|
| intel | Intel | Item entregue ao jogador (áudio, texto, imagem). Sem plural em "s". |
| fita | tape | Intel de áudio tocado no walkman. "Ejetar fita" é `Eject tape`. |
| prova, provas | evidence | Lista de itens do walkman: `Lista de Provas` é `Evidence List`. |
| agente | Agent | Personagem do jogador. |
| codinome | Codename | Nome do agente. |
| mesa | Table | Espaço de jogo de um mestre. Também `Mesa ao Vivo` é `Live Table`. |
| pasta | folder | Duas coisas: a pasta do mestre (`Pasta ativa` é `Active folder`) e pasta de mídia. |
| missão | Mission | Unidade de conteúdo. `Alternar Missão` é `Switch Mission`. |
| campanha | Campaign | Nome antigo de missão em telas do jogador; mantenha o termo da tabela. |
| mestre | master (`Acesso Mestre` é `Master Access`) e GM (`Avisos do mestre` é `GM notices`) | Prefira GM em frases e Master em rótulos de acesso, como o projeto já faz. |
| co-mestre | Co-GM | Mestre convidado a uma mesa. |
| esquadrão | Squad | Grupo de agentes. |
| convite | Invite | Link único para entrar numa mesa. |
| dossiê | Dossier | Ficha do agente. |
| conquista | Achievement | Conquista liberada por regra. |
| disquete | Diskette (`Disquete (A:)` é `Floppy (A:)`) | Mini-app de reparo de disquete. |
| SMS, NPC, QR, mini-app | SMS, NPC, QR, Mini-app | Iguais nas duas línguas. |
| Limbo, fenda | Limbo, rift | O nome Limbo não se traduz. |
| sinal | signal | Vocabulário de rádio: `SINAL: JOGADOR` é `SIGNAL: PLAYER`. |

## 4. Regras de escrita

1. **Limite de caracteres.** Cada linha traz `limite`. O texto em português e o texto em inglês precisam caber nele, contando espaços e placeholders. Se o inglês não couber, reescreva mais curto em vez de abreviar de forma estranha.
2. **Placeholders.** Preserve exatamente `{{n}}`, `{{title}}`, `{{time}}`, `{{name}}` e qualquer outro `{{...}}` que aparecer no provisório, nas duas línguas, sem traduzir o nome e sem mudar as chaves duplas.
3. **Plurais do i18next.** Chaves que terminam em `_one` e `_other` formam um par. Escreva as duas formas, cada uma como linha própria, mantendo o sufixo no campo `chave`. O inglês também usa `_one` e `_other`.
4. **Sem emojis.** Nenhum emoji, nem símbolo decorativo. Os separadores `//` e `>` só entram quando o texto vizinho já os usa.
5. **Proibições de escrita de IA.** Estas regras valem para português e inglês:
   - Nada de adjetivos que inflam a importância sem dar dado (os que dizem que algo é vital, central, indispensável ou decisivo) e nada de avisos de ressalva antes da informação (do tipo "cabe lembrar" ou "vale destacar"), em português ou em inglês. Escreva o fato direto.
   - Nada de contraste dramático em duas partes, em que a primeira nega algo que ninguém afirmou e a segunda revela a "verdade". Se há um contraste real, diga-o de forma direta.
   - Nada de gerúndio de cauda que infla o sentido ("garantindo...", "destacando...", "highlighting...").
   - Nada de travessão longo como muleta. Use vírgula, dois-pontos ou ponto.
   - Nada de frase motivacional, de saudação de chatbot ("Com certeza!", "Espero que ajude") nem de fecho moralizante.
   - Nada de listas de três adjetivos só pelo ritmo.
6. **Pontuação e caixa.** Siga o que o provisório e a coluna `onde` indicam. Botões não levam ponto final. Mensagens completas levam. Se o provisório estiver em caixa alta por escolha do visor, mantenha a caixa alta.
7. **Textos para leitor de tela.** Rótulos de acessibilidade (`aria`) descrevem a ação ou o conteúdo em poucas palavras, sem repetir o tipo do controle ("botão") e sem lore.
8. **Nunca culpe nem assuste.** Erros dizem o que aconteceu e o que fazer. Não use "falha crítica", "erro fatal" ou códigos.
9. **Mantenha o que já está bom.** Se o provisório atende ao público, ao limite e às regras, devolva-o igual. A tabela existe para corrigir, não para reescrever por reflexo.
10. **Dados desconhecidos.** Não invente e-mails, URLs nem nomes. Quando a tabela marcar um valor como pendente, devolva o provisório e acrescente o campo `nota` explicando o que falta.

## 5. Divisão em lotes

| Lote | Modelo | Público | Por que este modelo |
|---|---|---|---|
| 1 | Gemini Pro | jogador | A voz imersiva exige ouvido para ritmo, caixa alta e limite curto, e o raciocínio mais forte do Pro reduz tentativas. |
| 2 | Gemini Pro | visitante e sistema | São textos públicos que precisam funcionar fora do contexto, e uma frase mal medida aparece em prévias de link e na tela de consentimento. |
| 3 | Gemini Flash | mestre | São 62 textos de ferramenta, de registro direto e repetitivo, onde a velocidade do Flash compensa. |
| 4 | Gemini Flash | rótulos acessíveis (chaves com `aria`) e revisão final | Rótulos acessíveis são curtos, e a revisão de consistência é uma comparação mecânica de termos do glossário entre os lotes. |

Quando o lote for o 4, ele recebe duas tarefas na mesma conversa. Primeiro, escrever as chaves `aria` da tabela. Depois, receber as respostas dos lotes 1 a 3 colados em seguida e revisar apenas o inglês: termos do glossário, capitalização, `GM` contra `Master`, plurais e limites. A revisão devolve só as chaves que mudaram, no mesmo formato.

## 6. Formato de resposta exigido

Para cada lote, o Gemini responde com um JSON válido e mais nada: sem texto antes ou depois, sem cercas de código com comentários, sem explicação.

```json
{
  "pacote": "gemini-lote-1",
  "chaves": [
    { "ns": "player", "chave": "walkman.buffering", "pt-BR": "...", "en": "..." }
  ]
}
```

Regras do formato:

- `pacote` é `gemini-lote-N`, com N igual ao número do lote.
- `ns` e `chave` são idênticos aos da tabela, caractere por caractere. Não corrija nem reordene.
- Cada linha da tabela vira exatamente um objeto. Não omita linhas e não acrescente chaves novas.
- As linhas com `ns` igual a `arquivo` (`404.html`, prévia do convite em `backend/functions/invitePage.js` e `site.webmanifest`) seguem o mesmo formato. Em `chave`, repita o identificador da tabela.
- O único campo extra permitido é `nota`, para o caso da regra 10.
- O JSON precisa passar em `JSON.parse`: aspas duplas, sem vírgula sobrando, com `\"` para aspas dentro do texto.

## 7. Como aplicar a resposta (para o dono do projeto)

1. Salve cada resposta em `docs/qol/textos-gemini/lote-N.json`, com N de 1 a 4. Para os ajustes de revisão do lote 4, salve em `lote-4.json` apenas as chaves revisadas.
2. A partir da raiz do repositório, rode `node scripts/qol-merge-keys.mjs --dir docs/qol/textos-gemini --replace`. O script substitui os textos provisórios nos arquivos de `src/i18n/locales`.
3. As linhas com `ns` igual a `arquivo` não passam pelo script, porque não estão no i18n. Aplique-as à mão ou peça a um agente: o texto de `404.html`, a prévia do convite em `backend/functions/invitePage.js` e a descrição em `public/site.webmanifest`.
4. Rode `npm run lint` e abra o app em português e em inglês para conferir os limites de largura nas telas mais apertadas (visor do walkman, LCD do Nokia e botões do painel).

## 8. Tabelas dos lotes

As tabelas abaixo trazem, por chave, o namespace, a chave, o local de uso, o limite, o público e o texto provisório.

### Lote 1 (Gemini Pro): jogador

30 chaves.

| ns | chave | onde aparece | limite | provisório pt-BR | provisório en |
|---|---|---|---|---|---|
| common | toast.action.retry | botão de ação em toast de erro do jogador | 16 | TENTAR DE NOVO | RETRY |
| common | toast.action.scanAgain | botão de ação do toast de código QR inválido (aplicado em useWalkmanPlayback pelo pacote da onda 2) | 18 | ESCANEAR DE NOVO | SCAN AGAIN |
| common | toast.action.dismiss | rótulo acessível para dispensar toast com ação | 12 | FECHAR | DISMISS |
| player | profile.saveNameFail | toast de erro no dossiê ao salvar o codinome | 28 | FALHA AO SALVAR CODINOME | CODENAME SAVE FAILED |
| player | profile.photoFail | toast de erro no dossiê ao enviar a foto de perfil | 28 | FALHA AO ENVIAR FOTO | PHOTO UPLOAD FAILED |
| player | walkman.visor.buffering | visor do cassete enquanto a fita bufferiza | 24 | CARREGANDO FITA... | LOADING TAPE... |
| player | nokia.state.buffering | estado do Nokia no lugar de PLAYING durante buffering (usado pelo pacote do Nokia) | 16 | CARREGANDO... | LOADING... |
| player | toast.resumeTape | toast ao reinserir uma fita com posição guardada | 24 | FITA RETOMADA | TAPE RESUMED |
| player | toast.resumeTapeSub | subtítulo do toast de retomada | 48 | Voltou de onde você parou. | Back where you left off. |
| player | toast.action.fromStart | botão de ação do toast de retomada (onda 2, quando o toast com ação existir) | 14 | Do início | From start |
| player | toast.tapeLoadFail | título do toast quando o áudio da fita falha | 24 | FITA ILEGÍVEL | UNREADABLE TAPE |
| player | toast.tapeLoadFailSub | subtítulo do toast de fita ilegível | 48 | Não foi possível ler a fita. | The tape could not be read. |
| player | toast.tapeLoadFailOffline | subtítulo do toast de fita ilegível quando o aparelho está offline | 48 | Sem sinal. Verifique a conexão. | No signal. Check your connection. |
| arquivo | backend/functions/invitePage.js:RETRY_HTML.body | página mínima (503) que se recarrega a cada 5 s quando a Function não consegue buscar o index.html do Hosting | 60 | Sem sinal com o terminal. Tentando de novo... | No signal from the terminal. Retrying... |
| player | walkman.library.nowPlaying | sufixo do aria-label da fita que está tocando | 20 | tocando agora | now playing |
| player | campaign.progressValueText | aria-valuetext do slider de campanhas (TapeProgress) | 30 | Missão {{current}} de {{total}} | Mission {{current}} of {{total}} |
| player | sync.error.title | título da faixa quando um listener do Firestore falha com rede | 24 | SINAL INSTÁVEL | UNSTABLE SIGNAL |
| player | sync.error.body | corpo da faixa em erro de rede | 60 | A sincronização caiu. Novos itens podem demorar. | Sync dropped. New items may be delayed. |
| player | sync.error.bodyServer | corpo da faixa em erro que não é de rede | 60 | O servidor recusou a sincronização. | The server refused to sync. |
| player | sync.error.retry | botão da faixa de sincronização | 16 | TENTAR DE NOVO | TRY AGAIN |
| player | sync.error.retrying | botão enquanto reassina os listeners | 16 | RECONECTANDO... | RECONNECTING... |
| player | offline.lost | toast quando a rede cai no player | 16 | SEM SINAL | NO SIGNAL |
| player | offline.restored | toast quando a rede volta no player | 24 | SINAL RESTABELECIDO | SIGNAL RESTORED |
| player | login.password.show | rótulo do botão de olho no campo de senha do login (aria-label e title) | 20 | Mostrar senha | Show password |
| player | login.password.hide | title do botão de olho quando a senha está visível | 20 | Ocultar senha | Hide password |
| player | login.hint.lostAccess | linha abaixo do campo de senha no login | 50 | PERDEU O ACESSO? FALE COM O MESTRE DA MESA. | LOST ACCESS? CONTACT YOUR GAME MASTER. |
| common | auth.error.tooManyRequests | erro do login ao exceder tentativas | 70 | ACESSO BLOQUEADO: muitas tentativas. Aguarde alguns minutos. | ACCESS LOCKED: too many attempts. Wait a few minutes. |
| common | errorBoundary.miniApp.title | placa de erro dentro do overlay de mini-app | 24 | CONEXÃO PERDIDA | CONNECTION LOST |
| common | errorBoundary.miniApp.body | corpo da placa de erro do mini-app | 70 | O sistema caiu. Sua fita continua intacta no aparelho. | The system went down. Your tape is still safe in the player. |
| common | errorBoundary.miniApp.back | botão da placa de erro do mini-app | 24 | Voltar ao aparelho | Back to device |

### Lote 2 (Gemini Pro): visitante e sistema

14 chaves.

| ns | chave | onde aparece | limite | provisório pt-BR | provisório en |
|---|---|---|---|---|---|
| common | offline.banner | faixa fixa no topo de todas as telas enquanto o aparelho está sem rede (fonte mono, caixa alta por CSS) | 36 | Sem sinal. Tentando reconectar | No signal. Trying to reconnect |
| common | offline.restored | mesma faixa do topo por 2,5 s quando a rede volta (admin, convite e terminal; no player o aviso é o toast de usePlayerSync) | 36 | Sinal restabelecido | Signal restored |
| common | update.available | aviso fixo no canto inferior esquerdo quando o site publicado muda durante a sessão | 40 | Nova versão disponível. | A new version is available. |
| common | update.action | botão do aviso de nova versão; recarrega a página | 12 | Atualizar | Update |
| arquivo | 404.html:convite | parágrafo extra da página 404, antes do botão de voltar | 160 | Se você recebeu este endereço como convite, o link pode estar quebrado ou incompleto. Peça um novo link ao mestre da sua mesa. | If you received this address as an invite, the link may be broken or incomplete. Ask the master of your table for a new link. |
| arquivo | backend/functions/invitePage.js:INVITE_COPY.valid.title | <title>, og:title e twitter:title da prévia de um link de convite válido; {mesa} é o nome da mesa (workspaces/{ws}.name, cortado em 48 caracteres). A Function só serve pt-BR; o en fica registrado para uma versão futura | 70 | Convite para a mesa {mesa} | Invitation to the {mesa} table |
| arquivo | backend/functions/invitePage.js:INVITE_COPY.valid.description | description, og:description e twitter:description da prévia de convite válido; não pode citar missão, tipo de convite (jogador ou co-mestre), dono ou vagas | 110 | Um lugar na mesa espera por você. Abra o link no aparelho para aceitar o convite. | A seat at the table is waiting for you. Open the link on your device to accept the invitation. |
| arquivo | backend/functions/invitePage.js:INVITE_COPY.generic.title | <title>, og:title e twitter:title da prévia genérica, usada para token inexistente, expirado, revogado, esgotado ou quando a leitura falha; não pode sugerir se o convite vale ou não | 60 | LimboOS \| Convite | LimboOS \| Invitation |
| arquivo | backend/functions/invitePage.js:INVITE_COPY.generic.description | description, og:description e twitter:description da prévia genérica do convite; mesma restrição do título genérico | 110 | Abra o link no aparelho para ver o convite do terminal dos agentes. | Open the link on your device to see the invitation to the agents' terminal. |
| arquivo | backend/firebase.json:auth.providers.googleSignIn.oAuthBrandDisplayName | nome do app na tela de consentimento do login com Google (vale em firebase deploy --only auth; o console prevalece se divergir) | 30 | LimboOS | LimboOS |
| arquivo | backend/firebase.json:auth.providers.googleSignIn.supportEmail | e-mail de suporte da tela de consentimento do Google; hoje está support@undefined.firebaseapp.com, inválido, e não há endereço real no repositório | 254 | PENDENTE: e-mail de suporte informado pelo dono | PENDING: support e-mail provided by the owner |
| common | invite.reason.network | cartão do convite quando a consulta falha por rede | 70 | SEM SINAL: não deu para ler o convite. Verifique a rede. | NO SIGNAL: could not read the invite. Check your network. |
| common | invite.reason.unexpected | cartão do convite quando a consulta falha por outro motivo | 70 | Falha inesperada ao ler o convite. Tente de novo. | Unexpected error reading the invite. Try again. |
| common | invite.retry | botão do cartão de falha do convite | 20 | Tentar novamente | Try again |

### Lote 3 (Gemini Flash): mestre

60 chaves.

| ns | chave | onde aparece | limite | provisório pt-BR | provisório en |
|---|---|---|---|---|---|
| admin | intel.catalog.duplicate | dica do botão de duplicar na linha do catálogo de intel | 14 | Duplicar | Duplicate |
| common | copySuffix | sufixo do título de um item duplicado (anexado após o título, com parênteses) | 12 | (cópia) | (copy) |
| admin | intel.catalog.sort.default | opção padrão do seletor de ordem do catálogo de intel | 22 | Ordem do catálogo | Catalog order |
| admin | bulk.moveToFolder | botão da barra de lote da grade de mídia | 20 | Mover para pasta | Move to folder |
| admin | bulk.linkMission | seletor da barra de lote do catálogo de intel | 22 | Vincular a missão | Link to mission |
| admin | bulk.unlinkMission | opção do seletor de vínculo em lote que remove a missão | 16 | Sem missão | No mission |
| admin | bulk.remove | botão e título do diálogo de remoção em lote | 16 | Remover | Remove |
| admin | bulk.removeBody_one | corpo do diálogo de remoção em lote de intel (singular) | 100 | Remover {{count}} item do catálogo? Jogadores que já têm o item mantêm no inventário. | Remove {{count}} item from the catalog? Players who already have it keep it in their inventory. |
| admin | bulk.removeBody_other | corpo do diálogo de remoção em lote de intel (plural) | 100 | Remover {{count}} itens do catálogo? Jogadores que já têm os itens mantêm no inventário. | Remove {{count}} items from the catalog? Players who already have them keep them in their inventory. |
| admin | bulk.removeFilesBody_one | corpo do diálogo de remoção em lote na grade de mídia (singular) | 90 | Remover permanentemente {{count}} arquivo? Isso pode quebrar links existentes. | Permanently remove {{count}} file? This may break existing links. |
| admin | bulk.removeFilesBody_other | corpo do diálogo de remoção em lote na grade de mídia (plural) | 90 | Remover permanentemente {{count}} arquivos? Isso pode quebrar links existentes. | Permanently remove {{count}} files? This may break existing links. |
| admin | bulk.result | toast do resultado de uma ação em lote sem falhas | 40 | {{ok}} de {{total}} itens processados | {{ok}} of {{total}} items processed |
| admin | bulk.resultPartial | toast do resultado de uma ação em lote com falhas | 44 | {{ok}} processados, {{failed}} falharam | {{ok}} processed, {{failed}} failed |
| admin | intel.delete.storageCheckbox | caixa do diálogo de remover intel que tem arquivo | 40 | Apagar também o arquivo do Storage | Also delete the file from Storage |
| admin | intel.delete.sharedFileWarning | aviso sob a caixa quando o arquivo é compartilhado (caixa desmarcada por padrão) | 70 | Outra intel usa este mesmo arquivo. Apagá-lo quebra essa intel. | Another intel uses this same file. Deleting it breaks that intel. |
| admin | intel.editor.saveShortcutHint | dica (title) do botão de salvar do editor de intel | 16 | ⌘S ou ⌘Enter | ⌘S or ⌘Enter |
| admin | media.queue.title | título da lista de arquivos em envio | 20 | Fila de envio | Upload queue |
| admin | media.queue.tooLarge | erro de um arquivo acima do limite, antes de enviar | 40 | Maior que o limite de {{max}} MB | Larger than the {{max}} MB limit |
| admin | media.queue.badType | erro de um arquivo com tipo não aceito | 60 | Tipo não permitido (áudio, imagem, vídeo ou PDF) | File type not allowed (audio, image, video or PDF) |
| admin | media.queue.retry | botão por arquivo com erro de envio | 18 | Tentar de novo | Retry |
| admin | media.queue.clearDone | botão que remove da fila os arquivos enviados | 22 | Limpar concluídos | Clear finished |
| admin | media.queue.done | rótulo do arquivo enviado com sucesso | 12 | Enviado | Uploaded |
| admin | intel.editor.previewAsPlayer | botão do editor de intel e do contato NPC que abre a prévia lateral | 22 | Ver como jogador | View as player |
| admin | intel.editor.previewClose | rótulo acessível do X do painel de prévia | 18 | Fechar prévia | Close preview |
| admin | intel.editor.previewUnavailable | mensagem do painel quando o tipo não tem prévia | 80 | A prévia cobre texto, imagem e meta. Áudio e vídeo não têm prévia aqui. | Preview covers text, image and meta. Audio and video have no preview here. |
| admin | common.copySuffix | sufixo do título/nome de conquista e NPC duplicados (pode já existir no pacote da intel) | 10 | (cópia) | (copy) |
| admin | achievements.duplicate | botão no card da conquista | 12 | Duplicar | Duplicate |
| admin | npcSms.duplicate | botão na linha do contato de NPC | 12 | Duplicar | Duplicate |
| admin | draft.* | usadas pelos editores de conquista e NPC via useDraftGuard | 0 | (já registradas em A3) | (already in A3) |
| admin | redirects.removeTitle | título do diálogo de remoção de QR | 30 | Remover redirecionamento | Remove redirect |
| admin | redirects.removeBody | corpo do diálogo de remoção de QR | 90 | O código {{sourceId}} deixará de apontar para a intel de destino. | Code {{sourceId}} will stop pointing to its target intel. |
| admin | redirects.removeAction | botão de confirmar remoção | 12 | Remover | Remove |
| admin | redirects.removed | toast após remover QR, com ação Desfazer | 40 | Redirecionamento removido. | Redirect removed. |
| admin | common.undo | ação do toast de remoção | 12 | Desfazer | Undo |
| admin | saveShortcutHint | title do botão salvar dos editores | 30 | Salvar (⌘S ou Ctrl+S) | Save (⌘S or Ctrl+S) |
| admin | list.sort.default | opção de ordenação que mantém a ordem original | 14 | Padrão | Default |
| admin | jukebox.removeFail | toast de erro ao apagar o documento da faixa | 50 | Não foi possível remover a faixa. | Could not remove the track. |
| admin | jukebox.removeOrphan | toast quando só o arquivo falha (arquivo órfão) | 120 | Faixa removida, mas o arquivo não foi apagado do Storage: {{path}} | Track removed, but the file was not deleted from Storage: {{path}} |
| admin | missions.duplicate | tooltip e rótulo do botão no card da missão | 22 | Duplicar missão | Duplicate mission |
| admin | missions.resources.search | campo de busca da aba Recursos | 34 | Buscar nos recursos da missão | Search mission resources |
| admin | missions.resources.noMatch | coluna de Recursos quando a busca não acha nada | 24 | Nada encontrado. | No matches. |
| admin | team.duplicateInvite | botão em cada convite ativo | 14 | Gerar igual | Generate same |
| admin | team.toast.duplicated | toast depois de duplicar um convite | 44 | Convite igual gerado. Link copiado. | Matching invite created. Link copied. |
| admin | team.noInvitesAction | botão no bloco vazio de convites | 26 | Gerar primeiro convite | Create first invite |
| admin | live.undo.delivered | toast com Desfazer após entregar intel ou conquista | 44 | Entrega feita para {{n}} agente(s). | Delivered to {{n}} agent(s). |
| admin | live.undo.done | toast depois de desfazer | 90 | Entrega desfeita para {{n}} agente(s). Notificações já enviadas não são recolhidas. | Delivery undone for {{n}} agent(s). Notifications already sent are not recalled. |
| admin | live.undo.fail | toast de erro ao desfazer | 44 | Não foi possível desfazer a entrega. | Could not undo the delivery. |
| admin | draft.title | título do diálogo ao fechar um editor com alterações não salvas | 28 | Descartar alterações? | Discard changes? |
| admin | draft.body | corpo do diálogo de descarte de rascunho | 90 | O que você digitou neste editor ainda não foi salvo e será perdido. | What you entered in this editor has not been saved and will be lost. |
| admin | draft.discard | botão de confirmar do diálogo de descarte | 14 | DESCARTAR | DISCARD |
| admin | draft.keep | botão de cancelar do diálogo de descarte | 22 | CONTINUAR EDITANDO | KEEP EDITING |
| admin | bulk.selected_one | BulkActionBar, contagem (singular) | 24 | {{count}} selecionado | {{count}} selected |
| admin | bulk.selected_other | BulkActionBar, contagem (plural) | 24 | {{count}} selecionados | {{count}} selected |
| admin | bulk.clear | BulkActionBar, botão que limpa a seleção | 12 | Limpar | Clear |
| admin | bulk.selectAll | BulkActionBar, botão que marca todos os itens visíveis | 20 | Selecionar todos | Select all |
| admin | list.sortLabel | rótulo acessível do SortSelect | 14 | Ordenar | Sort |
| admin | list.sort.recent | opção do SortSelect (só mídia) | 18 | Mais recentes | Newest first |
| admin | list.sort.title | opção do SortSelect | 18 | Título (A-Z) | Title (A-Z) |
| admin | list.sort.type | opção do SortSelect | 14 | Tipo | Type |
| admin | list.sort.id | opção do SortSelect | 10 | ID | ID |

### Lote 4 (Gemini Flash): rótulos acessíveis

3 chaves.

| ns | chave | onde aparece | limite | provisório pt-BR | provisório en |
|---|---|---|---|---|---|
| player | nokia.aria.eject | aria-label do botão de ejetar do Nokia (leitor de tela) | 24 | Ejetar fita | Eject tape |
| player | nokia.aria.video | aria-label do vídeo e do grupo da superfície de vídeo do Nokia | 60 | Vídeo: {{title}} | Video: {{title}} |
| player | walkman.library.itemAria | aria-label de cada fita da lista de provas do walkman | 80 | {{title}}, {{type}} | {{title}}, {{type}} |
