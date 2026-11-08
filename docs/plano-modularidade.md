# Plano de modularidade do LimboOS

Revisão de 30/10/2026, atualizada em 07/11/2026 com a etapa 1 concluída. Este documento cobre o que ainda exige código para montar uma campanha nova e propõe a ordem para levar cada item ao painel admin. A seção 0 registra o que o admin já faz depois da entrega desta data, para servir de linha de base.

## 0. Linha de base: o que o admin cobre hoje

A missão passou a ser o ponto de entrada para os recursos modulares. O modal de comando ganhou a aba **Recursos**, que mostra um checklist de prontidão (briefing, capa, intel, conquistas, NPCs/SMS e esquadrões com acesso) e as listas de intel, conquistas e NPCs vinculados àquela campanha. Cada atalho abre o catálogo certo já filtrado pela missão ou com o editor de criação aberto e a missão pré-selecionada. O cartão de cada missão mostra a contagem de recursos e a nota de prontidão. Na Etapa 4 o modal virou a página da missão (`/admin/missions/:id/:seção`): criar intel, conquista ou NPC abre o editor sobre a própria página, e "Ver no catálogo" empilha Conteúdo filtrado pela missão.

Os catálogos de intel (Conteúdo), conquistas e SMS/NPCs ganharam o mesmo filtro por missão (todas, só globais ou uma campanha). O editor de NPC passou a expor o vínculo com missões, que existia no modelo `NpcContact.campaignIds` sem campo na tela. O editor de conquistas listava só as campanhas do seed local e agora usa a lista viva do Firestore. A distribuição de SMS de um esquadrão mostra apenas os NPCs globais e os da missão dele, com opção de exibir todos. O painel de QR & Links sugere a intel de destino pelo título e marca destinos que não existem no catálogo.

Duas correções de comportamento acompanharam a entrega. Os seletores de campanha deixaram de mesclar o seed local com o Firestore, mistura que fazia missões apagadas reaparecerem nos formulários. Criar a primeira conquista ou o primeiro NPC antes de importar as sugestões agora pede para importar antes, porque o primeiro documento remoto substitui o catálogo de sugestões inteiro.

A etapa 1 (07/11/2026) tirou o seed do caminho de runtime: nenhum código grava mais o seed sozinho. Apagar uma missão desfaz os vínculos no mesmo fluxo: esquadrões e agentes perdem a missão ativa e a liberada, conquistas e NPCs tiram o id do vínculo, e a confirmação lista o que muda e quantas intel ficam marcadas (essas não são alteradas, porque limpar o campo as tornaria globais). A marca `system/catalogState` que a etapa criou foi substituída pelo modelo de pastas da Fase 1 multi-tenant (seção 1). Com a lista de Missões vazia, o dono vê "Nova missão" e o co-mestre vê o aviso de que ainda não foi convidado para nenhuma missão da pasta.

## 1. Âncora comum: o pacote de campanha

Conquistas e SMS já seguem um padrão que funciona e deve ser a referência para o resto: um serviço singleton de catálogo (`AchievementCatalogService`, `NpcSmsCatalogService`) com listener do Firestore, normalização de documentos, campo `source` (`suggestion` ou `custom`), vínculo `campaignIds` (`'global'` ou lista) e `importSuggestions()` para copiar o seed. Todo conteúdo que hoje vive em componente deve migrar para esse mesmo formato, agrupado no que este plano chama de **pacote de campanha**: documentos no Firestore indexados por `campaignId`, lidos pelo player em runtime e editados pelo admin.

O padrão tinha uma falha, resolvida na etapa 1: os serviços decidiam entre remoto e seed pelo tamanho da coleção, o que recriava missões apagadas (o `CampaignsPanel` e o `CampaignService` do player gravavam o seed quando a consulta voltava vazia, inclusive com todas as missões arquivadas), fazia sugestões sumirem no primeiro documento remoto e deixava `campaignLabel()` mostrar nomes do seed para missões apagadas. A etapa 1 resolveu com a marca `system/catalogState`, gravada em toda escrita do admin.

A Fase 1 multi-tenant tornou a marca desnecessária. Os catálogos passaram para `workspaces/{ws}/...`, cada pasta começa vazia e o conteúdo vem sempre do Firestore da pasta; o bundle só oferece como sugestão as conquistas globais dos mini-apps (`src/data/achievements.ts`), e a lore das campanhas originais (missões, conquistas e NPCs) foi para `backend/scripts/legacy-seed/*.json`, usada só na migração da pasta original. Por isso a regra de leitura de `system/catalogState` para jogadores não vai existir. `CatalogStateService` ficou como stub que responde "inicializado" para todo catálogo, e as chamadas a ele em `AchievementCatalogService` e `NpcSmsCatalogService` podem sair quando a Fase 1 fechar. Um catálogo novo, inclusive os pacotes da seção 2, não precisa de marca: basta morar dentro da pasta.

