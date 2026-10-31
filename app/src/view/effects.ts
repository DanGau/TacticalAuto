// Attacks and their aftermath on screen: shots, lunges, rockets, sparks, camera shake, and callouts over units.
import { BLAST_RADIUS, type Battle, type Tile } from '../core/battle'
import type { GameEvent } from '../core/combat-event'
import { effectName } from '../core/effects'
import { PACE } from '../core/pace'
import type { Attack } from './attacks'
import { lerp } from './camera'
import { drawFog } from './marks'
import { drawTerrain } from './board'
import { COLOR } from './palette'
import { Sketch } from './shapes'
import { TILE_H, TILE_W } from './space'
import { place, shift, squash, vitals } from './sprites'
import type { Label, Sprite, Stage } from './stage'

/** Height above the ground that shots leave and land. */
const CHEST = 18
const IMPACT_MS = 140
const CALLOUT_MS = 900

export const chest = (sprite: Sprite): Tile => ({ x: sprite.at.x, y: sprite.at.y - CHEST })

/** Words over a unit saying what just happened to it. */
export function callout(s: Stage, text: string, color: number, over: Sprite, size = 13): Label {
  const at = { x: over.at.x, y: over.at.y - 48 }
  const mark: Label = { text, color, size, at: () => at, rise: 1, outline: 3, alpha: 1 }
  s.labels.add(mark)
  return mark
}

/** A shot's result: a hit or crit with its damage. */
export function shotCallout(s: Stage, e: Extract<GameEvent, { type: 'shot' }>, over: Sprite): Label {
  return e.crit ? callout(s, `CRIT -${e.damage}`, COLOR.crit, over, 18) : callout(s, `HIT -${e.damage}`, COLOR.hit, over)
}

/** What a gear effect did to a unit, in a word: the effect's name, and the health it gave or took. */
export function effectCallout(s: Stage, e: Extract<GameEvent, { type: 'effect' }>, over: Sprite): Label {
  const word = effectName(e.effect, s.kit()).toUpperCase()
  return callout(s, e.amount === 0 ? word : `${word} ${e.amount > 0 ? '+' : ''}${e.amount}`, e.amount > 0 ? COLOR.heal : e.amount < 0 ? COLOR.crit : COLOR.hit, over)
}

/** Floats a callout up and away. It does not hold up the next beat. */
export function float(s: Stage, mark: Label): void {
  const from = mark.at() as Tile
  void s.tween(CALLOUT_MS, (t) => {
    const at = { x: from.x, y: from.y - 34 * t }
    mark.at = () => at
    mark.alpha = Math.min(1, 3 * (1 - t))
  }).then(() => s.labels.delete(mark))
}

/** Runs `play` with a sketch of its own drawn over the scene, removed once it is done. */
export async function drawing(s: Stage, play: (sketch: Sketch) => Promise<void>): Promise<void> {
  const sketch = new Sketch()
  s.drops.add(sketch)
  await play(sketch)
  s.drops.delete(sketch)
}

/** Jolts the camera, fading out over `ms`. */
function shake(s: Stage, power: number, ms = 240): Promise<void> {
  if (power === 0) return Promise.resolve()
  return s.tween(ms, (t) => {
    s.jolt.x = (Math.random() * 2 - 1) * power * (1 - t)
    s.jolt.y = (Math.random() * 2 - 1) * power * (1 - t)
    s.look(s.camera)
  }).then(() => {
    s.jolt.x = s.jolt.y = 0
    s.look(s.camera)
  })
}

