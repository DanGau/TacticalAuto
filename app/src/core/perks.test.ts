import { expect, test } from 'vitest'
import { apply } from './apply'
import { arena } from './arena'
import type { GameEvent } from './combat-event'
import { GRID } from './battle'
import { reshaped } from './grid'
import { costOf, moveOf, walk } from './pathing'
import { PERK, PERK_LEVELS, PERKS, perkOffers, type PerkId } from './perks'
import { begun } from './roads'
import { sourceName } from './source-names'
import { srcOf } from './sources'
import { charges, minorOffers, soldierStats, xpFor } from './squad'
import { talentDamage, talentKill, talentTurn } from './talents'

test('a perk is owed at each perk level: three different offers, each open to the hero, those passed over left in the pool', () => {
  const run = begun(1)
  const hero = run.soldiers[0]
  expect(minorOffers(hero)).toEqual([])
  for (const at of PERK_LEVELS) {
    hero.xp = xpFor(at)
    run.phase = 'reward'
    while (minorOffers(hero).length > 0) {
      const offers = minorOffers(hero)
      expect(new Set(offers).size).toBe(3)
      for (const id of offers) {
        expect(hero.perks).not.toContain(id)
        expect([undefined, hero.cls]).toContain(PERKS[id].cls)
        if (PERKS[id].needs) expect(hero.perks).toContain(PERKS[id].needs)
      }
      expect(apply(run, { type: 'perk', soldier: hero.id, index: 2 }).ok).toBe(true)
      expect(hero.perks.at(-1)).toBe(offers[2])
    }
  }
  expect(hero.perks).toHaveLength(PERK_LEVELS.length)
  const open = (Object.keys(PERKS) as PerkId[]).filter((id) => !hero.perks.includes(id) && (!PERKS[id].cls || PERKS[id].cls === hero.cls) && (!PERKS[id].needs || hero.perks.includes(PERKS[id].needs!)))
  const seen = new Set(Array.from({ length: 200 }, (_, seed) => perkOffers({ ...hero, seed })).flat())
  for (const id of open) expect(seen).toContain(id)
})

test('stat perks add to stats, and ability perks to uses', () => {
  const run = begun(1)
  const hero = run.soldiers[0]
  const before = soldierStats(run, hero)
  hero.perks = ['toughness', 'ironGut', 'padding', 'keenEye', 'fleetFoot', 'springLegs', 'scope']
  const after = soldierStats(run, hero)
  expect(after.hp - before.hp).toBe(4)
  expect(after.armor - before.armor).toBe(1)
  expect(after.crit - before.crit).toBeCloseTo(PERKS.keenEye.stats!.crit! + PERKS.scope.stats!.crit!)
  expect(after.move - before.move).toBe(1)
  expect(after.jump - before.jump).toBe(1)
  hero.cls = 'support'
  hero.skills = ['healingLight']
  const uses = charges(run, hero)
  hero.perks = ['extraKit']
  expect(charges(run, hero)).toBe(uses + 1)
})

test('perk effects show as perks under their names', () => {
  expect(srcOf('heave')).toEqual({ kind: 'perk', id: 'heave' })
  expect(sourceName(srcOf('crashLanding'))).toBe(PERKS.crashLanding.name)
})

test('Crash Landing hurts each alien beside where a jump lands, not a walk', () => {
  const { battle, hero, aliens } = arena(['crashLanding'], [{ x: 13, y: 10 }, { x: 12, y: 11 }])
  const events: GameEvent[] = []
  walk(battle, hero, [{ x: 11, y: 10 }], events)
  expect(aliens.every((a) => a.hp === 40)).toBe(true)
  walk(battle, hero, [{ x: 13, y: 11 }], events)
  expect(aliens.map((a) => a.hp)).toEqual([40 - PERK.landing, 40 - PERK.landing])
  expect(events).toContainEqual(expect.objectContaining({ type: 'effect', effect: 'crashLanding' }))
})

test("Freerunner climbs at a tile per tile; Fireman's Carry carries at full move", () => {
  const { battle, hero } = arena([], [{ x: 15, y: 15 }])
  battle.height[10 * GRID + 11] = 1
  reshaped(battle)
  const climb = [{ x: 11, y: 10 }]
  expect(costOf(battle, hero, climb)).toBeGreaterThan(1)
  hero.effects.push('freerunner')
  expect(costOf(battle, hero, climb)).toBe(1)
  hero.stats.move = 4
  battle.downed.push({ soldier: 99, x: 10, y: 10, carrier: hero.id })
  expect(moveOf(battle, hero)).toBe(2)
  hero.effects.push('firemansCarry')
  expect(moveOf(battle, hero)).toBe(4)
})

test('First Strike adds to the first hit; Finisher to a hit on a target at half HP', () => {
  const { battle, hero, aliens } = arena(['firstStrike', 'finisher'], [{ x: 13, y: 10 }])
  hero.hits = 1
  expect(talentDamage(battle, hero, aliens[0], [], [])).toBe(PERK.firstStrike)
  hero.hits = 2
  aliens[0].hp = 10
  expect(talentDamage(battle, hero, aliens[0], [], [])).toBe(PERK.finisher)
})

test('Scavenger heals on a kill; Second Breath heals once, when hurt', () => {
  const { battle, hero, aliens } = arena(['scavenger', 'secondBreath'], [{ x: 13, y: 10 }])
  hero.hp = 2
  talentKill(battle, { ...aliens[0], hp: 0 }, hero, [])
  expect(hero.hp).toBe(2 + PERK.scavenge)
  talentTurn(battle, hero, [])
  expect(hero.hp).toBe(2 + PERK.scavenge + PERK.breath)
  hero.hp = 2
  talentTurn(battle, hero, [])
  expect(hero.hp).toBe(2)
})
