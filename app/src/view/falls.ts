// Falls on screen: a unit going off a ledge or over the edge.
import { type Battle } from '../core/battle'
import type { GameEvent } from '../core/combat-event'
import { PACE } from '../core/pace'
import { spot } from './camera'
import { callout, float, shake } from './effects'
import { COLOR } from './palette'
import { fade, place, remove, vitals } from './sprites'
import { LEVEL, tall } from './space'
import type { Stage } from './stage'

/** How far a unit over the edge is seen to fall before it is gone, in screen pixels seen from the still camera. */
const LONG_FALL = 420

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
