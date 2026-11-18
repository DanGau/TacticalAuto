// Bonus attacks: the second blow of a hero's turn, an at-will power set by its class.
import type { Power } from './powers'
import { BURN_STACKS } from './battle'

/** Tiles Kinetic Blast knocks its target back. */
export const KNOCK_TILES = 2

/** Damage a frag grenade does to each alien beside its target. */
export const FRAG_SPLASH = 1

/** A secondary's reach, damage against its wielder's weapon, and what a hit also does. */
export interface Secondary {
  name: string
  range: number
  damage: number
  effect?: 'splash' | 'knock' | 'mark' | 'suppress' | 'burn' | 'root' | 'pierce'
  text?: string
}

const secondaries = {
  sidearm: { name: 'Sidearm', range: 5, damage: 0 },
  frag: { name: 'Force Burst', range: 6, damage: -1, effect: 'splash', text: `Deal ${FRAG_SPLASH} damage to aliens adjacent to the target. Displace them 1 tile away.` },
  slug: { name: 'Kinetic Blast', range: 5, damage: 0, effect: 'knock', text: `Knockback ${KNOCK_TILES}.` },
  pistol: { name: 'Trick Shot', range: 10, damage: 0 },
  flare: { name: 'Guiding Bolt', range: 5, damage: -1, effect: 'mark', text: 'Apply 1 Mark.' },
  shockCoil: { name: 'Shock Coil', range: 5, damage: 0, effect: 'suppress', text: 'Apply Weak.' },
  flameBurst: { name: 'Fire Bolt', range: 4, damage: -1, effect: 'burn', text: `Apply ${BURN_STACKS} Burn.` },
  iceShard: { name: 'Ray of Frost', range: 7, damage: -1, effect: 'root', text: 'Root.' },
  knives: { name: 'Spectral Blades', range: 4, damage: 1, effect: 'pierce', text: 'Ignore Armor.' },
} satisfies Record<string, Secondary>

export type SecondaryId = keyof typeof secondaries
export const SECONDARIES: Record<SecondaryId, Secondary> = secondaries

/** A bonus attack as a power. */
export function secondaryPower(s: Secondary): Power {
  const damage = s.damage === 0 ? 'Deal full damage.' : s.damage > 0 ? `Deal ${s.damage} more damage.` : `Deal ${-s.damage} less damage.`
  return { name: s.name, use: 'At will', range: `${s.range}`, target: 'An alien', text: s.text ? `${damage} ${s.text}` : damage }
}
