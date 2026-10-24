import { expect, test } from 'vitest'
import { apply } from './apply'
import { alienUnit, type Battle, type Unit } from './battle'
import { stepBattle } from './combat'
import { EFFECTS, generateGear, type Gear } from './gear'
import { createRun, SELL, soldierStats, type Run } from './run'

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

/** A run whose clone has learned its first skill and found `gear`. */
function withFind(gear: Omit<Gear, 'id'>): Run {
  const run = createRun(1)
  apply(run, { type: 'skill', soldier: run.soldiers[0].id, index: 0 })
  run.finds.push({ soldier: run.soldiers[0].id, gear: { id: 1, ...gear } })
  run.phase = 'reward'
  return run
}

test('found gear is equipped on its finder, selling what it replaces, or sold; then the reward phase ends', () => {
  const vest = { slot: 'armor', rarity: 'common', name: 'Sturdy Vest', stats: { armor: 2 }, effect: null } as const
  const run = withFind(vest)
  const [clone] = run.soldiers
  expect(soldierStats(run, clone).armor).toBe(0)
  expect(apply(run, { type: 'keep' })).toEqual({ ok: true })
  expect(soldierStats(run, clone).armor).toBe(2)
  expect(run).toMatchObject({ finds: [], phase: 'overworld' })
  const supplies = run.supplies
  run.finds.push({ soldier: clone.id, gear: { id: 2, ...vest, rarity: 'rare', stats: { armor: 4 } } })
  run.phase = 'reward'
  apply(run, { type: 'keep' })
  expect(run.supplies).toBe(supplies + SELL.common)
  expect(clone.gear.armor).toMatchObject({ id: 2 })
  run.finds.push({ soldier: clone.id, gear: { id: 3, ...vest, rarity: 'epic' } })
  run.phase = 'reward'
  apply(run, { type: 'sell' })
  expect(run.supplies).toBe(supplies + SELL.common + SELL.epic)
  expect(clone.gear.armor).toMatchObject({ id: 2 })
  expect(apply(run, { type: 'sell' }).ok).toBe(false)
})

/** A duel on open ground: one soldier wearing `gear`, one alien beside it, and the soldier too weak to win quickly. */
function duel(gear: Omit<Gear, 'id'>): { battle: Battle; soldier: Unit; alien: Unit; step: () => ReturnType<typeof stepBattle> } {
  const run = withFind(gear)
  apply(run, { type: 'keep' })
  apply(run, { type: 'zone', index: 1 })
  apply(run, { type: 'advance' })
  // War drums pay off only on a kill, so they leave a duel as it is.
  run.battle!.boons[0] = 'kill'
  apply(run, { type: 'land', zone: 0 })
  const battle = run.battle!
  battle.cover.fill(0)
  battle.north.fill('none')
  battle.west.fill('none')
  const soldier = battle.units.find((u) => u.soldier === run.soldiers[0].id)!
  const alien = battle.units.find((u) => u.side === 'alien')!
  battle.units = [soldier, alien]
  battle.pods.forEach((pod) => (pod.revealed = true))
  Object.assign(soldier, { x: 10, y: 10 })
  Object.assign(alien, { x: 10, y: 11, hp: 99, stats: { ...alien.stats, hp: 99, aim: 2, crit: 0 } })
  return { battle, soldier, alien, step: () => stepBattle(battle) }
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

test('a rimed weapon chills its target, and a shatterglass edge and thermal shock core pay off on it', () => {
  const d = duel({ slot: 'weapon', rarity: 'rare', name: 'Rimed Steady Carbine', stats: { aim: 2 }, effect: 'frostbite' })
  d.soldier.stats = { ...d.soldier.stats, damage: 2, crit: 0 }
  d.soldier.effects.push('shatter', 'thermal')
  const shots = () => {
    const events = untilAlienShoots(d)
    return events.filter((e) => e.type === 'shot' && e.id === d.soldier.id)
  }
  const [first] = shots()
  expect(first).toMatchObject({ hit: true, damage: 2 })
  expect(d.alien.chilled).toBeGreaterThan(0)
  d.alien.burning = 5
  const [second] = shots()
  expect(second).toMatchObject({ hit: true, damage: 2 + 2 + 3 })
})

test('an alien that resists frost and burn is neither chilled nor set burning', () => {
  const d = duel({ slot: 'weapon', rarity: 'rare', name: 'Rimed Steady Carbine', stats: { aim: 2 }, effect: 'frostbite' })
  d.soldier.stats = { ...d.soldier.stats, damage: 1, crit: 0 }
  d.soldier.effects.push('incendiary')
  d.alien.resists = ['frost', 'burn']
  untilAlienShoots(d)
  expect(d.alien.chilled).toBe(0)
  expect(d.alien.burning).toBe(0)
})

test('overkill coils carry damage beyond a kill to the nearest other alien', () => {
  const d = duel({ slot: 'weapon', rarity: 'rare', name: 'Steady Carbine', stats: { aim: 2 }, effect: null })
  d.soldier.stats = { ...d.soldier.stats, damage: 10, crit: 0 }
  d.soldier.effects.push('overkill')
  d.alien.hp = 4
  d.alien.armor = 0
  const other = alienUnit(d.battle, { kind: 'trooper', stats: { ...d.alien.stats, hp: 99, armor: 0 }, stance: 'anchor', boss: false, spawns: false, target: false, resists: [] }, { x: d.alien.x + 1, y: d.alien.y }, 0)
  d.battle.units.push(other)
  const events = []
  while (d.alien.hp > 0) events.push(...d.step())
  const shot = events.find((e) => e.type === 'shot' && e.target === d.alien.id && e.hit)
  expect(shot).toBeDefined()
  expect(events).toContainEqual({ type: 'effect', id: other.id, effect: 'overkill', amount: -(shot!.type === 'shot' ? shot!.damage - 4 : 0) })
})
