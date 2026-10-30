import { HATCH_TURNS, NODE_SPAWNS, type AlienKind } from './aliens'
import type { Tally } from './feats'
import type { DoctrineEffect, Rule } from './doctrines'
import type { Resist } from './keywords'
import { random, randomInt } from './rng'
import { CIVILIAN_HP, CIVILIAN_MOVE, CIVILIANS, type Goal } from './goals'
import type { Twist } from './twists'
import { EDGE_COVER, generateTerrain, PROP_COVER, type Cover, type Edge, type Ground, type Locale, type Prop, type Terrain, type TerrainKind } from './terrain'

export type { Cover }

export const GRID = 50
/** A battle still running at this beat ends as a draw. */
export const MAX_BEATS = 1000
/** Damage a crit adds. */
export const CRIT_BONUS = 2
/** Hit chance a target's cover removes, indexed by Cover. */
export const COVER_DEFENSE = [0, 0.2, 0.4]
/** Tiles within which a soldier with line of sight reveals an alien. */
export const SIGHT = 24
/** What a soldier's shots gain against an ambushed pod: hit chance, and chance for a hit to crit. */
export const AMBUSH_AIM = 0.2
export const AMBUSH_CRIT = 0.25
/** How near a soldier landing in a breach an alien must be to take the drop pods' impact damage. */
export const IMPACT_REACH = 2
/** Tiles an alien moves per turn before its pod is revealed. */
export const PATROL_MOVE = 2
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
export const CHILL_AIM = 0.15
export const SPOTTER_AIM = 0.15
/** Damage the executioner effect adds against a target at half health or less. */
export const EXECUTE_BONUS = 2
/** Damage a burster's explosion does within BLAST_RADIUS. */
export const BURST_DAMAGE = 4
/** Damage a spitter's spit does, the turns its acid lies on the tile, and the damage acid does to a unit still in it after its side moves. */
export const SPIT_DAMAGE = 1
export const ACID_TURNS = 2
export const ACID_DAMAGE = 2
/** Tiles a psion's panic reaches, the alien turns between its uses, and the damage its death does to its pod. */
export const PSI_RANGE = 7
export const PSI_COOLDOWN = 3
export const PSI_BACKLASH = 2
/** Alien turns between the swarmlings a boss spawns. */
export const SPAWN_EVERY = 2
/** What skills and relics are worth. Each name says the effect; skills.ts and relics.ts say what the effect does. */
export const BACKSTAB_DAMAGE = 2
export const RAGE_DAMAGE = 2
export const DODGE_CHANCE = 0.25
export const SUPPRESS_AIM = 0.25
export const AURA_REACH = 2
export const BULWARK_DEFENSE = 0.1
export const INSPIRE_AIM = 0.1
export const HEADSHOT_DAMAGE = 2
export const REVIVE_REACH = 3
export const REVIVE_HEALTH = 3
export const BARRIER_ARMOR = 2
export const SURGEON_HEAL = 3
export const FEAST_HEAL = 2
export const PHOENIX_HEALTH = 5
export const SECOND_WIND_HEAL = 5
export const SKIRMISH_MOVE = 2
export const RECKLESS_AIM = 0.2
export const CLEAVE_DAMAGE = 2
export const THICK_ARMOR = 1
export const BIG_BLAST_RADIUS = 2
export const SLAYER_DAMAGE = 2
export const GHOST_REACH = 4
export const HASTE_MOVE = 2
export const BANE_REACH = 3
export const BANE_AIM = 0.1
export const DRONE_DAMAGE = 2
export const DRONE_REACH = 5
/** The letters landing zones go by, in battle.zones order. */
export const ZONE_NAMES = 'ABC'
/** Landing zones offered to the squad. */
export const ZONES = 3
/** Tiles around a landing zone's centre that count as the zone. */
export const ZONE_RADIUS = 3
/** Tiles a landing zone keeps from every alien and from the other zones. */
export const ZONE_CLEARANCE = 9

export type Side = 'human' | 'alien'

export type Tile = { x: number; y: number }

export interface Stats {
  hp: number
  /** Points that take damage before health does. */
  armor: number
  /** Chance to hit a target at full range with no cover against the shooter. */
  aim: number
  damage: number
  /** Tiles a shot reaches, counting a diagonal as one. */
  range: number
  /** Tiles the unit may move in its side's turn. */
  move: number
  /** Chance a hit crits when the target has no cover against the shooter. */
  crit: number
  /** Hit chance a shot gains for each tile the target is nearer than the range. */
  close: number
}

export const BASE_STATS: Stats = { hp: 10, armor: 0, aim: 0.75, damage: 3, range: 5, move: 4, crit: 0.5, close: 0.06 }

/** Something a unit does unprompted beyond moving and shooting; each is described where combat applies it. */
export type Ability = 'runAndGun' | 'rocket' | 'squadsight' | 'medic' | 'mech' | 'napalm' | 'cryo'

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
  | 'secondWind'
  | 'skirmish'
  | 'reckless'
  | 'cleave'
  | 'taunt'
  | 'thick'
  | 'steadfast'
  | 'bigBlast'
  | 'concussion'
  | 'assassinate'
  | 'slayer'
  | 'volley'
  | 'ghost'
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
/** Something a relic does; relics.ts says what each does. */
export type RelicEffect = 'opener' | 'rearm' | 'feast' | 'phoenix' | 'accelerant' | 'wildfire' | 'ignite' | 'freeze' | 'shatter' | 'thermal' | 'spotter' | 'exploit' | 'momentum' | 'bloodRite' | 'armored' | 'conductor' | 'kindling' | 'overkill' | 'brittle' | 'pyre' | 'stasis' | 'hex' | 'sentinel' | 'net' | 'glacial' | 'podBlast' | 'podShred' | 'podFrost' | 'podWall' | 'podTurret' | 'dropPods' | 'canopies' | 'ghost' | 'killzone' | 'beacon' | 'relay' | 'flare' | 'bounty'
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
  /** Index of the alien's pod; null for humans. */
  pod: number | null
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
  /** A civilian to rescue: on the human side, but flees rather than fights, and is not a soldier. */
  civilian: boolean
  /** For a mech, the soldier id of the engineer who deployed it, credited with what it does; null for any other unit. */
  summoner: number | null
  /** The team a soldier keeps with, when a rescue splits the squad; 0 otherwise. */
  team: number
  /** Whether the unit loses its next action. */
  panicked: boolean
  /** Whether the unit has moved this turn. */
  moved: boolean
  /** Own turns for which its aim is suppressed. */
  suppressed: number
  /** Whether every hit on it does TUNING.markDamage more damage. */
  marked: boolean
  /** Alien turns until the unit's recurring ability is ready: a psion's panic, a spawner's spawn. */
  cooldown: number
  /** What a soldier with no shot does this turn in place of attacking, until its next turn; null otherwise. */
  order: Order | null
}

