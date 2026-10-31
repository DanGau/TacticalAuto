// Creating a battle: its state, its encounter, the aliens, civilians and goals placed by it.
import { type Battle, type Tile, type Reserve, GRID, type Unit, type Alien } from './battle'
import { onGrid, distance, freeTilesNear, walkingDistances, spacedTile, NEIGHBORS, passable, openNear, walks } from './grid'
import { alienUnit, civilianUnit } from './spawn'
import { PROP_BULK, type TerrainKind, type Locale } from './terrain'
import type { Rule } from './doctrines'
import { type Goal, VIP_HP, CIVILIANS, CIVILIAN_HP } from './goals'
import { generateTerrain } from './terrain-gen'
import type { Twist } from './twists'
import { deploy, planEntrances } from './entrances'
import { ARENA_REACH, designEncounter } from './encounter'

/** Lays each soldier the aliens hold on a recovery beside an alien, in turn. */
export function holdCaptives(battle: Battle, captives: Reserve[]): void {
  battle.captives = captives
  const guards = battle.units.filter((u) => u.side === 'alien')
  captives.forEach((captive, i) => {
    const [tile] = freeTilesNear(battle, guards[i % guards.length], 12).filter((t) => !battle.downed.some((d) => d.x === t.x && d.y === t.y))
    battle.downed.push({ soldier: captive.soldier, ...tile, carrier: null })
  })
}

/** Fills every open tile outside the largest walkable area with stacks, so any open tile can reach any other. */
export function sealPockets(battle: Battle): void {
  const area = Array<number>(GRID * GRID).fill(-1)
  const sizes: number[] = []
  for (let start = 0; start < GRID * GRID; start++) {
    if (battle.bulk[start] > 0 || area[start] >= 0) continue
    area[start] = sizes.length
    const queue = [start]
    for (const tile of queue) {
      for (const [dx, dy] of NEIGHBORS) {
        const x = (tile % GRID) + dx
        const y = Math.floor(tile / GRID) + dy
        const from = { x: tile % GRID, y: Math.floor(tile / GRID) }
        if (!onGrid(x, y) || battle.bulk[y * GRID + x] > 0 || area[y * GRID + x] >= 0 || !passable(battle, from, { x, y })) continue
        area[y * GRID + x] = sizes.length
        queue.push(y * GRID + x)
      }
    }
    sizes.push(queue.length)
  }
  const largest = sizes.indexOf(Math.max(...sizes))
  area.forEach((id, tile) => {
    if (id < 0 || id === largest) return
    battle.bulk[tile] = 2
    battle.props[tile] = 'stack'
  })
  walks.delete(battle)
}

/** Places an alien on `tile`. One that never moves stands where it walls no ground off, as seen from across the map. */
export function placeAlien(battle: Battle, alien: Alien, tile: Tile, engaged = false, seen = true): Unit {
  const unit = alienUnit(battle, alien, tile, engaged, seen)
  if (unit.stats.move === 0) {
    const far = openNear(battle, { x: GRID - 1 - tile.x, y: GRID - 1 - tile.y })
    const open = walkingDistances(battle, far).filter(Number.isFinite).length
    const clear = freeTilesNear(battle, tile, 30).find((t) => {
      Object.assign(unit, t)
      battle.units.push(unit)
      const walls = walkingDistances(battle, far).filter(Number.isFinite).length < open - 1
      battle.units.pop()
      return !walls
    })
    Object.assign(unit, clear ?? tile)
  }
  battle.units.push(unit)
  return unit
}

/** Aliens a wave brings at a time. */
export const WAVE_SIZE = 3

/** `aliens` as waves. */
const inWaves = (aliens: Alien[]) => Array.from({ length: Math.ceil(aliens.length / WAVE_SIZE) }, (_, i) => aliens.slice(i * WAVE_SIZE, (i + 1) * WAVE_SIZE))

/** Tiles apart a rescue's civilians start, from each other and the aliens, and the farthest from the terror's heart. */
export const CIVILIAN_CLEARANCE = 4

