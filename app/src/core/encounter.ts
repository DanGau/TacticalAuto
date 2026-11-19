// Designs a battle's encounter as one set-piece, as a DM prepares one: the crossing from the way in to the objective, the ground between, the objects, where each alien posts, and where reinforcements arrive.
import { GRID, type Alien, type Arena, type Battle, type Tile } from './battle'
import { blocked, depths, distance, edgeDepths, NEIGHBORS, onGrid, openNear, walkingDistances, walks } from './grid'
import { gather } from './formations'
import { randomInt } from './rng'
import { PROP_BULK, type Prop, type TerrainKind } from './terrain'
import { shapeArena } from './arena-kinds'
import { CHALLENGES, type ChallengeId } from './challenges'
import type { ArenaKind } from './arena-kinds'
import { creep, lane, NATURAL_HAZARD, objectiveName, poi, POI_NAMES, type Poi } from './pois'

/** How far from its centre the arena reaches, and how far out the camera shows it clear of props. */
export const ARENA_REACH = 15
const SIGHT_CLEAR = 22

/** Where an encounter's fight flows, in tiles along its axis from the way in toward the overlook, and across it. */
type Mark = [along: number, across: number]

/** The objects heroes find in the heaps, low and tall, by where the fight is. */
const SCATTER: Partial<Record<TerrainKind, [Prop, Prop]>> = { countryside: ['crate', 'tree'], hive: ['growth', 'spire'], city: ['car', 'stack'], town: ['car', 'crate'] }

/** The crossing's two ends: the way in, A, and the objective, B. */
const APPROACH: Mark = [-13, 0]
const OBJECTIVE: Mark = [13, 0]
/** Where reinforcements arrive: behind the aliens, and on each far flank. */
const GATES: Mark[] = [[13, 0], [8, -12], [8, 12], [-2, -13], [-2, 13]]

/** Where each landmark stands, its across mirrored to a side drawn per battle: the vantage and hazard on one flank, the strongpoint on the other. */
const STRONGPOINT: Mark = [-8, -6]
/** On a roof the strongpoint keeps back from the edge. */
const OWN_STRONGPOINT: Partial<Record<ArenaKind, Mark>> = { skyscraper: [-8, -3] }
const HAZARD: Mark = [2, 5]
const VANTAGE: Mark = [7, 8]
/** Where a ground's own high ground is the vantage: its deck, terrace or mesa top. */
const OWN_VANTAGE: Partial<Record<ArenaKind, Mark>> = { skyscraper: [7.5, 0], overpass: [0, 5.5], quarry: [6, 6], mesa: [7, 6] }
/** The strongpoint's cover, about its centre and open toward the way in; the two heaps flanking the objective. */
const COVER: Mark[] = [[1, -3], [1, 0], [1, 3], [-2, -3]]
const COVER_REACH = 4
const FLANKS: Mark[] = [[-2, -3], [-2, 3]]
/** Fuel tanks at the hazard, and how far from its centre they stand. */
const TANKS = 3
const TANK_REACH = 5
/** Nests framed: the biggest clusters standing farther than this from the objective. */
const NESTS = 2
const GUARD_REACH = 5

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

/** Stands `prop` on an open tile at `at`, none touching another, so it walls nothing off. */
function stand(battle: Battle, at: Tile, prop: Prop): boolean {
  if (!onGrid(at.x, at.y) || blocked(battle, at.x, at.y) || battle.ground[at.y * GRID + at.x] === 'void') return false
  if (NEIGHBORS.some(([dx, dy]) => onGrid(at.x + dx, at.y + dy) && battle.bulk[(at.y + dy) * GRID + at.x + dx] > 0)) return false
  battle.props[at.y * GRID + at.x] = prop
  battle.bulk[at.y * GRID + at.x] = PROP_BULK[prop]
  return true
}

