// Units on the board: each one's picture with its health pips, and moving, squashing, fading and removing it.
import { CanvasTexture, CircleGeometry, Group, Mesh, MeshBasicMaterial, Sprite as Billboard, SpriteMaterial } from 'three'
import { ALIENS } from '../core/aliens'
import { revealed, type Battle, type Tile, type Unit } from '../core/battle'
import { CLASSES } from '../core/classes'
import { type Run } from '../core/run-state'
import { level } from '../core/squad'
import { axes, DECAL_LIFT, picture, spot } from './camera'
import { drawAcid } from './marks'
import { ALIEN_LOOK, COLOR } from './palette'
import { css } from './shapes'
import { ACROSS } from './space'
import type { Sprite, Stage } from './stage'

/** A health pip's size on screen, the step from one pip to the next, and the width of a row of ten. */
const PIP = 5
const PIP_STEP = 6
const PIP_ROW = 10 * PIP_STEP - 1
/** A unit's picture, in screen pixels about its feet, and the pixels per one drawn, for a crisp edge. */
const BODY = { left: 36, up: 100, down: 4 }
const BODY_RES = 2

/** The letter over a unit that is no soldier: its kind's initial, C for a commander, nothing for a boss or civilian. */
export const letter = (unit: Unit) => (unit.target ? 'C' : unit.summoner !== null ? 'M' : unit.boss || !unit.kind ? '' : ALIENS[unit.kind].name[0])

/** Stands a sprite on a tile. */
export function place(s: Stage, sprite: Sprite, tile: Tile): void {
  sprite.tile = tile
  const p = spot(tile.x, tile.y)
  sprite.node.position.set(p.x, p.y, p.z)
  sprite.at = s.toWorld(tile.x, tile.y)
}

/** Moves a sprite's feet off its tile to `at` in the camera's picture, as a lunge, knockback or fall does. */
export function shift(s: Stage, sprite: Sprite, at: Tile): void {
  const p = spot(sprite.tile.x, sprite.tile.y)
  const home = picture(p, s.camera.yaw)
  const { right, up } = axes(s.camera.yaw)
  sprite.node.position.set(p.x, p.y, p.z).addScaledVector(right, (at.x - home.x) / ACROSS).addScaledVector(up, -(at.y - home.y) / ACROSS)
  sprite.at = at
}

/** Stretches a sprite's picture by `wide` across and `high` up, as a blow squashes it. */
export function squash(sprite: Sprite, wide: number, high: number): void {
  const size = (sprite.scale * BODY_RES) / ACROSS
  sprite.body.scale.set((2 * BODY.left * size * wide) / BODY_RES, ((BODY.up + BODY.down) * size * high) / BODY_RES, 1)
}

export function fade(sprite: Sprite, alpha: number): void {
  ;(sprite.body.material as SpriteMaterial).opacity = alpha
  ;(sprite.shadow.material as MeshBasicMaterial).opacity = 0.4 * alpha
}

/** A unit's health and armor in the battle; none of either once it is gone. */
export const vitals = (battle: Battle, id: number): [number, number] => {
  const unit = battle.units.find((u) => u.id === id)
  return [unit?.hp ?? 0, unit?.armor ?? 0]
}

/**
 * `pips` marks a soldier's level above its health; `letter` is the initial of its class. Its health and armor show as
 * pips, one each, ten to a row, rows stacking upward: health left in green on an ally and red on an enemy, health
 * lost in a dark shade of it, then armor in yellow.
 */
