import type { WriteBatch } from 'firebase/firestore';

/** Catálogos que têm sugestões locais importáveis. */
export type CatalogKey = 'campaigns' | 'achievements' | 'npcSms';

/**
 * No modelo multi-tenant cada pasta começa vazia e o conteúdo é sempre do
 * Firestore da pasta: sugestões locais entram só por importação explícita.
 * O serviço continua existindo para os chamadores antigos e responde que todo
 * catálogo já pertence ao mestre (o seed nunca aparece sozinho).
 */
class CatalogStateService {
  private static instance: CatalogStateService;

  private constructor() {}

  public static getInstance(): CatalogStateService {
    if (!CatalogStateService.instance) {
      CatalogStateService.instance = new CatalogStateService();
    }
    return CatalogStateService.instance;
  }

  start(): () => void {
    return () => {};
  }

  isLoaded(): boolean {
    return true;
  }

  isInitialized(_key: CatalogKey): boolean {
    return true;
  }

  subscribe(listener: () => void): () => void {
    queueMicrotask(listener);
    return () => {};
  }

  markInBatch(_batch: WriteBatch, ..._keys: CatalogKey[]): void {}

  async markInitialized(..._keys: CatalogKey[]): Promise<void> {}
}

export const catalogStateService = CatalogStateService.getInstance();
