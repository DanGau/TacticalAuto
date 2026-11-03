import { expect, test } from 'vitest'
import { arena } from './arena'
import { GRID, type Tile } from './battle'
import { reshaped, walkingDistances } from './grid'
import { paths } from './pathing'

const ends = (battle: ReturnType<typeof arena>['battle'], unit: ReturnType<typeof arena>['hero'], move: number) => paths(battle, unit, move).map((p) => p.at(-1) ?? unit)
const has = (tiles: Tile[], x: number, y: number) => tiles.some((t) => t.x === x && t.y === y)

test('a unit jumps up or down a ledge as high as its jump, costing a tile and a move a level up, and no higher', () => {
  const { battle, hero } = arena([], [])
  for (let t = 0; t < GRID * GRID; t++) battle.height[t] = t % GRID >= 11 ? 3 : 0
  reshaped(battle)
  hero.stats.jump = 2
  expect(has(ends(battle, hero, 9), 11, 10)).toBe(false)
  hero.stats.jump = 3
  expect(has(ends(battle, hero, 4), 11, 10)).toBe(true)
  expect(walkingDistances(battle, { x: 11, y: 5 }, 3)[5 * GRID + 10]).toBe(4)
  expect(walkingDistances(battle, { x: 11, y: 5 }, 2)[5 * GRID + 10]).toBe(Infinity)
})

test('a unit leaps a gap of void one tile narrower than its jump', () => {
  const { battle, hero } = arena([], [])
  for (const x of [11, 12]) for (let y = 0; y < GRID; y++) {
    battle.ground[y * GRID + x] = 'void'
    battle.props[y * GRID + x] = 'void'
    battle.bulk[y * GRID + x] = 1
  }
  reshaped(battle)
  hero.stats.jump = 2
  expect(has(ends(battle, hero, 9), 13, 10)).toBe(false)
  hero.stats.jump = 3
  const path = paths(battle, hero, 9).find((p) => p.length === 1 && p[0].x === 13 && p[0].y === 10)
  expect(path).toBeDefined()
})
