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

test('the newer hit talents add their damage only when their condition holds', () => {
  const cases: [Effect, (hero: Unit, alien: Unit) => void, number][] = [
    ['bully', (h, a) => (a.hp = h.hp - 1), TALENT.bonus],
    ['whiteHeat', (_, a) => (a.burn = 1), TALENT.kill],
    ['firebrand', (_, a) => (a.burn = 3), 3],
    ['brittle', (_, a) => (a.chill = 1), TALENT.kill],
    ['thousandCuts', (h) => (h.hits = 7), 3],
  ]
  for (const [effect, ready, worth] of cases) {
    expect(bonus([effect], undefined, ready).more, effect).toBe(worth)
    expect(bonus([effect]).more, effect).toBe(0)
  }
  expect(bonus(['kindling']).more).toBe(TALENT.bonus)
  expect(bonus(['kindling'], undefined, (_, a) => (a.burn = 1)).more).toBe(0)
  const crowd = arena(['wrecker'], [{ x: 13, y: 10 }, { x: 14, y: 10 }, { x: 12, y: 10 }])
  expect(talentDamage(crowd.battle, crowd.hero, crowd.aliens[0], [], [])).toBe(TALENT.kill)
  expect(talentDamage(crowd.battle, crowd.hero, crowd.aliens[1], [], [])).toBe(0)
})

test('the newer guards: from afar, standing still, against the burning, for machines, beside a guardian', () => {
  const guard = (effects: Effect[], spot: { x: number; y: number }, ready: (hero: Unit, alien: Unit) => void = () => {}) => {
    const { battle, hero, aliens } = arena(effects, [spot])
    ready(hero, aliens[0])
    return talentDamage(battle, aliens[0], hero, [], [])
  }
  const near = { x: 11, y: 10 }
  const far = { x: 14, y: 10 }
  expect(guard(['hunker'], far)).toBe(-TALENT.soak)
  expect(guard(['hunker'], near)).toBe(0)
  expect(guard(['untouchable'], far)).toBe(-TALENT.kill)
  expect(guard(['untouchable'], far, (h) => (h.moved = true))).toBe(0)
  expect(guard(['emberWard'], far, (_, a) => (a.burn = 1))).toBe(-TALENT.soak)
  expect(guard(['emberWard'], far)).toBe(0)
  const { battle, hero, aliens } = arena(['armoredDrones', 'guardian'], [far])
  const mech = mechUnit(battle, hero, { ...MECH_STATS }, [], { x: 10, y: 11 })
  battle.units.push(mech)
  expect(talentDamage(battle, aliens[0], mech, [], [])).toBe(-TALENT.soak)
  expect(talentDamage(battle, aliens[0], hero, [], [])).toBe(0)
})

test('Overdrive and War Song add damage: an engineer’s machines, and anyone near the singer', () => {
  const { battle, hero, aliens } = arena(['overdrive', 'warSong'], [{ x: 14, y: 10 }])
  const mech = mechUnit(battle, hero, { ...MECH_STATS }, [], { x: 10, y: 11 })
  battle.units.push(mech)
  expect(talentDamage(battle, hero, aliens[0], [], [])).toBe(TALENT.bonus)
  expect(talentDamage(battle, mech, aliens[0], [], [])).toBe(TALENT.big + TALENT.bonus)
})

test('newer hit talents: armor built when hit, every 2nd hit up close stuns, a burn spreads', () => {
  const { battle, hero, aliens } = arena(['concussiveForce', 'spread', 'hardened'], [{ x: 11, y: 10 }, { x: 12, y: 10 }])
  const [a, b] = aliens
  a.burn = 2
  hero.hits = 1
  talentHit(battle, hero, a, false, [])
  expect(a.panicked).toBeFalsy()
  expect(b.burn).toBeGreaterThan(0)
  hero.hits = 2
  talentHit(battle, hero, a, false, [])
  expect(a.panicked).toBe(true)
  const armor = hero.armor
  for (let i = 0; i < TALENT.hardMax + 2; i++) talentHit(battle, a, hero, false, [])
  expect(hero.armor).toBe(armor + TALENT.hardMax)
})

test('newer kill talents: a chilled kill freezes those beside, a kill terrifies those near, heals and empowers; a machine’s kill heals it and its engineer', () => {
  const { battle, hero, aliens } = arena(['nightmare', 'soulHarvest'], [{ x: 11, y: 10 }, { x: 12, y: 10 }, { x: 13, y: 10 }])
  hero.hp = 1
  talentKill(battle, aliens[0], hero, [])
  expect(aliens[1].panicked).toBe(true)
  expect(aliens[2].panicked).toBe(true)
  expect(hero.hp).toBe(1 + TALENT.heal)
  expect(hero.might).toBe(1)
  const ice = arena(['iceAge'], [{ x: 11, y: 10 }, { x: 12, y: 10 }])
  talentKill(ice.battle, ice.aliens[0], ice.hero, [])
  expect(ice.aliens[1].panicked).toBeFalsy()
  ice.aliens[0].chill = 1
  talentKill(ice.battle, ice.aliens[0], ice.hero, [])
  expect(ice.aliens[1].panicked).toBe(true)
  const hive = arena(['hiveQueen'], [{ x: 14, y: 10 }])
  const mech = mechUnit(hive.battle, hive.hero, { ...MECH_STATS, hp: 10 }, [], { x: 10, y: 11 })
  mech.hp = 2
  hive.hero.hp = 1
  hive.battle.units.push(mech)
  talentKill(hive.battle, hive.aliens[0], mech, [])
  expect([mech.hp, hive.hero.hp]).toEqual([2 + TALENT.heal, 1 + TALENT.heal])
})

test('newer turn talents: zaps beside and within 2, a wider chill, heals by burning foes, an ally healed', () => {
  const { battle, hero, aliens } = arena(['tremor', 'staticField', 'polarVortex', 'emberHeart', 'wellspring'], [{ x: 11, y: 10 }, { x: 12, y: 10 }])
  const mate = mechUnit(battle, hero, { ...MECH_STATS, hp: 10 }, [], { x: 10, y: 11 })
  mate.hp = 4
  battle.units.push(mate)
  aliens[1].burn = 1
  hero.hp = 1
  talentTurn(battle, hero, [])
  expect(aliens.map((a) => a.hp)).toEqual([40 - 2 * TALENT.zap, 40 - TALENT.zap])
  expect(aliens[1].chill).toBeGreaterThan(0)
  expect(hero.hp).toBe(1 + TALENT.heal)
  expect(mate.hp).toBe(4 + TALENT.mend)
})

test('Berserker crits at half HP or less; Perfect Shot adds to a crit', () => {
  const shot = (effects: Effect[], hp: number) => {
    const { hero, beats } = arena(effects, [{ x: 13, y: 10 }])
    hero.stats = { ...hero.stats, crit: 0 }
    hero.hp = hp
    return beats(1).find((e) => e.type === 'shot') as { crit: boolean; damage: number }
  }
  expect(shot(['berserk'], 1).crit).toBe(true)
  expect(shot(['berserk'], 30).crit).toBe(false)
  expect(shot(['berserk', 'perfectShot'], 1).damage - shot(['berserk'], 1).damage).toBe(TALENT.kill)
})
