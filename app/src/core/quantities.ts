// The plain game quantities items make and read, the cancellations between them, and the resists aliens have.
import { TUNING } from './tuning'
import { BURN_MAX, CHILL_FREEZE, CHILL_MAX, CHILL_SLIDE, MARK_MAX, NUMB_TURNS, OVERKILL_FROM } from './battle'

/**
 * A quantity the fight has that items make more of or read: an item that reads one pays beside any item that makes it,
 * whatever else either does, so combos form across what heroes and relics are for.
 */
export type Quantity = 'burn' | 'chill' | 'mark' | 'moved' | 'impact' | 'shots' | 'crit' | 'kill' | 'overkill' | 'armor' | 'hurt'

export const QUANTITIES: Record<Quantity, { name: string; icon: string; text: string }> = {
  burn: { name: 'Burn', icon: '🔥', text: `Start of turn: take 1 damage per Burn, then lose 1 Burn. Max ${BURN_MAX}.` },
  chill: { name: 'Chill', icon: '❄️', text: `Per Chill: 2 less move and 1 less damage. Loses 1 each turn. At ${CHILL_FREEZE}, Freeze. Max ${CHILL_MAX}. Knockback slides it ${CHILL_SLIDE} more tiles.` },
  mark: { name: 'Mark', icon: '🎯', text: `Hits on it deal ${TUNING.markDamage} more damage per Mark. Max ${MARK_MAX}.` },
  moved: { name: 'Displace', icon: '↔️', text: 'Knockback, Pull or slide. A Displaced alien cannot walk next turn, bar a boss. Driven onto fire, it Burns.' },
  impact: { name: 'Impact', icon: '💢', text: 'An alien knocked into something or off a ledge.' },
  shots: { name: 'Shots', icon: '🔫', text: 'Each shot triggers every on-hit effect.' },
  crit: { name: 'Crit', icon: '💥', text: 'Deal 2 more damage.' },
  kill: { name: 'Kill', icon: '💀', text: 'An alien killed.' },
  overkill: { name: 'Overkill', icon: '🔨', text: `Damage past ${OVERKILL_FROM} in 1 hit.` },
  armor: { name: 'Armor', icon: '🛡️', text: 'Lost before HP. Restored each battle.' },
  hurt: { name: 'Hurt', icon: '🩸', text: 'A hit taken.' },
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
  quench: { pair: ['burn', 'chill'], effect: 'quenched', name: 'Quench', text: `Burn and Chill on an alien cancel. It is Numb for ${NUMB_TURNS} turn.`, bridge: 'thermal' },
  thaw: { pair: ['moved', 'chill'], effect: 'thawed', name: 'Thaw', text: 'Displacing a Frozen alien removes its Chill and Freeze. It is Numb.', bridge: 'shatter' },
  unlock: { pair: ['moved', 'mark'], effect: 'unlocked', name: 'Lock Lost', text: 'Displacing a Marked alien removes its Mark. It is Numb.', bridge: 'lockOn' },
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
  burn: 'Immune to Burn.',
  chill: 'Immune to Chill.',
  mark: 'Immune to Mark.',
  crit: 'Immune to Crit.',
  armor: 'Ignores Armor.',
}
