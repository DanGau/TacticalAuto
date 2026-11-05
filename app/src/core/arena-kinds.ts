// The shape of the ground an encounter is fought on: its levels, ledges, ramps and drops.
import { GRID, type Battle, type Tile } from './battle'
import type { ChallengeId } from './challenges'
import type { Goal } from './goals'
import { soften } from './levels'
import { randomInt } from './rng'
import { PROP_BULK, type TerrainKind } from './terrain'
import { NEIGHBORS, onGrid } from './grid'
import type { Twist } from './twists'

/**
 * The kinds of arena. Open ground has gentle rises. A skyscraper's roof has a drop on every side, some of it behind
 * glass; an overpass runs a raised road down one flank; a quarry climbs in terraces toward the aliens; a mesa is a
 * plateau they hold; a chasm splits the ground, crossed by one bridge, another broken off over the drop; a swamp is
 * mire about islands of firm ground, with pools and trees.
 */
export type ArenaKind = 'open' | 'skyscraper' | 'overpass' | 'quarry' | 'mesa' | 'chasm' | 'swamp'

/** What the player is told of each. */
export const ARENA_KINDS: Record<ArenaKind, { name: string; text: string }> = {
  open: { name: 'Open ground', text: 'gentle rises' },
  skyscraper: { name: 'Skyscraper roof', text: 'a long drop on every side; throw them off' },
  overpass: { name: 'Overpass', text: 'a raised road down one flank; a hard fall off its edge' },
  quarry: { name: 'Quarry', text: 'terraces climbing toward the aliens, joined by ramps' },
  mesa: { name: 'Mesa', text: 'a sheer plateau the aliens hold, two ramps up' },
  chasm: { name: 'Chasm', text: 'a bottomless split, one bridge across and one broken' },
  swamp: { name: 'Swamp', text: 'mire about islands of firm ground, pools and trees' },
}

/** The arena kinds each kind of place may have, each as likely as the others. */
const FITS: Record<TerrainKind, ArenaKind[]> = {
  city: ['skyscraper', 'skyscraper', 'overpass', 'open'],
  industrial: ['quarry', 'overpass', 'chasm', 'open'],
  ruins: ['chasm', 'quarry', 'skyscraper', 'open'],
  countryside: ['mesa', 'quarry', 'chasm', 'open'],
  town: ['mesa', 'overpass', 'open'],
  hive: ['mesa', 'chasm', 'open'],
  compound: ['open'],
}

/** Kinds whose drop is void, which narrow ground's own void would cut too small. */
const VOIDED: ArenaKind[] = ['skyscraper', 'chasm']

