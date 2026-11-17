// Designs a battle's encounter as one set-piece, as a DM prepares one: the crossing from the way in to the objective, the ground between, the objects, where each alien posts, and where reinforcements arrive.
import { GRID, type Alien, type Arena, type Battle, type Tile } from './battle'
import { blocked, depths, distance, edgeDepths, NEIGHBORS, onGrid, openNear, walkingDistances, walks } from './grid'
import { gather } from './formations'
import { randomInt } from './rng'
import { PROP_BULK, type Prop, type TerrainKind } from './terrain'
import { shapeArena } from './arena-kinds'
import { CHALLENGES, type ChallengeId } from './challenges'

/** How far from its centre the arena reaches, and how far out the camera shows it clear of props. */
export const ARENA_REACH = 15
const SIGHT_CLEAR = 22

/** Where an encounter's fight flows, in tiles along its axis from the way in toward the overlook, and across it. */
type Mark = [along: number, across: number]

/** The objects heroes find in the heaps, low and tall, by where the fight is. */
const SCATTER: Partial<Record<TerrainKind, [Prop, Prop]>> = { countryside: ['crate', 'tree'], hive: ['growth', 'spire'], city: ['car', 'stack'], town: ['car', 'crate'] }

/** The overlook, a rise by the objective; the ledge, a low rise by a flank way in; the fuel tanks out in the open. */
const OVERLOOK: Mark = [9, 0]
const LEDGE: Mark = [-8, -9]
const HAZARD: Mark[] = [[1, -7], [5, 0], [1, 7]]
/** Heaps of things to hurl, beside each flank and down the middle. */
const HEAPS: Mark[] = [[-6, -6], [-6, 6], [-2, -8], [-2, 8], [6, -5], [6, 5]]
/** The crossing's two ends: the way in, A, and the objective, B. */
const APPROACH: Mark = [-13, 0]
const OBJECTIVE: Mark = [13, 0]
/** Where reinforcements arrive: behind the aliens, and on each far flank. */
const GATES: Mark[] = [[13, 0], [8, -12], [8, 12], [-2, -13], [-2, 13]]

/** A Firing line's ridge: how far along it runs and how far to each side. */
const RIDGE_ALONG = 9
const RIDGE_REACH = 12

/** How far within the map's edge the arena's centre wants to lie, so its shaped ground has room. */
const SPOT_MARGIN = 18

/** A random open tile as far within the map's edge as there is. */
function arenaSpot(battle: Battle): Tile {
  const depth = edgeDepths(battle)
  for (let margin = SPOT_MARGIN; ; margin--) {
    const spots = battle.ground.flatMap((g, t) => (g !== 'void' && depth[t] > margin && battle.bulk[t] === 0 ? [{ x: t % GRID, y: Math.floor(t / GRID) }] : []))
    if (spots.length > 0) return spots[randomInt(battle, spots.length)]
  }
}

