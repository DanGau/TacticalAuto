import { expect, test } from 'vitest'
import { begun } from '../core/roads'
import { apply, type Action } from '../core/apply'
import { dropGear, GEAR_PRICE, SELL } from '../core/rewards'
import { findSwap, gearPicks, kept, swapKey } from './cards'

/** Each card's label and the name on it, as the player reads them. */
const cards = (html: string) => [...html.matchAll(/class="side (keep|sell)".*?<small class="verb">(\w+).*?<b class="tier \w+">\w+ ([^<]+)<\/b>/g)].map(([, look, verb, name]) => ({ look, verb, name }))
const confirm = (html: string): Action => JSON.parse(html.match(/class="decide confirm" data-action='([^']+)'/)![1])

test.each(['old', 'new'] as const)('a find swap keeping the %s weapon: Confirm keeps the KEEP card and sells the SELL card', (keep) => {
  const run = begun(1)
  const [hero] = run.soldiers
  dropGear(run, false)
  run.phase = 'reward'
  const held = hero.gear!
  const found = run.finds[0]
  const html = findSwap(run, 0, swapKey(hero, keep))
  expect(kept(hero, swapKey(hero, keep))).toBe(keep)
  const shown = cards(html)
  expect(shown).toEqual([
    { look: keep === 'old' ? 'keep' : 'sell', verb: keep === 'old' ? 'keep' : 'sell', name: held.name },
    { look: keep === 'new' ? 'keep' : 'sell', verb: keep === 'new' ? 'keep' : 'sell', name: found.name },
  ])
  const supplies = run.supplies
  apply(run, confirm(html))
  expect(hero.gear).toBe(keep === 'old' ? held : found)
  expect(run.supplies).toBe(supplies + SELL[(keep === 'old' ? found : held).rarity])
})

test('a find swap keeps the held weapon until the found one is chosen', () => {
  const run = begun(1)
  const [hero] = run.soldiers
  dropGear(run, false)
  expect(cards(findSwap(run, 0, null))[0]).toMatchObject({ verb: 'keep', name: hero.gear!.name })
  expect(kept({ ...hero, gear: null }, null)).toBe('new')
})

test('a shop buy keeps the bought weapon and sells the held one, as its cards say', () => {
  const run = begun(1)
  const [hero] = run.soldiers
  dropGear(run, false)
  const gear = run.finds.pop()!
  run.phase = 'shop'
  run.shop = { wares: [{ gear, sold: false }] } as typeof run.shop
  run.supplies = 99
  const held = hero.gear!
  const [pick] = gearPicks(run, gear, (s) => ({ type: 'gear', index: 0, soldier: s.id }), 'buy it for')
  expect(cards(pick.detail)).toEqual([{ look: 'keep', verb: 'keep', name: gear.name }, { look: 'sell', verb: 'sell', name: held.name }])
  apply(run, pick.action!)
  expect(hero.gear).toBe(gear)
  expect(run.supplies).toBe(99 - GEAR_PRICE[gear.rarity as keyof typeof GEAR_PRICE] + SELL[held.rarity])
})
