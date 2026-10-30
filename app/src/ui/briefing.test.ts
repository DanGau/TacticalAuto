import { expect, test } from 'vitest'
import { ALIENS } from '../core/aliens'
import { BASE_STATS, createBattle, type Alien } from '../core/battle'
import { GOALS, type Goal } from '../core/goals'
import { shots, STOPS } from './briefing'

const trooper = (target = false): Alien => ({ kind: 'trooper', stats: BASE_STATS, stance: ALIENS.trooper.stance, boss: false, spawns: false, target, resists: [] })

test('a briefing makes one to three stops, the last over the whole map', () => {
  for (const goal of Object.keys(GOALS) as Goal[]) {
    for (let seed = 1; seed <= 5; seed++) {
      const packs = [{ name: 'Patrol', aliens: [trooper(goal === 'assassinate'), trooper()] }, { name: 'Pack', aliens: [trooper()] }]
      const all = shots(createBattle(seed, 'town', packs, [], goal))
      expect(all.length).toBeGreaterThanOrEqual(1)
      expect(all.length).toBeLessThanOrEqual(STOPS)
      expect(all.at(-1)!.tiles).toBeNull()
    }
  }
})