/** Opens the ground for the fight. Outdoor props come down out to SIGHT_CLEAR, water and the void aside; within the arena, so do buildings, but a compound's walls, and water and the void are filled. */
function clearArena(battle: Battle, arena: Arena): void {
  for (let y = arena.y - SIGHT_CLEAR; y <= arena.y + SIGHT_CLEAR; y++) {
    for (let x = arena.x - SIGHT_CLEAR; x <= arena.x + SIGHT_CLEAR; x++) {
      const d = Math.hypot(x - arena.x, y - arena.y)
      if (!onGrid(x, y) || d > SIGHT_CLEAR) continue
      const t = y * GRID + x
      const indoors = battle.ground[t] === 'floor'
      const razed = d <= ARENA_REACH && battle.place !== 'compound'
      if (razed) battle.north[t] = battle.west[t] = 'none'
      // Within the arena the ground is firm: only its kind lays a barrier across the route.
      const filled = d <= ARENA_REACH && (battle.ground[t] === 'void' || battle.ground[t] === 'water')
      if (!filled && (battle.ground[t] === 'void' || battle.ground[t] === 'water' || (indoors && !razed))) continue
      battle.props[t] = 'none'
      battle.bulk[t] = 0
      if (indoors || filled) battle.ground[t] = filled && battle.place === 'hive' ? 'hive' : filled ? 'grass' : 'pavement'
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
 * Sets the arena and lays out the encounter for `challenge`: the crossing runs along its axis from the way in to the
 * objective, over the ground its arena kind shapes. Returns the arena's centre, a post and cluster for each alien;
 * a commander, a boss and the aliens guarding what the mission is about stand at the objective.
 */
export function designEncounter(battle: Battle, aliens: Alien[], challenge: ChallengeId | null = null): { spot: Tile; posts: Tile[]; clusters: number[] } {
  const spot = arenaSpot(battle)
  const arena = { x: spot.x, y: spot.y, reach: ARENA_REACH }
  battle.arena = arena
  clearArena(battle, arena)
  depths.delete(battle)
  // The axis the crossing runs along: of eight headings, the first whose both ends lie on the map, from a random start.
  const start = randomInt(battle, 8)
  const headings = Array.from({ length: 8 }, (_, i) => ((start + i) * Math.PI) / 4)
  const inMap = (a: number) => [1, -1].every((s) => onGrid(Math.round(spot.x + s * ARENA_REACH * Math.cos(a)), Math.round(spot.y + s * ARENA_REACH * Math.sin(a))))
  const heading = headings.find(inMap) ?? headings[0]
  const [fx, fy] = [Math.cos(heading), Math.sin(heading)]
  const raw = ([along, across]: Mark): Tile => {
    const clamp = (v: number) => Math.max(0, Math.min(GRID - 1, Math.round(v)))
    return { x: clamp(spot.x + fx * along - fy * across), y: clamp(spot.y + fy * along + fx * across) }
  }
  shapeArena(battle, battle.arenaKind, spot, [fx, fy])
  if (battle.arenaKind === 'open') rise(battle, raw(OVERLOOK), 3, 1)
  if (challenge === 'firingLine') for (let across = -RIDGE_REACH; across <= RIDGE_REACH; across += 2) rise(battle, raw([RIDGE_ALONG, across]), 2, 1)
  if (battle.arenaKind === 'open') rise(battle, raw(LEDGE), 2, 0)
  const [low, tall] = SCATTER[battle.place] ?? ['crate', 'stack']
  // The hive holds nothing human: its hazard is its own growth.
  // Shooters that never come to a tank would stand and wait to be blown up.
  if (!challenge || !CHALLENGES[challenge].volley) for (const mark of HAZARD) stand(battle, raw(mark), battle.place === 'hive' ? 'growth' : 'fuel')
  for (const [i, mark] of HEAPS.entries()) stand(battle, raw(mark), i % 3 === 2 ? tall : low)
  walks.delete(battle)
  battle.approach = raw(APPROACH)
  battle.objective = openNear(battle, raw(OBJECTIVE))
  battle.gates = GATES.map((m) => openNear(battle, raw(m)))
  const walk = walkingDistances(battle, openNear(battle, spot))
  const ground: Tile[] = []
  for (let y = spot.y - ARENA_REACH; y <= spot.y + ARENA_REACH; y++) {
    for (let x = spot.x - ARENA_REACH; x <= spot.x + ARENA_REACH; x++) {
      if (onGrid(x, y) && !blocked(battle, x, y) && walk[y * GRID + x] < Infinity && distance({ x, y }, spot) <= ARENA_REACH - 1 && battle.ground[y * GRID + x] !== 'void' && battle.ground[y * GRID + x] !== 'water') ground.push({ x, y })
    }
  }
  const b = battle.objective
  const { posts, clusters } = gather(battle, aliens, { ground, spot, heading: [fx, fy], commander: b, boss: b, objective: b, challenge })
  return { spot, posts, clusters }
}
