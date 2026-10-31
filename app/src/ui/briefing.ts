import { ALIENS } from '../core/aliens'
import { GRID, type Battle, type Tile } from '../core/battle'
import { heightAt } from '../core/grid'
import type { Prop } from '../core/terrain'
import { GOALS } from '../core/goals'
import { REGIONS } from '../core/regions'
import { TWISTS } from '../core/twists'
import { YAW } from '../view/space'
import type { Shot as CameraShot, View } from '../view/view'

/** How long the briefing holds on each thing it shows. */
const DWELL_MS = 1800
/** How long the camera takes to fly in, and to glide between shots. */
const FLY_MS = 2400
const GLIDE_MS = 1400
/** How long the camera takes to settle onto the flat map at the end, or once skipped, and how far it drifts round while holding on a stop. */
const SETTLE_MS = 2600
const SKIP_MS = 700
const DRIFT = 0.09

/**
 * The camera on the `i`th stop on the objective: swung round to one side of it and low, a narrow lens through haze, so
 * the town between stands in the foreground and the distance fades; each stop swings further round, its subject on
 * the other third, leaving room on the side the camera moves toward.
 */
const objective = (turn: number, i: number): Required<CameraShot> => ({ turn: turn + 0.35 * i, pitch: -0.14 + 0.06 * i, fov: 32 - 6 * i, haze: 0.7, third: i % 2 === 0 ? 1 : -1 })

/** How far the camera may swing from still, either way, so settling back never spins it round. */
const SWING = 1.4

/**
 * The turn that looks at `at` from the battlefield's middle: the town between in the foreground, and past the
 * subject the town going on, not the map's edge.
 */
function facing(at: Tile): number {
  const dx = GRID / 2 - at.x
  const dz = GRID / 2 - at.y
  if (Math.hypot(dx, dz) < 4) return -SWING / 2
  const turn = Math.atan2(dx, dz) - YAW
  const wrapped = turn - 2 * Math.PI * Math.round(turn / (2 * Math.PI))
  return Math.max(-SWING, Math.min(SWING, wrapped))
}
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
  // The objective: the uplink, the commander, the caches, or failing those the biggest pod.
  const sizes = battle.pods.map((_, i) => aliens.filter((u) => u.pod === i).length)
  const biggest = aliens.find((u) => u.pod === sizes.indexOf(Math.max(...sizes)))
  const at: (Tile & { pod?: number | null })[] = battle.uplink
      ? [battle.uplink]
      : commander
        ? [commander]
        : battle.caches.length > 0
          ? battle.caches.slice(0, STOPS - 1)
          : biggest
            ? [biggest]
            : []
  const where = `${battle.city}, ${REGIONS[battle.region].name.toLowerCase()}. `
  const lines = at.map((t, i) => `${i === 0 ? `${where}Objective: ${goal.text}. ` : ''}${pod(t)}${ground(battle, t)}.`)
  const twist = battle.twist && TWISTS[battle.twist]
  const choice = battle.goal === 'raid' ? 'Choose how many caches to go for.' : 'Choose where to land.'
  const last = `${twist ? `${twist.icon} ${twist.name}: ${twist.text}. ` : ''}${choice}`
  return [...at.map((t, i): Shot => ({ tiles: around(t), line: lines[i] })), { tiles: null, line: at.length === 0 ? `${where}Objective: ${goal.text}. ${last}` : last, zones: true }]
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
  document.body.classList.add('cinema')
  const all = shots(battle)
  const first = all[0].tiles
  const middle = (tiles: Tile[]) => ({ x: (tiles[0].x + tiles[1].x) / 2, y: (tiles[0].y + tiles[1].y) / 2 })
  const turn = first ? facing(middle(first)) : -SWING / 2
  // An establishing shot to open on: low and wide over the town, swung further round, through the haze.
  void view.frame(null, 0, { turn: turn - 0.5, pitch: -0.3, fov: 42, haze: 1 })
  /** A slow wait that a skip cuts short. */
  const hold = (ms: number) => new Promise<void>((done) => ((wake = done), setTimeout(done, ms)))
  for (const [i, shot] of all.entries()) {
    if (skipped) break
    const line = document.createElement('p')
    line.textContent = shot.line
    caption.append(line)
    while (caption.childElementCount > LINES) caption.firstElementChild!.remove()
    if (!shot.tiles) break
    // Each stop on the objective is lit, framed on a third, its subject turned to as the camera swings round it; the
    // camera never stops, drifting on while it holds.
    const angle = objective(turn, i)
    view.spotlight(middle(shot.tiles))
    await Promise.race([view.frame(shot.tiles, i === 0 ? FLY_MS : GLIDE_MS, angle), hold(i === 0 ? FLY_MS : GLIDE_MS)])
    if (skipped) break
    void view.frame(shot.tiles, DWELL_MS, { ...angle, turn: angle.turn + DRIFT, fov: angle.fov * 0.9 })
    await hold(DWELL_MS)
  }
  // The last shot settles from the lens's depth onto the flat map, the landing zones showing as it lands.
  view.spotlight(null)
  document.body.classList.remove('cinema')
  await view.frame(null, skipped ? SKIP_MS : SETTLE_MS)
  view.hideZones(false)
  if (!skipped) await hold(DWELL_MS / 2)
  removeEventListener('pointerdown', skip, { capture: true })
  caption.remove()
  button.remove()
  view.hideZones(false)
  document.getElementById('drop')!.classList.remove('briefing')
}