export function create(s: Stage, unit: Unit, pips: number, letter = ''): Sprite {
  const picture = document.createElement('canvas')
  picture.width = 2 * BODY.left * BODY_RES
  picture.height = (BODY.up + BODY.down) * BODY_RES
  const g = picture.getContext('2d')!
  const texture = new CanvasTexture(picture)
  const body = new Billboard(new SpriteMaterial({ map: texture, transparent: true, depthWrite: false }))
  body.center.set(0.5, BODY.down / (BODY.up + BODY.down))
  const shadow = new Mesh(new CircleGeometry(14 / ACROSS, 20).rotateX(-Math.PI / 2), new MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.4, depthWrite: false }))
  shadow.position.y = DECAL_LIFT * 2
  const node = new Group()
  node.add(shadow, body)
  const color = unit.boss || unit.target ? COLOR.boss : unit.civilian ? COLOR[unit.civilian] : unit.summoner !== null ? COLOR.mech : unit.kind ? ALIEN_LOOK[unit.kind].color : COLOR.human
  const rows = Math.ceil((unit.stats.hp + unit.stats.armor) / 10)
  const maxHp = unit.stats.hp
  const ally = unit.side === 'human'
  const sprite: Sprite = {
    node,
    body,
    shadow,
    tile: unit,
    at: { x: 0, y: 0 },
    scale: unit.boss ? 1.6 : unit.target ? 1.3 : unit.kind ? ALIEN_LOOK[unit.kind].scale : 1,
    ally,
    drawHp(hp, armor) {
      g.setTransform(BODY_RES, 0, 0, BODY_RES, BODY.left * BODY_RES, BODY.up * BODY_RES)
      g.clearRect(-BODY.left, -BODY.up, 2 * BODY.left, BODY.up + BODY.down)
      g.fillStyle = css(color)
      g.beginPath()
      // A hider crouches low and wide; a runner stands tall and thin.
      if (unit.civilian === 'hider') g.roundRect(-14, -22, 28, 22, 10)
      else if (unit.civilian === 'runner') g.roundRect(-6, -34, 12, 34, 6)
      else g.roundRect(-9, -30, 18, 30, 6)
      g.fill()
      // A VIP wears a gold star.
      if (unit.civilian === 'vip') {
        g.fillStyle = css(COLOR.uplink)
        g.beginPath()
        for (let i = 0; i < 10; i++) g.lineTo((i % 2 ? 3 : 7) * Math.sin((i * Math.PI) / 5), -17 - (i % 2 ? 3 : 7) * Math.cos((i * Math.PI) / 5))
        g.fill()
      }
      g.fillStyle = css(COLOR.human)
      for (let i = 0; i < pips; i++) {
        g.beginPath()
        g.arc(-9 + 6 * i, -40 - rows * PIP_STEP, 2, 0, Math.PI * 2)
        g.fill()
      }
      if (letter) {
        g.fillStyle = css(0x10141c)
        g.font = 'bold 13px sans-serif'
        g.textAlign = 'center'
        g.textBaseline = 'middle'
        g.fillText(letter, 0, -17)
      }
      const lost = maxHp - Math.max(hp, 0)
      const colors = [...Array(Math.max(hp, 0)).fill(ally ? COLOR.allyHp : COLOR.enemyHp), ...Array(Math.max(lost, 0)).fill(ally ? COLOR.allyLost : COLOR.enemyLost), ...Array(armor).fill(COLOR.hit)]
      colors.forEach((c, i) => {
        g.fillStyle = css(c)
        g.fillRect(-PIP_ROW / 2 + (i % 10) * PIP_STEP, -38 - Math.floor(i / 10) * PIP_STEP, PIP, PIP)
      })
      texture.needsUpdate = true
    },
  }
  node.scale.setScalar(1)
  shadow.scale.setScalar(sprite.scale)
  squash(sprite, 1, 1)
  s.units.add(node)
  s.sprites.set(unit.id, sprite)
  place(s, sprite, { x: unit.x, y: unit.y })
  sprite.drawHp(unit.hp, unit.armor)
  return sprite
}

export function remove(s: Stage, id: number): void {
  const sprite = s.sprites.get(id)
  if (!sprite) return
  s.units.remove(sprite.node)
  ;(sprite.body.material as SpriteMaterial).map?.dispose()
  s.sprites.delete(id)
}

/** Makes the sprites match the battle exactly. */
export function sync(s: Stage, run: Run, battle: Battle): void {
  drawAcid(s, battle)
  const visible = battle.units.filter((u) => revealed(battle, u))
  const live = new Set(visible.map((u) => u.id))
  for (const id of [...s.sprites.keys()]) if (!live.has(id)) remove(s, id)
  for (const unit of visible) {
    const soldier = run.soldiers.find((member) => member.id === unit.soldier)
    const sprite = s.sprites.get(unit.id) ?? create(s, unit, soldier ? level(soldier) : 0, soldier?.cls ? CLASSES[soldier.cls].name[0] : letter(unit))
    place(s, sprite, { x: unit.x, y: unit.y })
    fade(sprite, 1)
    sprite.drawHp(unit.hp, unit.armor)
  }
}
