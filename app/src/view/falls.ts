// Falls on screen: a unit going off a ledge or over the edge.
import { type Battle } from '../core/battle'
import type { GameEvent } from '../core/combat-event'
import { PACE } from '../core/pace'
import { ballistic } from './ballistic'
import { spot } from './camera'
import { callout, float, shake } from './effects'
import { burst, KO_MS, scrap } from './ko'
import { COLOR } from './palette'
import { fade, place, remove, vitals } from './sprites'
import type { Point3 } from './shapes'
import { LEVEL } from './space'
import { CAMERA_MS, type Sprite, type Stage } from './stage'

/** How far below the lip a unit lost over the edge falls before it is gone in a burst, in levels. */
const SINK = 7

/** A unit drops off a ledge, or goes over the edge, and lands with a jolt and its damage. */
export async function playFall(s: Stage, battle: Battle, e: Extract<GameEvent, { type: 'fall' }>): Promise<void> {
  const sprite = s.sprites.get(e.id)
  if (!sprite) return
  const a = spot(sprite.tile.x, sprite.tile.y)
  const over = e.drop === 'edge'
  const lost = over && !!e.fatal
  const b = over ? { ...spot(e.to.x, e.to.y), y: a.y } : spot(e.to.x, e.to.y)
  // The camera takes in the fall with the team, so a fall at the edge of the frame is not missed.
  void s.follow([...battle.units.filter((u) => u.side === 'human' && !u.civilian), e.to], CAMERA_MS)
  if (lost) return fallOff(s, e.id, sprite, ballistic(a, b, LEVEL * 0.6, LEVEL * SINK, PACE.fall / 2))
  float(s, callout(s, over ? 'OVER THE EDGE' : 'FALL', COLOR.crit, sprite, 15))
  await s.tween(PACE.fall, (t) => {
    // Out over the lip, then down as if dropped.
    const out = Math.min(1, t * 2)
    const down = t * t
    sprite.node.position.set(a.x + (b.x - a.x) * out, a.y + (b.y - a.y) * down + LEVEL * 0.6 * Math.sin(Math.PI * Math.min(1, t * 1.6)), a.z + (b.z - a.z) * out)
  })
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

/** A unit lost over the edge flies `flight` in one arc, fading as it drops out of sight, and is gone in a burst. */
async function fallOff(s: Stage, id: number, sprite: Sprite, flight: ReturnType<typeof ballistic>): Promise<void> {
  await s.tween(flight.ms, (t) => {
    const p = flight.at(t * flight.ms)
    sprite.node.position.set(p.x, p.y, p.z)
    fade(sprite, Math.min(1, 4 * (1 - t)))
  })
  remove(s, id)
  await knockedOut(s, flight.at(flight.ms), sprite.ally ? COLOR.allyHp : COLOR.crit)
}

/** The burst where a unit lost over the edge goes, in the world below the lip, and a slight jolt. */
function knockedOut(s: Stage, at: Point3, color: number): Promise<void> {
  const { node, frame } = burst(at, color, SINK)
  s.scene.add(node)
  void shake(s, 2, 160)
  return s.tween(KO_MS, frame).then(() => scrap(node))
}
