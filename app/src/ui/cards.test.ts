import { expect, test } from 'vitest'
import { begun } from '../core/roads'
import { apply } from '../core/apply'
import { dropGear, SELL } from '../core/rewards'
import { findPicks, kept, swapAction, swapKey } from './cards'

test('a swap keeps the held weapon until the found one is chosen, and confirm does what the labels say', () => {
  const run = begun(1)
  const [hero] = run.soldiers
  const held = hero.gear!
  dropGear(run, false)
  const [found] = run.finds
  expect(kept(hero, `s${hero.id}`)).toBe('old')
  expect(kept(hero, swapKey(hero, 'new'))).toBe('new')
  expect(kept({ ...hero, gear: null }, null)).toBe('new')
  const confirm = (armed: string) => findPicks(run, 0, armed)[0].detail.match(/data-action='([^']+)'/)![1]
  expect(JSON.parse(confirm(swapKey(hero, 'old')))).toEqual(swapAction(0, hero, 'old'))
  expect(findPicks(run, 0, swapKey(hero, 'new'))[0].detail).toMatch(/aria-checked="true" data-arm="s\d+~new"/)
  run.phase = 'reward'
  const supplies = run.supplies
  apply(run, JSON.parse(confirm(swapKey(hero, 'new'))))
  expect(hero.gear).toBe(found)
  expect(run.supplies).toBe(supplies + SELL[held.rarity])
})
