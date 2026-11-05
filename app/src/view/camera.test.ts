import { describe, expect, it } from 'vitest'
import { aim, bestTurn, framing, panned, picture, settled, still, STILL_FOV, type Camera } from './camera'
import { PITCH, YAW } from './space'

Object.assign(globalThis, { innerWidth: 390, innerHeight: 844 })
const quarter = Math.PI / 2
const iso = (yaw: number) => Math.abs((((yaw - YAW) % quarter) + quarter) % quarter) < 1e-9 || Math.abs((((yaw - YAW) % quarter) + quarter) % quarter - quarter) < 1e-9

describe('camera', () => {
  it('settles any turn, however far a glide got, at an isometric turn', () => {
    for (let yaw = -7; yaw < 7; yaw += 0.13) expect(iso(settled(yaw))).toBe(true)
    const glide = framing([{ x: 3, y: 4 }, { x: 9, y: 2 }], settled(YAW + 0.37))
    expect([iso(glide.yaw), glide.pitch, glide.fov]).toEqual([true, PITCH, STILL_FOV])
    expect(settled(YAW + 0.7)).toBeCloseTo(YAW)
    expect(settled(YAW + 0.8)).toBeCloseTo(YAW + quarter)
  })

  it('turns a tall screen only by quarter turns, never to a square view', () => {
    const points = [{ x: 0, y: 0 }, { x: 31, y: 31 }, { x: 0, y: 2 }]
    for (const from of [YAW, YAW - 0.4, YAW + 1.1]) expect(iso(bestTurn(points, from))).toBe(true)
  })

  it('pans only a still camera', () => {
    const c = aim({ x: 0, y: 0 }, 1)
    expect(still(c)).toBe(true)
    expect(still({ ...c, yaw: YAW + 0.3 })).toBe(false)
    expect(still({ ...c, pitch: PITCH - 0.1 })).toBe(false)
    expect(still({ ...c, fov: 20 })).toBe(false)
  })

  it('moves the ground exactly under the finger', () => {
    for (const yaw of [YAW, YAW + quarter]) {
      const c: Camera = aim({ x: 30, y: -12 }, 1.5, yaw)
      const scale = 2.25
      const p = { x: 4, y: 0.5, z: 9 }
      const before = picture(p, yaw)
      const at = (cam: Camera) => picture(cam, yaw)
      const moved = panned(c, 37, -21, scale)
      // On screen, p sits at (its picture - the camera's) * scale from the centre.
      const shift = (cam: Camera) => ({ x: (before.x - at(cam).x) * scale, y: (before.y - at(cam).y) * scale })
      expect(shift(moved).x - shift(c).x).toBeCloseTo(37)
      expect(shift(moved).y - shift(c).y).toBeCloseTo(-21)
    }
  })
})