## 2. Mini-apps configuráveis por campanha

Este é o maior bloco de conteúdo preso ao código. Os cinco mini-apps somam cerca de 1.700 linhas de componente (`BiosTerminal.tsx` 417, `MacOsApp.tsx` 390, `LimboBoard.tsx` 356, `Windows95App.tsx` 323, `DiskRepairApp.tsx` 195), mais `src/data/bios_terminal_commands.ts` com o IP alvo `212.045.001.001`, os textos de `HELP`, `DIR` e `VER` e a lore da lanhouse Haven Bytes. O fórum do Limbo é uma constante `THREADS` com JSX dentro do componente, inclusive os parágrafos de tradução do tópico japonês.

A proposta separa renderizador e conteúdo. Cada mini-app vira um componente que recebe um pacote tipado, e o conteúdo atual de Swallow Rest vira o pacote-semente de `last-rewind`, movido para `src/data/packs/last-rewind/`. O player lê o pacote da campanha ativa por um hook `useCampaignApp(appId)` e cai no pacote-semente enquanto a campanha não tiver o seu.

| Mini-app | Esquema do pacote | Efeitos permitidos |
|---|---|---|
| Fórum Limbo | `boardName`, `threads[]` com `posts[]` (`author`, `date`, `body` em Markdown restrito, `translation?`, `style`), mensagem de tomada do fórum | marcar tópico lido |
| MH-DOS | `prompt`, `volumeLabel`, `commands[]` (`name`, `aliases`, `response`), `hosts[]` (`ip`, `opensApp`, `requiresFlag?`) | abrir app, liberar intel, ligar flag de `PlayerStats` |
| Win95 / Mac | `wallpaper`, `files[]` (`name`, `icon`, `kind`: texto, imagem ou intel, `intelId?`) | abrir intel, abrir app |
| DiskRepair | `disks[]` (`corruptedIntelId`, `repairedIntelId`, parâmetros do quebra-cabeça) | liberar intel reparada |

Os efeitos ficam numa lista fechada, interpretada por um motor que chama os serviços existentes (`IntelService` para liberar intel, a escrita de stats que já alimenta `FlagRule`). Pacote não executa código: o mestre combina efeitos conhecidos, e um efeito novo continua sendo trabalho de programação. Essa fronteira mantém as regras do Firestore simples (leitura para jogadores autenticados, escrita só para admin) e impede que um pacote quebre o player.

No admin, a edição entra como a seção **Apps** da página da missão (`/admin/missions/:id/apps`, um id a mais em `MISSION_SECTIONS` de `src/admin/lib/adminNavigation.ts`), com um editor por tipo: tabela de comandos e hosts para o MH-DOS, editor de tópicos para o fórum (o editor de turnos de diálogo do `NpcSmsPanel` já resolve a mesma forma de lista ordenada de mensagens) e lista de arquivos para os desktops. Importar e exportar o pacote em JSON cobre a criação em massa e o versionamento fora do Firestore.

A ordem recomendada começa pelo fórum, que é conteúdo puro sem efeitos e tem o menor risco de regressão. Depois vem o MH-DOS, que exige o motor de efeitos. Win95 e Mac reaproveitam o motor. DiskRepair fica por último, porque a mecânica do quebra-cabeça está acoplada a `DiskRepairService.ts` e aos ids de intel fixos.

## 3. Regras de conquista sem classe nova

`AchievementManager.ts` tem dez classes de regra e um `switch` em `ruleFromSpec()`. O `EvaluationContext` já entrega stats do jogador, intel liberada com metadados, contagem de scans rápidos, campanha e plataforma. A maior parte das conquistas que um mestre pediria é combinação desses dados, e hoje cada combinação nova vira uma classe.

A proposta adiciona um tipo de regra `condition`, composto de condições simples:

```ts
type Condition =
  | { source: 'stat'; key: keyof PlayerStats; op: '>=' | '=='; value: number }
  | { source: 'intelCount'; filter: { type?: IntelType; level?: AccessLevel; chapter?: string; campaignOnly?: boolean }; op: '>='; value: number }
  | { source: 'intelUnlocked'; intelId: string }
  | { source: 'achievement'; id: string };

type ConditionRule = { type: 'condition'; all?: Condition[]; any?: Condition[] };
```

A condição `intelUnlocked` atende o pedido mais comum de mesa, "conquista ao achar a prova X", que hoje só é possível com o atalho de `loreKeyword` buscando no título. Os tipos atuais continuam válidos e aparecem no editor como modelos prontos que preenchem uma `condition` equivalente, sem migração de dados.

