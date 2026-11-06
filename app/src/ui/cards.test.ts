import { expect, test } from 'vitest'
import { begun } from '../core/roads'
import { apply, type Action } from '../core/apply'
import { dropGear, GEAR_PRICE, SELL } from '../core/rewards'
import type { Run } from '../core/run-state'
import { findSwap, shopSwap } from './cards'

/** Each option's arm key and label, as the player reads them. */
const options = (html: string) => [...html.matchAll(/role="radio" aria-checked="(\w+)" data-arm="([^"]+)">.*?<b>(.*?)<\/b>/g)].map(([, on, key, label]) => ({ on: on === 'true', key, label: label.replace(/<[^>]*>/g, '') }))
const confirm = (html: string) => html.match(/class="decide confirm"( disabled)?(?: data-action='([^']+)')?/)!

/** A run of three heroes with one weapon found, in the reward phase. */
function found(): Run {
  const run = begun(1)
  const [first] = run.soldiers
  run.soldiers.push({ ...first, id: 98, name: 'Ng', gear: { ...first.gear!, id: 98, rarity: 'rare', name: 'Long Rifle' } }, { ...first, id: 99, name: 'Ade', gear: { ...first.gear!, id: 99, rarity: 'epic', name: 'Old Carbine' } })
  dropGear(run, false)
  run.phase = 'reward'
  return run
}

test('a find offers Equip on each hero, then Sell; Confirm waits for a choice', () => {
  const run = found()
  const html = findSwap(run, 0, null)
  expect(options(html).map((o) => o.label)).toEqual([...run.soldiers.map((s) => `Equip on ${s.name}`), `Sell · +${SELL[run.finds[0].rarity]} supplies`])
  expect(options(html).every((o) => !o.on)).toBe(true)
  expect(confirm(html)[1]).toBe(' disabled')
  expect(html).toContain('class="side found arrive')
})

test.each([0, 1, 2])('Equip on hero %i gives them the find and sells the weapon they held', (i) => {
  const run = found()
  const hero = run.soldiers[i]
  const held = hero.gear!
  const gear = run.finds[0]
  const html = findSwap(run, 0, `g${hero.id}`)
  expect(options(html).filter((o) => o.on).map((o) => o.label)).toEqual([`Equip on ${hero.name}`])
  expect(html).toContain(`drops <span class="tier ${held.rarity}">${held.name}</span>`)
  const others = run.soldiers.filter((s) => s !== hero).map((s) => s.gear)
  const supplies = run.supplies
  apply(run, JSON.parse(confirm(html)[2]) as Action)
  expect(hero.gear).toBe(gear)
  expect(run.soldiers.filter((s) => s !== hero).map((s) => s.gear)).toEqual(others)
  expect(run.supplies).toBe(supplies + SELL[held.rarity])
  expect(run.finds).toEqual([])
})

test('Sell keeps every weapon and pays for the find', () => {
  const run = found()
  const gear = run.finds[0]
  const held = run.soldiers.map((s) => s.gear)
  const supplies = run.supplies
  apply(run, JSON.parse(confirm(findSwap(run, 0, 'g-'))[2]) as Action)
  expect(run.soldiers.map((s) => s.gear)).toEqual(held)
  expect(run.supplies).toBe(supplies + SELL[gear.rarity])
})

test('a hero with empty hands drops nothing', () => {
  const run = found()
  run.soldiers[1].gear = null
  expect(findSwap(run, 0, null)).toContain('<small class="drop">Empty hands</small>')
})

test('a shop ware is bought for the hero chosen, selling theirs, or left', () => {
  const run = found()
  const gear = run.finds.pop()!
  run.phase = 'shop'
  run.shop = { wares: [{ gear, sold: false }] } as typeof run.shop
  run.supplies = 99
  const price = GEAR_PRICE[gear.rarity as keyof typeof GEAR_PRICE]
  const hero = run.soldiers[2]
  const held = hero.gear!
  expect(options(shopSwap(run, 0, price, null)).at(-1)!.label).toBe('Leave it')
  expect(shopSwap(run, 0, price, 'g-')).toContain('class="decide confirm" data-ware=""')
  apply(run, JSON.parse(confirm(shopSwap(run, 0, price, `g${hero.id}`))[2]) as Action)
  expect(hero.gear).toBe(gear)
  expect(run.supplies).toBe(99 - price + SELL[held.rarity])
})
