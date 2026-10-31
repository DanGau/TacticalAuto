// Designs a battle's encounter as one set-piece, as a DM prepares one: the ground, the overlook, the hazard, the objects, where each alien posts, the ways in and where reinforcements arrive.
import { GRID, type Alien, type Arena, type Battle, type Tile } from './battle'
import type { Goal } from './goals'
import { blocked, distance, edgeDepths, NEIGHBORS, onGrid, openNear, walkingDistances, walks } from './grid'
import { random, randomInt } from './rng'
import { PROP_BULK, type Prop, type TerrainKind } from './terrain'

/** How far from its centre the arena reaches, and how far out the camera shows it clear of props. */
export const ARENA_REACH = 14
const SIGHT_CLEAR = 22

/** Where an encounter's fight flows, in tiles along its axis from the ways in toward the overlook, and across it. */
type Mark = [along: number, across: number]

/** The objects heroes find in the heaps, low and tall, by where the fight is. */
const SCATTER: Partial<Record<TerrainKind, [Prop, Prop]>> = { countryside: ['crate', 'tree'], hive: ['growth', 'spire'], city: ['car', 'stack'], town: ['car', 'crate'] }

/** The overlook, a rise the aliens hold; the ledge, a low rise by a flank way in; the fuel tanks out in the open. */
const OVERLOOK: Mark = [9, 0]
const LEDGE: Mark = [-8, -9]
const HAZARD: Mark[] = [[3, -2], [4, 0], [3, 2]]
/** The gaps a brute holds: between the heaps, and down the middle. */
const CHOKES: Mark[] = [[-4, -7], [-4, 7], [1, 0], [5, -3], [5, 3]]
/** Heaps of things to hurl, beside each flank and down the middle. */
const HEAPS: Mark[] = [[-6, -6], [-6, 6], [-2, -8], [-2, 8], [6, -5], [6, 5]]
/** The ways in: head on, nearest the fight; a flank by the ledge; a flank by the heaps; a far side for an extra. */
const APPROACHES: Mark[] = [[-12, 0], [-8, -10], [-8, 10], [2, 13]]
/** Where reinforcements arrive: behind the aliens, and on each far flank. */
const GATES: Mark[] = [[13, 0], [8, -12], [8, 12], [-2, -13], [-2, 13]]

/** The rescue's terror's heart; where a commander, a boss and an ambush's Hunter post. */
const HEART: Mark = [2, 0]
const COMMANDER_POST: Mark = [11, 0]
const BOSS_POST: Mark = [9, 0]

/** How many aliens stand by what a mission is about; how far each likes to keep from the others, and must. */
const GUARDS = 2
const SPREAD = 7
const ELBOW_ROOM = 2

/** A random open tile far enough within the map's edge to hold the arena; in a building if `roofed` and one stands there. */
function arenaSpot(battle: Battle, roofed: boolean): Tile {
  const depth = edgeDepths(battle)
  const open = (margin: number, roof: boolean) =>
    battle.ground.flatMap((g, t) => (g !== 'void' && (!roof || g === 'floor') && depth[t] > margin && battle.bulk[t] === 0 ? [{ x: t % GRID, y: Math.floor(t / GRID) }] : []))
  for (let margin = ARENA_REACH; ; margin--) {
    const under = roofed ? open(margin, true) : []
    const spots = under.length > 0 ? under : open(margin, false)
    if (spots.length > 0) return spots[randomInt(battle, spots.length)]
  }
}

/** The floor tiles joined to `at`, if it stands on floor: the building it is in. */
function buildingAt(battle: Battle, at: Tile): Set<number> {
  const building = new Set<number>()
  const queue = [at]
  for (const { x, y } of queue) {
    const t = y * GRID + x
    if (!onGrid(x, y) || battle.ground[t] !== 'floor' || building.has(t)) continue
    building.add(t)
    queue.push(...NEIGHBORS.slice(0, 4).map(([dx, dy]) => ({ x: x + dx, y: y + dy })))
  }
  return building
}

