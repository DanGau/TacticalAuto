import { ALIENS } from '../core/aliens'
import { GRID, heightAt, type Battle, type Tile } from '../core/battle'
import type { Prop } from '../core/terrain'
import { GOALS } from '../core/goals'
import { TWISTS } from '../core/twists'
import type { View } from '../view/view'

/** How long the briefing holds on each thing it shows. */
const DWELL_MS = 1800
/** How long the camera takes to fly in, and to glide between shots. */
const FLY_MS = 2400
const GLIDE_MS = 1400
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

/** The most stops a briefing makes, the whole map among them. */
export const STOPS = 3

/**
 * What to show before a landing: tight on the objective, at most two things, naming the ground there, then the whole
 * map, where the landing zones show. The first line names the goal; the last any twist and the choice to make.
 */
export function shots(battle: Battle): Shot[] {
  const goal = GOALS[battle.goal]
  const aliens = battle.units.filter((u) => u.side === 'alien')
  const pod = (at: Tile & { pod?: number | null }) => (at.pod != null ? `${podLine(battle, at.pod)}. ` : '')
  const commander = aliens.find((u) => u.target)
  // The objective: where the squad is ambushed, the uplink, the commander, the caches, or failing those the biggest pod.
  const sizes = battle.pods.map((_, i) => aliens.filter((u) => u.pod === i).length)
  const biggest = aliens.find((u) => u.pod === sizes.indexOf(Math.max(...sizes)))
  const at: (Tile & { pod?: number | null })[] = battle.start
    ? [battle.start]
    : battle.uplink
      ? [battle.uplink]
      : commander
        ? [commander]
        : battle.caches.length > 0
          ? battle.caches.slice(0, STOPS - 1)
          : biggest
            ? [biggest]
            : []
  const lines = at.map((t, i) => `${i === 0 ? `Objective: ${goal.text}. ` : ''}${pod(t)}${ground(battle, t)}.`)
  const twist = battle.twist && TWISTS[battle.twist]
  const choice = battle.goal === 'rescue' ? 'Choose how to split the squad.' : battle.goal === 'raid' ? 'Choose how many caches to go for.' : battle.start ? 'Choose the way out.' : 'Choose where to land.'
  const last = `${twist ? `${twist.icon} ${twist.name}: ${twist.text}. ` : ''}${choice}`
  return [...at.map((t, i): Shot => ({ tiles: around(t), line: lines[i] })), { tiles: null, line: at.length === 0 ? `Objective: ${goal.text}. ${last}` : last, zones: true }]
}

/** Flies the camera in over the mission before a landing, adding a line on each thing it shows. Any click ends it early. */
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
  const all = shots(battle)
  for (const shot of all) {
    if (skipped) break
    if (shot.zones) view.hideZones(false)
    const line = document.createElement('p')
    line.textContent = shot.line
    caption.append(line)
    while (caption.childElementCount > LINES) caption.firstElementChild!.remove()
    // The first glide flies in from high above, slowly.
    await view.frame(shot.tiles, shot === all[0] ? FLY_MS : GLIDE_MS)
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
