import { random, randomInt } from './rng'

/** What the ground of a tile is. It changes only how the tile looks. */
export type Ground = 'pavement' | 'road' | 'grass' | 'floor'

/** The object on a tile. A window is a gap in a wall: it blocks movement but soldiers shoot through it. */
export type Prop = 'none' | 'wall' | 'window' | 'car' | 'truck' | 'tree' | 'crate' | 'stack' | 'fence' | 'rubble'

/** What stands on a tile, as cover: 0 nothing, 1 low cover, 2 high cover. Cover blocks movement; high cover blocks shots. */
export type Cover = 0 | 1 | 2

export const PROP_COVER: Record<Prop, Cover> = { none: 0, wall: 2, window: 1, car: 1, truck: 2, tree: 2, crate: 1, stack: 2, fence: 1, rubble: 1 }

/** A battlefield's ground and objects, one entry per tile, row by row. */
export interface Terrain {
  ground: Ground[]
  props: Prop[]
}

/** A rectangle of tiles, edges included. */
interface Rect {
  x1: number
  y1: number
  x2: number
  y2: number
}

/** Width of a road, and of the pavement kept clear beside it. */
const ROAD = 2
/** A building is at least this many tiles on a side, walls included. */
const MIN_HOUSE = 5
const MAX_HOUSE = 9

/**
 * A town block, in the manner of XCOM 2's plots and parcels: two crossing roads cut the map into lots, and each lot
 * is filled with one kind of place. Cars stand on the roads.
 */
