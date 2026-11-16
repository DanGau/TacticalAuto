// The shape of the ground an encounter is fought on: its levels, ledges, ramps and drops.
import { GRID, type Battle, type Tile } from './battle'
import type { ChallengeId } from './challenges'
import type { EffectId } from './utilities'
import { soften } from './levels'
import { randomInt } from './rng'
import { PROP_BULK, type TerrainKind } from './terrain'
import { NEIGHBORS, onGrid } from './grid'
import type { Twist } from './twists'

/**
 * The kinds of ground a crossing runs over. Open ground has gentle rises; a skyscraper's roof has a drop on every side,
 * some of it behind glass; an overpass runs a raised road down one flank; a quarry climbs in terraces toward the far
 * end. A barrier lies across the route, from one edge of the map to the other, but for a bridge far out on one flank:
 * a chasm, broken bridge and all; a river; a swamp's wide band of mire; a cliff the far end stands on.
 */
export type ArenaKind = 'open' | 'skyscraper' | 'overpass' | 'quarry' | 'chasm' | 'river' | 'swamp' | 'cliff'

/** What the player is told of each, and what opens a barrier's straight way across. */
export const ARENA_KINDS: Record<ArenaKind, { name: string; text: string; opens?: EffectId[] }> = {
  open: { name: 'Open Ground', text: 'Gentle rises.' },
  skyscraper: { name: 'Skyscraper Roof', text: 'A long drop on every side.' },
  overpass: { name: 'Overpass', text: 'A raised road down one flank.' },
  quarry: { name: 'Quarry', text: 'Terraces climb to the far end.' },
  chasm: { name: 'Chasm', text: 'A chasm splits the route. The bridge is far round; a broken one is nearer.', opens: ['hover'] },
  river: { name: 'River', text: 'A river splits the route. The bridge is far round.', opens: ['coldSnap', 'hover'] },
  swamp: { name: 'Swamp', text: 'Mire across the route costs 3 times the move. Firm ground is far round.', opens: ['hover'] },
  cliff: { name: 'Cliff', text: 'The far end stands on a cliff. The ramp is far round.', opens: ['hover'] },
}

/** The arena kinds each kind of place may have, each as likely as the others. */
const FITS: Record<TerrainKind, ArenaKind[]> = {
  city: ['skyscraper', 'overpass', 'river', 'cliff', 'chasm'],
  industrial: ['quarry', 'overpass', 'chasm', 'river', 'cliff'],
  ruins: ['chasm', 'quarry', 'skyscraper', 'river', 'swamp'],
  countryside: ['cliff', 'quarry', 'chasm', 'river', 'swamp'],
  town: ['open', 'overpass', 'river', 'cliff', 'swamp'],
  hive: ['cliff', 'chasm', 'open', 'swamp'],
  compound: ['open'],
}

/** Kinds whose drop is void, which narrow ground's own void would cut too small. */
const VOIDED: ArenaKind[] = ['skyscraper', 'chasm']

/** An arena kind fitting the place, challenge and twist: a ridge needs open ground; a Slog is a swamp. */
export function pickArenaKind(battle: { rng: number }, place: TerrainKind, challenge: ChallengeId | null, twist: Twist | null): ArenaKind {
  if (challenge === 'slog') return 'swamp'
  if (challenge === 'firingLine') return 'open'
  const fits = FITS[place].filter((k) => twist !== 'narrow' || !VOIDED.includes(k))
  return fits[randomInt(battle, fits.length)]
}

/** Tiles within `reach` of a drop: the void, or the low side of a ledge. */
export function dropsNear(battle: Battle, reach: number): Set<number> {
  const near = new Set<number>()
  for (let t = 0; t < GRID * GRID; t++) {
    if (battle.ground[t] === 'void') continue
    const x = t % GRID
    const y = Math.floor(t / GRID)
    const lip = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => {
      const n = (y + dy) * GRID + x + dx
      return x + dx >= 0 && y + dy >= 0 && x + dx < GRID && y + dy < GRID && (battle.ground[n] === 'void' || battle.height[t] - battle.height[n] >= 2)
    })
    if (!lip) continue
    for (let dy = -reach; dy <= reach; dy++) for (let dx = -reach; dx <= reach; dx++) if (x + dx >= 0 && y + dy >= 0 && x + dx < GRID && y + dy < GRID) near.add((y + dy) * GRID + x + dx)
  }
  return near
}

/** Half the side of the square about the arena's centre an arena kind shapes; beyond it the ground slopes back to its own. */
const FOOT = 16

/** A barrier's footprint, cleared flat, as far across as its bridge and a little past. */
const BARRIER_FOOT = { along: 17, across: 24 }

/** Where a barrier crosses the route, in tiles along the axis, too wide for any jump; a swamp's band is wider. */
const BAND: [number, number] = [-3.5, 2.5]
const MIRE_BAND: [number, number] = [-6.5, 5.5]

/** How far out across the route a barrier's bridge lies at most, and its half width; a chasm's broken bridge, its gap the middle two tiles. */
export const BRIDGE = 20
const BRIDGE_HALF = 1.5
const BROKEN = 10

