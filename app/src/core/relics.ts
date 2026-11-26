// Relics: what each does, and which may be offered.
import { ADRENAL_FROM, ADRENAL_MAX, BRIDGE_FACTOR, THERMAL_FACTOR, BURN_STACKS, CATALYST_EVERY, FRACTURE_DAMAGE, GUARD_MAX, LODESTONE_REACH, MIGHT_MAX, PHOENIX_HEALTH, SHELL_MAX, STAGGER_DAMAGE, type RelicEffect, type Stats } from './battle'
import type { Rarity } from './base'
import { random } from './rng'
import { MOMENTUM_MAX } from './attack'
import { CHARGE_BLAST, CHARGE_REACH, ENCORE_REACH } from './landing'
import { BEACON_REACH, BOUNTY_DAMAGE, FLARE_REACH, RELAY_REACH } from './fighters'
import { TUNING } from './tuning'
import { CANCELS, feeds, type Cancel, type Flow, type Quantity } from './quantities'

/**
 * An artifact the hero keeps for the run, taken from three offered after a satellite, a hold or an ambush is won.
 * It changes the hero, or how the run pays; `text` says how.
 */
export interface Relic extends Flow {
  name: string
  text: string
  /** The cancellation it turns into a payoff. */
  bridge?: Cancel
  /** How seldom it is offered; rare unless set. */
  rarity?: Rarity
  /** Added to the hero's stats. */
  stats?: Partial<Stats>
  /** Given to the hero. */
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
  /** Supplies each STREAK_FIGHTS fights in a row won pay. */
  streak?: number
}

/** The fights in a row a clean streak pays after. */
export const STREAK_FIGHTS = 2
/** The battles Zenith Chronometer's come every. */
export const ZENITH_EVERY = 3

/** What each stack a payoff spends adds, in words. */
const SPENT = TUNING.spend.factor === 1 ? 'damage' : `${TUNING.spend.factor}× damage`

