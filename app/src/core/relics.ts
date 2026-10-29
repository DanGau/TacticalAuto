import { POD_BLAST, POD_REACH, type RelicEffect, type Stats } from './battle'
import { BEACON_REACH, BOUNTY_DAMAGE, KILLZONE, RELAY_REACH } from './combat'
import { TUNING } from './tuning'
import type { Keyword } from './keywords'

/**
 * An artifact the squad keeps for the run, taken from three offered after a satellite, a hold or an escape is won.
 * It changes every soldier, or how the run pays; `text` says how.
 */
export interface Relic {
  name: string
  text: string
  tags?: Keyword[]
  /** Added to every soldier's stats. */
  stats?: Partial<Stats>
  /** Given to every soldier. */
  effect?: RelicEffect
  /** Added to the uses of every class ability that has uses. */
  charges?: number
  /** Added to the supplies each won battle pays. */
  supplies?: number
  /** Whether every piece of gear found is rare or better. */
  rareGear?: boolean
  /** Whether the map names the aliens of each zone, not only how dangerous they are. */
  recon?: boolean
  /** Added to the supplies each civilian saved pays. */
  civilianSupplies?: number
}

const relics = {
  plasma: { name: 'Plasma Rifles', text: 'Every soldier does +1 damage', stats: { damage: 1 } },
  alloys: { name: 'Alien Alloys', text: 'Every soldier has +3 armor', tags: ['ward'], stats: { armor: 3 } },
  servos: { name: 'Overclocked Servos', text: 'Every soldier has +1 move', stats: { move: 1 } },
  lens: { name: 'Focusing Lens', text: 'Every soldier has +1 range and +10% crit', tags: ['crit'], stats: { range: 1, crit: 0.1 } },
  glassCannon: { name: 'Glass Cannon Protocol', text: 'Every soldier does +2 damage and has 3 less health', stats: { damage: 2, hp: -3 } },
  capacitor: { name: 'Kinetic Capacitor', text: "Each soldier's first hit of a battle is a crit", tags: ['crit'], effect: 'opener' },
  plating: { name: 'Adaptive Plating', text: 'Each soldier regrows 1 armor at the start of its turn', tags: ['ward'], effect: 'rearm' },
  nanites: { name: 'Hunger Nanites', text: 'A soldier who kills heals 2', tags: ['kill'], effect: 'feast' },
  phoenix: { name: 'Phoenix Protocol', text: 'Once per battle, the first soldier to fall gets up with 5 health', effect: 'phoenix' },
  echo: { name: 'Echo Chamber', text: 'Every class ability with limited uses has one more', charges: 1 },
  drones: { name: 'Scavenger Drones', text: 'Each won battle pays 1 more supply', supplies: 1 },
  contact: { name: 'Black Market Contact', text: 'Every piece of gear found is rare or better', rareGear: true },
  uplink: { name: 'Recon Uplink', text: 'The map names the aliens of each zone, not only how dangerous they are', recon: true },
  accelerant: { name: 'Accelerant Gel', text: `Hits on a burning target do +${TUNING.accelerantDamage} damage`, tags: ['burn'], effect: 'accelerant' },
  wildfire: { name: 'Wildfire Spores', text: 'An alien that dies burning sets every alien beside it burning', tags: ['burn', 'kill'], effect: 'wildfire' },
  salamander: { name: 'Salamander Sigil', text: 'Crits set the target burning', tags: ['crit', 'burn'], effect: 'ignite' },
  lattice: { name: 'Frost Lattice', text: 'Crits chill the target', tags: ['crit', 'frost'], effect: 'freeze' },
  shatter: { name: 'Shatterglass Edge', text: `Hits on a chilled target do +${TUNING.shatterDamage} damage`, tags: ['frost'], effect: 'shatter' },
  thermal: { name: 'Thermal Shock Core', text: `Hits on a target both burning and chilled do +${TUNING.thermalDamage} damage`, tags: ['burn', 'frost'], effect: 'thermal' },
  spotter: { name: 'Spotter Network', text: '+15% aim against a marked target', tags: ['mark'], effect: 'spotter' },
  hunt: { name: 'Eye of the Hunt', text: 'Crits mark the target', tags: ['crit', 'mark'], effect: 'exploit' },
  bloodforged: { name: 'Bloodforged Plate', text: 'A kill gives the soldier 1 armor', tags: ['kill', 'ward'], effect: 'momentum' },
  rite: { name: 'Blood Rite', text: 'Each kill gives the soldier +1 damage for the rest of the battle', tags: ['kill'], effect: 'bloodRite' },
  conductor: { name: 'Cryo Conductor', text: 'Chilling a marked target chills every alien beside it', tags: ['frost', 'mark'], effect: 'conductor' },
  kindling: { name: 'Kindling Plates', text: 'Whoever hits a soldier who has armor left is set burning', tags: ['ward', 'burn'], effect: 'kindling' },
  overkill: { name: 'Overkill Coils', text: 'Damage beyond what a kill needs hits the nearest other alien', tags: ['kill', 'crit'], effect: 'overkill' },
  brittle: { name: 'Brittle Frost', text: 'Hits on a chilled target ignore its armor', tags: ['frost', 'ward'], effect: 'brittle' },
  pyre: { name: 'Pyre Censer', text: 'A burning alien sets its tile ablaze for 2 turns; an alien that ends its move in fire burns', tags: ['burn'], effect: 'pyre' },
  stasis: { name: 'Stasis Field', text: 'A crit on a chilled alien freezes it solid: it loses its next action', tags: ['frost', 'crit'], effect: 'stasis' },
  hex: { name: "Witch's Hex", text: 'When a marked alien dies, its mark passes to the nearest alien', tags: ['mark', 'kill'], effect: 'hex' },
  sentinel: { name: 'Sentinel Protocol', text: 'A soldier shoots at once at an alien that walks away from beside it', effect: 'sentinel' },
  net: { name: "Hunter's Net", text: 'Hits on a rooted alien do +2 damage', effect: 'net' },
  glacial: { name: 'Glacial Snare', text: 'Chilling an alien roots it too', tags: ['frost'], effect: 'glacial' },
  juggernaut: { name: 'Juggernaut Servos', text: '+1 damage while the soldier has armor left', tags: ['ward'], effect: 'armored' },
  // The drop pods: each makes where the squad lands matter more.
  impact: { name: 'Impact Charges', text: `Every landing's drop pods hurt each alien within ${POD_REACH} tiles for ${TUNING.impactDamage + POD_BLAST}`, effect: 'podBlast' },
  shredder: { name: 'Shredder Pods', text: `Every landing's drop pods strip the armor from each alien within ${POD_REACH} tiles and hurt it`, tags: ['ward'], effect: 'podShred' },
  cryopods: { name: 'Cryo Pods', text: `Every landing's drop pods chill each alien within ${POD_REACH} tiles and hurt it`, tags: ['frost'], effect: 'podFrost' },
  bulwark: { name: 'Bulwark Pods', text: 'The drop pods stand as full cover beside each soldier, toward the nearest alien', effect: 'podWall' },
  turrets: { name: 'Turret Drop', text: 'A turret lands with each team: it never moves, and shoots far and true', effect: 'podTurret' },
  // Stealth and ambushes.
  ghost: { name: 'Ghost Weave', text: 'Unseen, soldiers move at full pace instead of creeping', effect: 'ghost' },
  killzone: { name: 'Killing Ground', text: `An ambush's shots hit and crit ${Math.round(100 * KILLZONE)}% more often still`, tags: ['crit'], effect: 'killzone' },
  // The goals.
  beacon: { name: 'Evac Beacon', text: `A soldier gets a civilian out from ${BEACON_REACH} tiles away`, effect: 'beacon' },
  charity: { name: 'Refugee Network', text: 'Each civilian saved pays 1 more supply', civilianSupplies: 1 },
  relay: { name: 'Relay Booster', text: `The uplink's zone reaches ${RELAY_REACH} tiles farther`, effect: 'relay' },
  flare: { name: 'Signal Flare', text: 'A soldier lifts off from farther from the escape zone', effect: 'flare' },
  bounty: { name: 'Bounty Rounds', text: `Hits on a boss, a Guardian or the Hunter, do +${BOUNTY_DAMAGE} damage`, tags: ['kill'], effect: 'bounty' },
} satisfies Record<string, Relic>

export type RelicId = keyof typeof relics
export const RELICS: Record<RelicId, Relic> = relics

/** Relics offered at a time. */
export const RELIC_OFFERS = 3
