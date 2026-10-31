// Designs a battle's encounter as one set-piece, as a DM prepares one: the ground, the overlook, the hazard, the objects, where each pod posts, the ways in and where reinforcements arrive.
import { GRID, type Alien, type Arena, type Battle, type Tile } from './battle'
import type { Goal } from './goals'
import { blocked, edgeDepths, NEIGHBORS, onGrid, openNear, walks } from './grid'
import { randomInt } from './rng'
import { PROP_BULK, type Prop, type TerrainKind } from './terrain'

/** How far from its centre the arena reaches, and how far out the camera shows it clear of props. */
export const ARENA_REACH = 14
const SIGHT_CLEAR = 22

/** Where an encounter's fight flows, in tiles along its axis from the ways in toward the overlook, and across it. */
type Mark = [along: number, across: number]

/** The objects heroes find in the heaps, low and tall, by where the fight is. */
const SCATTER: Partial<Record<TerrainKind, [Prop, Prop]>> = { countryside: ['crate', 'tree'], hive: ['growth', 'spire'], city: ['car', 'stack'], town: ['car', 'crate'] }

/** The overlook, a rise the aliens hold; the ledge, a low rise by a flank way in; the fuel tanks between the first pods. */
const OVERLOOK: Mark = [9, 0]
const LEDGE: Mark = [-8, -9]
const HAZARD: Mark[] = [[3, -2], [4, 0], [3, 2]]
/** Heaps of things to hurl, beside each flank and down the middle. */
const HEAPS: Mark[] = [[-6, -6], [-6, 6], [-2, -8], [-2, 8], [6, -5], [6, 5]]
/** The ways in: head on, nearest the first pod; a flank by the ledge; a flank by the heaps; a far side for an extra. */
const APPROACHES: Mark[] = [[-12, 0], [-8, -10], [-8, 10], [2, 13]]
/** Where reinforcements arrive: behind the aliens, and on each far flank. */
const GATES: Mark[] = [[13, 0], [8, -12], [8, 12], [-2, -13], [-2, 13]]

/**
 * Where each mission's pods post, in the order of its packs, past which any more ring the far side. The first post of
 * a list marked `first` is the pack that mission is about; the rest take the overlook if they can shoot, else the ground.
 */
const POSTS: Record<Goal, { first?: Mark; high: Mark[]; low: Mark[] }> = {
  exterminate: { high: [OVERLOOK], low: [[-1, 0], [5, -8], [5, 8]] },
  // The commander on the overlook, its minions a screen before it.
  assassinate: { first: [11, 0], high: [[6, -6]], low: [[0, 0], [3, 7]] },
  // Pods at both sides of the uplink at the heart, to close from two directions.
  hold: { high: [OVERLOOK], low: [[3, -9], [3, 9]] },
  // The last pod is at the terror's heart.
  rescue: { high: [OVERLOOK], low: [[5, -9], [5, 9]] },
  // The first guards the VIP at the arena's heart; the others bar the way to it.
  vip: { first: [0, 0], high: [OVERLOOK], low: [[-5, -6], [-5, 6]] },
  raid: { high: [OVERLOOK], low: [[4, -9], [4, 9]] },
  ambush: { first: OVERLOOK, high: [[-8, 0]], low: [[0, -9], [0, 9]] },
  recover: { high: [OVERLOOK], low: [[0, 0], [4, -8], [4, 8]] },
}

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
 * Sets the arena and lays out the encounter for `goal`. Returns the arena's centre, a post for each pack, and on a
 * rescue the terror's heart. A VIP's building and a satellite's compound stay standing; all else in the arena comes down, and the props around it.
 */
export function designEncounter(battle: Battle, packs: { aliens: Alien[] }[], goal: Goal): { spot: Tile; posts: Tile[] } {
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
  // Each pack to its post: the mission's own first, shooters to the heights, the rest to the ground, more about the far side.
  const plan = POSTS[goal]
  const high = [...plan.high]
  const ground = [...plan.low]
  const posts = packs.map((pack, i) => {
    if (i === 0 && plan.first) return plan.first
    // A rescue's last pack is at the terror's heart.
    if (goal === 'rescue' && i === packs.length - 1) return [2, 0] as Mark
    const shoots = pack.aliens.some((a) => a.stats.range > 1)
    const mark = (shoots ? high.shift() : undefined) ?? ground.shift() ?? high.shift()
    return mark ?? ([9 - (i % 3) * 5, (i % 2 === 0 ? 1 : -1) * (6 + (i % 4) * 2)] as Mark)
  })
  return { spot, posts: posts.map((m) => openNear(battle, raw(m))) }
}
