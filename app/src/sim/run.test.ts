import { expect, test } from 'vitest'
import { bots } from '../bots/bots'
import { replay, runWith } from './run'

test.each(Object.keys(bots))('%s bot: a run replays identically from its seed and actions', (name) => {
  for (let seed = 0; seed < 5; seed++) {
    const result = runWith(seed, bots[name])
    const first = replay(seed, result.actions)
    expect(first.phase).toBe(result.won ? 'won' : 'lost')
    expect(first.round).toBe(result.round)
    expect(replay(seed, result.actions)).toEqual(first)
  }
})
