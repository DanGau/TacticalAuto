import { expect, test } from 'vitest'
import { CHALLENGES, type ChallengeId } from './challenges'
import { GOALS, type Goal } from './goals'
import { objective, THREATS } from './objectives'
import { ZONE_TERRAINS, type TerrainKind } from './terrain'

const words = (s: string) => s.split(/\s+/).length
const places: TerrainKind[] = [...ZONE_TERRAINS, 'compound', 'hive']

test('every order is at most four words, every threat at most eight', () => {
  for (const goal of Object.keys(GOALS) as Goal[])
    for (const challenge of [null, ...(Object.keys(CHALLENGES) as ChallengeId[])])
      for (const place of places)
        for (const kind of ['battle', 'key', 'final'] as const) {
          const order = objective(kind, goal, challenge, place, 'Nova')
          expect(order).toBeTruthy()
          expect(words(order)).toBeLessThanOrEqual(4)
        }
  for (const id of Object.keys(CHALLENGES) as ChallengeId[]) expect(words(THREATS[id])).toBeLessThanOrEqual(8)
})
