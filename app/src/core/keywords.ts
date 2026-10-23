/**
 * Words that tie skills, gear and relics together: some cause a keyword, others pay off on it, so a squad built
 * around one finds its pieces stronger together.
 */
export type Keyword = 'burn' | 'frost' | 'mark' | 'crit' | 'kill' | 'ward'

export const KEYWORDS: Record<Keyword, { name: string; text: string }> = {
  burn: { name: 'Burn', text: 'A burning unit takes 1 damage at the start of each of its next 2 turns' },
  frost: { name: 'Frost', text: 'A chilled unit has -2 move and -15% aim on its next turn' },
  mark: { name: 'Mark', text: 'Every hit on a marked unit does 1 more damage' },
  crit: { name: 'Crit', text: 'A crit does 2 more damage; only a target without cover against the shot can be crit' },
  kill: { name: 'Kill', text: 'Pays off when the soldier kills' },
  ward: { name: 'Ward', text: 'Armor, which takes damage before health' },
}

/** A keyword an alien shrugs off, so a squad built on it must answer that alien some other way. */
export type Resist = Exclude<Keyword, 'kill'>

export const RESISTS: Record<Resist, string> = {
  burn: 'Cannot burn',
  frost: 'Cannot be chilled',
  mark: 'Cannot be marked',
  crit: 'Cannot be crit',
  ward: 'Its attacks ignore armor',
}
