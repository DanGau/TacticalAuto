import { expect, test } from 'vitest'
import { BASE_STATS, COVER_DEFENSE, createBattle, GRID, passable, wreck, type Battle, type Cover } from './battle'
import { coverAgainst, lineOfSight, odds } from './sight'

const at = { x: 10, y: 10 }

/** A map whose only cover is `cover` on the tile north of `at`. */
function map(cover: Cover): Battle {
  const battle = createBattle(1, 'town', [], [])
  battle.cover.fill(0)
  battle.north.fill('none')
  battle.west.fill('none')
  battle.cover[(at.y - 1) * GRID + at.x] = cover
  return battle
}

test.each([
  ['straight through the cover', { x: 10, y: 5 }, 2],
  ['diagonally through the cover', { x: 14, y: 6 }, 2],
  ['level with the target', { x: 15, y: 10 }, 0],
  ['behind the target', { x: 10, y: 15 }, 0],
])('high cover against a shot from %s', (_, from, expected) => {
  expect(coverAgainst(map(2), at, from)).toBe(expected)
})

test('at full range, cover lowers the hit chance; no cover lets hits crit', () => {
  const north = { x: 10, y: 5 }
  expect(odds(map(0), north, at, BASE_STATS)).toEqual({ hit: BASE_STATS.aim, crit: BASE_STATS.crit })
  expect(odds(map(1), north, at, BASE_STATS)).toEqual({ hit: BASE_STATS.aim - COVER_DEFENSE[1], crit: 0 })
  expect(odds(map(2), north, at, BASE_STATS)).toEqual({ hit: BASE_STATS.aim - COVER_DEFENSE[2], crit: 0 })
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

test('each tile closer adds to the hit chance, up to certainty', () => {
  const from = (tiles: number) => odds(map(0), { x: at.x, y: at.y + tiles }, at, BASE_STATS).hit
  expect(from(BASE_STATS.range)).toBe(BASE_STATS.aim)
  expect(from(3)).toBeCloseTo(BASE_STATS.aim + BASE_STATS.close * (BASE_STATS.range - 3))
  expect(from(1)).toBeGreaterThan(from(3))
  expect(odds(map(0), { x: at.x, y: at.y + 1 }, at, { ...BASE_STATS, aim: 0.95 }).hit).toBe(1)
})

test('a wall on a tile edge blocks sight across it, gives high cover, and stops movement; a window only gives low cover', () => {
  for (const [edge, sight, cover] of [['wall', false, 2], ['window', true, 1]] as const) {
    const battle = map(0)
    battle.north[at.y * GRID + at.x] = edge
    const north = { x: at.x, y: at.y - 3 }
    expect(lineOfSight(battle, north, at)).toBe(sight)
    expect(lineOfSight(battle, at, north)).toBe(sight)
    expect(coverAgainst(battle, at, north)).toBe(cover)
    expect(coverAgainst(battle, at, { x: at.x, y: at.y + 3 })).toBe(0)
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
  expect(battle.cover[(at.y - 1) * GRID + at.x]).toBe(0)
  expect(battle.props[(at.y - 1) * GRID + at.x]).toBe('none')
  expect(battle.north[at.y * GRID + at.x]).toBe('none')
  expect(battle.west[at.y * GRID + at.x + 2]).toBe('none')
  expect(lineOfSight(battle, { x: at.x, y: at.y - 3 }, at)).toBe(true)
})
