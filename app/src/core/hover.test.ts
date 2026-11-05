import { expect, test } from 'vitest'
import { arena } from './arena'
import { GRID } from './battle'
import type { GameEvent } from './combat-event'
import { HOVER, reshaped, walkingDistances } from './grid'
import { knockback, settle } from './knockback'
import { paths } from './pathing'

/** A hero at 10,10 by a chasm five tiles wide, x 11 to 15, and a ledge three levels down beyond it. */
function chasm() {
  const setup = arena([], [])
  const { battle } = setup
  for (let y = 0; y < GRID; y++) {
    for (let x = 11; x <= 15; x++) {
      battle.ground[y * GRID + x] = 'void'
      battle.props[y * GRID + x] = 'void'
      battle.bulk[y * GRID + x] = 1
    }
    for (let x = 16; x < GRID; x++) battle.height[y * GRID + x] = x >= 18 ? 0 : 3
    for (let x = 0; x <= 10; x++) battle.height[y * GRID + x] = 3
  }
  reshaped(battle)
  return setup
}

test('a levitating hero paths out over the void and down a ledge, which a walker cannot', () => {
  const { battle, hero } = chasm()
  const across = (p: { x: number; y: number }[]) => p.at(-1)?.x === 18
  expect(paths(battle, hero, 8).some(across)).toBe(false)
  hero.effects.push('hover')
  const way = paths(battle, hero, 8).find(across)
  expect(way?.some((t) => battle.ground[t.y * GRID + t.x] === 'void')).toBe(true)
  expect(walkingDistances(battle, { x: 18, y: 10 }, HOVER)[10 * GRID + 9]).toBe(9)
})

test('a levitating hero shoved over the edge or off a ledge stays up, unhurt', () => {
  const { battle, hero } = chasm()
  const brute = arena([], [{ x: 9, y: 10 }]).aliens[0]
  hero.effects.push('hover')
  const events: GameEvent[] = []
  knockback(battle, brute, hero, events, 1, 2)
  expect(hero).toMatchObject({ x: 10, y: 10, hp: hero.stats.hp })
  expect(events.some((e) => e.type === 'fall')).toBe(false)
})

test('a hero over the void whose levitation ends drifts to the nearest ground', () => {
  const { battle, hero } = chasm()
  Object.assign(hero, { x: 12, y: 10 })
  hero.effects.push('hover')
  expect(settle(battle, hero)).toEqual([])
  hero.effects = []
  expect(settle(battle, hero)).toEqual([expect.objectContaining({ type: 'move' })])
  expect(hero.x).toBe(10)
  expect(battle.ground[hero.y * GRID + hero.x]).not.toBe('void')
})
