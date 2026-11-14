// The plain game quantities items make and read, the cancellations between them, and the resists aliens have.
import { TUNING } from './tuning'
import { BURN_MAX, CHILL_FREEZE, CHILL_MAX, CHILL_SLIDE, MARK_MAX } from './battle'

/**
 * A quantity the fight has that items make more of or read: an item that reads one pays beside any item that makes it,
 * whatever else either does, so combos form across what heroes and relics are for.
 */
export type Quantity = 'burn' | 'chill' | 'mark' | 'moved' | 'impact' | 'shots' | 'crit' | 'kill' | 'overkill' | 'armor' | 'hurt'

export const QUANTITIES: Record<Quantity, { name: string; icon: string; text: string }> = {
  burn: { name: 'Burn', icon: '🔥', text: `Burn stacks: at the start of each of its turns a unit takes its stacks in damage, then loses one; at most ${BURN_MAX}. Burn and chill on one alien cancel, stack for stack` },
  chill: { name: 'Chill', icon: '❄️', text: `Chill stacks: -2 move and 1 less damage, a stack lost each turn; at ${CHILL_FREEZE} it freezes, losing its next action, bar a boss; at most ${CHILL_MAX}. A chilled alien knocked back slides up to ${CHILL_SLIDE} tiles more, slamming harder the farther it goes. Burn cancels chill; moving a frozen alien thaws it` },
  mark: { name: 'Mark', icon: '🎯', text: `Mark stacks: every hit on a marked unit does ${TUNING.markDamage} more damage; at most ${MARK_MAX}. Moving a marked alien clears its marks` },
  moved: { name: 'Moved', icon: '↔️', text: "Knocked back, pulled, or slid since its last turn. An alien driven onto fire catches it. Moving a marked alien clears its marks, and a frozen one thaws" },
  impact: { name: 'Impact', icon: '💢', text: 'Knocked into something, or off a ledge' },
  shots: { name: 'Shots', icon: '🔫', text: 'Shots an attack fires: every on-hit effect fires on each' },
  crit: { name: 'Crit', icon: '💥', text: 'A crit does 2 more damage' },
  kill: { name: 'Kill', icon: '💀', text: 'An alien felled' },
  overkill: { name: 'Overkill', icon: '🔨', text: 'Damage past what a kill needs: big single hits make it' },
  armor: { name: 'Armor', icon: '🛡️', text: 'Takes damage before health, and is whole again each fight' },
  hurt: { name: 'Hurt', icon: '🩸', text: 'Hits a hero takes' },
}

/** What makes and reads a quantity: an item, skill or gear effect. */
export interface Flow {
  makes?: Quantity[]
  reads?: Quantity[]
}

/**
 * Opposite effects on one alien, which cancel unless the squad holds the bridge relic, which turns the meeting into a payoff.
 * `pair` names the quantities whose makers cancel, and `effect` the floating word the cancel shows.
 */
export const CANCELS = {
  quench: { pair: ['burn', 'chill'], effect: 'quenched', name: 'Quenched', text: 'Burn and chill on one alien cancel, stack for stack', bridge: 'thermal' },
  thaw: { pair: ['moved', 'chill'], effect: 'thawed', name: 'Thawed', text: 'Moving a frozen alien thaws it: its chill is lost and it acts again', bridge: 'shatter' },
  unlock: { pair: ['moved', 'mark'], effect: 'unlocked', name: 'Lock lost', text: 'Moving a marked alien clears its marks', bridge: 'lockOn' },
} as const satisfies Record<string, { pair: [Quantity, Quantity]; effect: string; name: string; text: string; bridge: string }>

export type Cancel = keyof typeof CANCELS

/** The cancellations a squad making `made` sets off: both halves made. */
export const cancelling = (made: readonly Quantity[]): Cancel[] => (Object.keys(CANCELS) as Cancel[]).filter((id) => CANCELS[id].pair.every((q) => made.includes(q)))

/** Whether `flow` reads what `made` holds or makes what `read` holds. */
export const feeds = (flow: Flow, made: readonly Quantity[], read: readonly Quantity[]) => !!flow.reads?.some((q) => made.includes(q)) || !!flow.makes?.some((q) => read.includes(q))

/** A quantity an alien shrugs off, so a party built on it must answer that alien some other way. */
export type Resist = 'burn' | 'chill' | 'mark' | 'crit' | 'armor'

export const RESISTS: Record<Resist, string> = {
  burn: 'Cannot burn',
  chill: 'Cannot be chilled',
  mark: 'Cannot be marked',
  crit: 'Cannot be crit',
  armor: 'Its attacks ignore armor',
}
