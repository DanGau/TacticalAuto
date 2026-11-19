// The battle view the UI drives: showing a run's battle, framing it, the intro's shots, and the player's camera.
import { BLAST_RADIUS, type Battle } from '../core/battle'
import type { GameEvent } from '../core/combat-event'
import { srcOf } from '../core/sources'
import { soldierUnit } from '../core/spawn'
import { overlaps, staggerOf } from '../core/pace'
import type { Run } from '../core/run-state'
import { level } from '../core/hero'
import { CLASSES } from '../core/classes'
import type { Frame } from '../ui/briefing'
import { drawTerrain } from './board'
import { aim, axes, bestTurn, clamped, framing, picture, setHeights, settled, setRinged, spot, WIDTH, type Camera } from './camera'
import { installControls } from './controls'
import { callout, chest, effectCallout, shotCallout, sourceCallout, tagText } from './effects'
import { drawFog, drawMarks } from './marks'
import { COLOR, SOURCE } from './palette'
import { play, team } from './play'
import { ACROSS, TILE_H, TILE_W, YAW } from './space'
import { create, remove, squash, sync } from './sprites'
import { Stage } from './stage'
import { empty } from './shapes'

/** Screen pixels the landing panel takes from the bottom of the canvas. */
const PANEL = 230
/** Screen pixels kept clear around what is in play, which sits in the middle of the screen above the panel. */
const WHOLE_MARGIN = PANEL - 20
/** The id of the hero's stand-in, shown readying at the landing in the intro. */
const STAND_IN = -1
/** How long the stand-in crouches, then springs up. */
const READY_MS = 700

export interface View {
  canvas: HTMLCanvasElement
  /**
   * Shows the run's battle, which `events` produced. Animated, it follows the action with the camera, plays the
   * events, and resolves when they finish. Still, it draws the whole map at once and marks each shot with a line.
   * Aliens unrevealed are never drawn; before the landing, every alien but burrowers shows.
   * Once landed, fog darkens every tile no soldier sees.
   */
  show(run: Run, events: GameEvent[], animate: boolean): Promise<void>
  /** Resolves once every attack begun has finished. */
  settle(): Promise<void>
  /** Hides the landing while the intro plays, and shows it once it is done. */
  hideLanding(hidden: boolean): void
  /** The turn the deploy screen is seen at; given one, sets it. */
  turn(yaw?: number): number
  /** Jumps the camera to an intro frame. */
  cut(frame: Frame): void
  /** Glides the camera to an intro frame over `ms` along `ease`. */
  shoot(frame: Frame, ms: number, ease: (t: number) => number): Promise<void>
  /** Shows the hero at the landing, readying itself. */
  ready(): void
  /** Glides the camera to the deploy framing over `ms`, and takes away the hero's stand-in. */
  frame(ms: number): Promise<void>
  /** The unit drawn under a point of the window, if any. */
  unitAt(x: number, y: number): number | null
}

