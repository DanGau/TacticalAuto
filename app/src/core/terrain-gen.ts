// Generates a battlefield: streets, lots filled with places, its layout, the twist, hills, and a way into every patch.
import { REGIONS, regionsFor, type Region } from './regions'
import { layStreets, type Way } from './streets'
import { randomInt } from './rng'
import type { Twist } from './twists'
import type { Edge, Ground, Locale, Terrain, TerrainKind } from './terrain'
import { createPlot, PLOTS, type Layout, type Rect } from './terrain-lots'

/** Hills each kind of place has. */
const HILLS: Record<TerrainKind, number> = { town: 2, city: 1, countryside: 3, industrial: 1, ruins: 2, compound: 2, hive: 3 }

/**
 * A battlefield of the given kind, in the manner of XCOM 2's plots and parcels: roads cut the map into lots,
 * and each lot is filled with one place. Vehicles stand on the roads.
 */
export function generateTerrain(rng: { rng: number }, size: number, kind: TerrainKind, twist: Twist | null = null, place?: Locale): Terrain {
  const options = regionsFor(kind)
  const region = place?.region ?? options[randomInt(rng, options.length)]
  const R: Region = REGIONS[region]
  const city = place?.city ?? R.cities[randomInt(rng, R.cities.length)]
  const { ground, props, north, west, doorways, inside, chance, between, put, each, scaled, fill, compound, hive } = createPlot(rng, size, kind, R)
  /** Width of a bridge over a river. */
  const ROAD = 2

  /**
   * Rolling hills: each a mound, its crest a level higher. Water lies on the flat, and a building stands level,
   * on the height of its highest floor tile.
   */
  function hills(): number[] {
    const height = Array<number>(size * size).fill(0)
    for (let i = Math.round(HILLS[kind] * R.hills * ((size * size) / 1024)); i > 0; i--) {
      const c = { x: between(0, size - 1), y: between(0, size - 1) }
      const reach = between(4, 7)
      each({ x1: 0, y1: 0, x2: size - 1, y2: size - 1 }, (x, y) => {
        const d = Math.hypot(x - c.x, y - c.y)
        const h = d <= reach * 0.45 ? 2 : d <= reach ? 1 : 0
        height[y * size + x] = Math.max(height[y * size + x], h)
      })
    }
    ground.forEach((g, t) => g === 'water' && (height[t] = 0))
    const done = new Set<number>()
    ground.forEach((g, start) => {
      if (g !== 'floor' || done.has(start)) return
      const room = [start]
      done.add(start)
      for (const t of room) {
        for (const n of [t - 1, t + 1, t - size, t + size]) {
          if (n < 0 || n >= size * size || done.has(n) || ground[n] !== 'floor' || Math.abs((n % size) - (t % size)) > 1) continue
          done.add(n)
          room.push(n)
        }
      }
      const top = Math.max(...room.map((t) => height[t]))
      for (const t of room) height[t] = top
    })
    return height
  }

  if (kind === 'compound' || kind === 'hive') {
    if (kind === 'compound') compound()
    else hive()
    return finish()
  }
  const plot = PLOTS[kind]

  // The region's streets, then the lots packed into the blocks they leave, each filled with one place.
  // Out in the country the streets run twice as far apart, round lots twice as big and farther apart.
  const ways = layStreets(rng, size, kind === 'countryside' ? { ...R.streets, spacing: [R.streets.spacing[0] * 2, R.streets.spacing[1] * 2] } : R.streets)
  ways.forEach((way, t) => {
    if (way === 'land') return
    ground[t] = way === 'canal' ? 'water' : way === 'square' ? 'pavement' : 'road'
    if (way === 'canal') props[t] = 'water'
  })
  // A highway's median is a crash barrier; vehicles stand along the streets.
  const along = (t: number) => (t % size < size - 1 && ways[t + 1] === 'street' ? 1 : t + size < size * size && ways[t + size] === 'street' ? size : 0)
  ways.forEach((way, t) => {
    if (way === 'median') return void (t % 3 !== 0 && put(t % size, Math.floor(t / size), 'fence'))
    if (way !== 'street' || !chance(R.streets.plan === 'freeway' ? 0.05 : 0.025)) return
    const next = along(t)
    if (!next || props[t + next] !== 'none') return
    const vehicle = chance(kind === 'industrial' ? 0.5 : 0.2) ? 'truck' : 'car'
    put(t % size, Math.floor(t / size), vehicle)
    put((t + next) % size, Math.floor((t + next) / size), vehicle)
  })
  // In ruins, rubble lies across the streets.
  if (kind === 'ruins') ways.forEach((way, t) => void (way === 'street' && chance(0.08) && put(t % size, Math.floor(t / size), 'rubble')))
  const country = kind === 'countryside' ? 2 : 1
  for (const lot of packLots(ways, size, [R.lot[0] * country, R.lot[1] * country], R.gap * country + country - 1, rng)) fill(lot)

  /** Clears a tile of what stands on it and its walls, and sets its ground; water also fills it. */
  const clear = (x: number, y: number, with_: Ground) => {
    if (!inside(x, y)) return
    const at = y * size + x
    ground[at] = with_
    props[at] = with_ === 'water' ? 'water' : 'none'
    north[at] = west[at] = 'none'
    if (y + 1 < size) north[at + size] = 'none'
    if (x + 1 < size) west[at + 1] = 'none'
  }
  /** Lays `along` the map, across at `across(i)`, `wide` tiles thick, by tile index along it. */
  const band = (vertical: boolean, across: (i: number) => number, wide: number, with_: (i: number) => Ground) => {
    for (let i = 0; i < size; i++) for (let d = 0; d < wide; d++) clear(vertical ? across(i) + d : i, vertical ? i : across(i) + d, with_(i))
  }
  /** A path that wanders from near the middle, a tile at a time. */
  const wander = () => {
    let at = between(Math.floor(size / 3), Math.floor((2 * size) / 3))
    return Array.from({ length: size }, () => (at = Math.min(size - 6, Math.max(3, at + (chance(0.3) ? between(-1, 1) : 0)))))
  }

  const layouts: Record<Layout, () => void> = {
    grid: () => {},
    // A river splits the map; a few bridges are the only ways across.
    river: () => {
      const path = wander()
      const bridges = [between(3, scaled(9)), between(scaled(13), scaled(18)), between(scaled(22), size - 4)].filter(() => chance(0.8))
      if (bridges.length === 0) bridges.push(between(scaled(12), scaled(19)))
      band(chance(0.5), (i) => path[i], 3, (i) => (bridges.some((b) => i >= b && i < b + ROAD) ? 'road' : 'water'))
    },
    // Water takes one side of the map, along a ragged shore.
    coast: () => {
      const shore = wander().map((at) => Math.min(at, scaled(6)))
      const vertical = chance(0.5)
      for (let i = 0; i < size; i++) for (let d = 0; d < shore[i]; d++) clear(vertical ? d : i, vertical ? i : d, 'water')
    },
    // A blast crater: an open bowl of scorched ground in the middle, ringed by rubble, where no one has cover.
    crater: () => {
      const c = { x: between(scaled(12), size - scaled(13)), y: between(scaled(12), size - scaled(13)) }
      const reach = between(5, 7)
      each({ x1: 0, y1: 0, x2: size - 1, y2: size - 1 }, (x, y) => {
        const d = Math.hypot(x - c.x, y - c.y)
        if (d <= reach) clear(x, y, 'scorched')
        else if (d <= reach + 1.5 && chance(0.35)) put(x, y, 'rubble')
      })
    },
    // Long walls cut the map into three lanes, joined only at a few gaps.
    lanes: () => {
      const vertical = chance(0.5)
      for (const at of [Math.floor(size / 3) + between(-2, 2), Math.floor((2 * size) / 3) + between(-2, 2)]) {
        const gaps = [between(2, scaled(8)), between(scaled(13), scaled(18)), between(scaled(23), size - 3)]
        for (let i = 0; i < size; i++) {
          const edge = gaps.some((g) => i >= g && i < g + 2) ? 'none' : 'wall'
          if (vertical) west[i * size + at] = edge
          else north[at * size + i] = edge
          if (edge === 'none') doorways.add(vertical ? i * size + at : at * size + i)
        }
      }
    },
  }
  const layout = plot.layouts[randomInt(rng, plot.layouts.length)]
  layouts[layout]()
  return finish()

  /** The edge between neighbouring tiles `a` and `b`, as an index into `north` or `west`. */
  function edgeOf(a: number, b: number): [Edge[], number] {
    return [Math.abs(a - b) === size ? north : west, Math.max(a, b)]
  }
  /** The tiles beside `t` on the grid, not void. */
  function beside(t: number): number[] {
    return [t - size, t + size, t % size > 0 ? t - 1 : -1, t % size < size - 1 ? t + 1 : -1].filter((n) => n >= 0 && n < size * size && ground[n] !== 'void')
  }

  /** Clears a way into every patch of open ground that cover and walls cut off, as narrow ground can. */
  function connect(): void {
    const open = (t: number) => ground[t] !== 'void' && props[t] === 'none'
    const reached = new Uint8Array(size * size)
    /** Grows `reached` over open ground from the tiles queued. */
    const flood = (queue: number[]) => {
      for (const t of queue) reached[t] = 1
      for (let i = 0; i < queue.length; i++)
        for (const n of beside(queue[i])) {
          const [edges, at] = edgeOf(queue[i], n)
          if (reached[n] || !open(n) || edges[at] !== 'none') continue
          reached[n] = 1
          queue.push(n)
        }
    }
    flood([props.findIndex((_, t) => open(t))])
    // A way cleared opens only tiles on it, which join `reached`: no tile before the last patch found is cut off.
    for (let lost = 0; ; ) {
      while (lost < size * size && !(open(lost) && !reached[lost])) lost++
      if (lost === size * size) return
      // The shortest way over any ground from the patch cut off to the rest, cleared of props and walls.
      const from = new Map<number, number>([[lost, lost]])
      const search = [lost]
      let end = -1
      for (let i = 0; i < search.length && end === -1; i++)
        for (const n of beside(search[i]))
          if (!from.has(n)) {
            from.set(n, search[i])
            if (reached[n]) end = n
            search.push(n)
          }
      const way: number[] = []
      for (let t = end; t !== lost; t = from.get(t)!) {
        const [edges, at] = edgeOf(t, from.get(t)!)
        edges[at] = 'none'
        // Water on the way is bridged.
        for (const at of [t, from.get(t)!]) {
          if (ground[at] === 'water') ground[at] = 'road'
          props[at] = 'none'
          way.push(at)
        }
      }
      flood(way)
    }
  }

  /** Lays the twist on the finished plot: narrow ground cuts it to a shape, fuel scatters tanks. */
  function finish(): Terrain {
    if (twist === 'narrow') {
      // The shapes cut from the battlefield, about its middle.
      const span = size - 1
      const mid = { x: size / 2, y: size / 2 }
      const half = span / 2
      const shapes = [
        // A corridor, a third of the map wide, across it either way.
        (x: number, y: number) => Math.abs((vertical ? x - mid.x : y - mid.y)) > span / 5,
        // A corner: one quarter gone, and a bit more.
        (x: number, y: number) => (cx ? x < mid.x - span * 0.05 : x >= mid.x + span * 0.05) && (cy ? y < mid.y - span * 0.05 : y >= mid.y + span * 0.05),
        // An island: everything beyond a circle.
        (x: number, y: number) => Math.hypot(x + 0.5 - mid.x, y + 0.5 - mid.y) > half - 1,
      ]
      const vertical = chance(0.5)
      const cx = chance(0.5)
      const cy = chance(0.5)
      const gone = shapes[randomInt(rng, shapes.length)]
      each({ x1: 0, y1: 0, x2: size - 1, y2: size - 1 }, (x, y) => {
        if (!gone(x, y)) return
        const at = y * size + x
        ground[at] = 'void'
        props[at] = 'void'
        north[at] = west[at] = 'none'
        if (y + 1 < size) north[at + size] = 'none'
        if (x + 1 < size) west[at + 1] = 'none'
      })
    }
    connect()
    if (twist === 'fuel') for (let i = 0; i < scaled(scaled(14)); i++) put(between(1, size - 2), between(1, size - 2), 'fuel')
    const height = hills().map((h, t) => (ground[t] === 'void' ? 0 : h))
    return { ground, props, north, west, height, region, city }
  }
}

