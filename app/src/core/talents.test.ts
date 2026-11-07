import { expect, test } from 'vitest'
import { arena } from './arena'
import { MECH_STATS, type Effect, type Unit } from './battle'
import type { GameEvent } from './combat-event'
import { mechUnit } from './spawn'
import { talentDamage, talentHit, talentKill, talentTurn } from './talents'
import { TALENT } from './tuning'

/** A hero with `effects` at 10,10 and an alien at `spot`, each set up by `ready`; what the hero's talents add to its hit on it, and what they said. */
function bonus(effects: Effect[], spot = { x: 13, y: 10 }, ready: (hero: Unit, alien: Unit) => void = () => {}) {
  const { battle, hero, aliens } = arena(effects, [spot])
  ready(hero, aliens[0])
  const used: Effect[] = []
  return { more: talentDamage(battle, hero, aliens[0], used, []), used }
}

test('each hit talent adds its damage only when its condition holds, and says so', () => {
  const cases: [Effect, (hero: Unit, alien: Unit) => void, number][] = [
    ['battleJoy', () => {}, TALENT.bonus],
    ['charge', (h) => (h.moved = true), TALENT.bonus],
    ['snapShot', (h) => (h.moved = true), 1],
    ['demolisher', (_, a) => (a.armor = 3), TALENT.bonus],
    ['bigGame', (h) => (h.stats = { ...h.stats, hp: 10 }), TALENT.bonus],
    ['killshot', (_, a) => (a.hp = 8), TALENT.kill],
    ['bloodScent', (_, a) => (a.hp = 15), TALENT.bonus],
    ['ambush', (h) => (h.hits = 1), TALENT.big],
    ['shatterpoint', (_, a) => (a.frozen = true), TALENT.big],
    ['combust', (_, a) => (a.burn = 3), 3],
  ]
  for (const [effect, ready, worth] of cases) {
    const on = bonus([effect], undefined, ready)
    expect(on.more, effect).toBe(worth)
    expect(on.used).toEqual([effect])
    expect(bonus([], undefined, ready).more).toBe(0)
  }
  expect(bonus(['battleJoy'], undefined, (h) => (h.hp = 1)).more).toBe(0)
  expect(bonus(['artillery'], { x: 14, y: 10 }).more).toBe(TALENT.bonus)
  expect(bonus(['artillery'], { x: 12, y: 10 }).more).toBe(0)
  expect(bonus(['killshot'], undefined, (_, a) => (a.hp = 20)).more).toBe(0)
})

test('each guard talent takes damage off a hit on it only when its condition holds', () => {
  const guard = (effects: Effect[], spot: { x: number; y: number }, ready: (hero: Unit, alien: Unit) => void = () => {}) => {
    const { battle, hero, aliens } = arena(effects, [spot])
    ready(hero, aliens[0])
    const events: GameEvent[] = []
    return talentDamage(battle, aliens[0], hero, [], events)
  }
  const near = { x: 11, y: 10 }
  const far = { x: 14, y: 10 }
  expect(guard(['grit'], near)).toBe(-TALENT.soak)
  expect(guard(['grit'], far)).toBe(0)
  expect(guard(['standAlone'], far)).toBe(-TALENT.soak)
  expect(guard(['camouflage'], far)).toBe(-TALENT.soak)
  expect(guard(['camouflage'], far, (h) => (h.moved = true))).toBe(0)
  expect(guard(['frostShell'], far, (_, a) => (a.chill = 1))).toBe(-TALENT.soak)
  expect(guard(['frostShell'], far)).toBe(0)
  expect(guard(['wraithForm'], far, (h) => (h.hp = 1))).toBe(-TALENT.soak)
  expect(guard(['heatShield'], near, (_, a) => (a.burn = 2))).toBe(-1)
})

test('Pilot Link and Bodyguard need the engineer’s machine; Target Link lets the machine hit harder what the engineer hit last', () => {
  const { battle, hero, aliens } = arena(['pilotLink', 'bodyguard', 'targetLink'], [{ x: 14, y: 10 }])
  expect(talentDamage(battle, hero, aliens[0], [], [])).toBe(0)
  const mech = mechUnit(battle, hero, { ...MECH_STATS }, [], { x: 10, y: 11 })
  battle.units.push(mech)
  expect(talentDamage(battle, hero, aliens[0], [], [])).toBe(TALENT.bonus)
  expect(talentDamage(battle, aliens[0], hero, [], [])).toBe(-TALENT.soak)
  hero.comboOn = aliens[0].id
  expect(talentDamage(battle, mech, aliens[0], [], [])).toBe(TALENT.bonus)
})

