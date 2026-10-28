import { GRID, type Battle, type Tile } from '../core/battle'
import { GOALS } from '../core/goals'
import { TWISTS } from '../core/twists'
import type { View } from '../view/view'

/** How long the briefing holds on each thing it shows. */
const DWELL_MS = 2200

/** A thing the briefing shows: the tiles the camera frames, or the whole map, and a line on it. */
interface Shot {
  tiles: Tile[] | null
  line: string
}

/** What to show before a landing: the objective, any twist, then the whole map. */
function shots(battle: Battle): Shot[] {
  const goal = GOALS[battle.goal]
  const aliens = battle.units.filter((u) => u.side === 'alien')
  const commander = aliens.find((u) => u.target)
  const objective: Shot = battle.uplink
    ? { tiles: [battle.uplink], line: `Objective: ${goal.text}.` }
    : commander
      ? { tiles: [commander], line: `Objective: ${goal.text}. The commander's pod is here.` }
      : { tiles: battle.goal === 'rescue' ? null : aliens, line: `Objective: ${goal.text}.` }
  const twist = battle.twist && TWISTS[battle.twist]
  const tanks = battle.props.flatMap((p, t) => (p === 'fuel' ? [{ x: t % GRID, y: Math.floor(t / GRID) }] : []))
  const twists: Shot[] = twist ? [{ tiles: tanks.length > 0 ? tanks : null, line: `${twist.icon} ${twist.name}: ${twist.text}.` }] : []
  return [objective, ...twists, { tiles: null, line: 'Choose where to land.' }]
}

/**
 * Flies the camera over the mission before a landing, adding a line on each thing it shows, then shows the landing
 * zones on the whole map. Any click ends it early.
 */
export async function brief(view: View, battle: Battle): Promise<void> {
  const caption = document.createElement('div')
  caption.className = 'brief'
  document.body.append(caption)
  let skipped = false
  let wake = () => {}
  const skip = () => {
    skipped = true
    wake()
  }
  addEventListener('pointerdown', skip, { once: true, capture: true })
  view.hideZones(true)
  document.getElementById('drop')!.classList.add('briefing')
  for (const shot of shots(battle)) {
    if (skipped) break
    const line = document.createElement('p')
    line.textContent = shot.line
    caption.append(line)
    await view.frame(shot.tiles)
    await new Promise<void>((done) => {
      wake = done
      setTimeout(done, DWELL_MS)
    })
  }
  removeEventListener('pointerdown', skip, { capture: true })
  caption.remove()
  view.hideZones(false)
  document.getElementById('drop')!.classList.remove('briefing')
}
