import { useEffect, useState } from 'react';
import type { AchievementDef } from '../types/achievement';
import { achievementCatalogService } from '../services/AchievementCatalogService';
import { achievementManager, type Achievement } from '../services/AchievementManager';

export function useAchievementCatalog() {
  const [defs, setDefs] = useState<AchievementDef[]>(() =>
    achievementCatalogService.getEffectiveDefs(),
  );
  const [achievements, setAchievements] = useState<Achievement[]>(() =>
    achievementManager.getAll(),
  );
  const [isRemote, setIsRemote] = useState(() => achievementCatalogService.isUsingRemote());

  useEffect(() => {
    const unsubDefs = achievementCatalogService.subscribe((next) => {
      setDefs(next);
      setIsRemote(achievementCatalogService.isUsingRemote());
    });
    const unsubMgr = achievementManager.subscribe(() => {
      setAchievements(achievementManager.getAll());
    });
    setAchievements(achievementManager.getAll());
    return () => {
      unsubDefs();
      unsubMgr();
    };
  }, []);

  return {
    defs,
    achievements,
    isRemote,
    catalogEmpty: !isRemote,
  };
}
