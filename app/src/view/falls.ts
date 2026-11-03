// Falls and throws on screen: a unit going off a ledge or over the edge, and a car or an alien flying in an arc.
import { Mesh, MeshBasicMaterial, BoxGeometry } from 'three'
import { type Battle } from '../core/battle'
import type { GameEvent } from '../core/combat-event'
import { distance } from '../core/grid'
import { PACE } from '../core/pace'
import { drawTerrain } from './board'
import { spot } from './camera'
import { callout, float, shake } from './effects'
import { crouch, dust, land } from './leaps'
import { drawFog } from './marks'
import { COLOR } from './palette'
import { fade, place, remove, vitals } from './sprites'
import { LEVEL, tall } from './space'
import { CAMERA_MS, type Stage } from './stage'

/** How far a unit over the edge is seen to fall before it is gone, in screen pixels seen from the still camera. */
const LONG_FALL = 420

/** How high a throw arcs, in levels. */
const ARC = 3

/** A unit drops off a ledge, or goes over the edge, and lands with a jolt and its damage. */
export async function playFall(s: Stage, battle: Battle, e: Extract<GameEvent, { type: 'fall' }>): Promise<void> {
  const sprite = s.sprites.get(e.id)
  if (!sprite) return
  const a = spot(sprite.tile.x, sprite.tile.y)
  const over = e.drop === 'edge'
  const lost = over && !!e.fatal
  const b = over ? { ...spot(e.to.x, e.to.y), y: a.y } : spot(e.to.x, e.to.y)
  const sink = lost ? tall(LONG_FALL) : 0
  float(s, callout(s, over ? 'OVER THE EDGE' : 'FALL', COLOR.crit, sprite, 15))
  // The camera takes in the fall with the squad, so a fall at the edge of the frame is not missed.
  void s.follow([...battle.units.filter((u) => u.side === 'human' && !u.civilian), e.to], CAMERA_MS)
  await s.tween(PACE.fall, (t) => {
    // Out over the lip, then down as if dropped.
    const out = Math.min(1, t * 2)
    const down = t * t
    sprite.node.position.set(a.x + (b.x - a.x) * out, a.y + (b.y - a.y) * down - sink * down + LEVEL * 0.6 * Math.sin(Math.PI * Math.min(1, t * 1.6)), a.z + (b.z - a.z) * out)
    if (lost) fade(sprite, 1 - down)
  })
  if (lost) return remove(s, e.id)
  // One that catches the edge climbs back up where it was.
  place(s, sprite, over ? sprite.tile : e.to)
  void shake(s, 4 + Math.min(6, 2 * (typeof e.drop === 'number' ? e.drop : 3)))
  sprite.drawHp(...vitals(battle, e.id))
  float(s, callout(s, `${over ? 'CAUGHT THE EDGE' : 'IMPACT'} -${e.damage}`, COLOR.crit, sprite))
  const under = e.onto !== undefined ? s.sprites.get(e.onto) : undefined
  if (under) {
    under.drawHp(...vitals(battle, e.onto!))
    float(s, callout(s, `LANDED ON -${e.damage}`, COLOR.crit, under))
  }
}

/** What each thrown object looks like in the air: its size in tiles, its colour, and how hard it shakes the camera landing. */
const THROWN: Record<string, { w: number; h: number; d: number; color: number; jolt: number }> = {
  car: { w: 0.9, h: 0.35, d: 0.6, color: 0x9a3b34, jolt: 8 },
  truck: { w: 1, h: 0.7, d: 0.8, color: 0x7d8794, jolt: 11 },
  tree: { w: 0.4, h: 1.2, d: 0.4, color: 0x4f7a3a, jolt: 7 },
  wreck: { w: 0.85, h: 0.3, d: 0.6, color: 0x3a3530, jolt: 8 },
}
const CRATE = { w: 0.6, h: 0.45, d: 0.6, color: 0x9a7742, jolt: 5 }
const ALIEN_JOLT = 5

