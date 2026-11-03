// Duos: bonuses two classes share while both are in the squad, offered beside relics once the pair is.
import { CLASSES, type ClassId } from './classes'
import type { Run, Soldier } from './run-state'

/** Damage and tiles the duos' effects use. */
export const SHATTER_HIT = 3
export const SHATTER_SPLASH = 2
export const SPOTTER_REACH = 2
export const CROSSFIRE_DAMAGE = 2
export const PAYLOAD_DAMAGE = 3

/** A bonus that exists only while heroes of both its classes fight together. `pair` lists them in the order `text` names them. */
export interface Duo {
  name: string
  pair: [ClassId, ClassId]
  text: string
}

const duos = {
  thermalShock: { name: 'Thermal Shock', pair: ['pyro', 'cryo'], text: `A hit by either on an alien both burning and chilled shatters it: ${SHATTER_HIT} more damage, ${SHATTER_SPLASH} to each alien beside it, and the fire and frost are spent` },
  spotting: { name: 'Spotter', pair: ['sniper', 'phantom'], text: `The Deadeye's hits on an alien within ${SPOTTER_REACH} tiles of the Phantom are crits` },
  lifeline: { name: 'Lifeline', pair: ['support', 'assault'], text: "The Beacon's Healing Light reaches the Vanguard anywhere, and healing past its full health becomes armor" },
  anvil: { name: 'Hammer and Anvil', pair: ['heavy', 'assault'], text: "The Powerhouse's hits stun an alien beside the Vanguard, but a boss" },
  painter: { name: 'Target Painter', pair: ['engineer', 'sniper'], text: "An alien that hits the Gadgeteer's mech or drone is marked, for the Deadeye" },
  coldComfort: { name: 'Cold Comfort', pair: ['support', 'cryo'], text: "The Beacon's heal chills every alien beside the ally healed" },
  firefall: { name: 'Firefall', pair: ['heavy', 'pyro'], text: "The Powerhouse's Meteor Strike sets each alien it hits burning" },
  pincer: { name: 'Pincer', pair: ['assault', 'phantom'], text: 'Once a round, after the Vanguard attacks, the Phantom strikes the last alien it hit, if it can reach it' },
  payload: { name: 'Napalm Payload', pair: ['engineer', 'pyro'], text: `The Gadgeteer's mech or drone, destroyed, bursts: ${PAYLOAD_DAMAGE} damage to each alien beside it, and they burn` },
  flashFreeze: { name: 'Flash Freeze', pair: ['sniper', 'cryo'], text: "The Deadeye's crit on a chilled alien freezes it: it loses its next action" },
  crossfire: { name: 'Crossfire', pair: ['assault', 'sniper'], text: `A hit by either on an alien the other hit this round does +${CROSSFIRE_DAMAGE} damage` },
  afterglow: { name: 'Afterglow', pair: ['support', 'phantom'], text: "The Phantom's kill out of cloak gives the Beacon back a use of Healing Light" },
} satisfies Record<string, Duo>

export type DuoId = keyof typeof duos
export const DUOS: Record<DuoId, Duo> = duos
export const DUO_IDS = Object.keys(DUOS) as DuoId[]

const forms = (duo: Duo, classes: (ClassId | null)[]) => duo.pair.every((cls) => classes.includes(cls))

/** Duos the squad's classes form that it does not hold. */
export const openDuos = (run: Run): DuoId[] => DUO_IDS.filter((id) => !run.duos.includes(id) && forms(DUOS[id], run.soldiers.map((s) => s.cls)))

/** Duos `hero` would form with the squad, or with no squad yet, any partner: its class's, with the partner named. */
export function duosFor(run: Run, hero: Soldier): { id: DuoId; partner: string }[] {
  const others = run.soldiers.filter((s) => s !== hero).map((s) => s.cls)
  return DUO_IDS.flatMap((id) => {
    const { pair } = DUOS[id]
    if (!hero.cls || !pair.includes(hero.cls)) return []
    const partner = pair.find((cls) => cls !== hero.cls)!
    return others.length === 0 || others.includes(partner) ? [{ id, partner: CLASSES[partner].name }] : []
  })
}

/** Each duo held and the soldier ids of the first heroes of its pair, in pair order, while the squad has both. */
export function duoHeroes(run: Run): { id: DuoId; heroes: [number, number] }[] {
  return run.duos.flatMap((id) => {
    const [a, b] = DUOS[id].pair.map((cls) => run.soldiers.find((s) => s.cls === cls)?.id)
    return a !== undefined && b !== undefined ? [{ id, heroes: [a, b] as [number, number] }] : []
  })
}
