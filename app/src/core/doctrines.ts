import type { Lasting } from './base'

/** A change to how battles work, which the battle checks where it applies. */
export type Rule = 'exosuits' | 'fortified'

/**
 * A way of fighting the squad adopts at an event and keeps for the run. Each helps and hurts; `text` says how.
 * Some change soldiers' stats, some how the squad grows, some how battles work.
 */
export interface Doctrine extends Lasting {
  name: string
  text: string
  rule?: Rule
  /** Whether winning a key no longer brings a new clone. */
  noRecruits?: boolean
  /** Whether a new clone takes a class no squadmate has, while one is left. */
  uniqueClasses?: boolean
}

/** Cover's defense under the fortified rule, by cover level, in place of COVER_DEFENSE. */
export const FORTIFIED_DEFENSE = [0, 0.3, 0.6]

const doctrines = {
  massCloning: { name: 'Mass Cloning', text: 'Every soldier has 3 less health', stats: { hp: -3 } },
  loneWolf: { name: 'Lone Wolf', text: 'Every soldier has +8 health, +2 damage and +10% aim; no new clone ever joins', stats: { hp: 8, damage: 2, aim: 0.1 }, noRecruits: true },
  specialists: { name: 'Specialist Doctrine', text: 'No two soldiers share a class while a class is left unused', uniqueClasses: true },
  exosuits: { name: 'Exosuits', text: 'Every soldier has +3 armor, but cover gives soldiers no defense', stats: { armor: 3 }, rule: 'exosuits' },
  fortified: { name: 'Fortification Doctrine', text: 'Low cover stops 30% of shots and high cover 60%, for both sides', rule: 'fortified' },
  scatterguns: { name: 'Scatterguns', text: 'Every soldier has +2 damage and 2 less range', stats: { damage: 2, range: -2 } },
} satisfies Record<string, Doctrine>

export type DoctrineId = keyof typeof doctrines
export const DOCTRINES: Record<DoctrineId, Doctrine> = doctrines
