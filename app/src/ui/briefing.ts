// The mission intro: a tour of the 3 to 5 points that matter this battle, built from its landmarks, and playing it over the deploy screen.
import { GRID, type Battle, type Tile } from '../core/battle'
import { ARENA_KINDS } from '../core/arena-kinds'
import { CHALLENGES } from '../core/challenges'
import { EXAMS, type Exam } from '../core/exams'
import { CIVILIANS, RESCUE_QUORUM } from '../core/goals'
import { groundPoi, type Poi } from '../core/pois'
import type { View } from '../view/view'

/** Zoom against the deploy framing: a point's opening, and how much closer its hold eases in. */
export const ZOOM = { point: 1.5, close: 2.2, quick: 1.3, push: 1.25 }
/** How far a point's hold orbits, either way off the axis, so the hero's side stays screen-left. */
export const ORBIT = (10 * Math.PI) / 180
/** A glide's shortest and longest; a point's shortest and longest hold. */
export const GLIDE_MS = [800, 1400]
export const HOLD_MS = [1500, 2500]
/** Points a tour shows, fewest and most. */
export const POINTS = [3, 5]
/** How long the intro lasts once its kind has been seen twice: one glide to the objective, and a hold. */
const QUICK_MS = 1500
/** Screen widths a glide may cross before it becomes a cut; screen widths a second at peak; zoom factor a second. */
const CUT_SCREENS = 1.5
const PEAK_SCREENS = 0.75
const ZOOM_RATE = 1.5
/** Tiles the screen spans across at the deploy framing. */
const SPAN = GRID / 2
/** Most words a caption takes. */
export const CAPTION_WORDS = 6
/** Nests a tour shows at most. */
const NESTS = 2

/** Where a shot looks: a square of tiles, `extent` from its centre each way, zoomed against the deploy framing, orbited off the axis, its subject on a third (-1 left, 1 right). */
export interface Frame {
  x: number
  y: number
  extent: number
  zoom: number
  orbit: number
  third: number
}

/** A shot: it glides in from the last (`glide` ms) or cuts, then holds, moving `from` to `to` over `hold` ms. */
export interface Shot {
  from: Frame
  to: Frame
  glide: number
  hold: number
  caption?: string
  title?: string
}

/** What the intro plays: the shots, and the turn that keeps the hero screen-left. */
export interface Intro {
  yaw: number
  shots: Shot[]
}

export const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2)
export const easeOutQuart = (t: number) => 1 - (1 - t) ** 4
export const easeInOutSine = (t: number) => -(Math.cos(Math.PI * t) - 1) / 2

/** Of `yaw` and its half turn, the one that shows `left` left of `right` on screen. */
export function axisYaw(yaw: number, left: Tile, right: Tile): number {
  // Screen right is (cos yaw, -sin yaw) over the ground's x and y.
  const across = (right.x - left.x) * Math.cos(yaw) - (right.y - left.y) * Math.sin(yaw)
  return across >= 0 ? yaw : yaw + Math.PI
}

const inside = (v: number, extent: number) => Math.min(GRID - 1 - extent, Math.max(extent, v))

/** A frame on `at`, kept inside the map. */
function frame(at: { x: number; y: number; extent?: number }, zoom: number, orbit = 0, third = 0): Frame {
  const extent = Math.min(at.extent ?? 3, (GRID - 1) / 2)
  return { x: inside(at.x, extent), y: inside(at.y, extent), extent, zoom, orbit, third }
}

/** How long a glide from `a` to `b` takes: steady enough to read, within GLIDE_MS. */
function glideMs(a: Frame, b: Frame): number {
  const screens = Math.hypot(b.x - a.x, b.y - a.y) / (SPAN / Math.max(a.zoom, b.zoom))
  const zoom = Math.abs(Math.log(b.zoom / a.zoom)) / Math.log(ZOOM_RATE)
  return Math.round(Math.min(GLIDE_MS[1], Math.max(GLIDE_MS[0], (1000 * 1.5 * screens) / PEAK_SCREENS / 2, 1000 * zoom)))
}

/** Whether `b` lies too far from `a` to glide to. */
export function cuts(a: Frame, b: Frame): boolean {
  return Math.hypot(b.x - a.x, b.y - a.y) / (SPAN / Math.max(a.zoom, b.zoom)) > CUT_SCREENS
}

/** A point the tour stops at: what it frames, how close it opens, how long it holds, and what it says. */
interface Point {
  at: { x: number; y: number; extent?: number }
  zoom: number
  ms: number
  caption?: string
  title?: string
}

