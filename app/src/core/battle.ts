// A battle's state: units, the board, and the numbers its rules share.
import type { SecondaryId } from './secondaries'
import { type AlienKind } from './aliens'
import type { Tally } from './feats'
import type { DoctrineEffect, Rule } from './doctrines'
import type { Resist } from './keywords'
import { type Goal } from './goals'
import type { Twist } from './twists'
import type { ConsumableId } from './consumables'
import type { EntranceKind } from './entrances'
import { type Bulk, type Edge, type Ground, type Prop, type Terrain, type TerrainKind } from './terrain'

export type { Bulk }

export const GRID = 96
/** A battle still running at this beat ends as a draw. */
export const MAX_BEATS = 1000
/** Damage a crit adds. */
export const CRIT_BONUS = 2
/** Tiles within which a soldier with line of sight reveals an alien. */
export const SIGHT = 24
/** How near the squad an alien must be to take an entrance's impact. */
export const IMPACT_REACH = 4
/** Damage a rocket does to every unit within BLAST_RADIUS tiles of where it lands. */
export const ROCKET_DAMAGE = 4
export const BLAST_RADIUS = 1
/** Damage napalm does to every unit within its blast, which it sets burning on ground set alight. */
export const NAPALM_DAMAGE = 3
/** Damage Searing adds and Icebreaker adds against a burning or chilled target. */
export const SEARING_DAMAGE = 2
/** Turns Smolder adds to burning, and Permafrost to chill. */
export const LINGER_TURNS = 2
/** Health a medic restores, to a soldier within MEDIC_REACH tiles. */
export const MEDIC_HEAL = 4
export const MEDIC_REACH = 2
/** Tiles a unit in the standoff stance keeps from every enemy. */
export const STANDOFF = 7
/** Damage a grenade does within BLAST_RADIUS. */
export const GRENADE_DAMAGE = 3
/** Health a medkit restores to its carrier. */
export const MEDKIT_HEAL = 4
/** Turns a burning unit takes BURN_DAMAGE at the start of. */
export const BURN_TURNS = 2
export const BURN_DAMAGE = 1

export const CHILL_TURNS = 2
export const CHILL_MOVE = 2
export const CHILL_DAMAGE = 1
export const SPOTTER_DAMAGE = 1
/** Damage the executioner effect adds against a target at half health or less. */
export const EXECUTE_BONUS = 2
/** Damage a burster's explosion does within BLAST_RADIUS. */
export const BURST_DAMAGE = 4
/** Damage a spitter's spit does, the turns its acid lies on the tile, and the damage acid does to a unit still in it after its side moves. */
export const SPIT_DAMAGE = 1
export const ACID_TURNS = 2
export const ACID_DAMAGE = 2
/** Tiles a psion's panic reaches, the alien turns between its uses, and the damage its death does to the aliens within PSI_BACKLASH_REACH. */
export const PSI_RANGE = 7
export const PSI_COOLDOWN = 3
export const PSI_BACKLASH = 2
export const PSI_BACKLASH_REACH = 3
/** Alien turns between the swarmlings a boss spawns. */
export const SPAWN_EVERY = 2
/** What skills and relics are worth. Each name says the effect; skills.ts and relics.ts say what the effect does. */
export const BACKSTAB_DAMAGE = 2
export const RAGE_DAMAGE = 2
export const DODGE_SOAK = 1
export const SUPPRESS_DAMAGE = 1
export const AURA_REACH = 2
export const BULWARK_SOAK = 1
export const INSPIRE_DAMAGE = 1
export const HEADSHOT_DAMAGE = 2
export const REVIVE_REACH = 3
export const REVIVE_HEALTH = 3
export const BARRIER_ARMOR = 2
export const SURGEON_HEAL = 3
export const FEAST_HEAL = 2
export const PHOENIX_HEALTH = 5
export const SECOND_WIND_HEAL = 5
export const SKIRMISH_MOVE = 2
export const RECKLESS_DAMAGE = 1
export const CLEAVE_DAMAGE = 2
export const BIG_BLAST_RADIUS = 2
export const SLAYER_DAMAGE = 2
export const ELUSIVE_REACH = 4
export const HASTE_MOVE = 2
export const BANE_REACH = 3
export const BANE_DAMAGE = 1
export const DRONE_DAMAGE = 2
export const DRONE_REACH = 5
export const LEAP_DAMAGE = 2
export const HURL_TILES = 3
export const HURL_DAMAGE = 2
export const SLAM_HIT = 3
export const SLAM_TILES = 2
export const STUN_REACH = 3
export const FORCE_FIELD_ARMOR = 4
export const FORCE_FIELD_REACH = 4
export const TITAN_HEALTH = 3
export const PLATING_ARMOR = 3
/** Own turns a cloak lasts unbroken, and the damage an attack out of cloak adds, and Shadow Strike on top. */
export const CLOAK_TURNS = 2
export const CLOAK_DAMAGE = 3
export const SHADOW_DAMAGE = 2
/** Entrances offered to the squad. */
export const ENTRANCES = 3
/** Tiles around an entrance that are marked as it, and that its squad comes in on. */
export const ENTRY_RADIUS = 2
/** Tiles a wave keeps from the squad. */
export const POD_CLEARANCE = 7
/** How near a soldier comes to an alien waiting its turn before it engages. */
export const ENGAGE_REACH = 5