/**
 * The lots the land between streets is packed into: rectangles `lot` tiles on a side at most, laid row by row over
 * whatever shape each block is, `gap` tiles of passage left beside and below each. A scrap too small to hold a lot
 * is left as part of the block's open ground.
 */
function packLots(ways: Way[], size: number, lot: [number, number], gap: number, rng: { rng: number }): Rect[] {
  const taken = ways.map((way) => way !== 'land')
  const free = (x: number, y: number) => x >= 0 && y >= 0 && x < size && y < size && !taken[y * size + x]
  const lots: Rect[] = []
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      if (!free(x, y)) continue
      const wide = lot[0] + randomInt(rng, lot[1] - lot[0] + 1)
      const deep = lot[0] + randomInt(rng, lot[1] - lot[0] + 1)
      let w = 0
      while (w < wide && free(x + w, y)) w++
      const row = (at: number) => Array.from({ length: w }, (_, i) => free(x + i, at)).every(Boolean)
      let h = 1
      while (h < deep && row(y + h)) h++
      // A sliver left beside or below, too thin for a lot of its own, is folded into this one.
      let past = 0
      while (past < lot[0] && free(x + w + past, y)) past++
      if (past < lot[0]) w += past
      past = 0
      while (past < lot[0] && row(y + h + past)) past++
      if (past < lot[0]) h += past
      // The lot and the passage beside and below it are claimed together.
      for (let dy = 0; dy < h + gap; dy++) for (let dx = 0; dx < w + gap; dx++) if (free(x + dx, y + dy)) taken[(y + dy) * size + x + dx] = true
      if (w >= 2 && h >= 2) lots.push({ x1: x, y1: y, x2: x + w - 1, y2: y + h - 1 })
    }
  return lots
}
