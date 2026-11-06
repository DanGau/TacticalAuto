// What an event's action comes from, and the name it shows under.
import type { Ability, Effect, Unit } from './battle'
import type { GameEvent } from './combat-event'
import { ALIENS, type AlienKind } from './aliens'
import { CLASSES } from './classes'
import { DOCTRINES } from './doctrines'
import { DUOS } from './duos'
import { effectName } from './effects'
import { EFFECTS } from './gear'
import { RELICS } from './relics'
import { SECONDARIES, type SecondaryId } from './secondaries'
import { SKILL_EFFECTS } from './skill-effects'
import type { SkillId } from './skills'
import { UTILITIES, type UtilityId } from './utilities'
import { WEAPONS, type WeaponId } from './weapons'

export type SrcKind = 'class' | 'skill' | 'weapon' | 'gear' | 'relic' | 'boon' | 'doctrine' | 'object' | 'basic' | 'alien'

/** `id` is an effect or ability for class, skill, gear, relic and doctrine; a weapon's id or effect; a boon's id; an object's prop; an alien's kind or ability; a basic action. */
export interface Src {
  kind: SrcKind
  id: string
}

/** Actions every unit has. */
export const BASICS = { attack: 'Attack', throw: 'Throw', jump: 'Jump', move: 'Move', dash: 'Dash', order: 'Order', stun: 'Stunned', frozen: 'Frozen', surge: 'Temp HP', overwatch: 'Overwatch', rangedShield: 'Shield', meleeShield: 'Shield', hover: 'Hover', reckoning: "Executioner's Oath" } as const

/** What thrown or blown objects show as. */
const OBJECTS: Record<string, string> = { fuel: 'Fuel Tank', rig: 'Rigged Tank', car: 'Car', truck: 'Truck', tree: 'Tree', crate: 'Crate', stack: 'Crates', fence: 'Fence', rubble: 'Rubble', spire: 'Spire', growth: 'Growth', wreck: 'Wreck', alien: 'Alien', water: 'Water', void: 'Void', none: 'Object' }

const has = <T extends object>(table: T, id: string): id is Extract<keyof T, string> => Object.hasOwn(table, id)

/** The kind an effect comes from: a class ability or duo, a weapon's own, a doctrine's, a relic's, a skill's, a gear mod's, else a basic. */
export function srcOf(effect: Effect | Ability): Src {
  const kind = ((): SrcKind => {
    if (Object.values(CLASSES).some((c) => c.ability === effect) || has(DUOS, effect)) return 'class'
    if (Object.values(WEAPONS).some((w) => w.effect === effect)) return 'weapon'
    if (Object.values(DOCTRINES).some((d) => d.effect === effect)) return 'doctrine'
    if (Object.values(RELICS).some((r) => r.effect === effect)) return 'relic'
    if ((SKILL_EFFECTS as readonly string[]).includes(effect)) return 'skill'
    if (has(EFFECTS, effect)) return 'gear'
    return 'basic'
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

/** An effect event, its source the effect's unless told. */
export const fx = (id: number, effect: Effect | Ability, amount: number, src: Src = srcOf(effect)): GameEvent => ({ type: 'effect', id, effect, amount, src })

/** The name a source shows under, given the squad's skills and weapons for effects shared between them. */
export function sourceName(src: Src, kit?: { skills: SkillId[]; weapons: WeaponId[] }): string {
  const { kind, id } = src
  if (kind === 'object') return OBJECTS[id] ?? 'Object'
  if (kind === 'boon') return UTILITIES[id as UtilityId].name
  if (kind === 'alien') return has(ALIENS, id) ? ALIENS[id as AlienKind].name : effectName(id as Ability)
  if (has(WEAPONS, id)) return WEAPONS[id].name
  if (kind === 'weapon') return [...(kit?.weapons ?? []).map((w) => WEAPONS[w]), ...Object.values(WEAPONS)].find((w) => w.effect === id)!.name
  if (has(SECONDARIES, id)) return SECONDARIES[id].name
  if (has(BASICS, id)) return BASICS[id]
  return effectName(id as Effect, kit)
}

/** A plain walk. */
export const BASIC_MOVE: Src = { kind: 'basic', id: 'move' }
