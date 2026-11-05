import { expect, test } from 'vitest'
import { ISLE, island } from './globe'

test('a made-up island is a speck, at most 10 pixels from its stop', () => {
  for (const size of [ISLE.choice, ISLE.stop]) {
    const points = island({ x: 0, y: 0 }, [12, 34], size).match(/-?[\d.]+,-?[\d.]+/g)!
    const reach = Math.max(...points.map((xy) => Math.hypot(...(xy.split(',').map(Number) as [number, number]))))
    expect(reach).toBeLessThanOrEqual(10)
  }
})
