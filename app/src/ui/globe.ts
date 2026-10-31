import { plane } from '../core/plane'
import { along, arc, type LonLat } from '../core/world'
import type { Run } from '../core/run'
import { geoCentroid, geoContains, geoDistance, geoOrthographic, geoPath, type GeoPermissibleObjects } from 'd3-geo'
import { feature } from 'topojson-client'
import type { Topology } from 'topojson-specification'
import land110 from 'world-atlas/land-110m.json'
import land50 from 'world-atlas/land-50m.json'

/** The globe's radius at its farthest and nearest, in pixels. */
const FAR = 120
const NEAR = 12000
/** Pixels kept clear round the stops in sight. */
const MARGIN = 60
/** The fewest degrees the view spans from its middle. */
const MIN_REACH = 3
const RAD = Math.PI / 180

/** The window the globe is seen through, in pixels, and how much of its top and bottom the page covers. */
interface Size {
  w: number
  h: number
  top?: number
  bottom?: number
}

/** Where the middle of the window's open part lies, and how far it reaches up and down. */
const open = ({ h, top = 0, bottom = 0 }: Size) => ({ middle: top + (h - top - bottom) / 2, half: (h - top - bottom) / 2 })

/**
 * A stop shown on the globe: its id, where it stands, its markup, the stops it leads to, whether the squad stands on it,
 * whether it is one of the choices before the player, and whether the trail to it is lit, as the way on from the stop
 * the player picked.
 */
export interface Pin {
  id: string
  at: LonLat
  html: string
  next: string[]
  squad: boolean
  choice: boolean
  lit: boolean
  /** Whether the squad has passed it; the view need not keep it in frame. */
  past: boolean
  /** How far along the run its column is, and its place across the column, in order. */
  layer: number
  order: number
}

/**
 * Which way the globe is turned, and how near: the place in the window's middle, the globe's radius in pixels, and how
 * far the picture is spun about its middle, in radians, so the way ahead points up.
 */
export interface View {
  centre: LonLat
  r: number
  turn: number
}

/** The world's land at two levels of detail: coarse for the whole globe, fine once the view closes in. */
const COARSE = feature(land110 as unknown as Topology, (land110 as unknown as Topology).objects.land) as unknown as GeoPermissibleObjects
const FINE = feature(land50 as unknown as Topology, (land50 as unknown as Topology).objects.land) as unknown as GeoPermissibleObjects
/** The fine land as separate shapes, each with its middle and how far it reaches from there, to draw only those in view. */
const PARTS = (FINE as unknown as { features: { geometry: { type: string; coordinates: LonLat[][] | LonLat[][][] } }[] }).features.flatMap((f) =>
  (f.geometry.type === 'MultiPolygon' ? (f.geometry.coordinates as LonLat[][][]) : [f.geometry.coordinates as LonLat[][]]).map((rings) => {
    const shape = { type: 'Polygon' as const, coordinates: rings }
    const middle = geoCentroid(shape) as LonLat
    return { shape, middle, reach: Math.max(...rings[0].map((at) => geoDistance(middle, at))) }
  }),
)
/** Whether the globe is gliding: it then draws the coarse land, cheap enough for every frame, and the fine once settled. */
let moving = false
/** The radius in pixels past which the fine land is drawn. */
const DETAIL = 900

/**
 * Projects the globe seen from `view` into a window `size`: where a place falls on the page and whether it faces the
 * viewer, and `path`, which draws shapes on it clipped at the horizon.
 */
function projection({ centre, r, turn }: View, size: Size) {
  const lens = geoOrthographic()
    .rotate([-centre[0], -centre[1], -turn / RAD])
    .scale(r)
    .translate([size.w / 2, open(size).middle])
    .clipAngle(90)
    // Cut at the window's edge too, so a close view draws only what shows.
    .clipExtent([[-40, -40], [size.w + 40, size.h + 40]])
    .precision(1)
  const project = (at: LonLat) => {
    const [x, y] = lens(at)!
    return { x, y, front: geoDistance(at, centre) < Math.PI / 2 }
  }
  return Object.assign(project, { path: geoPath(lens).digits(1), invert: (x: number, y: number) => lens.invert!([x, y]) as LonLat })
}

