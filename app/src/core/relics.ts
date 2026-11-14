// Relics: what each does, and which may be offered.
import { ADRENAL_FROM, ADRENAL_MAX, OVERKILL_FROM, BRIDGE_FACTOR, THERMAL_FACTOR, BURN_STACKS, CATALYST_EVERY, FRACTURE_DAMAGE, GUARD_MAX, LODESTONE_REACH, MIGHT_MAX, SHELL_MAX, STAGGER_DAMAGE, type RelicEffect, type Stats } from './battle'
import type { Rarity } from './base'
import { random } from './rng'
import { MOMENTUM_MAX } from './attack'
import { CHARGE_BLAST, CHARGE_REACH, ENCORE_REACH } from './landing'
import { BEACON_REACH } from './fighters'
import { BOUNTY_DAMAGE } from './fighters'
import { RELAY_REACH } from './fighters'
import { TUNING } from './tuning'
import { CANCELS, feeds, type Cancel, type Flow, type Quantity } from './quantities'

/**
 * An artifact the squad keeps for the run, taken from three offered after a satellite, a hold or an ambush is won.
 * It changes every hero, or how the run pays; `text` says how.
 */
export interface Relic extends Flow {
  name: string
  text: string
  /** The cancellation it turns into a payoff. */
  bridge?: Cancel
  /** How seldom it is offered; rare unless set. */
  rarity?: Rarity
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
  /** Whether a fight won with no boon charges the reservoir, which spends BOON_CHARGES to take a second boon in. */
  boons?: true
  /** Supplies each STREAK_FIGHTS fights in a row won with no hero down pay. */
  streak?: number
}

/** Charges a second boon costs, and the fights in a row a clean streak pays after. */
export const BOON_CHARGES = 3
export const STREAK_FIGHTS = 2
/** The battles Zenith Chronometer's come every. */
export const ZENITH_EVERY = 3

/** What each stack a payoff spends adds, in words. */
const SPENT = TUNING.spend.factor === 1 ? "the hero's damage" : `${100 * TUNING.spend.factor}% of the hero's damage`

