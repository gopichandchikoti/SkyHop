export type SkinId = 'coral' | 'azure' | 'mint' | 'gold';

export interface SkinDef {
  id: SkinId;
  name: string;
  /** Campaign level that must be completed to unlock it (0 = always available). */
  unlockLevel: number;
}

export const SKINS: readonly SkinDef[] = [
  { id: 'coral', name: 'Coral', unlockLevel: 0 },
  { id: 'azure', name: 'Azure', unlockLevel: 3 },
  { id: 'mint', name: 'Mint', unlockLevel: 6 },
  { id: 'gold', name: 'Sunrise Gold', unlockLevel: 10 },
];

export const DEFAULT_SKIN: SkinId = 'coral';

export function isSkinId(value: unknown): value is SkinId {
  return SKINS.some((skin) => skin.id === value);
}

export function isSkinUnlocked(id: SkinId, completed: readonly number[]): boolean {
  const skin = SKINS.find((candidate) => candidate.id === id);
  if (!skin) return false;
  return skin.unlockLevel === 0 || completed.includes(skin.unlockLevel);
}
