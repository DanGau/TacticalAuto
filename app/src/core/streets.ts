import { random, randomInt } from './rng'

/** What a tile of a street plan is: land to build on, a street, a canal, an open square, or a highway's median. */
export type Way = 'land' | 'street' | 'canal' | 'square' | 'median'

/**
 * How a region's streets are laid out, after real cities:
 * - `grid`: a regular grid, as Chicago's; long blocks with a diagonal avenue, as Manhattan's, when stretched.
 * - `freeway`: a wide highway with a median and arterials off it over big superblocks, as Houston's.
 * - `cul-de-sacs`: a winding collector road and dead-end closes off it, as an American or Australian suburb's.
 * - `winding`: lanes wandering out from a square and meeting again, as Lisbon's or Siena's old town.
 * - `alleys`: a spine through the town with alleys branching off it to dead ends, as a medina's.
 * - `star`: boulevards radiating from a star junction, a ring road, side streets between, as Paris's.
 * - `rings`: canals in concentric rings, crossed by streets running out, as Amsterdam's.
 * - `chamfered`: a grid whose crossings are cut into octagonal squares, as Barcelona's Eixample.
 * - `superblocks`: wide avenues round huge blocks of open ground, as a Soviet housing estate's.
 * - `lanes`: an arterial grid with a maze of narrow lanes inside each block, as Tokyo's.
 * - `hutongs`: long lanes running east to west between arterials, as Beijing's.
 * - `plots`: a tight grid of small, even plots, as a township's.
 */
export type StreetPlan = 'grid' | 'freeway' | 'cul-de-sacs' | 'winding' | 'alleys' | 'star' | 'rings' | 'chamfered' | 'superblocks' | 'lanes' | 'hutongs' | 'plots'

/** How a street plan is drawn: its streets' width and their spacing, and how much longer blocks run down y than across x. */
export interface Streets {
  plan: StreetPlan
  width: number
  spacing: [number, number]
  stretch: number
}

