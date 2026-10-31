import type { GameEvent } from './combat-event'

/** How long the view takes to play each kind of event, in ms. The view animates by these; the sim times battles by them. */
export const PACE = {
  /** An alien walking one tile; a soldier dashing one, quick and decisive; the squad creeping one while unseen. */
  tile: 110,
  dash: 55,
  creep: 200,
  /** The longest a side's moves take: everyone walks together and arrives together, a long way briskly. */
  march: 700,
  /** Units appearing, and dying or leaving. */
  reveal: 450,
  death: 260,
  /** A typical attack, muzzle to sparks. */
  attack: 450,
  /** Between the starts of one attack and the next in a side's attack stage, so each attack reads on its own. */
  stagger: 380,
  /** The pause as the turn passes to the other side, while its banner sweeps across. */
  turn: 700,
  psi: 320,
  rocket: 320,
  blast: 380,
}

/** Whether a beat is one attack of a side's attack stage, which the next beat may start over. */
export const overlaps = (events: GameEvent[]) => events.some((e) => e.type === 'shot' || e.type === 'rocket' || e.type === 'spit' || e.type === 'panic')

/** Events the view shows at once, as a word over a unit or a change of marks, without waiting on them. */
const INSTANT = new Set<GameEvent['type']>(['order', 'feed', 'effect', 'carried', 'grabbed', 'extract', 'frozen', 'hurt', 'heal'])
export const instant = (e: GameEvent) => INSTANT.has(e.type)

/** A unit's ms per tile. */
export const tilePace = (ally: boolean, concealed: boolean) => (!ally ? PACE.tile : concealed ? PACE.creep : PACE.dash)

/** Tiles walked along `path`, each step's length, the first counted as one. */
export const walked = (path: { x: number; y: number }[]) => path.reduce((sum, p, i) => sum + (i === 0 ? 1 : Math.hypot(p.x - path[i - 1].x, p.y - path[i - 1].y)), 0)

/** How long moves in a row take together: the slowest walk, but no longer than a march. `pace` is each walker's ms per tile. */
export const walkMs = (moves: { path: { x: number; y: number }[]; pace: number }[]) => Math.min(PACE.march, Math.max(0, ...moves.map((m) => m.pace * walked(m.path))))

/**
 * How long the view plays one beat's events, one after another; moves in a row, among instant events, walk together.
 * `pace` gives each unit's ms per tile; units appear only if `shown`.
 */
export function beatMs(events: GameEvent[], pace: Map<number, number>, shown: Set<number>): number {
  let ms = 0
  let walk = 0
  for (const e of events) {
    if (e.type === 'move') {
      if (pace.has(e.id)) walk = Math.max(walk, walkMs([{ path: e.path, pace: pace.get(e.id)! }]))
      continue
    }
    if (instant(e)) continue
    ms += walk
    walk = 0
    if (e.type === 'shot') ms += PACE.attack
    else if (e.type === 'rocket') ms += PACE.rocket + PACE.blast
    else if (e.type === 'spit' || e.type === 'panic') ms += PACE.psi
    else if (e.type === 'reveal' || e.type === 'wave' || e.type === 'sighted') ms += e.units.some((u) => shown.has(u.id)) ? PACE.reveal : 0
    else if (e.type === 'spawn' || e.type === 'freed') ms += shown.has(e.unit.id) ? PACE.reveal : 0
    else if (e.type === 'death' || e.type === 'saved' || e.type === 'escaped') ms += PACE.death
    else if (e.type === 'used') ms += PACE.reveal
  }
  return ms + walk
}

/** A battle's playback so far: when the next beat may start, and when everything begun has finished. */
export interface Clock {
  next: number
  done: number
}

/** The clock once a beat lasting `ms` plays: an attack starts at once and lets the next start a stagger later; anything else waits for all before it. */
export function tick(clock: Clock, ms: number, attack: boolean): Clock {
  const start = attack ? clock.next : clock.done
  const end = start + ms
  return { next: attack ? start + Math.min(ms, PACE.stagger) : end, done: Math.max(clock.done, end) }
}
