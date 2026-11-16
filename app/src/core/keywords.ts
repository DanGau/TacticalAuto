// The glossary: every keyword game text may name, capitalized, each with one fixed meaning. See docs/text-style.md.
import { CANCELS, QUANTITIES } from './quantities'
import { CLOAK_DAMAGE, NUMB_SOAK, SUPPRESS_DAMAGE } from './battle'
import { WEAKEN_TURNS } from './stacks'

/** Statuses and terms that are not quantities, by the word text names them with. */
const TERMS = {
  Freeze: 'A Frozen alien skips its next action, bar a boss.',
  Root: 'A Rooted unit cannot move on its next turn.',
  Stun: 'A Stunned unit skips its next action.',
  Numb: `A Numb alien takes no Burn, Chill or Mark, and ${NUMB_SOAK} less damage from each hit.`,
  Weak: `A Weak unit deals ${SUPPRESS_DAMAGE} less damage for ${WEAKEN_TURNS} turns.`,
  Might: 'Each Might adds 1 damage to every hit for the rest of the battle.',
  Panic: 'A Panicked hero skips its next action.',
  Surprise: 'A Surprised alien skips its first turn.',
  Cloak: `No alien sees or targets a Cloaked hero. Its next attack deals ${CLOAK_DAMAGE} more damage, ignores Armor and ends the Cloak.`,
  'Temp HP': 'Lost before HP and Armor. Gone at the end of the battle.',
} as const

export interface Keyword {
  icon?: string
  text: string
}

/** Every keyword, by the word text names it with: the quantities, the cancellations and the terms above. */
export const KEYWORDS: Record<string, Keyword> = {
  ...Object.fromEntries(Object.values(QUANTITIES).map((q) => [q.name, { icon: q.icon, text: q.text }])),
  ...Object.fromEntries(Object.values(CANCELS).map((c) => [c.name, { icon: '⚠', text: c.text }])),
  ...Object.fromEntries(Object.entries(TERMS).map(([name, text]) => [name, { text }])),
}