/** How high over the thrower's feet, in levels, a thing is held before it flies. */
const OVERHEAD = 1.6

/**
 * A hero throws an object or an alien: crouches and lifts it overhead, holds it a beat, lets fly in an arc that takes
 * longer the farther it goes, and it lands with a jolt by its weight in a ring of dust; each alien it strikes shows its damage.
 */
export async function playThrow(s: Stage, battle: Battle, e: Extract<GameEvent, { type: 'throw' }>): Promise<void> {
  const thrower = s.sprites.get(e.id)
  const a = spot(e.from.x, e.from.y)
  const b = spot(e.to.x, e.to.y)
  const feet = thrower ? spot(thrower.tile.x, thrower.tile.y) : a
  const top = { x: feet.x, y: feet.y + LEVEL * OVERHEAD, z: feet.z }
  const held = e.thrown !== undefined ? s.sprites.get(e.thrown) : undefined
  void s.follow([...battle.units.filter((u) => u.side === 'human' && !u.civilian), e.from, e.to], CAMERA_MS)
  if (thrower) float(s, callout(s, e.object === 'alien' ? 'THROW' : `THROWS A ${e.object === 'wreck' ? 'WRECK' : e.object.toUpperCase()}`, 0xffffff, thrower, 15))
  const look = e.object === 'alien' ? undefined : (THROWN[e.object] ?? CRATE)
  let mesh: Mesh | null = null
  if (look) {
    // The object leaves the ground it stood on as it is lifted.
    drawTerrain(s, battle)
    mesh = new Mesh(new BoxGeometry(look.w, tall(look.h * 28), look.d), new MeshBasicMaterial({ color: look.color }))
    s.scene.add(mesh)
  }
  const put = (x: number, y: number, z: number, spin: number) => {
    if (mesh) {
      mesh.position.set(x, y + 0.2, z)
      mesh.rotation.set(spin * 5, spin * 3, 0)
    } else held?.node.position.set(x, y, z)
  }
  // The lift: the thrower sinks under the weight and rises with it overhead.
  await s.tween(PACE.lift, (t) => {
    const up = t * t * (3 - 2 * t)
    put(a.x + (top.x - a.x) * up, a.y + (top.y - a.y) * up, a.z + (top.z - a.z) * up, 0)
    if (thrower) crouch(thrower, Math.sin(Math.PI * t))
  })
  // The beat before letting go: drawn back, straining.
  await s.tween(PACE.hold, (t) => {
    put(top.x, top.y + LEVEL * 0.15 * Math.sin((Math.PI / 2) * t), top.z, 0)
    if (thrower) crouch(thrower, -0.6 * Math.sin((Math.PI / 2) * t))
  })
  const tiles = distance(e.from, e.to)
  const arc = LEVEL * (ARC + tiles * 0.3)
  await s.tween(PACE.flight + PACE.flightTile * tiles, (t) => {
    if (thrower) crouch(thrower, -0.6 * (1 - t))
    put(top.x + (b.x - top.x) * t, top.y + (b.y - top.y) * t + arc * 4 * t * (1 - t), top.z + (b.z - top.z) * t, t)
  })
  if (mesh) {
    s.scene.remove(mesh)
    mesh.geometry.dispose()
  }
  void shake(s, look?.jolt ?? ALIEN_JOLT)
  void dust(s, b, look ? Math.max(look.w, look.d) * 1.4 : 1, true)
  drawTerrain(s, battle)
  drawFog(s, battle)
  if (held) {
    place(s, held, e.to)
    land(s, held, b, ALIEN_JOLT)
  }
  for (const hit of e.hits) {
    const sprite = s.sprites.get(hit.target)
    if (!sprite || hit.damage === 0) continue
    sprite.drawHp(...vitals(battle, hit.target))
    float(s, callout(s, `SMASH -${hit.damage}`, COLOR.crit, sprite))
  }
  await s.tween(PACE.impact, () => {})
}