/** Projectiles fly from the muzzle at `a` to each of `ends`. */
function fire(s: Stage, fx: Sketch, a: Tile, ends: Tile[], gun: Attack): Promise<void> {
  const total = gun.ms + gun.stagger * (ends.length - 1)
  return s.tween(total, (t) => {
    fx.clear()
    ends.forEach((b, i) => {
      const local = Math.min(1, Math.max(0, (t * total - i * gun.stagger) / gun.ms))
      if (local === 0) return
      // The muzzle flash: a burst at the barrel that dies as the round leaves.
      if (local < 0.3) fx.circle(a.x, a.y, gun.flash * (1 - local / 0.3)).fill({ color: gun.core, alpha: 0.9 })
      if (gun.style === 'bolt') {
        const head = lerp(a, b, local)
        const tail = lerp(a, b, Math.max(0, local - 0.35))
        const glint = lerp(a, b, Math.max(0, local - 0.12))
        fx.moveTo(tail.x, tail.y).lineTo(head.x, head.y).stroke({ color: gun.color, width: gun.width })
        fx.moveTo(glint.x, glint.y).lineTo(head.x, head.y).stroke({ color: gun.core, width: 1 })
      } else if (gun.style === 'orb') {
        for (let k = 4; k >= 0; k--) {
          const at = lerp(a, b, Math.max(0, local - k * 0.05))
          fx.circle(at.x, at.y, gun.width * 2 * (1 - k * 0.15)).fill({ color: gun.color, alpha: 0.07 * (5 - k) })
        }
        const head = lerp(a, b, local)
        fx.circle(head.x, head.y, gun.width).fill(gun.color).circle(head.x, head.y, gun.width / 2).fill(gun.core)
      } else {
        // A beam charges at the muzzle, then fires all at once and thins away.
        const charge = 0.4
        if (local < charge) fx.circle(a.x, a.y, (gun.flash * local) / charge).fill({ color: gun.color, alpha: 0.5 }).circle(a.x, a.y, (gun.flash * local) / charge / 2).fill(gun.core)
        else {
          const fade = 1 - (local - charge) / (1 - charge)
          fx.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({ color: gun.color, width: gun.width * 2 * fade, alpha: 0.4 })
          fx.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({ color: gun.core, width: Math.max(1, gun.width * fade) })
        }
      }
    })
  })
}

/** The attacker winds back, lunges in, rakes the target with a slash per bolt, and steps back. */
async function strike(s: Stage, fx: Sketch, from: Sprite, to: Sprite, gun: Attack, ends: Tile[]): Promise<void> {
  const home = s.toWorld(from.tile.x, from.tile.y)
  const dx = to.at.x - home.x
  const dy = to.at.y - home.y
  const len = Math.hypot(dx, dy) || 1
  const reach = Math.min(len * 0.55, 40)
  const nudge = (d: number) => shift(s, from, { x: home.x + (dx / len) * d, y: home.y + (dy / len) * d })
  await s.tween(gun.ms, (t) => nudge(-gun.flash * t))
  await s.tween(gun.ms * 0.6, (t) => nudge(-gun.flash + (reach + gun.flash) * t * t))
  await s.tween(gun.ms * 1.5, (t) => {
    fx.clear()
    ends.forEach((b, i) => {
      const local = Math.min(1, Math.max(0, t * ends.length - i * 0.6))
      if (local === 0) return
      const lean = (i - (ends.length - 1) / 2) * 7
      const start = { x: b.x - 14 + lean, y: b.y - 14 }
      const head = lerp(start, { x: b.x + 14 + lean, y: b.y + 12 }, Math.min(1, local * 1.6))
      fx.moveTo(start.x, start.y).lineTo(head.x, head.y).stroke({ color: gun.color, width: gun.width * (1 - local * 0.6), alpha: 1 - local * 0.5 })
    })
  })
  void s.tween(gun.ms * 2, (t) => nudge(reach * (1 - t)))
}

/** Sparks fly off the impact point, onward from the shot, and a ring spreads. */
function burst(s: Stage, fx: Sketch, at: Tile, dir: Tile, color: number, count: number, size: number): Promise<void> {
  const sparks = Array.from({ length: count }, () => {
    const angle = Math.atan2(dir.y, dir.x) + (Math.random() - 0.5) * 2.2
    const speed = (20 + Math.random() * 30) * size
    return { vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 10 }
  })
  return s.tween(IMPACT_MS * 1.6, (t) => {
    fx.clear().circle(at.x, at.y, (4 + 14 * size) * t).stroke({ color, width: 3 * (1 - t), alpha: 1 - t })
    for (const spark of sparks) fx.circle(at.x + spark.vx * t, at.y + spark.vy * t + 30 * t * t, 2 * (1 - t) + 0.5).fill({ color, alpha: 1 - t })
  })
}

