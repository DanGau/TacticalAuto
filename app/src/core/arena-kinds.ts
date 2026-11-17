// The ground a battle is fought over: its levels, ledges, drops, water, mire and ice, and what each pays.
import { GRID, type Battle, type Tile } from './battle'
import { CHALLENGES, type ChallengeId } from './challenges'
import type { Quantity } from './quantities'
import { carries, type EffectId, type UtilityId } from './utilities'
import { soften } from './levels'
import { randomInt } from './rng'
import { PROP_BULK, type Ground, type TerrainKind } from './terrain'
import { NEIGHBORS, onGrid } from './grid'
import type { Twist } from './twists'
import { REGIONS, type RegionId } from './regions'

/**
 * The kinds of ground a battle is fought over. Open ground has gentle rises; rooftops have a drop on every side, some
 * behind glass; an overpass runs a raised road down one flank; a quarry climbs in terraces; a rift splits the middle;
 * flooded streets run with canals; a marsh is mire and gas; a mesa holds the far end high; an ice sheet is slick.
 */
export type ArenaKind = 'open' | 'skyscraper' | 'overpass' | 'quarry' | 'rift' | 'flooded' | 'marsh' | 'mesa' | 'ice'

/**
 * What the player is told of each. `pays`: the boons that exploit it; `reads`: the quantities a build makes that it
 * multiplies. Open ground favours nothing.
 */
export const ARENA_KINDS: Record<ArenaKind, { name: string; icon: string; text: string; pays: EffectId[]; reads: Quantity[] }> = {
  open: { name: 'Open Ground', icon: '🌾', text: 'Gentle rises.', pays: [], reads: [] },
  skyscraper: { name: 'Rooftops', icon: '🏙️', text: 'A long drop on every side, some behind glass. A Displaced alien falls off.', pays: ['push'], reads: ['moved', 'impact'] },
  overpass: { name: 'Overpass', icon: '🛣️', text: 'A raised road down one flank. Shots from above deal 1 more damage per level.', pays: ['farsight', 'keen', 'push'], reads: ['crit', 'moved'] },
  quarry: { name: 'Quarry', icon: '⛏️', text: 'Terraces climb to the far end. Displace an alien off a terrace to hurt it.', pays: ['push', 'farsight'], reads: ['moved', 'impact'] },
  rift: { name: 'Rift', icon: '🕳️', text: 'A rift splits the middle. A Displaced alien at its lip falls in.', pays: ['push', 'hover'], reads: ['moved'] },
  flooded: { name: 'Flooded', icon: '🌊', text: 'Canals cross the streets. An alien beside water or on ice takes 1 more Chill.', pays: ['coldSnap', 'hover'], reads: ['chill'] },
  marsh: { name: 'Marsh', icon: '🫧', text: 'Mire costs 3 times the move. Burn on an alien in mire sets the mire about it alight.', pays: ['blaze', 'hover'], reads: ['burn'] },
  mesa: { name: 'Mesa', icon: '🏜️', text: 'The far end stands on a mesa, ramps up its sides. Shots from above deal 1 more damage per level.', pays: ['farsight', 'keen', 'hover', 'push'], reads: ['crit', 'moved'] },
  ice: { name: 'Ice Sheet', icon: '🧊', text: 'An alien Displaced on ice slides 3 more tiles. An alien beside water or on ice takes 1 more Chill.', pays: ['coldSnap', 'push'], reads: ['chill', 'moved'] },
}

/** Where a region draws its ground: its signature as often as all the rest. A satellite's compound and the hive keep their own. */
const OWN: Partial<Record<TerrainKind, ArenaKind[]>> = { compound: ['open'], hive: ['rift', 'marsh', 'open'] }

/** Kinds whose drop is void, which narrow ground's own void would cut too small. */
const VOIDED: ArenaKind[] = ['skyscraper', 'rift']