/**
 * Opens the ground for the fight. Outdoor props come down out to SIGHT_CLEAR, water and the void aside; so, within the
 * arena, do buildings, but for `kept` and a compound's walls.
 */
function clearArena(battle: Battle, arena: Arena, kept: Set<number>): void {
  for (let y = arena.y - SIGHT_CLEAR; y <= arena.y + SIGHT_CLEAR; y++) {
    for (let x = arena.x - SIGHT_CLEAR; x <= arena.x + SIGHT_CLEAR; x++) {
      const d = Math.hypot(x - arena.x, y - arena.y)
      if (!onGrid(x, y) || d > SIGHT_CLEAR) continue
      const t = y * GRID + x
      const indoors = battle.ground[t] === 'floor'
      const razed = d <= ARENA_REACH && battle.place !== 'compound' && !kept.has(t)
      // A tile's north and west edges may be the walls of a kept building beside it.
      if (razed && !kept.has(t - GRID)) battle.north[t] = 'none'
      if (razed && !kept.has(t - 1)) battle.west[t] = 'none'
      if (battle.ground[t] === 'void' || battle.ground[t] === 'water' || (indoors && !razed)) continue
      battle.props[t] = 'none'
      battle.bulk[t] = 0
      if (indoors) battle.ground[t] = 'pavement'
    }
  }
}

/** Raises a mound about `at`, a level at `reach` and two at its crest, clear of what stands on it. */
function rise(battle: Battle, at: Tile, reach: number, crest: number): void {
  for (let y = at.y - reach; y <= at.y + reach; y++) {
    for (let x = at.x - reach; x <= at.x + reach; x++) {
      const d = Math.hypot(x - at.x, y - at.y)
      if (!onGrid(x, y) || d > reach || ['void', 'water', 'floor'].includes(battle.ground[y * GRID + x])) continue
      battle.height[y * GRID + x] = Math.max(battle.height[y * GRID + x], d <= crest ? 2 : 1)
    }
  }
}

/** Stands `prop` on an open tile near `at`, none touching another, so it walls nothing off. */
function stand(battle: Battle, at: Tile, prop: Prop): boolean {
  if (!onGrid(at.x, at.y) || blocked(battle, at.x, at.y) || battle.ground[at.y * GRID + at.x] === 'void') return false
  if (NEIGHBORS.some(([dx, dy]) => onGrid(at.x + dx, at.y + dy) && battle.bulk[(at.y + dy) * GRID + at.x + dx] > 0)) return false
  battle.props[at.y * GRID + at.x] = prop
  battle.bulk[at.y * GRID + at.x] = PROP_BULK[prop]
  return true
}

/**
 * Sets the arena and lays out the encounter for `goal`. Returns the arena's centre, a post for each alien, and on a
 * rescue the terror's heart. A VIP's building and a satellite's compound stay standing; all else in the arena comes down, and the props around it.
 */
