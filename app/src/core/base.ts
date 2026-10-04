import type { Stats } from './battle'

/** Effects that last for the run, applied once per copy held. */
export interface Lasting {
  /** Added to every soldier's stats. */
  stats?: Partial<Stats>
  /** Added to the squad size. */
  squad?: number
  /** Ranks a recruit arrives with. */
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
  firingRange: { name: 'Firing Range', text: '+5% aim', cost: 2, max: 4, stats: { aim: 0.05 } },
  workshop: { name: 'Armor Workshop', text: '+2 health', cost: 2, max: 4, stats: { hp: 2 } },
  drills: { name: 'Flanking Drills', text: '+15% crit on flanked targets', cost: 2, max: 3, stats: { crit: 0.15 } },
  course: { name: 'Obstacle Course', text: '+1 move', cost: 3, max: 2, stats: { move: 1 } },
  academy: { name: 'Officer Academy', text: 'Recruits arrive one rank higher', cost: 3, max: 3, recruitRank: 1 },
  optics: { name: 'Optics Lab', text: '+1 range', cost: 4, max: 2, stats: { range: 1 } },
  barracks: { name: 'Barracks', text: '+1 soldier in the squad', cost: 5, max: 2, squad: 1 },
} satisfies Record<string, Facility>

export type FacilityId = keyof typeof facilities
export const FACILITIES: Record<FacilityId, Facility> = facilities

export type Rarity = 'common' | 'rare' | 'epic'

/** Aid a defended region offers. Beyond its lasting effects, the rest apply once, when taken. */
export interface Aid extends Lasting {
  name: string
  rarity: Rarity
  text: string
  supplies?: number
  /** Added to every region's threat. */
  threat?: number
  /** Experience added to every soldier. */
  xp?: number
  /** Rank the lowest-ranked soldier is raised to. */
  promote?: number
}

const aid = {
  drop: { name: 'Supply Drop', rarity: 'common', text: '+3 supplies', supplies: 3 },
  training: { name: 'Field Training', rarity: 'common', text: '+1 experience for every soldier', xp: 1 },
  convoy: { name: 'Supply Convoy', rarity: 'rare', text: '+6 supplies', supplies: 6 },
  veteran: { name: 'Veteran Transfer', rarity: 'rare', text: 'Your lowest-ranked soldier becomes a Sergeant', promote: 3 },
  satellite: { name: 'Satellite Uplink', rarity: 'rare', text: '-1 threat in every region', threat: -1 },
  plasma: { name: 'Plasma Rifles', rarity: 'epic', text: '+1 damage, for the run', stats: { damage: 1 } },
  alloys: { name: 'Alien Alloys', rarity: 'epic', text: '+4 health, for the run', stats: { hp: 4 } },
} satisfies Record<string, Aid>

export type AidId = keyof typeof aid
export const AID: Record<AidId, Aid> = aid

/** Chance each offered aid is of a rarity. */
export const RARITY_CHANCE: Record<Rarity, number> = { common: 0.6, rare: 0.3, epic: 0.1 }
