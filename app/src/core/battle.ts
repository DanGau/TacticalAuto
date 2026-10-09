import { randomInt } from './rng'
import { generateTerrain, PROP_COVER, type Cover, type Edge, type Ground, type Prop, type TerrainKind } from './terrain'

export type { Cover }

export const GRID = 32
/** A battle still running at this beat ends as a draw. */
export const MAX_BEATS = 1000
/** Damage a crit adds. */
export const CRIT_BONUS = 2
/** Hit chance a target's cover removes, indexed by Cover. */
export const COVER_DEFENSE = [0, 0.2, 0.4]
/** Tiles within which a soldier with line of sight reveals an alien. */
export const SIGHT = 8
/** The most aliens that roam together. */
export const POD_SIZE = 3
/** Tiles an alien moves per turn before its pod is revealed. */
export const PATROL_MOVE = 2
/** Damage a rocket does to every unit within BLAST_RADIUS tiles of where it lands. */
export const ROCKET_DAMAGE = 4
export const BLAST_RADIUS = 1
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
/** Damage the executioner effect adds against a target at half health or less. */
export const EXECUTE_BONUS = 2
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

export const BASE_STATS: Stats = { hp: 10, aim: 0.75, damage: 3, range: 5, move: 4, crit: 0.5, close: 0.06 }

/** Something a unit does unprompted beyond moving and shooting; each is described where combat applies it. */
export type Ability = 'runAndGun' | 'rocket' | 'squadsight' | 'medic'

/** Something a unit's gear does; gear.ts says what each does and combat applies it. */
export type Effect = 'incendiary' | 'piercing' | 'vampiric' | 'executioner' | 'chain' | 'thorns' | 'shield' | 'regen' | 'lastStand' | 'medkit' | 'grenade'

/** How a unit chooses where to stand; each is described where combat applies it. */
export type Stance = 'balanced' | 'rush' | 'anchor' | 'standoff' | 'escort'

/** An alien to place in a battle. A boss is the one a key or final mission is about. */
export interface Alien {
  stats: Stats
  boss: boolean
}

/** A soldier waiting to land. */
export interface Reserve {
  soldier: number
  stats: Stats
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
  boss: boolean
}

/** A group of aliens. It patrols toward its waypoint, unseen, until a soldier sights a member; then it fights. */
export interface Pod {
  revealed: boolean
  /** Revealed during the current alien turn, so its members do not shoot until the next. */
  surprised: boolean
  waypoint: Tile
}

export interface Battle {
  rng: number
  /** Calls to stepBattle so far. */
  beat: number
  phase: 'deploy' | 'battle' | 'over'
  /** The side whose turn it is. A turn is one move stage, then one shot per unit. */
  turn: Side
  stage: 'move' | 'shoot'
  /** Id of the last unit to shoot this turn; 0 before the first shot. */
  shooter: number
  /** Set when phase is 'over'; null is a draw. */
  winner: Side | null
  units: Unit[]
  nextId: number
  /** The cover each tile's prop gives, one entry per tile, row by row; read it with coverAt. */
  cover: Cover[]
  ground: Ground[]
  props: Prop[]
  /** What stands on each tile's north edge and west edge; read them with edgeBetween. */
  north: Edge[]
  west: Edge[]
  pods: Pod[]
  /** Centres of the landing zones on offer in the deploy phase. */
  zones: Tile[]
  /** Soldiers not yet landed. */
  reserve: Reserve[]
}

/** Tiles between two points, counting a diagonal as one. */
export const distance = (a: Tile, b: Tile) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y))

export const NEIGHBORS = [[0, -1], [1, 0], [0, 1], [-1, 0], [1, -1], [1, 1], [-1, 1], [-1, -1]]

export const onGrid = (x: number, y: number) => x >= 0 && y >= 0 && x < GRID && y < GRID

export function coverAt(battle: Battle, x: number, y: number): Cover {
  return battle.cover[y * GRID + x]
}

export function unitAt(battle: Battle, x: number, y: number): Unit | undefined {
  return battle.units.find((u) => u.x === x && u.y === y)
}

