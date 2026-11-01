/**
 * Registro de rascunhos não salvos do admin. Navegar entre rotas não perde
 * rascunho (os destinos ficam montados); só recarregar, fechar a aba, sair
 * da conta ou abrir o modo jogador perdem, e esses pontos consultam aqui.
 */
const dirtyKeys = new Set<string>();

export function setUnsavedChanges(key: string, dirty: boolean): void {
  if (dirty) dirtyKeys.add(key);
  else dirtyKeys.delete(key);
}

export function hasUnsavedChanges(): boolean {
  return dirtyKeys.size > 0;
}

/** Depois que o usuário confirmou sair: evita o segundo aviso do `beforeunload`. */
export function clearUnsavedChanges(): void {
  dirtyKeys.clear();
}
