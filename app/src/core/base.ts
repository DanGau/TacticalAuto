import type { Stats } from './battle'

/** Effects that last for the run, applied once per copy held. */
export interface Lasting {
  /** Added to every soldier's stats. */
  stats?: Partial<Stats>
  /** Levels a new clone arrives above the squad's lowest. */
  recruitRank?: number
}

/** A facility the player builds with supplies. Each level costs `cost` times the level reached. */
export interface Facility extends Lasting {
  name: string
  text: string
  cost: number
  /** Levels it can reach. */
  max: number
}

const facilities = {
  firingRange: { name: 'Firing Range', text: '+5% aim', cost: 2, max: 3, stats: { aim: 0.05 } },
  workshop: { name: 'Armor Workshop', text: '+2 health', cost: 2, max: 3, stats: { hp: 2 } },
  drills: { name: 'Flanking Drills', text: '+15% crit on flanked targets', cost: 2, max: 3, stats: { crit: 0.15 } },
  course: { name: 'Obstacle Course', text: '+1 move', cost: 3, max: 2, stats: { move: 1 } },
  academy: { name: 'Officer Academy', text: 'A new clone arrives one level higher', cost: 3, max: 2, recruitRank: 1 },
  optics: { name: 'Optics Lab', text: '+1 range', cost: 4, max: 2, stats: { range: 1 } },
} satisfies Record<string, Facility>

export type FacilityId = keyof typeof facilities
export const FACILITIES: Record<FacilityId, Facility> = facilities

export type Rarity = 'common' | 'rare' | 'epic'

/** Chance each piece of gear found is of a rarity. */
export const RARITY_CHANCE: Record<Rarity, number> = { common: 0.75, rare: 0.2, epic: 0.05 }