/** Whether each place stands on land, as found. */
const ashore = new Map<string, boolean>()
const onLand = (at: LonLat) => {
  const key = at.map((v) => v.toFixed(2)).join()
  if (!ashore.has(key)) ashore.set(key, geoContains(FINE, at))
  return ashore.get(key)!
}

/**
 * A made-up island under a stop out at sea, `size` pixels round, its shore wobbling by a seed from where it stands, so
 * the way across reads as island hopping.
 */
function island(p: { x: number; y: number }, at: LonLat, size: number): string {
  const seed = Math.abs(Math.sin(at[0] * 12.9898 + at[1] * 78.233)) * 43758.5453
  const points = Array.from({ length: 24 }, (_, i) => {
    const angle = (i / 24) * 2 * Math.PI
    const reach = size * (0.85 + 0.18 * Math.sin(seed + angle * 2) + 0.08 * Math.sin(seed * 1.7 + angle * 5))
    return `${(p.x + Math.cos(angle) * reach * 1.15).toFixed(1)},${(p.y + Math.sin(angle) * reach).toFixed(1)}`
  })
  return `<path class="land isle" d="M${points.join('L')}Z"/>`
}

/** A line through `places` as an SVG path, cut where it passes round the back. */
const line = (project: ReturnType<typeof projection>, places: LonLat[]) => project.path({ type: 'LineString', coordinates: places }) ?? ''

/** The place in the middle of `places`, on the globe. */
function middle(places: LonLat[]): LonLat {
  const v = places.reduce(
    (sum, [lon, lat]) => [sum[0] + Math.cos(lat * RAD) * Math.cos(lon * RAD), sum[1] + Math.cos(lat * RAD) * Math.sin(lon * RAD), sum[2] + Math.sin(lat * RAD)],
    [0, 0, 0],
  )
  return [Math.atan2(v[1], v[0]) / RAD, Math.atan2(v[2], Math.hypot(v[0], v[1])) / RAD]
}

/** The great-circle way from `a` to `b`, as places along it. */
const way = (a: LonLat, b: LonLat) => Array.from({ length: 24 }, (_, i) => along(a, b, i / 23))

/**
 * The view that frames `seen` to fill a window `size`, spun so the way from `up[0]` to `up[1]` points up the page. If
 * `apart` is given, it zooms in further, as far as `must` still fits, so no two of `apart` stand closer than GAP.
 */
function framed(seen: LonLat[], size: Size, up?: [LonLat, LonLat], apart: LonLat[] = [], must: LonLat[] = seen): View {
  const centre = middle(seen)
  let turn = 0
  if (up && arc(up[0], up[1]) > 0.01) {
    const flat = projection({ centre, r: 1, turn: 0 }, { w: 0, h: 0 })
    const [a, b] = [flat(up[0]), flat(up[1])]
    turn = -Math.PI / 2 - Math.atan2(b.y - a.y, b.x - a.x)
  }
  // The radius at which the farthest place across and the farthest up or down each just fit.
  const unit = projection({ centre, r: 1, turn }, { w: 0, h: 0 })
  const reach = Math.sin(MIN_REACH * RAD)
  const across = Math.max(reach, ...seen.map((p) => Math.abs(unit(p).x)))
  const upright = Math.max(reach, ...seen.map((p) => Math.abs(unit(p).y)))
  const { half } = open(size)
  const fit = (places: LonLat[]) =>
    Math.min((size.w / 2 - MARGIN) / Math.max(reach, ...places.map((p) => Math.abs(unit(p).x))), (half - MARGIN) / Math.max(reach, ...places.map((p) => Math.abs(unit(p).y))))
  let r = Math.min((size.w / 2 - MARGIN) / across, (half - MARGIN) / upright)
  const nearest = Math.min(...apart.flatMap((a, i) => apart.slice(i + 1).map((b) => Math.hypot(unit(a).x - unit(b).x, unit(a).y - unit(b).y))).filter((d) => d > 0))
  if (Number.isFinite(nearest)) r = Math.max(r, Math.min(GAP / nearest, fit(must)))
  return { centre, r: Math.min(NEAR, Math.max(FAR, r)), turn }
}

/** The fewest pixels between two stops in sight, so each stands clear of the next. */
const GAP = 90

/**
 * The globe last drawn: the view it is framed on, the view it shows now, partway through a glide, and how to draw its
 * insides from any view.
 */
