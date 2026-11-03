// A duo's moment on screen: its two heroes linked by a beam, both ringed, the duo's name over what it acted on.
import type { GameEvent } from '../core/combat-event'
import { DUOS } from '../core/duos'
import { PACE } from '../core/pace'
import { callout, chest, drawing, float } from './effects'
import { COLOR } from './palette'
import type { Stage } from './stage'

export async function playDuo(s: Stage, e: Extract<GameEvent, { type: 'duo' }>): Promise<void> {
  const [a, b] = e.ids.map((id) => s.sprites.get(id))
  if (!a || !b) return
  const on = e.target === undefined ? undefined : s.sprites.get(e.target)
  float(s, callout(s, `✦ ${DUOS[e.duo].name.toUpperCase()}`, COLOR.duo, on ?? a, 18, 18))
  await drawing(s, (fx) =>
    s.tween(PACE.duo, (t) => {
      const [p, q] = [chest(a), chest(b)]
      const alpha = 1 - t * t
      fx.clear().moveTo(p.x, p.y).lineTo(q.x, q.y).stroke({ color: COLOR.duo, width: 4, alpha })
      if (on && on !== a && on !== b) {
        const r = chest(on)
        fx.moveTo(p.x, p.y).lineTo(r.x, r.y).moveTo(q.x, q.y).lineTo(r.x, r.y).stroke({ color: COLOR.duo, width: 2, alpha })
      }
      for (const h of [p, q]) fx.circle(h.x, h.y, 12 + 14 * t).stroke({ color: COLOR.duo, width: 3, alpha })
    }),
  )
}
