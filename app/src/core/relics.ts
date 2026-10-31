// Relics: what each does, and which may be offered.
import { type RelicEffect, type Stats } from './battle'
import { CHARGE_BLAST, CHARGE_REACH, LIMELIGHT_ROUNDS } from './entrances'
import { BEACON_REACH } from './fighters'
import { BOUNTY_DAMAGE } from './fighters'
import { RELAY_REACH } from './fighters'
import { TUNING } from './tuning'
import type { Keyword } from './keywords'

/**
 * An artifact the squad keeps for the run, taken from three offered after a satellite, a hold or an ambush is won.
 * It changes every hero, or how the run pays; `text` says how.
 */
export interface Relic {
  name: string
  text: string
  tags?: Keyword[]
  /** Added to every hero's stats. */
  stats?: Partial<Stats>
  /** Given to every hero. */
  effect?: RelicEffect
  /** Added to the uses of every class ability that has uses. */
  charges?: number
  /** Added to the supplies each won battle pays. */
  supplies?: number
  /** Whether every piece of gear found is rare or better. */
  rareGear?: boolean
  /** Whether the flight map names the aliens of each stop, not only how dangerous they are. */
  recon?: boolean
  /** Added to the supplies each civilian saved pays. */
  civilianSupplies?: number
}

const relics = {
  plasma: { name: 'Plasma Rifles', text: 'Every hero does +1 damage', stats: { damage: 1 } },
  alloys: { name: 'Alien Alloys', text: 'Every hero has +3 armor', tags: ['ward'], stats: { armor: 3 } },
  servos: { name: 'Overclocked Servos', text: 'Every hero has +1 move', stats: { move: 1 } },
  lens: { name: 'Focusing Lens', text: 'Every hero has +1 range and +10% crit', tags: ['crit'], stats: { range: 1, crit: 0.1 } },
  glassCannon: { name: 'Glass Cannon Protocol', text: 'Every hero does +2 damage and has 3 less health', stats: { damage: 2, hp: -3 } },
  capacitor: { name: 'Kinetic Capacitor', text: "Each hero's first hit of a battle is a crit", tags: ['crit'], effect: 'opener' },
  plating: { name: 'Adaptive Plating', text: 'Each hero regrows 1 armor at the start of its turn', tags: ['ward'], effect: 'rearm' },
  nanites: { name: 'Hunger Nanites', text: 'A hero who kills heals 2', tags: ['kill'], effect: 'feast' },
  phoenix: { name: 'Phoenix Protocol', text: 'Once per battle, the first soldier to fall gets up with 5 health', effect: 'phoenix' },
  echo: { name: 'Echo Chamber', text: 'Every class ability with limited uses has one more', charges: 1 },
  drones: { name: 'Scavenger Drones', text: 'Each won battle pays 1 more supply', supplies: 1 },
  contact: { name: 'Black Market Contact', text: 'Every piece of gear found is rare or better', rareGear: true },
  uplink: { name: 'Recon Uplink', text: 'The flight map names the aliens of each stop, not only how dangerous they are', recon: true },
  accelerant: { name: 'Accelerant Gel', text: `Hits on a burning target do +${TUNING.accelerantDamage} damage`, tags: ['burn'], effect: 'accelerant' },
  wildfire: { name: 'Wildfire Spores', text: 'An alien that dies burning sets every alien beside it burning', tags: ['burn', 'kill'], effect: 'wildfire' },
  salamander: { name: 'Salamander Sigil', text: 'Crits set the target burning', tags: ['crit', 'burn'], effect: 'ignite' },
  lattice: { name: 'Frost Lattice', text: 'Crits chill the target', tags: ['crit', 'frost'], effect: 'freeze' },
  shatter: { name: 'Shatterglass Edge', text: `Hits on a chilled target do +${TUNING.shatterDamage} damage`, tags: ['frost'], effect: 'shatter' },
  thermal: { name: 'Thermal Shock Core', text: `Hits on a target both burning and chilled do +${TUNING.thermalDamage} damage`, tags: ['burn', 'frost'], effect: 'thermal' },
  spotter: { name: 'Spotter Network', text: '+1 damage against a marked target', tags: ['mark'], effect: 'spotter' },
  hunt: { name: 'Eye of the Hunt', text: 'Crits mark the target', tags: ['crit', 'mark'], effect: 'exploit' },
  bloodforged: { name: 'Bloodforged Plate', text: 'A kill gives the hero 1 armor', tags: ['kill', 'ward'], effect: 'momentum' },
  rite: { name: 'Blood Rite', text: 'Each kill gives the hero +1 damage for the rest of the battle', tags: ['kill'], effect: 'bloodRite' },
  conductor: { name: 'Cryo Conductor', text: 'Chilling a marked target chills every alien beside it', tags: ['frost', 'mark'], effect: 'conductor' },
  kindling: { name: 'Kindling Plates', text: 'Whoever hits a hero who has armor left is set burning', tags: ['ward', 'burn'], effect: 'kindling' },
  overkill: { name: 'Overkill Coils', text: 'Damage beyond what a kill needs hits the nearest other alien', tags: ['kill', 'crit'], effect: 'overkill' },
  brittle: { name: 'Brittle Frost', text: 'Hits on a chilled target ignore its armor', tags: ['frost', 'ward'], effect: 'brittle' },
  pyre: { name: 'Pyre Censer', text: 'A burning alien sets its tile ablaze for 2 turns; an alien that ends its move in fire burns', tags: ['burn'], effect: 'pyre' },
  stasis: { name: 'Stasis Field', text: 'A crit on a chilled alien freezes it solid: it loses its next action', tags: ['frost', 'crit'], effect: 'stasis' },
  hex: { name: "Witch's Hex", text: 'When a marked alien dies, its mark passes to the nearest alien', tags: ['mark', 'kill'], effect: 'hex' },
  sentinel: { name: 'Sentinel Protocol', text: 'A hero shoots at once at an alien that walks away from beside it', effect: 'sentinel' },
  net: { name: "Hunter's Net", text: 'Hits on a rooted alien do +2 damage', effect: 'net' },
  glacial: { name: 'Glacial Snare', text: 'Chilling an alien roots it too', tags: ['frost'], effect: 'glacial' },
  juggernaut: { name: 'Juggernaut Servos', text: '+1 damage while the hero has armor left', tags: ['ward'], effect: 'armored' },
  // Entrances: each makes how the squad comes in matter more.
  encore: { name: 'Encore', text: 'Every battle offers one more entrance', effect: 'encore' },
  limelight: { name: 'Limelight', text: `Every battle offers Land and Monologue, and its taunt holds ${LIMELIGHT_ROUNDS} rounds longer`, effect: 'limelight' },
  charges: { name: 'Breaching Charges', text: `Every entrance blasts each alien within ${CHARGE_REACH} tiles for ${TUNING.impactDamage + CHARGE_BLAST}`, effect: 'entryBlast' },
  shredder: { name: 'Shredder Charges', text: `Every entrance strips the armor from each alien within ${CHARGE_REACH} tiles and hurts it`, tags: ['ward'], effect: 'entryShred' },
  cryo: { name: 'Cryo Charges', text: `Every entrance chills each alien within ${CHARGE_REACH} tiles and hurts it`, tags: ['frost'], effect: 'entryFrost' },
  bulwark: { name: 'Pop-up Barricades', text: 'A barricade springs up beside each hero as it comes in, toward the nearest alien', effect: 'entryWall' },
  turrets: { name: 'Turret Drop', text: 'A turret comes in with the squad: it never moves, and shoots far and true', effect: 'entryTurret' },
  // The goals.
  beacon: { name: 'Evac Beacon', text: `A hero gets a civilian out from ${BEACON_REACH} tiles away`, effect: 'beacon' },
  charity: { name: 'Refugee Network', text: 'Each civilian saved pays 1 more supply', civilianSupplies: 1 },
  relay: { name: 'Relay Booster', text: `The uplink's zone reaches ${RELAY_REACH} tiles farther`, effect: 'relay' },
  flare: { name: 'Signal Flare', text: 'A hero lifts off from farther from the extraction zone', effect: 'flare' },
  bounty: { name: 'Bounty Rounds', text: `Hits on a boss, a Guardian or the Hunter, do +${BOUNTY_DAMAGE} damage`, tags: ['kill'], effect: 'bounty' },
} satisfies Record<string, Relic>

export type RelicId = keyof typeof relics
export const RELICS: Record<RelicId, Relic> = relics

/** The relic each needs held before it is offered: the other charges need Breaching Charges. */
export const REQUIRES: Partial<Record<RelicId, RelicId>> = { shredder: 'charges', cryo: 'charges' }

/** Relics that may be offered to a squad holding `held`: those it lacks whose requirement it holds. */
export function offerable(held: RelicId[]): RelicId[] {
  return (Object.keys(RELICS) as RelicId[]).filter((id) => !held.includes(id) && (!REQUIRES[id] || held.includes(REQUIRES[id])))
}

/** Relics offered at a time. */
export const RELIC_OFFERS = 3
