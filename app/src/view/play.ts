// Plays a beat's events on screen, in order: walks, sightings, shots, and what each did.
import type { Object3D } from 'three'
import { revealed, type Battle, type Order, type Tile } from '../core/battle'
import type { GameEvent } from '../core/combat-event'
import { CONSUMABLES } from '../core/consumables'
import { effectName } from '../core/effects'
import { instant, PACE, tilePace, walkMs } from '../core/pace'
import { attackOf } from './attacks'
import { drawTerrain } from './board'
import { along, lerp, spot } from './camera'
import { callout, chest, drawing, effectCallout, fireRocket, float, playShot } from './effects'
import { drawAcid, drawFog, drawMarks } from './marks'
import { COLOR } from './palette'
import { cloakLook, create, fade, letter, place, remove, squash, vitals } from './sprites'
import { CAMERA_MS, type Sprite, type Stage } from './stage'

/** What a soldier's order says over it. */
const ORDERS: Record<Order, string> = { hunker: '🛡 HUNKER DOWN', prepare: '👁 OVERWATCH', sprint: '» SPRINT' }

/** Where the squad stands: the camera keeps to it, and never leaves it for action elsewhere. */
export const squad = (battle: Battle): Tile[] => battle.units.filter((u) => u.side === 'human' && !u.civilian)

/** How far along a walk a unit is at time `t`: it gathers speed, carries it, and slows to a stop. */
const momentum = (t: number) => t * t * t * (t * (6 * t - 15) + 10)

/** How much a unit stretches into its stride at full speed, and squashes as its weight lands, and for how long, in ms. */
const LEAN = 0.07
const SETTLE = 0.1
const SETTLE_MS = 160

async function walk(s: Stage, sprite: Sprite, path: Tile[], ms: number): Promise<void> {
  const points = [sprite.tile, ...path]
  await s.tween(ms, (t) => {
    place(s, sprite, along(points, momentum(t)))
    const lean = LEAN * Math.sin(Math.PI * t)
    squash(sprite, 1 - lean, 1 + lean)
  })
  // The weight lands after the walk, while whatever comes next begins.
  void s.tween(SETTLE_MS, (t) => squash(sprite, 1 + SETTLE * (1 - t), 1 - SETTLE * (1 - t)))
}

/** Slides an unfound alien's glow along its path through the fog. */
function glide(s: Stage, glow: { node: Object3D; tile: Tile }, path: Tile[], ms: number): Promise<void> {
  const points = [glow.tile, ...path]
  glow.tile = path.at(-1)!
  return s.tween(ms, (t) => {
    const at = along(points, momentum(t))
    const p = spot(at.x, at.y)
    glow.node.position.set(p.x, p.y, p.z)
  })
}

