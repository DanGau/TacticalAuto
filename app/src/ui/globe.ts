import { along, arc, type LonLat } from '../core/world'
import type { Run } from '../core/run'
import { COASTS } from './coasts'

/** The globe's radius at its farthest and nearest, in pixels. */
const FAR = 120
const NEAR = 12000
/** Pixels kept clear round the stops in sight. */
const MARGIN = 60
/** The fewest degrees the view spans from its middle. */
const MIN_REACH = 3
const RAD = Math.PI / 180

/** The window the globe is seen through, in pixels. */
export interface Size {
  w: number
  h: number
}

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

/** Projects the globe seen from `view` into a window `size`: where a place falls on the page, and whether it faces the viewer. */
function projection({ centre, r, turn }: View, { w, h }: Size) {
  const [l0, p0] = [centre[0] * RAD, centre[1] * RAD]
  const [cos, sin] = [Math.cos(turn), Math.sin(turn)]
  return ([lon, lat]: LonLat) => {
    const [l, p] = [lon * RAD, lat * RAD]
    const cosc = Math.sin(p0) * Math.sin(p) + Math.cos(p0) * Math.cos(p) * Math.cos(l - l0)
    let x = Math.cos(p) * Math.sin(l - l0)
    let y = -(Math.cos(p0) * Math.sin(p) - Math.sin(p0) * Math.cos(p) * Math.cos(l - l0))
    // A place round the back is drawn on the rim, so a coast crossing it is cut along the horizon.
    if (cosc < 0) {
      const len = Math.hypot(x, y) || 1
      x /= len
      y /= len
    }
    return { x: w / 2 + (x * cos - y * sin) * r, y: h / 2 + (x * sin + y * cos) * r, front: cosc >= 0 }
  }
}

/** Points along the globe's rim, seen from `view` in a window `size`, from where `a` lies on it round the shorter way to `b`. */
function rim(a: { x: number; y: number }, b: { x: number; y: number }, { r }: View, { w, h }: Size): string {
  const [from, to] = [Math.atan2(a.y - h / 2, a.x - w / 2), Math.atan2(b.y - h / 2, b.x - w / 2)]
  let sweep = to - from
  if (sweep > Math.PI) sweep -= 2 * Math.PI
  if (sweep < -Math.PI) sweep += 2 * Math.PI
  const steps = Math.ceil(Math.abs(sweep) / 0.05)
  let d = ''
  for (let i = 1; i < steps; i++) {
    const t = from + (sweep * i) / steps
    d += `L${(w / 2 + Math.cos(t) * r).toFixed(1)},${(h / 2 + Math.sin(t) * r).toFixed(1)}`
  }
  return d
}

/**
 * A line of places as an SVG path, broken where it passes round the back. A closed one, a coast, runs round the rim
 * while it is behind, so no edge of it cuts across the globe's face.
 */
function line(project: ReturnType<typeof projection>, places: LonLat[], close = false, view?: View, size?: Size): string {
  let d = ''
  let pen = false
  let last: ReturnType<ReturnType<typeof projection>> | null = null
  for (const at of [...places, ...(close ? [places[0]] : [])]) {
    const p = project(at)
    if (!p.front && !close) {
      pen = false
      continue
    }
    if (last && !last.front && !p.front && view && size) d += rim(last, p, view, size)
    d += `${pen ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`
    pen = true
    last = p
  }
  return d + (close ? 'Z' : '')
}

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
  const fit = (places: LonLat[]) =>
    Math.min((size.w / 2 - MARGIN) / Math.max(reach, ...places.map((p) => Math.abs(unit(p).x))), (size.h / 2 - MARGIN) / Math.max(reach, ...places.map((p) => Math.abs(unit(p).y))))
  let r = Math.min((size.w / 2 - MARGIN) / across, (size.h / 2 - MARGIN) / upright)
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
    to.now = t < 1 ? { centre: along(from.centre, target.centre, e), r: from.r * (target.r / from.r) ** e, turn: from.turn + turning * e } : target
    if (drawn) drawn.now = to.now
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
  const coasts = COASTS.filter((ring) => ring.some((at) => project(at).front))
    .map((ring) => `<path class="land" d="${line(project, ring, true, view, size)}"/>`)
    .join('')
  const graticule = [
    ...Array.from({ length: 12 }, (_, i) => Array.from({ length: 37 }, (_, k): LonLat => [i * 30, -90 + k * 5])),
    ...Array.from({ length: 5 }, (_, i) => Array.from({ length: 73 }, (_, k): LonLat => [-180 + k * 5, -60 + i * 30])),
  ]
    .map((places) => `<path class="graticule" d="${line(project, places)}"/>`)
    .join('')
  const { w, h } = size
  return `<div class="sea" style="left:${w / 2 - view.r}px;top:${h / 2 - view.r}px;width:${2 * view.r}px;height:${2 * view.r}px"></div>
    <svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${graticule}${coasts}${over}</svg>
    ${pins}`
}

