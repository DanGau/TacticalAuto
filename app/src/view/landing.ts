// The squad's landing on screen: drop pods, parachutes, or a march in from the map's edge.
import { GRID, type Battle, type Unit } from '../core/battle'
import { drawing } from './effects'
import { COLOR } from './palette'
import { fade, place, shift } from './sprites'
import type { Stage } from './stage'

/** A drop pod's fall, the burst of dust as it lands, the gap between pods, and the height it falls from in world pixels. */
const POD_FALL_MS = 800
/** How long a stealth insertion's parachutes take to drift down, how high they start, and how long a canopy takes to fold. */
const CHUTE_FALL_MS = 1500
const CHUTE_HEIGHT = 260
const CHUTE_FOLD_MS = 350
const POD_DUST_MS = 450
/** How long a quiet approach takes to walk in, and from how many tiles out. */
const MARCH_MS = 900
const MARCH_FROM = 3
const POD_STAGGER_MS = 160
const POD_HEIGHT = 400

/**
 * The landing: the camera frames the zone, and each soldier's drop pod streaks down one after another on a trail of
 * fire, slams in with a burst of dust, and opens on the soldier. A hot drop shakes the ground harder.
 */
export async function dropPods(s: Stage, battle: Battle): Promise<void> {
  const soldiers = battle.units.filter((u) => u.side === 'human' && !u.civilian)
  const hot = battle.breach
  if (soldiers.length === 0) return
  for (const unit of soldiers) fade(s.sprites.get(unit.id)!, 0)
  await s.follow(soldiers.map((u) => ({ x: u.x, y: u.y })))
  if (battle.landed === 'stealth') return parachute(s, soldiers)
  if (battle.landed === 'march') return marchIn(s, soldiers)
  await Promise.all(
    soldiers.map((unit, i) =>
      drawing(s, async (pod) => {
        const sprite = s.sprites.get(unit.id)!
        const ground = sprite.at
        await s.tween(i * POD_STAGGER_MS, () => {})
        await s.tween(POD_FALL_MS, (t) => {
          const y = ground.y - POD_HEIGHT * (1 - t * t)
          pod.clear()
          pod.moveTo(ground.x, y - 160).lineTo(ground.x, y - 30).stroke({ color: COLOR.crit, width: 12, alpha: 0.6 })
          pod.moveTo(ground.x, y - 90).lineTo(ground.x, y - 30).stroke({ color: 0xffe08a, width: 5 })
          pod.ellipse(ground.x, ground.y, 16 * t, 8 * t).fill({ color: 0x000000, alpha: 0.4 })
          pod.roundRect(ground.x - 14, y - 44, 28, 44, 12).fill(0xc9d3e3).stroke({ color: 0x10141c, width: 3 })
          pod.rect(ground.x - 6, y - 34, 12, 8).fill(0x6fb7ff)
        })
        fade(sprite, 1)
        await s.tween(POD_DUST_MS, (t) => {
          pod.clear()
          pod.ellipse(ground.x, ground.y, 14 + (hot ? 70 : 40) * t, 7 + (hot ? 35 : 20) * t).fill({ color: hot ? COLOR.crit : 0xb8a888, alpha: 0.7 * (1 - t) })
          pod.roundRect(ground.x - 14, ground.y - 44 + 44 * t, 28, 44 * (1 - t), 12).fill({ color: 0xc9d3e3, alpha: 1 - t })
          if (hot) {
            s.jolt.x = Math.sin(t * 60) * 3 * (1 - t)
            s.look(s.camera)
          }
        })
      }),
    ),
  )
  s.jolt.x = 0
  s.look(s.camera)
}

/** A quiet approach: the squad walks in from beyond the battlefield's edge, one after another, out of nowhere. */
async function marchIn(s: Stage, soldiers: Unit[]): Promise<void> {
  await Promise.all(
    soldiers.map(async (unit, i) => {
      const sprite = s.sprites.get(unit.id)!
      // From the side of the map the squad stands nearest.
      const away = { x: unit.x - GRID / 2, y: unit.y - GRID / 2 }
      const len = Math.hypot(away.x, away.y) || 1
      const from = { x: unit.x + (away.x / len) * MARCH_FROM, y: unit.y + (away.y / len) * MARCH_FROM }
      const home = sprite.tile
      await s.tween(i * POD_STAGGER_MS, () => {})
      await s.tween(MARCH_MS, (t) => {
        const at = s.toWorld(from.x + (home.x - from.x) * t, from.y + (home.y - from.y) * t)
        shift(s, sprite, at)
        fade(sprite, Math.min(1, t * 2))
      })
      place(s, sprite, home)
    }),
  )
}

/** A stealth insertion: each soldier drifts down under a canopy, swaying, and lands without a sound. */
async function parachute(s: Stage, soldiers: Unit[]): Promise<void> {
  await Promise.all(
    soldiers.map((unit, i) =>
      drawing(s, async (chute) => {
        const sprite = s.sprites.get(unit.id)!
        const ground = sprite.at
        await s.tween(i * POD_STAGGER_MS, () => {})
        fade(sprite, 1)
        await s.tween(CHUTE_FALL_MS, (t) => {
          const sway = Math.sin(t * Math.PI * 3) * 10 * (1 - t)
          const x = ground.x + sway
          const y = ground.y - CHUTE_HEIGHT * (1 - t)
          shift(s, sprite, { x, y })
          chute.clear()
          chute.ellipse(ground.x, ground.y, 14 * t, 7 * t).fill({ color: 0x000000, alpha: 0.35 })
          // Lines from the soldier's shoulders up to the canopy.
          chute.moveTo(x - 6, y - 34).lineTo(x - 22, y - 74).moveTo(x + 6, y - 34).lineTo(x + 22, y - 74).stroke({ color: 0xd8dde6, width: 1.5, alpha: 0.9 })
          chute.moveTo(x - 26, y - 72).arc(x, y - 72, 26, Math.PI, 0).closePath().fill(0x4a5a3c).stroke({ color: 0x2b3424, width: 2 })
        })
        place(s, sprite, sprite.tile)
        await s.tween(CHUTE_FOLD_MS, (t) => {
          chute.clear()
          chute.moveTo(ground.x - 26, ground.y - 72 + 60 * t).arc(ground.x + 20 * t, ground.y - 72 + 60 * t, 26 * (1 - t / 2), Math.PI, 0).closePath().fill({ color: 0x4a5a3c, alpha: 1 - t })
        })
      }),
    ),
  )
}