let drawn: { target: View; now: View; draw: (view: View) => string } | null = null

/** A globe a window `size`, drawn from `draw` framed on `target`, kept to glide later. */
function keep(size: Size, target: View, draw: (view: View) => string): string {
  drawn = { target, now: target, draw }
  return `<div class="globe" style="width:${size.w}px;height:${size.h}px">${draw(target)}</div>`
}

/** The view the globe on screen shows, if any. */
export const viewNow = (): View | null => drawn?.now ?? null

/** How long the globe takes to turn from one view to the next, in milliseconds. */
const GLIDE_MS = 1300
let glides = 0

/** The shortest spin from `a` to `b`. */
const spin = (a: number, b: number) => ((((b - a) % (2 * Math.PI)) + 3 * Math.PI) % (2 * Math.PI)) - Math.PI

/** Turns and zooms the globe in `root` from `from` to the view it is framed on, then fades its choices in. */
export function glide(root: HTMLElement, from: View | null): void {
  const to = drawn
  const globe = root.querySelector<HTMLElement>('.globe')
  if (!to || !from || !globe) return
  const { target } = to
  if (arc(from.centre, target.centre) < 0.05 && Math.abs(from.r / target.r - 1) < 0.01 && Math.abs(spin(from.turn, target.turn)) < 0.01) return
  const token = ++glides
  const start = performance.now()
  const turning = spin(from.turn, target.turn)
  const frame = (time: number) => {
    // A redraw of the same page keeps the glide going; a new globe on the page ends it.
    if (token !== glides || !globe.isConnected) return
    const t = Math.min(1, (time - start) / GLIDE_MS)
    const e = t * t * (3 - 2 * t)
    // The globe turns and centres while still far off, in the first half, where that moves the stops least; then it
    // only closes in, each stop sliding straight out from the middle.
    const early = Math.min(1, t * 2)
    const settled = early * early * (3 - 2 * early)
    to.now = t < 1 ? { centre: along(from.centre, target.centre, settled), r: from.r * (target.r / from.r) ** e, turn: from.turn + turning * settled } : target
    if (drawn) drawn.now = to.now
    moving = t < 1
    globe.innerHTML = to.draw(to.now)
    globe.classList.toggle('gliding', t < 1)
    globe.classList.toggle('arrived', t === 1)
    if (t < 1) requestAnimationFrame(frame)
  }
  frame(start)
  requestAnimationFrame(frame)
}

/** The globe's insides: air, sea, graticule and coasts, under `over`, with `pins` laid on top. */
function sphere(view: View, size: Size, over: string, pins: string): string {
  const project = projection(view, size)
  // Only the shapes reaching into the view are drawn: the part of the globe a window `size` across can show.
  const seen = Math.asin(Math.min(1, Math.hypot(size.w, size.h) / 2 / view.r))
  const land = moving || view.r <= DETAIL ? COARSE : { type: 'GeometryCollection' as const, geometries: PARTS.filter((part) => geoDistance(part.middle, view.centre) - part.reach < seen).map((part) => part.shape) }
  const coasts = `<path class="land" d="${project.path(land) ?? ''}"/>`
  const graticule = [
    ...Array.from({ length: 12 }, (_, i) => Array.from({ length: 37 }, (_, k): LonLat => [i * 30, -90 + k * 5])),
    ...Array.from({ length: 5 }, (_, i) => Array.from({ length: 73 }, (_, k): LonLat => [-180 + k * 5, -60 + i * 30])),
  ]
    .map((places) => `<path class="graticule" d="${line(project, places)}"/>`)
    .join('')
  const { w, h } = size
  return `<div class="sea" style="left:${w / 2 - view.r}px;top:${open(size).middle - view.r}px;width:${2 * view.r}px;height:${2 * view.r}px"></div>
    <svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${graticule}${coasts}${over}</svg>
    ${pins}`
}

/** The fewest pixels between two stops' middles across a column, so each is a tap of its own. */
const ROOM = 54
/** The fewest pixels from one column of stops to the next up the page, and the most a column spreads up and down. */
const RISE = 72
const BAND = 16
/** How steeply a trail across the page climbs at least: up for each pixel across. */
const SLANT = 0.7

