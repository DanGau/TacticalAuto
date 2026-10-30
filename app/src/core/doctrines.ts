import type { Lasting } from './base'
import type { Stance, Stats } from './battle'

/** A change to how battles work, which the battle checks where it applies. */
export type Rule = 'exosuits' | 'fortified'

/** A way of attacking a weapon doctrine gives every soldier; combat applies it. */
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
  /** Stats every soldier has in place of its own, after everything else is counted. */
  set?: Partial<Stats>
  /** How every soldier positions, in place of its class's way. */
  stance?: Stance
  effect?: DoctrineEffect
}

/** Chance a parrying soldier deflects a shot from beyond arm's reach that would hit. */
export const PARRY_CHANCE = 0.3

/** Cover's defense under the fortified rule, by cover level, in place of COVER_DEFENSE. */
export const FORTIFIED_DEFENSE = [0, 0.3, 0.6]

const doctrines = {
  massCloning: { name: 'Mass Cloning', text: 'Every soldier has 2 less health', stats: { hp: -2 } },
  loneWolf: { name: 'Lone Wolf', text: 'Every soldier has +40 health, +4 armor, +5 damage, +25% aim, +25% crit and +2 move; no new soldier ever joins', stats: { hp: 40, armor: 4, damage: 5, aim: 0.25, crit: 0.25, move: 2 }, noRecruits: true },
  specialists: { name: 'Specialist Doctrine', text: 'No two soldiers share a class while a class is left unused', uniqueClasses: true },
  exosuits: { name: 'Exosuits', text: 'Every soldier has +3 armor, but cover gives soldiers no defense', stats: { armor: 3 }, rule: 'exosuits' },
  fortified: { name: 'Fortification Doctrine', text: 'Low cover stops 30% of shots and high cover 60%, for both sides', rule: 'fortified' },
  scatterguns: { name: 'Scatterguns', text: 'Every soldier has +2 damage and 2 less range', stats: { damage: 2, range: -2 }, weapon: true },
  blades: {
    name: 'Blademasters',
    text: "Every soldier fights with a blade: range 1, +3 damage, +2 move and +15% aim, and charges in. A shot from beyond arm's reach that would hit a soldier is parried 30% of the time",
    stats: { damage: 3, move: 2, aim: 0.15 },
    set: { range: 1 },
    stance: 'rush',
    effect: 'parry',
    weapon: true,
  },
  psionics: {
    name: 'Psi Operatives',
    text: 'Every soldier attacks with the mind: range 6 and 1 less damage, but attacks pass through walls and ignore cover, at any alien whose pod is revealed',
    stats: { damage: -1 },
    set: { range: 6 },
    effect: 'psionic',
    weapon: true,
  },
  demolitions: {
    name: 'Demolitions',
    text: 'Every soldier has +1 damage and 10% less aim, and each hit blows apart the cover around its target',
    stats: { damage: 1, aim: -0.1 },
    effect: 'demolish',
    weapon: true,
  },
  gunslingers: { name: 'Gunslingers', text: 'Every soldier has 1 less damage, 20% less aim and 2 less range, but fires a third shot each turn', stats: { damage: -1, aim: -0.2, range: -2 }, effect: 'twin', weapon: true },
} satisfies Record<string, Doctrine>

export type DoctrineId = keyof typeof doctrines
export const DOCTRINES: Record<DoctrineId, Doctrine> = doctrines
