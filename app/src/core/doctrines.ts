// Doctrines: run-long changes to how battles work.
import type { Lasting } from './base'
import type { Stance, Stats } from './battle'

/** A change to how battles work, which the battle checks where it applies. */
export type Rule = 'fortified'

/** A way of attacking a weapon doctrine gives every hero; combat applies it. */
export type DoctrineEffect = 'parry' | 'psionic' | 'demolish' | 'twin'

/**
 * A way of fighting the squad adopts at an event and keeps for the run. Each helps and hurts; `text` says how.
 * Some change soldiers' stats, some how the squad grows, some how battles work.
 */
export interface Doctrine extends Lasting {
  name: string
  text: string
  rule?: Rule
  /** Whether winning a key no longer brings a hero. */
  noRecruits?: boolean
  /** Whether a new soldier takes a class no squadmate has, while one is left. */
  uniqueClasses?: boolean
  /** Whether it is how the squad fights. The squad fights one way: adopting one sets aside the last. */
  weapon?: boolean
  /** Stats every hero has in place of its own, after everything else is counted. */
  set?: Partial<Stats>
  /** How every hero positions, in place of its class's way. */
  stance?: Stance
  effect?: DoctrineEffect
}

/** Damage a parrying soldier takes off a shot from beyond arm's reach. */
export const PARRY_SOAK = 1

/** Damage every hit loses under the fortified rule. */
export const FORTIFIED_SOAK = 1

const doctrines = {
  massCloning: { name: 'Mass Cloning', text: 'Every hero has 2 less health', stats: { hp: -2 } },
  loneWolf: { name: 'Lone Wolf', text: 'Every hero has +40 health, +4 armor, +5 damage, +25% crit and +2 move; no new soldier ever joins', stats: { hp: 40, armor: 4, damage: 5, crit: 0.25, move: 2 }, noRecruits: true },
  specialists: { name: 'Specialist Doctrine', text: 'No two soldiers share a class while a class is left unused', uniqueClasses: true },
  exosuits: { name: 'Exosuits', text: 'Every hero has +3 armor and 1 less move', stats: { armor: 3, move: -1 } },
  fortified: { name: 'Fortification Doctrine', text: 'Every hit, on either side, does 1 less damage, down to 1', rule: 'fortified' },
  scatterguns: { name: 'Scatterguns', text: 'Every hero has +2 damage and 2 less range', stats: { damage: 2, range: -2 }, weapon: true },
  blades: {
    name: 'Blademasters',
    text: "Every hero fights with a blade: range 1, +3 damage and +2 move, and charges in. A shot from beyond arm's reach does a hero 1 less damage",
    stats: { damage: 3, move: 2 },
    set: { range: 1 },
    stance: 'rush',
    effect: 'parry',
    weapon: true,
  },
  psionics: {
    name: 'Psi Operatives',
    text: 'Every hero attacks with the mind: range 6 and 1 less damage, but attacks pass through walls and ignore armor, at any alien whose pod is revealed',
    stats: { damage: -1 },
    set: { range: 6 },
    effect: 'psionic',
    weapon: true,
  },
  demolitions: {
    name: 'Demolitions',
    text: 'Every hero has +1 damage and 1 less range, and each hit blows apart the objects around its target',
    stats: { damage: 1, range: -1 },
    effect: 'demolish',
    weapon: true,
  },
  gunslingers: { name: 'Gunslingers', text: 'Every hero has 1 less damage and 2 less range, but fires its weapon a third time each turn', stats: { damage: -1, range: -2 }, effect: 'twin', weapon: true },
} satisfies Record<string, Doctrine>

export type DoctrineId = keyof typeof doctrines
export const DOCTRINES: Record<DoctrineId, Doctrine> = doctrines
