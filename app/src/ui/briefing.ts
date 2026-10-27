import { BOONS, GRID, ZONE_NAMES, ZONE_RADIUS, type Battle, type Tile } from '../core/battle'
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

/** What to show before a landing: the objective, any twist, each landing zone, then the choice. */
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
  const zones = battle.zones.map((zone, i): Shot => {
    const reach = ZONE_RADIUS + 2
    const what = i === battle.hot ? '☄️ Hot drop: land on top of a pod.' : `${BOONS[battle.boons[i]].name}: ${BOONS[battle.boons[i]].text}.`
    return { tiles: [{ x: zone.x - reach, y: zone.y - reach }, { x: zone.x + reach, y: zone.y + reach }], line: `Landing zone ${ZONE_NAMES[i]}. ${what}` }
  })
  return [objective, ...twists, ...zones, { tiles: null, line: 'Choose where to land.' }]
}

/**
 * Flies the camera over what matters before a landing, a line on each, and ends on the whole map asking where to land.
 * Any click ends it early.
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
  for (const shot of shots(battle)) {
    if (skipped) break
    caption.textContent = shot.line
    await view.frame(shot.tiles)
    await new Promise<void>((done) => {
      wake = done
      setTimeout(done, DWELL_MS)
    })
  }
  removeEventListener('pointerdown', skip, { capture: true })
  caption.remove()
}
