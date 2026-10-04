import { expect, test } from 'vitest'
import { bots } from '../bots/bots'
import { replay, runBattle } from './battle'

test.each(Object.keys(bots))('%s bot: a battle replays identically from its seed and actions', (name) => {
  for (let seed = 0; seed < 20; seed++) {
    const result = runBattle(seed, bots[name])
    const first = replay(seed, result.actions)
    expect(first.phase).toBe('over')
    expect(first.winner).toBe(result.winner)
    expect(replay(seed, result.actions)).toEqual(first)
  }
})
