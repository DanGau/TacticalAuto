// The real things an entrance is made from: a building's doors, walls and roof, a high point, a road.
import { GRID, type Battle, type Tile } from './battle'
import { blocked, edgeBetween, NEIGHBORS, onGrid } from './grid'
import type { Prop, TerrainKind } from './terrain'

/** What an entrance comes out of or down from: the tile it stands on, the way a truck drives in, and what the entrance's label adds. */
export interface Feature {
  from: Tile
  path?: Tile[]
  name: string
}

/** The entrances made from a feature. */
export type FeatureKind = 'door' | 'wall' | 'skylight' | 'rappel' | 'truck'

/** A place to come in at, and the feature it comes from. */
export interface Site {
  at: Tile
  feature: Feature
}

/** The feature entrances that suit each kind of place. No truck drives into a hive, nor a door opens on one. */
export const SUITS: Record<TerrainKind, FeatureKind[]> = {
  city: ['door', 'wall', 'skylight', 'truck', 'rappel'],
  town: ['door', 'wall', 'skylight', 'truck'],
  industrial: ['truck', 'wall', 'door', 'rappel', 'skylight'],
  countryside: ['door', 'truck', 'rappel'],
  ruins: ['wall', 'rappel'],
  compound: ['wall', 'truck', 'rappel'],
  hive: ['rappel'],
}

/** Tall things a rope can hang from, by what the player calls them. */
const ANCHORS: Partial<Record<Prop, string>> = { spire: 'from the spire', stack: 'from the stacks', tree: 'from a tall tree' }

/** Tiles a truck's run along a road must be, at least, and at most. */
const RUN_LEAST = 6
const RUN_MOST = 14

const SIDES = NEIGHBORS.slice(0, 4)
const tiles = () => Array.from({ length: GRID * GRID }, (_, t) => ({ x: t % GRID, y: Math.floor(t / GRID) }))
const groundAt = (battle: Battle, t: Tile) => battle.ground[t.y * GRID + t.x]
const beside = (t: Tile) => SIDES.map(([dx, dy]) => ({ x: t.x + dx, y: t.y + dy })).filter((n) => onGrid(n.x, n.y))

/** Each pairing of a building's floor tile with the free ground just outside it, where the edge between them is `edge`. */
function thresholds(battle: Battle, edge: 'none' | 'wall'): { floor: Tile; out: Tile }[] {
  return tiles().flatMap((floor) =>
    groundAt(battle, floor) !== 'floor' ? [] : beside(floor).flatMap((out) => (groundAt(battle, out) !== 'floor' && groundAt(battle, out) !== 'void' && !blocked(battle, out.x, out.y) && edgeBetween(battle, floor, out) === edge ? [{ floor, out }] : [])),
  )
}

/** The way along road tiles from `at`, farthest end first and `at` last, as long as a run of RUN_MOST allows. */
function roadRun(battle: Battle, at: Tile, near: (t: Tile) => number): Tile[] {
  const from = new Map<number, number>([[at.y * GRID + at.x, -1]])
  const queue = [at]
  let far = at
  let steps = new Map<number, number>([[at.y * GRID + at.x, 0]])
  for (const t of queue) {
    const here = t.y * GRID + t.x
    if (steps.get(here)! >= RUN_MOST) continue
    for (const n of beside(t)) {
      const key = n.y * GRID + n.x
      if (from.has(key) || groundAt(battle, n) !== 'road') continue
      from.set(key, here)
      steps = steps.set(key, steps.get(here)! + 1)
      queue.push(n)
      // The truck comes from the end of the road farthest from the aliens.
      if (near(n) > near(far)) far = n
    }
  }
  const run: Tile[] = []
  for (let key = far.y * GRID + far.x; key !== -1; key = from.get(key)!) run.push({ x: key % GRID, y: Math.floor(key / GRID) })
  return run
}

/** Every place on the map the entrance `kind` can come in at; `near` is how far a tile lies from the nearest alien. */
export function sitesOf(battle: Battle, kind: FeatureKind, near: (t: Tile) => number): Site[] {
  if (kind === 'door') return thresholds(battle, 'none').map(({ floor, out }) => ({ at: out, feature: { from: floor, name: '' } }))
  if (kind === 'wall') return thresholds(battle, 'wall').map(({ floor, out }) => ({ at: out, feature: { from: floor, name: '' } }))
  if (kind === 'skylight') {
    // Roof all round: every side of the landing is floor.
    return tiles().flatMap((t) => (groundAt(battle, t) === 'floor' && !blocked(battle, t.x, t.y) && beside(t).every((n) => groundAt(battle, n) === 'floor') ? [{ at: t, feature: { from: t, name: '' } }] : []))
  }
  if (kind === 'truck') {
    return tiles().flatMap((t) => {
      if (groundAt(battle, t) !== 'road' || blocked(battle, t.x, t.y)) return []
      const path = roadRun(battle, t, near)
      return path.length >= RUN_LEAST ? [{ at: t, feature: { from: path[0], path, name: 'up the road' } }] : []
    })
  }
  const rooftops = thresholds(battle, 'wall').map(({ floor, out }) => ({ at: out, feature: { from: floor, name: 'from the rooftop' } }))
  const tall = tiles().flatMap((t) => {
    const name = ANCHORS[battle.props[t.y * GRID + t.x]]
    return name ? beside(t).filter((n) => !blocked(battle, n.x, n.y) && groundAt(battle, n) !== 'void').map((at) => ({ at, feature: { from: t, name } })) : []
  })
  const ledges = tiles().flatMap((t) => (battle.height[t.y * GRID + t.x] >= 2 ? beside(t).filter((n) => battle.height[n.y * GRID + n.x] === 0 && !blocked(battle, n.x, n.y) && groundAt(battle, n) !== 'void').map((at) => ({ at, feature: { from: t, name: 'from the high ground' } })) : []))
  return [...rooftops, ...tall, ...ledges]
}