/** Removes everything a blast catches: the props on tiles within BLAST_RADIUS of `centre`, and the walls and windows around those tiles. */
export function wreck(battle: Battle, centre: Tile): void {
  for (let y = centre.y - BLAST_RADIUS; y <= centre.y + BLAST_RADIUS; y++) {
    for (let x = centre.x - BLAST_RADIUS; x <= centre.x + BLAST_RADIUS; x++) {
      if (!onGrid(x, y)) continue
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

/** What stands on the line between two tiles that share a side. */
export function edgeBetween(battle: Battle, a: Tile, b: Tile): Edge {
  return a.y === b.y ? battle.west[a.y * GRID + Math.max(a.x, b.x)] : battle.north[Math.max(a.y, b.y) * GRID + a.x]
}

/** Whether a unit may step between two neighbouring tiles: no wall or window in the way, and on a diagonal, none at the corner it turns. */
export function passable(battle: Battle, from: Tile, to: Tile): boolean {
  if (from.x === to.x || from.y === to.y) return edgeBetween(battle, from, to) === 'none'
  const viaX = { x: to.x, y: from.y }
  const viaY = { x: from.x, y: to.y }
  return [viaX, viaY].every((via) => passable(battle, from, via) && passable(battle, via, to))
}

/** Whether nothing may stand on the tile: it is off the grid, cover, or occupied. */
export function blocked(battle: Battle, x: number, y: number): boolean {
  return !onGrid(x, y) || coverAt(battle, x, y) > 0 || unitAt(battle, x, y) !== undefined
}

/** Whether the alien fights in the open: humans always do, an alien once its pod is revealed. */
export function revealed(battle: Battle, unit: Unit): boolean {
  return unit.pod === null || battle.pods[unit.pod].revealed
}

/** The `count` free tiles nearest `centre` by walking, nearest first. */
function freeTilesNear(battle: Battle, centre: Tile, count: number): Tile[] {
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

/** A random open tile at least `clearance` from every tile in `avoid`; the clearance shrinks if the map is too crowded. */
function spacedTile(battle: Battle, avoid: Tile[], clearance: number): Tile {
  for (let tries = 0; ; tries++) {
    const tile = randomTile(battle)
    const needed = clearance - Math.floor(tries / 200)
    if (coverAt(battle, tile.x, tile.y) === 0 && avoid.every((other) => distance(tile, other) >= needed)) return tile
  }
}

/** What a landing zone offers: cover tiles in and around it, and the distance to the nearest alien. */
export function zoneInfo(battle: Battle, zone: Tile): { cover: number; contact: number } {
  let cover = 0
  for (let y = zone.y - ZONE_RADIUS; y <= zone.y + ZONE_RADIUS; y++) {
    for (let x = zone.x - ZONE_RADIUS; x <= zone.x + ZONE_RADIUS; x++) {
      if (onGrid(x, y) && coverAt(battle, x, y) > 0) cover++
    }
  }
  const aliens = battle.units.filter((u) => u.side === 'alien')
  return { cover, contact: Math.min(...aliens.map((u) => distance(zone, u))) }
}

/** Lands the whole squad on the free tiles nearest the zone's centre and begins the battle. */
export function land(battle: Battle, zone: Tile): void {
  const tiles = freeTilesNear(battle, zone, battle.reserve.length)
  battle.reserve.forEach((soldier, i) => {
    battle.units.push({ id: battle.nextId++, side: 'human', ...tiles[i], hp: soldier.stats.hp, pod: null, spent: [], burning: 0, boss: false, ...soldier })
  })
  battle.reserve = []
  battle.phase = 'battle'
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

/** A battle awaiting the squad's landing, with terrain, alien pods, and landing zones placed. */
export function createBattle(seed: number, kind: TerrainKind, aliens: Alien[], reserve: Reserve[]): Battle {
  const holder = { rng: seed }
  const terrain = generateTerrain(holder, GRID, kind)
  const battle: Battle = {
    rng: holder.rng,
    beat: 0,
    phase: 'deploy',
    turn: 'human',
    stage: 'move',
    shooter: 0,
    winner: null,
    units: [],
    nextId: 1,
    ...terrain,
    cover: terrain.props.map((prop) => PROP_COVER[prop]),
    pods: [],
    zones: [],
    reserve,
  }
  sealPockets(battle)

  // As few pods as POD_SIZE allows, of sizes as even as possible.
  const podCount = Math.ceil(aliens.length / POD_SIZE)
  const centres: Tile[] = []
  for (let pod = 0; pod < podCount; pod++) {
    const centre = spacedTile(battle, centres, ZONE_CLEARANCE)
    centres.push(centre)
    const members = aliens.filter((_, i) => i % podCount === pod)
    freeTilesNear(battle, centre, members.length).forEach((tile, i) => {
      battle.units.push({ id: battle.nextId++, side: 'alien', ...tile, hp: members[i].stats.hp, ...members[i], soldier: null, pod: battle.pods.length, ability: null, charges: 0, stance: 'balanced', effects: [], spent: [], burning: 0 })
    })
    battle.pods.push({ revealed: false, surprised: false, waypoint: randomTile(battle) })
  }
  while (battle.zones.length < ZONES) battle.zones.push(spacedTile(battle, [...battle.units, ...battle.zones], ZONE_CLEARANCE))
  return battle
}
