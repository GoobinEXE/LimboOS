import type { PlayerStats } from '../types/player';
import type { IntelItem } from '../types/intel';
import {
  Achievement,
  AudioTapeCountRule,
  ListenTimeRule,
  SecretTapeRule,
  LoreRule,
  RapidScanRule,
  MechanicsRule,
  FlagRule,
  AllFlagsRule,
  ManualRule,
  achievementManager,
  EvaluationContext,
  type PlayerPlatform,
} from '../services/AchievementManager';

const icon = (id: string) => `/achievements/${id}.png`;

const WALKMAN_LR: PlayerPlatform[] = ['walkman'];
const NOKIA_SB: PlayerPlatform[] = ['nokia'];
const GLOBAL: PlayerPlatform[] = ['global'];
const CAM_LR = ['last-rewind'] as string[];
const CAM_SB = ['last-rewind-side-b'] as string[];

const registerAchievements = () => {
  // --- Progressão (Walkman / LAST REWIND) ---
  achievementManager.register(new Achievement(
    'ACH-FIRST', 'Primeiro Contato', 'Deu o primeiro passo neste abismo.', icon('ACH-FIRST'), '???',
    new AudioTapeCountRule(1), 'Encontrar e escanear 1 fita de áudio.', 'progression', 'common', true, WALKMAN_LR, CAM_LR
  ));
  achievementManager.register(new Achievement(
    'ACH-THREE', 'Colecionador', 'Uma pequena amostra do que está por vir.', icon('ACH-THREE'), '???',
    new AudioTapeCountRule(3), 'Escanear 3 fitas de áudio diferentes.', 'progression', 'common', true, WALKMAN_LR, CAM_LR
  ));
  achievementManager.register(new Achievement(
    'ACH-FIVE', 'Arquivista', 'A busca pelo conhecimento nunca termina.', icon('ACH-FIVE'), '???',
    new AudioTapeCountRule(4), 'Escanear 4 fitas de áudio diferentes.', 'progression', 'rare', true, WALKMAN_LR, CAM_LR
  ));
  achievementManager.register(new Achievement(
    'ACH-ALL', 'Biblioteca Completa', 'Nada mais escapa da sua percepção.', icon('ACH-ALL'), '???',
    new AudioTapeCountRule(5), 'Escanear todas as 5 fitas normais da 1ª temporada.', 'progression', 'legendary', true, WALKMAN_LR, CAM_LR
  ));
  achievementManager.register(new Achievement(
    'ACH-LISTENER', 'Agente Ativo', 'Apenas escutando os recados.', icon('ACH-LISTENER'), '???',
    new ListenTimeRule(120), 'Acumular 2 minutos de escuta.', 'progression', 'common', true, WALKMAN_LR, CAM_LR
  ));
  achievementManager.register(new Achievement(
    'ACH-TIME-30', 'Sinal Sustentado', 'O ruído branco já não incomoda.', icon('ACH-TIME-30'), '???',
    new ListenTimeRule(1800), 'Acumular 30 minutos de escuta total.', 'progression', 'common', true, WALKMAN_LR, CAM_LR
  ));
  achievementManager.register(new Achievement(
    'ACH-TIME-1', 'Ouvinte Assíduo', 'Sons começam a fazer parte do silêncio.', icon('ACH-TIME-1'), '???',
    new ListenTimeRule(3600), 'Acumular 1 hora de escuta.', 'progression', 'rare', true, WALKMAN_LR, CAM_LR
  ));
  achievementManager.register(new Achievement(
    'ACH-TIME-10', 'Audiófilo', 'Vozes ecoam pela cabeça.', icon('ACH-TIME-10'), '???',
    new ListenTimeRule(36000), 'Acumular 10 horas de escuta.', 'progression', 'rare', true, WALKMAN_LR, CAM_LR
  ));
  achievementManager.register(new Achievement(
    'ACH-TIME-50', 'Fita Gasta', 'Você já esqueceu como era a vida antes.', icon('ACH-TIME-50'), '???',
    new ListenTimeRule(180000), 'Acumular 50 horas de reprodução.', 'progression', 'legendary', true, WALKMAN_LR, CAM_LR
  ));
  achievementManager.register(new Achievement(
    'ACH-FULL-LISTEN', 'Fim da Fita', 'O clique final do carretel.', icon('ACH-FULL-LISTEN'), '???',
    new MechanicsRule('fullTapeListens', 1), 'Ouvir uma fita inteira até o fim.', 'progression', 'common', true, WALKMAN_LR, CAM_LR
  ));
  achievementManager.register(new Achievement(
    'ACH-FAST-SCAN', 'Data Miner', 'Rápido demais para o sistema.', icon('ACH-FAST-SCAN'), '???',
    new RapidScanRule(3), 'Escanear 3 fitas em menos de 5 minutos.', 'progression', 'rare', true, WALKMAN_LR, CAM_LR
  ));

  // --- Exploração ---
  achievementManager.register(new Achievement(
    'ACH-BIOS-BOOT', 'POST Completo', 'O firmware ainda responde.', icon('ACH-BIOS-BOOT'), '???',
    new FlagRule('biosOpened'), 'Abrir o terminal BIOS pela primeira vez.', 'exploration', 'common', true, GLOBAL, 'global'
  ));
  achievementManager.register(new Achievement(
    'ACH-WIN95-BOOT', 'Plug and Play', 'Bem-vindo a 1995.', icon('ACH-WIN95-BOOT'), '???',
    new FlagRule('win95Opened'), 'Inicializar o Windows 95 pelo terminal.', 'exploration', 'common', true, GLOBAL, 'global'
  ));
  achievementManager.register(new Achievement(
    'ACH-OS-TRIPLE', 'Trindade de Interfaces', 'CLI, GUI e o que veio antes.', icon('ACH-OS-TRIPLE'), '???',
    new AllFlagsRule(['biosOpened', 'win95Opened', 'macosOpened']),
    'Visitar BIOS, Windows 95 e Mac OS pelo menos uma vez.', 'exploration', 'rare', true, GLOBAL, 'global'
  ));
  achievementManager.register(new Achievement(
    'ACH-ARCHIVE-OPEN', 'Arquivo Aberto', 'Papel, pixels e ruído de scanner.', icon('ACH-ARCHIVE-OPEN'), '???',
    new FlagRule('archiveOpened'), 'Abrir um intel visual ou textual no leitor de evidências.', 'exploration', 'common', true, WALKMAN_LR, CAM_LR
  ));
  achievementManager.register(new Achievement(
    'ACH-REPAIR-APP', 'Engenheiro de Software', 'Interfaces visuais em um mundo CLI.', icon('ACH-REPAIR-APP'), '???',
    new ManualRule(), 'Iniciar o aplicativo de reparo de discos.', 'exploration', 'common', true, GLOBAL, 'global'
  ));
  achievementManager.register(new Achievement(
    'ACH-REPAIR-FAIL', 'Setor Defeituoso', 'A agulha não consegue ler o caos de primeira.', icon('ACH-REPAIR-FAIL'), '???',
    new ManualRule(), 'Diagnosticar o disquete corrompido.', 'exploration', 'rare', true, GLOBAL, 'global'
  ));
  achievementManager.register(new Achievement(
    'ACH-REPAIR-SUCCESS', 'A Verdade no Zero', 'O conteúdo da fenda foi restaurado.', icon('ACH-REPAIR-SUCCESS'), '???',
    new ManualRule(), 'Reparar o disquete e ler a mensagem oculta.', 'exploration', 'legendary', true, GLOBAL, 'global'
  ));

  // --- Lore ---
  achievementManager.register(new Achievement(
    'ACH-SECRET', 'Você Não Deveria Estar Aqui', 'Algumas coisas devem permanecer ocultas.', icon('ACH-SECRET'), '???',
    new SecretTapeRule(), 'Desbloquear qualquer intel marcado como secreto.', 'lore', 'rare', true, GLOBAL, 'global'
  ));
  achievementManager.register(new Achievement(
    'ACH-LORE-ANALOG', 'Viajante Analógico', 'A entidade na fita magnetizada.', icon('ACH-LORE-ANALOG'), '???',
    new LoreRule('analog_traveler'), 'Desbloquear uma fita do artista Analog_Traveler.', 'lore', 'rare', true, GLOBAL, 'global'
  ));
  achievementManager.register(new Achievement(
    'ACH-LIMBO-FOUND', 'Despertar', 'Onde nós realmente estamos?', icon('ACH-LIMBO-FOUND'), '???',
    new ManualRule(), 'Acessar o BBS secreto Limbo_01.', 'lore', 'rare', true, GLOBAL, 'global'
  ));
  achievementManager.register(new Achievement(
    'ACH-LIMBO-READ', 'O Ponto Zero', 'Agora você não pode mais fechar os olhos.', icon('ACH-LIMBO-READ'), '???',
    new ManualRule(), 'Ler todas as threads do arquivo do BBS Limbo_01.', 'lore', 'legendary', true, GLOBAL, 'global'
  ));

  // --- Mecânica / easter eggs (Walkman) ---
  achievementManager.register(new Achievement(
    'ACH-MECH-SCREW', 'Mecânico', 'Curiosidade desmontada.', icon('ACH-MECH-SCREW'), '???',
    new MechanicsRule('screwClicks', 15), 'Clicar nos parafusos do deck (mín. 15).', 'mechanics', 'common', true, WALKMAN_LR, CAM_LR
  ));
  achievementManager.register(new Achievement(
    'ACH-MECH-MARRETA', 'Eu vou pegar a minha marreeeeeta', 'Como os botões podem ser fidget toys.', icon('ACH-MECH-MARRETA'), '???',
    new MechanicsRule('fidgetClicks', 500), 'Acumular 500 cliques em botões, scroll e parafusos.', 'mechanics', 'legendary', true, WALKMAN_LR, CAM_LR
  ));
  achievementManager.register(new Achievement(
    'ACH-MECH-INDECISIVE', 'Indeciso', 'A ilusão da escolha.', icon('ACH-MECH-INDECISIVE'), '???',
    new MechanicsRule('ejectWithoutPlay', 10), 'Ejetar a fita 10 vezes sem dar play.', 'mechanics', 'rare', true, WALKMAN_LR, CAM_LR
  ));
  achievementManager.register(new Achievement(
    'ACH-VOL-MAX', 'Tímpanos de Aço', 'Gritos abafados pelo ruído.', icon('ACH-VOL-MAX'), '???',
    new MechanicsRule('maxVolumeTime', 300), 'Manter volume em 100% por 5 minutos cumulativos.', 'mechanics', 'rare', true, WALKMAN_LR, CAM_LR
  ));
  achievementManager.register(new Achievement(
    'ACH-VOL-ZERO', 'Silêncio Tático', 'Apenas o silêncio.', icon('ACH-VOL-ZERO'), '???',
    new MechanicsRule('zeroVolumeTime', 180), 'Manter volume em 0 com áudio tocando por 3 minutos.', 'mechanics', 'rare', true, WALKMAN_LR, CAM_LR
  ));
  achievementManager.register(new Achievement(
    'ACH-MODE-FIDGET', 'Sinal Confuso', 'O display não sabe o que mostrar.', icon('ACH-MODE-FIDGET'), '???',
    new MechanicsRule('modeSwitches', 25), 'Alternar o modo de display do walkman 25 vezes.', 'mechanics', 'common', true, WALKMAN_LR, CAM_LR
  ));

  // --- Honra ---
  achievementManager.register(new Achievement(
    'ACH-VETERAN', 'Veterano da Agência', 'Uma honra concedida apenas pelo Alto Escalão.', icon('ACH-VETERAN'), '???',
    new ManualRule(), 'Outorgada manualmente pelo administrador.', 'honor', 'legendary', true, GLOBAL, 'global'
  ));

  // --- Lore narrativa T1 — LAST REWIND (Walkman) — outorga GM ---
  achievementManager.register(new Achievement(
    'ACH-LR-WAKES', 'Velório sob Chuva', 'A cidade ainda não sabe o que perdeu.', icon('ACH-LR-WAKES'), '???',
    new ManualRule(),
    'Outorgar após Cap. 1 (velório / igreja).',
    'lore', 'common', true, WALKMAN_LR, CAM_LR
  ));
  achievementManager.register(new Achievement(
    'ACH-LR-DEMO', 'Demo Urgente', 'Uma fita que não deveria existir.', icon('ACH-LR-DEMO'), '???',
    new ManualRule(),
    'Outorgar após a banda ouvir a fita DEMO na garagem (Ato 1 Cap 2).',
    'lore', 'common', true, WALKMAN_LR, CAM_LR
  ));
  achievementManager.register(new Achievement(
    'ACH-LR-CLOCK', 'Contra o Relógio', 'Trinta minutos. Nem um a mais.', icon('ACH-LR-CLOCK'), '???',
    new ManualRule(),
    'Outorgar após investigação do quarto (sem nomear Ponto Zero na UI do jogador).',
    'exploration', 'rare', true, WALKMAN_LR, CAM_LR
  ));
  achievementManager.register(new Achievement(
    'ACH-LR-BENCH', 'Bancada Quente', 'Solda, cheiro de estanho, circuito aberto.', icon('ACH-LR-BENCH'), '???',
    new ManualRule(),
    'Outorgar após Circuitos da Emy / Walkman na mesa.',
    'exploration', 'rare', true, WALKMAN_LR, CAM_LR
  ));
  achievementManager.register(new Achievement(
    'ACH-LR-CAB', 'Zero no Painel', 'O contador parou onde não deveria.', icon('ACH-LR-CAB'), '???',
    new ManualRule(),
    'Outorgar após Crazy Zone (arcade travado). Ícone genérico — sem Crazy Taxi.',
    'exploration', 'rare', true, WALKMAN_LR, CAM_LR
  ));
  achievementManager.register(new Achievement(
    'ACH-LR-STAGE', 'Palco Escolhido', 'Barricada, cabo e volume.', icon('ACH-LR-STAGE'), '???',
    new ManualRule(),
    'Outorgar após preparativos do Ato 3 (sem spoiler de combate/resgate).',
    'lore', 'rare', true, WALKMAN_LR, CAM_LR
  ));

  // --- Lore narrativa T2 — SIDE B (Nokia) ---
  achievementManager.register(new Achievement(
    'ACH-SB-SIGNAL', 'Inbox Fantasma', 'O aparelho vibra com o que a cidade não admite.', icon('ACH-SB-SIGNAL'), '???',
    new ManualRule(),
    'Auto: primeira leitura de SMS no companion Nokia. Fallback: outorgar na mesa.',
    'lore', 'common', true, NOKIA_SB, CAM_SB
  ));
  achievementManager.register(new Achievement(
    'ACH-SB-SHARED', 'Mesma Frequência', 'Todos acordaram com o mesmo ruído.', icon('ACH-SB-SHARED'), '???',
    new ManualRule(),
    'Outorgar após cena do pesadelo compartilhado (sem 03:33 legível no ícone).',
    'lore', 'rare', true, NOKIA_SB, CAM_SB
  ));
  achievementManager.register(new Achievement(
    'ACH-SB-KNOCK', 'Batida na Porta', 'Papelada à meia-noite.', icon('ACH-SB-KNOCK'), '???',
    new ManualRule(),
    'Outorgar após batida policial.',
    'lore', 'rare', true, NOKIA_SB, CAM_SB
  ));
  achievementManager.register(new Achievement(
    'ACH-SB-PAGER', 'Bipe Fora de Época', 'Um sinal que não deveria existir em 2003.', icon('ACH-SB-PAGER'), '???',
    new ManualRule(),
    'Manual até existir QR/pager no Firestore. Outorgar ao escanear o pager prop do guia LimboOS.',
    'exploration', 'rare', true, NOKIA_SB, CAM_SB
  ));
};

registerAchievements();

export interface AchievableProfile {
  unlockedIntelIds: string[];
  achievementIds: string[];
  stats: PlayerStats;
}

export const ALL_ACHIEVEMENTS = achievementManager.getAll();

export function checkNewAchievements(
  profile: AchievableProfile,
  unlockedIntel: IntelItem[],
  rapidScanCount: number = 0,
  campaignId: string = 'unscoped',
  platform: PlayerPlatform = 'walkman'
) {
  const context: EvaluationContext = {
    profile,
    unlockedIntel,
    rapidScanCount,
    campaignId,
    platform,
  };
  return achievementManager.evaluateNewAchievements(context);
}
