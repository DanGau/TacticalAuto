// Attacks and their aftermath on screen: shots, lunges, rockets, sparks, camera shake, and callouts over units.
import { BLAST_RADIUS, type Battle, type Tile } from '../core/battle'
import { distance } from '../core/grid'
import type { GameEvent } from '../core/combat-event'
import { sourceName } from '../core/source-names'
import { srcOf, type Src } from '../core/sources'
import { PACE } from '../core/pace'
import type { Attack } from './attacks'
import { along, lerp } from './camera'
import { blast } from './blast'
import { drawFog } from './marks'
import { drawTerrain } from './board'
import { COLOR, SOURCE } from './palette'
import { Sketch } from './shapes'
import { TILE_W } from './space'
import { place, shift, squash, vitals } from './sprites'
import type { Label, Sprite, Stage } from './stage'

/** Height above the ground that shots leave and land. */
const CHEST = 18
const IMPACT_MS = 140
const CALLOUT_MS = 900
const FINISH_LIFT = 44
const VOLLEY_LIFT = 12
/** How far apart a two-handed shooter's hands are. */
const HANDS = 9

export const chest = (sprite: Sprite): Tile => ({ x: sprite.at.x, y: sprite.at.y - CHEST })

/** Words over a unit saying what just happened to it. */
export function callout(s: Stage, text: string, color: number, over: Sprite, size = 13, lift = 0): Label {
  const at = { x: over.at.x, y: over.at.y - 48 - lift }
  const mark: Label = { text, color, size, at: () => at, rise: 1, outline: 3, alpha: 1 }
  s.labels.add(mark)
  return mark
}

/** A source as a callout tags it: its kind's glyph and its name. */
export const tagText = (s: Stage, src: Src) => `${SOURCE[src.kind].glyph} ${sourceName(src, s.kit()).toUpperCase()}`

/** A callout naming a source in its kind's colour, `after` its name. */
export const sourceCallout = (s: Stage, src: Src, over: Sprite, after = '', size = 13, lift = 0) => callout(s, `${tagText(s, src)}${after}`, SOURCE[src.kind].color, over, size, lift)

/** A shot's result: a hit or crit with its damage. */
export function shotCallout(s: Stage, e: Extract<GameEvent, { type: 'shot' }>, over: Sprite): Label {
  // A combo's second blow reads over the first, and bigger, so both can be counted.
  const lift = e.secondary ? FINISH_LIFT : (e.nth ?? 0) * VOLLEY_LIFT
  if (e.deflect) return callout(s, e.damage > 0 ? `${e.deflect.toUpperCase()} -${e.damage}` : e.deflect.toUpperCase(), COLOR.deflect, over, 16, lift)
  return e.crit ? callout(s, `CRIT -${e.damage}`, COLOR.crit, over, e.secondary ? 22 : 18, lift) : callout(s, `HIT -${e.damage}`, COLOR.hit, over, e.secondary ? 18 : 13, lift)
}

/** What a gear effect did to a unit, in a word: the effect's name, and the health it gave or took. */
export function effectCallout(s: Stage, e: Extract<GameEvent, { type: 'effect' }>, over: Sprite): Label {
  return sourceCallout(s, e.src, over, e.amount === 0 ? '' : ` ${e.amount > 0 ? '+' : ''}${e.amount}`)
}

/** A stunning blow's shockwave spreads over the ground about `at`, as far as `tiles` reach; a trigger's, in its colour. */
export function shockwave(s: Stage, fx: Sketch, at: Tile, tiles: number, color: number = COLOR.hit): Promise<void> {
  const reach = (tiles + 0.5) * TILE_W
  return s.tween(CALLOUT_MS, (t) => {
    const r = reach * (0.4 + 0.6 * Math.sqrt(t))
    fx.clear().ellipse(at.x, at.y, r, r / 2).stroke({ color, width: 5 - 3 * t, alpha: 1 - t * t })
  })
}

