import { along, arc, type LonLat } from '../core/world'
import type { Run } from '../core/run'
import { COASTS } from './coasts'

/** The window the globe is seen through, in pixels, and the globe's radius at its farthest and nearest. */
const W = 900
const H = 560
const FAR = 240
const NEAR = 4000
/** Pixels kept clear round the stops in sight, and the fewest degrees the view spans from its middle. */
const MARGIN = 70
const MIN_REACH = 4
const RAD = Math.PI / 180

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
}

/** Projects the globe, `r` pixels round, turned to face `centre`: where a place falls on the page, and whether it faces the viewer. */
function projection(centre: LonLat, r: number) {
  const [l0, p0] = [centre[0] * RAD, centre[1] * RAD]
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
    return { x: W / 2 + x * r, y: H / 2 + y * r, front: cosc >= 0 }
  }
}

/** A line of places as an SVG path, broken where it passes round the back. */
function line(project: ReturnType<typeof projection>, places: LonLat[], close = false): string {
  let d = ''
  let pen = false
  for (const at of [...places, ...(close ? [places[0]] : [])]) {
    const p = project(at)
    if (!p.front && !close) {
      pen = false
      continue
    }
    d += `${pen ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`
    pen = true
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

/** The globe turned and zoomed so `seen` fills the window. */
function framed(seen: LonLat[]) {
  const centre = middle(seen)
  const reach = Math.max(MIN_REACH, ...seen.map((p) => arc(centre, p))) * RAD
  const r = Math.min(NEAR, Math.max(FAR, (H / 2 - MARGIN) / Math.sin(Math.min(reach, Math.PI / 2))))
  return { r, project: projection(centre, r) }
}

/** The globe itself: air, sea, graticule and coasts, under `over`, with `pins` laid on top. */
function sphere(r: number, project: ReturnType<typeof projection>, over: string, pins: string): string {
  const coasts = COASTS.map((ring) => `<path class="land" d="${line(project, ring, true)}"/>`).join('')
  const graticule = [
    ...Array.from({ length: 12 }, (_, i) => Array.from({ length: 37 }, (_, k): LonLat => [i * 30, -90 + k * 5])),
    ...Array.from({ length: 5 }, (_, i) => Array.from({ length: 73 }, (_, k): LonLat => [-180 + k * 5, -60 + i * 30])),
  ]
    .map((places) => `<path class="graticule" d="${line(project, places)}"/>`)
    .join('')
  return `<div class="globe" style="width:${W}px;height:${H}px">
    <svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
      <defs>
        <radialGradient id="sea" cx="40%" cy="35%" r="75%"><stop offset="0" stop-color="#1d3a5e"/><stop offset="1" stop-color="#0a1626"/></radialGradient>
        <radialGradient id="air" r="50%"><stop offset="0.86" stop-color="#4da3ff" stop-opacity="0"/><stop offset="0.93" stop-color="#4da3ff" stop-opacity="0.35"/><stop offset="1" stop-color="#4da3ff" stop-opacity="0"/></radialGradient>
      </defs>
      <circle cx="${W / 2}" cy="${H / 2}" r="${r * 1.16}" fill="url(#air)"/>
      <circle cx="${W / 2}" cy="${H / 2}" r="${r}" fill="url(#sea)"/>
      ${graticule}${coasts}${over}
    </svg>
    ${pins}
  </div>`
}

/** Where on the page a place falls, as CSS. */
const spot = (p: { x: number; y: number }) => `left:${p.x.toFixed(1)}px;top:${p.y.toFixed(1)}px`

/** The squad's helicopter, over where it stands; it flies to the stop the player sets out for. */
const chopper = (p: { x: number; y: number }) => `<div class="chopper" style="${spot(p)}"><span>🚁</span></div>`

/** Places to choose between on the whole globe, each with its markup: where a run may begin. */
export function choices(places: { at: LonLat; html: string; chosen: boolean }[]): string {
  const { r, project } = framed(places.map((p) => p.at))
  const pins = places.map((place) => `<div class="cell choice${place.chosen ? ' chosen' : ''}" style="${spot(project(place.at))}">${place.html}</div>`)
  return sphere(r, project, '', pins.join(''))
}

/**
 * The run as a globe framed on the stops in sight: the journey so far in gold, the hero cities, and the stops pinned
 * along the way, trails dotted from where the squad stands to each choice and on from them. The choices pulse.
 */
export function globe(run: Run, pins: Pin[], focus: LonLat, path: LonLat[], picking: boolean): string {
  const stage = run.route[run.keys]
  const { r, project } = framed([focus, ...pins.map((p) => p.at)])
  // The journey so far: each leg crossed, then this one up to where the squad stands.
  const walked = [...run.route.slice(0, run.keys).flatMap((s) => way(s.from, s.to.at)), ...[stage.from, ...path].flatMap((at, i, all) => (i === 0 ? [] : way(all[i - 1], at)))]
  const home = run.soldiers[0]?.home
  const start = home && project(home.at)
  const homeMark = home && start?.front ? `<g class="city reached"><circle cx="${start.x}" cy="${start.y}" r="5"/><text x="${start.x + 10}" y="${start.y + 4}">⌂ ${home.name}</text></g>` : ''
  const cities = run.route.map((s, i) => {
    const p = project(s.to.at)
    if (!p.front) return ''
    const name = s.hero ? `${s.to.name} · ${s.hero.name}` : s.to.name
    return `<g class="city ${i < run.keys ? 'reached' : ''}"><circle cx="${p.x}" cy="${p.y}" r="5"/><text x="${p.x + 10}" y="${p.y + 4}">${s.hero ? '★' : '👁'} ${name}</text></g>`
  })
  const placed = new Map(pins.map((pin) => [pin.id, project(pin.at)]))
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
  return sphere(r, project, `<path class="walked" d="${line(project, walked)}"/>${trails.join('')}${homeMark}${cities.join('')}`, stops.join('') + chopper(project(focus)))
}