O `switch` vira um registro (`RULE_REGISTRY`) em que cada tipo declara rótulo, esquema de campos e fábrica. O `AchievementEditorModal` passa a gerar o formulário a partir do esquema. A fronteira fica explícita: um **sinal** novo (por exemplo, contar quantas vezes o jogador abriu o MH-DOS) exige código para emitir a stat; uma **combinação** nova de sinais existentes é configuração no admin.

## 4. Aparelho novo

`playerType` aceita `walkman` e `nokia`, e a decisão está espalhada: `isNokiaTheme` em `useActiveCampaign.ts` e `PlayerRootShell.tsx`, o rótulo de lado da fita em `CassetteCard.tsx`, as plataformas de conquista (`walkman`, `nokia`, `global`) e agora o checklist do admin, que considera SMS aplicável só no Nokia. O ponto de partida já existe: `DeviceCapabilities` em `useActiveCampaign.ts`, com o comentário de que o motor consulta capacidades e não o tipo do aparelho. Hoje o contrato só declara `supportsVideo`.

A proposta transforma esse contrato num registro de aparelhos:

```ts
interface DeviceDefinition {
  id: string;                 // 'walkman' | 'nokia' | futuros
  labelKey: string;           // i18n
  capabilities: { video: boolean; sms: boolean; gallery: boolean };
  Shell: React.LazyExoticComponent<React.ComponentType<DeviceShellProps>>;
  achievementPlatform: PlayerPlatform;
}
```

Cada `isNokiaTheme` vira uma consulta de capacidade (`capabilities.sms`, `capabilities.video`), o seletor de aparelho no admin e o checklist de prontidão leem o registro, e as plataformas de conquista derivam do mesmo id. Um terceiro aparelho continua exigindo o componente de interface (o shell), mas deixa de exigir alterações no admin, nas conquistas e no gating de recursos. Variações visuais de um aparelho existente (paleta, nome da marca, som de bipe) cabem num campo `theme` da campanha, sem shell novo.

## 5. Intel fixa e integridade dos vínculos

`LOCAL_INTEL_ITEMS` em `src/data/intel_registry.ts` tem dois itens (`evidence-disk-01` e `evidence-disk-01-corrupted`) que não podem ser apagados pelo admin, porque `DiskRepairApp.tsx`, `MacOsApp.tsx` e `DiskRepairService.ts` buscam esses ids diretamente. Eles devem migrar para o pacote do DiskRepair (seção 2) e, até lá, aparecer como sugestão importável no padrão das conquistas. Quando o DiskRepair ler os ids do pacote, `intel_registry.ts` fica só com o registro em memória, sem conteúdo de lore.

A integridade dos vínculos ao apagar uma missão foi resolvida na etapa 1 (`collectCampaignLinks` em `src/admin/lib/campaignResources.ts` e `CampaignAdminService.deleteCampaign`). O que sobra é a intel marcada com a missão apagada: ela fica invisível para os jogadores e aparece na confirmação, mas não há tela que liste intel órfã. Um filtro "missão apagada" no catálogo de Conteúdo resolveria isso quando a intel fixa sair do código.

## 6. Ordem de execução

| Etapa | Escopo | Risco | Depende de |
|---|---|---|---|
| 1 | Concluída em 07/11/2026; a marca de catálogo deu lugar ao modelo de pastas da Fase 1 multi-tenant (ver seção 1) | baixo | nada |
| 2 | Regra `condition`, `RULE_REGISTRY` e editor gerado por esquema | médio, isolado em `AchievementManager` e no editor | nada |
| 3 | Pacote do fórum Limbo e seção Apps da página da missão | médio | etapa 1 |
| 4 | Pacote do MH-DOS e motor de efeitos | alto, toca no fluxo de desbloqueio | etapa 3 |
| 5 | Registro de aparelhos e troca de `isNokiaTheme` por capacidades | alto, toca nos shells do player | nada |
| 6 | Pacotes de Win95, Mac e DiskRepair, saída da intel fixa | médio | etapas 4 e 5 |

As etapas 1 e 2 são independentes e podem correr em paralelo. A etapa 5 também não depende das outras, mas mexe no player inteiro e merece uma rodada de teste em Walkman e Nokia antes de seguir.

## 7. Pendências observadas fora do escopo

Os painéis de Conquistas, SMS/NPCs e QR & Links ainda usam o vocabulário visual antigo (`font-black`, bordas de 4px, `bg-black/40`) em vez das classes `lmb-btn` e `lmb-field` dos outros painéis. A migração é mecânica e pode acompanhar a etapa 2.

O modal de distribuição de SMS recalculava a distribuição a cada render, porque `useNpcSmsCatalog` devolvia listas novas a cada chamada e elas entravam nas dependências de um efeito que grava estado. A entrega desta data memoizou as listas no hook. O efeito ainda chama funções que ficam fora das dependências (há um `eslint-disable` na linha), e a pré-visualização ficaria mais simples como `useMemo` derivado do estado.
