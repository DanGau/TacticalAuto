// The battle view the UI drives: showing a run's battle, picking and framing landing zones, and panning.
import { AdditiveBlending, BoxGeometry, CircleGeometry, Mesh, MeshBasicMaterial, Raycaster, Vector2 } from 'three'
import { BLAST_RADIUS, revealed, ZONE_RADIUS, type Battle, type Tile } from '../core/battle'
import type { GameEvent } from '../core/combat-event'
import { effectName } from '../core/effects'
import { distance, nearestAlien } from '../core/grid'
import { overlaps, PACE } from '../core/pace'
import type { Run } from '../core/run-state'
import { drawTerrain } from './board'
import { axes, clamped, DECAL_LIFT, framing, setHeights, spot, STILL_FOV, WIDTH, type Camera, type Shot } from './camera'
import { callout, chest, effectCallout, shotCallout } from './effects'
import { dropPods } from './landing'
import { drawFog, drawMarks } from './marks'
import { COLOR } from './palette'
import { play, squad } from './play'
import { ACROSS, PITCH, TILE_H, TILE_W, YAW } from './space'
import { remove, sync } from './sprites'
import { Stage } from './stage'
import { empty } from './shapes'

/** Screen pixels a press moves before it pans the camera. */
const DRAG_PX = 6
/** How long the camera takes to glide to a landing zone, and to fly in over a new battle. */
const FOCUS_MS = 700
const FLY_MS = 1600
/** Screen pixels the landing panel takes from the bottom of the canvas. */
const PANEL = 110
/** Screen pixels kept clear around what is in play, which sits in the middle of the screen above the panel. */
const WHOLE_MARGIN = PANEL - 20

/** The opening shot of a new battle, which the briefing flies on from. */
const OPENING: Shot = { turn: -1.1, pitch: -0.32, fov: 42, haze: 1 }

export interface View {
  canvas: HTMLCanvasElement
  /**
   * Shows the run's battle, which `events` produced. Animated, it follows the action with the camera, plays the
   * events, and resolves when they finish. Still, it draws the whole map at once and marks each shot with a line.
   * Aliens in unrevealed pods are never drawn; before the landing, each pod shows as a contact marker.
   * Once landed, fog darkens every tile no soldier sees.
   */
  show(run: Run, events: GameEvent[], animate: boolean): Promise<void>
  /** Resolves once every attack begun has finished. */
  settle(): Promise<void>
  /** The landing zone under a point on the canvas as displayed, as an index into battle.zones; null when there is none to choose. */
  zoneAt(sx: number, sy: number): number | null
  /** Before the landing, glides the camera to a landing zone and marks its way in; null pulls back to the whole map. */
  focus(zone: number | null): void
  /** Hides the landing zones while the briefing flies over the mission, and shows them once it is done. */
  hideZones(hidden: boolean): void
  /** Glides the camera to frame the given tiles as `shot` says, above the landing panel; null pulls back to the whole map. */
  frame(tiles: Tile[] | null, ms?: number, shot?: Shot): Promise<void>
  /** Lights a beam over the tile the briefing is on, so it stands out from the night; null puts it out. */
  spotlight(tile: Tile | null): void
}

