// A battle's state: units, the board, and the numbers its rules share.
import type { Exam } from './exams'
import type { ArenaKind } from './arena-kinds'
import type { Poi } from './pois'
import { type AlienKind } from './aliens'
import type { Resist } from './quantities'
import { type Flow, Goal } from './goals'
import type { Twist } from './twists'
import type { Card } from './cards'
import type { WeaponId } from './weapons'
import type { Intent } from './turn'
import type { ChallengeId } from './challenges'
import { type Bulk, type Edge, type Ground, type Prop, type Terrain, type TerrainKind } from './terrain'

export type { Bulk }

export const GRID = 96
/** A battle still running at this beat ends as a draw. */
export const MAX_BEATS = 3000
/** Damage a crit adds. */
export const CRIT_BONUS = 2
/** Tiles within which a soldier with line of sight reveals an alien. */
export const SIGHT = 24
/** Tiles a blast reaches from where it lands. */
export const BLAST_RADIUS = 1
/** Tiles a unit in the standoff stance keeps from every enemy. */
export const STANDOFF = 7
/** Burn stacks a source adds; each own turn a burning unit takes its stacks in damage, then loses one. At most BURN_MAX. */
export const BURN_STACKS = 2
export const BURN_MAX = 6
/** Chill stacks freeze a unit at CHILL_FREEZE: it loses its next action, then thaws with none. */
export const CHILL_FREEZE = 3
/** Tiles more a chilled unit knocked back slides on, each one slid adding a point to its slam. */
export const CHILL_SLIDE = 3
/** The most mark and chill stacks a unit holds. */
export const MARK_MAX = 6
export const CHILL_MAX = 6
/** The most Might a unit holds. */
export const MIGHT_MAX = 8
/** The round from which Adrenal Pump gives Might, and the most it gives a hero a battle. */
export const ADRENAL_FROM = 2
export const ADRENAL_MAX = 1
/** Armor Bracing gear and Overflow Capacitor build past a hero's own. */
export const GUARD_MAX = 6
/** Damage Stagger Sights adds to hits on a moved alien; tiles Lodestone Harness pulls from; armor Reactive Shell builds past a hero's own. */
export const STAGGER_DAMAGE = 3
/** Own turns a cancellation leaves an alien numb; what Thermal Shock Core multiplies, and Shatterglass Edge and Lock-On Rig. */
export const NUMB_TURNS = 1
export const THERMAL_FACTOR = 3
/** Damage less each hit does to a numb alien. */
export const NUMB_SOAK = 1
export const BRIDGE_FACTOR = 2
/** Damage a hit does past which Overkill Coils carry the rest. */
export const OVERKILL_FROM = 6
/** The least a Volatile kill bursts for. */
export const VOLATILE_DAMAGE = 2
export const LODESTONE_REACH = 6
export const SHELL_MAX = 1
/** The rounds Chrono Coil's Energy comes every. */
export const CHRONO_EVERY = 3
/** Catalyst Prism's every-Nth hit. */
export const CATALYST_EVERY = 3
export const EXPOSED = { turns: 2, factor: 1.5 }
export const CADENCE = 10
/** Damage Frost Fracture does to each alien beside a frozen alien broken, per chill stack on it. */
export const FRACTURE_DAMAGE = 3
/** Crit chance a level above the target adds, for Lofty gear, to at most HIGH_LEVELS levels. */
export const HIGH_CRIT = 0.1
export const HIGH_LEVELS = 4
/** Own turns a root, a suppression or a charge lasts. */
export const CHILL_TURNS = 2
export const CHILL_MOVE = 2
export const CHILL_DAMAGE = 1
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
/** What Weak takes off a hit, and what relics are worth; relics.ts says what each does. */
export const SUPPRESS_DAMAGE = 1
export const FEAST_HEAL = 2
export const PHOENIX_HEALTH = 5
/** Own turns a cloak lasts unbroken, and the damage an attack out of cloak adds. */
export const CLOAK_TURNS = 2
export const CLOAK_DAMAGE = 3
/** Tiles around an landing that are marked as it, and that its hero comes in on. */
export const ENTRY_RADIUS = 2
/** How near a soldier comes to an alien waiting its turn before its cluster engages. */
export const ENGAGE_REACH = 5

export type Side = 'human' | 'alien'

/** What a soldier did in a battle: damage done to aliens, kills, health lost, damage its armor stopped, health it restored. */
export interface Tally {
  dealt: number
  kills: number
  taken: number
  blocked: number
  healed: number
}

export const emptyTally = (): Tally => ({ dealt: 0, kills: 0, taken: 0, blocked: 0, healed: 0 })

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
  /** What it can lift, throw and shove, and how far; see objects and knockback. */
  strength: number
  /** Levels it leaps up or down a ledge, landing unhurt; it leaps a gap of one tile fewer. */
  jump: number
  /** Tiles wider than its jump allows that it leaps a gap of void or water. */
  span: number
}

