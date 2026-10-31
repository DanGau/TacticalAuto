// The battle board: distances, objects, walls, walking costs and routes, and finding free tiles.
import { type Battle, BLAST_RADIUS, GRID, type Tile, type Unit, type Bulk } from './battle'
import { randomInt } from './rng'
import { EDGE_BULK, PROP_BULK, type Edge } from './terrain'

/** Tiles between two points, counting a diagonal as one. */
export const distance = (a: Tile, b: Tile) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y))

export const NEIGHBORS = [[0, -1], [1, 0], [0, 1], [-1, 0], [1, -1], [1, 1], [-1, 1], [-1, -1]]

export const onGrid = (x: number, y: number) => x >= 0 && y >= 0 && x < GRID && y < GRID

export const heightAt = (battle: Battle, tile: Tile) => battle.height[tile.y * GRID + tile.x]

/** Tiles of sight a unit gains for each level it stands above what it looks at, and loses for each below. */
export const HIGH_SIGHT = 2

/** Damage a shot gains for each level the shooter stands above its target, and loses for each below. */
export const HIGH_DAMAGE = 1

/** Move a step costs beyond its one tile for each level it climbs. */
export const CLIMB = 2

/** Move a step onto caltrops costs beyond its one tile. */
export const CALTROP_COST = 2

/** What a step between neighbouring tiles costs of a unit's move: one tile, CLIMB more for each level up, and more onto caltrops. */
export const stepCost = (battle: Battle, from: Tile, to: Tile) =>
  1 + CLIMB * Math.max(0, heightAt(battle, to) - heightAt(battle, from)) + (battle.caltrops.some((t) => t.x === to.x && t.y === to.y) ? CALTROP_COST : 0)

export function bulkAt(battle: Battle, x: number, y: number): Bulk {
  return battle.bulk[y * GRID + x]
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
      battle.bulk[tile] = 0
      battle.ground[tile] = 'scorched'
      battle.north[tile] = battle.west[tile] = 'none'
      if (onGrid(x, y + 1)) battle.north[tile + GRID] = 'none'
      if (onGrid(x + 1, y)) battle.west[tile + 1] = 'none'
    }
  }
}

/** Knocks down the walls and windows on every side of the tiles within `radius` of `centre`, leaving props standing. */
export function breach(battle: Battle, centre: Tile, radius = 1): void {
  walks.delete(battle)
  for (let y = centre.y - radius; y <= centre.y + radius + 1; y++) for (let x = centre.x - radius; x <= centre.x + radius + 1; x++) if (onGrid(x, y)) battle.north[y * GRID + x] = battle.west[y * GRID + x] = 'none'
}

/**
 * Breaks down a level what stands by `at` on the side of `from`: a wall to a window, a window to nothing,
 * a tall object to rubble, a low one to nothing. Water and void stay as they are.
 */
