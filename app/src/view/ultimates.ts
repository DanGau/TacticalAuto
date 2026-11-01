// A tier 4's moment on screen: the name over the hero, the colour over the arena, and its shape on the ground.
import { type Battle } from '../core/battle'
import type { GameEvent } from '../core/combat-event'
import { effectName } from '../core/effects'
import { PACE } from '../core/pace'
import type { UltimateEffect } from '../core/ultimates'
import { lerp } from './camera'
import { callout, chest, float, shake } from './effects'
import { drawFog } from './marks'
import { drawTerrain } from './board'
import { Sketch } from './shapes'
import { TILE_H, TILE_W } from './space'
import { grow, vitals } from './sprites'
import type { Stage } from './stage'

/** What it draws: a ring racing out, a beam, streaks falling, a dome over the squad, or a flash of the whole arena. */
type Shape = 'ring' | 'beam' | 'rain' | 'dome' | 'flash'

const LOOKS: Record<UltimateEffect, { color: number; shape: Shape; tint?: number }> = {
  killingSpree: { color: 0xff3b3b, shape: 'flash' },
  indestructible: { color: 0xffd166, shape: 'dome' },
  levelBlock: { color: 0xc9a26b, shape: 'ring', tint: 0.25 },
  extinction: { color: 0xff7a3d, shape: 'rain', tint: 0.3 },
  titanForm: { color: 0x7fb3ff, shape: 'dome' },
  earthquake: { color: 0xb08a5a, shape: 'ring', tint: 0.2 },
  bulletTime: { color: 0xeaf2ff, shape: 'flash', tint: 0.35 },
  deathSentence: { color: 0xff2a6d, shape: 'beam' },
  hallOfMirrors: { color: 0xb9f2ff, shape: 'dome' },
  colossus: { color: 0x9aa9bf, shape: 'dome' },
  droneStorm: { color: 0xffd84d, shape: 'rain' },
  orbital: { color: 0x6ff7ff, shape: 'beam', tint: 0.25 },
  resurrection: { color: 0xfff3b0, shape: 'dome', tint: 0.3 },
  divineShield: { color: 0xffe08a, shape: 'dome', tint: 0.2 },
  timeStop: { color: 0x8fd3ff, shape: 'flash', tint: 0.5 },
  supernova: { color: 0xff6a1f, shape: 'ring', tint: 0.45 },
  worldAblaze: { color: 0xff4a12, shape: 'flash', tint: 0.4 },
  phoenixRising: { color: 0xffa12e, shape: 'ring', tint: 0.35 },
  absoluteZero: { color: 0xa8e8ff, shape: 'ring', tint: 0.45 },
  blizzard: { color: 0xdff6ff, shape: 'rain', tint: 0.25 },
  hailOfIcicles: { color: 0xbfeaff, shape: 'rain' },
  eclipse: { color: 0x1a0f33, shape: 'flash', tint: 0.65 },
  reap: { color: 0x7a2bd9, shape: 'flash', tint: 0.5 },
  phantomLegion: { color: 0xc77dff, shape: 'flash', tint: 0.2 },
}

/** Picture pixels the arena's tint covers, past any screen's edge. */
const COVER = 6000
const STREAKS = 28

/** Plays a tier 4: its name, then its colour and shape, as what it did lands. */
export async function playUltimate(s: Stage, battle: Battle, e: Extract<GameEvent, { type: 'ultimate' }>): Promise<void> {
  const from = s.sprites.get(e.id)
  const look = LOOKS[e.effect as UltimateEffect]
  const at = s.toWorld(e.x, e.y)
  if (from) float(s, callout(s, effectName(e.effect, s.kit()).toUpperCase(), look.color, from, 30, 34))
  if (from && battle.units.find((u) => u.id === e.id)?.giant) grow(from)
  drawTerrain(s, battle)
  drawFog(s, battle)
  from?.drawHp(...vitals(battle, e.id))
  void shake(s, 10, PACE.ultimate)
  const end = e.to ? s.toWorld(e.to.x, e.to.y) : at
  const start = from ? chest(from) : at
  const far = e.radius > 0 ? e.radius + 1 : 4
  const sketch = new Sketch()
  s.drops.add(sketch)
  const seeds = Array.from({ length: STREAKS }, () => ({ x: (Math.random() - 0.5) * 2 * far * TILE_W, y: (Math.random() - 0.5) * 2 * far * TILE_H, t: Math.random() * 0.6 }))
  await s.tween(PACE.ultimate, (t) => {
    sketch.clear()
    if (look.tint) sketch.rect(at.x - COVER, at.y - COVER, 2 * COVER, 2 * COVER).fill({ color: look.color, alpha: look.tint * (1 - t) })
    if (look.shape === 'ring') {
      sketch.ellipse(at.x, at.y, far * TILE_W * t, far * TILE_H * t).stroke({ color: look.color, width: 14 * (1 - t) + 2, alpha: 1 - t })
      sketch.ellipse(at.x, at.y, far * TILE_W * t, far * TILE_H * t).fill({ color: look.color, alpha: 0.35 * (1 - t) })
    } else if (look.shape === 'beam') {
      const head = lerp(start, end, Math.min(1, t * 3))
      sketch.moveTo(start.x, start.y).lineTo(head.x, head.y).stroke({ color: look.color, width: 16 * (1 - t) + 2, alpha: 1 - t * 0.6 })
      sketch.moveTo(start.x, start.y).lineTo(head.x, head.y).stroke({ color: 0xffffff, width: 5 * (1 - t) + 1, alpha: 1 - t })
    } else if (look.shape === 'rain') {
      for (const drop of seeds) {
        const fall = Math.min(1, Math.max(0, (t - drop.t) / 0.4))
        if (fall <= 0 || fall >= 1) continue
        sketch.moveTo(at.x + drop.x, at.y + drop.y - 240 * (1 - fall)).lineTo(at.x + drop.x, at.y + drop.y - 200 * (1 - fall)).stroke({ color: look.color, width: 4, alpha: 0.95 })
      }
    } else if (look.shape === 'dome') {
      const grown = Math.min(1, t * 2.5)
      sketch.ellipse(at.x, at.y - 10, 3 * TILE_W * grown, 3 * TILE_H * grown).fill({ color: look.color, alpha: 0.4 * (1 - t * 0.7) })
      sketch.ellipse(at.x, at.y - 10, 3 * TILE_W * grown, 3 * TILE_H * grown).stroke({ color: look.color, width: 4, alpha: 1 - t * 0.5 })
    }
  })
  s.drops.delete(sketch)
}