const relics = {
  plasma: { name: 'Plasma Core', text: 'Deal 1 more damage.', rarity: 'common', stats: { damage: 1 } },
  alloys: { name: 'Alien Alloys', text: 'Have 3 more Armor.', makes: ['armor'], rarity: 'common', stats: { armor: 3 } },
  servos: { name: 'Overclocked Servos', text: 'Have 1 more move.', rarity: 'common', stats: { move: 1 } },
  lens: { name: 'Focusing Lens', text: 'Have 1 more range and 10% more Crit chance.', makes: ['crit'], stats: { range: 1, crit: 0.1 } },
  glassCannon: { name: 'Glass Cannon Protocol', text: 'Deal 2 more damage. Have 3 less HP.', makes: ['overkill'], stats: { damage: 2, hp: -3 } },
  capacitor: { name: 'Kinetic Capacitor', text: 'First hit each battle Crits.', makes: ['crit'], rarity: 'common', effect: 'opener' },
  plating: { name: 'Adaptive Plating', text: 'Start of turn: regain 1 Armor.', makes: ['armor'], effect: 'rearm' },
  nanites: { name: 'Hunger Nanites', text: `On kill, heal 2, up to ${TUNING.healCap} each battle.`, reads: ['kill'], effect: 'feast' },
  phoenix: { name: 'Phoenix Protocol', text: `First fall each battle: get up with ${PHOENIX_HEALTH} HP.`, effect: 'phoenix' },
  echo: { name: 'Echo Chamber', text: 'Class abilities with limited uses gain 1 use.', charges: 1 },
  drones: { name: 'Scavenger Drones', text: 'Battles won pay 1 more supply.', supplies: 1 },
  contact: { name: 'Black Market Contact', text: 'Gear found is rare or better.', rareGear: true },
  uplink: { name: "Seer's Uplink", text: 'The flight map names the aliens at each stop.', recon: true },
  accelerant: { name: 'Accelerant Gel', text: `On hit with ${TUNING.spend.burns}+ Burn, Consume it: per Burn, deal ${SPENT} and gain 1 Temp HP. Half splashes to adjacent aliens.`, reads: ['burn'], rarity: 'epic', effect: 'accelerant' },
  wildfire: { name: 'Wildfire Spores', text: 'When a Burning alien dies, its Burn spreads to adjacent aliens.', reads: ['burn', 'kill'], makes: ['burn'], effect: 'wildfire' },
  salamander: { name: 'Salamander Sigil', text: `On Crit, apply ${BURN_STACKS} Burn.`, reads: ['crit'], makes: ['burn'], rarity: 'common', effect: 'ignite' },
  lattice: { name: 'Frost Lattice', text: 'On Crit, apply 1 Chill.', reads: ['crit'], makes: ['chill'], rarity: 'common', effect: 'freeze' },
  shatter: { name: 'Shatterglass Edge', text: `Displace a Chilled alien: deal ${BRIDGE_FACTOR}× damage per Chill. Frozen aliens stay Frozen.`, reads: ['moved', 'chill'], bridge: 'thaw', rarity: 'epic', effect: 'shatter' },
  thermal: { name: 'Thermal Shock Core', text: `Burn and Chill explode instead of Quench: deal ${THERMAL_FACTOR}× damage per stack. Half splashes to adjacent aliens.`, reads: ['burn', 'chill'], bridge: 'quench', rarity: 'epic', effect: 'thermal' },
  spotter: { name: 'Spotter Network', text: `On hit with ${TUNING.spend.marks}+ Mark, Consume it: deal ${SPENT} per Mark. Apply Weak. Half splashes to adjacent aliens.`, reads: ['mark'], effect: 'spotter' },
  hunt: { name: "Hunter's Eye", text: 'On Crit, apply 1 Mark.', reads: ['crit'], makes: ['mark'], rarity: 'common', effect: 'exploit' },
  bloodforged: { name: 'Bloodforged Plate', text: `On kill, gain 1 Armor, up to ${MOMENTUM_MAX}.`, reads: ['kill'], makes: ['armor'], effect: 'momentum' },
  rite: { name: 'Blood Rite', text: `On kill, gain 1 Might, up to ${MIGHT_MAX}.`, reads: ['kill'], makes: ['overkill'], effect: 'bloodRite' },
  impetus: { name: 'Kinetic Engine', text: 'Impact: deal your damage again.', reads: ['impact'], effect: 'impetus' },
  catalyst: { name: 'Catalyst Prism', text: `Every ${CATALYST_EVERY}rd hit doubles the target's Burn, Chill and Mark.`, reads: ['burn', 'chill', 'mark', 'shots'], rarity: 'epic', effect: 'catalyst' },
  chrono: { name: 'Chrono Coil', text: 'Every 3rd turn, double your attacks.', effect: 'chrono' },
  satchel: { name: 'Tactical Satchel', text: 'Draw 1 more card each turn.', effect: 'satchel' },
  zenith: { name: 'Zenith Chronometer', text: `Every ${ZENITH_EVERY}rd battle, your tier 4 skill has 2 uses.`, rarity: 'epic', effect: 'zenith' },
  streak: { name: 'Unbroken Line', text: `Every ${STREAK_FIGHTS}nd battle won in a row pays 3 more supplies.`, rarity: 'common', streak: 3 },
  fracture: { name: 'Frost Fracture', text: `When a Frozen alien dies, deal ${FRACTURE_DAMAGE} damage per Chill on it to adjacent aliens.`, reads: ['chill', 'kill'], rarity: 'epic', effect: 'fracture' },
  conductor: { name: 'Cryo Conductor', text: 'On hit on a Chilled alien, apply half its Chill to adjacent aliens.', reads: ['chill'], makes: ['chill'], effect: 'conductor' },
  kindling: { name: 'Kindling Plates', text: `When hit with Armor: apply ${BURN_STACKS} Burn to the attacker.`, reads: ['armor', 'hurt'], makes: ['burn'], effect: 'kindling' },
  overkill: { name: 'Overkill Coils', text: 'Overkill damage hits the nearest alien.', reads: ['overkill'], effect: 'overkill' },
  brittle: { name: 'Brittle Frost', text: 'Ignore Armor on Chilled aliens.', reads: ['chill'], effect: 'brittle' },
  pyre: { name: 'Pyre Censer', text: `Burning aliens set their tile on fire for 2 turns. Aliens on fire have at least ${BURN_STACKS} Burn.`, reads: ['burn', 'moved'], makes: ['burn'], effect: 'pyre' },
  hex: { name: "Witch's Hex", text: 'When an alien dies, its Burn, Chill and Mark pass to the nearest alien.', reads: ['kill', 'burn', 'chill', 'mark'], effect: 'hex' },
  domino: { name: 'Domino Rig', text: 'Impact on an alien: Knockback it 1 too.', reads: ['moved'], makes: ['impact'], effect: 'domino' },
  sentinel: { name: 'Sentinel Protocol', text: 'When an adjacent alien walks away, attack it.', effect: 'sentinel' },
  net: { name: "Hunter's Net", text: 'Deal 2 more damage to Rooted aliens.', reads: ['moved'], effect: 'net' },
  glacial: { name: 'Glacial Snare', text: 'Chill you apply also Roots.', reads: ['chill'], effect: 'glacial' },
  juggernaut: { name: 'Juggernaut Servos', text: 'With Armor, deal 1 more damage.', reads: ['armor'], effect: 'armored' },
  // Each makes where the hero lands matter more.
  encore: { name: 'Surprise Drop', text: `On landing, Surprise the nearest alien and aliens within ${ENCORE_REACH} tiles of it.`, effect: 'encore' },
  charges: { name: 'Breaching Charges', text: `On landing, deal ${TUNING.impactDamage + CHARGE_BLAST} damage to aliens within ${CHARGE_REACH} tiles.`, effect: 'entryBlast' },
  shredder: { name: 'Shredder Charges', text: `On landing, aliens within ${CHARGE_REACH} tiles lose their Armor and take ${TUNING.impactDamage} damage.`, effect: 'entryShred' },
  cryo: { name: 'Cryo Charges', text: `On landing, deal ${TUNING.impactDamage} damage to aliens within ${CHARGE_REACH} tiles. Apply 1 Chill.`, makes: ['chill'], effect: 'entryFrost' },
  bulwark: { name: 'Pop-up Barricades', text: 'On landing, raise an adjacent barricade toward the nearest alien.', effect: 'entryWall' },
  turrets: { name: 'Turret Drop', text: 'On landing, drop an adjacent turret. It never moves and has long range.', effect: 'entryTurret' },
  // The goals.
  beacon: { name: 'Evac Beacon', text: `Rescue civilians from ${BEACON_REACH} tiles away.`, effect: 'beacon' },
  charity: { name: 'Refugee Network', text: 'Civilians saved pay 1 more supply.', civilianSupplies: 1 },
  relay: { name: 'Relay Booster', text: `The uplink zone reaches ${RELAY_REACH} more tiles.`, effect: 'relay' },
  flare: { name: 'Signal Flare', text: `Lift off up to ${FLARE_REACH} tiles from the extraction zone.`, effect: 'flare' },
  bounty: { name: 'Bounty Sigil', text: `Deal ${BOUNTY_DAMAGE} more damage to bosses, Guardians and the Hunter.`, makes: ['overkill'], effect: 'bounty' },
  eternal: { name: 'Eternal Flame', text: 'Burn on aliens never fades.', reads: ['burn'], rarity: 'epic', effect: 'eternal' },
  frostHeart: { name: 'Permafrost Heart', text: 'Bosses can be Frozen. Frozen aliens keep their Chill.', reads: ['chill'], rarity: 'epic', effect: 'frostHeart' },
  ledger: { name: 'Dead Eye Ledger', text: 'Consuming Mark leaves it in place.', reads: ['mark'], rarity: 'epic', effect: 'ledger' },
  gravity: { name: 'Gravity Lens', text: 'First hit each attack: Knockback 1. A boss is Displaced instead.', makes: ['moved', 'impact'], rarity: 'epic', effect: 'gravity' },
  ironclad: { name: 'Ironclad Lattice', text: 'Double every Armor cap.', reads: ['armor'], rarity: 'epic', effect: 'ironclad' },
  split: { name: 'Split Rounds', text: 'Fire double the shots, each at half power.', reads: ['shots'], makes: ['shots'], rarity: 'epic', effect: 'split' },
  ram: { name: 'Ram Plating', text: 'Hits deal extra damage equal to your Armor, up to your damage.', reads: ['armor'], makes: ['overkill'], effect: 'ram' },
  overflow: { name: 'Overflow Capacitor', text: `Healing past full HP or its cap becomes Armor, up to ${GUARD_MAX} above base.`, makes: ['armor'], effect: 'overflow' },
  adrenal: { name: 'Adrenal Pump', text: `On your ${ADRENAL_FROM + 1}rd turn, gain ${ADRENAL_MAX} Might.`, makes: ['overkill'], effect: 'adrenal' },
  hairTrigger: { name: 'Hair Trigger', text: 'Weapons with 2 or more shots fire 1 more.', makes: ['shots'], rarity: 'common', effect: 'hairTrigger' },
  stagger: { name: 'Stagger Sights', text: `Deal ${STAGGER_DAMAGE} more damage to aliens Displaced since their last turn.`, reads: ['moved'], effect: 'stagger' },
  lodestone: { name: 'Lodestone Harness', text: `Start of turn: Pull the nearest alien within ${LODESTONE_REACH} tiles to adjacent.`, makes: ['moved', 'hurt'], effect: 'lodestone' },
  shell: { name: 'Reactive Shell', text: `First hit taken each round: gain 1 Armor, up to ${SHELL_MAX} above base.`, reads: ['hurt'], makes: ['armor'], rarity: 'common', effect: 'shell' },
  lockOn: { name: 'Lock-On Rig', text: `Displacing a Marked alien keeps its Mark: deal ${BRIDGE_FACTOR}× damage per Mark.`, reads: ['moved', 'mark'], bridge: 'unlock', rarity: 'epic', effect: 'lockOn' },
} satisfies Record<string, Relic>

