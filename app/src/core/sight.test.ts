import { expect, test } from 'vitest'
import { BASE_STATS, GRID, SIGHT, type Battle, type Bulk } from './battle'
import { createBattle } from './setup'
import { passable } from './grid'
import { wreck } from './grid'
import { HIGH_DAMAGE } from './grid'
import { HIGH_SIGHT } from './grid'
import { bite, MIN_DAMAGE, lineOfSight, odds, sees } from './sight'

const at = { x: 10, y: 10 }

/** A map whose only object is one of `bulk` on the tile north of `at`. */
function map(bulk: Bulk): Battle {
  const battle = createBattle(1, 'town', [], [])
  battle.ground.fill('pavement')
  battle.props.fill('none')
  battle.bulk.fill(0)
  battle.height.fill(0)
  battle.north.fill('none')
  battle.west.fill('none')
  battle.bulk[(at.y - 1) * GRID + at.x] = bulk
  return battle
}

test.each([
  ['straight through the block', { x: 10, y: 5 }, false],
  ['one column off, still through the block', { x: 11, y: 5 }, false],
  ['diagonally past its corner', { x: 14, y: 6 }, true],
  ['from the open side', { x: 10, y: 15 }, true],
])('a tall object and a line of sight %s', (_, from, expected) => {
  expect(lineOfSight(map(2), from, at)).toBe(expected)
  expect(lineOfSight(map(2), at, from)).toBe(expected)
})

test('a low object does not block line of sight', () => {
  expect(lineOfSight(map(1), { x: 10, y: 5 }, at)).toBe(true)
})

test('every attack lands at least MIN_DAMAGE', () => {
  const north = { x: 10, y: 5 }
  expect(bite(map(0), north, at, BASE_STATS)).toBe(1)
  expect(bite(map(0), north, at, { ...BASE_STATS, damage: MIN_DAMAGE })).toBe(1)
})

test('a wall on a tile edge blocks sight across it, and stops movement', () => {
  for (const [edge, sight] of [['wall', false], ['window', true]] as const) {
    const battle = map(0)
    battle.north[at.y * GRID + at.x] = edge
    const north = { x: at.x, y: at.y - 3 }
    expect(lineOfSight(battle, north, at)).toBe(sight)
    expect(lineOfSight(battle, at, north)).toBe(sight)
    expect(lineOfSight(battle, { x: at.x - 3, y: at.y }, { x: at.x + 3, y: at.y })).toBe(true)
    expect(passable(battle, at, { x: at.x, y: at.y - 1 })).toBe(false)
    expect(passable(battle, at, { x: at.x + 1, y: at.y - 1 })).toBe(false)
    expect(passable(battle, at, { x: at.x + 1, y: at.y })).toBe(true)
  }
})

test('a blast clears the props and walls it catches', () => {
  const battle = map(2)
  battle.props[(at.y - 1) * GRID + at.x] = 'stack'
  battle.north[at.y * GRID + at.x] = 'wall'
  battle.west[at.y * GRID + at.x + 2] = 'wall'
  wreck(battle, at)
  expect(battle.bulk[(at.y - 1) * GRID + at.x]).toBe(0)
  expect(battle.props[(at.y - 1) * GRID + at.x]).toBe('none')
  expect(battle.north[at.y * GRID + at.x]).toBe('none')
  expect(battle.west[at.y * GRID + at.x + 2]).toBe('none')
  expect(lineOfSight(battle, { x: at.x, y: at.y - 3 }, at)).toBe(true)
})

test('high ground sees farther and hits harder; low ground the reverse', () => {
  const battle = map(0)
  const below = { x: at.x, y: at.y + SIGHT + HIGH_SIGHT }
  expect(sees(battle, at, below)).toBe(false)
  battle.height[at.y * GRID + at.x] = 1
  expect(sees(battle, at, below)).toBe(true)
  expect(sees(battle, below, at)).toBe(false)
  const near = { x: at.x, y: at.y + 4 }
  expect(odds(battle, at, near)).toBe(odds(battle, near, at) + 2 * HIGH_DAMAGE)
})
