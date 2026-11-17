import { expect, test } from 'vitest'
import { apply } from './apply'
import { GRID, isSoldier, type Battle } from './battle'
import { findUtility, gainUtility, settle, stockShop } from './rewards'
import { begun, road } from './roads'
import { createRun } from './run'
import { type Run } from './run-state'
import { drawBattle } from './missions'
import { rider, tickBoons } from './boons'
import type { GameEvent } from './combat-event'
import { strides } from './grid'
import { soldierStats } from './hero'
import { amountOf, boonText, MAX_LEVEL, START_OFFERS, UTILITIES, UTILITY_IDS, UTILITY_PRICE, UTILITY_SLOTS, type Held, type UtilityId } from './utilities'

const held = (...ids: UtilityId[]): Held[] => ids.map((id) => ({ id, level: 1 }))

/** A run at a battle's deploy screen, holding `boons`. */
function landing(boons: Held[], seed = 1): Run {
  const run = begun(seed)
  run.utilities = boons
  let stop = drawBattle(run, 'standard')
  for (let tries = 0; stop.goal !== 'cross' || stop.terrain === 'hive'; tries++) stop = drawBattle(run, 'standard')
  road(run, [stop])
  apply(run, { type: 'advance' })
  return run
}

const hero = (run: Run) => run.battle!.units.find(isSoldier)!

test('a run offers START_OFFERS boons and takes exactly UTILITY_SLOTS before anything else', () => {
  const run = createRun(5)
  apply(run, { type: 'hero', index: 0 })
  expect(run.boonOffers).toHaveLength(START_OFFERS)
  expect(apply(run, { type: 'go', index: 0 }).ok).toBe(false)
  expect(apply(run, { type: 'boons', picks: [1, 2] }).ok).toBe(false)
  expect(apply(run, { type: 'boons', picks: [1, 1, 2] }).ok).toBe(false)
  const offered = [...run.boonOffers]
  expect(apply(run, { type: 'boons', picks: [4, 0, 2] })).toEqual({ ok: true })
  expect(run.utilities).toEqual(held(offered[4], offered[0], offered[2]))
  expect(run.phase).toBe('overworld')
})

test('every boon held works in every battle: its stat on the hero, its effects lent', () => {
  const bare = landing([])
  const base = bare.battle!.reserve[0].stats
  for (const id of UTILITY_IDS) {
    const run = landing(held(id))
    const { adds, lends } = UTILITIES[id]
    const stats = run.battle!.reserve[0].stats
    if (adds.to in base) expect(stats[adds.to as keyof typeof base], id).toBeCloseTo(base[adds.to as keyof typeof base] + amountOf(id, 1))
    for (const effect of lends) expect(run.battle!.reserve[0].effects, id).toContain(effect)
    apply(run, { type: 'enter' })
    expect(run.battle!.boons).toEqual(held(id))
  }
})

test('a boon raises more at each level, its text saying how much', () => {
  for (const id of UTILITY_IDS) {
    const by = UTILITIES[id].adds.by
    expect(by[1], id).toBeGreaterThan(by[0])
    expect(by[2], id).toBeGreaterThan(by[1])
    expect(boonText(id, 3), id).not.toBe(boonText(id, 1))
  }
  const run = begun(1)
  run.utilities = [{ id: 'nanoweave', level: 2 }]
  run.utilities[0].level = 1
  const one = soldierStats(run, run.hero).hp
  run.utilities[0].level = 2
  expect(soldierStats(run, run.hero).hp).toBe(one + amountOf('nanoweave', 2) - amountOf('nanoweave', 1))
})

test('Ablative Field takes its amount off each hit on the hero; Regen Gel heals at the start of its turn; Force Gauntlet drives by level', () => {
  const run = landing([{ id: 'ablative', level: 2 }, { id: 'regen', level: 1 }, { id: 'gauntlet', level: 3 }])
  apply(run, { type: 'enter' })
  const battle = run.battle!
  const me = hero(run)
  expect(rider(battle, me, 'guard')).toBe(amountOf('ablative', 2))
  expect(rider(battle, me, 'push')).toBe(amountOf('gauntlet', 3))
  expect(rider(battle, battle.units.find((u) => u.side === 'alien')!, 'guard')).toBe(0)
  me.hp = 1
  const events: GameEvent[] = []
  tickBoons(battle, events)
  expect(me.hp).toBe(1 + amountOf('regen', 1))
  expect(events).toContainEqual(expect.objectContaining({ effect: 'regen', amount: amountOf('regen', 1) }))
})

test('Long Jump leaps a water gap a plain jump cannot', () => {
  const run = landing([])
  const battle = run.battle! as Battle
  const from = { x: 10, y: 10 }
  for (const x of [10, 13]) battle.ground[10 * GRID + x] = 'grass'
  for (const x of [11, 12]) battle.ground[10 * GRID + x] = 'water'
  battle.height.fill(0)
  battle.west.fill('none')
  battle.north.fill('none')
  const lands = (span: number) => strides(battle, from, 2, span).some((t) => t.x === 13 && t.y === 10)
  expect(lands(0)).toBe(false)
  expect(lands(1)).toBe(true)
})

test('a new boon with every slot full is shown for a swap: slotted in for one held, or left', () => {
  const run = landing(held('plasma', 'riot', 'longshot'))
  const found = 'tracer'
  gainUtility(run, found)
  settle(run)
  expect(run.spare).toBe(found)
  expect(run.phase).toBe('reward')
  expect(apply(run, { type: 'advance' }).ok).toBe(false)
  expect(apply(run, { type: 'keep', drop: 3 }).ok).toBe(false)
  apply(run, { type: 'keep', drop: 1 })
  expect(run.utilities).toEqual(held('plasma', found, 'longshot'))
  expect(run.spare).toBeNull()
  run.spare = 'nanoweave'
  apply(run, { type: 'keep', drop: -1 })
  expect(run.utilities).toEqual(held('plasma', found, 'longshot'))
})

test('a boon gained while held rises a level, to MAX_LEVEL, and the player is told', () => {
  const run = begun(1)
  run.utilities = held('plasma', 'riot', 'longshot')
  for (let i = 0; i < MAX_LEVEL + 1; i++) gainUtility(run, 'riot')
  expect(run.spare).toBeNull()
  expect(run.utilities[1]).toEqual({ id: 'riot', level: MAX_LEVEL })
  expect(run.gains.at(-1)).toEqual({ kind: 'boon', id: 'riot', level: MAX_LEVEL })
  run.utilities = UTILITY_IDS.map((id) => ({ id, level: MAX_LEVEL }))
  expect(findUtility(run)).toBeNull()
})

test('a boon bought with no slot free and put back returns to the shelf, its price repaid', () => {
  const run = begun(1)
  run.phase = 'shop'
  run.shop = stockShop(run)
  run.utilities = held(...UTILITY_IDS.filter((id) => !run.shop!.utilities.some((item) => item.id === id)).slice(0, UTILITY_SLOTS))
  run.supplies = UTILITY_PRICE
  apply(run, { type: 'utility', index: 0 })
  expect(run.spare).toBe(run.shop.utilities[0].id)
  apply(run, { type: 'keep', drop: -1 })
  expect(run.spare).toBeNull()
  expect(run.supplies).toBe(UTILITY_PRICE)
  expect(run.shop.utilities[0].sold).toBe(false)
})
