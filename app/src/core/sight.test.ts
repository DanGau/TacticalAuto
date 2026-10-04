import { expect, test } from 'vitest'
import { COVER_DEFENSE, createState, FLANK_CRIT, GRID, HIT_CHANCE, type Cover, type State } from './state'
import { coverAgainst, lineOfSight, odds } from './sight'

const at = { x: 10, y: 10 }

/** A map whose only cover is `cover` on the tile north of `at`. */
function map(cover: Cover): State {
  const state = createState(1)
  state.cover.fill(0)
  state.cover[(at.y - 1) * GRID + at.x] = cover
  return state
}

test.each([
  ['straight through the cover', { x: 10, y: 5 }, 2],
  ['diagonally through the cover', { x: 14, y: 6 }, 2],
  ['level with the target', { x: 15, y: 10 }, 0],
  ['behind the target', { x: 10, y: 15 }, 0],
])('high cover against a shot from %s', (_, from, expected) => {
  expect(coverAgainst(map(2), at, from)).toBe(expected)
})

test('cover lowers the hit chance; no cover lets hits crit', () => {
  const north = { x: 10, y: 5 }
  expect(odds(map(0), north, at)).toEqual({ hit: HIT_CHANCE, crit: FLANK_CRIT })
  expect(odds(map(1), north, at)).toEqual({ hit: HIT_CHANCE - COVER_DEFENSE[1], crit: 0 })
  expect(odds(map(2), north, at)).toEqual({ hit: HIT_CHANCE - COVER_DEFENSE[2], crit: 0 })
})

test.each([
  ['straight through the block', { x: 10, y: 5 }, false],
  ['one column off, still through the block', { x: 11, y: 5 }, false],
  ['diagonally past its corner', { x: 14, y: 6 }, true],
  ['from the open side', { x: 10, y: 15 }, true],
])('high cover and a line of sight %s', (_, from, expected) => {
  expect(lineOfSight(map(2), from, at)).toBe(expected)
  expect(lineOfSight(map(2), at, from)).toBe(expected)
})

test('low cover does not block line of sight', () => {
  expect(lineOfSight(map(1), { x: 10, y: 5 }, at)).toBe(true)
})