export async function createView(): Promise<View> {
  const s = new Stage()
  const { canvas } = s
  /** The attacks of the stage under way, which the next beat that is not an attack waits for. */
  let attacks = Promise.resolve()
  /** The turn the deploy screen is seen at, once the intro has set it. */
  let deployTurn: number | null = null

  /** Clears the board for a new battle. */
  function setBattle(battle: Battle): void {
    s.shown = battle
    s.held = 0
    deployTurn = null
    setHeights(battle.height)
    setRinged(battle.arenaKind === 'skyscraper')
    for (const id of [...s.sprites.keys()]) remove(s, id)
    s.glows.clear()
    empty(s.lurk)
    drawTerrain(s, battle)
  }

  /**
   * The camera framing what is in play: before the landing it, the aliens and goals; after it, the hero and the
   * aliens it has found.
   */
  function inPlay(yaw = YAW): Camera {
    const battle = s.shown!
    const goals = [battle.objective]
    const units = battle.units.filter((u) => u.side === 'human' || battle.phase === 'deploy' || u.revealed)
    return framing([...(battle.phase === 'deploy' && battle.entry ? [battle.entry] : []), ...goals, ...units], yaw, WHOLE_MARGIN)
  }

  /** The turn the deploy screen is seen at: set by the intro, else a tall screen turns the map to lie down its length. */
  function turnOf(): number {
    const battle = s.shown
    if (deployTurn !== null || !battle) return deployTurn ?? YAW
    return innerHeight > innerWidth ? bestTurn([...(battle.entry ? [battle.entry] : []), ...battle.units.filter((u) => u.side === 'alien')], YAW) : YAW
  }

  /** The deploy framing, raised so the landing panel below covers none of it; in battle, what is in play. */
  function home(yaw = turnOf()): Camera {
    const battle = s.shown!
    if (battle.phase !== 'deploy') return clamped(inPlay(yaw), team(battle))
    const framed = inPlay(yaw)
    const { up } = axes(yaw)
    const lift = -PANEL / 2 / framed.zoom / ACROSS
    return clamped({ ...framed, x: framed.x + up.x * lift, y: framed.y + up.y * lift, z: framed.z + up.z * lift }, [...(battle.entry ? [battle.entry] : []), ...battle.units.filter((u) => u.side === 'alien')])
  }

  /** The camera on an intro frame: zoomed against the deploy framing, its subject on a third. */
  function shotOf(f: Frame): Camera {
    const yaw = turnOf() + f.orbit
    const zoom = home().zoom * f.zoom
    const ground = spot(f.x, f.y)
    const c = aim(picture(ground, yaw), zoom, yaw, ground.y)
    const { right } = axes(yaw)
    const aside = -(f.third * WIDTH) / 6 / zoom / ACROSS
    return clamped({ ...c, x: c.x + right.x * aside, z: c.z + right.z * aside })
  }

  const cam = installControls(s, home, (yaw) => s.shown?.phase === 'deploy' && (deployTurn = yaw))

  s.resize()
  return {
    canvas,
    unitAt: (x, y) => s.unitAt(x, y),
    turn(yaw) {
      if (yaw !== undefined) deployTurn = yaw
      return turnOf()
    },
    cut(f) {
      s.glides++
      s.held = 0
      s.look(shotOf(f))
    },
    shoot(f, ms, ease) {
      s.held = 0
      return s.follow(shotOf(f), ms, ease)
    },
    ready() {
      const battle = s.shown
      const soldier = battle?.reserve[0]
      if (!battle?.entry || !soldier || !s.hero) return
      remove(s, STAND_IN)
      const unit = { ...soldierUnit({ nextId: STAND_IN } as Battle, soldier, battle.entry), id: STAND_IN }
      const sprite = create(s, unit, level(s.hero), s.hero.cls ? CLASSES[s.hero.cls].name[0] : '')
      void s.tween(READY_MS, (t) => {
        const crouch = t < 0.4 ? t / 0.4 : 1 - (t - 0.4) / 0.6
        squash(sprite, 1 + 0.18 * crouch, 1 - 0.22 * crouch)
        if (t === 1) callout(s, '👁 READY', COLOR.hit, sprite)
      })
    },
    async frame(ms) {
      s.held = 0
      await s.follow(home(), ms)
      remove(s, STAND_IN)
      s.labels.clear()
    },
    hideLanding(hidden) {
      s.briefing = hidden
      if (s.shown) drawMarks(s, s.shown)
    },
    settle: () => attacks,
    async show(run, events, animate) {
      const { fx, sprites } = s
      s.hero = run.hero
      cam.hidden = run.phase !== 'battle' || !run.battle
      fx.clear()
      const battle = run.battle
      if (!battle) return
      s.scene.visible = true
      const fresh = battle !== s.shown
      if (fresh) setBattle(battle)
      drawMarks(s, battle)
      if (fresh && battle.phase === 'deploy') s.look(home())
      // An ambush opens already in the fight, on the team.
      if (fresh && battle.phase !== 'deploy') s.look(home(settled(s.camera.yaw)))
      if (animate && overlaps(events) && !events.some((e) => e.type === 'end')) {
        // An attack lets the next start a stagger later, so a side's attacks land one after another; the beat after them settles the picture.
        const playing = play(s, battle, events)
        attacks = Promise.all([attacks, playing]).then(() => {})
        await Promise.race([playing, s.tween(staggerOf(events), () => {})])
        return
      }
      if (animate) {
        await attacks
        await play(s, battle, events)
      }
      sync(s, run, battle)
      if (events.some((e) => e.type === 'rocket' || (e.type === 'effect' && e.effect === 'demolish'))) drawTerrain(s, battle)
      drawFog(s, battle, true)
      if (!animate) {
        if (battle.phase !== 'deploy') s.look(home(settled(s.camera.yaw)))
        s.labels.clear()
        for (const e of events) {
          if (e.type === 'effect' && sprites.has(e.id)) effectCallout(s, e, sprites.get(e.id)!)
          if (e.type === 'heal' && sprites.has(e.target)) sourceCallout(s, e.src, sprites.get(e.target)!, ` +${e.amount}`)
          if (e.type === 'rocket') {
            const c = s.toWorld(e.x, e.y)
            fx.ellipse(c.x, c.y, (BLAST_RADIUS + 0.7) * TILE_W, (BLAST_RADIUS + 0.7) * TILE_H).fill({ color: COLOR.crit, alpha: 0.4 })
          }
          if (e.type !== 'shot') continue
          const from = sprites.get(e.id)
          const to = sprites.get(e.target)
          // A unit this shot killed has left the battle.
          if (!from || !to) continue
          const a = chest(from)
          const b = chest(to)
          fx.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({ color: e.crit ? COLOR.crit : COLOR.hit, width: 3 })
          shotCallout(s, e, to)
          if (e.with.length > 0) callout(s, e.with.map((effect) => tagText(s, srcOf(effect))).join(' · '), SOURCE[e.src.kind].color, from)
        }
      }
      s.render()
    },
  }
}
