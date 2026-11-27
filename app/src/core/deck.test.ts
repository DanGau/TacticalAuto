import { expect, test } from 'vitest'
import { amount, CARD_IDS, CARDS, SIGNATURES, STARTERS, STRIKES } from './cards'
import { CLASSES, type ClassId } from './classes'
import { drawCards, offerable, starterDeck } from './deck'
import { begun } from './roads'
import { WEAPONS, type WeaponId } from './weapons'

const WEAPON_IDS = Object.keys(WEAPONS) as WeaponId[]
const GUNS = WEAPON_IDS.filter((w) => !WEAPONS[w].melee)

test('each weapon\'s starter deck: its Strike first, guns with no Block, plus the class\'s signature card', () => {
  for (const weapon of WEAPON_IDS) {
    const ids = starterDeck('sniper', weapon).map((c) => c.id)
    expect(ids[0], weapon).toBe(STRIKES[weapon])
    expect(ids, weapon).toContain(SIGNATURES.sniper)
    expect(ids.length, weapon).toBe(10)
    if (GUNS.includes(weapon)) expect(ids.filter((id) => CARDS[id].block), weapon).toEqual([])
  }
  expect(starterDeck('assault', 'rifle').map((c) => c.id)).toContain('fallBack')
  expect(starterDeck('assault', 'hammer').map((c) => c.id)).toContain('defend')
})

test('a sniper\'s Strike is one hit, costlier and heavier than other guns\'', () => {
  const s = CARDS[STRIKES.sniper]
  expect(s.hits).toBeUndefined()
  for (const gun of GUNS.filter((g) => g !== 'sniper')) expect(amount(STRIKES[gun], 1, 'damage')).toBeLessThan(amount(STRIKES.sniper, 1, 'damage'))
  expect(s.cost).toBe(2)
})

test('offers draw from the weapon\'s pool, the class\'s pool and cards of neither', () => {
  for (const weapon of WEAPON_IDS)
    for (const cls of Object.keys(CLASSES) as ClassId[]) {
      const run = begun(3)
      run.hero.cls = cls
      run.hero.gear!.weapon = weapon
      const pool = CARD_IDS.filter((id) => offerable(run, id))
      expect(pool.filter((id) => CARDS[id].weapons?.includes(weapon)).length, weapon).toBeGreaterThanOrEqual(4)
      for (const id of pool) {
        const k = CARDS[id]
        expect(!k.cls && !k.weapons || k.cls === cls || k.weapons?.includes(weapon), id).toBe(true)
      }
      for (const id of Array.from({ length: 30 }, () => drawCards(run, 3, false)).flat()) expect(pool).toContain(id)
    }
})

test('every weapon has a starter deck', () => {
  expect(Object.keys(STARTERS).sort()).toEqual([...WEAPON_IDS].sort())
})