/**
 * Lays stops out so the map reads at a glance: each column a band of its own, the next one up the page above it, and
 * in each its stops in order across, ROOM apart. Then trails between neighbouring columns never cross, nor run through
 * a stop. Each stop moves as little as that takes; the squad's holds still.
 */
function untangle(stops: { p: { x: number; y: number }; layer: number; order: number; fixed: boolean }[], lines: [number, number][]): void {
  const layers = [...new Set(stops.map((s) => s.layer))].sort((a, b) => a - b).map((layer) => stops.filter((s) => s.layer === layer).sort((a, b) => a.order - b.order))
  // Which way across the page the order runs, as most columns have it.
  const lean = layers.reduce((sum, column) => sum + column.reduce((t, s, i) => t + (i > 0 ? s.p.x - column[i - 1].p.x : 0), 0), 0)
  const dir = lean < 0 ? -1 : 1
  for (const column of layers) {
    if (column.some((s) => s.fixed)) continue
    // Across: each ROOM past the last, then all shifted back by as much as they moved on average.
    const was = column.map((s) => s.p.x * dir)
    const now = was.map((x) => x)
    for (let i = 1; i < now.length; i++) now[i] = Math.max(now[i], now[i - 1] + ROOM)
    const shift = was.reduce((sum, x, i) => sum + x - now[i], 0) / now.length
    column.forEach((s, i) => (s.p.x = (now[i] + shift) * dir))
  }
  // Each column a band, BAND deep about its middle, at least RISE above the column before, out from the squad's both ways.
  const at = Math.max(0, layers.findIndex((column) => column.some((s) => s.fixed)))
  for (const column of layers) {
    if (column.some((s) => s.fixed)) continue
    const ys = column.map((s) => s.p.y).sort((a, b) => a - b)
    const mid = ys[Math.floor(ys.length / 2)]
    for (const s of column) s.p.y = Math.min(mid + BAND / 2, Math.max(mid - BAND / 2, s.p.y))
  }
  // A trail far across climbs as steeply as SLANT has it.
  const rise = (a: { p: { x: number } }, b: { p: { x: number } }) => Math.max(RISE, SLANT * Math.abs(a.p.x - b.p.x))
  const linked = (a: (typeof stops)[number], b: (typeof stops)[number]) => lines.some(([u, v]) => (stops[u] === a && stops[v] === b) || (stops[u] === b && stops[v] === a))
  for (let k = at + 1; k < layers.length; k++) {
    const over = Math.max(...layers[k].flatMap((s) => layers[k - 1].map((r) => s.p.y - r.p.y + (linked(r, s) ? rise(r, s) : RISE))))
    if (over > 0) for (const s of layers[k]) s.p.y -= over
  }
  for (let k = at - 1; k >= 0; k--) {
    const under = Math.max(...layers[k].flatMap((s) => layers[k + 1].map((r) => r.p.y - s.p.y + (linked(r, s) ? rise(r, s) : RISE))))
    if (under > 0) for (const s of layers[k]) s.p.y += under
  }
  // A stop a trail fans past too near steps out of its way, and stops that crowd step apart.
  for (let round = 0; round < 12; round++) {
    budge(stops)
    for (const [a, b] of lines)
      for (const [k, s] of stops.entries()) {
        if (k === a || k === b || s.fixed) continue
        const [u, v] = [stops[a].p, stops[b].p]
        const t = Math.max(0, Math.min(1, ((s.p.x - u.x) * (v.x - u.x) + (s.p.y - u.y) * (v.y - u.y)) / ((v.x - u.x) ** 2 + (v.y - u.y) ** 2 || 1)))
        const [dx, dy] = [s.p.x - u.x - t * (v.x - u.x), s.p.y - u.y - t * (v.y - u.y)]
        const d = Math.hypot(dx, dy)
        if (d >= CLEAR) continue
        const [nx, ny] = d > 0.01 ? [dx / d, dy / d] : [-(v.y - u.y) / Math.hypot(v.x - u.x, v.y - u.y), (v.x - u.x) / Math.hypot(v.x - u.x, v.y - u.y)]
        s.p.x += nx * (CLEAR - d)
        s.p.y += ny * (CLEAR - d)
      }
  }
}

