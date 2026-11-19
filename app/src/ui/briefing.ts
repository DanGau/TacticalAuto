// The mission intro: a shot list built from the battle's landmarks, and playing it over the deploy screen.
import { GRID, type Battle, type Tile } from '../core/battle'
import { EXAMS, type Exam } from '../core/exams'
import type { Poi } from '../core/pois'
import type { View } from '../view/view'

/** Zoom against the deploy framing: wide, medium and close. */
export const ZOOM = { wide: 1, medium: 1.6, hero: 2, close: 2.4 }
/** The most a shot orbits off the axis, either way, so the hero's side stays screen-left. */
export const ORBIT = (8 * Math.PI) / 180
const DEG = Math.PI / 180
/** A glide's shortest and longest; a shot's least hold. */
export const GLIDE_MS = [800, 1400]
export const HOLD_MS = 600
/** How long the intro lasts once its kind has been seen twice: one glide to the hero, and a hold. */
const QUICK_MS = 1500
/** Screen widths a glide may cross before it becomes a cut; screen widths a second at peak; zoom factor a second. */
const CUT_SCREENS = 1.5
const PEAK_SCREENS = 0.75
const ZOOM_RATE = 1.5
/** Tiles the screen spans across at the deploy framing. */
const SPAN = GRID / 2
/** Most words a caption takes. */
export const CAPTION_WORDS = 6

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
  /** The hero readies here. */
  hero?: boolean
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

const of = (p: Poi) => ({ ...p.frame })
const centre = (tiles: Tile[]): Tile => ({ x: tiles.reduce((s, t) => s + t.x, 0) / tiles.length, y: tiles.reduce((s, t) => s + t.y, 0) / tiles.length })

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

interface Beat {
  from: Frame
  to?: Frame
  ms: number
  caption?: string
  title?: string
  hero?: boolean
  cut?: boolean
}

/** Joins beats into shots: each glides from the last or, too far or marked, cuts; its hold fills the rest of its time. */
function join(beats: Beat[], glideFirst: Frame | null): Shot[] {
  let last = glideFirst
  return beats.map((b) => {
    const to = b.to ?? b.from
    const cut = !last || b.cut || cuts(last, b.from)
    const glide = cut ? 0 : glideMs(last!, b.from)
    last = to
    return { from: b.from, to, glide, hold: Math.max(HOLD_MS, b.ms - glide), caption: b.caption, title: b.title, hero: b.hero }
  })
}

/** Aliens in a nest's frame. */
const within = (battle: Battle, p: Poi) => battle.units.filter((u) => u.side === 'alien' && Math.max(Math.abs(u.x - p.frame.x), Math.abs(u.y - p.frame.y)) <= p.frame.extent)

/**
 * The intro for a battle at deploy, seen at the turn `yaw`: where we are, what is in the way, the ground, the goal, and
 * the hero alone at the landing. A boss opens close on it and pulls out. `seen` intros of its kind before shorten it.
 */
export function introShots(battle: Battle, order: string, hero: string, yaw: number, seen = 0): Intro {
  const at = (kind: Poi['kind']) => battle.pois.find((p) => p.kind === kind)
  const landing = at('landing')!
  const objective = at('objective')!
  const aliens = battle.units.filter((u) => u.side === 'alien')
  const nest = battle.pois.filter((p) => p.kind === 'nest').sort((p, q) => within(battle, q).length - within(battle, p).length)[0]
  const threat = nest ? { ...of(nest), x: nest.frame.x, y: nest.frame.y } : { ...centre(aliens), extent: 4 }
  const feature = at('hazard') ?? at('vantage')
  const boss = aliens.find((u) => u.boss)
  const turned = axisYaw(yaw, landing, boss ?? threat)
  const alone = `${hero || 'Your hero'} fights alone. Pick the kit.`
  const mid = centre([landing, objective])
  const heroBeat: Beat = { from: frame(landing, ZOOM.hero, 0, -1), to: frame(landing, ZOOM.hero * 1.05, (boss ? -4 : 2) * DEG, -1), ms: boss ? 1800 : 1500, caption: alone, hero: true }
  if (seen >= 2) {
    const [glide] = join([heroBeat], frame({ ...mid, extent: SPAN / 2 }, ZOOM.wide))
    return { yaw: turned, shots: [{ ...glide, glide: QUICK_MS - HOLD_MS, hold: HOLD_MS }] }
  }
  if (boss) {
    const exam = boss.effects.find((e): e is Exam => e in EXAMS)
    const name = exam ? `${EXAMS[exam].name} Guardian` : 'Guardian'
    const beats: Beat[] = [
      { from: frame(boss, ZOOM.close), ms: 1200 },
      { from: frame(boss, ZOOM.close), to: frame(boss, 1.3, 2 * DEG, 1), ms: 1800, title: name },
      { from: frame({ ...mid, extent: SPAN / 2 }, ZOOM.wide, -2 * DEG), to: frame({ ...mid, extent: SPAN / 2 }, ZOOM.wide * 1.08, 2 * DEG), ms: 1600, caption: `${order}.`, cut: true },
      ...(at('hazard') ? [{ from: frame(of(at('hazard')!), ZOOM.medium, 0, 1), to: frame(of(at('hazard')!), ZOOM.medium * 1.05, 2 * DEG, 1), ms: 1600 }] : []),
      ...(at('vantage') ? [{ from: frame(of(at('vantage')!), ZOOM.medium, 0, -1), to: frame(of(at('vantage')!), ZOOM.medium * 1.05, -2 * DEG, -1), ms: 1400 }] : []),
      heroBeat,
    ]
    return { yaw: turned, shots: join(seen === 1 ? [beats[1], beats[2], heroBeat] : beats, null) }
  }
  const featureCaption = feature?.kind === 'hazard' ? `Hazard: ${feature.label}.` : `High ground: ${feature?.label}.`
  const count = nest ? within(battle, nest).length : aliens.length
  const beats: Beat[] = [
    { from: frame({ ...mid, extent: SPAN / 2 }, ZOOM.wide), to: frame({ ...mid, extent: SPAN / 2 }, 1.1, 4 * DEG), ms: 1600, caption: `${landing.label}, ${battle.city}.` },
    { from: frame(threat, ZOOM.medium, 0, 1), to: frame(threat, ZOOM.medium * 1.05, 2 * DEG, 1), ms: 1800, caption: `${nest?.label ?? 'Aliens'}: ${count} aliens.` },
    ...(feature ? [{ from: frame(of(feature), ZOOM.medium), to: frame(of(feature), ZOOM.medium * 1.05, -2 * DEG), ms: 1200, caption: featureCaption }] : []),
    { from: frame(of(objective), ZOOM.medium, 0, 1), to: frame(of(objective), ZOOM.medium * 1.05, 2 * DEG, 1), ms: 1400, caption: `${order}.` },
    heroBeat,
  ]
  return { yaw: turned, shots: join(seen === 1 ? [beats[0], beats.at(-2)!, heroBeat] : beats, null) }
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
export async function brief(view: View, battle: Battle, order: string, hero: string, fresh = false): Promise<void> {
  const boss = battle.units.some((u) => u.side === 'alien' && u.boss)
  const kind = boss ? 'boss' : battle.goal
  const intro = introShots(battle, order, hero, view.turn(), fresh ? 0 : (played.get(kind) ?? 0))
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
    if (shot.hero) view.ready()
    // The first move after a cut lands hard; a hold after a glide drifts.
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