/** Aliens in a landmark's frame. */
const within = (battle: Battle, p: Poi) => battle.units.filter((u) => u.side === 'alien' && Math.max(Math.abs(u.x - p.frame.x), Math.abs(u.y - p.frame.y)) <= p.frame.extent)

/** The points that matter this battle, in the order the tour shows them: a boss first, then the alien clusters, the ground's landmark where it has a feature, and the objective last. Landmarks fill a quiet battle up to 3; a busy one stops at 5. */
export function pointsOf(battle: Battle, order: string): Point[] {
  const landing = battle.pois.find((p) => p.kind === 'landing')!
  const objective = battle.pois.find((p) => p.kind === 'objective')!
  const boss = battle.units.find((u) => u.side === 'alien' && u.boss)
  const nests = battle.pois.filter((p) => p.kind === 'nest' && within(battle, p).length > 0).sort((p, q) => within(battle, q).length - within(battle, p).length).slice(0, boss ? 1 : NESTS)
  const ground = groundPoi(battle)
  const feature = (p: Poi): Point => ({ at: p.frame, zoom: ZOOM.point, ms: 1800, caption: p.kind === 'hazard' ? `Hazard: ${p.label}.` : `High ground: ${p.label}.` })
  const nest = (p: Poi, i: number): Point => ({ at: p.frame, zoom: ZOOM.point, ms: 2200, caption: `${i === 0 && battle.challenge ? CHALLENGES[battle.challenge].name : p.label}: ${within(battle, p).length} aliens.` })
  const exam = boss?.effects.find((e): e is Exam => e in EXAMS)
  const goal: Point = boss
    ? { at: { x: boss.x, y: boss.y, extent: 3 }, zoom: ZOOM.close, ms: 2500, title: exam ? `${EXAMS[exam].name} Guardian` : 'Guardian', caption: `${order}.` }
    : { at: objective.frame, zoom: ZOOM.point, ms: 2000, caption: battle.goal === 'rescue' ? `${CIVILIANS} civilians. Save ${RESCUE_QUORUM + 1}.` : `${order}.` }
  const far = (p: Point) => Math.hypot(p.at.x - landing.x, p.at.y - landing.y)
  const middle = [...nests.map(nest), ...(ground && ARENA_KINDS[battle.arenaKind].reads.length > 0 ? [feature(ground)] : [])]
  // A quiet battle shows its other landmarks, nearest the landing first.
  const spare = battle.pois.filter((p) => (p.kind === 'hazard' || p.kind === 'vantage' || p.kind === 'strongpoint') && p !== ground).sort((p, q) => Math.hypot(p.x - landing.x, p.y - landing.y) - Math.hypot(q.x - landing.x, q.y - landing.y))
  for (const p of spare) if (middle.length + 1 < POINTS[0]) middle.push(p.kind === 'strongpoint' ? { at: p.frame, zoom: ZOOM.point, ms: 1600, caption: `Cover: ${p.label}.` } : feature(p))
  const tour = middle.sort((a, b) => far(a) - far(b)).slice(0, POINTS[1] - 1)
  // A boss opens the tour, close, and the objective it guards needs no second stop.
  return boss ? [goal, ...tour] : [...tour, goal]
}

/** A point held: opened from one side of the axis, it orbits slowly to the other and eases in. */
function shotAt(p: Point, i: number): { from: Frame; to: Frame } {
  const side = i % 2 === 0 ? 1 : -1
  return { from: frame(p.at, p.zoom, -side * ORBIT, 0), to: frame(p.at, p.zoom * ZOOM.push, side * ORBIT, 0) }
}

/** Joins points into shots: each glides from the last or, too far, cuts; its hold fills the rest of its time. */
function join(points: Point[], hold?: number): Shot[] {
  let last: Frame | null = null
  return points.map((p, i) => {
    const { from, to } = shotAt(p, i)
    const glide = !last || cuts(last, from) ? 0 : glideMs(last, from)
    last = to
    return { from, to, glide, hold: Math.min(HOLD_MS[1], Math.max(HOLD_MS[0], hold ?? p.ms)), caption: p.caption, title: p.title }
  })
}

/**
 * The intro for a battle at deploy, seen at the turn `yaw`: a tour of the points that matter, each held while the
 * camera orbits slowly and eases in. `seen` intros of its kind before shorten it: to its first and last points, then to
 * one glide onto the last.
 */