export const BASE_STATS: Stats = { hp: 10, armor: 0, damage: 3, range: 5, move: 4, crit: 0.2, strength: 2, jump: 2, span: 0 }



/** Something a piece of gear does; gear.ts says what each does. */
export type GearEffect = 'bellows' | 'frostbite' | 'tracer' | 'incendiary' | 'piercing' | 'vampiric' | 'executioner' | 'chain' | 'ricochet' | 'arc' | 'volatile' | 'thunder' | 'snare' | 'booming' | 'tether' | 'shove' | 'cadence' | 'lofty' | 'topple' | 'kiln' | 'quench' | 'twinned' | 'braced' | 'sapping'
/** Something a relic does; relics.ts says what each does. */
export type RelicEffect = 'satchel' | 'domino' | 'opener' | 'rearm' | 'feast' | 'phoenix' | 'accelerant' | 'wildfire' | 'ignite' | 'freeze' | 'shatter' | 'thermal' | 'spotter' | 'exploit' | 'momentum' | 'bloodRite' | 'armored' | 'conductor' | 'kindling' | 'overkill' | 'brittle' | 'pyre' | 'hex' | 'sentinel' | 'net' | 'glacial' | 'entryBlast' | 'entryShred' | 'entryFrost' | 'entryWall' | 'encore' | 'beacon' | 'relay' | 'flare' | 'bounty' | 'impetus' | 'catalyst' | 'chrono' | 'fracture' | 'eternal' | 'frostHeart' | 'ledger' | 'gravity' | 'ironclad' | 'split' | 'ram' | 'overflow' | 'adrenal' | 'hairTrigger' | 'stagger' | 'lodestone' | 'shell' | 'lockOn'
/** Anything a unit's gear, relics, cards, Guardian trait or alien power do, and the cancellations; combat applies them. */
export type Effect = GearEffect | RelicEffect | Exam | 'blink' | 'pounce' | 'stun' | 'frozen' | 'quenched' | 'thawed' | 'unlocked' | 'glassEdge'

/** How a unit chooses where to stand; each is described where combat applies it. */
export type Stance = 'balanced' | 'rush' | 'anchor' | 'standoff'

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
  /** A Guardian's trait. */
  exam?: Exam
}

/** A soldier waiting to land. */
export interface Reserve {
  weapon?: WeaponId
  soldier: number
  stats: Stats
  /** Health it lands with. */
  hp: number
  stance: Stance
  effects: Effect[]
}

/** What every unit starts a battle with: no stacks, no counts. */
export const FRESH = { burn: 0, chill: 0, mark: 0, frozen: false, shifted: false, numb: 0, might: 0, aim: 0, combo: 0, comboOn: 0, exposed: 0, hits: 0 }

export interface Unit {
  id: number
  side: Side
  x: number
  y: number
  hp: number
  /** Armor left. */
  armor: number
  /** The damage of the card hit under way, in place of its own; payoffs that scale with damage read its own. */
  dealing?: number
  /** Block: takes damage before anything else, until the hero's next turn. */
  block?: number
  /** Temp HP: takes damage before armor and health. */
  temp?: number
  stats: Stats
  /** The soldier this unit is; null for aliens. */
  soldier: number | null
  /** In the fight: an alien coming for the team. One not engaged stands at its post and holds its fire. Humans always are. */
  engaged: boolean
  /** The cluster an alien stands in, which engages together; 0 alone. */
  cluster: number
  /** Seen by the team: drawn, and shot at. Every alien is but burrowers underground and waves not yet sighted. */
  revealed: boolean
  /** Alien turns left caught off guard, doing nothing. */
  surprised: number
  /** A hive node's spawns left this battle. */
  charges: number
  stance: Stance
  /** What the unit's weapon, skills and the hero's relics do. */
  effects: Effect[]
  /** Once-per-battle effects already used. */
  spent: Effect[]
  /** Burn stacks. */
  burn: number
  /** Chill stacks: while any, -CHILL_MOVE move and CHILL_DAMAGE less damage. */
  chill: number
  /** Frozen by its chill: it loses its next action. */
  frozen: boolean
  /** The round Reactive Shell last gave it armor. */
  shelled?: number
  /** Knocked back, pulled or slid since its own turn began. */
  shifted: boolean
  /** Own turns left in which a cancellation leaves it taking no burn, chill or marks. */
  numb: number
  /** Own turns for which it is rooted and cannot move. */
  rooted: number
  /** Own turns for which moving hurts it, by a booming hit. */
  booming: number
  /** Damage its hits do more this battle: Might, from kills, falls and slams; a feeder's growth. */
  might: number
  /** Damage its next card attack does more on its first hit, from Aim. */
  aim: number
  /** Hits in a row on the alien `comboOn`, for Focus Fire. */
  combo: number
  comboOn: number
  /** Own turns for which hits on it do half again, after a fall. */
  exposed: number
  /** Its shots that struck this battle, toward its every-Nth triggers. */
  hits: number
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
   * Whether a civilian to rescue: on the human side, never fights, and is not a soldier. It stays put.
   */
  civilian: boolean
  /** What a hero fights with, for its look; aliens have their one shot. */
  weapon?: WeaponId
  /** Whether the unit loses its next action. */
  panicked: boolean
  /** Whether the unit has moved this turn. */
  moved: boolean
  /** Own turns for which its attacks do SUPPRESS_DAMAGE less. */
  suppressed: number
  /** Mark stacks: while any, every hit on it does TUNING.markDamage more damage. At most MARK_MAX. */
  mark: number
  /** Alien turns until the unit's recurring ability is ready: a psion's panic, a spawner's spawn. */
  cooldown: number
  /** Own turns its cloak has left: no enemy sees or targets it. Unset or 0 when not cloaked. */
  cloaked?: number
  /** Health healed this battle by each capped source; see mend. */
  healed?: Partial<Record<Effect, number>>
}



