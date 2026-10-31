import { REGIONS, regionsFor, type Region, type RegionId } from './regions'
import { layStreets, type Way } from './streets'
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
  /** The part of the world it stands in, and the place there it is named for. */
  region: RegionId
  city: string
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

/** Where in the world a battlefield lies: how its region builds, and the place it is named for. */
export interface Locale {
  region: RegionId
  city: string
}

/** A rectangle of tiles, edges included. */
export interface Rect {
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

/**
 * A battlefield of the given kind, in the manner of XCOM 2's plots and parcels: roads cut the map into lots,
 * and each lot is filled with one place. Vehicles stand on the roads.
 */
export function generateTerrain(rng: { rng: number }, size: number, kind: TerrainKind, twist: Twist | null = null, place?: Locale): Terrain {
  const options = regionsFor(kind)
  const region = place?.region ?? options[randomInt(rng, options.length)]
  const R: Region = REGIONS[region]
  const city = place?.city ?? R.cities[randomInt(rng, R.cities.length)]
  /** Width of a bridge over a river. */
  const ROAD = 2
  /** Scales a length given for a 50-tile plot to this one. */
  const scaled = (tiles: number) => Math.round((tiles * size) / 50)
  const [MIN_BUILDING, MAX_HOUSE] = R.building
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

  /**
   * A house in a yard of grass, with the odd tree and fence, kept back from its lot's edge by the region's setback.
   * Where the region builds them, it wraps a courtyard, or stands as a long slab of flats.
   */
  function house(lot: Rect): void {
    const b = footprint(lot)
    building(b, R.windowEvery, ['crate', 'none', 'none'])
    const w = b.x2 - b.x1 + 1
    const h = b.y2 - b.y1 + 1
    if (R.courtyards && w >= 7 && h >= 7) {
      const yard: Rect = { x1: b.x1 + 2, y1: b.y1 + 2, x2: b.x2 - 2, y2: b.y2 - 2 }
      building(yard, 99, ['tree'])
      pave(yard, 'grass')
      each(yard, (x, y) => (props[y * size + x] = chance(0.2 * R.green) ? 'tree' : 'none'))
    }
    each(lot, (x, y) => {
      if (x >= b.x1 && x <= b.x2 && y >= b.y1 && y <= b.y2) return
      ground[y * size + x] = 'grass'
      if (chance(0.06 * R.green)) put(x, y, chance(0.5) ? 'tree' : 'fence')
    })
  }

  /** Where a building stands on a lot: kept back from its edge by the region's setback, a slab where the region builds them. */
  function footprint(lot: Rect): Rect {
    const back = Math.max(0, Math.min(R.setback, Math.floor((Math.min(lot.x2 - lot.x1, lot.y2 - lot.y1) - MIN_BUILDING) / 2)))
    const roomX = lot.x2 - lot.x1 + 1 - 2 * back
    const roomY = lot.y2 - lot.y1 + 1 - 2 * back
    // A packed region builds wall to wall, filling its lot; others leave a yard.
    const span = (room: number) => (R.setback === 0 ? Math.min(MAX_HOUSE, room) : between(MIN_BUILDING, Math.max(MIN_BUILDING, Math.min(MAX_HOUSE, room))))
    let w = span(roomX)
    let h = span(roomY)
    // A slab: four deep, as long as the lot allows.
    if (R.slabs) [w, h] = roomX >= roomY ? [Math.min(MAX_HOUSE, roomX), MIN_BUILDING] : [MIN_BUILDING, Math.min(MAX_HOUSE, roomY)]
    w = Math.min(w, roomX)
    h = Math.min(h, roomY)
    const x1 = between(lot.x1 + back, lot.x2 - back - w + 1)
    const y1 = between(lot.y1 + back, lot.y2 - back - h + 1)
    return { x1, y1, x2: x1 + w - 1, y2: y1 + h - 1 }
  }

  /** A building fallen in: about half its walls gone, rubble where they stood. */
  function ruin(lot: Rect): void {
    const { x1, y1, x2, y2 } = footprint(lot)
    const w = x2 - x1 + 1
    const h = y2 - y1 + 1
    building({ x1, y1, x2, y2 }, 4, ['rubble'])
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
      if (chance(0.14 * R.green)) put(x, y, 'tree')
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

  /**
   * Fills a lot with one place: as often as the region builds, a building of the kind of place, a house, a warehouse
   * or a fenced depot, or a ruin, else an open place of the kind's. The countryside builds seldom.
   */
  function fill(lot: Rect): void {
    // A packed region builds on any lot it can fit a room on.
    const least = R.setback === 0 ? 2 : MIN_BUILDING
    const roomy = lot.x2 - lot.x1 + 1 >= least && lot.y2 - lot.y1 + 1 >= least
    const builds = roomy && chance(R.built * (kind === 'countryside' ? 0.3 : 1))
    // A warehouse needs room for its walls inside the lot.
    const shed = lot.x2 - lot.x1 >= 4 && lot.y2 - lot.y1 >= 4 && chance(0.5)
    if (builds) return build[kind === 'industrial' ? (shed ? 'warehouse' : 'depot') : kind === 'ruins' ? 'ruin' : 'house'](lot)
    // A scrap of land too small for a place of its own is a yard, a tree or two in it.
    if (lot.x2 - lot.x1 < 2 || lot.y2 - lot.y1 < 2) return each(lot, (x, y) => void (chance(0.15 * R.green) && put(x, y, 'tree')))
    const places = plot.places.filter((place) => place !== 'house' && place !== 'warehouse' && place !== 'ruin')
    build[places[randomInt(rng, places.length)] ?? 'park'](lot)
  }

  /** A satellite compound: a walled yard with gates, a control room, the dish, and stores; scrub outside. */
  function compound(): void {
    const mid = Math.floor(size / 2)
    const yard: Rect = { x1: mid - 9, y1: mid - 10, x2: mid + 7, y2: mid + 6 }
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
    const clusters = Array.from({ length: scaled(scaled(14)) }, () => ({ x: between(0, size - 1), y: between(0, size - 1), reach: between(2, 4) }))
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
