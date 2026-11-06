import { expect, test } from 'vitest'
import { bots } from '../bots/bots'
import { apply } from './apply'
import { createRun } from './run'
import { step } from './step'
import { sourceName } from './source-names'

test('every acting event of a batch of runs names its source', () => {
  const unnamed = new Set<string>()
  let named = 0
  for (let seed = 0; seed < 6; seed++) {
    const run = createRun(seed)
    const rng = { rng: seed }
    for (let i = 0; i < 4000 && run.phase !== 'won' && run.phase !== 'lost'; i++) {
      if (run.phase === 'battle' && run.battle?.phase === 'battle') {
        for (const e of step(run)) {
          if (!('src' in e)) continue
          let name = ''
          try {
            name = sourceName(e.src)
          } catch {
            name = ''
          }
          if (name) named++
          else unnamed.add(`${e.type} ${e.src.kind}:${e.src.id}`)
        }
      } else apply(run, bots.strategic(run, rng))
    }
  }
  expect([...unnamed]).toEqual([])
  expect(named).toBeGreaterThan(100)
}, 120_000)