/** The ground the fight is staged on: where the aliens hang out, and the landing by them. */
export interface Arena {
  x: number
  y: number
  reach: number
}

export interface Battle {
  rng: number
  goal: Goal
  /** What about the ground or weather changes this battle, if anything. */
  twist: Twist | null
  /** The kind of place it is fought in. */
  place: TerrainKind
  /** The shape of the ground the fight is on. */
  arenaKind: ArenaKind
  /** Alien turns begun. */
  round: number
  /** How this battle plays. */
  flow: Flow
  /** Clumps of aliens still to arrive as waves, on a flood. */
  waves: Alien[][]
  /** The unit whose action is under way, credited with the damage it does; null between actions. */
  actor: number | null
  /** What each soldier did this battle, by soldier id. */
  tally: Record<number, Tally>
  /** The alien the hero marches on while no alien is in the fight. */
  marching: number | null
  /** Calls to stepBattle so far. */
  beat: number
  phase: 'deploy' | 'battle' | 'over'
  /** The side whose turn it is. */
  turn: Side
  /** A round: each side moves, the aliens first; the hero plays cards; then each alien acts. */
  stage: 'move' | 'play' | 'enemy'
  /** Id of the last alien to act this turn; 0 before the first. */
  shooter: number
  /** Attacks that unit has made this turn. */
  attacks: number
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
  /** Once-per-battle effects the heroes have used. */
  used: Effect[]
  /** What this battle tests; an ambush or a recovery has none. */
  challenge: ChallengeId | null
  /** The round reinforcements start coming, one clump a round, if the aliens posted are not all down; null when they come on a flood's beat. */
  deadline: number | null
  /** The hero's cards in this battle: to draw, in hand, discarded, and exhausted or played as Powers. */
  pile: { draw: Card[]; hand: Card[]; discard: Card[]; exhaust: Card[] }
  /** Energy left this turn. */
  energy: number
  /** A card played, by its place in the hand, and its target: it resolves on the next beat. */
  queued: { index: number; target: number | null } | null
  /** What each alien in the fight will do on its turn, as the board stands. */
  intents: Intent[]
  /** Set by the landing until what it sets off lands, as the battle's first beat. */
  opening: boolean
  /** Tiles of acid, each with the alien turns it has left. */
  acid: { x: number; y: number; turns: number }[]
  /** Tiles of fire, each with the alien turns it has left. */
  fire: { x: number; y: number; turns: number }[]
  /** Where civilians a harvester killed lie, to rise as husks on the next alien turn. */
  husks: Tile[]
  /** Rounds ended with a soldier inside the uplink's zone, on a hold. */
  held: number
  /** Civilians soldiers have reached and got out, on a rescue. */
  saved: number
  /** The one point where the hero lands, A. */
  entry: Tile | null
  /** Where the crossing ends, B: the extraction zone, the uplink, the civilians, or what the hero must kill. */
  objective: Tile
  /** Whether the battle is won once its targets fall: a commander, a Guardian, a big one or the Hunter. */
  quarry: boolean
  arena: Arena
  /** The landmarks the encounter is staged about, most important first. */
  pois: Poi[]
  /** Where the landing means to lie: head on down the fight's axis, the far end from the objective. */
  approach: Tile
  /** Where reinforcements arrive. */
  gates: Tile[]
  /** The round aliens last joined the fight. */
  rallied: number
  /** On a hold, the uplink the hero must reach and defend; null otherwise. */
  uplink: Tile | null
  /** On a crossing or an ambush, the extraction zone at the objective; null otherwise. */
  extract: Tile | null
  /** Soldiers lifted off from the extraction zone, by soldier id, and the health each left with. */
  escaped: number[]
  lifted: Record<number, number>
  /** Soldiers not yet landed. */
  reserve: Reserve[]
  /** Soldiers down on the field, where they fell. */
  downed: { soldier: number; x: number; y: number }[]
}

/** Primary attacks a soldier makes each turn; an alien makes one. */

/** A soldier of the team: not a civilian, nor a mech, which fights for the hero but cannot hold the field alone. */
export const isSoldier = (unit: Unit) => unit.side === 'human' && unit.soldier !== null