/**
 * A soldier's standard actions in place of attacking. Hunker: harder to hit until its next turn. Prepare: overwatch,
 * shooting the first alien that moves where it can shoot it. Sprint: moves again.
 */
export type Order = 'hunker' | 'prepare' | 'sprint'

/** Hit chance a hunkered unit takes off shots at it. */
export const HUNKER_DEFENSE = 0.3

/** A group of aliens. It patrols toward its waypoint, unseen, until a soldier sights a member; then it fights. */
export interface Pod {
  /** The name of its pack. */
  name: string
  /** Seen by the squad: drawn, and shot at. */
  revealed: boolean
  /** Aware of the squad: it hunts the squad and fights. */
  alert: boolean
  /** Noticed the squad unseen: its shots this alien turn gain the ambush bonus. */
  stalking: boolean
  /** Caught unaware by a concealed squad: until the squad's turn ends, shots at its members gain the ambush bonus. */
  ambushed: boolean
  /** Revealed during the current alien turn, or crashed onto by drop pods, so its members do not shoot until the next. */
  surprised: boolean
  /** Ambushed: on its next turn its members move at half their move and do not act. */
  reeling: boolean
  /** Squad turns the squad has spent setting up an ambush on it, seen but unaware. */
  stalked: number
  /** Holds its post, unmoving, until it notices the squad or the battle drags on. */
  guard: boolean
  waypoint: Tile
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
  /** Packs still to arrive as waves, on a hold or an escape. */
  waves: { name: string; aliens: Alien[] }[]
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
  /** Set when phase is 'over'; null is a draw. */
  winner: Side | null
  units: Unit[]
  nextId: number
  /** The cover each tile's prop gives, one entry per tile, row by row; read it with coverAt. */
  cover: Cover[]
  ground: Ground[]
  /** How high each tile stands; read it with heightAt. */
  height: number[]
  props: Prop[]
  /** What stands on each tile's north edge and west edge; read them with edgeBetween. */
  north: Edge[]
  west: Edge[]
  region: Terrain['region']
  city: string
  outside: boolean[]
  sprawl: Terrain['sprawl']
  bounds: Terrain['bounds']
  pods: Pod[]
  /** Once-per-battle effects of the whole squad already used. */
  used: Effect[]
  /** True while no living pod is alert to the squad. */
  concealed: boolean
  /** Set by a landing on the hot zone until the drop pods' impact lands, as the battle's first beat. */
  breach: boolean
  /** Whether an orbital strike was called before the landing. */
  strike: boolean
  /** Tiles of acid, each with the alien turns it has left. */
  acid: { x: number; y: number; turns: number }[]
  /** Tiles of fire, each with the alien turns it has left. */
  fire: { x: number; y: number; turns: number }[]
  /** Tiles strewn with caltrops: dear to cross, and they hurt an alien that steps on them. */
  caltrops: Tile[]
  /** Where civilians a harvester killed lie, to rise as husks of its pod on the next alien turn. */
  husks: { x: number; y: number; pod: number }[]
  /** Rounds ended with a soldier inside the uplink's zone, on a hold. */
  held: number
  /** Civilians soldiers have reached and got out, on a rescue. */
  saved: number
  /** Centres of the landing zones on offer in the deploy phase. */
  zones: Tile[]
  /** On a hold, the uplink the squad must reach and defend; null otherwise. */
  uplink: Tile | null
  /** On an escape, where the squad is ambushed, and the escape zone it chose; null otherwise. */
  start: Tile | null
  escape: Tile | null
  /** Soldiers lifted off from an escape or extraction zone, by soldier id, and the health each left with; 0 if carried. */
  escaped: number[]
  lifted: Record<number, number>
  /** What landing at each zone means, in zones order, and the plan the squad landed by; null before it lands. */
  plans: Plan[]
  landed: Plan | null
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

export interface Downed {
  soldier: number
  x: number
  y: number
  carrier: number | null
}

/** Primary attacks a soldier makes each turn; an alien makes one. */
export const SOLDIER_ATTACKS = 2

/** Tiles between two points, counting a diagonal as one. */
export const distance = (a: Tile, b: Tile) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y))

export const NEIGHBORS = [[0, -1], [1, 0], [0, 1], [-1, 0], [1, -1], [1, 1], [-1, 1], [-1, -1]]

export const onGrid = (x: number, y: number) => x >= 0 && y >= 0 && x < GRID && y < GRID

export const heightAt = (battle: Battle, tile: Tile) => battle.height[tile.y * GRID + tile.x]

/** Tiles of sight a unit gains for each level it stands above what it looks at, and loses for each below. */
export const HIGH_SIGHT = 2
/** Aim a shot gains for each level the shooter stands above its target, and loses for each below. */
export const HIGH_AIM = 0.1
/** Move a step costs beyond its one tile for each level it climbs. */
export const CLIMB = 2

/** Move a step onto caltrops costs beyond its one tile. */
export const CALTROP_COST = 2

