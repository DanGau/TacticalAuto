// The name a source shows under.
import type { Ability, Effect } from './battle'
import { ALIENS, type AlienKind } from './aliens'
import { effectName } from './effects'
import { SECONDARIES } from './secondaries'
import type { SkillId } from './skills'
import { BASICS, has, type Src } from './sources'
import { UTILITIES, type UtilityId } from './utilities'
import { WEAPONS, type WeaponId } from './weapons'

/** What thrown or blown objects show as. */
const OBJECTS: Record<string, string> = { fuel: 'Fuel Tank', rig: 'Rigged Tank', car: 'Car', truck: 'Truck', tree: 'Tree', crate: 'Crate', stack: 'Crates', fence: 'Fence', rubble: 'Rubble', spire: 'Spire', growth: 'Growth', wreck: 'Wreck', alien: 'Alien', water: 'Water', void: 'Void', none: 'Object' }

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
