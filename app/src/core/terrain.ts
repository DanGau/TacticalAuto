import { random, randomInt } from './rng'

import type { Twist } from './twists'

/** What the ground of a tile is. It changes only how the tile looks, but void: no ground at all, off the battlefield. */
export type Ground = 'pavement' | 'road' | 'grass' | 'floor' | 'scorched' | 'hive' | 'water' | 'void'

/**
 * The object standing on a tile. A spire and a growth are what the aliens build; a fuel tank explodes. Void stands
 * where there is no ground: as low cover it blocks movement, not sight, and it shelters no one.
 */
export type Prop = 'none' | 'car' | 'truck' | 'tree' | 'crate' | 'stack' | 'fence' | 'rubble' | 'spire' | 'growth' | 'water' | 'fuel' | 'void'

/** What stands on the line between two tiles. A window blocks movement, but soldiers shoot through it. */
export type Edge = 'none' | 'wall' | 'window'

/** Cover: 0 nothing, 1 low, 2 high. Both kinds block movement; high cover blocks shots. */
export type Cover = 0 | 1 | 2

export const PROP_COVER: Record<Prop, Cover> = { none: 0, car: 1, truck: 2, tree: 2, crate: 1, stack: 2, fence: 1, rubble: 1, spire: 2, growth: 1, water: 1, fuel: 1, void: 1 }
export const EDGE_COVER: Record<Edge, Cover> = { none: 0, window: 1, wall: 2 }

/**
 * A battlefield's ground, objects and walls. Each array has one entry per tile, row by row.
 * `north` and `west` hold what stands on a tile's north and west edges.
 */
export interface Terrain {
  ground: Ground[]
  /** How high each tile stands: 0 on the flat, 1 on a hill, 2 on its crest. */
  height: number[]
  props: Prop[]
  north: Edge[]
  west: Edge[]
}

/** The kinds of place a zone's battles may be fought in. */
export const ZONE_TERRAINS = ['town', 'city', 'countryside', 'industrial', 'ruins'] as const

/** The kind of place a battle is fought in. A satellite stands in a compound; the alien source is a hive. */
export type TerrainKind = (typeof ZONE_TERRAINS)[number] | 'compound' | 'hive'

/** What the player is told about each kind of place. */
export const TERRAIN_TEXT: Record<TerrainKind, { name: string; text: string }> = {
  town: { name: 'Town', text: 'houses, parks, a market or a square' },
  city: { name: 'City', text: 'buildings close together; cover everywhere' },
  countryside: { name: 'Countryside', text: 'open fields and orchards; cover is scarce' },
  industrial: { name: 'Industrial yard', text: 'warehouses, crates and trucks' },
  ruins: { name: 'Ruins', text: 'fallen buildings; broken walls and rubble' },
  compound: { name: 'Satellite compound', text: 'a walled yard around the dish' },
  hive: { name: 'Alien hive', text: 'spires and growths; nothing human' },
}

export const TERRAIN_KINDS = Object.keys(TERRAIN_TEXT) as TerrainKind[]

/** A rectangle of tiles, edges included. */
interface Rect {
  x1: number
  y1: number
  x2: number
  y2: number
}

type Place = 'house' | 'warehouse' | 'ruin' | 'park' | 'orchard' | 'graveyard' | 'plaza' | 'market' | 'carPark' | 'depot' | 'field'

/** Each kind of zone place as a plot: how many roads cross it each way, and what its lots may hold, likelier if listed more. */
/** The overall shape a plot is laid over, which decides where the fighting funnels: see `layouts` below. */
export type Layout = 'grid' | 'river' | 'coast' | 'crater' | 'lanes'

/** Each kind of zone place as a plot: how many roads cross it each way, what its lots may hold, and the shapes it may take, likelier if listed more. */
const PLOTS: Record<(typeof ZONE_TERRAINS)[number], { roads: [number, number]; places: Place[]; layouts: Layout[] }> = {
  town: { roads: [1, 1], places: ['house', 'house', 'park', 'carPark', 'plaza', 'market'], layouts: ['grid', 'grid', 'river', 'crater', 'lanes'] },
  city: { roads: [2, 2], places: ['house', 'house', 'house', 'carPark', 'plaza'], layouts: ['grid', 'lanes', 'lanes', 'river'] },
  countryside: { roads: [1, 0], places: ['field', 'field', 'orchard', 'graveyard', 'park', 'house'], layouts: ['grid', 'river', 'river', 'coast', 'crater'] },
  industrial: { roads: [1, 1], places: ['warehouse', 'depot', 'depot', 'carPark'], layouts: ['grid', 'lanes', 'coast', 'river'] },
  ruins: { roads: [1, 1], places: ['ruin', 'ruin', 'ruin', 'graveyard', 'park'], layouts: ['crater', 'crater', 'grid', 'river'] },
}

