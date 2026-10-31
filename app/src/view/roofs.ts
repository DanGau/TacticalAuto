// Roof shapes in each style.
import { shade, type Point3, type Shapes } from './shapes'

/**
 * How a region roofs its buildings:
 * - `flat`: a flat roof inside a low parapet, as concrete blocks have.
 * - `clutter`: a flat roof crowded with water tanks and air-conditioning units, as a dense Asian or Latin city's.
 * - `gable`: two slopes meeting at a ridge along the building's length, gable ends at either end.
 * - `hip`: four slopes rising to a short ridge.
 * - `eaves`: a hipped roof whose eaves reach out and turn up at the corners, as Chinese and Japanese roofs do.
 * - `mansard`: steep sides up to a low flat top, as Paris's.
 * - `dome`: a flat roof crowned by a dome, as a medina's or an island chapel's.
 * - `tin`: a single sloping sheet of corrugated metal, as a favela's or a township's.
 */
export type RoofStyle = 'flat' | 'clutter' | 'gable' | 'hip' | 'eaves' | 'mansard' | 'dome' | 'tin'

/** A building's rectangle of tiles, edges included, and the height its roof starts at. */
interface Footing {
  x1: number
  y1: number
  x2: number
  y2: number
  y: number
}

/** How each way a slope can face is shaded, as a box's sides are. */
const LIGHT = { south: 0.92, east: 0.74, north: 0.62, west: 0.55 }

/**
 * Adds a roof of `style` over a rectangular building to `shapes`, in `color`, its gable ends in `wall`; `rand` picks
 * the clutter on a crowded roof. The roof runs out `eave` past the walls.
 */