/** An arena kind fitting the place, goal, challenge and twist: a VIP's building and a ridge need open ground; a Slog is a swamp. */
export function pickArenaKind(battle: { rng: number }, place: TerrainKind, goal: Goal, challenge: ChallengeId | null, twist: Twist | null): ArenaKind {
  if (challenge === 'slog') return 'swamp'
  if (goal === 'vip' || challenge === 'firingLine') return 'open'
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

/** How far to each side of the axis a chasm runs. */
const CHASM_REACH = 22

/** What a kind makes of a tile at `a` tiles along the axis and `c` across: its level, a drop, or as it was. */
type Shape = (a: number, c: number) => number | 'drop' | null

/** Levels of a ramp `d` tiles out from the edge of ground `top` high. */
const ramp = (top: number, d: number) => Math.max(0, top - Math.ceil(d))

const within = (v: number, lo: number, hi: number) => v >= lo && v <= hi

const SHAPES: Record<Exclude<ArenaKind, 'open'>, Shape> = {
  // The roof, a machine deck over the aliens' end and a stair up to it; all else is the drop.
  skyscraper: (a, c) => {
    if (Math.abs(a) > 12.5 || Math.abs(c) > 7.5) return 'drop'
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
  // A plateau about the aliens' overlook, a ramp up its front and one up its flank.
  mesa: (a, c) => {
    if (Math.abs(a) > FOOT || Math.abs(c) > FOOT) return null
    const d = Math.hypot(a - 7, c)
    if (d <= 6) return 3
    if (d <= 9 && ((Math.abs(c) <= 1.5 && a < 7) || (Math.abs(a - 7) <= 1.5 && c > 0))) return ramp(3, d - 6)
    return 0
  },
  // A split across the arena and past it, bridged whole on one flank, broken off over the drop on the other.
  chasm: (a, c) => {
    if (within(a, -3.5, 0.4) && Math.abs(c) <= CHASM_REACH) {
      if (within(c, -9.5, -6.5)) return 0
      return within(c, 5.5, 8.5) && (a < -2.5 || a >= -0.5) ? 0 : 'drop'
    }
    return Math.abs(a) > FOOT || Math.abs(c) > FOOT ? null : 0
  },
  swamp: (a, c) => (Math.abs(a) > FOOT || Math.abs(c) > FOOT ? null : 0),
}

/** A swamp's islands and pools: how many of each and their radii; the firm shore the way in lands on, in tiles along the axis; the share of island tiles that hold a tree. */
const ISLANDS = 9
const ISLAND_RADIUS = [1.5, 3]
const POOLS = 8
const POOL_RADIUS = [1, 2]
const SHORE = -10
const TREES = 0.3

/** Lays a swamp over the shaped tiles: mire about pools, and islands a level up, firm and wooded, as is the shore the way in lands on. */
function bog(battle: Battle, shaped: Set<number>, axis: (t: number) => [number, number]): void {
  const span = 2 * FOOT - 4
  const blobs = (n: number, [lo, hi]: number[]) => Array.from({ length: n }, () => ({ a: SHORE + 3 + randomInt(battle, FOOT - SHORE - 4), c: randomInt(battle, span) - span / 2, r: lo + (randomInt(battle, 4) / 3) * (hi - lo) }))
  const islands = blobs(ISLANDS, ISLAND_RADIUS)
  const pools = blobs(POOLS, POOL_RADIUS)
  const inside = (t: number, of: typeof islands) => { const [a, c] = axis(t); return of.some((b) => Math.hypot(a - b.a, c - b.c) <= b.r) }
  const clear = (x: number, y: number) => NEIGHBORS.every(([dx, dy]) => !onGrid(x + dx, y + dy) || battle.bulk[(y + dy) * GRID + x + dx] === 0)
  for (const t of shaped) {
    const shore = axis(t)[0] < SHORE
    const island = !shore && inside(t, islands)
    battle.ground[t] = shore || island ? 'grass' : inside(t, pools) ? 'water' : 'mire'
    if (island) battle.height[t] = 1
    const prop = battle.ground[t] === 'water' ? 'water' : island && randomInt(battle, 100) < 100 * TREES && clear(t % GRID, Math.floor(t / GRID)) ? 'tree' : null
    if (!prop) continue
    battle.props[t] = prop
    battle.bulk[t] = PROP_BULK[prop]
  }
}

/** The parapet: glass along the roof's edge in runs of this many tiles, with as long gaps between. */
const PANE_RUN = 4

/**
 * Shapes the ground about `spot` for `kind`, its axis heading `f` from the way in toward the aliens. Within the
 * shaped square nothing stands but what the encounter places next; beyond it, the ground slopes back to its own.
 */
export function shapeArena(battle: Battle, kind: ArenaKind, spot: Tile, [fx, fy]: [number, number]): void {
  battle.arenaKind = kind
  if (kind === 'open') return
  const shape = SHAPES[kind]
  const axis = (t: number): [number, number] => {
    const dx = (t % GRID) - spot.x
    const dy = Math.floor(t / GRID) - spot.y
    return [dx * fx + dy * fy, -dx * fy + dy * fx]
  }
  const shaped = new Set<number>()
  for (let t = 0; t < GRID * GRID; t++) {
    const [a, c] = axis(t)
    const level = shape(a, c)
    if (level === null || battle.ground[t] === 'void') continue
    shaped.add(t)
    battle.north[t] = battle.west[t] = 'none'
    if (t + GRID < GRID * GRID) battle.north[t + GRID] = 'none'
    if (t % GRID < GRID - 1) battle.west[t + 1] = 'none'
    if (level === 'drop') {
      battle.ground[t] = 'void'
      battle.props[t] = 'void'
      battle.bulk[t] = 1
      battle.height[t] = 0
      continue
    }
    battle.props[t] = 'none'
    battle.bulk[t] = 0
    battle.height[t] = level
    if (['water', 'floor', 'mire'].includes(battle.ground[t])) battle.ground[t] = 'pavement'
    if (kind === 'overpass' && level === 3) battle.ground[t] = 'road'
    if (kind === 'chasm' && within(a, -3.5, 0.4)) battle.ground[t] = 'road'
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
  if (kind === 'swamp') bog(battle, shaped, axis)
  soften(battle, GRID, (t) => shaped.has(t))
}
