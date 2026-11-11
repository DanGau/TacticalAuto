import { expect, test } from 'vitest'
import { begun } from '../core/roads'
import { apply, type Action } from '../core/apply'
import { dropGear, GEAR_PRICE, SELL } from '../core/rewards'
import type { Run } from '../core/run-state'
import { findSwap, shopSwap } from './cards'
import { gearName } from './html'

/** Each button's label and action, as the player reads them. */
const buttons = (html: string) => [...html.matchAll(/<button class="[^"]*confirm" ([^>]*)>(.*?)<\/button>/g)].map(([, attrs, label]) => ({ label: label.replace(/<[^>]*>/g, ''), action: attrs.match(/data-action='([^']+)'/)?.[1] }))

/** A run of three heroes with one weapon found, in the reward phase. */
function found(): Run {
  const run = begun(1)
  const [first] = run.soldiers
  run.soldiers.push({ ...first, id: 98, name: 'Ng', gear: { ...first.gear!, id: 98, rarity: 'rare', name: 'Long Rifle' } }, { ...first, id: 99, name: 'Ade', gear: { ...first.gear!, id: 99, rarity: 'epic', name: 'Old Carbine' } })
  dropGear(run, false)
  run.phase = 'reward'
  return run
}

const ownerOf = (run: Run) => run.soldiers.find((s) => s.id === run.finds[0].owner)!

test("a find sets its owner's weapon now beside the new one, and offers Equip on them or Sell", () => {
  const run = found()
  const owner = ownerOf(run)
  const html = findSwap(run, 0, null)
  expect(html).toContain(`for ${owner.name}`)
  expect(html).toContain(`<span class="tag">NOW</span><b class="tier ${owner.gear!.rarity}">${owner.gear!.rarity} ${gearName(owner.gear!)}</b>`)
  expect(html).toContain('class="side found arrive')
  expect(buttons(html).map((b) => b.label)).toEqual([`Equip on ${owner.name}`, `Sell · +${SELL[run.finds[0].rarity]} supplies`])
})

test('Equip puts the find on its owner alone, their weapon dropped for nothing', () => {
  const run = found()
  const owner = ownerOf(run)
  const gear = run.finds[0]
  const others = run.soldiers.filter((s) => s !== owner).map((s) => s.gear)
  const supplies = run.supplies
  apply(run, JSON.parse(buttons(findSwap(run, 0, null))[0].action!) as Action)
  expect(owner.gear).toBe(gear)
  expect(run.soldiers.filter((s) => s !== owner).map((s) => s.gear)).toEqual(others)
  expect(run.supplies).toBe(supplies)
  expect(run.finds).toEqual([])
})

test('Sell keeps every weapon and pays for the find', () => {
  const run = found()
  const gear = run.finds[0]
  const held = run.soldiers.map((s) => s.gear)
  const supplies = run.supplies
  apply(run, JSON.parse(buttons(findSwap(run, 0, null))[1].action!) as Action)
  expect(run.soldiers.map((s) => s.gear)).toEqual(held)
  expect(run.supplies).toBe(supplies + SELL[gear.rarity])
})

test('the new weapon lists what it changes from the one held', () => {
  const run = found()
  const owner = ownerOf(run)
  owner.gear = { ...owner.gear!, stats: {}, effect: null }
  run.finds[0] = { ...run.finds[0], stats: { damage: 1, move: -1 }, effect: 'ricochet' }
  const html = findSwap(run, 0, null)
  expect(html).toContain('<li class="up">+1 damage</li><li class="down">-1 move</li><li class="up">gains')
})

test('a shop ware is bought for its owner, or left', () => {
  const run = found()
  const gear = run.finds.pop()!
  const owner = run.soldiers.find((s) => s.id === gear.owner)!
  run.phase = 'shop'
  run.shop = { wares: [{ gear, sold: false }] } as typeof run.shop
  run.supplies = 99
  const price = GEAR_PRICE[gear.rarity as keyof typeof GEAR_PRICE]
  const html = shopSwap(run, 0, price, null)
  expect(html).toContain('<button class="confirm" data-ware="">Leave it</button>')
  apply(run, JSON.parse(buttons(html)[0].action!) as Action)
  expect(owner.gear).toBe(gear)
  expect(run.supplies).toBe(99 - price)
})

test('a find whose owner is gone can only be sold', () => {
  const run = found()
  run.finds[0].owner = -1
  expect(buttons(findSwap(run, 0, null)).map((b) => b.label)).toEqual([`Sell · +${SELL[run.finds[0].rarity]} supplies`])
})
