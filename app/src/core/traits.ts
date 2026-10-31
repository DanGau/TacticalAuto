// Recruit traits: what each brings to the squad.
import type { Stats } from './battle'

/**
 * A recruit's quirk, offered at a run's start: a strength paid for with a weakness, as Slay the Spire's opening
 * blessings are. Stats apply to the recruit; the rest to the run once, when the recruit joins.
 */
export interface Trait {
  name: string
  pro: string
  con: string
  stats?: Partial<Stats>
  /** The level the recruit joins at. */
  level?: number
  supplies?: number
  threat?: number
  /** Whether the recruit brings a random relic. */
  relic?: boolean
}

export const TRAITS = {
  veteran: { name: 'Veteran', pro: 'Joins at level 3', con: '+4 threat', level: 3, threat: 4 },
  eagle: { name: 'Eagle-Eyed', pro: '+1 range', con: '-3 health', stats: { range: 1, hp: -3 } },
  bruiser: { name: 'Bruiser', pro: '+4 health and +1 damage', con: '-1 move', stats: { hp: 4, damage: 1, move: -1 } },
  quartermaster: { name: 'Quartermaster', pro: '+6 supplies', con: '-2 health', supplies: 6, stats: { hp: -2 } },
  hunter: { name: 'Relic Hunter', pro: 'Brings a random relic', con: '+5 threat', relic: true, threat: 5 },
  fleet: { name: 'Fleet-Footed', pro: '+2 move', con: '-2 health', stats: { move: 2, hp: -2 } },
  hothead: { name: 'Hothead', pro: '+25% crit chance', con: '-2 health', stats: { crit: 0.25, hp: -2 } },
} satisfies Record<string, Trait>

export type TraitId = keyof typeof TRAITS