/** Plays a beat in order. Moves in a row play together; moves by unseen aliens are skipped. */
export async function play(s: Stage, battle: Battle, events: GameEvent[]): Promise<void> {
  const { sprites, glows } = s
  for (let i = 0; i < events.length; i++) {
    const e = events[i]
    if (e.type === 'move') {
      // Moves in a row, and the instant events among them, play as one: everyone walks together, then the words show.
      const group: GameEvent[] = []
      for (; events[i] && (events[i].type === 'move' || instant(events[i])); i++) group.push(events[i])
      i--
      // Each walks the whole way it went, from where it stood.
      const paths = new Map<number, Tile[]>()
      for (const m of group) if (m.type === 'move' && (sprites.has(m.id) || glows.has(m.id))) paths.set(m.id, [...(paths.get(m.id) ?? []), ...m.path])
      const pace = (id: number) => tilePace(!!sprites.get(id)?.ally)
      const ms = walkMs([...paths].map(([id, path]) => ({ path, pace: pace(id) })))
      const walks = [...paths].map(([id, path]) => (sprites.has(id) ? walk(s, sprites.get(id)!, path, ms) : glide(s, glows.get(id)!, path, ms)))
      for (const m of group) if (m.type === 'move' && m.with && sprites.has(m.id)) float(s, callout(s, effectName(m.with, s.kit()).toUpperCase(), 0xffffff, sprites.get(m.id)!))
      await Promise.all([s.follow(squad(battle), Math.max(ms, CAMERA_MS)), ...walks])
      // The fog lifts where the squad arrived, before any pod it uncovered appears.
      drawFog(s, battle)
      await play(s, battle, group.filter((m) => m.type !== 'move'))
    } else if (e.type === 'reveal' || e.type === 'wave') {
      // A wave the squad cannot see yet stays off screen, and the camera stays where it is.
      if (e.type === 'wave' && !e.units.some((at) => battle.units.some((u) => u.id === at.id && revealed(battle, u)))) continue
      const appeared = e.units.flatMap((at) => {
        const unit = battle.units.find((u) => u.id === at.id)
        return unit && !sprites.has(unit.id) ? [create(s, { ...unit, x: at.x, y: at.y }, 0, letter(unit))] : []
      })
      await s.tween(PACE.reveal, (t) => appeared.forEach((sprite) => fade(sprite, t)))
      if (e.type === 'wave' && appeared.length > 0) float(s, callout(s, 'REINFORCEMENTS', COLOR.crit, appeared[0], 18))
    } else if (e.type === 'shot') {
      const from = sprites.get(e.id)
      const to = sprites.get(e.target)
      // A shooter gone from the field later in the beat, as one lifted off, leaves its shot unshown.
      const shooter = battle.units.find((u) => u.id === e.id)
      if (!from || !to || !shooter) continue
      const after = vitals(battle, e.target)
      await drawing(s, (fx) => playShot(s, fx, from, to, e, after, attackOf(shooter, s.soldiers.find((m) => m.id === shooter.soldier)?.gear.weapon?.weapon ?? null, s.blademasters)))
      // Crumbling cover has already broken in the battle; show it as the hit lands.
      if (battle.twist === 'crumbling' && e.damage > 0) drawTerrain(s, battle)
    } else if (e.type === 'rocket') {
      const from = sprites.get(e.id)
      if (!from && !e.hits.some((hit) => sprites.has(hit.target))) continue
      await drawing(s, (fx) => fireRocket(s, fx, battle, from, e))
    } else if (e.type === 'spit' || e.type === 'panic') {
      const from = sprites.get(e.id)
      const to = sprites.get(e.target)
      if (!from || !to) continue
      const a = chest(from)
      const b = chest(to)
      const color = e.type === 'spit' ? COLOR.acid : COLOR.psi
      await drawing(s, (fx) =>
        s.tween(PACE.psi, (t) => {
          const head = lerp(a, b, t)
          // Spit arcs as a blob; panic reaches out as a beam.
          if (e.type === 'spit') fx.clear().circle(head.x, head.y - 30 * Math.sin(Math.PI * t), 5).fill(color)
          else fx.clear().moveTo(a.x, a.y).lineTo(head.x, head.y).stroke({ color, width: 2, alpha: 0.8 })
        }),
      )
      if (e.type === 'spit') {
        to.drawHp(...vitals(battle, e.target))
        drawAcid(s, battle)
        float(s, callout(s, `ACID -${e.damage}`, COLOR.acid, to))
      } else float(s, callout(s, 'PANICKED', COLOR.psi, to))
    } else if (e.type === 'order') {
      const on = sprites.get(e.id)
      if (on) float(s, callout(s, ORDERS[e.order], COLOR.hit, on, 16))
    } else if (e.type === 'cloak') {
      const on = sprites.get(e.id)
      if (!on) continue
      cloakLook(on, e.on)
      float(s, callout(s, e.on ? 'CLOAKED' : 'DECLOAKED', COLOR.cloak, on, 16))
    } else if (e.type === 'frozen' || e.type === 'hurt') {
      const on = sprites.get(e.id)
      if (!on) continue
      if (e.type === 'hurt') on.drawHp(...vitals(battle, e.id))
      float(s, e.type === 'frozen' ? callout(s, battle.units.find((u) => u.id === e.id)?.side === 'alien' ? 'STUNNED' : 'TOO SHAKEN TO ACT', COLOR.psi, on) : callout(s, `${e.cause.toUpperCase()} -${e.amount}`, e.cause === 'acid' ? COLOR.acid : e.cause === 'impact' ? COLOR.crit : COLOR.psi, on))
    } else if (e.type === 'spawn') {
      const unit = battle.units.find((u) => u.id === e.unit.id)
      if (!unit || !revealed(battle, unit)) continue
      const born = create(s, { ...unit, x: e.unit.x, y: e.unit.y }, 0, letter(unit))
      await s.tween(PACE.reveal, (t) => fade(born, t))
    } else if (e.type === 'effect') {
      const on = sprites.get(e.id)
      if (!on) continue
      on.drawHp(...vitals(battle, e.id))
      // A demolishing hit has already wrecked the cover in the battle; show it as the hit lands.
      if (e.effect === 'demolish') drawTerrain(s, battle)
      float(s, effectCallout(s, e, on))
    } else if (e.type === 'saved' || e.type === 'escaped') {
      const sprite = sprites.get(e.id)
      if (!sprite) continue
      float(s, callout(s, e.type === 'saved' ? 'SAVED' : 'LIFTED OFF', COLOR.heal, sprite))
      await s.tween(PACE.death, (t) => fade(sprite, 1 - t))
      remove(s, e.id)
    } else if (e.type === 'carried') {
      const on = sprites.get(e.id)
      drawMarks(s, battle)
      if (on) float(s, callout(s, 'CARRYING', COLOR.heal, on))
    } else if (e.type === 'freed') {
      const unit = battle.units.find((u) => u.id === e.unit.id)
      drawMarks(s, battle)
      if (!unit) continue
      const freed = create(s, { ...unit, x: e.unit.x, y: e.unit.y }, 0, letter(unit))
      await s.tween(PACE.reveal, (t) => fade(freed, t))
      float(s, callout(s, 'FREED', COLOR.heal, freed))
    } else if (e.type === 'extract') {
      drawMarks(s, battle)
    } else if (e.type === 'feed') {
      const on = sprites.get(e.id)
      if (on) float(s, callout(s, `FED +${e.damage}`, COLOR.crit, on))
    } else if (e.type === 'used') {
      const word = CONSUMABLES[e.consumable].name.toUpperCase()
      for (const id of e.on) {
        const on = sprites.get(id)
        if (!on) continue
        on.drawHp(...vitals(battle, id))
        float(s, callout(s, word, COLOR.heal, on))
      }
      await s.tween(PACE.reveal, () => {})
    } else if (e.type === 'heal') {
      const to = sprites.get(e.target)
      if (!to) continue
      to.drawHp(...vitals(battle, e.target))
      float(s, callout(s, `HEAL +${e.amount}`, COLOR.heal, to))
    } else if (e.type === 'death') {
      const sprite = sprites.get(e.id)
      if (!sprite) continue
      await s.tween(PACE.death, (t) => fade(sprite, 1 - t))
      remove(s, e.id)
      drawMarks(s, battle)
    }
  }
}