const relics = {
  plasma: { name: 'Plasma Core', text: 'Every hero does +1 damage', rarity: 'common', stats: { damage: 1 } },
  alloys: { name: 'Alien Alloys', text: 'Every hero has +3 armor', makes: ['armor'], rarity: 'common', stats: { armor: 3 } },
  servos: { name: 'Overclocked Servos', text: 'Every hero has +1 move', rarity: 'common', stats: { move: 1 } },
  lens: { name: 'Focusing Lens', text: 'Every hero has +1 range and +10% crit', makes: ['crit'], stats: { range: 1, crit: 0.1 } },
  glassCannon: { name: 'Glass Cannon Protocol', text: 'Every hero does +2 damage and has 3 less HP', makes: ['overkill'], stats: { damage: 2, hp: -3 } },
  capacitor: { name: 'Kinetic Capacitor', text: "Each hero's first hit of a battle is a crit", makes: ['crit'], rarity: 'common', effect: 'opener' },
  plating: { name: 'Adaptive Plating', text: 'Each hero regrows 1 armor at the start of its turn', makes: ['armor'], effect: 'rearm' },
  nanites: { name: 'Hunger Nanites', text: `A hero who kills heals 2, up to ${TUNING.healCap} a battle`, reads: ['kill'], effect: 'feast' },
  phoenix: { name: 'Phoenix Protocol', text: '1/battle: the first hero to fall gets up with 5 HP', effect: 'phoenix' },
  echo: { name: 'Echo Chamber', text: 'Every class ability with limited uses has one more', charges: 1 },
  drones: { name: 'Scavenger Drones', text: 'Each won battle pays 1 more supply', supplies: 1 },
  contact: { name: 'Black Market Contact', text: 'Every piece of gear found is rare or better', rareGear: true },
  uplink: { name: "Seer's Uplink", text: 'The flight map names the aliens of each stop, not only how dangerous they are', recon: true },
  accelerant: { name: 'Accelerant Gel', text: `Hits on a target with ${TUNING.spend.burns} or more burn spend it: +${SPENT} a stack to it, half that to each alien beside it; the hero gains a temp HP a stack`, reads: ['burn'], rarity: 'epic', effect: 'accelerant' },
  wildfire: { name: 'Wildfire Spores', text: 'An alien that dies burning gives its burn to every alien beside it', reads: ['burn', 'kill'], makes: ['burn'], effect: 'wildfire' },
  salamander: { name: 'Salamander Sigil', text: `Crits add ${BURN_STACKS} burn stacks to the target`, reads: ['crit'], makes: ['burn'], rarity: 'common', effect: 'ignite' },
  lattice: { name: 'Frost Lattice', text: 'Crits add a chill stack to the target', reads: ['crit'], makes: ['chill'], rarity: 'common', effect: 'freeze' },
  shatter: { name: 'Shatterglass Edge', text: `Moving a chilled alien shatters it: ${BRIDGE_FACTOR} times the hero's damage for each chill stack on it; a frozen one stays frozen`, reads: ['moved', 'chill'], bridge: 'thaw', rarity: 'epic', effect: 'shatter' },
  thermal: { name: 'Thermal Shock Core', text: `Burn meeting chill on an alien detonates in place of cancelling: ${THERMAL_FACTOR} times the hero's damage for each stack of both, to it, and half that to each alien beside it`, reads: ['burn', 'chill'], bridge: 'quench', rarity: 'epic', effect: 'thermal' },
  spotter: { name: 'Spotter Network', text: `Hits on a target with ${TUNING.spend.marks} or more marks spend them: +${SPENT} a mark to it, half that to each alien beside it; the target is weakened`, reads: ['mark'], effect: 'spotter' },
  hunt: { name: 'Eye of the Hunt', text: 'Crits add a mark to the target', reads: ['crit'], makes: ['mark'], rarity: 'common', effect: 'exploit' },
  bloodforged: { name: 'Bloodforged Plate', text: `A kill gives the hero 1 armor, up to ${MOMENTUM_MAX}`, reads: ['kill'], makes: ['armor'], effect: 'momentum' },
  rite: { name: 'Blood Rite', text: `Each kill gives the hero 1 Might, to at most ${MIGHT_MAX}`, reads: ['kill'], makes: ['overkill'], effect: 'bloodRite' },
  impetus: { name: 'Kinetic Engine', text: "An alien a hero knocks into something or off a ledge takes the hero's damage again", reads: ['impact'], effect: 'impetus' },
  catalyst: { name: 'Catalyst Prism', text: `Every ${CATALYST_EVERY}rd hit a hero lands doubles the burn, chill and marks on its target`, reads: ['burn', 'chill', 'mark', 'shots'], rarity: 'epic', effect: 'catalyst' },
  chrono: { name: 'Chrono Coil', text: 'Every 3rd turn, the hardest-hitting hero attacks twice over', effect: 'chrono' },
  reservoir: { name: 'Boon Reservoir', text: `Each fight won with no boon adds a charge; at the deploy screen, ${BOON_CHARGES} charges take a second boon in`, boons: true },
  zenith: { name: 'Zenith Chronometer', text: `Every ${ZENITH_EVERY}rd battle, each hero's tier 4 fires twice`, rarity: 'epic', effect: 'zenith' },
  streak: { name: 'Unbroken Line', text: `Every ${STREAK_FIGHTS} fights in a row won with no hero down pay 3 more supplies`, rarity: 'common', streak: 3 },
  fracture: { name: 'Frost Fracture', text: `A frozen alien that dies shatters: ${FRACTURE_DAMAGE} damage for each chill stack on it to every alien beside it`, reads: ['chill', 'kill'], rarity: 'epic', effect: 'fracture' },
  conductor: { name: 'Cryo Conductor', text: 'Hits on a chilled target give half its chill to every alien beside it', reads: ['chill'], makes: ['chill'], effect: 'conductor' },
  kindling: { name: 'Kindling Plates', text: `Whoever hits a hero who has armor left takes ${BURN_STACKS} burn stacks`, reads: ['armor', 'hurt'], makes: ['burn'], effect: 'kindling' },
  overkill: { name: 'Overkill Coils', text: `A hit's damage past ${OVERKILL_FROM} also hits the nearest other alien`, reads: ['overkill'], effect: 'overkill' },
  brittle: { name: 'Brittle Frost', text: 'Hits on a chilled target ignore its armor', reads: ['chill'], effect: 'brittle' },
  pyre: { name: 'Pyre Censer', text: `A burning alien sets its tile ablaze for 2 turns; an alien that ends its move in fire, or is driven onto it, has at least ${BURN_STACKS} burn stacks`, reads: ['burn', 'moved'], makes: ['burn'], effect: 'pyre' },
  hex: { name: "Witch's Hex", text: 'An alien that dies passes its burn, chill and marks to the nearest alien', reads: ['kill', 'burn', 'chill', 'mark'], effect: 'hex' },
  domino: { name: 'Domino Rig', text: 'An alien knocked into another alien knocks that one back too', reads: ['moved'], makes: ['impact'], effect: 'domino' },
  sentinel: { name: 'Sentinel Protocol', text: 'A hero attacks at once an alien that walks away from beside it', effect: 'sentinel' },
  net: { name: "Hunter's Net", text: 'Hits on a rooted alien do +2 damage', reads: ['moved'], effect: 'net' },
  glacial: { name: 'Glacial Snare', text: 'Chilling an alien roots it too', reads: ['chill'], effect: 'glacial' },
  juggernaut: { name: 'Juggernaut Servos', text: '+1 damage while the hero has armor left', reads: ['armor'], effect: 'armored' },
  // Each makes where the squad lands matter more.
  encore: { name: 'Encore', text: `Every landing catches the aliens within ${ENCORE_REACH} tiles of the nearest surprised, holding their fire on their first turn`, effect: 'encore' },
  charges: { name: 'Breaching Charges', text: `Every landing blasts each alien within ${CHARGE_REACH} tiles for ${TUNING.impactDamage + CHARGE_BLAST}`, effect: 'entryBlast' },
  shredder: { name: 'Shredder Charges', text: `Every landing strips the armor from each alien within ${CHARGE_REACH} tiles and hurts it`, effect: 'entryShred' },
  cryo: { name: 'Cryo Charges', text: `Every landing chills each alien within ${CHARGE_REACH} tiles and hurts it`, makes: ['chill'], effect: 'entryFrost' },
  bulwark: { name: 'Pop-up Barricades', text: 'A barricade springs up beside each hero as it comes in, toward the nearest alien', effect: 'entryWall' },
  turrets: { name: 'Turret Drop', text: 'A turret comes in with the party: it never moves, and attacks far and true', effect: 'entryTurret' },
  // The goals.
  beacon: { name: 'Evac Beacon', text: `A hero gets a civilian out from ${BEACON_REACH} tiles away`, effect: 'beacon' },
  charity: { name: 'Refugee Network', text: 'Each civilian saved pays 1 more supply', civilianSupplies: 1 },
  relay: { name: 'Relay Booster', text: `The uplink's zone reaches ${RELAY_REACH} tiles farther`, effect: 'relay' },
  flare: { name: 'Signal Flare', text: 'A hero lifts off from farther from the extraction zone', effect: 'flare' },
  bounty: { name: 'Bounty Sigil', text: `Hits on a boss, a Guardian or the Hunter, do +${BOUNTY_DAMAGE} damage`, makes: ['overkill'], effect: 'bounty' },
  eternal: { name: 'Eternal Flame', text: 'Burn never fades: a burning alien keeps its stacks', reads: ['burn'], rarity: 'epic', effect: 'eternal' },
  frostHeart: { name: 'Permafrost Heart', text: 'Bosses freeze too, and a frozen alien keeps its chill', reads: ['chill'], rarity: 'epic', effect: 'frostHeart' },
  ledger: { name: 'Dead Eye Ledger', text: 'Payoffs read marks without spending them', reads: ['mark'], rarity: 'epic', effect: 'ledger' },
  gravity: { name: 'Gravity Lens', text: "Each hero's first hit of an attack knocks its target back a tile; a boss reels in place, counting as moved", makes: ['moved', 'impact'], rarity: 'epic', effect: 'gravity' },
  ironclad: { name: 'Ironclad Lattice', text: 'Whatever builds armor builds it twice as high', reads: ['armor'], rarity: 'epic', effect: 'ironclad' },
  split: { name: 'Split Rounds', text: 'Every attack fires twice the shots, each at half power', reads: ['shots'], makes: ['shots'], rarity: 'epic', effect: 'split' },
  ram: { name: 'Ram Plating', text: "Every hit does the hero's armor more, up to its damage", reads: ['armor'], makes: ['overkill'], effect: 'ram' },
  overflow: { name: 'Overflow Capacitor', text: `Healing past full health, or past its cap, becomes armor, up to ${GUARD_MAX} past the hero's own`, makes: ['armor'], effect: 'overflow' },
  adrenal: { name: 'Adrenal Pump', text: `On its ${ADRENAL_FROM + 1}rd turn, each hero gains ${ADRENAL_MAX} Might`, makes: ['overkill'], effect: 'adrenal' },
  hairTrigger: { name: 'Hair Trigger', text: 'A weapon of 2 or more shots fires one more', makes: ['shots'], rarity: 'common', effect: 'hairTrigger' },
  stagger: { name: 'Stagger Sights', text: `Hits on an alien knocked back, pulled or slid since its last turn do +${STAGGER_DAMAGE} damage`, reads: ['moved'], effect: 'stagger' },
  lodestone: { name: 'Lodestone Harness', text: `As each turn begins, the hero with the most armor pulls the nearest alien within ${LODESTONE_REACH} tiles to beside it`, makes: ['moved', 'hurt'], effect: 'lodestone' },
  shell: { name: 'Reactive Shell', text: `The first hit a hero takes each round gives it 1 armor, up to ${SHELL_MAX} past its own`, reads: ['hurt'], makes: ['armor'], rarity: 'common', effect: 'shell' },
  lockOn: { name: 'Lock-On Rig', text: `Moving a marked alien keeps its marks, and it takes ${BRIDGE_FACTOR} times the hero's damage for each`, reads: ['moved', 'mark'], bridge: 'unlock', rarity: 'epic', effect: 'lockOn' },
} satisfies Record<string, Relic>