/** What a step between neighbouring tiles costs of a unit's move: one tile, CLIMB more for each level up, and more onto caltrops. */
export const stepCost = (battle: Battle, from: Tile, to: Tile) =>
  1 + CLIMB * Math.max(0, heightAt(battle, to) - heightAt(battle, from)) + (battle.caltrops.some((t) => t.x === to.x && t.y === to.y) ? CALTROP_COST : 0)

export function coverAt(battle: Battle, x: number, y: number): Cover {
  return battle.cover[y * GRID + x]
}

export function unitAt(battle: Battle, x: number, y: number): Unit | undefined {
  return battle.units.find((u) => u.x === x && u.y === y)
}

/** Removes everything a blast catches: the props on tiles within `radius` of `centre`, and the walls and windows around those tiles. */
export function wreck(battle: Battle, centre: Tile, radius = BLAST_RADIUS): void {
  walks.delete(battle)
  for (let y = centre.y - radius; y <= centre.y + radius; y++) {
    for (let x = centre.x - radius; x <= centre.x + radius; x++) {
      if (!onGrid(x, y) || battle.ground[y * GRID + x] === 'void') continue
      const tile = y * GRID + x
      battle.props[tile] = 'none'
      battle.cover[tile] = 0
      battle.ground[tile] = 'scorched'
      battle.north[tile] = battle.west[tile] = 'none'
      if (onGrid(x, y + 1)) battle.north[tile + GRID] = 'none'
      if (onGrid(x + 1, y)) battle.west[tile + 1] = 'none'
    }
  }
}

/**
 * Breaks down a level the cover sheltering `at` from a shot from `from`: a wall to a window, a window to nothing,
 * high cover to rubble, low cover to nothing. Water and void stay as they are.
 */
export function crumble(battle: Battle, at: Tile, from: Tile): void {
  let best: { x: number; y: number; cover: number } | undefined
  for (const [dx, dy] of NEIGHBORS.slice(0, 4)) {
    const x = at.x + dx
    const y = at.y + dy
    if (!onGrid(x, y) || (from.x - at.x) * dx + (from.y - at.y) * dy <= 0 || ['water', 'void'].includes(battle.props[y * GRID + x])) continue
    const cover = Math.max(coverAt(battle, x, y), EDGE_COVER[edgeBetween(battle, at, { x, y })])
    if (cover > (best?.cover ?? 0)) best = { x, y, cover }
  }
  if (!best) return
  walks.delete(battle)
  const edge = edgeBetween(battle, at, best)
  const edges = at.y === best.y ? battle.west : battle.north
  const index = at.y === best.y ? at.y * GRID + Math.max(at.x, best.x) : Math.max(at.y, best.y) * GRID + at.x
  if (edge !== 'none') edges[index] = edge === 'wall' ? 'window' : 'none'
  else {
    const tile = best.y * GRID + best.x
    battle.props[tile] = battle.cover[tile] === 2 ? 'rubble' : 'none'
    battle.cover[tile] = PROP_COVER[battle.props[tile]]
  }
}

/** What stands on the line between two tiles that share a side. */
export function edgeBetween(battle: Battle, a: Tile, b: Tile): Edge {
  return a.y === b.y ? battle.west[a.y * GRID + Math.max(a.x, b.x)] : battle.north[Math.max(a.y, b.y) * GRID + a.x]
}

/** Whether a unit may step between two neighbouring tiles: no wall or window in the way, and on a diagonal, none at the corner it turns. */
export function passable(battle: Battle, from: Tile, to: Tile): boolean {
  if (from.x === to.x || from.y === to.y) return edgeBetween(battle, from, to) === 'none'
  // Both ways round the corner: through the tile beside `from` on `to`'s column, and through the one on its row.
  const open = (ax: number, ay: number, bx: number, by: number) =>
    (ay === by ? battle.west[ay * GRID + Math.max(ax, bx)] : battle.north[Math.max(ay, by) * GRID + ax]) === 'none'
  return open(from.x, from.y, to.x, from.y) && open(to.x, from.y, to.x, to.y) && open(from.x, from.y, from.x, to.y) && open(from.x, to.y, to.x, to.y)
}

/**
 * A battle's walking graph and the distance fields found on it. Both follow from terrain and the units that never move,
 * such as a hive node, which stand as walls: wreck forgets them, and so does such a unit's death.
 */
const walks = new WeakMap<Battle, { fixed: string; into: [from: number, cost: number][][]; fields: Map<number, number[]> }>()

/** For each tile, the open tiles a unit can step onto it from, with each step's cost. */
function walkGraph(battle: Battle) {
  // A civilian waits to be reached, not to wall a way off: it leaves once a soldier is beside it.
  const still = battle.units.filter((u) => u.stats.move === 0 && u.hp > 0 && !u.civilian)
  const fixed = still.map((u) => u.y * GRID + u.x).join()
  let walk = walks.get(battle)
  if (walk?.fixed === fixed) return walk
  const into = Array.from({ length: GRID * GRID }, (_, t) => {
    const tile = { x: t % GRID, y: Math.floor(t / GRID) }
    return NEIGHBORS.flatMap(([dx, dy]): [number, number][] => {
      const from = { x: tile.x + dx, y: tile.y + dy }
      return onGrid(from.x, from.y) && coverAt(battle, from.x, from.y) === 0 && !still.some((u) => u.x === from.x && u.y === from.y) && passable(battle, tile, from) ? [[from.y * GRID + from.x, stepCost(battle, from, tile)]] : []
    })
  })
  walk = { fixed, into, fields: new Map() }
  walks.set(battle, walk)
  return walk
}

