// Secondary attacks: the second blow of a hero's turn, set by its class.

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
  frag: { name: 'Frag Grenade', range: 6, damage: -1, effect: 'splash', text: `${FRAG_SPLASH} damage to each alien beside the target` },
  shieldThrow: { name: 'Shield Throw', range: 5, damage: 0, effect: 'knock', text: 'Knocks the target a tile back' },
  pistol: { name: 'Pistol', range: 10, damage: 0, text: 'A quick trick shot' },
  flare: { name: 'Flare', range: 5, damage: -1, effect: 'mark', text: 'Marks the target' },
  shockCoil: { name: 'Shock Coil', range: 5, damage: 0, effect: 'suppress', text: 'The target does 1 less damage on its next turn' },
  flameBurst: { name: 'Flame Burst', range: 4, damage: -1, effect: 'burn', text: 'Sets the target burning' },
  iceShard: { name: 'Ice Shard', range: 7, damage: -1, effect: 'root', text: 'Roots the target: it cannot move on its next turn' },
  knives: { name: 'Throwing Knives', range: 4, damage: 1, effect: 'pierce', text: 'Ignores armor' },
} satisfies Record<string, Secondary>

export type SecondaryId = keyof typeof secondaries
export const SECONDARIES: Record<SecondaryId, Secondary> = secondaries

/** A secondary told in full, for a card. */
export function secondaryText(s: Secondary): string {
  const damage = s.damage === 0 ? 'full damage' : s.damage > 0 ? `${s.damage} more damage` : `${-s.damage} less damage`
  return `Range ${s.range}, ${damage}. ${s.text}.`
}
