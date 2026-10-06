import { expect, test } from 'vitest'
import { apply } from './apply'
import { BASE_STATS, type Unit } from './battle'
import { stepBattle } from './combat'
import { EFFECTS, generateGear, type Gear } from './gear'
import { createRun, equipped, holder, soldierStats, type Run } from './run'

test('gear is built by rarity: commons have one mod, rares add an effect for their slot, epics add a second mod', () => {
  const rng = { rng: 7 }
  for (let id = 0; id < 200; id++) {
    const rarity = (['common', 'rare', 'epic'] as const)[id % 3]
    const gear = generateGear(rng, id, rarity)
    const words = gear.name.split(' ').length
    expect(words).toBe({ common: 2, rare: 3, epic: 4 }[rarity])
    expect(gear.effect === null).toBe(rarity === 'common')
    if (gear.effect) expect(EFFECTS[gear.effect].slot).toBe(gear.slot)
    expect(Object.keys(gear.stats).length).toBeGreaterThan(0)
  }
})

/** A run holding one piece of gear, in the stash. */
function withGear(gear: Omit<Gear, 'id'>): Run {
  const run = createRun(1)
  run.gear.push({ id: 1, ...gear })
  return run
}

test('equipping adds the gear to one soldier, moves it between soldiers, and unequipping returns it to the stash', () => {
  const run = withGear({ slot: 'armor', rarity: 'common', name: 'Sturdy Vest', stats: { hp: 2 }, effect: null })
  const [first, second] = run.soldiers
  expect(apply(run, { type: 'equip', soldier: first.id, gear: 1 })).toEqual({ ok: true })
  expect(soldierStats(run, first).hp).toBe(BASE_STATS.hp + 2)
  expect(apply(run, { type: 'equip', soldier: first.id, gear: 1 })).toEqual({ ok: false, reason: 'already equipped' })
  apply(run, { type: 'equip', soldier: second.id, gear: 1 })
  expect(equipped(run, first)).toEqual([])
  expect(holder(run, run.gear[0])).toBe(second)
  expect(apply(run, { type: 'unequip', soldier: second.id, slot: 'armor' })).toEqual({ ok: true })
  expect(holder(run, run.gear[0])).toBeUndefined()
  expect(apply(run, { type: 'unequip', soldier: second.id, slot: 'armor' }).ok).toBe(false)
})

/** A duel on open ground: one soldier wearing `gear`, one alien beside it, and the soldier too weak to win quickly. */
function duel(gear: Omit<Gear, 'id'>): { soldier: Unit; alien: Unit; step: () => ReturnType<typeof stepBattle> } {
  const run = withGear(gear)
  apply(run, { type: 'equip', soldier: run.soldiers[0].id, gear: 1 })
  apply(run, { type: 'mission', index: 0 })
  apply(run, { type: 'land', zone: 0 })
  const battle = run.battle!
  battle.cover.fill(0)
  const soldier = battle.units.find((u) => u.soldier === run.soldiers[0].id)!
  const alien = battle.units.find((u) => u.side === 'alien')!
  battle.units = [soldier, alien]
  battle.pods.forEach((pod) => (pod.revealed = true))
  Object.assign(soldier, { x: 10, y: 10 })
  Object.assign(alien, { x: 10, y: 11, hp: 99, stats: { ...alien.stats, hp: 99, aim: 2, crit: 0 } })
  return { soldier, alien, step: () => stepBattle(battle) }
}

/** Steps until the alien has shot once, returning every event up to then. */
function untilAlienShoots(d: ReturnType<typeof duel>) {
  const events = []
  for (;;) {
    const beat = d.step()
    events.push(...beat)
    if (beat.some((e) => e.type === 'shot' && e.id === d.alien.id)) return events
  }
}

test('warded armor absorbs the first hit and only the first', () => {
  const d = duel({ slot: 'armor', rarity: 'rare', name: 'Warded Sturdy Vest', stats: {}, effect: 'shield' })
  expect(untilAlienShoots(d)).toContainEqual({ type: 'effect', id: d.soldier.id, effect: 'shield', amount: 0 })
  expect(d.soldier.hp).toBe(d.soldier.stats.hp)
  untilAlienShoots(d)
  expect(d.soldier.hp).toBe(d.soldier.stats.hp - d.alien.stats.damage)
})

test('barbed armor wounds whoever hits its wearer', () => {
  const d = duel({ slot: 'armor', rarity: 'rare', name: 'Barbed Sturdy Vest', stats: {}, effect: 'thorns' })
  d.soldier.stats = { ...d.soldier.stats, damage: 0, crit: 0 }
  untilAlienShoots(d)
  expect(d.alien.hp).toBe(98)
})

test('a scorching weapon burns its target at the start of the target\'s turns', () => {
  const d = duel({ slot: 'weapon', rarity: 'rare', name: 'Scorching Steady Carbine', stats: { aim: 2 }, effect: 'incendiary' })
  d.soldier.stats = { ...d.soldier.stats, damage: 1, crit: 0 }
  const events = untilAlienShoots(d)
  expect(events).toContainEqual({ type: 'effect', id: d.alien.id, effect: 'incendiary', amount: 0 })
  expect(events).toContainEqual({ type: 'effect', id: d.alien.id, effect: 'incendiary', amount: -1 })
  expect(d.alien.hp).toBe(99 - 1 - 1)
})
