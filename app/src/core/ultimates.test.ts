import { expect, test } from 'vitest'
import { arena } from './arena'
import type { Unit } from './battle'
import { SKILLS } from './skills'
import { SKILL_EFFECTS, ULTIMATE_EFFECTS } from './skill-effects'
import { TIME_STOP } from './ultimates'
import { upkeep } from './upkeep'

const crowd = [{ x: 12, y: 10 }, { x: 13, y: 10 }, { x: 12, y: 11 }, { x: 13, y: 11 }]
const hurtAll = (aliens: Unit[]) => aliens.every((a) => a.hp < 40)

/** Every ultimate, in a crowd with its owner hurt: it fires once, and says so with an ultimate event. */
test.each(ULTIMATE_EFFECTS.filter((e) => e !== 'phoenixRising'))('%s fires once in its moment, and only once', (effect) => {
  const { battle, hero, beats } = arena([effect], crowd)
  hero.hp = Math.floor(hero.stats.hp / 3)
  const first = beats(1)
  expect(first).toContainEqual(expect.objectContaining({ type: 'ultimate', id: hero.id, effect }))
  expect(hero.spent).toContain(effect)
  battle.turn = 'human'
  battle.shooter = 0
  expect(beats(1).some((e) => e.type === 'ultimate')).toBe(false)
})

test('every ultimate is once a battle and names an effect', () => {
  for (const effect of ULTIMATE_EFFECTS) {
    expect(Object.values(SKILLS).find((s) => s.effect === effect)!.use).toBe('1/battle')
    expect(SKILL_EFFECTS as readonly string[]).toContain(effect)
  }
})

test('what the ultimates do', () => {
  const quake = arena(['earthquake'], crowd)
  quake.beats(1)
  expect(hurtAll(quake.aliens)).toBe(true)
  expect(quake.aliens[0].surprised).toBe(1)

  const stop = arena(['timeStop'], crowd)
  stop.beats(1)
  expect(stop.aliens.map((a) => a.surprised)).toEqual(crowd.map(() => TIME_STOP))

  const sentence = arena(['deathSentence'], crowd)
  Object.assign(sentence.aliens[1], { boss: true, hp: 60 })
  sentence.beats(1)
  expect(sentence.aliens[1].hp).toBeLessThanOrEqual(20)

  const shield = arena(['divineShield'], crowd)
  shield.hero.hp = 2
  shield.beats(1)
  expect(shield.hero.invulnerable).toBeGreaterThan(0)
  shield.battle.turn = 'alien'
  shield.battle.shooter = 0
  shield.battle.stage = 'shoot'
  shield.hero.stats = { ...shield.hero.stats, damage: 0 }
  const before = shield.hero.hp
  shield.beats(4)
  expect(shield.hero.hp).toBe(before)

  const titan = arena(['titanForm'], crowd)
  titan.hero.hp = 2
  titan.beats(1)
  expect(titan.hero.giant).toBe(true)
  expect(titan.hero.hp).toBe(titan.hero.stats.hp)

  const giant = arena(['colossus'], crowd)
  giant.beats(1)
  expect(giant.battle.units.find((u) => u.summoner !== null)).toMatchObject({ giant: true, effects: ['taunt'] })

  const mirrors = arena(['hallOfMirrors'], crowd)
  mirrors.beats(1)
  expect(mirrors.battle.units.filter((u) => u.summoner !== null)).toHaveLength(4)

  const storm = arena(['blizzard'], crowd)
  storm.beats(1)
  const stormed = storm.aliens[0].hp
  upkeep(storm.battle)
  expect(storm.aliens[0].hp).toBeLessThan(stormed)
  expect(storm.aliens[0].chill).toBeGreaterThan(0)

  const reap = arena(['reap'], crowd)
  reap.aliens[0].hp = 10
  reap.beats(1)
  expect(reap.battle.units.includes(reap.aliens[0])).toBe(false)
  expect(reap.aliens[1].hp).toBe(20)

  const dark = arena(['eclipse'], crowd)
  const mate = { ...dark.hero, id: 700, soldier: 99, effects: [], x: 8, y: 8 }
  dark.battle.units.push(mate)
  dark.beats(1)
  expect(mate.cloaked).toBeGreaterThan(0)
})

test('Level the Block and Orbital Lance flatten what stands in reach', () => {
  const level = arena(['levelBlock'], crowd)
  level.battle.props[10 * 96 + 14] = 'crate'
  level.beats(1)
  expect(level.battle.props[10 * 96 + 14]).toBe('none')
  expect(hurtAll(level.aliens)).toBe(true)

  const lance = arena(['orbital'], crowd)
  lance.battle.props[10 * 96 + 16] = 'crate'
  lance.beats(1)
  expect(lance.battle.props[10 * 96 + 16]).toBe('none')
})

test('Resurrection raises the fallen and heals all; Phoenix Rising comes back from death', () => {
  const { battle, hero, beats } = arena(['resurrection'], crowd)
  const fallen = { ...hero, id: 700, soldier: 99, hp: 0 }
  battle.downed.push({ soldier: 99, x: 8, y: 8, carrier: null, unit: fallen })
  hero.hp = 3
  beats(1)
  expect(battle.units.includes(fallen)).toBe(true)
  expect(fallen.hp).toBe(fallen.stats.hp)
  expect(hero.hp).toBe(hero.stats.hp)
  expect(battle.downed).toEqual([])

  const phoenix = arena(['phoenixRising'], crowd)
  Object.assign(phoenix.hero, { hp: 1, stats: { ...phoenix.hero.stats, damage: 0 } })
  phoenix.aliens[0].stats = { ...phoenix.aliens[0].stats, damage: 9 }
  phoenix.battle.turn = 'alien'
  const events = phoenix.beats(6)
  expect(events).toContainEqual(expect.objectContaining({ type: 'ultimate', effect: 'phoenixRising' }))
  expect(phoenix.battle.units.includes(phoenix.hero)).toBe(true)
  expect(hurtAll(phoenix.aliens)).toBe(true)
})
