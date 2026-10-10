import type { RelicEffect, Stats } from './battle'

/**
 * An artifact the squad keeps for the run, taken from three offered after a satellite or a last stand is won.
 * It changes every soldier, or how the run pays; `text` says how.
 */
export interface Relic {
  name: string
  text: string
  /** Added to every soldier's stats. */
  stats?: Partial<Stats>
  /** Given to every soldier. */
  effect?: RelicEffect
  /** Added to the uses of every class ability that has uses. */
  charges?: number
  /** Added to the supplies each won battle pays. */
  supplies?: number
  /** Whether every piece of gear found is rare or better. */
  rareGear?: boolean
}

const relics = {
  plasma: { name: 'Plasma Rifles', text: 'Every soldier does +1 damage', stats: { damage: 1 } },
  alloys: { name: 'Alien Alloys', text: 'Every soldier has +3 armor', stats: { armor: 3 } },
  servos: { name: 'Overclocked Servos', text: 'Every soldier has +1 move', stats: { move: 1 } },
  lens: { name: 'Focusing Lens', text: 'Every soldier has +1 range and +10% crit', stats: { range: 1, crit: 0.1 } },
  glassCannon: { name: 'Glass Cannon Protocol', text: 'Every soldier does +2 damage and has 3 less health', stats: { damage: 2, hp: -3 } },
  capacitor: { name: 'Kinetic Capacitor', text: "Each soldier's first hit of a battle is a crit", effect: 'opener' },
  plating: { name: 'Adaptive Plating', text: 'Each soldier regrows 1 armor at the start of its turn', effect: 'rearm' },
  nanites: { name: 'Hunger Nanites', text: 'A soldier who kills heals 2', effect: 'feast' },
  phoenix: { name: 'Phoenix Protocol', text: 'Once per battle, the first soldier to fall gets up with 5 health', effect: 'phoenix' },
  echo: { name: 'Echo Chamber', text: 'Every class ability with limited uses has one more', charges: 1 },
  drones: { name: 'Scavenger Drones', text: 'Each won battle pays 1 more supply', supplies: 1 },
  contact: { name: 'Black Market Contact', text: 'Every piece of gear found is rare or better', rareGear: true },
} satisfies Record<string, Relic>

export type RelicId = keyof typeof relics
export const RELICS: Record<RelicId, Relic> = relics

/** Relics offered at a time. */
export const RELIC_OFFERS = 3