export function introShots(battle: Battle, order: string, yaw: number, seen = 0): Intro {
  const points = pointsOf(battle, order)
  const landing = battle.pois.find((p) => p.kind === 'landing')!
  const boss = battle.units.find((u) => u.side === 'alien' && u.boss)
  const turned = axisYaw(yaw, landing, boss ?? points.at(-1)!.at)
  if (seen >= 2) {
    const end = points.at(-1)!
    const from = frame({ x: (landing.x + end.at.x) / 2, y: (landing.y + end.at.y) / 2, extent: SPAN / 2 }, 1)
    const to = frame(end.at, ZOOM.quick)
    return { yaw: turned, shots: [{ from, to, glide: 0, hold: QUICK_MS, caption: end.caption, title: end.title }] }
  }
  return { yaw: turned, shots: seen === 1 ? join([points[0], points.at(-1)!], HOLD_MS[0]) : join(points) }
}

/** The pause before the deploy screen, the ease to it, and the ease on a skip. */
const BEAT_MS = 400
const HANDOFF_MS = 400
const SKIP_MS = 250
/** When the skip hint shows; a caption's lead in after a shot settles, and out before a cut. */
const HINT_MS = 500
const CAPTION_IN = 200
const CAPTION_OUT = 150

/** Intros played, by kind of mission, so repeats shorten. */
const played = new Map<string, number>()

/** Plays the intro over the deploy screen; a tap or any key skips to it. `fresh` plays it in full, as if never seen. */
export async function brief(view: View, battle: Battle, order: string, fresh = false): Promise<void> {
  const boss = battle.units.some((u) => u.side === 'alien' && u.boss)
  const kind = boss ? 'boss' : battle.goal
  const intro = introShots(battle, order, view.turn(), fresh ? 0 : (played.get(kind) ?? 0))
  played.set(kind, (played.get(kind) ?? 0) + 1)
  view.turn(intro.yaw)
  const drop = document.getElementById('drop')!
  const caption = Object.assign(document.createElement('div'), { className: 'brief' })
  const title = Object.assign(document.createElement('div'), { className: 'title-card' })
  const hint = Object.assign(document.createElement('div'), { className: 'skip-hint', textContent: 'Tap to skip' })
  document.body.append(caption, title, hint)
  drop.classList.add('briefing')
  document.body.classList.add('cinema')
  view.hideLanding(true)
  let skipped = false
  let wake = () => {}
  const skip = (e: Event) => {
    e.stopPropagation()
    skipped = true
    wake()
  }
  addEventListener('pointerdown', skip, { capture: true })
  addEventListener('keydown', skip, { capture: true })
  const wait = (ms: number) => new Promise<void>((done) => ((wake = done), setTimeout(done, ms)))
  const shown = setTimeout(() => hint.classList.add('on'), HINT_MS)
  const say = (el: HTMLElement, text?: string) => {
    el.textContent = text ?? ''
    el.classList.toggle('on', !!text)
  }
  for (const [i, shot] of intro.shots.entries()) {
    if (skipped) break
    const next = intro.shots[i + 1]
    if (shot.glide > 0) await Promise.race([view.shoot(shot.from, shot.glide, easeInOutCubic), wait(shot.glide)])
    else view.cut(shot.from)
    if (skipped) break
    // The first move after a cut lands hard; a hold after a glide orbits on smoothly.
    void view.shoot(shot.to, shot.hold, shot.glide > 0 ? easeInOutSine : easeOutQuart)
    say(title, shot.title)
    if (await held(CAPTION_IN)) break
    say(caption, shot.caption)
    const cutNext = !next || next.glide === 0
    if (await held(shot.hold - CAPTION_IN - (cutNext ? CAPTION_OUT : 0))) break
    if (cutNext) say(caption)
    if (cutNext && (await held(CAPTION_OUT))) break
  }
  say(caption)
  say(title)
  clearTimeout(shown)
  hint.remove()
  if (!skipped) await wait(BEAT_MS)
  document.body.classList.remove('cinema')
  await view.frame(skipped ? SKIP_MS : HANDOFF_MS)
  view.hideLanding(false)
  drop.classList.remove('briefing')
  removeEventListener('pointerdown', skip, { capture: true })
  removeEventListener('keydown', skip, { capture: true })
  caption.remove()
  title.remove()

  /** Waits `ms`, and says whether a skip cut it short. */
  async function held(ms: number): Promise<boolean> {
    await wait(Math.max(0, ms))
    return skipped
  }
}