/** Walking distance from every tile to `goal`, row by row, ignoring units that move. Infinity where no path exists. Do not change it: it is shared. */
export function walkingDistances(battle: Battle, goal: Tile): readonly number[] {
  const { into, fields } = walkGraph(battle)
  const start = goal.y * GRID + goal.x
  const known = fields.get(start)
  if (known) return known
  const field = Array<number>(GRID * GRID).fill(Infinity)
  field[start] = 0
  // Tiles by distance found, nearest first: a step costs 1 to 1 + 2 * CLIMB, so each bucket is settled before the next.
  const buckets: number[][] = [[start]]
  for (let d = 0; d < buckets.length; d++) {
    for (const tile of buckets[d] ?? []) {
      if (field[tile] !== d) continue
      for (const [from, step] of into[tile]) {
        if (d + step >= field[from]) continue
        field[from] = d + step
        ;(buckets[d + step] ??= []).push(from)
      }
    }
  }
  fields.set(start, field)
  return field
}

/** Whether nothing may stand on the tile: it is off the grid, cover, or occupied. */
export function blocked(battle: Battle, x: number, y: number): boolean {
  return !onGrid(x, y) || coverAt(battle, x, y) > 0 || unitAt(battle, x, y) !== undefined
}

/** Whether the unit hunts its enemies: an alien once its pod is alert. Humans always do. */
export const alert = (battle: Battle, unit: Unit) => unit.pod === null || battle.pods[unit.pod].alert

/** Whether a unit belongs to a pod the squad has seen and that has not noticed it: one the squad is setting an ambush on. */
export const unaware = (battle: Battle, unit: Unit) => unit.pod !== null && battle.pods[unit.pod].revealed && !battle.pods[unit.pod].alert

/** A soldier of the squad: not a civilian, nor a mech, which fights for the squad but cannot hold the field alone. */
export const isSoldier = (unit: Unit) => unit.side === 'human' && unit.soldier !== null

/** Whether the unit is in the open: an alien once its pod is revealed, any human always. */
export function revealed(battle: Battle, unit: Unit): boolean {
  return unit.pod === null || battle.pods[unit.pod].revealed
}

/** The open tile nearest `tile` as the crow flies. */
function openNear(battle: Battle, tile: Tile): Tile {
  for (let reach = 0; ; reach++) {
    for (let y = tile.y - reach; y <= tile.y + reach; y++) {
      for (let x = tile.x - reach; x <= tile.x + reach; x++) if (onGrid(x, y) && distance(tile, { x, y }) === reach && !blocked(battle, x, y)) return { x, y }
    }
  }
}

/** The `count` free tiles nearest `centre` by walking, nearest first. */
export function freeTilesNear(battle: Battle, centre: Tile, count: number): Tile[] {
  const found: Tile[] = []
  const seen = new Set([centre.y * GRID + centre.x])
  const queue = [centre]
  for (const tile of queue) {
    if (!blocked(battle, tile.x, tile.y)) found.push(tile)
    if (found.length === count) break
    for (const [dx, dy] of NEIGHBORS) {
      const x = tile.x + dx
      const y = tile.y + dy
      if (!onGrid(x, y) || coverAt(battle, x, y) > 0 || seen.has(y * GRID + x) || !passable(battle, tile, { x, y })) continue
      seen.add(y * GRID + x)
      queue.push({ x, y })
    }
  }
  return found
}

const randomTile = (battle: Battle): Tile => ({ x: randomInt(battle, GRID), y: randomInt(battle, GRID) })

/**
 * A random open tile at least `clearance` from every tile in `avoid`, in the part of the map `within` allows; the
 * clearance shrinks if the map is too crowded, and in the end any part of the map will do.
 */
export function spacedTile(battle: Battle, avoid: Tile[], clearance: number, within: Within = 'anywhere'): Tile {
  const depth = edgeDepths(battle)
  for (let tries = 0; ; tries++) {
    const tile = randomTile(battle)
    const needed = clearance - Math.floor(tries / 200)
    const placed = tries > 2000 || inPart(depth[tile.y * GRID + tile.x], within)
    if (placed && coverAt(battle, tile.x, tile.y) === 0 && avoid.every((other) => distance(tile, other) >= needed)) return tile
  }
}

/**
 * The battlefield's two borders. Its outer border is the edge of the map the squad can walk; its inner border lies
 * INNER tiles within. Inside the inner border stands what the battle is about: the pods, the uplink, the caches.
 * Civilians may be anywhere. Between the two, the edge, is where the squad comes in and gets out; the outermost tiles are left free.
 */
export const INNER = 7
const EDGE_GAP = 2
export type Within = 'anywhere' | 'inner' | 'edge'

const inPart = (depth: number, within: Within) => within === 'anywhere' || (within === 'inner' ? depth > INNER : depth >= EDGE_GAP && depth <= INNER)

const depths = new WeakMap<Battle, number[]>()

/** How far each tile lies inside the battlefield: 1 on its outermost tiles, 0 off it. */
export function edgeDepths(battle: Battle): number[] {
  const known = depths.get(battle)
  if (known) return known
  const depth = Array<number>(GRID * GRID).fill(0)
  const queue: number[] = []
  battle.ground.forEach((g, t) => {
    if (g === 'void') return
    const x = t % GRID
    const y = Math.floor(t / GRID)
    const rim = NEIGHBORS.some(([dx, dy]) => !onGrid(x + dx, y + dy) || battle.ground[(y + dy) * GRID + x + dx] === 'void')
    if (!rim) return
    depth[t] = 1
    queue.push(t)
  })
  for (let i = 0; i < queue.length; i++) {
    const t = queue[i]
    for (const [dx, dy] of NEIGHBORS) {
      const x = (t % GRID) + dx
      const y = Math.floor(t / GRID) + dy
      const n = y * GRID + x
      if (!onGrid(x, y) || battle.ground[n] === 'void' || depth[n] > 0) continue
      depth[n] = depth[t] + 1
      queue.push(n)
    }
  }
  depths.set(battle, depth)
  return depth
}

/** The open tile of the edge nearest `tile`. */
export function edgeNear(battle: Battle, tile: Tile): Tile {
  const depth = edgeDepths(battle)
  let best: Tile | null = null
  for (let t = 0; t < GRID * GRID; t++) {
    const at = { x: t % GRID, y: Math.floor(t / GRID) }
    if (!inPart(depth[t], 'edge') || blocked(battle, at.x, at.y)) continue
    if (!best || distance(at, tile) < distance(best, tile)) best = at
  }
  return best ?? openNear(battle, tile)
}

