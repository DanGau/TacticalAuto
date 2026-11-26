// What an event's action comes from. Combat imports it, so it reads only tables that import no combat.
import { EXAMS } from './exams'
import type { Effect, Unit } from './battle'
import type { GameEvent } from './combat-event'
import { EFFECTS } from './gear'

export type SrcKind = 'weapon' | 'gear' | 'relic' | 'card' | 'object' | 'basic' | 'alien'

/** `id` is an effect for gear and relic; a weapon's id; a card's id; an object's prop; an alien's kind or trait; a basic action or state. */
export interface Src {
  kind: SrcKind
  id: string
}

/** Actions and states every unit has. */
export const BASICS = { attack: 'Attack', jump: 'Jump', move: 'Move', dash: 'Dash', stun: 'Stunned', frozen: 'Frozen', napalm: 'Fire', regen: 'Regen' } as const

/** What an effect event can name: an effect, or a basic action or state. */
export type Label = Effect | keyof typeof BASICS

export const has = <T extends object>(table: T, id: string): id is Extract<keyof T, string> => Object.hasOwn(table, id)

/** The kind an effect comes from: a Guardian's trait, a gear effect's, a basic; any other is a relic's. */
export function srcOf(effect: Label): Src {
  const kind = ((): SrcKind => {
    if (has(EXAMS, effect) && effect !== 'thorns') return 'alien'
    if (has(EFFECTS, effect)) return 'gear'
    return has(BASICS, effect) ? 'basic' : 'relic'
  })()
  return { kind, id: effect }
}

/** What a unit's plain attack comes from: an alien's kind, else the hero's weapon. */
export function attackSrc(unit: Unit): Src {
  if (unit.side === 'alien' && unit.kind) return { kind: 'alien', id: unit.kind }
  return { kind: 'basic', id: 'attack' }
}

/** An alien's own doing, by its kind. */
export const alienSrc = (unit: Unit): Src => ({ kind: 'alien', id: unit.kind ?? 'trooper' })

/** A plain walk. */
export const BASIC_MOVE: Src = { kind: 'basic', id: 'move' }

/** An effect event, its source the effect's unless told. */
export const fx = (id: number, effect: Label, amount: number, src: Src = srcOf(effect)): GameEvent => ({ type: 'effect', id, effect, amount, src })
