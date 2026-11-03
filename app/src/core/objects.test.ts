import { expect, test } from 'vitest'
import { apply } from './apply'
import { GRID, isSoldier } from './battle'
import { distance, reshaped } from './grid'
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
  enterAt(run)
  const battle = run.battle!
  const soldier = battle.units.find(isSoldier)!
  const alien = battle.units.find((u) => u.side === 'alien')!
  battle.units = [soldier, alien]
  battle.props.fill('none')
  battle.bulk.fill(0)
  battle.north.fill('none')
  battle.west.fill('none')
  battle.height.fill(0)
  alien.engaged = true
  Object.assign(soldier, { x: 10, y: 10 })
  Object.assign(alien, { x: 10, y: 13, hp: 99, armor: 0 })
  return { battle, soldier, alien, walled }
}

test('the arena opens a fighting space at its heart', () => {
  expect(duel().walled).toBe(false)
})

test('only a strong hero throws: a car at two aliens together, knocking them back and leaving a wreck where it lands', () => {
  const { battle, soldier, alien } = duel()
  battle.props[10 * GRID + 11] = 'car'
  battle.bulk[10 * GRID + 11] = 1
  Object.assign(soldier, { ability: 'medic', weapon: undefined })
  expect(leverage(battle, soldier)).toEqual([])
  soldier.weapon = 'hammer'
  const other = { ...alien, id: 900, x: 11, y: 13, hp: 99 }
  battle.units.push(other)
  const events = leverage(battle, soldier)
  expect(events).toContainEqual(expect.objectContaining({ type: 'throw', id: soldier.id, object: 'car' }))
  expect(alien.hp).toBeLessThanOrEqual(99 - THROW_DAMAGE)
  expect(other.hp).toBeLessThanOrEqual(99 - THROW_DAMAGE)
  expect(battle.props[10 * GRID + 11]).toBe('none')
  expect(battle.props).toContain('wreck')
})

test('a lone alien is not worth a car, but a car that sends it off a ledge is', () => {
  const { battle, soldier, alien } = duel()
  battle.props[10 * GRID + 11] = 'car'
  battle.bulk[10 * GRID + 11] = 1
  soldier.weapon = 'fists'
  expect(leverage(battle, soldier)).toEqual([])
  for (let x = 0; x < GRID; x++) battle.height[14 * GRID + x] = 0
  for (let t = 0; t < 14 * GRID; t++) battle.height[t] = 2
  reshaped(battle)
  expect(leverage(battle, soldier)).toContainEqual(expect.objectContaining({ type: 'throw' }))
  expect(alien.y).toBe(14)
})

test('a strong hero throws a small alien beside it over the edge', () => {
  const { battle, soldier, alien } = duel()
  soldier.weapon = 'hammer'
  Object.assign(alien, { x: 10, y: 11, kind: 'trooper', boss: false, target: false })
  for (let x = 0; x < GRID; x++) {
    battle.ground[13 * GRID + x] = 'void'
    battle.props[13 * GRID + x] = 'void'
    battle.bulk[13 * GRID + x] = 1
  }
  reshaped(battle)
  const events = leverage(battle, soldier)
  expect(events).toContainEqual(expect.objectContaining({ type: 'throw', object: 'alien', thrown: alien.id }))
  expect(events).toContainEqual(expect.objectContaining({ type: 'fall', drop: 'edge', fatal: true }))
  expect(battle.units).not.toContain(alien)
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