/** The ground of a battle in `region` on `place`, fitting its challenge and twist: a Slog is a marsh; a Firing line's ridge needs open ground. */
export function pickArenaKind(rng: { rng: number }, region: RegionId | undefined, place: TerrainKind, challenge: ChallengeId | null, twist: Twist | null): ArenaKind {
  if (challenge === 'slog') return 'marsh'
  if (challenge === 'firingLine') return 'open'
  const own = OWN[place] ?? (region ? REGIONS[region].ground : ['open'])
  const fits = own.filter((k) => twist !== 'narrow' || !VOIDED.includes(k))
  if (fits.length === 0) return 'open'
  // The signature first, as likely as all the rest together.
  return randomInt(rng, 2) === 0 || fits.length === 1 ? fits[0] : fits[1 + randomInt(rng, fits.length - 1)]
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

/** Tiles within `reach` of where the ground pays: a drop, water or ice, or mire. */
export function lures(battle: Battle, reach: number): Set<number> {
  const kind = battle.arenaKind
  if (kind === 'open') return new Set()
  const wanted: Ground[] = kind === 'flooded' || kind === 'ice' ? ['water', 'ice'] : kind === 'marsh' ? ['mire'] : []
  if (wanted.length === 0) return dropsNear(battle, reach)
  const near = new Set<number>()
  for (let t = 0; t < GRID * GRID; t++) {
    if (!wanted.includes(battle.ground[t])) continue
    const x = t % GRID
    const y = Math.floor(t / GRID)
    for (let dy = -reach; dy <= reach; dy++) for (let dx = -reach; dx <= reach; dx++) if (onGrid(x + dx, y + dy)) near.add((y + dy) * GRID + x + dx)
  }
  return near
}

/** Half the side of the square about the arena's centre an arena kind shapes; beyond it the ground slopes back to its own. */
const FOOT = 16

/** What a kind makes of a tile at `a` tiles along the axis and `c` across: its level, a drop, water, mire, ice, or as it was. */
type Shape = (a: number, c: number) => number | 'drop' | 'water' | 'mire' | 'ice' | null

/** A rift's half length across the axis, and its band along it; the broken span over it, its gap the middle tiles. */
const RIFT_HALF = 9
const RIFT: [number, number] = [-3.5, 0.5]
const SPAN_HALF = 1.5

/** A flooded arena's two canals, along the axis, and the half width of the ford through each. */
const CANALS: [number, number][] = [[-6.5, -4.5], [3.5, 5.5]]
const FORD_HALF = 1.5

/** Levels a mesa stands, too high for any jump, its half width, where its face stands along the axis, and its two ramps. */
const MESA_HIGH = 3
const MESA_HALF = 11
const MESA_FACE = 3
const RAMP_AT = 7

/** Levels of a ramp `d` tiles out from the edge of ground `top` high. */
const ramp = (top: number, d: number) => Math.max(0, top - Math.ceil(d))

const within = (v: number, lo: number, hi: number) => v >= lo && v <= hi

/** Blobs in the shaped square: how many, their least and greatest radii. */
type Blob = { a: number; c: number; r: number }
const blobs = (battle: Battle, n: number, [r0, r1]: [number, number], margin = 3): Blob[] =>
  Array.from({ length: n }, () => ({ a: randomInt(battle, 2 * (FOOT - margin)) - FOOT + margin, c: randomInt(battle, 2 * (FOOT - margin)) - FOOT + margin, r: r0 + (randomInt(battle, 4) / 3) * (r1 - r0) }))
const inBlob = (of: Blob[], a: number, c: number) => of.some((o) => Math.hypot(a - o.a, c - o.c) <= o.r)

/** Whether a tile lies within reach of the landing or the objective, kept firm so either end stands on solid ground. */
const ends = (a: number, c: number) => Math.abs(c) <= 3 && Math.abs(a) >= 11

/** Each kind's shape; the random ones draw their blobs or fords from the battle. */
const SHAPES: Record<Exclude<ArenaKind, 'open'>, (battle: Battle) => Shape> = {
  // The roof, a machine deck over the far end and a stair up to it; all else is the drop.
  skyscraper: () => (a, c) => {
    if (Math.abs(a) > 14.5 || Math.abs(c) > 7.5) return 'drop'
    if (within(a, 5, 10) && Math.abs(c) <= 5) return 2
    return within(a, 3.5, 5) && Math.abs(c) <= 1.5 ? 1 : 0
  },
  // A road three levels up down one flank, a ramp off each side.
  overpass: () => (a, c) => {
    if (Math.abs(a) > FOOT || Math.abs(c) > FOOT) return null
    if (within(c, 3.5, 7.5)) return 3
    if (within(a, -9, -6) && within(c, 0.5, 3.5)) return ramp(3, 3.5 - c)
    if (within(a, 4, 7) && within(c, 7.5, 10.5)) return ramp(3, c - 7.5)
    return 0
  },
  // Terraces two levels apart, each joined to the next by two ramps.
  quarry: () => (a, c) => {
    if (Math.abs(a) > FOOT || Math.abs(c) > FOOT) return null
    if (a < -6) return 0
    if (a < -5) return within(c, -10, -7) || within(c, 6, 9) ? 1 : 0
    if (a < 1) return 2
    if (a < 2) return within(c, -3, 0) || within(c, 9, 12) ? 3 : 2
    return 4
  },
  // A rift across the middle, open round both ends; a span over it, its middle fallen.
  rift: () => (a, c) => {
    if (Math.abs(a) > FOOT || Math.abs(c) > FOOT) return null
    if (!within(a, ...RIFT) || Math.abs(c) > RIFT_HALF) return 0
    return Math.abs(c) <= SPAN_HALF && !within(a, -2, -0.5) ? 0 : 'drop'
  },
  // Two canals across the streets, each forded at a different side, and pools between.
  flooded: (battle) => {
    const ford = (randomInt(battle, 2) * 2 - 1) * (4 + randomInt(battle, 5))
    const pools = blobs(battle, 4, [1, 2])
    return (a, c) => {
      if (Math.abs(a) > FOOT || Math.abs(c) > FOOT) return null
      const canal = CANALS.findIndex(([lo, hi]) => within(a, lo, hi))
      if (canal >= 0) return Math.abs(c - (canal === 0 ? ford : -ford)) <= FORD_HALF ? 0 : 'water'
      return !ends(a, c) && inBlob(pools, a, c) ? 'water' : 0
    }
  },
  // Wide beds of mire, firm ground winding between.
  marsh: (battle) => {
    const beds = blobs(battle, 7, [3, 5], 1)
    return (a, c) => (Math.abs(a) > FOOT || Math.abs(c) > FOOT ? null : !ends(a, c) && inBlob(beds, a, c) ? 'mire' : 0)
  },
  // The far end MESA_HIGH levels up, a ramp up each side.
  mesa: () => (a, c) => {
    if (Math.abs(a) > FOOT || Math.abs(c) > FOOT) return null
    if (a >= MESA_FACE && Math.abs(c) <= MESA_HALF) return MESA_HIGH
    const up = MESA_FACE - a
    return Math.abs(Math.abs(c) - RAMP_AT) <= SPAN_HALF && up > 0 && up <= MESA_HIGH ? ramp(MESA_HIGH, up) : 0
  },
  // Sheets of ice, with a few holes of open water.
  ice: (battle) => {
    const sheets = blobs(battle, 6, [3, 5], 1)
    const holes = blobs(battle, 3, [1, 1.5])
    return (a, c) => {
      if (Math.abs(a) > FOOT || Math.abs(c) > FOOT) return null
      if (ends(a, c)) return 0
      return inBlob(holes, a, c) ? 'water' : inBlob(sheets, a, c) ? 'ice' : 0
    }
  },
}

/** A marsh's pools and islands in the mire: how many of each and their radii; the share of firm tiles that hold a tree. */
const ISLANDS = 6
const POOLS = 8
const TREES = 0.15

/** Lays pools and wooded islands, a level up, over a marsh's mire. */
function bog(battle: Battle, mire: number[], axis: (t: number) => [number, number]): void {
  const islands = blobs(battle, ISLANDS, [1, 2])
  const pools = blobs(battle, POOLS, [1, 2])
  const clear = (x: number, y: number) => NEIGHBORS.every(([dx, dy]) => !onGrid(x + dx, y + dy) || battle.bulk[(y + dy) * GRID + x + dx] === 0)
  for (const t of mire) {
    const [a, c] = axis(t)
    const island = inBlob(islands, a, c)
    if (island) {
      battle.ground[t] = battle.place === 'hive' ? 'hive' : 'grass'
      battle.height[t] = 1
    }
    const prop = !island && inBlob(pools, a, c) ? 'water' : island && randomInt(battle, 100) < 100 * TREES && clear(t % GRID, Math.floor(t / GRID)) ? 'tree' : null
    if (!prop) continue
    if (prop === 'water') battle.ground[t] = 'water'
    battle.props[t] = prop
    battle.bulk[t] = PROP_BULK[prop]
  }
}

/** The parapet: glass along the roof's edge in runs of this many tiles, with as long gaps between. */
const PANE_RUN = 4

/**
 * Shapes the ground about `spot` for `kind`, its axis heading `f` from the way in toward the objective. Within the
 * shaped ground nothing stands but what the encounter places next; beyond it, the ground slopes back to its own.
 */
export function shapeArena(battle: Battle, kind: ArenaKind, spot: Tile, [fx, fy]: [number, number]): void {
  battle.arenaKind = kind
  if (kind === 'open') return
  const shape = SHAPES[kind](battle)
  const axis = (t: number): [number, number] => {
    const dx = (t % GRID) - spot.x
    const dy = Math.floor(t / GRID) - spot.y
    return [dx * fx + dy * fy, -dx * fy + dy * fx]
  }
  const shaped = new Set<number>()
  const mire: number[] = []
  const hive = battle.place === 'hive'
  for (let t = 0; t < GRID * GRID; t++) {
    const [a, c] = axis(t)
    const level = shape(a, c)
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
    battle.height[t] = typeof level === 'number' ? level : 0
    // The hive keeps its own ground: nothing human stands there.
    const own: Ground = hive ? 'hive' : ['water', 'floor', 'mire', 'ice'].includes(battle.ground[t]) ? 'pavement' : battle.ground[t]
    battle.ground[t] = level === 'mire' || level === 'ice' ? level : own
    if (level === 'mire') mire.push(t)
    if (!hive && kind === 'overpass' && level === 3) battle.ground[t] = 'road'
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
  if (kind === 'marsh') bog(battle, mire, axis)
  soften(battle, GRID, (t) => shaped.has(t))
}

/** What marks each kind's feature on the ground: the tiles to name it by. */
const FEATURE: Record<ArenaKind, (battle: Battle, t: number) => boolean> = {
  open: () => false,
  skyscraper: (b, t) => b.ground[t] === 'void',
  overpass: (b, t) => b.height[t] >= 3,
  quarry: (b, t) => b.height[t] >= 4,
  rift: (b, t) => b.ground[t] === 'void',
  flooded: (b, t) => b.ground[t] === 'water',
  marsh: (b, t) => b.ground[t] === 'mire',
  mesa: (b, t) => b.height[t] >= MESA_HIGH,
  ice: (b, t) => b.ground[t] === 'ice',
}

/** The tile of the ground's feature nearest the arena's centre, or null on open ground. */
export function featureOf(battle: Battle): Tile | null {
  let best: Tile | null = null
  for (let t = 0; t < GRID * GRID; t++) {
    if (!FEATURE[battle.arenaKind](battle, t)) continue
    const tile = { x: t % GRID, y: Math.floor(t / GRID) }
    if (!best || Math.hypot(tile.x - battle.arena.x, tile.y - battle.arena.y) < Math.hypot(best.x - battle.arena.x, best.y - battle.arena.y)) best = tile
  }
  return best
}

/** What the deploy screen says boon `id` does here: exploits the ground, answers the challenge, both, or neither. */
export function scouted(battle: Pick<Battle, 'arenaKind' | 'challenge'>, id: UtilityId): { ground: boolean; challenge: boolean } {
  return { ground: carries(id, ARENA_KINDS[battle.arenaKind].pays), challenge: !!battle.challenge && carries(id, CHALLENGES[battle.challenge].answers) }
}
