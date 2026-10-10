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

/** Aid offered after a won battle. It applies once, when taken. */
export interface Aid {
  name: string
  rarity: Rarity
  text: string
  supplies?: number
  /** Added to the threat. */
  threat?: number
  /** Experience added to every soldier. */
  xp?: number
  /** Levels the lowest-level soldier gains. */
  promote?: number
}

const aid = {
  drop: { name: 'Supply Drop', rarity: 'common', text: '+3 supplies', supplies: 3 },
  training: { name: 'Field Training', rarity: 'common', text: '+1 experience for every soldier', xp: 1 },
  convoy: { name: 'Supply Convoy', rarity: 'rare', text: '+6 supplies', supplies: 6 },
  veteran: { name: 'Combat Imprint', rarity: 'rare', text: 'Your lowest-level soldier gains a level', promote: 1 },
  jammer: { name: 'Signal Jammer', rarity: 'rare', text: '-2 threat', threat: -2 },
  cache: { name: 'Hidden Cache', rarity: 'epic', text: '+10 supplies', supplies: 10 },
  purge: { name: 'Orbital Strike', rarity: 'epic', text: 'The threat is emptied', threat: -99 },
} satisfies Record<string, Aid>

export type AidId = keyof typeof aid
export const AID: Record<AidId, Aid> = aid

/** Chance each offered aid is of a rarity. */
export const RARITY_CHANCE: Record<Rarity, number> = { common: 0.6, rare: 0.3, epic: 0.1 }