/** How far to either side of an escape route its aliens stand. */
const ROUTE_WIDTH = 5

/** The aliens near the straight way from an escape's start to an escape zone. */
export function onTheWay(battle: Battle, zone: Tile): Unit[] {
  const start = battle.start!
  const steps = Math.max(1, distance(start, zone))
  const line = Array.from({ length: steps + 1 }, (_, i) => ({ x: Math.round(start.x + ((zone.x - start.x) * i) / steps), y: Math.round(start.y + ((zone.y - start.y) * i) / steps) }))
  return battle.units.filter((u) => u.side === 'alien' && line.some((tile) => distance(tile, u) <= ROUTE_WIDTH))
}

/** The alien nearest a tile, if any. */
export const nearestAlien = (battle: Battle, tile: Tile): Unit | undefined =>
  battle.units.filter((u) => u.side === 'alien').reduce<Unit | undefined>((best, u) => (!best || distance(tile, u) < distance(tile, best) ? u : best), undefined)

/** What a landing zone offers: cover tiles in and around it, and the distance to the nearest alien. */
export function zoneInfo(battle: Battle, zone: Tile): { cover: number; contact: number; high: number } {
  let cover = 0
  let top = 0
  for (let y = zone.y - ZONE_RADIUS; y <= zone.y + ZONE_RADIUS; y++) {
    for (let x = zone.x - ZONE_RADIUS; x <= zone.x + ZONE_RADIUS; x++) {
      if (!onGrid(x, y)) continue
      if (coverAt(battle, x, y) > 0) cover++
      else top = Math.max(top, heightAt(battle, { x, y }))
    }
  }
  const alien = nearestAlien(battle, zone)
  return { cover, contact: alien ? distance(zone, alien) : Infinity, high: alien ? top - heightAt(battle, alien) : 0 }
}

/** What each plan is called, and what it does, for the player. */
export const PLANS: Record<Plan, { name: string; icon: string; text: string }> = {
  // The plain way in, from the edge, unseen, needs no name.
  march: { name: '', icon: '', text: '' },
  hot: { name: 'Hot drop', icon: '☄️', text: 'Land right on a pod: the drop pods hit it and it is ambushed, but every other pod hears and converges' },
  stealth: { name: 'Parachute drop', icon: '🪂', text: 'Drop unseen anywhere clear of every pod, deep in, and creep in to set ambushes' },
  decap: { name: 'Decapitation', icon: '🗡️', text: 'Land on the commander: it is ambushed, but every guard converges on the squad' },
  overwatch: { name: 'Overwatch', icon: '🔭', text: "Land on high ground at range from the commander; its pod sees the squad coming" },
  bait: { name: 'Bait', icon: '🪤', text: 'Land far off: the guards come for the squad, leaving the commander alone' },
  uplink: { name: 'Drop on the uplink', icon: '📡', text: 'The drop pods land right beside the uplink' },
  escape: { name: 'Way out', icon: '🚁', text: 'Break out toward this escape zone' },
  team: { name: 'Team', icon: '👥', text: 'Where a team lands' },
}

/**
 * What landing at a zone means. Exterminate and raid: a quiet march in from the edge; with a relic, a hot drop onto a
 * pod or a parachute drop anywhere clear of every pod.
 * Assassinate: a decapitation onto the commander, an overwatch on high ground at range, or bait far off that draws the
 * guards away. Hold: which uplink to hold. Escape: which way out. A rescue's zones are where its teams land.
 */
export type Plan = 'march' | 'hot' | 'stealth' | 'decap' | 'overwatch' | 'bait' | 'uplink' | 'escape' | 'team'

/** The supply caches a raid can grab, at most. */
export const CACHES = 3

/**
 * Lands the whole squad on the free tiles nearest the zone's centre, as the zone's plan has it, and begins the battle.
 * Split into `teams`, each team lands at its own zone instead.
 * A hot drop or a decapitation breaches: the pod beneath is caught unaware and loses its first alien turn's shots, its
 * members take the impact in the first beat, and every other pod hears the landing and converges on it. An overwatch
 * alerts the commander's pod; bait draws every other pod to the landing. A hold's zone is the uplink it holds.
 */
export function land(battle: Battle, zone: Tile, teams = 1): void {
  const plan = battle.plans[battle.zones.indexOf(zone)]
  battle.landed = plan
  if (plan === 'hot' || plan === 'decap') {
    battle.breach = true
    battle.concealed = false
    const under = nearestAlien(battle, zone)!.pod!
    battle.pods.forEach((pod, i) => {
      if (i === under) Object.assign(pod, { revealed: true, alert: true, ambushed: true, surprised: true })
      else pod.waypoint = zone
    })
  }
  const commander = battle.units.find((u) => u.target)
  if (plan === 'overwatch' && commander) Object.assign(battle.pods[commander.pod!], { revealed: true, alert: true })
  if (plan === 'bait') battle.pods.forEach((pod, i) => i !== commander?.pod && (pod.waypoint = zone))
  // On an escape the zone is where the squad makes for. The Hunter has found it; the packs across the ways out are
  // in sight but have yet to notice it.
  if (battle.start) {
    battle.escape = zone
    battle.concealed = false
    battle.pods.forEach((pod, i) => Object.assign(pod, { revealed: true, alert: i === 0 }))
  }
  // Split up, each team lands at its own zone, the soldiers dealt among them in turn.
  const tiles = Array.from({ length: teams }, (_, t) => freeTilesNear(battle, teams > 1 ? battle.zones[t] : (battle.start ?? zone), battle.reserve.length))
  battle.reserve.forEach((soldier, i) => {
    battle.units.push(soldierUnit(battle, soldier, tiles[i % teams][Math.floor(i / teams)], i % teams))
  })
  battle.reserve = []
  battle.phase = 'battle'
  const squad = battle.units.filter((u) => u.side === 'human' && !u.civilian)
  dropRelics(battle, squad, [...new Set(squad.map((u) => (teams > 1 ? battle.zones[u.team] : (battle.start ?? zone))))])
  // A barrier projector armors every squadmate of its carrier.
  for (const carrier of squad.filter((u) => u.effects.includes('barrier'))) {
    for (const mate of squad) if (mate !== carrier) mate.armor += BARRIER_ARMOR
  }
}