/** Stars circle a stunned unit's head. */
export function daze(s: Stage, fx: Sketch, over: Sprite): Promise<void> {
  const head = { x: over.at.x, y: over.at.y - 40 }
  return s.tween(CALLOUT_MS * 1.5, (t) => {
    fx.clear()
    for (let i = 0; i < 3; i++) {
      const a = t * Math.PI * 4 + (i * Math.PI * 2) / 3
      fx.circle(head.x + Math.cos(a) * 14, head.y + Math.sin(a) * 5, 3.5).fill({ color: COLOR.hit, alpha: 1 - t * t })
    }
  })
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
export function shake(s: Stage, power: number, ms = 240): Promise<void> {
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

/** Something hurled, spun by `angle`. */
function drawHurled(fx: Sketch, at: Tile, angle: number, from: Tile, gun: Attack): void {
  const [cos, sin] = [Math.cos(angle), Math.sin(angle)]
  if (gun.shape === 'shield') {
    fx.ellipse(at.x, at.y, gun.width, gun.width * (0.45 + 0.55 * Math.abs(cos))).fill(gun.color).circle(at.x, at.y, gun.width / 3).fill(gun.core)
  } else if (gun.shape === 'hammer') {
    fx.moveTo(at.x - cos * 9, at.y - sin * 9).lineTo(at.x + cos * 7, at.y + sin * 7).stroke({ color: 0x8a6b43, width: 2 })
    fx.moveTo(at.x + cos * 7 - sin * gun.width, at.y + sin * 7 + cos * gun.width).lineTo(at.x + cos * 7 + sin * gun.width, at.y + sin * 7 - cos * gun.width).stroke({ color: gun.color, width: 6 })
  } else {
    // A fist on a jet of flame, knuckles first along its way.
    const len = Math.hypot(at.x - from.x, at.y - from.y) || 1
    const tail = { x: at.x - ((at.x - from.x) / len) * Math.min(len, 22), y: at.y - ((at.y - from.y) / len) * Math.min(len, 22) }
    fx.moveTo(tail.x, tail.y).lineTo(at.x, at.y).stroke({ color: gun.core, width: 4, alpha: 0.8 })
    fx.circle(at.x, at.y, gun.width).fill(gun.color).circle(at.x, at.y, gun.width / 2).fill(0xfff0d0)
  }
}

/** A hurled thing flies home from where it hit. */
function flyHome(s: Stage, fx: Sketch, from: Tile, to: Sprite, gun: Attack): Promise<void> {
  return s.tween(gun.ms, (t) => {
    const home = chest(to)
    const at = lerp(from, home, t)
    at.y -= (gun.arc ?? 0) * Math.sin(Math.PI * t)
    fx.clear()
    drawHurled(fx, at, -t * 4 * Math.PI, from, gun)
  })
}

/** A hero's dash: it shoots along `path` with a streak behind it. */
export function dashTo(s: Stage, fx: Sketch, sprite: Sprite, path: Tile[]): Promise<void> {
  const points = [sprite.tile, ...path]
  const start = chest(sprite)
  return s.tween(PACE.lunge, (t) => {
    place(s, sprite, along(points, t * t))
    squash(sprite, 0.85, 1.15)
    const now = chest(sprite)
    fx.clear().moveTo(lerp(start, now, t * 0.6).x, lerp(start, now, t * 0.6).y).lineTo(now.x, now.y).stroke({ color: 0xffffff, width: 7 * (1 - t) + 2, alpha: 0.65 })
  }).then(() => squash(sprite, 1, 1))
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
      const lift = (gun.arc ?? 0) * Math.sin(Math.PI * local)
      if (gun.style === 'hurled') {
        const at = lerp(a, b, local)
        at.y -= lift
        drawHurled(fx, at, local * 4 * Math.PI, a, gun)
      } else if (gun.style === 'bolt') {
        const head = lerp(a, b, local)
        const tail = lerp(a, b, Math.max(0, local - 0.35))
        const glint = lerp(a, b, Math.max(0, local - 0.12))
        fx.moveTo(tail.x, tail.y).lineTo(head.x, head.y).stroke({ color: gun.color, width: gun.width })
        fx.moveTo(glint.x, glint.y).lineTo(head.x, head.y).stroke({ color: gun.core, width: 1 })
      } else if (gun.style === 'orb') {
        for (let k = 4; k >= 0; k--) {
          const at = lerp(a, b, Math.max(0, local - k * 0.05))
          at.y -= lift
          fx.circle(at.x, at.y, gun.width * 2 * (1 - k * 0.15)).fill({ color: gun.color, alpha: 0.07 * (5 - k) })
        }
        const head = lerp(a, b, local)
        head.y -= lift
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
export async function playShot(s: Stage, fx: Sketch, from: Sprite, to: Sprite, e: Extract<GameEvent, { type: 'shot' }>, after: ReturnType<typeof vitals>, gun: Attack): Promise<void> {
  const { crit } = e
  const nth = e.nth ?? 0
  const muzzle = chest(from)
  const a = gun.hands ? { x: muzzle.x + (nth % 2 === 0 ? -HANDS : HANDS), y: muzzle.y } : muzzle
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
  if (e.secondary) float(s, sourceCallout(s, { kind: 'class', id: e.secondary }, from, '', 15, FINISH_LIFT))
  if (e.with.length > 0 && !nth) float(s, callout(s, e.with.map((effect) => tagText(s, srcOf(effect))).join(' · '), SOURCE[e.src.kind].color, from))
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
  const settle = () => {
    place(s, to, to.tile)
    squash(to, 1, 1)
    fx.clear()
  }
  // A deflected blow throws a bright spray back at the attacker.
  const sparks = (sketch: Sketch) => (e.deflect ? burst(s, sketch, mark, { x: -dir.x, y: -dir.y }, COLOR.deflect, 14, 1.4) : burst(s, sketch, mark, dir, crit ? COLOR.crit : gun.color, gun.sparks * power, e.secondary ? power * 1.6 : power))
  // A shot of a rapid attack does not wait on its sparks: the next is already coming.
  if (e.lasts && e.lasts < PACE.attack) void drawing(s, sparks).then(settle)
  else {
    await sparks(fx)
    settle()
  }
  if (gun.back) await flyHome(s, fx, mark, from, gun)
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
    float(s, sourceCallout(s, e.src, sprite, ` -${hit.damage}`))
  }
  const caught = e.hits.flatMap((hit) => s.sprites.get(hit.target) ?? [])
  blast(s, e, Math.max(BLAST_RADIUS, ...caught.map((c) => distance(c.tile, e))), color, caught)
  await s.tween(PACE.blast, (t) => {
    fx.clear().circle(b.x, b.y, 4 + 18 * Math.sqrt(t)).fill({ color: 0xffffff, alpha: 0.9 * (1 - t) ** 2 })
  })
  fx.clear()
}
