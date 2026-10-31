// A run's state: the squad, its route and stops, the mission under way and its report.
import type { AlienKind } from './aliens'
import type { Twist } from './twists'
import type { TerrainKind } from './terrain'
import type { RegionId } from './regions'
import type { Goal } from './goals'
import type { ContinentId, LonLat, City } from './world'
import type { ClassId } from './classes'
import type { FeatId, Tally } from './feats'
import type { Slot, Gear } from './gear'
import type { SkillId } from './skills'
import type { TraitId } from './traits'
import type { ConsumableId } from './consumables'
import type { RelicId } from './relics'
import type { Battle } from './battle'
import type { DoctrineId } from './doctrines'
import type { EventId } from './events'
import type { Resist } from './keywords'

export type Risk = 'safe' | 'standard' | 'dangerous'

/**
 * A stop on the road. A battle must be fought. A supply drop gives supplies and a cache gives gear, with no fight.
 * A shop sells gear, relics and a bribe. At a medic the squad heals, or takes a bonus at full health. An unknown stop is revealed on arrival as a battle, a shop or an event.
 * A key mission, at a satellite, wins an access key; the final mission strikes the alien source. Both have a boss.
 */
export type StopKind = 'battle' | 'supply' | 'cache' | 'shop' | 'unknown' | 'medic' | 'key' | 'final'

/**
 * A stop on the road. A battle has its own risk, goal and kind of place, and `packs` holds the aliens it will send,
 * mustered in advance so the map can show them. Other stops fight as `standard` exterminations, and have no packs.
 */
export interface Stop {
  kind: StopKind
  risk: Risk
  goal: Goal
  terrain: TerrainKind
  /** What about the ground or weather changes the battle; drawn ahead, so the map can show it. */
  twist: Twist | null
  /** Its aliens by kind, mustered before they are equipped. */
  aliens: AlienKind[]
  /** How the town it is fought in is built, and the place it is named for; drawn by the battle when absent. */
  region?: RegionId
  city?: string
}

/**
 * A stage of the journey across the globe: a leg crossing a continent from where the last ended to the city where an
 * elite hero waits to be extracted, or the last, from there to the alien hub.
 */
export interface Stage {
  continent: ContinentId | null
  from: LonLat
  to: City
  /** Who waits at the stage's end; none at the hub. */
  hero: Soldier | null
}

/** A stop on a leg's map: its row, the stops in the next column it leads to, and the stop, null until its leg begins. */
export interface MapNode {
  row: number
  next: number[]
  stop: Stop | null
  /** The town the stop is at, and where it lies; set once the route is plotted. */
  town: string | null
  at: LonLat | null
}

/**
 * A leg of the road as a map: columns of stops, LEG_STOPS of them then the satellite, or the source alone on the
 * last. `path` is the index the squad took in each column entered, -1 for a column passed underground.
 */
export interface Leg {
  columns: MapNode[][]
  path: number[]
}

/**
 * A battle to fight. An ambush comes when threat is full, and a recovery when the aliens hold soldiers, in place of
 * the next stop; losing either loses the run, as does losing the final mission. `force` is what the aliens can muster: a trooper costs one, and some kinds
 * cost two or come in pairs.
 */
export interface Mission {
  kind: 'battle' | 'key' | 'final' | 'ambush' | 'recovery'
  goal: Goal
  risk: Risk
  force: number
}

export interface Soldier {
  id: number
  name: string
  xp: number
  /** Drawn at random when the soldier is made. */
  cls: ClassId | null
  /** In the order learned; the first, drawn at random when the soldier is made, sets the soldier's path. */
  skills: SkillId[]
  /** Feats it has pulled off, each paying experience only the first time. */
  feats: FeatId[]
  gear: Record<Slot, Gear | null>
  /** The quirk it was recruited with, if any. */
  trait: TraitId | null
  /** Where it comes from: a recruit's home, a hero's city; none for one who joined on the road. */
  home: City | null
  /** Health lost and not yet healed; it carries from battle to battle. */
  wounds: number
  /** Draws the skills it is offered at each level. */
  seed: number
}

/** What the last stop changed, for the player to review. */
export interface Report {
  /** The stop: a mission fought, or an event met on the road. */
  stop: Mission['kind'] | 'supply' | 'cache'
  /** False only for a lost battle. */
  won: boolean
  /** Threat before the stop and after it. */
  threat: { before: number; after: number }
  supplies: number
  /** Whether an access key was won. */
  key: boolean
  /**
   * Every soldier in the squad when a battle began, with the class each has after it; empty for an event. A taken
   * soldier was left downed on the field, and the aliens hold it. `earned` is what its experience came from; `feats`,
   * those first pulled off; `tally`, what it did in the battle.
   */
  soldiers: { id: number; name: string; cls: ClassId | null; xpBefore: number; xpAfter: number; taken: boolean; earned: Earned[]; feats: FeatId[]; hp: number; maxHp: number; tally: Tally }[]
  /** The name of the hero the stop added to the squad. */
  hired: string | null
  /** Civilians kept alive on a rescue; null on any other stop. */
  rescued: number | null
  /** A consumable the stop turned up, now in the kit. */
  found: ConsumableId | null
}

/** Experience from one source. */
export interface Earned {
  label: string
  xp: number
}

/** A shop's stock, each item staying in its place once sold, and whether its bribe is spent. */
export interface Shop {
  wares: { gear: Gear; sold: boolean }[]
  relics: { id: RelicId; sold: boolean }[]
  consumables: { id: ConsumableId; sold: boolean }[]
  bribed: boolean
}

export interface Run {
  seed: number
  rng: number
  /** Access keys won; also the number of the leg under way, from 0. At KEYS, the final mission is all that remains. */
  keys: number
  /** Every leg's map, its shape drawn when the run begins; the one at `keys` is under way. */
  legs: Leg[]
  /** Columns passed on the leg under way. The squad chooses where to go when it has entered no column beyond them. */
  stop: number
  threat: number
  /**
   * In the overworld the player chooses where to go or travels on; in the reward phase, makes the choices a stop left;
   * in a shop, buys; at an event, chooses how to meet it.
   */
  phase: 'recruit' | 'overworld' | 'battle' | 'reward' | 'shop' | 'event' | 'won' | 'lost'
  /** What the shop the squad is in sells; null outside a shop. */
  shop: Shop | null
  /** The event the squad is meeting; null outside one. */
  event: EventId | null
  /** Events met this run, which are not met again. */
  met: EventId[]
  /** Doctrines adopted, in order. */
  doctrines: DoctrineId[]
  /** The mission being fought or last fought. */
  mission: Mission | null
  /** The battle being fought or last fought. */
  battle: Battle | null
  /** Null until the first stop is done. */
  report: Report | null
  soldiers: Soldier[]
  nextSoldier: number
  supplies: number
  /** Gear found and not yet put on a soldier the player picks, or sold. */
  finds: Gear[]
  nextGear: number
  relics: RelicId[]
  /** Consumables carried, at most KIT_SLOTS, each used once in a battle. */
  kit: ConsumableId[]
  /** Relics to choose from in the reward phase. */
  relicOffers: RelicId[]
  /** At the run's start, the recruits to choose the first soldier from. */
  recruits: Soldier[]
  /** The journey across the globe, a stage for each leg; set once the first soldier is chosen, from its home. */
  route: Stage[]
  /** What each leg's boss resists, by keys won; known from the start so the squad can build to beat it. */
  bosses: Resist[]
  /** Soldiers the aliens hold, by id: left downed on a field. The next stop is a recovery until they are back. */
  captives: number[]
}