/** Lays each soldier the aliens hold on a recovery beside a pod, in turn. */
export function holdCaptives(battle: Battle, captives: Reserve[]): void {
  battle.captives = captives
  const pods = battle.pods.map((_, i) => battle.units.find((u) => u.pod === i)!).filter(Boolean)
  captives.forEach((captive, i) => {
    const [tile] = freeTilesNear(battle, pods[i % pods.length], 12).filter((t) => !battle.downed.some((d) => d.x === t.x && d.y === t.y))
    battle.downed.push({ soldier: captive.soldier, ...tile, carrier: null })
  })
}

/** A soldier's unit, landing from the reserve on `tile`. */
export function soldierUnit(battle: Battle, soldier: Reserve, tile: Tile, team = 0): Unit {
  return { id: battle.nextId++, side: 'human', ...tile, armor: soldier.stats.armor, pod: null, spent: [], burning: 0, chilled: 0, rooted: 0, booming: 0, fury: 0, kind: null, boss: false, spawns: false, target: false, resists: [], civilian: false, summoner: null, team, panicked: false, moved: false, suppressed: 0, marked: false, cooldown: 0, order: null, ...soldier }
}

/** An orbital strike's threat, and the damage it does every alien, never killing one. */
export const STRIKE = { threat: 2, damage: 5 }

/** Tiles weighed for each zone of a distinct kind. */
const CANDIDATES = 40

/** Lays out the zones a battle offers and what each means, by its goal; see Plan. `centres` are where the pods stand. */
function planZones(battle: Battle, centres: Tile[]): void {
  const clear = (within: Within = 'edge') => spacedTile(battle, [...battle.units, ...battle.zones], ZONE_CLEARANCE, within)
  // A zone the squad can walk off and the aliens can walk to: high ground may be a ledge with no way down.
  const anchor = centres[0]
  const joined = (t: Tile) => !anchor || (walkingDistances(battle, anchor)[t.y * GRID + t.x] < Infinity && walkingDistances(battle, t)[anchor.y * GRID + anchor.x] < Infinity)
  // Zones clear of every pod differ in kind, one each in turn: the highest ground over the aliens, the heaviest cover,
  // the nearest to them. Which suits a squad depends on who is in it.
  const kinds = [(i: ReturnType<typeof zoneInfo>) => i.high, (i: ReturnType<typeof zoneInfo>) => i.cover, (i: ReturnType<typeof zoneInfo>) => -i.contact]
  let next = randomInt(battle, kinds.length)
  const distinct = (within: Within = 'edge') => {
    const score = kinds[next++ % kinds.length]
    const sampled = Array.from({ length: CANDIDATES }, () => clear(within))
    const options = sampled.filter(joined).length > 0 ? sampled.filter(joined) : sampled
    return options.reduce((a, b) => (score(zoneInfo(battle, b)) > score(zoneInfo(battle, a)) ? b : a))
  }
  const add = (zone: Tile, plan: Plan) => {
    battle.zones.push(zone)
    battle.plans.push(plan)
  }
  const held = (effect: RelicEffect) => battle.reserve.some((r) => r.effects.includes(effect))
  const goal = battle.goal
  if (goal === 'escape') battle.plans = battle.zones.map((): Plan => 'escape')
  // A rescue lands wherever its teams scatter to: zones far apart, one for each team it might split into.
  else if (goal === 'rescue') while (battle.zones.length < TEAMS) add(spacedTile(battle, [...battle.units.filter((u) => u.side === 'alien'), ...battle.zones], 2 * ZONE_CLEARANCE, 'edge'), 'team')
  else if (goal === 'hold') {
    // The uplink stands within; the squad comes at it from the edge, or with drop pods, lands on it.
    battle.uplink = clear('inner')
    if (held('dropPods')) add(battle.uplink, 'uplink')
    while (battle.zones.length < ZONES) add(distinct(), 'march')
  } else if (goal === 'assassinate') {
    const commander = battle.units.find((u) => u.target)!
    // Landing on the commander takes drop pods, and on high ground over it parachutes; else the squad comes in from the edge.
    if (held('dropPods')) add({ x: commander.x, y: commander.y }, 'decap')
    // The highest open tile at range from the commander, clear of its guards.
    const ring = Array.from({ length: GRID * GRID }, (_, t) => ({ x: t % GRID, y: Math.floor(t / GRID) })).filter(
      (t) => !blocked(battle, t.x, t.y) && distance(t, commander) >= 7 && distance(t, commander) <= 10 && battle.units.every((u) => u.side !== 'alien' || distance(u, t) >= 4) && joined(t),
    )
    if (held('canopies')) add(ring.length > 0 ? ring.reduce((a, b) => (heightAt(battle, b) > heightAt(battle, a) ? b : a)) : clear(), 'overwatch')
    add(spacedTile(battle, [commander, ...battle.zones], 2 * ZONE_CLEARANCE, 'edge'), 'bait')
    while (battle.zones.length < ZONES) add(distinct(), 'march')
  } else if (goal === 'raid') {
    // A raid lands once, clear of the guards; its choice is how many caches to go for. Each stands by a pod, guarded.
    add(distinct(), 'march')
    battle.caches = Array.from({ length: CACHES }, (_, i) => (centres[i] ? (freeTilesNear(battle, centres[i], 4)[3] ?? centres[i]) : clear('inner')))
  } else {
    // Exterminate: quiet approaches from the edge; Orbital Drop Pods make one a hot drop onto a pod, Night Canopies one a
    // parachute drop anywhere within.
    if (held('dropPods') && centres.length > 0) add(centres[randomInt(battle, centres.length)], 'hot')
    if (held('canopies')) add(distinct('anywhere'), 'stealth')
    while (battle.zones.length < ZONES) add(distinct(), 'march')
  }
}