/** What a kind makes of a tile at `a` tiles along the axis and `c` across, its bridge at `b` across: its level, a drop, water, mire, or as it was. */
type Shape = (a: number, c: number, b: number) => number | 'drop' | 'water' | 'mire' | null

/** Levels a cliff stands, too high for any jump. */
const CLIFF_HIGH = 6

/** Levels of a ramp `d` tiles out from the edge of ground `top` high. */
const ramp = (top: number, d: number) => Math.max(0, top - Math.ceil(d))

const within = (v: number, lo: number, hi: number) => v >= lo && v <= hi

/** Whether `c` lies on the bridge at `b`. */
const onBridge = (c: number, b: number) => Math.abs(c - b) <= BRIDGE_HALF

/** A barrier's shape: `band` across the whole map, made by `cross`, but the bridge; flat ground about it. */
const barrier = (band: [number, number], cross: Shape): Shape => (a, c, b) => {
  if (within(a, ...band) && !onBridge(c, b)) return cross(a, c, b)
  return Math.abs(a) > BARRIER_FOOT.along || Math.abs(c) > BARRIER_FOOT.across ? null : 0
}

const SHAPES: Record<Exclude<ArenaKind, 'open'>, Shape> = {
  // The roof, a machine deck over the far end and a stair up to it; all else is the drop.
  skyscraper: (a, c) => {
    if (Math.abs(a) > 14.5 || Math.abs(c) > 7.5) return 'drop'
    if (within(a, 5, 10) && Math.abs(c) <= 5) return 2
    return within(a, 3.5, 5) && Math.abs(c) <= 1.5 ? 1 : 0
  },
  // A road three levels up down one flank, a ramp off each side.
  overpass: (a, c) => {
    if (Math.abs(a) > FOOT || Math.abs(c) > FOOT) return null
    if (within(c, 3.5, 7.5)) return 3
    if (within(a, -9, -6) && within(c, 0.5, 3.5)) return ramp(3, 3.5 - c)
    if (within(a, 4, 7) && within(c, 7.5, 10.5)) return ramp(3, c - 7.5)
    return 0
  },
  // Terraces two levels apart, each joined to the next by two ramps.
  quarry: (a, c) => {
    if (Math.abs(a) > FOOT || Math.abs(c) > FOOT) return null
    if (a < -6) return 0
    if (a < -5) return within(c, -10, -7) || within(c, 6, 9) ? 1 : 0
    if (a < 1) return 2
    if (a < 2) return within(c, -3, 0) || within(c, 9, 12) ? 3 : 2
    return 4
  },
  // The broken bridge, on the other flank from the whole one: its middle two tiles fallen.
  chasm: barrier(BAND, (a, c, b) => (Math.abs(c + Math.sign(b) * BROKEN) <= BRIDGE_HALF && !within(a, -1.5, 0.5) ? 0 : 'drop')),
  river: barrier(BAND, () => 'water'),
  swamp: barrier(MIRE_BAND, () => 'mire'),
  // The far end CLIFF_HIGH levels up, its face along the band and a drop beyond; the ramp up it on the bridge.
  cliff: (a, c, b) => {
    if (Math.abs(a) > BARRIER_FOOT.along || Math.abs(c) > BARRIER_FOOT.across) return within(a, ...BAND) ? 'drop' : null
    if (a >= BAND[1] - 2) return CLIFF_HIGH
    return onBridge(c, b) && a > BAND[1] - 2 - CLIFF_HIGH ? ramp(CLIFF_HIGH, BAND[1] - 2 - a) : 0
  },
}

/** A swamp's pools and islands in the mire: how many of each and their radii; the share of firm tiles that hold a tree. */
const ISLANDS = 6
const ISLAND_RADIUS = [1, 2]
const POOLS = 8
const POOL_RADIUS = [1, 2]
const TREES = 0.15

/** Lays pools and wooded islands, a level up, over a swamp's mire. */
function bog(battle: Battle, mire: number[], axis: (t: number) => [number, number], b: number): void {
  const [lo, hi] = MIRE_BAND
  const blobs = (n: number, [r0, r1]: number[]) => Array.from({ length: n }, () => ({ a: lo + 1 + randomInt(battle, hi - lo - 2), c: randomInt(battle, 2 * BARRIER_FOOT.across) - BARRIER_FOOT.across, r: r0 + (randomInt(battle, 4) / 3) * (r1 - r0) }))
  const islands = blobs(ISLANDS, ISLAND_RADIUS)
  const pools = blobs(POOLS, POOL_RADIUS)
  const inside = (t: number, of: typeof islands) => { const [a, c] = axis(t); return of.some((o) => Math.hypot(a - o.a, c - o.c) <= o.r) }
  const clear = (x: number, y: number) => NEIGHBORS.every(([dx, dy]) => !onGrid(x + dx, y + dy) || battle.bulk[(y + dy) * GRID + x + dx] === 0)
  for (const t of mire) {
    // Nothing stands within reach of the straight way or the bridge, so the mire is all that slows either.
    const [, c] = axis(t)
    const clearWay = Math.abs(c) <= 2 || Math.abs(c - b) <= BRIDGE_HALF + 1
    if (clearWay) continue
    const island = inside(t, islands)
    if (island) {
      battle.ground[t] = battle.place === 'hive' ? 'hive' : 'grass'
      battle.height[t] = 1
    }
    const prop = !island && inside(t, pools) ? 'water' : island && randomInt(battle, 100) < 100 * TREES && clear(t % GRID, Math.floor(t / GRID)) ? 'tree' : null
    if (!prop) continue
    if (prop === 'water') battle.ground[t] = 'water'
    battle.props[t] = prop
    battle.bulk[t] = PROP_BULK[prop]
  }
}