export type RelicId = keyof typeof relics
export const RELICS: Record<RelicId, Relic> = relics

/** The relic each needs held before it is offered: the other charges need Breaching Charges. */
export const REQUIRES: Partial<Record<RelicId, RelicId>> = { shredder: 'charges', cryo: 'charges' }

/** Relics that may be offered to a squad holding `held`: those it lacks whose requirement it holds. */
export function offerable(held: readonly RelicId[]): RelicId[] {
  return (Object.keys(RELICS) as RelicId[]).filter((id) => !held.includes(id) && (!REQUIRES[id] || held.includes(REQUIRES[id])))
}

/** Relics offered at a time. */
export const RELIC_OFFERS = 3

/** How often each rarity is drawn against the others. */
const WEIGHT: Record<Rarity, number> = { common: 3, rare: 2, epic: 1 }

/** How much likelier a relic is drawn that reads what the squad makes or makes what it reads, so offers follow the build. */
export const FOCUS = 3

/** How much likelier a bridge is drawn once the squad makes both halves of its cancellation. */
export const BRIDGE_FOCUS = 4

/** Takes a relic out of `pool`, the commoner the likelier; one that feeds what the squad makes and reads FOCUS times likelier, a bridge it holds both halves of BRIDGE_FOCUS times. */
export function drawRelic(rng: { rng: number }, pool: RelicId[], made: readonly Quantity[] = [], read: readonly Quantity[] = []): RelicId {
  const weight = (id: RelicId) => WEIGHT[RELICS[id].rarity ?? 'rare'] * (bridged(id, made) ? BRIDGE_FOCUS : feeds(RELICS[id], made, read) ? FOCUS : 1)
  let roll = random(rng) * pool.reduce((sum, id) => sum + weight(id), 0)
  const i = Math.max(0, pool.findIndex((id) => (roll -= weight(id)) < 0))
  return pool.splice(i, 1)[0]
}

/** Whether `id` bridges a cancellation both of whose halves the squad makes. */
export const bridged = (id: RelicId, made: readonly Quantity[]) => {
  const bridge = RELICS[id].bridge
  return !!bridge && CANCELS[bridge].pair.every((q) => made.includes(q))
}