/**
 * A shot plays as its weapon: the projectile or lunge, then on a hit a freeze on the blow with the target squashed and
 * flashing, a camera jolt, a knockback and sparks, all harder on a crit.
 */
export async function playShot(s: Stage, fx: Sketch, from: Sprite, to: Sprite, e: Extract<GameEvent, { type: 'shot' }>, after: [number, number], gun: Attack): Promise<void> {
  const { crit } = e
  const a = chest(from)
  const mark = chest(to)
  const len = Math.hypot(mark.x - a.x, mark.y - a.y) || 1
  const dir = { x: (mark.x - a.x) / len, y: (mark.y - a.y) / len }
  const ends = Array.from({ length: gun.bolts }, (_, i) => {
    const off = gun.bolts === 1 ? 0 : (i / (gun.bolts - 1) - 0.5) * gun.spread + (Math.random() - 0.5) * gun.spread * 0.3
    return { x: mark.x - dir.y * off, y: mark.y + dir.x * off }
  })
  if (gun.style === 'strike') await strike(s, fx, from, to, gun, ends)
  else await fire(s, fx, a, ends, gun)
  fx.clear()
  float(s, shotCallout(s, e, to))
  // What of the shooter's shaped the shot, named over the shooter.
  if (e.with.length > 0) float(s, callout(s, e.with.map((effect) => effectName(effect, s.kit()).toUpperCase()).join(' · '), 0xffffff, from))
  to.drawHp(...after)
  const power = crit ? 2 : 1
  const home = s.toWorld(to.tile.x, to.tile.y)
  squash(to, 1.2, 0.8)
  await s.tween(gun.hitstop * power, () => {
    fx.clear().circle(mark.x, mark.y, 10 * power).fill({ color: 0xffffff, alpha: 0.9 })
  })
  void shake(s, gun.shake * power)
  const kick = gun.kick * power
  void s.tween(IMPACT_MS * 1.6, (t) => {
    const push = kick * Math.sin(Math.PI * Math.min(1, t * 1.4)) * (1 - t)
    shift(s, to, { x: home.x + dir.x * push, y: home.y + dir.y * push })
    squash(to, 1.2 - 0.2 * t, 0.8 + 0.2 * t)
  })
  await burst(s, fx, mark, dir, crit ? COLOR.crit : gun.color, gun.sparks * power, power)
  place(s, to, to.tile)
  squash(to, 1, 1)
  fx.clear()
}

/** A rocket, or napalm in flame's colour, flies from `from` to its tile and bursts, wounding every unit it caught. With no `from`, something burst where it stood. */
export async function fireRocket(s: Stage, fx: Sketch, battle: Battle, from: Sprite | undefined, e: Extract<GameEvent, { type: 'rocket' }>): Promise<void> {
  const b = s.toWorld(e.x, e.y)
  const color = e.fire ? COLOR.fire : COLOR.crit
  if (from) {
    const a = chest(from)
    await s.tween(PACE.rocket, (t) => {
      const at = lerp(a, b, t)
      fx.clear().circle(at.x, at.y, 5).fill(color)
    })
  }
  // The blast has already wrecked the terrain in the battle; show it as the rocket lands.
  drawTerrain(s, battle)
  drawFog(s, battle)
  for (const hit of e.hits) {
    const sprite = s.sprites.get(hit.target)
    if (!sprite) continue
    sprite.drawHp(...vitals(battle, hit.target))
    float(s, callout(s, `${e.fire ? 'NAPALM' : 'ROCKET'} -${hit.damage}`, color, sprite))
  }
  await s.tween(PACE.blast, (t) => {
    fx.clear().ellipse(b.x, b.y, (BLAST_RADIUS + 0.7) * TILE_W * t, (BLAST_RADIUS + 0.7) * TILE_H * t).fill({ color, alpha: 0.8 * (1 - t) })
  })
  fx.clear()
}