export function crumble(battle: Battle, at: Tile, from: Tile): void {
  let best: { x: number; y: number; bulk: number } | undefined
  for (const [dx, dy] of NEIGHBORS.slice(0, 4)) {
    const x = at.x + dx
    const y = at.y + dy
    if (!onGrid(x, y) || (from.x - at.x) * dx + (from.y - at.y) * dy <= 0 || ['water', 'void'].includes(battle.props[y * GRID + x])) continue
    const bulk = Math.max(bulkAt(battle, x, y), EDGE_BULK[edgeBetween(battle, at, { x, y })])
    if (bulk > (best?.bulk ?? 0)) best = { x, y, bulk }
  }
  if (!best) return
  walks.delete(battle)
  const edge = edgeBetween(battle, at, best)
  const edges = at.y === best.y ? battle.west : battle.north
  const index = at.y === best.y ? at.y * GRID + Math.max(at.x, best.x) : Math.max(at.y, best.y) * GRID + at.x
  if (edge !== 'none') edges[index] = edge === 'wall' ? 'window' : 'none'
  else {
    const tile = best.y * GRID + best.x
    battle.props[tile] = battle.bulk[tile] === 2 ? 'rubble' : 'none'
    battle.bulk[tile] = PROP_BULK[battle.props[tile]]
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
  return open(battle, from.x, from.y, to.x, from.y) && open(battle, to.x, from.y, to.x, to.y) && open(battle, from.x, from.y, from.x, to.y) && open(battle, from.x, to.y, to.x, to.y)
}

/** Whether nothing stands on the line between neighbouring tiles a and b. */
export const open = (battle: Battle, ax: number, ay: number, bx: number, by: number) =>
  (ay === by ? battle.west[ay * GRID + Math.max(ax, bx)] : battle.north[Math.max(ay, by) * GRID + ax]) === 'none'

/**
 * A battle's walking graph and the distance fields found on it. Both follow from terrain and the units that never move,
 * such as a hive node, which stand as walls: wreck forgets them, and so does such a unit's death.
 */
export const walks = new WeakMap<Battle, { fixed: string; into: number[][]; fields: Map<number, number[]> }>()

/** Drops what was worked out from the battle's terrain, once something has changed it. */
export const reshaped = (battle: Battle) => walks.delete(battle)

/** For each tile, the open tiles a unit can step onto it from, each followed by that step's cost. */
export function walkGraph(battle: Battle) {
  // A civilian waits to be reached, not to wall a way off: it leaves once a soldier is beside it.
  const still = battle.units.filter((u) => u.stats.move === 0 && u.hp > 0 && !u.civilian)
  const fixed = still.map((u) => u.y * GRID + u.x).join()
  let walk = walks.get(battle)
  if (walk?.fixed === fixed) return walk
  const walls = new Set(still.map((u) => u.y * GRID + u.x))
  const into = Array.from({ length: GRID * GRID }, (_, t) => {
    const tile = { x: t % GRID, y: Math.floor(t / GRID) }
    const steps: number[] = []
    for (const [dx, dy] of NEIGHBORS) {
      const from = { x: tile.x + dx, y: tile.y + dy }
      const f = from.y * GRID + from.x
      if (onGrid(from.x, from.y) && battle.bulk[f] === 0 && !walls.has(f) && passable(battle, tile, from)) steps.push(f, stepCost(battle, from, tile))
    }
    return steps
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
  // Tiles by distance found, nearest first: steps cost whole tiles, so each bucket is settled before the next.
  const buckets: number[][] = [[start]]
  for (let d = 0; d < buckets.length; d++) {
    const bucket = buckets[d]
    if (!bucket) continue
    for (const tile of bucket) {
      if (field[tile] !== d) continue
      const steps = into[tile]
      for (let i = 0; i < steps.length; i += 2) {
        const from = steps[i]
        const reach = d + steps[i + 1]
        if (reach >= field[from]) continue
        field[from] = reach
        ;(buckets[reach] ??= []).push(from)
      }
    }
  }
  fields.set(start, field)
  return field
}

/** Whether a unit could walk from `start` to each tile, ignoring units that move. */
export function reachableFrom(battle: Battle, start: Tile): boolean[] {
  const { into } = walkGraph(battle)
  const out: number[][] = into.map(() => [])
  into.forEach((steps, t) => {
    for (let i = 0; i < steps.length; i += 2) out[steps[i]].push(t)
  })
  const reached = Array<boolean>(GRID * GRID).fill(false)
  const queue = [start.y * GRID + start.x]
  reached[queue[0]] = true
  for (const t of queue)
    for (const n of out[t]) {
      if (reached[n]) continue
      reached[n] = true
      queue.push(n)
    }
  return reached
}

/** Whether nothing may stand on the tile: it is off the grid, solid, or occupied. */
export function blocked(battle: Battle, x: number, y: number): boolean {
  return !onGrid(x, y) || bulkAt(battle, x, y) > 0 || unitAt(battle, x, y) !== undefined
}

/** The open tile nearest `tile` as the crow flies. */
export function openNear(battle: Battle, tile: Tile): Tile {
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
      if (!onGrid(x, y) || bulkAt(battle, x, y) > 0 || seen.has(y * GRID + x) || !passable(battle, tile, { x, y })) continue
      seen.add(y * GRID + x)
      queue.push({ x, y })
    }
  }
  return found
}

export const randomTile = (battle: Battle): Tile => ({ x: randomInt(battle, GRID), y: randomInt(battle, GRID) })

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
    if (placed && bulkAt(battle, tile.x, tile.y) === 0 && avoid.every((other) => distance(tile, other) >= needed)) return tile
  }
}

/**
 * The battlefield's two borders. Its outer border is the edge of the map the squad can walk; its inner border lies
 * INNER tiles within. Inside the inner border stands what the battle is about: the aliens, the uplink, the caches.
 * Civilians may be anywhere. Between the two, the edge, is where the squad comes in and gets out; the outermost tiles are left free.
 */
export const INNER = 7

export const EDGE_GAP = 2

export type Within = 'anywhere' | 'inner' | 'edge'

export const inPart = (depth: number, within: Within) => within === 'anywhere' || (within === 'inner' ? depth > INNER : depth >= EDGE_GAP && depth <= INNER)

export const depths = new WeakMap<Battle, number[]>()

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

/** The alien nearest a tile, if any. */
export const nearestAlien = (battle: Battle, tile: Tile): Unit | undefined =>
  battle.units.filter((u) => u.side === 'alien').reduce<Unit | undefined>((best, u) => (!best || distance(tile, u) < distance(tile, best) ? u : best), undefined)
