// A run's state: the hero, its route and stops, the mission under way and its report.
import type { AlienKind } from './aliens'
import type { Twist } from './twists'
import type { TerrainKind } from './terrain'
import type { RegionId } from './regions'
import type { ArenaKind } from './arena-kinds'
import type { Goal } from './goals'
import type { ContinentId, LonLat, City } from './world'
import type { ClassId } from './classes'
import type { FeatId, Tally } from './feats'
import type { Gear } from './gear'
import type { SkillId } from './skills'
import type { PerkId } from './perks'
import type { Held, UtilityId } from './utilities'
import type { ChallengeId } from './challenges'
import type { RelicId } from './relics'
import type { Battle } from './battle'
import type { DoctrineId } from './doctrines'
import type { EventId } from './events'
import type { Exam } from './exams'

export type Risk = 'safe' | 'standard' | 'dangerous'

/**
 * A stop on the road. A battle must be fought. A supply drop gives supplies and a cache gives gear, with no fight.
 * A shop sells gear, relics and a medkit. A safehouse heals the hero fully, in place of a battle. An unknown stop is revealed on arrival as a battle, a shop or an event.
 * A key mission, at a satellite, wins an access key; the final mission strikes the alien source. Both have a boss.
 */
export type StopKind = 'battle' | 'supply' | 'cache' | 'shop' | 'unknown' | 'safehouse' | 'key' | 'final'

/**
 * A stop on the road. A battle has its own risk, goal and kind of place, and `packs` holds the aliens it will send,
 * mustered in advance so the map can show them. Other stops fight as `standard` exterminations, and have no packs.
 */
export interface Stop {
  kind: StopKind
  risk: Risk
  goal: Goal
  terrain: TerrainKind
  /** What the battle tests, drawn ahead, so the map can show it; none but on a fight. */
  challenge: ChallengeId | null
  /** What about the ground or weather changes the battle; drawn ahead, so the map can show it. */
  twist: Twist | null
  /** Its aliens by kind, mustered before they are equipped. */
  aliens: AlienKind[]
  /** How the town it is fought in is built, and the place it is named for; drawn by the battle when absent. */
  region?: RegionId
  city?: string
  /** The ground it is fought over, drawn ahead so the map can show it. */
  ground?: ArenaKind
}

/**
 * A stage of the journey across the globe: a leg crossing a continent from where the last ended to a city whose
 * satellite holds an access key, or the last, from there to the alien hub.
 */
export interface Stage {
  continent: ContinentId | null
  from: LonLat
  to: City
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
 * last. `path` is the index the hero took in each column entered, -1 for a column passed underground.
 */
export interface Leg {
  columns: MapNode[][]
  path: number[]
}

/**
 * A battle to fight. An ambush comes when threat is full, in place of the next stop; losing it loses the run, as does
 * losing a key or the final mission. `force` is what the aliens can muster: a trooper costs one, and some kinds
 * cost two or come in pairs.
 */
export interface Mission {
  kind: 'battle' | 'key' | 'final' | 'ambush'
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
  /** In the order learned; none at level 1. */
  skills: SkillId[]
  /** Feats it has pulled off, each paying experience only the first time. */
  feats: FeatId[]
  /** Its one item, the weapon it fights with. */
  gear: Gear | null
  /** The city it waits in at the run's start, where the journey sets out. */
  home: City
  /** Health lost and not yet healed; it carries from battle to battle. */
  wounds: number
  /** Draws the skills it is offered at each level. */
  seed: number
  /** Skills offered and turned down: gone for the run. */
  lost: SkillId[]
  /** Minor perks, in the order picked. */
  perks: PerkId[]
}

/** What the last stop changed, for the player to review. */
export interface Report {
  /** The stop: a mission fought, or an event met on the road. */
  stop: Mission['kind'] | 'supply' | 'cache' | 'safehouse'
  /** False only for a lost battle. */
  won: boolean
  /** Threat before the stop and after it. */
  threat: { before: number; after: number }
  supplies: number
  /** Whether an access key was won. */
  key: boolean
  /**
   * The hero after a battle; null for an event. `earned` is what its experience came from; `feats`, those first
   * pulled off; `tally`, what it did in the battle.
   */
  hero: { xpBefore: number; xpAfter: number; earned: Earned[]; feats: FeatId[]; hp: number; maxHp: number; tally: Tally } | null
  /** Civilians kept alive on a rescue; null on any other stop. */
  rescued: number | null
}

/** What the hero gained or lost without choosing it from a card the player could read; the player is told, one screen each. */
export type Gain = { kind: 'relic'; id: RelicId } | { kind: 'relicLost'; id: RelicId } | { kind: 'boon'; id: UtilityId; level: number }

/** A battle as the run remembers it, for the post-game summary. */
export interface Fought {
  stop: Mission['kind']
  goal: Goal
  won: boolean
  rounds: number
  tally: Tally
}

/** Experience from one source. */
export interface Earned {
  label: string
  xp: number
}

/** A shop's stock, each item staying in its place once sold, and whether its medkit is bought. */
export interface Shop {
  wares: { gear: Gear; sold: boolean }[]
  relics: { id: RelicId; sold: boolean }[]
  utilities: { id: UtilityId; sold: boolean }[]
  medkit: boolean
}

export interface Run {
  seed: number
  rng: number
  /** Access keys won; also the number of the leg under way, from 0. At KEYS, the final mission is all that remains. */
  keys: number
  /** Every leg's map, its shape drawn when the run begins; the one at `keys` is under way. */
  legs: Leg[]
  /** Columns passed on the leg under way. The hero chooses where to go when it has entered no column beyond them. */
  stop: number
  threat: number
  /**
   * In the overworld the player chooses where to go or travels on; in the reward phase, makes the choices a stop left;
   * in a shop, buys; at an event, chooses how to meet it.
   */
  phase: 'select' | 'overworld' | 'battle' | 'reward' | 'shop' | 'event' | 'won' | 'lost'
  /** What the shop the hero is in sells; null outside a shop. */
  shop: Shop | null
  /** The event the hero is meeting; null outside one. */
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
  hero: Soldier
  supplies: number
  /** Gear found and not yet put on the hero or sold. */
  finds: Gear[]
  nextGear: number
  /** Changed only through gainRelic and loseRelic, so the player hears of it. */
  relics: readonly RelicId[]
  /** Every battle fought, in order. */
  log: Fought[]
  /** What the player has yet to be told of. */
  gains: Gain[]
  /** Boons the hero holds, at most slotsOf; each works in every battle. */
  utilities: Held[]
  /** Fights won in a row, for Unbroken Line. */
  streak: number
  /** At the run's start, the boons to take its first from. */
  boonOffers: UtilityId[]
  /** A new boon gained: the player slots it in for one held, or leaves it. */
  spare: UtilityId | null
  /** Relics to choose from in the reward phase. */
  relicOffers: RelicId[]
  /** Relics offered and turned down, not offered again until every other is spent. */
  passed: RelicId[]
  /** At the run's start, the hero to choose the run's one from. */
  candidates: Soldier[]
  /** The journey across the globe, a stage for each leg; set once the hero is chosen, from its home. */
  route: Stage[]
  /** Each leg's Guardian's exam, by keys won; known from the start so the hero can build to pass it. */
  bosses: Exam[]
}
