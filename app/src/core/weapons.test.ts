import { expect, test } from 'vitest'
import { beat, field } from './roads'
import { STRIKES } from './cards'
import { gearCard } from '../ui/html'
import { WEAPONS, type WeaponId } from './weapons'

test('every weapon has its own Strike', () => {
  expect(Object.keys(STRIKES).sort()).toEqual(Object.keys(WEAPONS).sort())
  expect(new Set(Object.values(STRIKES)).size).toBe(Object.keys(WEAPONS).length)
})

test("a weapon card's face says its type; its numbers are the type's tip", () => {
  for (const [id, w] of Object.entries(WEAPONS)) {
    const gear = { id: 1, rarity: 'common' as const, name: `Heavy ${w.name}`, weapon: id as WeaponId, stats: { damage: 1, move: -1 }, effect: null }
    const card = gearCard(gear)
    // The keywords' definitions, shown on hover, are not its face.
    const face = card.replace(/<span class="def[^"]*">.*?<\/span>/g, '').replace(/<[^>]*>/g, '')
    expect(face).toContain(w.name)
    expect(face).not.toMatch(/×|%|[+-]\d|(range|move|crit|armor|strength)/i)
    expect(card.match(/data-tip="([^"]*)"/)![1]).toContain('Heavy: +1 damage, -1 move')
  }
})

test('a melee hero walks to the alien in reach, though a cluster still waiting stands near it', () => {
  const { b, hero, aliens } = field('hammer', [[14, 10], [18, 10]])
  Object.assign(aliens[0], { engaged: true, revealed: true })
  Object.assign(aliens[1], { engaged: false, revealed: true })
  Object.assign(hero, { engaged: true, stats: { ...hero.stats, move: 6 } })
  Object.assign(b, { turn: 'human', stage: 'move', shooter: 0, attacks: 0, strides: {}, round: 0 })
  beat(b)
  expect(Math.max(Math.abs(hero.x - aliens[0].x), Math.abs(hero.y - aliens[0].y))).toBeLessThanOrEqual(1)
})
