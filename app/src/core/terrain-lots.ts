// The plot a battlefield is laid on, and the places that fill its lots.
import type { Region } from './regions'
import { random, randomInt } from './rng'
import type { Edge, Ground, Prop, TerrainKind, ZONE_TERRAINS } from './terrain'

/** A rectangle of tiles, edges included. */
export interface Rect {
  x1: number
  y1: number
  x2: number
  y2: number
}

export type Place = 'house' | 'warehouse' | 'ruin' | 'park' | 'orchard' | 'graveyard' | 'plaza' | 'market' | 'carPark' | 'depot' | 'field'

/** The overall shape a plot is laid over, which decides where the fighting funnels: see `layouts` in terrain-gen.ts. */
export type Layout = 'grid' | 'river' | 'coast' | 'crater' | 'lanes'

/** Each kind of zone place as a plot: how many roads cross it each way, what its lots may hold, and the shapes it may take, likelier if listed more. */
export const PLOTS: Record<(typeof ZONE_TERRAINS)[number], { roads: [number, number]; places: Place[]; layouts: Layout[] }> = {
  town: { roads: [1, 1], places: ['house', 'house', 'park', 'carPark', 'plaza', 'market'], layouts: ['grid', 'grid', 'river', 'crater', 'lanes'] },
  city: { roads: [2, 2], places: ['house', 'house', 'house', 'carPark', 'plaza'], layouts: ['grid', 'lanes', 'lanes', 'river'] },
  countryside: { roads: [1, 0], places: ['field', 'field', 'orchard', 'graveyard', 'park', 'house'], layouts: ['grid', 'river', 'river', 'coast', 'crater'] },
  industrial: { roads: [1, 1], places: ['warehouse', 'depot', 'depot', 'carPark'], layouts: ['grid', 'lanes', 'coast', 'river'] },
  ruins: { roads: [1, 1], places: ['ruin', 'ruin', 'ruin', 'graveyard', 'park'], layouts: ['crater', 'crater', 'grid', 'river'] },
}

/** A battlefield of `kind`, `size` tiles on a side, being laid in region `R`: its tiles row by row, the tools that lay them, and the places that fill a lot. */
export function createPlot(rng: { rng: number }, size: number, kind: TerrainKind, R: Region) {
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
    const places = PLOTS[kind as (typeof ZONE_TERRAINS)[number]].places.filter((place) => place !== 'house' && place !== 'warehouse' && place !== 'ruin')
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

  return { ground, props, north, west, doorways, inside, chance, between, put, each, scaled, fill, compound, hive }
}