export type Side = 'human' | 'alien'

export type Tile = { x: number; y: number }

export interface Stats {
  hp: number
  /** Points that take damage before health does. */
  armor: number
  damage: number
  /** Tiles a shot reaches, counting a diagonal as one. */
  range: number
  /** Tiles the unit may move in its side's turn. */
  move: number
  /** Chance a hit crits. */
  crit: number
}

export const BASE_STATS: Stats = { hp: 10, armor: 0, damage: 3, range: 5, move: 4, crit: 0.2 }

/** A mech's stats, a frail decoy the aliens must shoot, and a light drone's, before its engineer's skills. */
export const MECH_STATS: Stats = { ...BASE_STATS, hp: 3, crit: 0.1, range: 4 }
export const DRONE_STATS: Stats = { ...BASE_STATS, hp: 2, damage: 2, crit: 0.1, range: 4, move: 6 }

/** Something a unit does unprompted beyond moving and shooting; each is described where combat applies it. */
export type Ability = 'runAndGun' | 'rocket' | 'squadsight' | 'medic' | 'mech' | 'napalm' | 'cryo' | 'cloak'

/** Something a piece of gear does; gear.ts says what each does. */
export type GearEffect = 'frostbite' | 'tracer' | 'rime' | 'incendiary' | 'piercing' | 'vampiric' | 'executioner' | 'chain' | 'thorns' | 'shield' | 'regen' | 'lastStand' | 'medkit' | 'grenade' | 'ricochet' | 'arc' | 'volatile' | 'thunder' | 'mirror' | 'bond' | 'guardians' | 'blink' | 'polymorph' | 'null' | 'snare' | 'booming' | 'tether' | 'caltrops'
/** Something a skill does; skills.ts says what each does. */
export type SkillEffect =
  | 'titan'
  | 'plating'
  | 'servos'
  | 'detonate'
  | 'swarm'
  | 'spotter'
  | 'linked'
  | 'hive'
  | 'shock'
  | 'frenzy'
  | 'backstab'
  | 'rage'
  | 'dodge'
  | 'shred'
  | 'suppress'
  | 'bulwark'
  | 'overwatch'
  | 'steady'
  | 'headshot'
  | 'mark'
  | 'doubleTap'
  | 'pierce'
  | 'revive'
  | 'inspire'
  | 'barrier'
  | 'surgeon'
  | 'surge'
  | 'throw'
  | 'secondWind'
  | 'skirmish'
  | 'reckless'
  | 'cleave'
  | 'taunt'
  | 'steadfast'
  | 'bigBlast'
  | 'concussion'
  | 'assassinate'
  | 'slayer'
  | 'volley'
  | 'elusive'
  | 'haste'
  | 'vitality'
  | 'bane'
  | 'ward'
  | 'drone'
  | 'inferno'
  | 'fireSuit'
  | 'tinder'
  | 'searing'
  | 'backdraft'
  | 'smolder'
  | 'icebreak'
  | 'frostbreak'
  | 'deepFreeze'
  | 'avalanche'
  | 'permafrost'
  | 'rimeLock'
  | 'leap'
  | 'hurl'
  | 'slam'
  | 'warcry'
  | 'emp'
  | 'flashbang'
  | 'forceField'
  | 'firewall'
  | 'shadowStrike'
  | 'vanish'
  | 'daze'
  | 'afterimage'