/** The fewest pixels between two stops' middles, so each is a tap of its own. */
const ROOM = 54

/** Pushes stops standing closer than ROOM apart, a few rounds over, the squad's own stop holding still. */
function budge(stops: { p: { x: number; y: number }; fixed: boolean }[]): void {
  for (let round = 0; round < 8; round++)
    for (const [i, a] of stops.entries())
      for (const b of stops.slice(i + 1)) {
        const [dx, dy] = [b.p.x - a.p.x, b.p.y - a.p.y]
        const d = Math.hypot(dx, dy)
        if (d >= ROOM) continue
        // Stops on the same spot part sideways.
        const [ux, uy] = d > 0.01 ? [dx / d, dy / d] : [1, 0]
        const push = ROOM - d
        const [sa, sb] = a.fixed ? [0, 1] : b.fixed ? [1, 0] : [0.5, 0.5]
        a.p.x -= ux * push * sa
        a.p.y -= uy * push * sa
        b.p.x += ux * push * sb
        b.p.y += uy * push * sb
      }
}

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
export function globe(size: Size, run: Run, pins: Pin[], focus: LonLat, path: LonLat[], picking: boolean): string {
  // Framed on where the squad stands and the stops ahead; the stops passed may fall off the edge.
  const ahead = pins.filter((p) => !p.past).map((p) => p.at)
  const choices = pins.filter((p) => p.choice).map((p) => p.at)
  const target = framed([focus, ...ahead], size, [focus, run.route[run.keys].to.at], ahead, [focus, ...choices])
  return keep(size, target, (view) => drawRun(size, run, pins, focus, path, picking, view))
}

/** The run's globe seen from `view`. */
function drawRun(size: Size, run: Run, pins: Pin[], focus: LonLat, path: LonLat[], picking: boolean, view: View): string {
  const stage = run.route[run.keys]
  const project = projection(view, size)
  // The journey so far: each leg crossed, then this one up to where the squad stands.
  const walked = [...run.route.slice(0, run.keys).flatMap((s) => way(s.from, s.to.at)), ...[stage.from, ...path].flatMap((at, i, all) => (i === 0 ? [] : way(all[i - 1], at)))]
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
  budge(pins.filter((pin) => placed.get(pin.id)!.front).map((pin) => ({ p: placed.get(pin.id)!, fixed: pin.squad })))
  const trails = pins.flatMap((pin) =>
    pin.next.flatMap((id) => {
      const [a, b] = [placed.get(pin.id)!, placed.get(id)]
      const lit = pins.find((p) => p.id === id)?.lit && pin.lit
      return b && a.front && b.front ? [`<path class="trail${lit ? ' lit' : picking ? ' dim' : ''}" d="M${a.x},${a.y}L${b.x},${b.y}"/>`] : []
    }),
  )
  const stops = pins.flatMap((pin) => {
    const p = placed.get(pin.id)!
    return p.front ? [`<div class="cell${pin.squad ? ' squad' : ''}${pin.choice ? ' choice' : ''}${picking && !pin.lit && !pin.squad ? ' dim' : ''}" style="${spot(p)}">${pin.html}</div>`] : []
  })
  return sphere(view, size, `<path class="walked" d="${line(project, walked)}"/>${trails.join('')}${homeMark}${cities.join('')}`, stops.join('') + chopper(project(focus)))
}