export function addRoof(shapes: Shapes, style: RoofStyle, f: Footing, color: number, wall: number, eave: number, rand: () => number): void {
  const x0 = f.x1 - 0.5 - eave
  const z0 = f.y1 - 0.5 - eave
  const x1 = f.x2 + 0.5 + eave
  const z1 = f.y2 + 0.5 + eave
  const w = x1 - x0
  const d = z1 - z0
  const y = f.y
  const p = (x: number, py: number, z: number): Point3 => ({ x, y: py, z })
  // A ridge runs the building's long way.
  const alongX = w >= d
  // Each building's pitch differs a little from its neighbours'.
  const rise = Math.min(w, d) * (0.3 + rand() * 0.25)
  switch (style) {
    case 'flat':
    case 'clutter': {
      shapes.flat(x0, z0, x1, z1, y, color)
      // A parapet round the edge.
      const lip = 0.12
      const up = 0.12
      for (const [a, b, c, e] of [[x0, z0, x1, z0 + lip], [x0, z1 - lip, x1, z1], [x0, z0, x0 + lip, z1], [x1 - lip, z0, x1, z1]]) shapes.box(a, b, c, e, y, y + up, shade(color, 1.15))
      if (style === 'flat') return
      for (let i = Math.round((w * d) / 6); i > 0; i--) {
        const cx = x0 + 0.5 + rand() * (w - 1)
        const cz = z0 + 0.5 + rand() * (d - 1)
        // A tank is tall and pale; an air-conditioning unit is a low grey box.
        if (rand() < 0.35) shapes.box(cx - 0.18, cz - 0.18, cx + 0.18, cz + 0.18, y, y + 0.45, 0xc8ccd0)
        else shapes.box(cx - 0.2, cz - 0.13, cx + 0.2, cz + 0.13, y, y + 0.16, 0x8a8e94)
      }
      return
    }
    case 'gable': {
      const top = y + rise
      if (alongX) {
        const mz = (z0 + z1) / 2
        shapes.quad(p(x0, y, z1), p(x1, y, z1), p(x1, top, mz), p(x0, top, mz), shade(color, LIGHT.south))
        shapes.quad(p(x0, y, z0), p(x1, y, z0), p(x1, top, mz), p(x0, top, mz), shade(color, LIGHT.north))
        shapes.tri(p(x0 + eave, y, z0 + eave), p(x0 + eave, y, z1 - eave), p(x0 + eave, top, mz), shade(wall, LIGHT.west))
        shapes.tri(p(x1 - eave, y, z0 + eave), p(x1 - eave, y, z1 - eave), p(x1 - eave, top, mz), shade(wall, LIGHT.east))
      } else {
        const mx = (x0 + x1) / 2
        shapes.quad(p(x1, y, z0), p(x1, y, z1), p(mx, top, z1), p(mx, top, z0), shade(color, LIGHT.east))
        shapes.quad(p(x0, y, z0), p(x0, y, z1), p(mx, top, z1), p(mx, top, z0), shade(color, LIGHT.west))
        shapes.tri(p(x0 + eave, y, z1 - eave), p(x1 - eave, y, z1 - eave), p(mx, top, z1 - eave), shade(wall, LIGHT.south))
        shapes.tri(p(x0 + eave, y, z0 + eave), p(x1 - eave, y, z0 + eave), p(mx, top, z0 + eave), shade(wall, LIGHT.north))
      }
      return
    }
    case 'hip':
    case 'eaves': {
      const top = y + rise * (style === 'eaves' ? 0.8 : 1)
      const inset = Math.min(w, d) / 2
      // The ridge, shortened from each end by half the building's width.
      const r0 = alongX ? p(x0 + inset, top, (z0 + z1) / 2) : p((x0 + x1) / 2, top, z0 + inset)
      const r1 = alongX ? p(x1 - inset, top, (z0 + z1) / 2) : p((x0 + x1) / 2, top, z1 - inset)
      // Upturned eaves: each corner lifted a little.
      const lift = style === 'eaves' ? 0.18 : 0
      const c00 = p(x0, y + lift, z0)
      const c10 = p(x1, y + lift, z0)
      const c11 = p(x1, y + lift, z1)
      const c01 = p(x0, y + lift, z1)
      const [near, far] = alongX ? [r1, r0] : [r1, r0]
      if (alongX) {
        shapes.quad(c01, c11, near, far, shade(color, LIGHT.south))
        shapes.quad(c00, c10, near, far, shade(color, LIGHT.north))
        shapes.tri(c10, c11, near, shade(color, LIGHT.east))
        shapes.tri(c00, c01, far, shade(color, LIGHT.west))
      } else {
        shapes.quad(c10, c11, near, far, shade(color, LIGHT.east))
        shapes.quad(c00, c01, near, far, shade(color, LIGHT.west))
        shapes.tri(c01, c11, near, shade(color, LIGHT.south))
        shapes.tri(c00, c10, far, shade(color, LIGHT.north))
      }
      // A ridge tile along the top.
      if (style === 'eaves') shapes.box(Math.min(r0.x, r1.x) - 0.06, Math.min(r0.z, r1.z) - 0.06, Math.max(r0.x, r1.x) + 0.06, Math.max(r0.z, r1.z) + 0.06, top - 0.02, top + 0.1, shade(color, 0.7))
      return
    }
    case 'mansard': {
      // Steep slates up to a flat top set well in, a dormer's worth of height.
      const inset = Math.min(w, d) * 0.22
      const top = y + 0.7
      const a = [p(x0, y, z0), p(x1, y, z0), p(x1, y, z1), p(x0, y, z1)]
      const b = [p(x0 + inset, top, z0 + inset), p(x1 - inset, top, z0 + inset), p(x1 - inset, top, z1 - inset), p(x0 + inset, top, z1 - inset)]
      const faces = [LIGHT.north, LIGHT.east, LIGHT.south, LIGHT.west]
      for (let i = 0; i < 4; i++) shapes.quad(a[i], a[(i + 1) % 4], b[(i + 1) % 4], b[i], shade(color, faces[i]))
      shapes.quad(b[0], b[1], b[2], b[3], shade(color, 1.1))
      return
    }
    case 'dome': {
      shapes.flat(x0, z0, x1, z1, y, wall)
      const r = Math.min(w, d) * 0.32
      const cx = (x0 + x1) / 2
      const cz = (z0 + z1) / 2
      const rings = 4
      const around = 12
      const at = (ring: number, k: number) => {
        const lat = (ring / rings) * (Math.PI / 2)
        const lon = (k / around) * Math.PI * 2
        return p(cx + Math.cos(lat) * Math.cos(lon) * r, y + Math.sin(lat) * r, cz + Math.cos(lat) * Math.sin(lon) * r)
      }
      for (let ring = 0; ring < rings; ring++)
        for (let k = 0; k < around; k++) {
          const light = 0.6 + 0.35 * Math.max(0, Math.sin((k / around) * Math.PI * 2 + Math.PI / 4))
          shapes.quad(at(ring, k), at(ring, k + 1), at(ring + 1, k + 1), at(ring + 1, k), shade(color, light + ring * 0.05))
        }
      return
    }
    case 'tin': {
      // One sheet sloping down toward the camera, its corrugations in bands.
      const drop = 0.35
      const bands = Math.max(2, Math.round(w * 2))
      for (let i = 0; i < bands; i++) {
        const a = x0 + (w * i) / bands
        const b = x0 + (w * (i + 1)) / bands
        shapes.quad(p(a, y + drop, z0), p(b, y + drop, z0), p(b, y, z1), p(a, y, z1), shade(color, i % 2 ? 0.8 : 0.95))
      }
      shapes.tri(p(x0 + eave, y, z0 + eave), p(x0 + eave, y, z1 - eave), p(x0 + eave, y + drop, z0 + eave), shade(wall, LIGHT.west))
      shapes.tri(p(x1 - eave, y, z0 + eave), p(x1 - eave, y, z1 - eave), p(x1 - eave, y + drop, z0 + eave), shade(wall, LIGHT.east))
    }
  }
}