/** The street plan of a `size` by `size` map, one Way per tile, row by row. */
export function layStreets(rng: { rng: number }, size: number, streets: Streets): Way[] {
  const ways = Array<Way>(size * size).fill('land')
  const between = (low: number, high: number) => low + randomInt(rng, high - low + 1)
  const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < size && y < size
  const { width, spacing, stretch } = streets
  /** Paints a square `w` tiles wide at x, y, over land only unless `over`. */
  const dab = (x: number, y: number, w: number, way: Way, over = false) => {
    const from = -Math.floor((w - 1) / 2)
    for (let dy = from; dy < from + w; dy++)
      for (let dx = from; dx < from + w; dx++) {
        const tx = Math.round(x) + dx
        const ty = Math.round(y) + dy
        if (!inside(tx, ty)) continue
        if (over || ways[ty * size + tx] === 'land' || way === 'canal') ways[ty * size + tx] = way
      }
  }
  /** A straight street from a to b. */
  const line = (ax: number, ay: number, bx: number, by: number, w: number, way: Way = 'street') => {
    const steps = Math.ceil(Math.hypot(bx - ax, by - ay) * 2)
    for (let i = 0; i <= steps; i++) dab(ax + ((bx - ax) * i) / steps, ay + ((by - ay) * i) / steps, w, way)
  }
  /** A ring `r` out from cx, cy: a circle, or with `square` a square with its corners rounded off. */
  const ring = (cx: number, cy: number, r: number, w: number, way: Way = 'street', square = false) => {
    const steps = Math.ceil(r * 8)
    for (let i = 0; i < steps; i++) {
      const a = (i / steps) * Math.PI * 2
      const scale = square ? r / Math.max(Math.abs(Math.cos(a)), Math.abs(Math.sin(a))) ** 0.85 : r
      dab(cx + Math.cos(a) * scale, cy + Math.sin(a) * scale, w, way)
    }
  }
  const square = (cx: number, cy: number, r: number) => {
    for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (inside(cx + x, cy + y)) ways[(cy + y) * size + cx + x] = 'square'
  }
  /**
   * A street that wanders from x, y heading `angle`, turning a corner with chance `turn` each tile and jogging a tile
   * aside with chance `jog`, until it leaves the map, runs `length` tiles, or, once `meets`, reaches another street. It
   * branches with chance `branch`. It keeps to the grid's two ways, so the blocks it leaves have square corners to
   * build in, however crooked their outline.
   */
  const wander = (x: number, y: number, angle: number, w: number, length: number, meets: boolean, turn: number, jog: number, branch: number, depth = 0): void => {
    let dir = Math.round(angle / (Math.PI / 2)) & 3
    const step = [[1, 0], [0, 1], [-1, 0], [0, -1]]
    x = Math.round(x)
    y = Math.round(y)
    for (let i = 0; i < length; i++) {
      if (random(rng) < turn) dir = (dir + (random(rng) < 0.5 ? 1 : 3)) & 3
      // A jog: the street shifts a tile aside and runs on.
      else if (random(rng) < jog) {
        const side = (dir + (random(rng) < 0.5 ? 1 : 3)) & 3
        x += step[side][0]
        y += step[side][1]
        dab(x, y, w, 'street')
      }
      x += step[dir][0]
      y += step[dir][1]
      if (!inside(x, y)) return
      if (meets && i > 3 && ways[y * size + x] !== 'land') return
      dab(x, y, w, 'street')
      if (depth < 2 && random(rng) < branch) wander(x, y, ((dir + (random(rng) < 0.5 ? 1 : 3)) & 3) * (Math.PI / 2), Math.max(1, w - 1), between(5, 14), meets, turn, jog, branch * 0.6, depth + 1)
    }
  }
  /** A grid of streets `w` wide, spaced `sx` across and `sy` down; returns where its streets run. */
  const grid = (sx: [number, number], sy: [number, number], w: number) => {
    const xs: number[] = []
    const ys: number[] = []
    for (let x = between(1, sx[0]); x < size; x += between(...sx) + w) xs.push(x)
    for (let y = between(1, sy[0]); y < size; y += between(...sy) + w) ys.push(y)
    for (const x of xs) line(x, 0, x, size - 1, w)
    for (const y of ys) line(0, y, size - 1, y, w)
    return { xs, ys }
  }
  const tall = (s: [number, number]): [number, number] => [Math.round(s[0] * stretch), Math.round(s[1] * stretch)]
  const mid = size / 2

  switch (streets.plan) {
    case 'grid':
      grid(spacing, tall(spacing), width)
      // A long grid has its Broadway, cutting across.
      if (stretch > 1.5) line(between(0, size / 3), 0, between((2 * size) / 3, size), size - 1, width)
      break
    case 'freeway': {
      // Six lanes split by a median, an arterial across it, and wide streets round big blocks.
      const at = between(size / 3, (2 * size) / 3)
      line(0, at, size - 1, at, 7)
      for (let x = 0; x < size; x++) ways[at * size + x] = 'median'
      grid(spacing, tall(spacing), width)
      break
    }
    case 'cul-de-sacs': {
      // A collector road winding across, and closes off it every few lots, each ending in a turning circle.
      const amp = between(4, 8)
      const wave = between(24, 40)
      const base = between(size / 3, (2 * size) / 3)
      const road = (x: number) => base + amp * Math.sin((x / wave) * Math.PI * 2)
      for (let x = 0; x < size; x++) dab(x, road(x), width, 'street', true)
      for (let x = between(3, 8); x < size - 3; x += between(...spacing)) {
        const dir = random(rng) < 0.5 ? -1 : 1
        const reach = between(7, 13)
        const lean = (random(rng) - 0.5) * 0.6
        const ex = x + lean * reach
        const ey = road(x) + dir * reach
        line(x, road(x), ex, ey, 1)
        ring(ex, ey, 1.2, 2)
        // The far side of the road has its own close.
        if (random(rng) < 0.7) {
          const fx = x + between(3, 5)
          line(fx, road(fx), fx - lean * reach, road(fx) - dir * between(7, 13), 1)
        }
      }
      break
    }
    case 'winding': {
      // Lanes run out from the old square in every direction, bending, and meet again.
      const cx = Math.round(mid + between(-6, 6))
      const cy = Math.round(mid + between(-6, 6))
      square(cx, cy, between(2, 3))
      const arms = between(5, 7)
      for (let i = 0; i < arms; i++) wander(cx, cy, (i / arms) * Math.PI * 2 + random(rng) * 0.5, i < 2 ? 2 : width, size * 2, false, 0.02, 0.1, 0.07)
      // More lanes the closer the town packs them.
      for (let i = Math.round((size * 3) / spacing[0]); i > 0; i--) wander(between(0, size - 1), between(0, size - 1), random(rng) * Math.PI * 2, width, size, true, 0.04, 0.1, 0.05)
      break
    }
    case 'alleys': {
      // A spine from gate to gate, alleys off it that end blind, and alleys off those.
      const y0 = between(size / 4, (3 * size) / 4)
      wander(-1, y0, 0, 2, size * 2, false, 0, 0.12, 0)
      for (let x = 2; x < size; x += between(3, 6)) {
        const y = ways.findIndex((w, t) => t % size === x && w === 'street')
        if (y < 0) continue
        wander(x, Math.floor(y / size), (random(rng) < 0.5 ? -1 : 1) * Math.PI / 2, 1, between(8, 18), false, 0.08, 0.12, 0.35)
      }
      break
    }
    case 'star': {
      // One or two stars of boulevards, a ring road round the first, and narrow streets between.
      grid([14, 18], [14, 18], 1)
      const stars = Array.from({ length: between(1, 2) }, (_, i) => ({ x: Math.round(mid + (i ? 1 : -1) * between(4, 12)), y: Math.round(mid + between(-8, 8)) }))
      for (const s of stars) {
        const rays = between(6, 8)
        const turn = random(rng)
        for (let i = 0; i < rays; i++) {
          const a = ((i + turn) / rays) * Math.PI * 2
          line(s.x, s.y, s.x + Math.cos(a) * size * 1.5, s.y + Math.sin(a) * size * 1.5, width)
        }
        square(s.x, s.y, 2)
      }
      ring(stars[0].x, stars[0].y, between(10, 15), 2)
      break
    }
    case 'rings': {
      // Canals curving round a centre off the map, each with a street beside it, crossed by streets running out.
      const cx = random(rng) < 0.5 ? -between(4, 10) : size + between(4, 10)
      const cy = random(rng) < 0.5 ? -between(4, 10) : size + between(4, 10)
      for (let r = between(10, 16); r < size * 1.6; r += between(...spacing)) {
        ring(cx, cy, r, 2, 'canal', true)
        ring(cx, cy, r - 2, 1, 'street', true)
      }
      // Streets run straight out across the rings, bridging each canal.
      for (let x = between(2, 6); x < size; x += between(8, 12)) line(x, 0, x, size - 1, 1)
      for (let y = between(2, 6); y < size; y += between(8, 12)) line(0, y, size - 1, y, 1)
      break
    }
    case 'chamfered': {
      const { xs, ys } = grid(spacing, spacing, width)
      // Each crossing opened out into a small octagon: its corners cut off the blocks round it.
      for (const x of xs)
        for (const y of ys)
          for (let d = -2; d <= 2; d++) {
            const reach = 2 - Math.abs(d) + width
            for (let e = -reach; e <= reach; e++) dab(x + d + (width - 1) / 2, y + e + (width - 1) / 2, 1, 'street')
          }
      break
    }
    case 'superblocks':
      grid(spacing, spacing, width)
      // Footpaths wander across the open ground inside.
      for (let i = 0; i < 6; i++) wander(between(0, size - 1), between(0, size - 1), random(rng) * Math.PI * 2, 1, between(8, 16), true, 0.05, 0.05, 0)
      break
    case 'lanes':
      grid(spacing, spacing, width)
      // Inside each block, a maze of lanes one tile wide.
      for (let i = 0; i < size * 1.2; i++) wander(between(0, size - 1), between(0, size - 1), randomInt(rng, 4) * (Math.PI / 2), 1, between(4, 10), true, 0.05, 0.05, 0.1)
      break
    case 'hutongs':
      grid(spacing, spacing, width)
      // Lanes run east to west every few tiles; a few short ones north to south join them.
      for (let y = between(2, 4); y < size; y += between(5, 7)) line(0, y, size - 1, y, 1)
      for (let i = 0; i < size / 3; i++) {
        const x = between(0, size - 1)
        const y = between(0, size - 8)
        line(x, y, x, y + between(4, 8), 1)
      }
      break
    case 'plots':
      grid(spacing, spacing, width)
      for (let x = between(2, 6); x < size; x += between(16, 22)) line(x, 0, x, size - 1, width + 1)
      break
  }
  return ways
}
