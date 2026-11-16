import { expect, test } from 'vitest'
import { CHALLENGES, type ChallengeId } from './challenges'
import { GOALS, type Goal } from './goals'
import { objective, THREATS } from './objectives'

const words = (s: string) => s.split(/\s+/).length

test('every order is at most four words, every threat at most eight', () => {
  for (const goal of Object.keys(GOALS) as Goal[])
    for (const kind of ['battle', 'key', 'final'] as const) {
      const order = objective(kind, goal)
      expect(order).toBeTruthy()
      expect(words(order)).toBeLessThanOrEqual(4)
    }
  for (const id of Object.keys(CHALLENGES) as ChallengeId[]) expect(words(THREATS[id])).toBeLessThanOrEqual(8)
})
