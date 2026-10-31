import { expect, test } from 'vitest'
import type { GameEvent } from './combat-event'
import { beatMs, PACE, tick, walkMs } from './pace'

const move = (id: number, tiles: number): GameEvent => ({ type: 'move', id, path: Array.from({ length: tiles }, (_, i) => ({ x: i, y: 0 })) })
const pace = new Map([1, 2, 3].map((id) => [id, PACE.tile]))
const shown = new Set([1, 2, 3])

test('moves in a row walk together, words among them do not hold them up, and a long walk takes no longer than a march', () => {
  expect(beatMs([move(1, 2), { type: 'order', id: 1, order: 'hunker' }, move(2, 3)], pace, shown)).toBe(3 * PACE.tile)
  expect(beatMs([move(1, 40)], pace, shown)).toBe(PACE.march)
})

test('a soldier going a short way takes the cool walk; a long way, it runs', () => {
  expect(walkMs([{ path: move(1, 2).type === 'move' ? [{ x: 0, y: 0 }, { x: 1, y: 0 }] : [], pace: PACE.dash }])).toBe(2 * PACE.stroll)
  expect(walkMs([{ path: Array.from({ length: 5 }, (_, i) => ({ x: i, y: 0 })), pace: PACE.dash }])).toBe(5 * PACE.dash)
})

test('a shot waits for the walk before it, and an alien appearing out of sight takes no time', () => {
  const shot: GameEvent = { type: 'shot', id: 1, target: 2, crit: false, damage: 3, with: [] }
  expect(beatMs([move(1, 2), shot], pace, shown)).toBe(2 * PACE.tile + PACE.attack)
  expect(beatMs([{ type: 'reveal', units: [{ id: 9, x: 0, y: 0 }] }], pace, shown)).toBe(0)
})

test("a side's attacks start a stagger apart, and the next move waits for the last to land", () => {
  let clock = { next: 0, done: 0 }
  for (let i = 0; i < 3; i++) clock = tick(clock, PACE.attack, true)
  expect(clock).toEqual({ next: 3 * PACE.stagger, done: 2 * PACE.stagger + PACE.attack })
  expect(tick(clock, 500, false)).toEqual({ next: 2 * PACE.stagger + PACE.attack + 500, done: 2 * PACE.stagger + PACE.attack + 500 })
})
