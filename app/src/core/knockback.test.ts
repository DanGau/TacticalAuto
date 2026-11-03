import { expect, test } from 'vitest'
import { arena } from './arena'
import { GRID } from './battle'
import type { GameEvent } from './combat-event'
import { passable, reshaped } from './grid'
import { EDGE_DAMAGE, FALL_DAMAGE, knockback } from './knockback'
import { worth } from './attack'

/** A hero at 10,10 beside an alien at 11,10, both on a roof `high` levels up whose edge is past 11,10. */
function ledge(high: number) {
  const setup = arena([], [{ x: 11, y: 10 }])
  const { battle } = setup
  for (let t = 0; t < GRID * GRID; t++) battle.height[t] = t % GRID <= 11 ? high : 0
  reshaped(battle)
  return setup
}

const voided = (battle: ReturnType<typeof arena>['battle'], x: number, y: number) => {
  battle.ground[y * GRID + x] = 'void'
  battle.props[y * GRID + x] = 'void'
  battle.bulk[y * GRID + x] = 1
  reshaped(battle)
}

test('no one walks up or down a ledge, but a step of one level is a ramp', () => {
  const { battle } = ledge(2)
  expect(passable(battle, { x: 11, y: 10 }, { x: 12, y: 10 })).toBe(false)
  battle.height[12 * GRID + 12] = 1
  battle.height[12 * GRID + 13] = 0
  expect(passable(battle, { x: 11, y: 12 }, { x: 12, y: 12 })).toBe(true)
})

test('knocked off a ledge, an alien falls to the ground below for FALL_DAMAGE a level, armor or not', () => {
  const { battle, hero, aliens } = ledge(3)
  aliens[0].armor = 5
  const events: GameEvent[] = []
  knockback(battle, hero, aliens[0], events)
  expect(aliens[0]).toMatchObject({ x: 12, y: 10, hp: 40 - 3 * FALL_DAMAGE, armor: 5 })
  expect(events).toContainEqual(expect.objectContaining({ type: 'fall', drop: 3, damage: 3 * FALL_DAMAGE }))
})

test('falling onto an alien hurts both, and the faller lands beside it', () => {
  const { battle, hero, aliens } = ledge(3)
  const below = { ...aliens[0], id: 1100, x: 12, y: 10 }
  battle.units.push(below)
  knockback(battle, hero, aliens[0], [])
  expect(aliens[0].hp).toBe(40 - 3 * FALL_DAMAGE)
  expect(below.hp).toBe(40 - 3 * FALL_DAMAGE)
  expect(aliens[0].x === 12 && aliens[0].y === 10).toBe(false)
})

test('over the edge an alien is lost; a boss or a hero catches it and takes EDGE_DAMAGE', () => {
  const { battle, hero, aliens } = ledge(0)
  voided(battle, 12, 10)
  const events: GameEvent[] = []
  knockback(battle, hero, aliens[0], events)
  expect(battle.units).not.toContain(aliens[0])
  expect(events).toContainEqual(expect.objectContaining({ type: 'fall', drop: 'edge', fatal: true }))
  const boss = { ...aliens[0], id: 1200, hp: 40, x: 11, y: 10, boss: true }
  battle.units.push(boss)
  knockback(battle, hero, boss, [])
  expect(boss).toMatchObject({ x: 11, y: 10, hp: 40 - EDGE_DAMAGE })
  voided(battle, 9, 10)
  const hp = hero.hp
  knockback(battle, boss, hero, [])
  expect(hero).toMatchObject({ x: 10, y: 10, hp: hp - EDGE_DAMAGE })
})

test('glass on the edge breaks; a wall holds', () => {
  const { battle, hero, aliens } = ledge(0)
  voided(battle, 12, 10)
  battle.west[10 * GRID + 12] = 'wall'
  knockback(battle, hero, aliens[0], [])
  expect(aliens[0]).toMatchObject({ x: 11, y: 10, hp: 39 })
  battle.west[10 * GRID + 12] = 'window'
  knockback(battle, hero, aliens[0], [])
  expect(battle.units).not.toContain(aliens[0])
  expect(battle.west[10 * GRID + 12]).toBe('none')
})

test('a fall within its jump a unit lands unhurt, and no hero aims to knock it off one', () => {
  const { battle, hero, aliens } = ledge(2)
  aliens[0].stats.jump = 2
  expect(worth(battle, hero, aliens[0])).toBe(worth(battle, hero, { ...aliens[0], stats: { ...aliens[0].stats, jump: 3 } }))
  knockback(battle, hero, aliens[0], [])
  expect(aliens[0]).toMatchObject({ x: 12, y: 10, hp: 40 })
})

test("any hero's hit knocks an alien at a ledge off it, and heroes aim at one", () => {
  const { battle, hero, aliens, beats } = ledge(3)
  const far = { ...aliens[0], id: 1300, x: 10, y: 12 }
  battle.units.push(far)
  expect(worth(battle, hero, aliens[0])).toBeGreaterThan(worth(battle, hero, far))
  beats(1)
  expect(aliens[0].x).toBe(12)
})
