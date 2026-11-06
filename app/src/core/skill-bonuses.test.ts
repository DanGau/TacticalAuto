import { expect, test } from 'vitest'
import { arena } from './arena'
import type { Effect, Unit } from './battle'
import { TUNING } from './tuning'

/** The hero's first shot at an alien standing at `spot`, with `effects` and the alien set up by `ready`; and the alien after. */
function firstHit(effects: Effect[], spot: { x: number; y: number }, ready: (alien: Unit) => void = () => {}) {
  const { hero, aliens, beats } = arena(effects, [spot])
  hero.stats = { ...hero.stats, crit: 0 }
  ready(aliens[0])
  const shot = beats(1).find((e) => e.type === 'shot') as { damage: number; with: Effect[] }
  return { shot, alien: aliens[0] }
}

test('Rime Grip hits harder only beside its target', () => {
  const near = { x: 11, y: 10 }
  const far = { x: 14, y: 10 }
  expect(firstHit(['rimeGrip'], near).shot.damage - firstHit([], near).shot.damage).toBe(TUNING.gripDamage)
  expect(firstHit(['rimeGrip'], near).shot.with).toContain('rimeGrip')
  expect(firstHit(['rimeGrip'], far).shot.damage).toBe(firstHit([], far).shot.damage)
})

test('Opportunist hits harder only a target rooted or stunned', () => {
  const spot = { x: 13, y: 10 }
  const plain = firstHit([], spot).shot.damage
  expect(firstHit(['opportunist'], spot).shot.damage).toBe(plain)
  expect(firstHit(['opportunist'], spot, (a) => (a.rooted = 2)).shot.damage - plain).toBe(TUNING.opportunistDamage)
  expect(firstHit(['opportunist'], spot, (a) => (a.panicked = true)).shot.damage - plain).toBe(TUNING.opportunistDamage)
})

test('Fan the Flames adds a burn stack to a burning target hit, and none to one not burning', () => {
  const spot = { x: 13, y: 10 }
  expect(firstHit(['fanFlames'], spot, (a) => (a.burn = 2)).alien.burn).toBe(2 + TUNING.fanStacks)
  expect(firstHit([], spot, (a) => (a.burn = 2)).alien.burn).toBe(2)
  expect(firstHit(['fanFlames'], spot).alien.burn).toBe(0)
})
