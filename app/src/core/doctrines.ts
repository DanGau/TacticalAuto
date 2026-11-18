// Doctrines: run-long changes to how battles work.
import type { Lasting } from './base'
import type { Effect, Stance, Stats } from './battle'
import type { WeaponId } from './weapons'

/** A change to how battles work, which the battle checks where it applies. */
export type Rule = 'fortified' | 'reckoning'

/** A way of attacking a weapon doctrine gives the hero; combat applies it. */
export type DoctrineEffect = 'parry' | 'psionic' | 'demolish' | 'twin'

/**
 * A way of fighting the hero adopts at an event and keeps for the run. Each helps and hurts; `text` says how.
 * Some change the hero's stats, some how battles work.
 */
export interface Doctrine extends Lasting {
  name: string
  text: string
  rule?: Rule
  /** Whether it is how the hero fights. The hero fights one way: adopting one sets aside the last. */
  weapon?: boolean
  /** Stats the hero has in place of its own, after everything else is counted. */
  set?: Partial<Stats>
  /** How the hero positions, in place of its class's way. */
  stance?: Stance
  effect?: DoctrineEffect
  /** What the hero fights with, in place of its own weapon. */
  fights?: WeaponId
}

/** Damage a parrying hero takes off a shot from beyond arm's reach. */
export const PARRY_SOAK = 1

/** Kills the hero makes under Executioner's Oath for each Might it gives, and what a kill no longer pays a hero under it. */
export const RECKONING_KILLS = 3
export const KILL_REWARDS: Effect[] = ['feast', 'momentum', 'bloodRite', 'bloodbath', 'frenzy', 'chain', 'afterimage', 'firestorm']

/** Damage every hit loses under the fortified rule. */
export const FORTIFIED_SOAK = 1

const doctrines = {
  exosuits: { name: 'Power Armor', text: '3 more Armor. 1 less move.', stats: { armor: 3, move: -1 } },
  fortified: { name: 'Iron Skin', text: 'All hits deal 1 less damage, down to 1.', rule: 'fortified' },
  scatterguns: { name: 'Brawlers', text: 'Deal 2 more damage. 2 less range.', stats: { damage: 2, range: -2 }, weapon: true },
  blades: {
    name: 'Blademasters',
    text: `Fight with a sword: range 1, 2 more move, a dash to strike. Take ${PARRY_SOAK} less damage from ranged hits.`,
    stats: { move: 2 },
    set: { range: 1 },
    fights: 'sword',
    stance: 'rush',
    effect: 'parry',
    weapon: true,
  },
  psionics: {
    name: 'Psi Awakened',
    text: 'Attack revealed aliens at range 6, through walls. Ignore Armor. Deal 1 less damage.',
    stats: { damage: -1 },
    set: { range: 6 },
    effect: 'psionic',
    weapon: true,
  },
  demolitions: {
    name: 'Wreckers',
    text: 'Deal 1 more damage. 1 less range. Hits destroy objects around the target.',
    stats: { damage: 1, range: -1 },
    effect: 'demolish',
    weapon: true,
  },
  reckoning: {
    name: "Executioner's Oath",
    text: `Kills give no heal, Armor, Might, extra attack or XP. Every ${RECKONING_KILLS}rd kill each battle, gain 1 Might.`,
    rule: 'reckoning',
  },
  gunslingers: { name: 'Gunslingers', text: 'Deal 1 less damage. 2 less range. Attack 1 more time each turn.', stats: { damage: -1, range: -2 }, effect: 'twin', weapon: true },
} satisfies Record<string, Doctrine>

export type DoctrineId = keyof typeof doctrines
export const DOCTRINES: Record<DoctrineId, Doctrine> = doctrines