export const TERROR_REACH = 10

/** The supply caches a raid can grab, at most. */
export const CACHES = 3

/**
 * A battle awaiting the squad's entrance, its encounter designed as one piece: see designEncounter. A hold keeps half
 * its aliens back as waves; a rescue's civilians are scattered about the terror's heart. An ambush has no entrance: the squad
 * is down in the arena's middle.
 */
export function createBattle(seed: number, kind: TerrainKind, aliens: Alien[], reserve: Reserve[], goal: Goal = 'exterminate', rules: Rule[] = [], twist: Twist | null = null, place?: Locale): Battle {
  const holder = { rng: seed }
  const terrain = generateTerrain(holder, GRID, kind, twist, place)
  const battle: Battle = {
    rng: holder.rng,
    goal,
    rules,
    twist,
    round: 0,
    // All of a recovery's aliens come on a second time, as waves.
    waves: goal === 'hold' ? inWaves(aliens.slice(Math.ceil(aliens.length / 2))) : goal === 'recover' ? inWaves(aliens) : [],
    beat: 0,
    phase: 'deploy',
    turn: 'human',
    stage: 'move',
    shooter: 0,
    attacks: 0,
    strides: {},
    winner: null,
    units: [],
    nextId: 1,
    place: kind,
    ...terrain,
    bulk: terrain.props.map((prop) => PROP_BULK[prop]),
    used: [],
    primed: [],
    acid: [],
    fire: [],
    caltrops: [],
    husks: [],
    saved: 0,
    vip: goal === 'vip' ? 'held' : null,
    held: 0,
    actor: null,
    tally: {},
    entrances: [],
    entered: null,
    arena: { x: 0, y: 0, reach: ARENA_REACH },
    approaches: [],
    gates: [],
    rallied: 0,
    spotlight: null,
    uplink: null,
    extract: null,
    escaped: [],
    lifted: {},
    caches: [],
    greed: 0,
    grabbed: 0,
    opening: false,
    reserve,
    downed: [],
    captives: [],
  }
  sealPockets(battle)
  const posted = goal === 'hold' ? aliens.slice(0, Math.ceil(aliens.length / 2)) : aliens
  const { spot, posts, heart } = designEncounter(battle, posted, goal)
  sealPockets(battle)
  const centre = openNear(battle, spot)
  const vip = goal === 'vip' ? centre : null
  if (goal === 'hold') battle.uplink = centre
  if (vip) battle.units.push(civilianUnit(battle, vip, VIP_HP, 'vip'))
  const ambush = goal === 'ambush'
  posted.forEach((alien, i) => placeAlien(battle, alien, posts[i]))
  if (ambush) {
    deploy(battle, centre)
    // The Hunter engages first, whoever stands nearest.
    for (const u of battle.units) if (u.side === 'alien') u.engaged = u.boss
    return battle
  }
  // A rescue's civilians are scattered about the terror's heart, half hiding where they are, half running from the aliens.
  if (heart) {
    for (let i = 0; i < CIVILIANS; i++) {
      let tile = spacedTile(battle, battle.units, CIVILIAN_CLEARANCE)
      for (let tries = 0; distance(tile, heart) > TERROR_REACH && tries < 500; tries++) tile = spacedTile(battle, battle.units, CIVILIAN_CLEARANCE - Math.floor(tries / 100))
      battle.units.push(civilianUnit(battle, tile, CIVILIAN_HP, i % 2 === 0 ? 'hider' : 'runner'))
    }
  }
  // A raid's caches each stand by an alien, guarded.
  if (goal === 'raid') battle.caches = Array.from({ length: CACHES }, (_, i) => {
    const guard = i < posts.length ? posts[Math.floor((i * posts.length) / CACHES)] : null
    return guard ? (freeTilesNear(battle, guard, 4)[3] ?? guard) : freeTilesNear(battle, spot, 40)[10 * i]
  })
  planEntrances(battle, heart)
  return battle
}
