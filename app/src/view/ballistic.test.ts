import { expect, test } from 'vitest'
import { PACE } from '../core/pace'
import { ballistic } from './ballistic'
import { LEVEL } from './space'

test('a throw over the edge moves every frame from release until it is gone, through the lip and on down', () => {
  const from = { x: 2, y: LEVEL * 1.6, z: 2 }
  const over = { x: 6, y: 0, z: 2 }
  const ms = PACE.flight + PACE.flightTile * 4
  const flight = ballistic(from, over, LEVEL * 4, LEVEL * 6, ms)
  const frame = 1000 / 60
  let last = flight.at(0)
  for (let time = frame; time <= flight.ms; time += frame) {
    const at = flight.at(time)
    expect(Math.hypot(at.x - last.x, at.y - last.y, at.z - last.z)).toBeGreaterThan(1e-3)
    last = at
  }
  expect(flight.at(ms).x).toBeCloseTo(6, 6)
  expect(flight.at(ms).y).toBeCloseTo(0, 6)
  expect(flight.at(flight.ms).y).toBeCloseTo(-LEVEL * 6, 6)
})
