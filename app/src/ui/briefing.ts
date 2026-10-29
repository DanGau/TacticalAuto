import { ALIENS } from '../core/aliens'
import { GRID, PLANS, heightAt, ZONE_NAMES, type Battle, type Tile } from '../core/battle'
import type { Prop } from '../core/terrain'
import { GOALS } from '../core/goals'
import { TWISTS } from '../core/twists'
import type { View } from '../view/view'

/** How long the briefing holds on each thing it shows. */
const DWELL_MS = 1800
/** Lines the caption keeps, the newest last. */
const LINES = 3
/** Tiles around a thing the briefing frames, and whose ground it names. */
const NEAR = 4

/** A thing the briefing shows: the tiles the camera frames, or the whole map, and a line on it. `zones` shows the landing zones from it on. */
interface Shot {
  tiles: Tile[] | null
  line: string
  zones?: boolean
}

/** The tiles a shot frames tight around `at`. */
const around = (at: Tile): Tile[] => [{ x: at.x - NEAR, y: at.y - NEAR }, { x: at.x + NEAR, y: at.y + NEAR }]

/** The ground around `at`, in a few words: its two commonest features, or open ground. */
function ground(battle: Battle, at: Tile): string {
  const count: Record<string, number> = {}
  const add = (feature: string) => (count[feature] = (count[feature] ?? 0) + 1)
  const base = heightAt(battle, at)
  for (let y = at.y - NEAR; y <= at.y + NEAR; y++) {
    for (let x = at.x - NEAR; x <= at.x + NEAR; x++) {
      if (x < 0 || y < 0 || x >= GRID || y >= GRID) continue
      const t = y * GRID + x
      if (battle.north[t] !== 'none' || battle.west[t] !== 'none') add('buildings')
      if (Math.abs(battle.height[t] - base) > 0) add('high ground')
      const feature = FEATURES[battle.props[t]]
      if (feature) add(feature)
    }
  }
  const top = Object.entries(count).filter(([, n]) => n >= 4).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([f]) => f)
  return top.length === 0 ? 'Open ground' : `${top[0][0].toUpperCase()}${top[0].slice(1)}${top[1] ? ` and ${top[1]}` : ''}`
}

/** What a prop makes of the ground it stands on. */
const FEATURES: Partial<Record<Prop, string>> = { car: 'wrecked cars', truck: 'wrecked cars', tree: 'trees', crate: 'crates', stack: 'crates', fence: 'fences', rubble: 'rubble', spire: 'alien growth', growth: 'alien growth', water: 'water', fuel: 'fuel tanks', void: 'a sheer drop' }

/** A pod, as the briefing names it. */
function podLine(battle: Battle, pod: number): string {
  const members = battle.units.filter((u) => u.pod === pod)
  const kinds = new Map<string, number>()
  for (const u of members) kinds.set(u.boss ? 'the Hunter' : ALIENS[u.kind!].name.toLowerCase(), (kinds.get(u.boss ? 'the Hunter' : ALIENS[u.kind!].name.toLowerCase()) ?? 0) + 1)
  return `${battle.pods[pod].name}: ${[...kinds].map(([k, n]) => (n > 1 ? `${n} ${k}s` : k)).join(', ')}`
}

/**
 * What to show before a landing: the goal, then tight on each thing it is about, naming the ground there: the uplink,
 * the commander, or every pod; any twist; then the whole map and each landing zone, or on an escape each way out.
 */
function shots(battle: Battle): Shot[] {
  const goal = GOALS[battle.goal]
  const aliens = battle.units.filter((u) => u.side === 'alien')
  const first = (pod: number) => aliens.find((u) => u.pod === pod)!
  const pods = battle.pods.flatMap((_, pod) => (aliens.some((u) => u.pod === pod) ? [pod] : []))
  const targets: Shot[] = []
  if (battle.start) targets.push({ tiles: around(battle.start), line: `The squad is ambushed here. ${ground(battle, battle.start)}.` })
  if (battle.uplink) targets.push({ tiles: around(battle.uplink), line: `The uplink. ${ground(battle, battle.uplink)}.` })
  for (const pod of pods) {
    const at = first(pod)
    const what = at.target ? `The commander. ${podLine(battle, pod)}` : podLine(battle, pod)
    targets.push({ tiles: around(at), line: `${what}. ${ground(battle, at)}.` })
  }
  const twist = battle.twist && TWISTS[battle.twist]
  const tanks = battle.props.flatMap((p, t) => (p === 'fuel' ? [{ x: t % GRID, y: Math.floor(t / GRID) }] : []))
  const twists: Shot[] = twist ? [{ tiles: tanks.length > 0 ? tanks : null, line: `${twist.icon} ${twist.name}: ${twist.text}.` }] : []
  const zones = battle.zones.map((zone, i): Shot => {
    const what = battle.start ? `Escape zone ${ZONE_NAMES[i]}` : `Landing zone ${ZONE_NAMES[i]}: ${PLANS[battle.plans[i]].name}`
    return { tiles: around(zone), line: `${what}. ${ground(battle, zone)}.`, zones: true }
  })
  // A rescue lands where its teams scatter to, and a raid once, so neither shows landing zones; a raid shows its caches.
  const caches = battle.caches.map((cache, i): Shot => ({ tiles: around(cache), line: `Supply cache ${i + 1}. ${ground(battle, cache)}.` }))
  if (battle.goal === 'rescue' || battle.goal === 'raid')
    return [{ tiles: null, line: `Objective: ${goal.text}.` }, ...caches, ...targets, ...twists, { tiles: null, line: battle.goal === 'rescue' ? 'Choose how to split the squad.' : 'Choose how many caches to go for.', zones: true }]
  return [
    { tiles: null, line: `Objective: ${goal.text}.` },
    ...targets,
    ...twists,
    { tiles: null, line: battle.start ? 'Three ways out.' : 'Three landing zones.', zones: true },
    ...zones,
    { tiles: null, line: battle.start ? 'Choose the way out.' : 'Choose where to land.', zones: true },
  ]
}

/**
 * Flies the camera over the mission before a landing, adding a line on each thing it shows: tight on each objective,
 * then out to the whole map and over each landing zone. Any click ends it early.
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
  const button = document.createElement('button')
  button.className = 'skip'
  button.textContent = 'Skip ⏭'
  document.body.append(button)
  addEventListener('pointerdown', skip, { once: true, capture: true })
  view.hideZones(true)
  document.getElementById('drop')!.classList.add('briefing')
  for (const shot of shots(battle)) {
    if (skipped) break
    if (shot.zones) view.hideZones(false)
    const line = document.createElement('p')
    line.textContent = shot.line
    caption.append(line)
    while (caption.childElementCount > LINES) caption.firstElementChild!.remove()
    await view.frame(shot.tiles)
    await new Promise<void>((done) => {
      wake = done
      setTimeout(done, DWELL_MS)
    })
  }
  removeEventListener('pointerdown', skip, { capture: true })
  caption.remove()
  button.remove()
  view.hideZones(false)
  document.getElementById('drop')!.classList.remove('briefing')
}
