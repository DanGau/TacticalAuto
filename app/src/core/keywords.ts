// Keywords builds share, and the resists aliens have.
import { TUNING } from './tuning'
import { BURN_MAX, CHILL_FREEZE, CHILL_MAX, MARK_MAX } from './battle'

/**
 * Words that tie skills, gear and relics together: some cause a keyword, others pay off on it, so a party built
 * around one finds its pieces stronger together.
 */
export type Keyword = 'burn' | 'frost' | 'mark' | 'crit' | 'kill' | 'ward' | 'might' | 'force' | 'volley'

export const KEYWORDS: Record<Keyword, { name: string; icon: string; text: string }> = {
  burn: { name: 'Burn', icon: '🔥', text: `Burn stacks: at the start of each of its turns a unit takes its stacks in damage, then loses one; at most ${BURN_MAX}` },
  frost: { name: 'Frost', icon: '❄️', text: `Chill stacks: a chilled unit has -2 move and does 1 less damage, and loses a stack each turn; at ${CHILL_FREEZE} it freezes, losing its next action, bar a boss; at most ${CHILL_MAX}` },
  mark: { name: 'Mark', icon: '🎯', text: `Mark stacks: every hit on a marked unit does ${TUNING.markDamage} more damage; at most ${MARK_MAX}` },
  crit: { name: 'Crit', icon: '💥', text: 'A crit does 2 more damage' },
  kill: { name: 'Kill', icon: '💀', text: 'Pays off when the hero kills' },
  ward: { name: 'Ward', icon: '🛡️', text: 'Armor: temporary HP that takes damage first and is whole again each fight' },
  might: { name: 'Might', icon: '⚔️', text: 'Might stacks: +1 damage each, for the rest of the battle' },
  force: { name: 'Force', icon: '💪', text: 'Knockbacks, throws, slams and falls' },
  volley: { name: 'Volley', icon: '🔫', text: 'Many shots an attack: every on-hit effect fires on each' },
}

/** A keyword an alien shrugs off, so a party built on it must answer that alien some other way. */
export type Resist = Exclude<Keyword, 'kill' | 'might' | 'force' | 'volley'>

export const RESISTS: Record<Resist, string> = {
  burn: 'Cannot burn',
  frost: 'Cannot be chilled',
  mark: 'Cannot be marked',
  crit: 'Cannot be crit',
  ward: 'Its attacks ignore armor',
}
