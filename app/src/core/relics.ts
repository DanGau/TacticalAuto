// Relics: what each does, and which may be offered.
import { BURN_STACKS, FRACTURE_DAMAGE, MIGHT_MAX, type RelicEffect, type Stats } from './battle'
import type { Rarity } from './base'
import { random } from './rng'
import { MOMENTUM_MAX } from './attack'
import { CHARGE_BLAST, CHARGE_REACH, ENCORE_REACH } from './landing'
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
  /** The keywords it spends or spreads, so pays only beside a cause of them. */
  pays?: Keyword[]
  /** How seldom it is offered: a feeder common, a payoff or engine epic; rare unless set. */
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
/** The most Might Adrenal Pump gives a hero a battle. */
export const ADRENAL_MAX = 4
/** Catalyst Prism's every-Nth hit. */
export const CATALYST_EVERY = 3

const relics = {
  plasma: { name: 'Plasma Core', text: 'Every hero does +1 damage', rarity: 'common', stats: { damage: 1 } },
  alloys: { name: 'Alien Alloys', text: 'Every hero has +3 armor', tags: ['ward'], rarity: 'common', stats: { armor: 3 } },
  servos: { name: 'Overclocked Servos', text: 'Every hero has +1 move', rarity: 'common', stats: { move: 1 } },
  lens: { name: 'Focusing Lens', text: 'Every hero has +1 range and +10% crit', tags: ['crit'], stats: { range: 1, crit: 0.1 } },
  glassCannon: { name: 'Glass Cannon Protocol', text: 'Every hero does +2 damage and has 3 less HP', stats: { damage: 2, hp: -3 } },
  capacitor: { name: 'Kinetic Capacitor', text: "Each hero's first hit of a battle is a crit", tags: ['crit'], rarity: 'common', effect: 'opener' },
  plating: { name: 'Adaptive Plating', text: 'Each hero regrows 1 armor at the start of its turn', tags: ['ward'], effect: 'rearm' },
  nanites: { name: 'Hunger Nanites', text: `A hero who kills heals 2, up to ${TUNING.healCap} a battle`, tags: ['kill'], effect: 'feast' },
  phoenix: { name: 'Phoenix Protocol', text: '1/battle: the first hero to fall gets up with 5 HP', effect: 'phoenix' },
  echo: { name: 'Echo Chamber', text: 'Every class ability with limited uses has one more', charges: 1 },
  drones: { name: 'Scavenger Drones', text: 'Each won battle pays 1 more supply', supplies: 1 },
  contact: { name: 'Black Market Contact', text: 'Every piece of gear found is rare or better', rareGear: true },
  uplink: { name: "Seer's Uplink", text: 'The flight map names the aliens of each stop, not only how dangerous they are', recon: true },
  accelerant: { name: 'Accelerant Gel', text: `Hits on a target with ${TUNING.spend.burns} or more burn spend it: +${100 * TUNING.spend.factor}% of the hero's damage a stack, to it and every alien beside it, and as much temp HP`, tags: ['burn'], pays: ['burn'], rarity: 'epic', effect: 'accelerant' },
  wildfire: { name: 'Wildfire Spores', text: 'An alien that dies burning gives its burn to every alien beside it', tags: ['burn', 'kill'], pays: ['burn'], effect: 'wildfire' },
  salamander: { name: 'Salamander Sigil', text: `Crits add ${BURN_STACKS} burn stacks to the target`, tags: ['crit', 'burn'], rarity: 'common', effect: 'ignite' },
  lattice: { name: 'Frost Lattice', text: 'Crits add a chill stack to the target', tags: ['crit', 'frost'], rarity: 'common', effect: 'freeze' },
  shatter: { name: 'Shatterglass Edge', text: `Hits on a target with ${TUNING.spend.chills} or more chill spend it: +${100 * TUNING.spend.factor}% of the hero's damage a stack, to it and every alien beside it; the target is stunned, a boss weakened`, tags: ['frost'], pays: ['frost'], effect: 'shatter' },
  thermal: { name: 'Thermal Shock Core', text: `Hits on a target both burning and chilled spend both: +${100 * TUNING.spend.factor}% of the hero's damage a stack, to it and every alien beside it, as much temp HP, and a stun`, tags: ['burn', 'frost'], pays: ['burn', 'frost'], effect: 'thermal' },
  spotter: { name: 'Spotter Network', text: `Hits on a target with ${TUNING.spend.marks} or more marks spend them: +${100 * TUNING.spend.factor}% of the hero's damage a mark, to it and every alien beside it; the target is weakened`, tags: ['mark'], pays: ['mark'], effect: 'spotter' },
  hunt: { name: 'Eye of the Hunt', text: 'Crits add a mark to the target', tags: ['crit', 'mark'], rarity: 'common', effect: 'exploit' },
  bloodforged: { name: 'Bloodforged Plate', text: `A kill gives the hero 1 armor, up to ${MOMENTUM_MAX}`, tags: ['kill', 'ward'], effect: 'momentum' },
  rite: { name: 'Blood Rite', text: `Each kill gives the hero 1 Might, to at most ${MIGHT_MAX}`, tags: ['kill', 'might'], effect: 'bloodRite' },
  impetus: { name: 'Kinetic Engine', text: "An alien a hero knocks into something or off a ledge takes the hero's damage again", tags: ['force'], pays: ['force'], effect: 'impetus' },
  catalyst: { name: 'Catalyst Prism', text: `Every ${CATALYST_EVERY}rd hit a hero lands doubles the burn, chill and marks on its target`, tags: ['burn', 'frost', 'mark'], pays: ['burn', 'frost', 'mark'], rarity: 'epic', effect: 'catalyst' },
  chrono: { name: 'Chrono Coil', text: 'Every 3rd turn, the hardest-hitting hero attacks twice over', effect: 'chrono' },
  reservoir: { name: 'Boon Reservoir', text: `Each fight won with no boon adds a charge; at the deploy screen, ${BOON_CHARGES} charges take a second boon in`, boons: true },
  zenith: { name: 'Zenith Chronometer', text: `Every ${ZENITH_EVERY}rd battle, each hero's tier 4 fires twice`, rarity: 'epic', effect: 'zenith' },
  streak: { name: 'Unbroken Line', text: `Every ${STREAK_FIGHTS} fights in a row won with no hero down pay 3 more supplies`, rarity: 'common', streak: 3 },
  fracture: { name: 'Frost Fracture', text: `A frozen alien that dies shatters: ${FRACTURE_DAMAGE} damage for each chill stack on it to every alien beside it`, tags: ['frost', 'kill'], pays: ['frost'], rarity: 'epic', effect: 'fracture' },
  conductor: { name: 'Cryo Conductor', text: 'Hits on a chilled target give half its chill to every alien beside it', tags: ['frost'], pays: ['frost'], effect: 'conductor' },
  kindling: { name: 'Kindling Plates', text: `Whoever hits a hero who has armor left takes ${BURN_STACKS} burn stacks`, tags: ['ward', 'burn'], effect: 'kindling' },
  overkill: { name: 'Overkill Coils', text: 'Damage beyond what a kill needs hits the nearest other alien', tags: ['kill', 'crit'], effect: 'overkill' },
  brittle: { name: 'Brittle Frost', text: 'Hits on a chilled target ignore its armor', tags: ['frost', 'ward'], pays: ['frost'], effect: 'brittle' },
  pyre: { name: 'Pyre Censer', text: `A burning alien sets its tile ablaze for 2 turns; an alien that ends its move in fire has at least ${BURN_STACKS} burn stacks`, tags: ['burn'], effect: 'pyre' },
  hex: { name: "Witch's Hex", text: 'An alien that dies passes its burn, chill and marks to the nearest alien', tags: ['burn', 'frost', 'mark'], pays: ['burn', 'frost', 'mark'], effect: 'hex' },
  domino: { name: 'Domino Rig', text: 'An alien knocked into another alien knocks that one back too', tags: ['force'], pays: ['force'], effect: 'domino' },
  sentinel: { name: 'Sentinel Protocol', text: 'A hero attacks at once an alien that walks away from beside it', effect: 'sentinel' },
  net: { name: "Hunter's Net", text: 'Hits on a rooted alien do +2 damage', effect: 'net' },
  glacial: { name: 'Glacial Snare', text: 'Chilling an alien roots it too', tags: ['frost'], effect: 'glacial' },
  juggernaut: { name: 'Juggernaut Servos', text: '+1 damage while the hero has armor left', tags: ['ward'], effect: 'armored' },
  // Each makes where the squad lands matter more.
  encore: { name: 'Encore', text: `Every landing catches the aliens within ${ENCORE_REACH} tiles of the nearest surprised, holding their fire on their first turn`, effect: 'encore' },
  charges: { name: 'Breaching Charges', text: `Every landing blasts each alien within ${CHARGE_REACH} tiles for ${TUNING.impactDamage + CHARGE_BLAST}`, effect: 'entryBlast' },
  shredder: { name: 'Shredder Charges', text: `Every landing strips the armor from each alien within ${CHARGE_REACH} tiles and hurts it`, tags: ['ward'], effect: 'entryShred' },
  cryo: { name: 'Cryo Charges', text: `Every landing chills each alien within ${CHARGE_REACH} tiles and hurts it`, tags: ['frost'], effect: 'entryFrost' },
  bulwark: { name: 'Pop-up Barricades', text: 'A barricade springs up beside each hero as it comes in, toward the nearest alien', effect: 'entryWall' },
  turrets: { name: 'Turret Drop', text: 'A turret comes in with the party: it never moves, and attacks far and true', effect: 'entryTurret' },
  // The goals.
  beacon: { name: 'Evac Beacon', text: `A hero gets a civilian out from ${BEACON_REACH} tiles away`, effect: 'beacon' },
  charity: { name: 'Refugee Network', text: 'Each civilian saved pays 1 more supply', civilianSupplies: 1 },
  relay: { name: 'Relay Booster', text: `The uplink's zone reaches ${RELAY_REACH} tiles farther`, effect: 'relay' },
  flare: { name: 'Signal Flare', text: 'A hero lifts off from farther from the extraction zone', effect: 'flare' },
  bounty: { name: 'Bounty Sigil', text: `Hits on a boss, a Guardian or the Hunter, do +${BOUNTY_DAMAGE} damage`, tags: ['kill'], effect: 'bounty' },
  eternal: { name: 'Eternal Flame', text: 'Burn never fades: a burning alien keeps its stacks', tags: ['burn'], pays: ['burn'], rarity: 'epic', effect: 'eternal' },
  frostHeart: { name: 'Permafrost Heart', text: 'Bosses freeze too, and a frozen alien keeps its chill', tags: ['frost'], pays: ['frost'], rarity: 'epic', effect: 'frostHeart' },
  ledger: { name: 'Dead Eye Ledger', text: 'Payoffs read marks without spending them', tags: ['mark'], pays: ['mark'], rarity: 'epic', effect: 'ledger' },
  gravity: { name: 'Gravity Lens', text: 'Every shot of a knockback weapon knocks back, not only the first', tags: ['force'], pays: ['force'], rarity: 'epic', effect: 'gravity' },
  ironclad: { name: 'Ironclad Lattice', text: 'Whatever builds armor builds it twice as high', tags: ['ward'], pays: ['ward'], rarity: 'epic', effect: 'ironclad' },
  split: { name: 'Split Rounds', text: 'Every attack fires twice the shots, each at half power', tags: ['volley'], pays: ['volley'], rarity: 'epic', effect: 'split' },
  ram: { name: 'Ram Plating', text: "Every hit does half the hero's armor more", tags: ['ward'], pays: ['ward'], effect: 'ram' },
  overflow: { name: 'Overflow Capacitor', text: "Healing past full health, or past its cap, becomes armor, up to twice the hero's own", tags: ['ward'], pays: ['ward'], effect: 'overflow' },
  adrenal: { name: 'Adrenal Pump', text: `Each hero gains 1 Might at the start of each of its turns, to at most ${ADRENAL_MAX} from it`, tags: ['might'], effect: 'adrenal' },
  hairTrigger: { name: 'Hair Trigger', text: 'A weapon of 2 or more shots fires one more', tags: ['volley'], pays: ['volley'], rarity: 'common', effect: 'hairTrigger' },
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

/** How much likelier a relic sharing a keyword with the squad is drawn, so offers follow the build. */
export const FOCUS = 3

/** Takes a relic out of `pool`, the commoner the likelier, and one sharing a keyword of `held` FOCUS times likelier. */
export function drawRelic(rng: { rng: number }, pool: RelicId[], held: readonly Keyword[] = []): RelicId {
  const weight = (id: RelicId) => WEIGHT[RELICS[id].rarity ?? 'rare'] * (RELICS[id].tags?.some((tag) => held.includes(tag)) ? FOCUS : 1)
  let roll = random(rng) * pool.reduce((sum, id) => sum + weight(id), 0)
  const i = Math.max(0, pool.findIndex((id) => (roll -= weight(id)) < 0))
  return pool.splice(i, 1)[0]
}
