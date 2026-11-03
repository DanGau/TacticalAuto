// A jump on screen, read without words: a crouch, a stretched lift-off in a puff of dust, the shadow left on the
// ground below, a hang at the peak, and a squashed landing in a ring of dust, a heavy one jolting the camera.
import type { SpriteMaterial } from 'three'
import { DECAL_LIFT, picture, type Stride } from './camera'
import { drawing, shake } from './effects'
import { squash } from './sprites'
import type { Sprite, Stage } from './stage'
import type { Point3 } from './shapes'

/** How deep a crouch or a landing squashes, how far lift-off stretches, and how long a landing settles, in ms. */
const CROUCH = 0.22
const STRETCH = 0.25
const LAND = 0.3
const LAND_MS = 220
/** How long the crouch before a jump that starts a walk holds, in ms. */
export const CROUCH_MS = 150
/** The share of a stride before a jump that the crouch takes. */
export const WIND_UP = 0.35
/** How much the shadow shrinks and fades a level up, and the least it keeps. */
const SHRINK = 0.15
const SHADOW_MIN = 0.45
/** How long dust spreads, in ms; and the strength from which a landing jolts the camera. */
const DUST_MS = 380
const HEAVY = 4
/** Drawn after the ground and its fog, which would hide a jumper clearing a cliff. */
const AIRBORNE = 999

/** A crouch `k` deep, 0 standing to 1 deepest, before a jump. */
export const crouch = (sprite: Sprite, k: number) => squash(sprite, 1 + CROUCH * k, 1 - CROUCH * k)

/** Poses a sprite at `at`, its shadow on the ground under it; mid-jump it stretches rising and falling, deepest at lift-off and touch-down. `ahead` is how near a jump is coming, 0 none to 1 at lift-off. */
export function pose(sprite: Sprite, at: Stride, ahead: number): void {
  const { feet, ground, leap } = at
  sprite.node.position.set(feet.x, feet.y, feet.z)
  const up = feet.y - ground.y
  sprite.shadow.position.y = DECAL_LIFT * 2 - up
  const keep = Math.max(SHADOW_MIN, 1 - SHRINK * up * 4)
  sprite.shadow.scale.setScalar(sprite.scale * keep)
  // In the air it shows over the cliff it clears, as it would against the sky.
  ;(sprite.body.material as SpriteMaterial).depthTest = !leap
  sprite.body.renderOrder = leap ? AIRBORNE : 0
  if (!leap) return crouch(sprite, ahead)
  const k = STRETCH * Math.abs(Math.cos(Math.PI * leap.f))
  squash(sprite, 1 - k / 2, 1 + k)
}

/** Grounds a sprite's shadow under its feet again. */
export function ground(sprite: Sprite): void {
  ;(sprite.body.material as SpriteMaterial).depthTest = true
  sprite.body.renderOrder = 0
  sprite.shadow.position.y = DECAL_LIFT * 2
  sprite.shadow.scale.setScalar(sprite.scale)
}

/** How near a jump is, 0 none to 1 at lift-off, from where the walker is and where it will be a crouch's share of a stride on. */
export const nearing = (now: Stride, soon: Stride) => (!now.leap && soon.leap ? Math.min(1, soon.leap.f / WIND_UP) : 0)

/** Dust kicked up at `at`: a few puffs on lift-off, a wider ring on landing, sized to the jumper. */
export function dust(s: Stage, at: Point3, size: number, landing: boolean): Promise<void> {
  const c = picture(at, s.camera.yaw)
  const reach = (landing ? 34 : 22) * size
  const puffs = landing ? 10 : 6
  return drawing(s, (fx) =>
    s.tween(DUST_MS, (t) => {
      fx.clear()
      const out = 1 - (1 - t) ** 2
      for (let i = 0; i < puffs; i++) {
        const a = (i / puffs) * 2 * Math.PI + (landing ? 0 : Math.PI / puffs)
        fx.circle(c.x + Math.cos(a) * reach * out, c.y + (Math.sin(a) * reach * out) / 2 - 6 * t, (3 + 5 * t) * size).fill({ color: 0xd8d0c0, alpha: 0.6 * (1 - t) })
      }
    }),
  )
}

/** A landing: a squash springing back, dust, and for the strong a jolt of the camera. */
export function land(s: Stage, sprite: Sprite, at: Point3, strength: number): void {
  ground(sprite)
  void dust(s, at, sprite.scale, true)
  if (strength >= HEAVY) void shake(s, 2 * (strength - HEAVY + 1), 200)
  void s.tween(LAND_MS, (t) => {
    const k = LAND * (1 - t) * Math.cos(t * Math.PI * 1.5)
    squash(sprite, 1 + k, 1 - k)
  })
}