/**
 * Sets the arena and lays out the encounter for `challenge` about its landmarks: the crossing runs along its axis from
 * the way in to the objective, over the ground its arena kind shapes, past a strongpoint, a hazard and a vantage, each
 * with its own cluster, joined by lanes. Returns the arena's centre, a post and cluster for each alien; a commander, a
 * boss and the aliens guarding what the mission is about stand at the objective. Sets the landmarks but the landing.
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
  const side = randomInt(battle, 2) * 2 - 1
  const raw = ([along, across]: Mark, from: Mark = [0, 0]): Tile => {
    const clamp = (v: number) => Math.max(0, Math.min(GRID - 1, Math.round(v)))
    const [a, c] = [from[0] + along, from[1] + across]
    return { x: clamp(spot.x + fx * a - fy * c), y: clamp(spot.y + fy * a + fx * c) }
  }
  const off = (at: Tile, [a, c]: Mark): Tile => ({ x: Math.round(at.x + fx * a - fy * c), y: Math.round(at.y + fy * a + fx * c) })
  const sided = ([a, c]: Mark): Mark => [a, c * side]
  const kind = battle.arenaKind
  shapeArena(battle, kind, spot, [fx, fy])
  const names = POI_NAMES[kind]
  if (challenge === 'firingLine') for (let across = -RIDGE_REACH; across <= RIDGE_REACH; across += 2) rise(battle, raw([RIDGE_ALONG, across]), 2, 1)
  // The vantage: the ground's own high ground, else a knoll raised on firm ground.
  const own = OWN_VANTAGE[kind]
  const vantage = own ? raw(kind === 'overpass' ? own : sided(own)) : firm(battle, raw(sided(VANTAGE)))
  if (!own) rise(battle, vantage, 3, 1)
  // The hazard: the ground's own nearest its mark, else a fuel depot there; tanks stand about it.
  const mark = raw(sided(HAZARD))
  const natural = NATURAL_HAZARD[kind]
  const hazard = natural ? nearestOf(mark, (t) => battle.ground[t] === natural) ?? mark : mark
  const tanks: Tile[] = []
  // Shooters that never come to a tank would stand and wait to be blown up. The hive's hazard is its own growth.
  if (!challenge || !CHALLENGES[challenge].volley) {
    for (const t of ringAbout(hazard, TANK_REACH)) if (tanks.length < TANKS && stand(battle, t, battle.place === 'hive' ? 'growth' : 'fuel')) tanks.push(t)
  }
  // The strongpoint: cover open toward the way in, low and tall.
  const [low, tall] = SCATTER[battle.place] ?? ['crate', 'stack']
  const strong = sided(OWN_STRONGPOINT[kind] ?? STRONGPOINT)
  const strongpoint = firm(battle, raw(strong))
  const near = (at: Tile, prop: Prop) => ringAbout(at, 2.5).find((t) => stand(battle, t, prop))
  const cover = COVER.flatMap((m, i) => near(off(strongpoint, m), i === 1 ? tall : low) ?? [])
  // Water or a drop where cover wants to stand: it stands on the nearest firm ground about the strongpoint instead.
  for (const t of ringAbout(strongpoint, COVER_REACH)) if (cover.length < COVER.length && stand(battle, t, low)) cover.push(t)
  const flanks = FLANKS.flatMap((m, i) => near(raw(m, OBJECTIVE), i === 1 ? tall : low) ?? [])
  walks.delete(battle)
  battle.approach = raw(APPROACH)
  battle.objective = openNear(battle, raw(OBJECTIVE))
  battle.gates = GATES.map((m) => openNear(battle, raw(m)))
  lane(battle, battle.approach, strongpoint)
  lane(battle, strongpoint, battle.objective)
  lane(battle, vantage, battle.objective)
  const walk = walkingDistances(battle, openNear(battle, spot))
  const ground: Tile[] = []
  for (let y = spot.y - ARENA_REACH; y <= spot.y + ARENA_REACH; y++) {
    for (let x = spot.x - ARENA_REACH; x <= spot.x + ARENA_REACH; x++) {
      if (onGrid(x, y) && !blocked(battle, x, y) && walk[y * GRID + x] < Infinity && distance({ x, y }, spot) <= ARENA_REACH - 1 && battle.ground[y * GRID + x] !== 'void' && battle.ground[y * GRID + x] !== 'water') ground.push({ x, y })
    }
  }
  const b = battle.objective
  const { posts, clusters } = gather(battle, aliens, { ground, spot, heading: [fx, fy], commander: b, boss: b, objective: b, challenge })
  // Nests: the biggest clusters away from the objective, each marked with creep.
  const groups = [...new Set(clusters)].map((c) => posts.filter((_, i) => clusters[i] === c))
  const centre = (tiles: Tile[]): Tile => ({ x: Math.round(tiles.reduce((s, t) => s + t.x, 0) / tiles.length), y: Math.round(tiles.reduce((s, t) => s + t.y, 0) / tiles.length) })
  const guards = groups.filter((g) => distance(centre(g), b) <= GUARD_REACH).flat()
  const nests = groups.filter((g) => distance(centre(g), b) > GUARD_REACH).sort((p, q) => q.length - p.length).slice(0, NESTS)
  for (const g of nests) creep(battle, centre(g))
  const hive = battle.place === 'hive'
  battle.pois = [
    poi('objective', objectiveName(battle.goal, aliens), b, [...guards, ...flanks]),
    ...nests.map((g) => poi('nest', hive ? 'Hive Brood' : g.length >= 3 ? 'Alien Nest' : 'Alien Post', centre(g), g)),
    poi('hazard', names.hazard, hazard, tanks),
    poi('vantage', names.vantage, vantage),
    poi('strongpoint', names.strongpoint, strongpoint, cover),
  ] satisfies Poi[]
  return { spot, posts, clusters }
}

/** The firm tile nearest `at`: not water, mire, ice or the void. */
function firm(battle: Battle, at: Tile): Tile {
  return nearestOf(at, (t) => !['water', 'mire', 'ice', 'void'].includes(battle.ground[t])) ?? at
}

/** The tile nearest `at` within the arena's reach that `is`. */
function nearestOf(at: Tile, is: (t: number) => boolean): Tile | null {
  return ringAbout(at, ARENA_REACH).find((t) => is(t.y * GRID + t.x)) ?? null
}

/** Tiles on the grid within `reach` of `at`, nearest first. */
function ringAbout(at: Tile, reach: number): Tile[] {
  const tiles: Tile[] = []
  for (let y = Math.ceil(at.y - reach); y <= at.y + reach; y++) for (let x = Math.ceil(at.x - reach); x <= at.x + reach; x++) if (onGrid(x, y) && Math.hypot(x - at.x, y - at.y) <= reach) tiles.push({ x, y })
  return tiles.sort((p, q) => Math.hypot(p.x - at.x, p.y - at.y) - Math.hypot(q.x - at.x, q.y - at.y))
}
