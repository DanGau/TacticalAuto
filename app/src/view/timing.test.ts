import { expect, test } from 'vitest'
import { PACE, throwMs, walkMs, tilePace } from '../core/pace'
import { timeline, type Moment } from './timing'

/** A walk sampled each frame of 60 fps: how long each phase of each jump lasts, in ms. */
function phases(points: { x: number; y: number }[], jumps: boolean[], ms: number): Map<string, number> {
  const when = timeline(points, jumps, ms)
  const spans = new Map<string, number>()
  const frames = Math.ceil(ms / (1000 / 60))
  for (let n = 0; n < frames; n++) {
    const m: Moment = when(n / frames)
    if (m.phase !== 'walk') spans.set(`${m.i}:${m.phase}`, (spans.get(`${m.i}:${m.phase}`) ?? 0) + ms / frames)
  }
  return spans
}

const line = (tiles: number) => Array.from({ length: tiles + 1 }, (_, i) => ({ x: i, y: 0 }))

test('each jump crouches, flies and lands in full, however long the walk it is part of or however hurried', () => {
  for (const tiles of [2, 6, 20, 40]) {
    const points = line(tiles)
    const jumps = points.slice(1).map((_, i) => i % 3 === 1)
    const leaps = jumps.filter(Boolean).length
    const ms = walkMs([{ path: points.slice(1), pace: tilePace(true), leaps }])
    const spans = phases(points, jumps, ms)
    for (const [i, jump] of jumps.entries()) {
      if (!jump) continue
      expect(spans.get(`${i + 1}:crouch`)).toBeGreaterThanOrEqual(PACE.crouch - 20)
      expect(spans.get(`${i + 1}:air`)).toBeGreaterThanOrEqual(PACE.air - 20)
      expect(spans.get(`${i + 1}:land`)).toBeGreaterThanOrEqual(PACE.landing - 20)
    }
  }
})

test('a walk with jumps keeps to its path and ends where it was going', () => {
  const points = line(8)
  const when = timeline(points, points.slice(1).map((_, i) => i === 4), 2000)
  let last = 0
  for (let n = 0; n <= 100; n++) {
    const m = when(n / 100)
    const x = m.i - 1 + m.f
    expect(x).toBeGreaterThanOrEqual(last - 1e-6)
    last = x
  }
  expect(when(1)).toMatchObject({ i: 8, f: 1 })
})

test('a throw lifts and holds before it lets fly, flies longer the farther it goes, and lands with an impact', () => {
  expect(PACE.lift + PACE.hold).toBeGreaterThanOrEqual(350)
  expect(PACE.impact).toBeGreaterThanOrEqual(150)
  for (let tiles = 1; tiles <= 6; tiles++) expect((PACE.flight + PACE.flightTile * tiles) / tiles).toBeGreaterThanOrEqual(PACE.flightTile)
  expect(throwMs(6)).toBeGreaterThan(throwMs(1))
  expect(throwMs(6)).toBeLessThanOrEqual(1500)
})
