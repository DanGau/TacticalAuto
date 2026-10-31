// What relics and doctrines share: lasting effects, and gear rarity.
import type { Stats } from './battle'

/** Effects that last for the run, applied once per copy held. */
export interface Lasting {
  /** Added to every soldier's stats. */
  stats?: Partial<Stats>
}

export type Rarity = 'common' | 'rare' | 'epic'

/** Chance each piece of gear found is of a rarity. */
export const RARITY_CHANCE: Record<Rarity, number> = { common: 0.75, rare: 0.2, epic: 0.05 }