export function designEncounter(battle: Battle, aliens: Alien[], goal: Goal): { spot: Tile; posts: Tile[]; heart: Tile | null } {
  const spot = arenaSpot(battle, goal === 'vip')
  const arena = { x: spot.x, y: spot.y, reach: ARENA_REACH }
  battle.arena = arena
  clearArena(battle, arena, goal === 'vip' ? buildingAt(battle, spot) : new Set())
  // The axis the fight flows along: of eight headings, the first whose both ends lie on the map, from a random start.
  const start = randomInt(battle, 8)
  const headings = Array.from({ length: 8 }, (_, i) => ((start + i) * Math.PI) / 4)
  const inMap = (a: number) => [1, -1].every((s) => onGrid(Math.round(spot.x + s * ARENA_REACH * Math.cos(a)), Math.round(spot.y + s * ARENA_REACH * Math.sin(a))))
  const heading = headings.find(inMap) ?? headings[0]
  const [fx, fy] = [Math.cos(heading), Math.sin(heading)]
  const raw = ([along, across]: Mark): Tile => {
    const clamp = (v: number) => Math.max(0, Math.min(GRID - 1, Math.round(v)))
    return { x: clamp(spot.x + fx * along - fy * across), y: clamp(spot.y + fy * along + fx * across) }
  }
  rise(battle, raw(OVERLOOK), 3, 1)
  rise(battle, raw(LEDGE), 2, 0)
  const [low, tall] = SCATTER[battle.place] ?? ['crate', 'stack']
  // The hive holds nothing human: its hazard is its own growth.
  for (const mark of HAZARD) stand(battle, raw(mark), battle.place === 'hive' ? 'growth' : 'fuel')
  for (const [i, mark] of HEAPS.entries()) stand(battle, raw(mark), i % 3 === 2 ? tall : low)
  walks.delete(battle)
  battle.approaches = APPROACHES.map((m) => raw(m))
  battle.gates = GATES.map((m) => openNear(battle, raw(m)))
  const heart = goal === 'rescue' ? raw(HEART) : null
  const walk = walkingDistances(battle, openNear(battle, spot))
  const ground: Tile[] = []
  for (let y = spot.y - ARENA_REACH; y <= spot.y + ARENA_REACH; y++) {
    for (let x = spot.x - ARENA_REACH; x <= spot.x + ARENA_REACH; x++) {
      if (onGrid(x, y) && !blocked(battle, x, y) && walk[y * GRID + x] < Infinity && distance({ x, y }, spot) <= ARENA_REACH - 1 && battle.ground[y * GRID + x] !== 'void' && battle.ground[y * GRID + x] !== 'water') ground.push({ x, y })
    }
  }
  const along = (t: Tile) => (t.x - spot.x) * fx + (t.y - spot.y) * fy
  const chokes = CHOKES.map(raw)
  const posts: Tile[] = []
  let objective = goal === 'vip' || goal === 'hold' ? spot : heart
  let guards = objective ? GUARDS : 0
  /** How well `t` suits `alien`: a shooter the heights and the far side, a bruiser a gap, one guarding the objective its side, and all room from the others. */
  const fit = (alien: Alien, t: Tile, guarding: boolean) => {
    const room = Math.min(SPREAD, ...posts.map((p) => distance(p, t)))
    const shooter = alien.stats.range > 1 ? 6 * battle.height[t.y * GRID + t.x] + 0.4 * along(t) : 0
    const bruiser = alien.stats.range <= 1 && alien.stats.hp > 4 && !guarding ? -1.5 * Math.min(...chokes.map((c) => distance(c, t))) : 0
    const guard = guarding ? -3 * distance(objective!, t) : 0
    const indoors = battle.ground[t.y * GRID + t.x] === 'floor' && !guarding ? -20 : 0
    const clear = goal === 'ambush' ? Math.min(0, 3 * (distance(t, spot) - 6)) : 0
    return room + shooter + bruiser + guard + indoors + clear + random(battle) * 2
  }
  for (const alien of aliens) {
    const set = alien.target ? COMMANDER_POST : alien.boss ? (goal === 'ambush' ? OVERLOOK : BOSS_POST) : null
    const free = ground.filter((t) => posts.every((p) => distance(p, t) >= ELBOW_ROOM))
    const guarding = !set && guards > 0
    if (guarding) guards--
    const pick = set ? openNear(battle, raw(set)) : (free.length > 0 ? free : ground).reduce<Tile | null>((a, b) => (!a || fit(alien, b, guarding) > fit(alien, a, guarding) ? b : a), null)
    const post = pick ?? openNear(battle, spot)
    posts.push(post)
    // A commander's guards stand by it.
    if (alien.target) {
      objective = post
      guards = GUARDS
    }
  }
  return { spot, posts, heart }
}