/** Hills each kind of place has. */
const HILLS: Record<TerrainKind, number> = { town: 2, city: 1, countryside: 3, industrial: 1, ruins: 2, compound: 2, hive: 3 }

/** Width of a road. */
const ROAD = 2
/** A building is at least this many tiles on a side, and a house at most MAX_HOUSE. */
const MIN_BUILDING = 4
const MAX_HOUSE = 8

/**
 * A battlefield of the given kind, in the manner of XCOM 2's plots and parcels: roads cut the map into lots,
 * and each lot is filled with one place. Vehicles stand on the roads.
 */
export function generateTerrain(rng: { rng: number }, size: number, kind: TerrainKind, twist: Twist | null = null): Terrain {
  const ground = Array<Ground>(size * size).fill(kind === 'countryside' ? 'grass' : 'pavement')
  const props = Array<Prop>(size * size).fill('none')
  const north = Array<Edge>(size * size).fill('none')
  const west = Array<Edge>(size * size).fill('none')
  const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < size && y < size
  const chance = (p: number) => random(rng) < p
  const between = (low: number, high: number) => low + randomInt(rng, high - low + 1)
  /** Tiles to keep free of props: those on either side of a doorway. */
  const doorways = new Set<number>()
  /** Opens a doorway in a section of wall. */
  const open = (edges: Edge[], at: number) => {
    edges[at] = 'none'
    doorways.add(at).add(at - (edges === north ? size : 1))
  }
  /** Puts a prop on a free tile. */
  const put = (x: number, y: number, prop: Prop) => {
    if (inside(x, y) && props[y * size + x] === 'none' && !doorways.has(y * size + x)) props[y * size + x] = prop
  }
  const pave = (r: Rect, with_: Ground) => {
    for (let y = r.y1; y <= r.y2; y++) for (let x = r.x1; x <= r.x2; x++) ground[y * size + x] = with_
  }
  const each = (r: Rect, visit: (x: number, y: number) => void) => {
    for (let y = r.y1; y <= r.y2; y++) for (let x = r.x1; x <= r.x2; x++) visit(x, y)
  }

  /**
   * A building filling `b`: walls on its outline with two doorways and windows `windowEvery` wall sections apart,
   * and inside, a floor, furniture, and across a long building a wall with a doorway.
   */
  function building(b: Rect, windowEvery: number, furniture: Prop[]): void {
    pave(b, 'floor')
    const w = b.x2 - b.x1 + 1
    const h = b.y2 - b.y1 + 1
    // Every section of the outline, as the edge array and tile that hold it.
    const outline = [
      ...Array.from({ length: w }, (_, i) => ({ edges: north, at: b.y1 * size + b.x1 + i })),
      ...Array.from({ length: w }, (_, i) => ({ edges: north, at: (b.y2 + 1) * size + b.x1 + i })),
      ...Array.from({ length: h }, (_, i) => ({ edges: west, at: (b.y1 + i) * size + b.x1 })),
      ...Array.from({ length: h }, (_, i) => ({ edges: west, at: (b.y1 + i) * size + b.x2 + 1 })),
    ]
    outline.forEach((section, i) => (section.edges[section.at] = i % windowEvery === 1 ? 'window' : 'wall'))
    const door = randomInt(rng, outline.length)
    for (const i of [door, (door + between(w, w + h)) % outline.length]) open(outline[i].edges, outline[i].at)
    if (Math.max(w, h) >= 6) {
      if (w >= h) {
        const at = between(b.x1 + 2, b.x2 - 1)
        const gap = between(b.y1, b.y2)
        for (let y = b.y1; y <= b.y2; y++) west[y * size + at] = 'wall'
        open(west, gap * size + at)
      } else {
        const at = between(b.y1 + 2, b.y2 - 1)
        const gap = between(b.x1, b.x2)
        for (let x = b.x1; x <= b.x2; x++) north[at * size + x] = 'wall'
        open(north, at * size + gap)
      }
    }
    for (let i = Math.round((w * h) / 9); i > 0; i--) put(between(b.x1, b.x2), between(b.y1, b.y2), furniture[randomInt(rng, furniture.length)])
  }

  /** A house in a yard of grass, with the odd tree and fence. */
  function house(lot: Rect): void {
    const w = between(MIN_BUILDING, Math.min(MAX_HOUSE, lot.x2 - lot.x1 - 1))
    const h = between(MIN_BUILDING, Math.min(MAX_HOUSE, lot.y2 - lot.y1 - 1))
    const x1 = between(lot.x1 + 1, lot.x2 - w)
    const y1 = between(lot.y1 + 1, lot.y2 - h)
    const b: Rect = { x1, y1, x2: x1 + w - 1, y2: y1 + h - 1 }
    building(b, 3, ['crate'])
    each(lot, (x, y) => {
      if (x >= b.x1 && x <= b.x2 && y >= b.y1 && y <= b.y2) return
      ground[y * size + x] = 'grass'
      if (chance(0.06)) put(x, y, chance(0.5) ? 'tree' : 'fence')
    })
  }

  /** A building fallen in: about half its walls gone, rubble where they stood. */
  function ruin(lot: Rect): void {
    const w = between(MIN_BUILDING, Math.min(MAX_HOUSE, lot.x2 - lot.x1 - 1))
    const h = between(MIN_BUILDING, Math.min(MAX_HOUSE, lot.y2 - lot.y1 - 1))
    const x1 = between(lot.x1 + 1, lot.x2 - w)
    const y1 = between(lot.y1 + 1, lot.y2 - h)
    building({ x1, y1, x2: x1 + w - 1, y2: y1 + h - 1 }, 4, ['rubble'])
    for (let y = y1; y <= y1 + h; y++) {
      for (let x = x1; x <= x1 + w; x++) {
        for (const edges of [north, west]) {
          if (edges[y * size + x] === 'none' || !chance(0.5)) continue
          edges[y * size + x] = 'none'
          if (chance(0.6)) put(x, y, 'rubble')
        }
      }
    }
  }

  /** Trees in rows, with lanes to shoot down between them. */
  function orchard(lot: Rect): void {
    pave(lot, 'grass')
    for (let y = lot.y1; y <= lot.y2; y += 3) for (let x = lot.x1; x <= lot.x2; x += 2) if (chance(0.85)) put(x, y, 'tree')
  }

  /** Rows of headstones, low enough to shoot over, and a tree or two. */
  function graveyard(lot: Rect): void {
    pave(lot, 'grass')
    for (let y = lot.y1 + 1; y < lot.y2; y += 3) for (let x = lot.x1 + 1; x < lot.x2; x += 2) if (chance(0.8)) put(x, y, 'rubble')
    each(lot, (x, y) => void (chance(0.02) && put(x, y, 'tree')))
  }

  /** A paved square: a monument in the middle, benches around it, a tree at each corner. */
  function plaza(lot: Rect): void {
    const cx = Math.floor((lot.x1 + lot.x2) / 2)
    const cy = Math.floor((lot.y1 + lot.y2) / 2)
    for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) put(cx + dx, cy + dy, 'stack')
    for (const [dx, dy] of [[-2, 0], [-2, 1], [3, 0], [3, 1], [0, -2], [1, -2], [0, 3], [1, 3]]) put(cx + dx, cy + dy, 'fence')
    for (const [x, y] of [[lot.x1 + 1, lot.y1 + 1], [lot.x2 - 1, lot.y1 + 1], [lot.x1 + 1, lot.y2 - 1], [lot.x2 - 1, lot.y2 - 1]]) put(x, y, 'tree')
  }

  /** Market stalls: short rows of crates with gaps to walk through. */
  function market(lot: Rect): void {
    for (let y = lot.y1 + 1; y < lot.y2; y += 3) {
      for (let x = lot.x1 + 1; x < lot.x2; x++) if ((x - lot.x1) % 4 !== 0) put(x, y, chance(0.15) ? 'stack' : 'crate')
    }
  }

  /** One large building with few windows, full of crates and stacks. */
  function warehouse(lot: Rect): void {
    building({ x1: lot.x1 + 1, y1: lot.y1 + 1, x2: lot.x2 - 1, y2: lot.y2 - 1 }, 7, ['crate', 'crate', 'stack'])
  }

  /** Trees, thick enough to hide in. */
  function park(lot: Rect): void {
    pave(lot, 'grass')
    each(lot, (x, y) => {
      if (chance(0.14)) put(x, y, 'tree')
      else if (chance(0.03)) put(x, y, 'rubble')
    })
  }

  /** Open grass crossed by a broken hedgerow, with a few trees. */
  function field(lot: Rect): void {
    pave(lot, 'grass')
    const y = between(lot.y1, lot.y2)
    for (let x = lot.x1; x <= lot.x2; x++) if (chance(0.5)) put(x, y, 'fence')
    each(lot, (x, y) => void (chance(0.02) && put(x, y, chance(0.6) ? 'tree' : 'rubble')))
  }

  /** Rows of parked cars, each two tiles long, and the odd truck. */
  function carPark(lot: Rect): void {
    for (let y = lot.y1 + 1; y <= lot.y2 - 1; y += 3) {
      for (let x = lot.x1 + 1; x + 1 <= lot.x2 - 1; x += 3) {
        if (chance(0.35)) continue
        const vehicle = chance(kind === 'industrial' ? 0.6 : 0.2) ? 'truck' : 'car'
        put(x, y, vehicle)
        put(x + 1, y, vehicle)
      }
    }
  }

  /** Crates and stacks behind a fence. */
  function depot(lot: Rect): void {
    each(lot, (x, y) => {
      const rim = x === lot.x1 || x === lot.x2 || y === lot.y1 || y === lot.y2
      if (rim) return void (chance(0.45) && put(x, y, 'fence'))
      if (chance(0.16)) put(x, y, chance(0.4) ? 'stack' : 'crate')
    })
  }

  const build: Record<Place, (lot: Rect) => void> = { house, warehouse, ruin, park, orchard, graveyard, plaza, market, carPark, depot, field }

  function fill(lot: Rect): void {
    const roomy = lot.x2 - lot.x1 >= MIN_BUILDING + 1 && lot.y2 - lot.y1 >= MIN_BUILDING + 1
    const places = plot.places.filter((place) => roomy || (place !== 'house' && place !== 'warehouse' && place !== 'ruin'))
    build[places[randomInt(rng, places.length)] ?? 'park'](lot)
  }

  /** Fills a block, first cutting it in two along its length if it is long. */
  function block(r: Rect): void {
    const w = r.x2 - r.x1 + 1
    const h = r.y2 - r.y1 + 1
    if (w < 3 || h < 3) return
    if (Math.max(w, h) < 16) return fill(r)
    if (w >= h) {
      const cut = r.x1 + Math.floor(w / 2)
      fill({ ...r, x2: cut - 1 })
      fill({ ...r, x1: cut + 1 })
    } else {
      const cut = r.y1 + Math.floor(h / 2)
      fill({ ...r, y2: cut - 1 })
      fill({ ...r, y1: cut + 1 })
    }
  }

  /** A satellite compound: a walled yard with gates, a control room, the dish, and stores; scrub outside. */
  function compound(): void {
    const yard: Rect = { x1: 7, y1: 6, x2: size - 9, y2: size - 10 }
    building(yard, 6, ['crate', 'crate', 'stack'])
    pave(yard, 'pavement')
    // More gates than a house has doors, one on each side.
    const midX = Math.floor((yard.x1 + yard.x2) / 2)
    const midY = Math.floor((yard.y1 + yard.y2) / 2)
    open(north, yard.y1 * size + midX)
    open(north, (yard.y2 + 1) * size + midX)
    open(west, midY * size + yard.x1)
    open(west, midY * size + yard.x2 + 1)
    building({ x1: yard.x1 + 2, y1: yard.y1 + 2, x2: yard.x1 + 6, y2: yard.y1 + 5 }, 3, ['crate'])
    for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1], [2, 0], [2, 1]]) put(yard.x2 - 5 + dx, yard.y2 - 4 + dy, 'stack')
    put(yard.x2 - 2, yard.y1 + 2, 'truck')
    put(yard.x2 - 1, yard.y1 + 2, 'truck')
    pave({ x1: midX, y1: yard.y2 + 1, x2: midX + 1, y2: size - 1 }, 'road')
    each({ x1: 0, y1: 0, x2: size - 1, y2: size - 1 }, (x, y) => {
      const inside = x >= yard.x1 && x <= yard.x2 && y >= yard.y1 && y <= yard.y2
      if (inside || ground[y * size + x] === 'road') return
      ground[y * size + x] = 'grass'
      if (chance(0.05)) put(x, y, chance(0.6) ? 'tree' : 'rubble')
    })
  }

  /** The alien hive: clusters of spires and growths on ground nothing human made. */
  function hive(): void {
    ground.fill('hive')
    const clusters = Array.from({ length: 14 }, () => ({ x: between(0, size - 1), y: between(0, size - 1), reach: between(2, 4) }))
    each({ x1: 0, y1: 0, x2: size - 1, y2: size - 1 }, (x, y) => {
      const dense = clusters.some((c) => Math.max(Math.abs(c.x - x), Math.abs(c.y - y)) <= c.reach)
      if (chance(dense ? 0.33 : 0.03)) put(x, y, chance(0.45) ? 'spire' : 'growth')
    })
  }

  /**
   * Rolling hills: each a mound, its crest a level higher. Water lies on the flat, and a building stands level,
   * on the height of its highest floor tile.
   */
  function hills(): number[] {
    const height = Array<number>(size * size).fill(0)
    for (let i = HILLS[kind]; i > 0; i--) {
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

  /** Where `count` roads cross the map, spread evenly with some drift. */
  const roadsAt = (count: number) => Array.from({ length: count }, (_, i) => Math.round(((i + 1) * size) / (count + 1)) - 1 + between(-3, 3))
  /** The stretches the roads leave between them, each one tile back from a road. */
  const stretches = (roads: number[]) => {
    const starts = [0, ...roads.map((road) => road + ROAD + 1)]
    const ends = [...roads.map((road) => road - 2), size - 1]
    return starts.map((start, i) => [start, ends[i]])
  }

  const [roadsX, roadsY] = plot.roads.map(roadsAt)
  for (const x of roadsX) pave({ x1: x, y1: 0, x2: x + ROAD - 1, y2: size - 1 }, 'road')
  for (const y of roadsY) pave({ x1: 0, y1: y, x2: size - 1, y2: y + ROAD - 1 }, 'road')
  // Vehicles on the roads, lying along them.
  for (let i = 2; i < size - 2; i += 2) {
    for (const x of roadsX) {
      if (!chance(0.2)) continue
      const lane = x + randomInt(rng, ROAD)
      put(lane, i, 'car')
      put(lane, i + 1, 'car')
    }
    for (const y of roadsY) {
      if (!chance(0.2)) continue
      const lane = y + randomInt(rng, ROAD)
      const vehicle = chance(0.25) ? 'truck' : 'car'
      put(i, lane, vehicle)
      put(i + 1, lane, vehicle)
    }
  }
  // In ruins, rubble lies across the roads.
  if (kind === 'ruins') each({ x1: 0, y1: 0, x2: size - 1, y2: size - 1 }, (x, y) => void (ground[y * size + x] === 'road' && chance(0.08) && put(x, y, 'rubble')))
  for (const [x1, x2] of stretches(roadsX)) {
    for (const [y1, y2] of stretches(roadsY)) block({ x1, y1, x2, y2 })
  }

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
      const bridges = [between(3, 9), between(13, 18), between(22, size - 4)].filter(() => chance(0.8))
      if (bridges.length === 0) bridges.push(between(12, 19))
      band(chance(0.5), (i) => path[i], 3, (i) => (bridges.some((b) => i >= b && i < b + ROAD) ? 'road' : 'water'))
    },
    // Water takes one side of the map, along a ragged shore.
    coast: () => {
      const shore = wander().map((at) => Math.min(at, 6))
      const vertical = chance(0.5)
      for (let i = 0; i < size; i++) for (let d = 0; d < shore[i]; d++) clear(vertical ? d : i, vertical ? i : d, 'water')
    },
    // A blast crater: an open bowl of scorched ground in the middle, ringed by rubble, where no one has cover.
    crater: () => {
      const c = { x: between(12, size - 13), y: between(12, size - 13) }
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
        const gaps = [between(2, 8), between(13, 18), between(23, size - 3)]
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

  /** Lays the twist on the finished plot: narrow ground cuts it to a shape, fuel scatters tanks. */
  function finish(): Terrain {
    if (twist === 'narrow') {
      const half = size / 2
      const shapes = [
        // A corridor, a third of the map wide, across it either way.
        (x: number, y: number) => Math.abs((vertical ? x : y) - half) > size / 5,
        // A corner: one quarter gone, and a bit more.
        (x: number, y: number) => (cx ? x < size * 0.45 : x >= size * 0.55) && (cy ? y < size * 0.45 : y >= size * 0.55),
        // An island: everything beyond a circle.
        (x: number, y: number) => Math.hypot(x + 0.5 - half, y + 0.5 - half) > half - 1,
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
    if (twist === 'fuel') for (let i = 0; i < 14; i++) put(between(1, size - 2), between(1, size - 2), 'fuel')
    const height = hills().map((h, t) => (ground[t] === 'void' ? 0 : h))
    return { ground, props, north, west, height }
  }
}
