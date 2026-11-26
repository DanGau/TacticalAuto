// Weapons: their stats and how each wielder stands. Each weapon's Strike is in cards.ts.
import type { Stance, Stats } from './battle'

/** What a hero fights with, whatever its class: stat changes, whether it reaches only the next tile, and maybe a way its wielder positions. */
export interface Weapon {
  name: string
  stats: Partial<Stats>
  melee?: true
  /** How its wielder positions, in place of its class's way. */
  stance?: Stance
}

const weapons = {
  rifle: { name: 'Rifle', stats: {} },
  sniper: { name: 'Sniper Rifle', stats: { range: 3, crit: 0.1, move: -1 }, stance: 'standoff' },
  shotgun: { name: 'Shotgun', stats: { range: -1 }, stance: 'rush' },
  smg: { name: 'SMG', stats: { range: -1, move: 1 } },
  lmg: { name: 'Machine Gun', stats: { range: 1, move: -1 } },
  pistols: { name: 'Twin Pistols', stats: { move: 1 } },
  hammer: { name: 'Hammer', stats: { move: 2, strength: 2 }, melee: true, stance: 'rush' },
  sword: { name: 'Sword', stats: { crit: 0.1, move: 2 }, melee: true, stance: 'rush' },
  shield: { name: 'Shield', stats: { armor: 2, move: 1 }, melee: true, stance: 'rush' },
  fists: { name: 'Fists', stats: { move: 2, strength: 2 }, melee: true, stance: 'rush' },
} satisfies Record<string, Weapon>

export type WeaponId = keyof typeof weapons
export const WEAPONS: Record<WeaponId, Weapon> = weapons

/** The range a melee weapon reaches. */
export const MELEE_RANGE = 1