/** Something a relic does; relics.ts says what each does. */
export type RelicEffect = 'opener' | 'rearm' | 'feast' | 'phoenix' | 'accelerant' | 'wildfire' | 'ignite' | 'freeze' | 'shatter' | 'thermal' | 'spotter' | 'exploit' | 'momentum' | 'bloodRite' | 'armored' | 'conductor' | 'kindling' | 'overkill' | 'brittle' | 'pyre' | 'stasis' | 'hex' | 'sentinel' | 'net' | 'glacial' | 'entryBlast' | 'entryShred' | 'entryFrost' | 'entryWall' | 'entryTurret' | 'encore' | 'limelight' | 'beacon' | 'relay' | 'flare' | 'bounty'
/** Anything a unit's gear, skills, the squad's relics or its weapon doctrine do. Combat applies them. */
export type Effect = GearEffect | SkillEffect | RelicEffect | DoctrineEffect

/** How a unit chooses where to stand; each is described where combat applies it. */
export type Stance = 'balanced' | 'rush' | 'anchor' | 'standoff' | 'escort'

/** An alien to place in a battle. A boss is the one a key or final mission is about. */
export interface Alien {
  kind: AlienKind
  stats: Stats
  stance: Stance
  boss: boolean
  /** Whether it spawns swarmlings. */
  spawns: boolean
  /** Whether it is the commander an assassination is after. */
  target: boolean
  resists: Resist[]
}

/** A soldier waiting to land. */
export interface Reserve {
  secondary?: SecondaryId
  soldier: number
  stats: Stats
  /** Health it lands with. */
  hp: number
  ability: Ability | null
  charges: number
  stance: Stance
  effects: Effect[]
}

export interface Unit {
  id: number
  side: Side
  x: number
  y: number
  hp: number
  /** Armor left. */
  armor: number
  stats: Stats
  /** The soldier this unit is; null for aliens. */
  soldier: number | null
  /** In the fight: an alien coming for the squad. One not engaged stands at its post and holds its fire. Humans always are. */
  engaged: boolean
  /** Seen by the squad: drawn, and shot at. Every alien is but burrowers underground and waves not yet sighted. */
  revealed: boolean
  /** Alien turns left caught off guard, doing nothing. */
  surprised: number
  ability: Ability | null
  /** Uses of the ability left this battle. */
  charges: number
  stance: Stance
  /** Effects of the unit's gear. */
  effects: Effect[]
  /** Once-per-battle effects already used. */
  spent: Effect[]
  /** Turns of burning left. */
  burning: number
  /** Own turns for which it is chilled. */
  chilled: number
  /** Own turns for which it is rooted and cannot move. */
  rooted: number
  /** Own turns for which moving hurts it, by a booming hit. */
  booming: number
  /** Damage its kills this battle have added, by blood rite. */
  fury: number
  /** The kind of alien; null for humans. */
  kind: AlienKind | null
  boss: boolean
  /** Whether it spawns swarmlings; false for humans. */
  spawns: boolean
  /** Whether it is the commander an assassination is after. */
  target: boolean
  /** Keywords it shrugs off; empty for humans. */
  resists: Resist[]
  /**
   * A civilian to rescue, null for any other unit: on the human side, never fights, and is not a soldier. A hider takes
   * beside the biggest object it can reach and stays; a runner flees the aliens; a VIP waits for the squad, then keeps by it on the way out.
   */
  civilian: 'hider' | 'runner' | 'vip' | null
  /** For a mech, the soldier id of the engineer who deployed it, credited with what it does; null for any other unit. */
  summoner: number | null
  /** A hero's attack after its weapon's. */
  secondary?: SecondaryId
  /** Whether the unit loses its next action. */
  panicked: boolean
  /** Whether the unit has moved this turn. */
  moved: boolean
  /** Own turns for which its attacks do SUPPRESS_DAMAGE less. */
  suppressed: number
  /** Whether every hit on it does TUNING.markDamage more damage. */
  marked: boolean
  /** Alien turns until the unit's recurring ability is ready: a psion's panic, a spawner's spawn. */
  cooldown: number
  /** What a soldier with no shot does this turn in place of attacking, until its next turn; null otherwise. */
  order: Order | null
  /** Own turns its cloak has left: no enemy sees or targets it. Unset or 0 when not cloaked. */
  cloaked?: number
}

/**
 * A soldier's standard actions in place of attacking. Prepare: overwatch,
 * shooting the first alien that moves where it can shoot it. Sprint: moves again.
 */
export type Order = 'prepare' | 'sprint'


/** An entrance the squad may make: how, and the tile it comes in at. */
export interface Entrance {
  kind: EntranceKind
  at: Tile
}

/** The ground the fight is staged on: where the aliens hang out, and the entrances by them. */
export interface Arena {
  x: number
  y: number
  reach: number
}