/** The parapet: glass along the roof's edge in runs of this many tiles, with as long gaps between. */
const PANE_RUN = 4

/** How far out across the route, on the side `side` of it, the map runs from `spot`: room for a bridge. */
function room(spot: Tile, [fx, fy]: [number, number], side: number): number {
  let c = 0
  while (c < BRIDGE + 2 && onGrid(Math.round(spot.x - fy * side * (c + 1)), Math.round(spot.y + fx * side * (c + 1)))) c++
  return c
}

/** Whether `kind` lays a barrier across the route. */
export const isBarrier = (kind: ArenaKind) => !!ARENA_KINDS[kind].opens

/**
 * Shapes the ground about `spot` for `kind`, its axis heading `f` from the way in toward the objective. Within the
 * shaped ground nothing stands but what the encounter places next; beyond it, the ground slopes back to its own. A
 * barrier's bridge lies on the side of the route with more room, as far out as BRIDGE. Returns where a barrier's bridge
 * lands on the far side, in tiles along the axis and across, or null.
 */
export function shapeArena(battle: Battle, kind: ArenaKind, spot: Tile, [fx, fy]: [number, number]): [number, number] | null {
  battle.arenaKind = kind
  if (kind === 'open') return null
  const shape = SHAPES[kind]
  const axis = (t: number): [number, number] => {
    const dx = (t % GRID) - spot.x
    const dy = Math.floor(t / GRID) - spot.y
    return [dx * fx + dy * fy, -dx * fy + dy * fx]
  }
  const side = room(spot, [fx, fy], 1) >= room(spot, [fx, fy], -1) ? 1 : -1
  const b = side * Math.min(BRIDGE, room(spot, [fx, fy], side) - 3)
  const shaped = new Set<number>()
  const mire: number[] = []
  for (let t = 0; t < GRID * GRID; t++) {
    const [a, c] = axis(t)
    const level = shape(a, c, b)
    if (level === null || battle.ground[t] === 'void') continue
    shaped.add(t)
    battle.north[t] = battle.west[t] = 'none'
    if (t + GRID < GRID * GRID) battle.north[t + GRID] = 'none'
    if (t % GRID < GRID - 1) battle.west[t + 1] = 'none'
    if (level === 'drop' || level === 'water') {
      battle.ground[t] = level === 'drop' ? 'void' : 'water'
      battle.props[t] = level === 'drop' ? 'void' : 'water'
      battle.bulk[t] = 1
      battle.height[t] = 0
      continue
    }
    battle.props[t] = 'none'
    battle.bulk[t] = 0
    battle.height[t] = level === 'mire' ? 0 : level
    // The hive keeps its own ground: nothing human stands there.
    const hive = battle.place === 'hive'
    battle.ground[t] = level === 'mire' ? 'mire' : hive ? 'hive' : ['water', 'floor', 'mire'].includes(battle.ground[t]) ? 'pavement' : battle.ground[t]
    if (level === 'mire') mire.push(t)
    if (!hive && kind === 'overpass' && level === 3) battle.ground[t] = 'road'
    if (!hive && (kind === 'chasm' || kind === 'river') && within(a, ...BAND)) battle.ground[t] = 'road'
  }
  if (kind === 'skyscraper') {
    // Glass on the roof's edge over the drop, in runs.
    for (const t of shaped) {
      if (battle.ground[t] === 'void') continue
      const [a, c] = axis(t)
      if (Math.floor((a + c + 64) / PANE_RUN) % 2 !== 0) continue
      const x = t % GRID
      if (x > 0 && battle.ground[t - 1] === 'void') battle.west[t] = 'window'
      if (x < GRID - 1 && battle.ground[t + 1] === 'void') battle.west[t + 1] = 'window'
      if (t >= GRID && battle.ground[t - GRID] === 'void') battle.north[t] = 'window'
      if (t + GRID < GRID * GRID && battle.ground[t + GRID] === 'void') battle.north[t + GRID] = 'window'
    }
  }
  if (kind === 'swamp') bog(battle, mire, axis, b)
  soften(battle, GRID, (t) => shaped.has(t))
  return isBarrier(kind) ? [(kind === 'swamp' ? MIRE_BAND : BAND)[1] + 2, b] : null
}