export async function createView(): Promise<View> {
  const s = new Stage()
  const { canvas } = s
  /** Whether the battle last shown was waiting for the landing, so the next one shown plays it. */
  let deploying = false
  /** The attacks of the stage under way, which the next beat that is not an attack waits for. */
  let attacks = Promise.resolve()

  const raycaster = new Raycaster()
  function zoneAt(px: number, py: number): number | null {
    const { shown } = s
    if (shown?.phase !== 'deploy') return null
    raycaster.setFromCamera(new Vector2((px / innerWidth) * 2 - 1, 1 - (py / innerHeight) * 2), s.eye)
    const hit = raycaster.intersectObject(s.terrain.children[0])[0]
    if (!hit) return null
    const tile = { x: Math.round(hit.point.x), y: Math.round(hit.point.z) }
    const index = shown.zones.findIndex((zone) => distance(zone, tile) <= ZONE_RADIUS)
    return index < 0 ? null : index
  }

  /** Clears the board for a new battle. */
  function setBattle(battle: Battle): void {
    s.shown = battle
    setHeights(battle.height)
    s.selected = null
    for (const id of [...s.sprites.keys()]) remove(s, id)
    s.glows.clear()
    empty(s.lurk)
    drawTerrain(s, battle)
  }

  // Dragging pans the still camera; the next glide to the action takes it back. A drag is not a click.
  let drag: { x: number; y: number; moved: boolean } | null = null
  canvas.addEventListener('pointerdown', (e) => (drag = { x: e.clientX, y: e.clientY, moved: false }))
  addEventListener('pointerup', () => setTimeout(() => (drag = null)))
  canvas.addEventListener(
    'click',
    (e) => {
      if (drag?.moved) e.stopImmediatePropagation()
    },
    { capture: true },
  )
  canvas.addEventListener('pointermove', (e) => {
    const { camera } = s
    if (drag && (drag.moved || Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > DRAG_PX) && camera.fov <= STILL_FOV) {
      drag.moved = true
      const { right, up } = axes(camera.yaw, camera.pitch)
      const per = s.scale() * ACROSS
      const dx = -(e.clientX - drag.x) / per
      const dy = (e.clientY - drag.y) / per
      Object.assign(drag, { x: e.clientX, y: e.clientY })
      s.glides++
      s.look(clamped({ ...camera, x: camera.x + right.x * dx + up.x * dy, y: camera.y + up.y * dy, z: camera.z + right.z * dx + up.z * dy }))
    }
    const zone = zoneAt(e.offsetX, e.offsetY)
    canvas.style.cursor = zone === null ? 'default' : 'pointer'
    if (zone === s.hovered || !s.shown) return
    s.hovered = zone
    drawMarks(s, s.shown)
  })

  /** What the camera frames for a landing zone: the zone, and the uplink or nearest contact it heads for. */
  function zoneView(battle: Battle, zone: Tile): Tile[] {
    const reach = ZONE_RADIUS + 2
    const toward = battle.uplink ?? nearestAlien(battle, zone)
    return [{ x: zone.x - reach, y: zone.y - reach }, { x: zone.x + reach, y: zone.y + reach }, ...(toward ? [toward] : [])]
  }

  /**
   * The camera framing what is in play: before the landing its zones, pods and goals; after it, the squad and the
   * aliens it has found.
   */
  function inPlay(yaw = YAW): Camera {
    const battle = s.shown!
    const goals = [battle.uplink, battle.extract, ...battle.caches].filter((t): t is Tile => t !== null)
    const units = battle.units.filter((u) => u.side === 'human' || battle.phase === 'deploy' || revealed(battle, u))
    return framing([...(battle.phase === 'deploy' ? battle.zones : []), ...goals, ...units], yaw, WHOLE_MARGIN)
  }

  /**
   * The camera framing `tiles` as `shot` says, raised so the landing panel below covers none of it; null frames what
   * is in play. A subject on a third is set off the centre, the screen's other two thirds left open before it.
   */
  function above(tiles: Tile[] | null, shot: Shot = {}): Camera {
    const yaw = YAW + (shot.turn ?? 0)
    const framed = tiles === null ? inPlay(yaw) : framing(tiles, yaw)
    const { up, right } = axes(yaw)
    const lift = -(tiles === null ? PANEL / 2 : PANEL) / framed.zoom / ACROSS
    const aside = -((shot.third ?? 0) * WIDTH) / 6 / framed.zoom / ACROSS
    return clamped({
      ...framed,
      x: framed.x + up.x * lift + right.x * aside,
      y: framed.y + up.y * lift,
      z: framed.z + up.z * lift + right.z * aside,
      pitch: PITCH + (shot.pitch ?? 0),
      fov: shot.fov ?? STILL_FOV,
      haze: shot.haze ?? 0,
    })
  }

  s.resize()
  return {
    canvas,
    zoneAt,
    frame(tiles, ms = FOCUS_MS, shot = {}) {
      return s.follow(above(tiles, shot), ms)
    },
    spotlight(tile) {
      s.lit = tile
      s.beam.clear()
      if (!tile) return
      const at = spot(tile.x, tile.y)
      // A warm shaft against the cool night, brightest at its foot.
      for (const [wide, high, alpha] of [[1.6, 14, 0.1], [0.7, 18, 0.16], [0.25, 22, 0.3]]) {
        const shaft = new Mesh(new BoxGeometry(wide, high, wide), new MeshBasicMaterial({ color: COLOR.hit, transparent: true, opacity: alpha, blending: AdditiveBlending, depthWrite: false, fog: false }))
        shaft.position.set(at.x, at.y + high / 2, at.z)
        s.beam.add(shaft)
      }
      const pool = new Mesh(new CircleGeometry(2.2, 32).rotateX(-Math.PI / 2), new MeshBasicMaterial({ color: COLOR.hit, transparent: true, opacity: 0.22, blending: AdditiveBlending, depthWrite: false, fog: false }))
      pool.position.set(at.x, at.y + DECAL_LIFT * 5, at.z)
      s.beam.add(pool)
    },
    hideZones(hidden) {
      s.briefing = hidden
      if (s.shown) drawMarks(s, s.shown)
    },
    focus(zone) {
      const { shown } = s
      if (shown?.phase !== 'deploy') return
      s.selected = zone
      drawMarks(s, shown)
      void s.follow(above(zone === null ? null : zoneView(shown, shown.zones[zone])), FOCUS_MS)
    },
    settle: () => attacks,
    async show(run, events, animate) {
      const { fx, sprites } = s
      s.soldiers = run.soldiers
      s.blademasters = run.doctrines.includes('blades')
      fx.clear()
      const battle = run.battle
      if (!battle) return
      s.scene.visible = true
      const fresh = battle !== s.shown
      if (fresh) setBattle(battle)
      drawMarks(s, battle)
      // A new battle opens flying in from high above, turning, down to what is in play.
      if (fresh && battle.phase === 'deploy') {
        // An establishing shot: low over the far side of the town, looking in across its rooftops through the haze.
        s.look(above(null, OPENING))
        void s.follow(above(null), FLY_MS)
      }
      // An ambush opens already in the fight, on the squad.
      if (fresh && battle.phase !== 'deploy') s.look(clamped(inPlay(), squad(battle)))
      if (animate && overlaps(events) && !events.some((e) => e.type === 'end')) {
        // An attack lets the next start a stagger later, so a side's attacks land one after another; the beat after them settles the picture.
        const playing = play(s, battle, events)
        attacks = Promise.all([attacks, playing]).then(() => {})
        await Promise.race([playing, s.tween(PACE.stagger, () => {})])
        return
      }
      if (animate) {
        await attacks
        await play(s, battle, events)
      }
      sync(s, run, battle)
      if (events.some((e) => e.type === 'rocket' || (e.type === 'effect' && e.effect === 'demolish'))) drawTerrain(s, battle)
      drawFog(s, battle, true)
      const landed = deploying && battle.phase !== 'deploy'
      deploying = battle.phase === 'deploy'
      if (landed && animate) await dropPods(s, battle)
      if (!animate) {
        if (battle.phase !== 'deploy') s.look(clamped(inPlay(), squad(battle)))
        s.labels.clear()
        for (const e of events) {
          if (e.type === 'effect' && sprites.has(e.id)) effectCallout(s, e, sprites.get(e.id)!)
          if (e.type === 'heal' && sprites.has(e.target)) callout(s, `HEAL +${e.amount}`, COLOR.heal, sprites.get(e.target)!)
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
          fx.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({ color: e.crit ? COLOR.crit : e.hit ? COLOR.hit : COLOR.miss, width: 3 })
          shotCallout(s, e, to)
          if (e.with.length > 0) callout(s, e.with.map((effect) => effectName(effect, s.kit()).toUpperCase()).join(' · '), 0xffffff, from)
        }
      }
      s.render()
    },
  }
}