/** How near a landing the drop pods' relics reach aliens. */
export const POD_REACH = 4
/** The damage Impact Charges add to the drop pods' impact. */
export const POD_BLAST = 3
/** A drop turret: it never moves, and shoots far and true. */
const TURRET: Stats = { ...BASE_STATS, hp: 8, aim: 0.7, damage: 3, range: 7, move: 0, crit: 0.1 }

/**
 * What the squad's drop pod relics do where it lands: hurt, strip or chill the aliens near, raise full cover beside each
 * soldier toward the nearest alien, or drop a turret.
 */
function dropRelics(battle: Battle, squad: Unit[], spots: Tile[]): void {
  const held = (effect: RelicEffect) => squad.some((u) => u.effects.includes(effect))
  // The impact lands in the first beat; these relics give every landing one, reaching farther.
  if (held('podBlast') || held('podShred') || held('podFrost')) battle.breach = true
  for (const spot of spots) {
    for (const alien of battle.units.filter((u) => u.side === 'alien' && distance(u, spot) <= POD_REACH)) {
      if (held('podShred')) alien.armor = 0
      if (held('podFrost') && !alien.resists.includes('frost')) alien.chilled = CHILL_TURNS
    }
    if (held('podTurret')) {
      const owner = squad.find((u) => distance(u, spot) <= ZONE_RADIUS) ?? squad[0]
      const open = walkingDistances(battle, owner).filter(Number.isFinite).length
      // The nearest free tile where the turret, which never moves, cuts no ground off from the squad.
      for (const tile of freeTilesNear(battle, spot, 6)) {
        const turret = mechUnit(battle, owner, TURRET, [], tile)
        battle.units.push(turret)
        if (walkingDistances(battle, owner).filter(Number.isFinite).length >= open - 1) break
        battle.units.splice(battle.units.indexOf(turret), 1)
      }
    }
  }
  if (!held('podWall')) return
  walks.delete(battle)
  for (const soldier of squad) {
    const toward = nearestAlien(battle, soldier) ?? { x: GRID >> 1, y: GRID >> 1 }
    // The free tile beside the soldier nearest that alien.
    const tile = NEIGHBORS.map(([dx, dy]) => ({ x: soldier.x + dx, y: soldier.y + dy }))
      .filter((t) => onGrid(t.x, t.y) && !blocked(battle, t.x, t.y))
      .sort((a, b) => distance(a, toward) - distance(b, toward))[0]
    if (!tile) continue
    const t = tile.y * GRID + tile.x
    const open = walkingDistances(battle, soldier).filter(Number.isFinite).length
    battle.props[t] = 'stack'
    battle.cover[t] = PROP_COVER.stack
    walks.delete(battle)
    // Cover that would cut ground off from the soldier is not raised.
    if (walkingDistances(battle, soldier).filter(Number.isFinite).length < open - 1) {
      battle.props[t] = 'none'
      battle.cover[t] = 0
      walks.delete(battle)
    }
  }
}

/** Fills every open tile outside the largest walkable area with stacks, so any open tile can reach any other. */
function sealPockets(battle: Battle): void {
  const area = Array<number>(GRID * GRID).fill(-1)
  const sizes: number[] = []
  for (let start = 0; start < GRID * GRID; start++) {
    if (battle.cover[start] > 0 || area[start] >= 0) continue
    area[start] = sizes.length
    const queue = [start]
    for (const tile of queue) {
      for (const [dx, dy] of NEIGHBORS) {
        const x = (tile % GRID) + dx
        const y = Math.floor(tile / GRID) + dy
        const from = { x: tile % GRID, y: Math.floor(tile / GRID) }
        if (!onGrid(x, y) || battle.cover[y * GRID + x] > 0 || area[y * GRID + x] >= 0 || !passable(battle, from, { x, y })) continue
        area[y * GRID + x] = sizes.length
        queue.push(y * GRID + x)
      }
    }
    sizes.push(queue.length)
  }
  const largest = sizes.indexOf(Math.max(...sizes))
  area.forEach((id, tile) => {
    if (id < 0 || id === largest) return
    battle.cover[tile] = 2
    battle.props[tile] = 'stack'
  })
}

/** A new alien unit on a tile, in a pod. */
export function alienUnit(battle: Battle, alien: Alien, tile: Tile, pod: number): Unit {
  return {
    id: battle.nextId++,
    side: 'alien',
    ...tile,
    hp: alien.stats.hp,
    armor: alien.stats.armor,
    ...alien,
    soldier: null,
    pod,
    ability: null,
    // A hive node's charges are the swarmlings left in it.
    charges: alien.kind === 'hiveNode' ? NODE_SPAWNS : 0,
    // A commander blinks to safety once wounded.
    effects: alien.target ? ['blink'] : [],
    spent: [],
    burning: 0,
    chilled: 0,
    rooted: 0,
    booming: 0,
    fury: 0,
    civilian: false,
    summoner: null,
    team: 0,
    panicked: false,
    moved: false,
    suppressed: 0,
    marked: false,
    order: null,
    cooldown: alien.spawns ? SPAWN_EVERY : alien.kind === 'incubator' ? HATCH_TURNS : 0,
  }
}

/** A mech built by the engineer `owner`, with `stats` and the `effects` its skills give it, standing on `tile`. */
export function mechUnit(battle: Battle, owner: Unit, stats: Stats, effects: Effect[], tile: Tile): Unit {
  return { id: battle.nextId++, side: 'human', ...tile, hp: stats.hp, armor: stats.armor, stats, soldier: null, pod: null, ability: null, charges: 0, stance: 'rush', effects, spent: [], burning: 0, chilled: 0, rooted: 0, booming: 0, fury: 0, kind: null, boss: false, spawns: false, target: false, resists: [], civilian: false, summoner: owner.soldier, team: battle.units.find((u) => u.soldier === owner.soldier)?.team ?? 0, panicked: false, moved: false, suppressed: 0, marked: false, cooldown: 0, order: null }
}

