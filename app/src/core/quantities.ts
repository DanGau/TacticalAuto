// The plain game quantities items make and read, the cancellations between them, and the resists aliens have.
import { TUNING } from './tuning'
import { BURN_MAX, CHILL_FREEZE, CHILL_MAX, CHILL_SLIDE, MARK_MAX, NUMB_TURNS, OVERKILL_FROM } from './battle'

/**
 * A quantity the fight has that items make more of or read: an item that reads one pays beside any item that makes it,
 * whatever else either does, so combos form across what heroes and relics are for.
 */
export type Quantity = 'burn' | 'chill' | 'mark' | 'moved' | 'impact' | 'shots' | 'crit' | 'kill' | 'overkill' | 'armor' | 'hurt'

export const QUANTITIES: Record<Quantity, { name: string; icon: string; text: string }> = {
  burn: { name: 'Burn', icon: '🔥', text: `At the start of its turn, a unit takes 1 damage for each Burn, then loses 1 Burn. Stacks to ${BURN_MAX}. Quench: Burn and Chill on an alien cancel.` },
  chill: { name: 'Chill', icon: '❄️', text: `Each Chill gives 2 less move and 1 less damage, and 1 fades each turn. At ${CHILL_FREEZE} Chill, Freeze it. Stacks to ${CHILL_MAX}. A Chilled alien knocked back slides ${CHILL_SLIDE} more tiles.` },
  mark: { name: 'Mark', icon: '🎯', text: `Each hit on a Marked unit deals ${TUNING.markDamage} more damage. Stacks to ${MARK_MAX}. Lock Lost: Displacing it clears its Mark.` },
  moved: { name: 'Displace', icon: '↔️', text: 'Knock back, pull or slide a unit. A Displaced alien cannot walk on its next turn, bar a boss. Driven onto fire, it Burns.' },
  impact: { name: 'Impact', icon: '💢', text: 'An alien knocked into something, or off a ledge.' },
  shots: { name: 'Shots', icon: '🔫', text: 'Each shot an attack fires. Every on-hit effect triggers on each.' },
  crit: { name: 'Crit', icon: '💥', text: 'A Crit deals 2 more damage.' },
  kill: { name: 'Kill', icon: '💀', text: 'An alien felled.' },
  overkill: { name: 'Overkill', icon: '🔨', text: `Damage a hit deals past ${OVERKILL_FROM}.` },
  armor: { name: 'Armor', icon: '🛡️', text: 'Takes damage before HP. Restored at the start of each battle.' },
  hurt: { name: 'Hurt', icon: '🩸', text: 'Each hit you take.' },
}

/** What makes and reads a quantity: an item, skill or gear effect. */
export interface Flow {
  makes?: Quantity[]
  reads?: Quantity[]
}

/**
 * Opposite effects on one alien, which cancel unless the hero holds the bridge relic, which turns the meeting into a payoff.
 * `pair` names the quantities whose makers cancel, and `effect` the floating word the cancel shows.
 */
export const CANCELS = {
  quench: { pair: ['burn', 'chill'], effect: 'quenched', name: 'Quench', text: `Burn and Chill on an alien cancel: both go out and it is Numb for ${NUMB_TURNS} turn.`, bridge: 'thermal' },
  thaw: { pair: ['moved', 'chill'], effect: 'thawed', name: 'Thaw', text: 'Displacing a Frozen alien thaws it: it loses its Chill, acts, and is Numb.', bridge: 'shatter' },
  unlock: { pair: ['moved', 'mark'], effect: 'unlocked', name: 'Lock Lost', text: 'Displacing a Marked alien clears its Mark, and it is Numb.', bridge: 'lockOn' },
} as const satisfies Record<string, { pair: [Quantity, Quantity]; effect: string; name: string; text: string; bridge: string }>

export type Cancel = keyof typeof CANCELS

/** The cancellation whose floating word is `effect`, if any. */
export const cancelOf = (effect: string) => Object.values(CANCELS).find((c) => c.effect === effect)

/** The cancellations a hero making `made` sets off: both halves made. */
export const cancelling = (made: readonly Quantity[]): Cancel[] => (Object.keys(CANCELS) as Cancel[]).filter((id) => CANCELS[id].pair.every((q) => made.includes(q)))

/** Whether `flow` reads what `made` holds or makes what `read` holds. */
export const feeds = (flow: Flow, made: readonly Quantity[], read: readonly Quantity[]) => !!flow.reads?.some((q) => made.includes(q)) || !!flow.makes?.some((q) => read.includes(q))

/** A quantity an alien shrugs off, so a hero built on it must answer that alien some other way. */
export type Resist = 'burn' | 'chill' | 'mark' | 'crit' | 'armor'

export const RESISTS: Record<Resist, string> = {
  burn: 'Cannot burn.',
  chill: 'Cannot be chilled.',
  mark: 'Cannot be marked.',
  crit: 'Cannot be crit.',
  armor: 'Its attacks ignore armor.',
}
