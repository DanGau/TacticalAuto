import type { LonLat } from './world'

export interface Point {
  x: number
  y: number
}

const RAD = Math.PI / 180

/**
 * The globe seen straight down on the middle of the way from `a` to `b`, in degrees: `a` to the left, `b` to the right,
 * as the flight view shows a leg turned on its side.
 */
export function plane(a: LonLat, b: LonLat): (at: LonLat) => Point {
  const v = ([lon, lat]: LonLat) => [Math.cos(lat * RAD) * Math.cos(lon * RAD), Math.cos(lat * RAD) * Math.sin(lon * RAD), Math.sin(lat * RAD)]
  const [p, q] = [v(a), v(b)]
  const norm = (w: number[]) => w.map((x) => x / (Math.hypot(...w) || 1e-9))
  const mid = norm([p[0] + q[0], p[1] + q[1], p[2] + q[2]])
  const dot = (w: number[], z: number[]) => w[0] * z[0] + w[1] * z[1] + w[2] * z[2]
  // Across: the way from a to b, flattened onto the view; up: square to it.
  const across = norm(q.map((x, i) => x - p[i] - dot([q[0] - p[0], q[1] - p[1], q[2] - p[2]], mid) * mid[i]))
  const up = [mid[1] * across[2] - mid[2] * across[1], mid[2] * across[0] - mid[0] * across[2], mid[0] * across[1] - mid[1] * across[0]]
  return (at) => {
    const w = v(at)
    return { x: dot(w, across) / RAD, y: dot(w, up) / RAD }
  }
}

const cross = (o: Point, a: Point, b: Point) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x)

/** Whether the segments a–b and c–d cross. */
export function crosses(a: Point, b: Point, c: Point, d: Point): boolean {
  const [d1, d2, d3, d4] = [cross(c, d, a), cross(c, d, b), cross(a, b, c), cross(a, b, d)]
  return d1 * d2 < 0 && d3 * d4 < 0
}

/** How far `p` lies from the segment a–b. */
export function distance(p: Point, a: Point, b: Point): number {
  const [dx, dy] = [b.x - a.x, b.y - a.y]
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)))
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy)
}

/**
 * What makes a picture of stops and the lines between them hard to read: two lines crossing, a stop nearer than `clear`
 * to a line not its own, or two stops nearer than `room`. Lines sharing a stop do not count as crossing.
 */
export function tangles(stops: Point[], lines: [number, number][], clear: number, room: number): string[] {
  const found: string[] = []
  for (const [i, [a, b]] of lines.entries()) {
    for (const [c, d] of lines.slice(i + 1)) if (a !== c && a !== d && b !== c && b !== d && crosses(stops[a], stops[b], stops[c], stops[d])) found.push(`line ${a}-${b} crosses ${c}-${d}`)
    for (const [k, p] of stops.entries()) if (k !== a && k !== b && distance(p, stops[a], stops[b]) < clear) found.push(`stop ${k} on line ${a}-${b}`)
  }
  for (const [i, p] of stops.entries()) for (const [k, q] of stops.slice(i + 1).entries()) if (Math.hypot(p.x - q.x, p.y - q.y) < room) found.push(`stops ${i} and ${i + 1 + k} too near`)
  return found
}
