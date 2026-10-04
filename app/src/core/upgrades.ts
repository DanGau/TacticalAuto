import type { Stats } from './battle'

export type Rarity = 'common' | 'rare' | 'epic'

/** A base upgrade. Its effects apply once per copy the run holds. */
export interface Upgrade {
  name: string
  rarity: Rarity
  text: string
  /** Added to every soldier's stats. */
  stats?: Partial<Stats>
  /** Added to the squad size. */
  squad?: number
  /** Ranks a recruit arrives with. */
  recruitRank?: number
  /** Added to every region's threat when taken. */
  threat?: number
  /** Copies a run may hold; unlimited when absent. */
  max?: number
}

export const UPGRADES = {
  firingRange: { name: 'Firing Range', rarity: 'common', text: '+5% aim', stats: { aim: 0.05 } },
  workshop: { name: 'Armor Workshop', rarity: 'common', text: '+2 health', stats: { hp: 2 } },
  course: { name: 'Obstacle Course', rarity: 'common', text: '+1 move', stats: { move: 1 }, max: 2 },
  drills: { name: 'Flanking Drills', rarity: 'common', text: '+15% crit on flanked targets', stats: { crit: 0.15 }, max: 3 },
  barracks: { name: 'Barracks', rarity: 'rare', text: '+1 soldier in the squad', squad: 1, max: 2 },
  optics: { name: 'Optics Lab', rarity: 'rare', text: '+1 range', stats: { range: 1 }, max: 2 },
  academy: { name: 'Officer Academy', rarity: 'rare', text: 'Recruits arrive one rank higher', recruitRank: 1, max: 3 },
  satellite: { name: 'Satellite Uplink', rarity: 'rare', text: '-1 threat in every region, now', threat: -1 },
  foundry: { name: 'Weapons Foundry', rarity: 'epic', text: '+1 damage', stats: { damage: 1 } },
  alloys: { name: 'Alien Alloys', rarity: 'epic', text: '+4 health', stats: { hp: 4 } },
} satisfies Record<string, Upgrade>

export type UpgradeId = keyof typeof UPGRADES

/** Chance each offered card is of a rarity. */
export const RARITY_CHANCE: Record<Rarity, number> = { common: 0.6, rare: 0.3, epic: 0.1 }
