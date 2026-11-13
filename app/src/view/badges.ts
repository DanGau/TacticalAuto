// The stacks and counts a unit's token shows over its health: burn, chill, marks, Might, kept armor, a combo, exposure, the next every-Nth.
import { CADENCE, FAULT, type Unit } from '../core/battle'
import { has } from '../core/fighters'
import { CanvasTexture, Sprite as Billboard, SpriteMaterial } from 'three'
import { css } from './shapes'

/** A badge: a short word and the colour of its pill. */
export interface Badge {
  text: string
  color: number
}

const BURN = 0xff7a1a
const CHILL = 0x7fd6ff
const MIGHT = 0xe8433a
const MARK = 0xd36bff
const ARMOR = 0xf2c94c
const COUNT = 0xb8c0cc

/** What `unit` has built this battle, as badges; none for a unit with nothing. */
export function badges(unit: Unit): Badge[] {
  const out: Badge[] = []
  if (unit.burn > 0) out.push({ text: `🔥${unit.burn}`, color: BURN })
  if (unit.frozen) out.push({ text: 'ICE', color: CHILL })
  else if (unit.chill > 0) out.push({ text: `❄️${unit.chill}`, color: CHILL })
  if (unit.mark > 0) out.push({ text: `🎯${unit.mark}`, color: MARK })
  if (unit.might > 0) out.push({ text: `⚔️${unit.might}`, color: MIGHT })
  if (unit.armor > unit.stats.armor && has(unit, 'lasting')) out.push({ text: `+${unit.armor - unit.stats.armor}`, color: ARMOR })
  if (unit.exposed > 0) out.push({ text: '!', color: MIGHT })
  if (unit.twice) out.push({ text: '×2', color: ARMOR })
  if (has(unit, 'combo') && unit.combo > 1) out.push({ text: `◎${Math.min(unit.combo, 9)}`, color: COUNT })
  if (has(unit, 'cadence')) out.push({ text: `${unit.hits % CADENCE}/${CADENCE}`, color: COUNT })
  if (has(unit, 'faultLine')) out.push({ text: `${unit.hits % FAULT.every}/${FAULT.every}`, color: COUNT })
  return out
}

/** Screen pixels a pill stands high, the gap between pills, and the board's size, which holds two rows. */
const PILL = 19
const GAP = 3
const BOARD = { wide: 150, high: 2 * PILL + GAP }
const RES = 2

/** How high over a unit's feet its badges sit, in picture pixels at a soldier's size. */
export const BADGE_UP = 64

/** A unit's badges as a board over its head that keeps its size on screen however far the camera stands. */
export interface BadgeBoard {
  board: Billboard
  redraw(marks: Badge[]): void
  /** Sizes it for a camera of `fov` degrees, each frame, as the camera zooms. */
  fit(fov: number): void
  dispose(): void
}

export function badgeBoard(): BadgeBoard {
  const canvas = document.createElement('canvas')
  canvas.width = BOARD.wide * RES
  canvas.height = BOARD.high * RES
  const g = canvas.getContext('2d')!
  const texture = new CanvasTexture(canvas)
  const board = new Billboard(new SpriteMaterial({ map: texture, transparent: true, depthTest: false, depthWrite: false, sizeAttenuation: false }))
  board.center.set(0.5, 0)
  board.renderOrder = 5
  return {
    board,
    fit(fov) {
      // Without size attenuation a billboard's scale is in units of the view at distance 1.
      const perUnit = innerHeight / (2 * Math.tan((fov * Math.PI) / 360))
      board.scale.set(BOARD.wide / perUnit, BOARD.high / perUnit, 1)
    },
    redraw(marks) {
      g.setTransform(RES, 0, 0, RES, 0, 0)
      g.clearRect(0, 0, BOARD.wide, BOARD.high)
      g.font = 'bold 14px sans-serif'
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      const widths = marks.map((m) => Math.ceil(g.measureText(m.text).width) + 8)
      const rows: number[][] = []
      widths.forEach((w, i) => {
        const row = rows.at(-1)
        if (row && row.reduce((sum, j) => sum + widths[j] + GAP, w) <= BOARD.wide) row.push(i)
        else rows.push([i])
      })
      // The first row sits lowest, by the unit's head.
      rows.slice(0, 2).forEach((row, r) => {
        let x = (BOARD.wide - row.reduce((sum, j) => sum + widths[j], 0) - GAP * (row.length - 1)) / 2
        const y = BOARD.high - (r + 1) * PILL - r * GAP
        for (const j of row) {
          g.fillStyle = 'rgba(16, 20, 28, 0.88)'
          g.beginPath()
          g.roundRect(x, y, widths[j], PILL, 5)
          g.fill()
          g.strokeStyle = css(marks[j].color)
          g.lineWidth = 1.5
          g.stroke()
          g.fillStyle = css(marks[j].color)
          g.fillText(marks[j].text, x + widths[j] / 2, y + PILL / 2 + 1)
          x += widths[j] + GAP
        }
      })
      texture.needsUpdate = true
    },
    dispose: () => texture.dispose(),
  }
}
