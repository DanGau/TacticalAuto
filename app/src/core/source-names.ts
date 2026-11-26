// The name a source shows under.
import type { Effect } from './battle'
import { ALIENS, type AlienKind } from './aliens'
import { effectName } from './effects'
import { BASICS, has, type Src } from './sources'
import { CARDS, type CardId } from './cards'
import { WEAPONS } from './weapons'

/** What blown objects show as. */
const OBJECTS: Record<string, string> = { fuel: 'Fuel Tank', rig: 'Rigged Tank', car: 'Car', truck: 'Truck', tree: 'Tree', crate: 'Crate', stack: 'Crates', fence: 'Fence', rubble: 'Rubble', spire: 'Spire', growth: 'Growth', wreck: 'Wreck', alien: 'Alien', water: 'Water', void: 'Void', none: 'Object' }

/** The name a source shows under. */
export function sourceName(src: Src): string {
  const { kind, id } = src
  if (kind === 'object') return OBJECTS[id] ?? 'Object'
  if (kind === 'card') return CARDS[id as CardId].name
  if (kind === 'alien') return has(ALIENS, id) ? ALIENS[id as AlienKind].name : effectName(id as Effect)
  if (has(WEAPONS, id)) return WEAPONS[id].name
  if (has(BASICS, id)) return BASICS[id]
  return effectName(id as Effect)
}
