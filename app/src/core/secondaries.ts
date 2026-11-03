// Bonus attacks: the second blow of a hero's turn, an at-will power set by its class.
import type { Power } from './powers'

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
  text: string
}

const secondaries = {
  sidearm: { name: 'Sidearm', range: 5, damage: 0, text: 'A quick follow-up' },
  frag: { name: 'Force Burst', range: 6, damage: -1, effect: 'splash', text: `${FRAG_SPLASH} damage to each alien beside the target` },
  slug: { name: 'Kinetic Blast', range: 5, damage: 0, effect: 'knock', text: `Knocks the target ${KNOCK_TILES} tiles back` },
  pistol: { name: 'Trick Shot', range: 10, damage: 0, text: 'A quick follow-up' },
  flare: { name: 'Guiding Bolt', range: 5, damage: -1, effect: 'mark', text: 'Marks the target' },
  shockCoil: { name: 'Shock Coil', range: 5, damage: 0, effect: 'suppress', text: 'The target does 1 less damage on its next turn' },
  flameBurst: { name: 'Fire Bolt', range: 4, damage: -1, effect: 'burn', text: 'Sets the target burning' },
  iceShard: { name: 'Ray of Frost', range: 7, damage: -1, effect: 'root', text: 'Roots the target: it cannot move on its next turn' },
  knives: { name: 'Spectral Blades', range: 4, damage: 1, effect: 'pierce', text: 'Ignores armor' },
} satisfies Record<string, Secondary>

export type SecondaryId = keyof typeof secondaries
export const SECONDARIES: Record<SecondaryId, Secondary> = secondaries

/** A bonus attack as a power. */
export function secondaryPower(s: Secondary): Power {
  const damage = s.damage === 0 ? 'Full damage' : s.damage > 0 ? `${s.damage} more damage` : `${-s.damage} less damage`
  return { name: s.name, use: 'At will', range: `${s.range}`, target: 'One alien', text: `${damage}. ${s.text}` }
}