/** Places a pack as a new pod around `centre`. */
export function placePod(battle: Battle, pack: { name: string; aliens: Alien[] }, centre: Tile, revealed: boolean, guard = false): Unit[] {
  const units = freeTilesNear(battle, centre, pack.aliens.length).map((tile, i) => alienUnit(battle, pack.aliens[i], tile, battle.pods.length))
  battle.units.push(...units)
  battle.pods.push({ name: pack.name, revealed, alert: revealed, stalking: false, ambushed: false, surprised: false, reeling: false, stalked: 0, guard, waypoint: randomTile(battle) })
  return units
}

/**
 * A battle awaiting the squad's landing, with terrain, alien pods, and landing zones placed. A hold keeps half its
 * packs back as waves; a rescue is a terror site, its aliens in the open and its civilians fleeing them.
 */
/** The share of packs, outside an escape's ways out, that hold their post as guards. */
const GUARD_SHARE = 0.25
/** The most teams a rescue can split the squad into. */
export const TEAMS = 4

/** How far from the squad and the ways out an escape's Hunter starts. */
const HUNTER_START = 12

/** Tiles apart a rescue's civilians start, from each other and the aliens. */
const CIVILIAN_CLEARANCE = 3

export function createBattle(seed: number, kind: TerrainKind, packs: { name: string; aliens: Alien[] }[], reserve: Reserve[], goal: Goal = 'exterminate', rules: Rule[] = [], twist: Twist | null = null, place?: Locale): Battle {
  const holder = { rng: seed }
  const terrain = generateTerrain(holder, GRID, kind, twist, place)
  const battle: Battle = {
    rng: holder.rng,
    goal,
    rules,
    twist,
    round: 0,
    // An escape's packs after its Hunter, and all of a recovery's, come on a second time, as waves.
    waves: goal === 'hold' ? packs.slice(Math.ceil(packs.length / 2)) : goal === 'escape' ? packs.slice(1) : goal === 'recover' ? [...packs] : [],
    beat: 0,
    phase: 'deploy',
    turn: 'human',
    stage: 'move',
    shooter: 0,
    attacks: 0,
    winner: null,
    units: [],
    nextId: 1,
    place: kind,
    ...terrain,
    cover: terrain.props.map((prop) => PROP_COVER[prop]),
    pods: [],
    used: [],
    concealed: true,
    acid: [],
    fire: [],
    caltrops: [],
    husks: [],
    saved: 0,
    held: 0,
    actor: null,
    tally: {},
    zones: [],
    uplink: null,
    start: null,
    escape: null,
    escaped: [],
    lifted: {},
    plans: [],
    landed: null,
    caches: [],
    greed: 0,
    grabbed: 0,
    breach: false,
    strike: false,
    reserve,
    downed: [],
    captives: [],
  }
  sealPockets(battle)
  if (goal === 'escape') {
    // Ambushed at one corner, with the ways out across the map at the far one and the edges beside it.
    const { x1, y1, x2, y2 } = battle.bounds
    const corners = [{ x: x1 + 2, y: y1 + 2 }, { x: x2 - 2, y: y1 + 2 }, { x: x2 - 2, y: y2 - 2 }, { x: x1 + 2, y: y2 - 2 }]
    const corner = randomInt(battle, corners.length)
    const far = corners[(corner + 2) % corners.length]
    const mid = { x: (x1 + x2) >> 1, y: (y1 + y2) >> 1 }
    battle.start = edgeNear(battle, corners[corner])
    for (const exit of [far, { x: far.x, y: mid.y }, { x: mid.x, y: far.y }]) battle.zones.push(edgeNear(battle, exit))
  }

  const centres: Tile[] = []
  packs.slice(0, goal === 'hold' ? packs.length - battle.waves.length : packs.length).forEach((pack, i) => {
    // On an escape the Hunter starts far off, and each pack after it stands across one of the ways out.
    const route = battle.start && i > 0 ? battle.zones[(i - 1) % ZONES] : null
    const along = route ? 0.4 + 0.4 * random(battle) : 0
    const centre = route
      ? openNear(battle, { x: Math.round(battle.start!.x + (route.x - battle.start!.x) * along), y: Math.round(battle.start!.y + (route.y - battle.start!.y) * along) })
      : battle.start
        ? spacedTile(battle, [battle.start, ...battle.zones], HUNTER_START)
        : spacedTile(battle, centres, ZONE_CLEARANCE, 'inner')
    centres.push(centre)
    // A terror site has no stealth: every alien is in the open and already killing.
    const terror = goal === 'rescue'
    placePod(battle, pack, centre, terror, !route && !terror && random(battle) < GUARD_SHARE)
  })
  if (goal === 'rescue') {
    battle.concealed = false
    // Civilians scattered about the map, in the open, fleeing the aliens.
    for (let i = 0; i < CIVILIANS; i++) {
      const tile = spacedTile(battle, battle.units, CIVILIAN_CLEARANCE)
      const stats = { ...BASE_STATS, hp: CIVILIAN_HP, aim: 0, damage: 0, range: 0, move: CIVILIAN_MOVE, crit: 0 }
      battle.units.push({ id: battle.nextId++, side: 'human', ...tile, hp: stats.hp, armor: 0, stats, soldier: null, pod: null, ability: null, charges: 0, stance: 'anchor', effects: [], spent: [], burning: 0, chilled: 0, rooted: 0, booming: 0, fury: 0, kind: null, boss: false, spawns: false, target: false, resists: [], civilian: true, summoner: null, team: 0, panicked: false, moved: false, suppressed: 0, marked: false, cooldown: 0, order: null })
    }
  }
  planZones(battle, centres)
  return battle
}
