// The burst where a unit lost over the edge goes, in the world below the lip: a hot core, a glow in its team's colour, a
// shaft of light rising past the lip, embers and a wisp of smoke. Terrain in front hides it; what clears the lip shows.
import { AdditiveBlending, Color, DataTexture, Group, NormalBlending, Sprite, SpriteMaterial, type Blending } from 'three'
import type { Point3 } from './shapes'
import { LEVEL } from './space'

/** How long the burst lasts. */
export const KO_MS = 520

/** Embers thrown up, and puffs of smoke left behind. */
const EMBERS = 12
const PUFFS = 4

/** A soft round falloff, white, its alpha easing to nothing at the rim. */
const SOFT = (() => {
  const n = 32
  const data = new Uint8Array(n * n * 4)
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const r = Math.min(1, Math.hypot(x - n / 2 + 0.5, y - n / 2 + 0.5) / (n / 2))
      data.set([255, 255, 255, Math.round(255 * (1 - r) ** 2)], (y * n + x) * 4)
    }
  const texture = new DataTexture(data, n, n)
  texture.needsUpdate = true
  return texture
})()

const out = (t: number, p = 3) => 1 - (1 - Math.min(1, Math.max(0, t))) ** p

type Part = { sprite: Sprite; frame: (t: number) => void }

function part(color: Color | number, blending: Blending): Sprite {
  // Depth-tested against the terrain, never written: the cliff in front hides it, and the layers blend over one another.
  return new Sprite(new SpriteMaterial({ map: SOFT, color, blending, transparent: true, depthTest: true, depthWrite: false, fog: false }))
}

/** A burst at `at` in `color`, `depth` levels below the lip, and how it plays: `frame(t)` for t from 0 to 1. Dispose of it with `scrap`. */
export function burst(at: Point3, color: number, depth: number, seed = Math.random): { node: Group; frame: (t: number) => void } {
  const node = new Group()
  node.position.set(at.x, at.y, at.z)
  const tint = new Color(color)
  const hot = tint.clone().lerp(new Color(0xffffff), 0.6)
  const parts: Part[] = []
  const add = (sprite: Sprite, frame: (t: number) => void) => {
    node.add(sprite)
    parts.push({ sprite, frame })
  }
  const core = part(0xffffff, AdditiveBlending)
  add(core, (t) => {
    core.scale.setScalar(0.25 + 0.55 * out(t / 0.18))
    core.material.opacity = 1 - out(t / 0.3, 2)
  })
  const glow = part(tint, AdditiveBlending)
  add(glow, (t) => {
    glow.scale.setScalar(1 + 2.4 * out(t, 2))
    glow.material.opacity = 0.9 * (1 - t) ** 2
  })
  // The shaft reaches up past the lip, and light spills over it, so a burst hidden below still reads.
  const shaft = part(hot, AdditiveBlending)
  add(shaft, (t) => {
    const h = LEVEL * (depth + 4) * out(t / 0.45)
    shaft.scale.set(0.7 * (1 - 0.5 * t), h, 1)
    shaft.position.y = h / 2
    shaft.material.opacity = 1 - out(t, 1.5)
  })
  const spill = part(hot, AdditiveBlending)
  add(spill, (t) => {
    spill.position.y = LEVEL * (depth + 0.5)
    spill.scale.set(2.8 * out(t / 0.4, 2), 1.4 * out(t / 0.4, 2), 1)
    spill.material.opacity = (1 - t) ** 1.5
  })
  for (let i = 0; i < EMBERS; i++) {
    const a = seed() * Math.PI * 2
    const spread = 0.4 + seed() * 0.6
    const lift = LEVEL * (depth + 2 + seed() * 5)
    const life = 0.55 + seed() * 0.45
    const ember = part(i % 3 ? hot : 0xffffff, AdditiveBlending)
    add(ember, (t) => {
      const u = Math.min(1, t / life)
      const rise = lift * out(u, 2) - LEVEL * 2 * u * u
      ember.position.set(Math.cos(a) * spread * out(u, 2), rise, Math.sin(a) * spread * out(u, 2))
      ember.scale.setScalar(0.16 * (1 - u) + 0.04)
      ember.material.opacity = u < 1 ? 1 - u * u : 0
    })
  }
  for (let i = 0; i < PUFFS; i++) {
    const dx = (seed() - 0.5) * 0.5
    const dz = (seed() - 0.5) * 0.5
    const puff = part(0x2a2a30, NormalBlending)
    add(puff, (t) => {
      const u = Math.max(0, (t - 0.15) / 0.85)
      puff.position.set(dx, LEVEL * (1 + 4 * out(u, 2) + i), dz)
      puff.scale.setScalar(0.4 + 0.7 * out(u, 2))
      puff.material.opacity = 0.35 * Math.sin(Math.PI * u)
    })
  }
  const frame = (t: number) => parts.forEach((p) => p.frame(t))
  frame(0)
  return { node, frame }
}

/** Frees a burst's materials; the shared texture stays. */
export function scrap(node: Group): void {
  node.removeFromParent()
  for (const child of node.children) (child as Sprite).material.dispose()
}
