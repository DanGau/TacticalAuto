import { expect, test } from 'vitest'
import { apply } from './apply'
import { GRID, isSoldier } from './battle'
import { distance } from './grid'
import { leverage, THROW_DAMAGE } from './objects'
import { begun, enterAt } from './roads'
import { current } from './run'
import { ARENA_REACH } from './encounter'
import { FUEL_DAMAGE } from './twists'

function duel() {
  const run = begun(1)
  apply(run, { type: 'go', index: 1 })
  current(run)!.stop!.goal = 'exterminate'
  apply(run, { type: 'advance' })
  const clear = run.battle!
  const walled = clear.north.some((e, t) => e !== 'none' && distance({ x: t % GRID, y: Math.floor(t / GRID) }, clear.arena) < ARENA_REACH / 2)
  enterAt(run, 0)
  const battle = run.battle!
  const soldier = battle.units.find(isSoldier)!
  const alien = battle.units.find((u) => u.side === 'alien')!
  battle.units = [soldier, alien]
  battle.props.fill('none')
  battle.bulk.fill(0)
  battle.north.fill('none')
  battle.west.fill('none')
  battle.height.fill(0)
  battle.pods[alien.pod!].engaged = true
  Object.assign(soldier, { x: 10, y: 10 })
  Object.assign(alien, { x: 10, y: 13, hp: 99, armor: 0 })
  return { battle, soldier, alien, walled }
}

test('the arena opens a fighting space at its heart', () => {
  expect(duel().walled).toBe(false)
})

test('a hero hurls what stands beside it at an alien, and the object is gone', () => {
  const { battle, soldier, alien } = duel()
  battle.props[10 * GRID + 11] = 'car'
  expect(leverage(battle, soldier)).toContainEqual(expect.objectContaining({ type: 'rocket', id: soldier.id, label: 'HURLED' }))
  expect(alien.hp).toBe(99 - THROW_DAMAGE)
  expect(battle.props[10 * GRID + 11]).toBe('none')
})

test('a hero sets off a fuel tank beside an alien, but not one beside a human', () => {
  const { battle, soldier, alien } = duel()
  battle.props[13 * GRID + 11] = 'fuel'
  expect(leverage(battle, soldier)).toContainEqual(expect.objectContaining({ label: 'TANK', x: 11, y: 13 }))
  expect(alien.hp).toBe(99 - FUEL_DAMAGE)
  battle.props[13 * GRID + 11] = 'fuel'
  Object.assign(soldier, { x: 12, y: 13 })
  expect(leverage(battle, soldier)).toEqual([])
})
