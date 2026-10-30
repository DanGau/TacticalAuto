import { along, arc, HUB, type LonLat } from '../core/world'
import { LEG_STOPS, MAP_ROWS, type Run } from '../core/run'
import { COASTS } from './coasts'

/** The window the globe is seen through, in pixels, and the globe's radius at its farthest and nearest. */
const W = 900
const H = 560
const FAR = 240
const NEAR = 1500
/** The share of the window's width a leg spans, the globe zoomed to fit. */
const SPAN = 0.62
const RAD = Math.PI / 180

/** A stop shown on the globe: its id, where it stands, its markup, the stops it leads to, and whether the squad stands on it. */
export interface Pin {
  id: string
  at: LonLat
  html: string
  next: string[]
  squad: boolean
}

/** Where the stop in column `c` and row `row` of leg `l` stands: across the leg's continent, its rows spread side by side. */
export function pinAt(run: Run, l: number, c: number, row: number): LonLat {
  const stage = run.route[l]
  if (!stage) return HUB.at
  if (c >= LEG_STOPS || l >= run.route.length - 1) return stage.to.at
  const t = (c + 1) / (LEG_STOPS + 1)
  const at = along(stage.from, stage.to.at, t)
  const ahead = along(stage.from, stage.to.at, Math.min(1, t + 0.01))
  // Rows spread across the way, wider on a longer leg.
  const spread = Math.max(1.6, arc(stage.from, stage.to.at) / 16)
  const off = (row - (MAP_ROWS - 1) / 2) * spread
  const dx = (ahead[0] - at[0]) * Math.cos(at[1] * RAD)
  const dy = ahead[1] - at[1]
  const len = Math.hypot(dx, dy) || 1
  return [at[0] + ((-dy / len) * off) / Math.cos(at[1] * RAD), at[1] + (dx / len) * off]
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

/** The great-circle way from `a` to `b`, as places along it. */
const way = (a: LonLat, b: LonLat) => Array.from({ length: 24 }, (_, i) => along(a, b, i / 23))

/**
 * The run as a globe turned to the leg under way: the world's coasts, the journey so far in gold, the route ahead
 * dotted from city to city to the hub, and the stops within reach pinned along the way, their trails dotted between.
 */
export function globe(run: Run, pins: Pin[], focus: LonLat): string {
  const stage = run.route[run.keys]
  // Facing the middle of what matters now: where the squad is, and where the leg leads.
  const centre = along(focus, stage.to.at, 0.4)
  // Zoomed so the leg fills the window: close on a short leg, the whole world on the long last one.
  const span = Math.max(1, arc(focus, stage.to.at)) * RAD
  const r = Math.min(NEAR, Math.max(FAR, (SPAN * W) / 2 / Math.sin(Math.min(span, Math.PI / 2) / 2)))
  const project = projection(centre, r)
  const coasts = COASTS.map((ring) => `<path class="land" d="${line(project, ring, true)}"/>`).join('')
  const graticule = [
    ...Array.from({ length: 12 }, (_, i) => Array.from({ length: 37 }, (_, k): LonLat => [i * 30, -90 + k * 5])),
    ...Array.from({ length: 5 }, (_, i) => Array.from({ length: 73 }, (_, k): LonLat => [-180 + k * 5, -60 + i * 30])),
  ]
    .map((places) => `<path class="graticule" d="${line(project, places)}"/>`)
    .join('')
  // The journey so far: each leg crossed, then this one up to where the squad stands.
  const walked = [...run.route.slice(0, run.keys).flatMap((s) => way(s.from, s.to.at)), ...way(stage.from, focus)]
  const ahead = run.route.slice(run.keys).flatMap((s, i) => (i === 0 ? way(focus, s.to.at) : way(s.from, s.to.at)))
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
      return b && a.front && b.front ? [`<path class="trail" d="M${a.x},${a.y}L${b.x},${b.y}"/>`] : []
    }),
  )
  const stops = pins.flatMap((pin) => {
    const p = placed.get(pin.id)!
    return p.front ? [`<div class="cell${pin.squad ? ' squad' : ''}" style="left:${p.x}px;top:${p.y}px">${pin.html}</div>`] : []
  })
  return `<div class="globe" style="width:${W}px;height:${H}px">
    <svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
      <defs>
        <radialGradient id="sea" cx="40%" cy="35%" r="75%"><stop offset="0" stop-color="#1d3a5e"/><stop offset="1" stop-color="#0a1626"/></radialGradient>
        <radialGradient id="air" r="50%"><stop offset="0.86" stop-color="#4da3ff" stop-opacity="0"/><stop offset="0.93" stop-color="#4da3ff" stop-opacity="0.35"/><stop offset="1" stop-color="#4da3ff" stop-opacity="0"/></radialGradient>
      </defs>
      <circle cx="${W / 2}" cy="${H / 2}" r="${r * 1.16}" fill="url(#air)"/>
      <circle cx="${W / 2}" cy="${H / 2}" r="${r}" fill="url(#sea)"/>
      ${graticule}${coasts}
      <path class="ahead" d="${line(project, ahead)}"/>
      <path class="walked" d="${line(project, walked)}"/>
      ${trails.join('')}${homeMark}${cities.join('')}
    </svg>
    ${stops.join('')}
  </div>`
}