export function generateTerrain(rng: { rng: number }, size: number): Terrain {
  const ground = Array<Ground>(size * size).fill('pavement')
  const props = Array<Prop>(size * size).fill('none')
  const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < size && y < size
  const chance = (p: number) => random(rng) < p
  const between = (low: number, high: number) => low + randomInt(rng, high - low + 1)
  /** Puts a prop on a free tile. */
  const put = (x: number, y: number, prop: Prop) => {
    if (inside(x, y) && props[y * size + x] === 'none') props[y * size + x] = prop
  }
  const pave = (r: Rect, kind: Ground) => {
    for (let y = r.y1; y <= r.y2; y++) for (let x = r.x1; x <= r.x2; x++) ground[y * size + x] = kind
  }
  const each = (r: Rect, visit: (x: number, y: number) => void) => {
    for (let y = r.y1; y <= r.y2; y++) for (let x = r.x1; x <= r.x2; x++) visit(x, y)
  }

  /** A building: walls with windows and two doors, a floor, some furniture, and an inner wall if it is long. */
  function house(lot: Rect): void {
    const w = Math.min(MAX_HOUSE, lot.x2 - lot.x1 - 1)
    const h = Math.min(MAX_HOUSE, lot.y2 - lot.y1 - 1)
    const x1 = between(lot.x1 + 1, lot.x2 - w)
    const y1 = between(lot.y1 + 1, lot.y2 - h)
    const b: Rect = { x1, y1, x2: x1 + w - 1, y2: y1 + h - 1 }
    pave(b, 'floor')
    // Each side's tiles between the corners, where a door or window can go.
    const sides = [
      Array.from({ length: w - 2 }, (_, i) => ({ x: b.x1 + 1 + i, y: b.y1 })),
      Array.from({ length: h - 2 }, (_, i) => ({ x: b.x2, y: b.y1 + 1 + i })),
      Array.from({ length: w - 2 }, (_, i) => ({ x: b.x1 + 1 + i, y: b.y2 })),
      Array.from({ length: h - 2 }, (_, i) => ({ x: b.x1, y: b.y1 + 1 + i })),
    ]
    const first = randomInt(rng, 4)
    const doors = [first, (first + between(1, 3)) % 4].map((side) => sides[side][randomInt(rng, sides[side].length)])
    const isDoor = (x: number, y: number) => doors.some((door) => door.x === x && door.y === y)
    each(b, (x, y) => {
      const edge = x === b.x1 || x === b.x2 || y === b.y1 || y === b.y2
      if (!edge || isDoor(x, y)) return
      const corner = (x === b.x1 || x === b.x2) && (y === b.y1 || y === b.y2)
      put(x, y, !corner && (x + y) % 3 === 0 ? 'window' : 'wall')
    })
    // An inner wall across the longer side, with a doorway.
    if (Math.max(w, h) >= 7) {
      const alongX = w >= h
      const at = alongX ? between(b.x1 + 3, b.x2 - 3) : between(b.y1 + 3, b.y2 - 3)
      const gap = alongX ? between(b.y1 + 1, b.y2 - 1) : between(b.x1 + 1, b.x2 - 1)
      each(b, (x, y) => {
        const onWall = alongX ? x === at : y === at
        const inGap = alongX ? y === gap : x === gap
        if (onWall && !inGap && !isDoor(x, y)) put(x, y, 'wall')
      })
    }
    for (let i = between(2, 4); i > 0; i--) put(between(b.x1 + 1, b.x2 - 1), between(b.y1 + 1, b.y2 - 1), 'crate')
    // The yard around it.
    each(lot, (x, y) => {
      if (x >= b.x1 && x <= b.x2 && y >= b.y1 && y <= b.y2) return
      ground[y * size + x] = 'grass'
      if (chance(0.06)) put(x, y, chance(0.5) ? 'tree' : 'fence')
    })
  }

  /** Trees, thick enough to hide in. */
  function park(lot: Rect): void {
    pave(lot, 'grass')
    each(lot, (x, y) => {
      if (chance(0.14)) put(x, y, 'tree')
      else if (chance(0.03)) put(x, y, 'rubble')
    })
  }

  /** Rows of parked cars, each two tiles long, and the odd truck. */
  function carPark(lot: Rect): void {
    for (let y = lot.y1 + 1; y <= lot.y2 - 1; y += 3) {
      for (let x = lot.x1 + 1; x + 1 <= lot.x2 - 1; x += 3) {
        if (chance(0.35)) continue
        const vehicle = chance(0.2) ? 'truck' : 'car'
        put(x, y, vehicle)
        put(x + 1, y, vehicle)
      }
    }
  }

  /** Crates and stacks behind a fence. */
  function depot(lot: Rect): void {
    each(lot, (x, y) => {
      const edge = x === lot.x1 || x === lot.x2 || y === lot.y1 || y === lot.y2
      if (edge) return void (chance(0.45) && put(x, y, 'fence'))
      if (chance(0.16)) put(x, y, chance(0.4) ? 'stack' : 'crate')
    })
  }

  function fill(lot: Rect): void {
    const roomy = lot.x2 - lot.x1 + 1 >= MIN_HOUSE + 2 && lot.y2 - lot.y1 + 1 >= MIN_HOUSE + 2
    const places = [...(roomy ? [house, house] : []), park, carPark, depot]
    places[randomInt(rng, places.length)](lot)
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

  const roadX = between(8, size - 8 - ROAD)
  const roadY = between(8, size - 8 - ROAD)
  pave({ x1: roadX, y1: 0, x2: roadX + ROAD - 1, y2: size - 1 }, 'road')
  pave({ x1: 0, y1: roadY, x2: size - 1, y2: roadY + ROAD - 1 }, 'road')
  // Cars and wrecks on the roads, lying along them.
  for (let i = 2; i < size - 2; i += 2) {
    if (chance(0.22)) {
      const lane = roadX + randomInt(rng, ROAD)
      put(lane, i, 'car')
      put(lane, i + 1, 'car')
    }
    if (chance(0.22)) {
      const lane = roadY + randomInt(rng, ROAD)
      const vehicle = chance(0.25) ? 'truck' : 'car'
      put(i, lane, vehicle)
      put(i + 1, lane, vehicle)
    }
  }
  // The four blocks the roads leave, each one tile of pavement back from the road.
  const xs = [
    [0, roadX - ROAD],
    [roadX + ROAD + 1, size - 1],
  ]
  const ys = [
    [0, roadY - ROAD],
    [roadY + ROAD + 1, size - 1],
  ]
  for (const [x1, x2] of xs) for (const [y1, y2] of ys) block({ x1, y1, x2, y2 })
  return { ground, props }
}
