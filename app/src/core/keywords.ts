// The glossary: every keyword game text may name, capitalized, each with one fixed meaning. See docs/text-style.md.
import { CANCELS, QUANTITIES } from './quantities'
import { CLOAK_DAMAGE, NUMB_SOAK, SKIRMISH_MOVE, SUPPRESS_DAMAGE } from './battle'
import { WEAKEN_TURNS } from './stacks'
import { SLAM_DAMAGE } from './wound'

/** Statuses and terms that are not quantities, by the word text names them with. */
const TERMS = {
  Freeze: 'Skip the next action. Bosses are immune.',
  Root: 'Cannot move next turn.',
  Stun: 'Skip the next action. Bosses are immune.',
  Numb: `Takes no Burn, Chill or Mark, and ${NUMB_SOAK} less damage per hit.`,
  Weak: `Deal ${SUPPRESS_DAMAGE} less damage for ${WEAKEN_TURNS} turns.`,
  Might: '1 more damage per hit per Might, for the battle.',
  Panic: 'Skip the next action.',
  Surprise: 'Skip the first turn.',
  Cloak: `Unseen and untargetable. The next attack deals ${CLOAK_DAMAGE} more damage, ignores Armor and ends Cloak.`,
  'Temp HP': 'Lost before HP and Armor. Gone after the battle.',
  Knockback: `Push the target N tiles away. Impact: deal ${SLAM_DAMAGE} damage to it and any alien it hits. Off a ledge or the edge, it falls.`,
  Pull: 'Drag the target N tiles toward you.',
  Parry: 'Ignore a hit.',
  Retreat: `After acting, move up to ${SKIRMISH_MOVE} tiles away from aliens.`,
  Consume: 'Remove all of a stack to pay for an effect.',
  Thorns: 'When hit: deal N damage to the attacker.',
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