export type RelicId = keyof typeof relics
export const RELICS: Record<RelicId, Relic> = relics

/** The relic each needs held before it is offered: the other charges need Breaching Charges. */
export const REQUIRES: Partial<Record<RelicId, RelicId>> = { shredder: 'charges', cryo: 'charges' }

/** Relics that may be offered to a hero holding `held`: those it lacks whose requirement it holds. */
export function offerable(held: readonly RelicId[]): RelicId[] {
  return (Object.keys(RELICS) as RelicId[]).filter((id) => !held.includes(id) && (!REQUIRES[id] || held.includes(REQUIRES[id])))
}

/** Relics offered at a time. */
export const RELIC_OFFERS = 3

/** How often each rarity is drawn against the others. */
const WEIGHT: Record<Rarity, number> = { common: 3, rare: 2, epic: 1 }

/** How much likelier a relic is drawn that reads what the hero makes or makes what it reads, so offers follow the build. */
export const FOCUS = 3

/** How much likelier a bridge is drawn once the hero makes both halves of its cancellation. */
export const BRIDGE_FOCUS = 4

/** Takes a relic out of `pool`, the commoner the likelier; one that feeds what the hero makes and reads FOCUS times likelier, a bridge it holds both halves of BRIDGE_FOCUS times. */
export function drawRelic(rng: { rng: number }, pool: RelicId[], made: readonly Quantity[] = [], read: readonly Quantity[] = []): RelicId {
  const weight = (id: RelicId) => WEIGHT[RELICS[id].rarity ?? 'rare'] * (bridged(id, made) ? BRIDGE_FOCUS : feeds(RELICS[id], made, read) ? FOCUS : 1)
  let roll = random(rng) * pool.reduce((sum, id) => sum + weight(id), 0)
  const i = Math.max(0, pool.findIndex((id) => (roll -= weight(id)) < 0))
  return pool.splice(i, 1)[0]
}

/** Whether `id` bridges a cancellation both of whose halves the hero makes. */
export const bridged = (id: RelicId, made: readonly Quantity[]) => {
  const bridge = RELICS[id].bridge
  return !!bridge && CANCELS[bridge].pair.every((q) => made.includes(q))
}
