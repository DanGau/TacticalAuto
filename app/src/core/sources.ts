// What an event's action comes from. Combat imports it, so it reads only tables that import no combat.
import type { Ability, Effect, Unit } from './battle'
import type { GameEvent } from './combat-event'
import { CLASSES } from './classes'
import { DOCTRINES } from './doctrines'
import { DUOS } from './duos'
import { EFFECTS } from './gear'
import type { SecondaryId } from './secondaries'
import { SKILL_EFFECTS } from './skill-effects'
import { PERK_EFFECTS } from './perks'
import { WEAPONS } from './weapons'

export type SrcKind = 'class' | 'skill' | 'weapon' | 'gear' | 'relic' | 'boon' | 'doctrine' | 'object' | 'basic' | 'perk' | 'alien'

/** `id` is an effect or ability for class, skill, gear, relic and doctrine; a weapon's id or effect; a boon's id; an object's prop; an alien's kind or ability; a basic action. */
export interface Src {
  kind: SrcKind
  id: string
}

/** Actions and states every unit has. */
export const BASICS = { attack: 'Attack', throw: 'Throw', jump: 'Jump', move: 'Move', dash: 'Dash', order: 'Order', stun: 'Stunned', frozen: 'Frozen', surge: 'Temp HP', overwatch: 'Overwatch', rangedShield: 'Shield', meleeShield: 'Shield', hover: 'Hover' } as const

export const has = <T extends object>(table: T, id: string): id is Extract<keyof T, string> => Object.hasOwn(table, id)

/** The kind an effect comes from: a class ability or duo, a weapon's own, a doctrine's, a skill's, a perk's, a gear mod's, a basic; any other is a relic's. */
export function srcOf(effect: Effect | Ability): Src {
  const kind = ((): SrcKind => {
    if (Object.values(CLASSES).some((c) => c.ability === effect) || has(DUOS, effect)) return 'class'
    if (Object.values(WEAPONS).some((w) => w.effect === effect)) return 'weapon'
    if (effect === 'reckoning' || Object.values(DOCTRINES).some((d) => d.effect === effect)) return 'doctrine'
    if ((SKILL_EFFECTS as readonly string[]).includes(effect)) return 'skill'
    if ((PERK_EFFECTS as readonly string[]).includes(effect)) return 'perk'
    if (has(EFFECTS, effect)) return 'gear'
    return has(BASICS, effect) ? 'basic' : 'relic'
  })()
  return { kind, id: effect }
}

/** What a unit's plain attack comes from: an alien's kind, a hero's secondary or weapon, else bare hands. */
export function attackSrc(unit: Unit, secondary?: SecondaryId): Src {
  if (unit.side === 'alien' && unit.kind) return { kind: 'alien', id: unit.kind }
  if (secondary) return { kind: 'class', id: secondary }
  return unit.weapon ? { kind: 'weapon', id: unit.weapon } : { kind: 'basic', id: 'attack' }
}

/** An alien's own doing, by its kind. */
export const alienSrc = (unit: Unit): Src => ({ kind: 'alien', id: unit.kind ?? 'trooper' })

/** A plain walk. */
export const BASIC_MOVE: Src = { kind: 'basic', id: 'move' }

/** An effect event, its source the effect's unless told. */
export const fx = (id: number, effect: Effect | Ability, amount: number, src: Src = srcOf(effect)): GameEvent => ({ type: 'effect', id, effect, amount, src })