test('hit talents: armor broken, weakened, stunned every third hit, arcs, heals, Might when hit, burns and pays back', () => {
  const { battle, hero, aliens } = arena(['cracking', 'venom', 'staticCharge', 'arcWelder', 'soulDrain'], [{ x: 13, y: 10 }, { x: 14, y: 10 }])
  const [a, b] = aliens
  Object.assign(a, { armor: 3 })
  Object.assign(hero, { hp: hero.stats.hp - 2, hits: 3 })
  talentHit(battle, hero, a, false, [])
  expect(a.armor).toBe(3 - TALENT.crack)
  expect(a.suppressed).toBe(2)
  expect(a.panicked).toBe(true)
  expect(b.hp).toBe(40 - TALENT.zap)
  expect(hero.hp).toBe(hero.stats.hp - 1)
  const back = arena(['vengeance', 'cinderSkin'], [{ x: 11, y: 10 }])
  talentHit(back.battle, back.aliens[0], back.hero, false, [])
  expect(back.hero.might).toBe(1)
  expect(back.aliens[0].burn).toBeGreaterThan(0)
})

test('Retribution hurts an alien that hits an ally near it; Life Link heals the most wounded ally', () => {
  const { battle, hero, aliens } = arena(['retribution', 'lifeLink'], [{ x: 13, y: 10 }])
  const mate = mechUnit(battle, hero, { ...MECH_STATS, hp: 10 }, [], { x: 11, y: 10 })
  mate.hp = 5
  battle.units.push(mate)
  talentHit(battle, aliens[0], mate, false, [])
  expect(aliens[0].hp).toBe(40 - TALENT.zap)
  talentHit(battle, hero, aliens[0], false, [])
  expect(mate.hp).toBe(6)
})

test('kill talents: stuns beside, a cloak from afar, heals, move and a hymn’s Might', () => {
  const { battle, hero, aliens } = arena(['thunderclap', 'shadowFeed', 'carnage', 'battleHymn'], [{ x: 11, y: 10 }, { x: 12, y: 10 }])
  hero.hp = 1
  const move = hero.stats.move
  talentKill(battle, aliens[0], hero, [])
  expect(aliens[1].panicked).toBe(true)
  expect(hero.hp).toBe(1 + TALENT.heal)
  expect(hero.stats.move).toBe(move + 1)
  expect(hero.might).toBe(1)
  const far = arena(['shroud'], [{ x: 15, y: 10 }])
  talentKill(far.battle, far.aliens[0], far.hero, [])
  expect(far.hero.cloaked).toBeGreaterThan(0)
})

test('turn talents: armor for it and the most wounded ally, HP given away, aliens beside chilled, machines mended', () => {
  const { battle, hero, aliens } = arena(['bedrock', 'rally', 'transfusion', 'coldSnap', 'mechanic'], [{ x: 11, y: 10 }])
  const mech = mechUnit(battle, hero, { ...MECH_STATS, hp: 10 }, [], { x: 10, y: 11 })
  mech.hp = 4
  battle.units.push(mech)
  const armor = hero.armor
  talentTurn(battle, hero, [])
  expect(hero.armor).toBe(armor + TALENT.armor)
  expect(mech.armor).toBe(TALENT.armor)
  expect(mech.hp).toBe(4 + TALENT.heal)
  expect(hero.hp).toBe(hero.stats.hp - TALENT.heal)
  expect(aliens[0].chill).toBeGreaterThan(0)
  talentTurn(battle, mech, [])
  expect(mech.hp).toBe(Math.min(10, 4 + 2 * TALENT.heal))
})

test('Mercy Shot crits a target at half HP or less; Ice Spear strikes a chilled target past its armor', () => {
  const shot = (effects: Effect[], ready: (alien: Unit) => void) => {
    const { hero, aliens, beats } = arena(effects, [{ x: 13, y: 10 }])
    hero.stats = { ...hero.stats, crit: 0 }
    ready(aliens[0])
    const hp = aliens[0].hp
    const s = beats(1).find((e) => e.type === 'shot') as { crit: boolean }
    return { crit: s.crit, lost: hp - aliens[0].hp }
  }
  expect(shot(['deadeye'], (a) => (a.hp = 15)).crit).toBe(true)
  expect(shot(['deadeye'], () => {}).crit).toBe(false)
  const armored = (a: Unit) => Object.assign(a, { armor: 20, chill: 1 })
  expect(shot(['iceSpear'], armored).lost).toBeGreaterThan(0)
  expect(shot([], armored).lost).toBe(0)
})
