import { expect, test } from 'vitest'
import { begun } from '../core/roads'
import { apply, type Action } from '../core/apply'
import { dropGear, GEAR_PRICE, SELL } from '../core/rewards'
import type { Run } from '../core/run-state'
import { findSwap, shopSwap } from './cards'
import { gearName } from './html'

/** Each button's label and action, as the player reads them. */
const buttons = (html: string) => [...html.matchAll(/<button class="[^"]*confirm" ([^>]*)>(.*?)<\/button>/g)].map(([, attrs, label]) => ({ label: label.replace(/<[^>]*>/g, ''), action: attrs.match(/data-action='([^']+)'/)?.[1] }))

/** A run with one weapon found, in the reward phase. */
function found(): Run {
  const run = begun(1)
  run.hero.gear = { ...run.hero.gear!, rarity: 'rare', name: 'Long Rifle' }
  dropGear(run, false)
  run.phase = 'reward'
  return run
}

test("a find sets the hero's weapon now beside the new one, and offers Equip or Sell", () => {
  const run = found()
  const hero = run.hero
  const html = findSwap(run, 0, null)
  expect(html).toContain(`for ${hero.name}`)
  expect(html).toContain(`<span class="tag">NOW</span><b class="tier ${hero.gear!.rarity}">${hero.gear!.rarity} ${gearName(hero.gear!)}</b>`)
  expect(html).toContain('class="side found arrive')
  expect(buttons(html).map((b) => b.label)).toEqual([`Equip on ${hero.name}`, `Sell · +${SELL[run.finds[0].rarity]} supplies`])
})

test('Equip puts the find on the hero, its weapon dropped for nothing', () => {
  const run = found()
  const gear = run.finds[0]
  const supplies = run.supplies
  apply(run, JSON.parse(buttons(findSwap(run, 0, null))[0].action!) as Action)
  expect(run.hero.gear).toBe(gear)
  expect(run.supplies).toBe(supplies)
  expect(run.finds).toEqual([])
})

test('Sell keeps the weapon and pays for the find', () => {
  const run = found()
  const gear = run.finds[0]
  const held = run.hero.gear
  const supplies = run.supplies
  apply(run, JSON.parse(buttons(findSwap(run, 0, null))[1].action!) as Action)
  expect(run.hero.gear).toBe(held)
  expect(run.supplies).toBe(supplies + SELL[gear.rarity])
})

test('the new weapon lists what it changes from the one held', () => {
  const run = found()
  run.hero.gear = { ...run.hero.gear!, stats: {}, effect: null }
  run.finds[0] = { ...run.finds[0], stats: { damage: 1, move: -1 }, effect: 'ricochet' }
  const html = findSwap(run, 0, null)
  expect(html).toContain('<li class="up">+1 damage</li><li class="down">-1 move</li><li class="up">gains')
})

test('a shop ware is bought for the hero, or left', () => {
  const run = found()
  const gear = run.finds.pop()!
  run.phase = 'shop'
  run.shop = { wares: [{ gear, sold: false }] } as typeof run.shop
  run.supplies = 99
  const price = GEAR_PRICE[gear.rarity as keyof typeof GEAR_PRICE]
  const html = shopSwap(run, 0, price, null)
  expect(html).toContain('<button class="confirm" data-ware="">Leave it</button>')
  apply(run, JSON.parse(buttons(html)[0].action!) as Action)
  expect(run.hero.gear).toBe(gear)
  expect(run.supplies).toBe(99 - price)
})