export interface Battle {
  rng: number
  goal: Goal
  /** Doctrines' changes to how this battle works. */
  rules: Rule[]
  /** What about the ground or weather changes this battle, if anything. */
  twist: Twist | null
  /** The kind of place it is fought in. */
  place: TerrainKind
  /** Alien turns begun. */
  round: number
  /** Handfuls of aliens still to arrive as waves, on a hold or a recovery. */
  waves: Alien[][]
  /** The unit whose action is under way, credited with the damage it does; null between actions. */
  actor: number | null
  /** What each soldier did this battle, by soldier id. */
  tally: Record<number, Tally>
  /** Calls to stepBattle so far. */
  beat: number
  phase: 'deploy' | 'battle' | 'over'
  /** The side whose turn it is. A turn is one move stage, then one shot per unit. */
  turn: Side
  stage: 'move' | 'shoot'
  /** Id of the last unit to shoot this turn; 0 before the first shot. */
  shooter: number
  /** Attacks that unit has made this turn. */
  attacks: number
  /** Move each soldier has left this turn to walk between and after its attacks, by unit id. */
  strides: Record<number, number>
  /** Set when phase is 'over'; null is a draw. */
  winner: Side | null
  units: Unit[]
  nextId: number
  /** How solid each tile's prop is, one entry per tile, row by row; read it with bulkAt. */
  bulk: Bulk[]
  ground: Ground[]
  /** How high each tile stands; read it with heightAt. */
  height: number[]
  props: Prop[]
  /** What stands on each tile's north edge and west edge; read them with edgeBetween. */
  north: Edge[]
  west: Edge[]
  region: Terrain['region']
  city: string
  /** Once-per-battle effects of the whole squad already used. */
  used: Effect[]
  /** Consumables the player has used, taking effect at the next beat. */
  primed: ConsumableId[]
  /** Set by the entrance until what it sets off lands, as the battle's first beat. */
  opening: boolean
  /** Tiles of acid, each with the alien turns it has left. */
  acid: { x: number; y: number; turns: number }[]
  /** Tiles of fire, each with the alien turns it has left. */
  fire: { x: number; y: number; turns: number }[]
  /** Tiles strewn with caltrops: dear to cross, and they hurt an alien that steps on them. */
  caltrops: Tile[]
  /** Where civilians a harvester killed lie, to rise as husks on the next alien turn. */
  husks: Tile[]
  /** Rounds ended with a soldier inside the uplink's zone, on a hold. */
  held: number
  /** Civilians soldiers have reached and got out, on a rescue. */
  saved: number
  /** On a VIP rescue, whether the VIP waits for the squad, behind its building's walls or past the breach; keeps by it on the way out; or has lifted off. Null otherwise. */
  vip: 'held' | 'breached' | 'freed' | 'out' | null
  /** The entrances on offer in the deploy phase, and the one the squad made; null before it enters. */
  entrances: Entrance[]
  entered: Entrance | null
  arena: Arena
  /** Where the encounter means each entrance to lie, each its own trade: head on, by a ledge, by heaps to hurl. */
  approaches: Tile[]
  /** Where reinforcements arrive. */
  gates: Tile[]
  /** The round aliens last joined the fight. */
  rallied: number
  /** A soldier whose monologue draws every alien's attention until the round `until` ends; null if none. */
  spotlight: { id: number; until: number } | null
  /** On a hold, the uplink the squad must reach and defend; null otherwise. */
  uplink: Tile | null
  /** On a hold, once it is held, the extraction zone; null otherwise. */
  extract: Tile | null
  /** Soldiers lifted off from the extraction zone, by soldier id, and the health each left with; 0 if carried. */
  escaped: number[]
  lifted: Record<number, number>
  /** On a raid, the supply caches still on the map, and how many the squad set out to grab and has grabbed. */
  caches: Tile[]
  greed: number
  grabbed: number
  /** Soldiers not yet landed. */
  reserve: Reserve[]
  /** Soldiers down on the field: lying where they fell, or carried by the unit `carrier`. */
  downed: Downed[]
  /** On a recovery, the soldiers the aliens hold, each lying in `downed` until a squadmate reaches it. */
  captives: Reserve[]
}

interface Downed {
  soldier: number
  x: number
  y: number
  carrier: number | null
}

/** Primary attacks a soldier makes each turn; an alien makes one. */
export const SOLDIER_ATTACKS = 2

/** A soldier of the squad: not a civilian, nor a mech, which fights for the squad but cannot hold the field alone. */
export const isSoldier = (unit: Unit) => unit.side === 'human' && unit.soldier !== null

