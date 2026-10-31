// The boxes props, walls and fences are drawn from, and trees in each region's style.
import type { Object3D } from 'three'
import type { Edge, Prop } from '../core/terrain'
import type { FenceStyle, Look } from './looks'
import { blob, shade, type Point3, type Shapes } from './shapes'
import { ACROSS, tall } from './space'

/** A box standing on a tile: how much of the tile it covers, how tall it is on screen, and its top colour. */
export interface Box {
  /** Share of the tile's width it spans along x and along y, 0 to 1. */
  wide: number
  deep: number
  /** Screen pixels from the ground to its underside, and its height above that. */
  base: number
  up: number
  color: number
  /** How solid it looks, 0 to 1; solid when absent. */
  alpha?: number
}

/** The boxes each prop is drawn from, bottom first, before its region's look recolours it. A tree and a car are drawn in the look's own way. */
const PROP_BOXES: Record<Exclude<Prop, 'none' | 'tree' | 'car'>, Box[]> = {
  truck: [{ wide: 1, deep: 0.8, base: 3, up: 26, color: 0x7d8794 }],
  crate: [{ wide: 0.7, deep: 0.7, base: 0, up: 13, color: 0x9a7742 }],
  stack: [
    { wide: 0.85, deep: 0.85, base: 0, up: 16, color: 0x9a7742 },
    { wide: 0.6, deep: 0.6, base: 16, up: 13, color: 0xb08a4f },
  ],
  fence: [{ wide: 1, deep: 0.25, base: 0, up: 12, color: 0x6f7682 }],
  rubble: [
    { wide: 0.9, deep: 0.8, base: 0, up: 8, color: 0x6b6f76 },
    { wide: 0.45, deep: 0.5, base: 8, up: 6, color: 0x7c8087 },
  ],
  spire: [
    { wide: 0.7, deep: 0.7, base: 0, up: 20, color: 0x7a3fa0 },
    { wide: 0.4, deep: 0.4, base: 20, up: 18, color: 0x9a55c4 },
  ],
  growth: [{ wide: 0.8, deep: 0.8, base: 0, up: 9, color: 0x8f4fb5 }],
  water: [{ wide: 1, deep: 1, base: 0, up: 2, color: 0x2f9e96, alpha: 0.85 }],
  void: [],
  fuel: [
    { wide: 0.6, deep: 0.6, base: 0, up: 16, color: 0xc0392b },
    { wide: 0.35, deep: 0.35, base: 16, up: 3, color: 0xf1c40f },
  ],
}

/** How tall a wall is drawn in screen pixels, before its region's look scales it. */
export const EDGE_UP = 28

/** How thick a wall is, as a share of a tile. */
export const WALL_THICK = 0.14

/** The boxes a wall or window on a tile's north edge is drawn from; one on a west edge is the same, turned. */
export const EDGE_BOXES: Record<Exclude<Edge, 'none'>, Box[]> = {
  wall: [{ wide: 1, deep: WALL_THICK, base: 0, up: 28, color: 0xa39a8b }],
  // A sill, glass, and a lintel.
  window: [
    { wide: 1, deep: WALL_THICK, base: 0, up: 10, color: 0xa39a8b },
    { wide: 1, deep: WALL_THICK / 2, base: 10, up: 13, color: 0x7fc4e8, alpha: 0.45 },
    { wide: 1, deep: WALL_THICK, base: 23, up: 5, color: 0xa39a8b },
  ],
}

/** How tall a wall's trim stands, in screen pixels. */
export const CAP_UP = 3

/** A fence of each style: its rails or body, bottom first, before its region's colour. */
const FENCES: Record<FenceStyle, Omit<Box, 'color'>[]> = {
  picket: [{ wide: 1, deep: 0.1, base: 0, up: 12 }],
  hedge: [{ wide: 1, deep: 0.45, base: 0, up: 15 }],
  stone: [{ wide: 1, deep: 0.35, base: 0, up: 10 }],
  rail: [
    { wide: 1, deep: 0.08, base: 4, up: 2 },
    { wide: 1, deep: 0.08, base: 10, up: 2 },
    { wide: 0.1, deep: 0.1, base: 0, up: 13 },
  ],
  bamboo: [{ wide: 1, deep: 0.16, base: 0, up: 17 }],
  iron: [
    { wide: 1, deep: 0.06, base: 0, up: 14, alpha: 0.75 },
    { wide: 1, deep: 0.12, base: 0, up: 2 },
  ],
}