/** Pushes stops standing closer than ROOM apart, the squad's own holding still. */
function budge(stops: { p: { x: number; y: number }; fixed: boolean }[]): void {
  for (const [i, a] of stops.entries())
    for (const b of stops.slice(i + 1)) {
      const [dx, dy] = [b.p.x - a.p.x, b.p.y - a.p.y]
      const d = Math.hypot(dx, dy)
      if (d >= ROOM || (a.fixed && b.fixed)) continue
      // Stops on the same spot part sideways.
      const [ux, uy] = d > 0.01 ? [dx / d, dy / d] : [1, 0]
      const [sa, sb] = a.fixed ? [0, 1] : b.fixed ? [1, 0] : [0.5, 0.5]
      a.p.x -= ux * (ROOM - d) * sa
      a.p.y -= uy * (ROOM - d) * sa
      b.p.x += ux * (ROOM - d) * sb
      b.p.y += uy * (ROOM - d) * sb
    }
}

/** The fewest pixels between a stop's middle and a trail not its own. */
const CLEAR = 30

/** Where on the page a place falls, as CSS. */
const spot = (p: { x: number; y: number }) => `left:${p.x.toFixed(1)}px;top:${p.y.toFixed(1)}px`

/** The squad's helicopter, over where it stands; it flies to the stop the player sets out for. */
const chopper = (p: { x: number; y: number }) => `<div class="chopper" style="${spot(p)}"><span>🚁</span></div>`

/** Places on the whole globe, each with its markup; the globe turns to the one chosen. */
export function places(size: Size, all: { at: LonLat; html: string; chosen: boolean }[]): string {
  const chosen = all.find((p) => p.chosen)
  const whole = framed(all.map((p) => p.at), size)
  return keep(size, chosen ? { ...whole, centre: chosen.at, r: whole.r * 1.3 } : whole, (view) => {
    const project = projection(view, size)
    const pins = all.flatMap((place) => {
      const p = project(place.at)
      return p.front ? [`<div class="cell${place.chosen ? ' chosen' : ''}" style="${spot(p)}">${place.html}</div>`] : []
    })
    return sphere(view, size, '', pins.join(''))
  })
}

/**
 * The run as a globe a window `size`, framed on the stops in sight and spun so the leg leads up the page: the journey so
 * far in gold, the hero cities, and the stops pinned along the way, trails dotted from where the squad stands to each
 * choice and on from them. The choices pulse.
 */
export function globe(size: Size, run: Run, pins: Pin[], focus: LonLat, path: string[], picking: boolean): string {
  const { target, pushed } = layout(size, run, pins, focus)
  return keep(size, target, (view) => drawRun(size, run, pins, focus, path, picking, view, target, pushed))
}

/**
 * The flight map's settled view, and how far each stop is moved from where it stands to lay the map out clearly: once,
 * as the settled view shows them; mid-glide the move shrinks and turns with the globe, so a stop slides steadily rather
 * than jostling.
 */
export function layout(size: Size, run: Run, pins: Pin[], focus: LonLat): { target: View; placed: Map<string, { x: number; y: number; front: boolean }>; pushed: Map<string, { x: number; y: number }> } {
  // Framed on where the squad stands and the stops ahead; the stops passed may fall off the edge.
  const ahead = pins.filter((p) => !p.past).map((p) => p.at)
  const choices = pins.filter((p) => p.choice).map((p) => p.at)
  // The leg leads up the page where the view looks: along the great circle it follows, at the point nearest the view's middle.
  const { from, to } = run.route[run.keys]
  const flat = plane(from, to.at)
  const t = Math.min(1, Math.max(0, (flat(middle([focus, ...ahead])).x - flat(from).x) / (flat(to.at).x - flat(from).x || 1)))
  const up: [LonLat, LonLat] = [along(from, to.at, Math.max(0, t - 0.02)), along(from, to.at, Math.min(1, t + 0.02))]
  const target = framed([focus, ...ahead], size, up, ahead, [focus, ...choices])
  const shown = pins.filter((pin) => projection(target, size)(pin.at).front)
  const index = new Map(shown.map((pin, i) => [pin.id, i]))
  const lines = shown.flatMap((pin) => pin.next.flatMap((id): [number, number][] => (index.has(id) ? [[index.get(pin.id)!, index.get(id)!]] : [])))
  // Laid out, the stops ahead may spill out of the window; then the view draws back until they fit.
  const { middle: mid, half } = open(size)
  for (let tries = 0; ; tries++) {
    const project = projection(target, size)
    const at = new Map(pins.map((pin) => [pin.id, project(pin.at)]))
    const placed = new Map([...at].map(([id, p]) => [id, { ...p }]))
    untangle(shown.map((pin) => ({ p: placed.get(pin.id)!, layer: pin.layer, order: pin.order, fixed: pin.squad })), lines)
    const seen = shown.filter((pin) => !pin.past).map((pin) => placed.get(pin.id)!)
    const spill = Math.max(...seen.map((p) => Math.max(Math.abs(p.x - size.w / 2) / (size.w / 2 - MARGIN / 2), Math.abs(p.y - mid) / (half - MARGIN / 2))))
    if (spill <= 1 || tries === 3 || target.r <= FAR) return { target, placed, pushed: new Map([...at].map(([id, p]) => [id, { x: placed.get(id)!.x - p.x, y: placed.get(id)!.y - p.y }])) }
    target.r = Math.max(FAR, target.r / spill / 1.2)
  }
}

