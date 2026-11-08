import type { PlayerStats } from '../types/player';
import type { IntelItem } from '../types/intel';
import type { AchievementDef } from '../types/achievement';
import {
  achievementManager,
  type EvaluationContext,
  type PlayerPlatform,
} from '../services/AchievementManager';

/**
 * Pack de sugestões importável por qualquer mestre: só as conquistas genéricas dos
 * mini-apps e da plataforma. As conquistas das campanhas Last Rewind saíram do
 * bundle e ficam em backend/scripts/legacy-seed/achievements.json (migração).
 * O catálogo em uso é sempre o da pasta ativa (AchievementCatalogService).
 */
export const SUGGESTED_ACHIEVEMENTS: AchievementDef[] = [
  {
    "hint": "???",
    "isSecret": true,
    "enabled": true,
    "source": "suggestion",
    "id": "ACH-BIOS-BOOT",
    "title": "POST Completo",
    "description": "O firmware ainda responde.",
    "iconUrl": "/achievements/ACH-BIOS-BOOT.png",
    "rule": {
      "type": "flag",
      "statKey": "biosOpened"
    },
    "unlockCondition": "Abrir o terminal BIOS pela primeira vez.",
    "category": "exploration",
    "tier": "common",
    "platforms": [
      "global"
    ],
    "campaignIds": "global"
  },
  {
    "hint": "???",
    "isSecret": true,
    "enabled": true,
    "source": "suggestion",
    "id": "ACH-WIN95-BOOT",
    "title": "Plug and Play",
    "description": "Bem-vindo a 1995.",
    "iconUrl": "/achievements/ACH-WIN95-BOOT.png",
    "rule": {
      "type": "flag",
      "statKey": "win95Opened"
    },
    "unlockCondition": "Inicializar o Windows 95 pelo terminal.",
    "category": "exploration",
    "tier": "common",
    "platforms": [
      "global"
    ],
    "campaignIds": "global"
  },
  {
    "hint": "???",
    "isSecret": true,
    "enabled": true,
    "source": "suggestion",
    "id": "ACH-OS-TRIPLE",
    "title": "Trindade de Interfaces",
    "description": "CLI, GUI e o que veio antes.",
    "iconUrl": "/achievements/ACH-OS-TRIPLE.png",
    "rule": {
      "type": "allFlags",
      "statKeys": [
        "biosOpened",
        "win95Opened",
        "macosOpened"
      ]
    },
    "unlockCondition": "Visitar BIOS, Windows 95 e Mac OS pelo menos uma vez.",
    "category": "exploration",
    "tier": "rare",
    "platforms": [
      "global"
    ],
    "campaignIds": "global"
  },
  {
    "hint": "???",
    "isSecret": true,
    "enabled": true,
    "source": "suggestion",
    "id": "ACH-REPAIR-APP",
    "title": "Engenheiro de Software",
    "description": "Interfaces visuais em um mundo CLI.",
    "iconUrl": "/achievements/ACH-REPAIR-APP.png",
    "rule": {
      "type": "manual"
    },
    "unlockCondition": "Iniciar o aplicativo de reparo de discos.",
    "category": "exploration",
    "tier": "common",
    "platforms": [
      "global"
    ],
    "campaignIds": "global"
  },
  {
    "hint": "???",
    "isSecret": true,
    "enabled": true,
    "source": "suggestion",
    "id": "ACH-REPAIR-FAIL",
    "title": "Setor Defeituoso",
    "description": "A agulha não consegue ler o caos de primeira.",
    "iconUrl": "/achievements/ACH-REPAIR-FAIL.png",
    "rule": {
      "type": "manual"
    },
    "unlockCondition": "Diagnosticar o disquete corrompido.",
    "category": "exploration",
    "tier": "rare",
    "platforms": [
      "global"
    ],
    "campaignIds": "global"
  },
  {
    "hint": "???",
    "isSecret": true,
    "enabled": true,
    "source": "suggestion",
    "id": "ACH-REPAIR-SUCCESS",
    "title": "A Verdade no Zero",
    "description": "O conteúdo da fenda foi restaurado.",
    "iconUrl": "/achievements/ACH-REPAIR-SUCCESS.png",
    "rule": {
      "type": "manual"
    },
    "unlockCondition": "Reparar o disquete e ler a mensagem oculta.",
    "category": "exploration",
    "tier": "legendary",
    "platforms": [
      "global"
    ],
    "campaignIds": "global"
  },
  {
    "hint": "???",
    "isSecret": true,
    "enabled": true,
    "source": "suggestion",
    "id": "ACH-SECRET",
    "title": "Você Não Deveria Estar Aqui",
    "description": "Algumas coisas devem permanecer ocultas.",
    "iconUrl": "/achievements/ACH-SECRET.png",
    "rule": {
      "type": "secretTape"
    },
    "unlockCondition": "Desbloquear qualquer intel marcado como secreto.",
    "category": "lore",
    "tier": "rare",
    "platforms": [
      "global"
    ],
    "campaignIds": "global"
  },
  {
    "hint": "???",
    "isSecret": true,
    "enabled": true,
    "source": "suggestion",
    "id": "ACH-LORE-ANALOG",
    "title": "Viajante Analógico",
    "description": "A entidade na fita magnetizada.",
    "iconUrl": "/achievements/ACH-LORE-ANALOG.png",
    "rule": {
      "type": "loreKeyword",
      "keyword": "analog_traveler"
    },
    "unlockCondition": "Desbloquear uma fita do artista Analog_Traveler.",
    "category": "lore",
    "tier": "rare",
    "platforms": [
      "global"
    ],
    "campaignIds": "global"
  },
  {
    "hint": "???",
    "isSecret": true,
    "enabled": true,
    "source": "suggestion",
    "id": "ACH-LIMBO-FOUND",
    "title": "Despertar",
    "description": "Onde nós realmente estamos?",
    "iconUrl": "/achievements/ACH-LIMBO-FOUND.png",
    "rule": {
      "type": "manual"
    },
    "unlockCondition": "Acessar o BBS secreto Limbo_01.",
    "category": "lore",
    "tier": "rare",
    "platforms": [
      "global"
    ],
    "campaignIds": "global"
  },
  {
    "hint": "???",
    "isSecret": true,
    "enabled": true,
    "source": "suggestion",
    "id": "ACH-LIMBO-READ",
    "title": "O Ponto Zero",
    "description": "Agora você não pode mais fechar os olhos.",
    "iconUrl": "/achievements/ACH-LIMBO-READ.png",
    "rule": {
      "type": "manual"
    },
    "unlockCondition": "Ler todas as threads do arquivo do BBS Limbo_01.",
    "category": "lore",
    "tier": "legendary",
    "platforms": [
      "global"
    ],
    "campaignIds": "global"
  },
  {
    "hint": "???",
    "isSecret": true,
    "enabled": true,
    "source": "suggestion",
    "id": "ACH-VETERAN",
    "title": "Veterano da Agência",
    "description": "Uma honra concedida apenas pelo Alto Escalão.",
    "iconUrl": "/achievements/ACH-VETERAN.png",
    "rule": {
      "type": "manual"
    },
    "unlockCondition": "Outorgada manualmente pelo administrador.",
    "category": "honor",
    "tier": "legendary",
    "platforms": [
      "global"
    ],
    "campaignIds": "global"
  }
];

export interface AchievableProfile {
  unlockedIntelIds: string[];
  achievementIds: string[];
  stats: PlayerStats;
}

/** Snapshot vivo do manager (preferir useAchievementCatalog na UI). */
export function getAllAchievements() {
  return achievementManager.getAll();
}

export function checkNewAchievements(
  profile: AchievableProfile,
  unlockedIntel: IntelItem[],
  rapidScanCount: number = 0,
  campaignId: string = 'unscoped',
  platform: PlayerPlatform = 'walkman',
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