/** A number picked from a tile, steady from one drawing to the next. */
export const pick = (tile: number, of: number) => ((tile * 2654435761) >>> 0) % of

/** The boxes a prop is drawn from in a region's look; `head` is the first tile of a run it lies in, which picks its colour. */
export function propBoxes(prop: Exclude<Prop, 'none' | 'tree'>, look: Look, head: number): Box[] {
  if (prop === 'car') return [
    { wide: 1, deep: 0.7, base: 3, up: 9, color: look.cars[pick(head, look.cars.length)] },
    { wide: 0.7, deep: 0.6, base: 12, up: 6, color: 0x2a3340 },
  ]
  if (prop === 'fence') return FENCES[look.fence].map((box) => ({ ...box, color: look.fenceColor }))
  const crate = look.crates[pick(head, look.crates.length)]
  if (prop === 'crate') return PROP_BOXES.crate.map((box) => ({ ...box, color: crate }))
  if (prop === 'stack') return PROP_BOXES.stack.map((box, i) => ({ ...box, color: shade(crate, 1 + 0.15 * i) }))
  if (prop === 'rubble') return PROP_BOXES.rubble.map((box, i) => ({ ...box, color: shade(look.rock, 0.9 + 0.12 * i) }))
  return PROP_BOXES[prop]
}

/** A tree in its region's style, its trunk among `shapes` and its leaves among `blobs`. */
export function addTree(look: Look, at: Point3, shapes: Shapes, blobs: Object3D[], tile: number): void {
  const { x, z } = at
  const px = (n: number) => n / ACROSS
  const trunk = (r: number, up: number, color = 0x5b4630) => shapes.box(x - px(r), z - px(r), x + px(r), z + px(r), at.y, at.y + tall(up), color)
  const leaf = (dx: number, up: number, r: number, color = look.leaves) => blobs.push(blob({ x: x + px(dx) / Math.SQRT2, y: at.y + tall(up), z: z - px(dx) / Math.SQRT2 }, px(r), color))
  const lighter = shade(look.leaves, 1.25)
  switch (look.tree) {
    case 'pine':
      trunk(2, 8)
      for (const [base, r, up] of [[6, 13, 20], [16, 10, 18], [26, 7, 14]]) shapes.spike(x, z, at.y + tall(base), px(r) / Math.SQRT2, { x, y: at.y + tall(base + up), z }, look.leaves)
      return
    case 'palm': {
      // A slim trunk that leans, crowned by fronds.
      const lean = (pick(tile, 2) * 2 - 1) * 4
      trunk(1.5, 34, 0x8a6a48)
      for (const dx of [-9, -4, 4, 9]) leaf(dx + lean, 34 - Math.abs(dx) * 0.6, 5, dx > 0 ? lighter : look.leaves)
      leaf(lean, 37, 6)
      return
    }
    case 'cypress':
      trunk(2, 6)
      for (const [up, r] of [[12, 7], [20, 7], [28, 6], [35, 4]]) leaf(0, up, r)
      return
    case 'acacia':
      // A flat, spreading crown on a crooked trunk.
      trunk(2, 20, 0x6a4a30)
      shapes.box(x - px(16) / Math.SQRT2, z - px(16) / Math.SQRT2, x + px(16) / Math.SQRT2, z + px(16) / Math.SQRT2, at.y + tall(20), at.y + tall(25), look.leaves)
      return
    case 'blossom':
      trunk(2, 14, 0x4a3428)
      leaf(0, 24, 13)
      leaf(-5, 28, 8, lighter)
      leaf(6, 22, 6, 0xffffff)
      return
    default:
      trunk(2, 16)
      leaf(0, 24, 14)
      leaf(-4, 28, 8, lighter)
  }
}