/** The run's globe seen from `view`. */
function drawRun(size: Size, run: Run, pins: Pin[], focus: LonLat, path: string[], picking: boolean, view: View, target: View, pushed: Map<string, { x: number; y: number }>): string {
  const stage = run.route[run.keys]
  const project = projection(view, size)
  // The journey so far: each leg crossed, then this one up to where the squad stands, through its stops as laid out.
  const crossed = run.route.slice(0, run.keys).flatMap((s) => way(s.from, s.to.at))
  const home = run.soldiers[0]?.home
  const start = home && project(home.at)
  const homeMark = home && start?.front ? `<g class="city reached"><circle cx="${start.x}" cy="${start.y}" r="5"/><text x="${start.x + 10}" y="${start.y + 4}">⌂ ${home.name}</text></g>` : ''
  // Only the city this leg leads to, and those already reached.
  const cities = run.route.map((s, i) => {
    const p = project(s.to.at)
    if (!p.front || i > run.keys) return ''
    const name = s.hero ? `${s.to.name} · ${s.hero.name}` : s.to.name
    return `<g class="city ${i < run.keys ? 'reached' : ''}"><circle cx="${p.x}" cy="${p.y}" r="5"/><text x="${p.x + 10}" y="${p.y + 4}">${s.hero ? '★' : '👁'} ${name}</text></g>`
  })
  const placed = new Map(pins.map((pin) => [pin.id, project(pin.at)]))
  const [scale, spin] = [view.r / target.r, view.turn - target.turn]
  for (const [id, p] of placed) {
    const { x, y } = pushed.get(id)!
    p.x += (x * Math.cos(spin) - y * Math.sin(spin)) * scale
    p.y += (x * Math.sin(spin) + y * Math.cos(spin)) * scale
  }
  const leg = [project(stage.from), ...path.map((id) => placed.get(id)!)].filter((p) => p.front)
  const walked = `${line(project, crossed)}${leg.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join('')}`
  const trails = pins.flatMap((pin) =>
    pin.next.flatMap((id) => {
      const [a, b] = [placed.get(pin.id)!, placed.get(id)]
      const lit = pins.find((p) => p.id === id)?.lit && pin.lit
      return b && a.front && b.front ? [`<path class="trail${lit ? ' lit' : picking ? ' dim' : ''}" d="M${a.x},${a.y}L${b.x},${b.y}"/>`] : []
    }),
  )
  // A stop that shows over water, pushed there to stand clear or set out at sea, stands on a speck of island.
  const isles = pins.flatMap((pin) => {
    const p = placed.get(pin.id)!
    return pin.html && p.front && !onLand(project.invert(p.x, p.y)) ? [island(p, pin.at, pin.choice ? 24 : 18)] : []
  })
  const stops = pins.flatMap((pin) => {
    const p = placed.get(pin.id)!
    return p.front ? [`<div class="cell${pin.squad ? ' squad' : ''}${pin.choice ? ' choice' : ''}${picking && !pin.lit && !pin.squad ? ' dim' : ''}" style="${spot(p)}">${pin.html}</div>`] : []
  })
  return sphere(view, size, `${isles.join('')}<path class="walked" d="${walked}"/>${trails.join('')}${homeMark}${cities.join('')}`, stops.join('') + chopper(project(focus)))
}
