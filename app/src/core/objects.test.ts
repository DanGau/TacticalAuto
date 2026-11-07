import { expect, test } from 'vitest'
import { apply } from './apply'
import { GRID, isSoldier } from './battle'
import { distance, reshaped } from './grid'
import { HURL_MAX, hurlRange, leverage, OBJECT_USES, THROW_DAMAGE } from './objects'
import { PERK } from './perks'
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
  soldier.effects.push('heave')
  Object.assign(soldier, { x: 10, y: 10 })
  Object.assign(alien, { x: 10, y: 13, hp: 99, armor: 0 })
  return { battle, soldier, alien, walled }
}

test('the arena opens a fighting space at its heart', () => {
  expect(duel().walled).toBe(false)
})

test('a hero throws only what its strength lifts: a car at two aliens together, knocking them back and leaving a wreck where it lands', () => {
  const { battle, soldier, alien } = duel()
  battle.props[10 * GRID + 11] = 'car'
  battle.bulk[10 * GRID + 11] = 1
  soldier.stats.strength = 3
  expect(leverage(battle, soldier)).toEqual([])
  soldier.stats.strength = 4
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
  soldier.stats.strength = 4
  expect(leverage(battle, soldier)).toEqual([])
  for (let x = 0; x < GRID; x++) battle.height[14 * GRID + x] = 0
  for (let t = 0; t < 14 * GRID; t++) battle.height[t] = alien.stats.jump + 1
  reshaped(battle)
  expect(leverage(battle, soldier)).toContainEqual(expect.objectContaining({ type: 'throw' }))
  expect(alien.y).toBe(14)
})

test('a hero of strength 3 throws a small alien beside it over the edge; one of 2 cannot', () => {
  const { battle, soldier, alien } = duel()
  soldier.stats.strength = 2
  Object.assign(alien, { x: 10, y: 11, kind: 'trooper', boss: false, target: false })
  for (let x = 0; x < GRID; x++) {
    battle.ground[13 * GRID + x] = 'void'
    battle.props[13 * GRID + x] = 'void'
    battle.bulk[13 * GRID + x] = 1
  }
  reshaped(battle)
  expect(leverage(battle, soldier)).toEqual([])
  soldier.stats.strength = 3
  const events = leverage(battle, soldier)
  expect(events).toContainEqual(expect.objectContaining({ type: 'throw', object: 'alien', thrown: alien.id }))
  expect(events).toContainEqual(expect.objectContaining({ type: 'fall', drop: 'edge', fatal: true }))
  expect(battle.units).not.toContain(alien)
})

test('nothing thrown flies farther than HURL_MAX, however strong the thrower, nor goes over the edge past where it was aimed', () => {
  const { battle, soldier, alien } = duel()
  soldier.stats.strength = 12
  Object.assign(alien, { x: 10, y: 11, kind: 'trooper', boss: false, target: false })
  for (let y = 0; y < GRID; y++) {
    battle.ground[y * GRID + 15] = 'void'
    battle.props[y * GRID + 15] = 'void'
    battle.bulk[y * GRID + 15] = 1
  }
  reshaped(battle)
  const start = { x: alien.x, y: alien.y }
  const events = leverage(battle, soldier)
  const thrown = events.find((e) => e.type === 'throw')!
  const over = events.find((e) => e.type === 'fall')!
  expect(thrown.type === 'throw' && distance(thrown.from, thrown.to)).toBeLessThanOrEqual(HURL_MAX)
  expect(over.type === 'fall' && distance(start, over.to)).toBeLessThanOrEqual(HURL_MAX)
})

test('a hero sets off a fuel tank beside an alien, but not one beside a human', () => {
  const { battle, soldier, alien } = duel()
  battle.props[13 * GRID + 11] = 'fuel'
  expect(leverage(battle, soldier)).toContainEqual(expect.objectContaining({ src: { kind: 'object', id: 'fuel' }, x: 11, y: 13 }))
  expect(alien.hp).toBe(99 - FUEL_DAMAGE)
  battle.props[13 * GRID + 11] = 'fuel'
  Object.assign(soldier, { x: 12, y: 13 })
  expect(leverage(battle, soldier)).toEqual([])
})

/** A duel with a car beside the hero and two aliens together within its throw. */
function carDuel() {
  const d = duel()
  d.battle.props[10 * GRID + 11] = 'car'
  d.battle.bulk[10 * GRID + 11] = 1
  d.soldier.stats.strength = 4
  d.battle.units.push({ ...d.alien, id: 900, x: 11, y: 13, hp: 99 })
  return d
}

test('only a hero with Heave throws', () => {
  const { battle, soldier } = carDuel()
  soldier.effects = soldier.effects.filter((e) => e !== 'heave')
  expect(leverage(battle, soldier)).toEqual([])
})

test('Crushing Throw adds its damage and says so; Long Throw reaches further; Extra Throw adds a use', () => {
  const { battle, soldier, alien } = carDuel()
  soldier.effects.push('crushingThrow')
  const events = leverage(battle, soldier)
  expect(alien.hp).toBeLessThanOrEqual(99 - THROW_DAMAGE - PERK.throwDamage)
  expect(events).toContainEqual(expect.objectContaining({ type: 'effect', effect: 'crushingThrow', src: { kind: 'perk', id: 'crushingThrow' } }))
  soldier.stats.strength = 2
  const near = hurlRange(soldier)
  soldier.effects.push('longThrow')
  expect(hurlRange(soldier)).toBe(near + PERK.throwRange)
  const again = carDuel()
  again.soldier.effects.push('crushingThrow')
  again.soldier.spent = Array<'throw'>(OBJECT_USES).fill('throw')
  expect(leverage(again.battle, again.soldier)).toEqual([])
  again.soldier.effects.push('extraThrow')
  expect(leverage(again.battle, again.soldier)).not.toEqual([])
})
