import { expect, test } from 'vitest'
import { bots } from '../bots/bots'
import { apply } from '../core/apply'
import { createRun } from '../core/run'
import { flow, timedFlow } from '../core/step'
import { MAX_BATTLE_SECONDS, report } from './report'
import { replay, runWith, type RunResult } from './run'

test.each(Object.keys(bots))('%s bot: a run replays identically from its seed and actions', { timeout: 60_000 }, (name) => {
  for (let seed = 0; seed < 1; seed++) {
    const result = runWith(seed, bots[name])
    const first = replay(seed, result.actions)
    expect(first.phase).toBe(result.won ? 'won' : 'lost')
    expect(first.keys).toBe(result.keys)
    expect(replay(seed, result.actions)).toEqual(first)
  }
})

/** A run of seed `seed` played by the standard bot up to its first battle's first beat. */
function inBattle(seed: number) {
  const run = createRun(seed)
  const rng = { rng: seed }
  while (run.phase !== 'battle' || run.battle!.phase !== 'battle') apply(run, bots.standard(run, rng))
  return run
}

test('a beat of only moves flows on into the other side’s, so both sides walk as one', () => {
  const run = inBattle(1)
  let merged = false
  for (let i = 0; i < 200 && run.phase === 'battle' && !merged; i++) {
    const side = run.battle!.turn
    const events = flow(run)
    merged = events.every((e) => e.type === 'move' || e.type === 'order') && run.battle!.turn === side && run.battle!.stage === 'move'
  }
  expect(merged).toBe(true)
})

test('a whole battle plays in the view in well under a minute', () => {
  const run = inBattle(0)
  let clock = { next: 0, done: 0 }
  while (run.phase === 'battle') clock = timedFlow(run, clock).clock
  expect(clock.done).toBeGreaterThan(0)
  expect(clock.done).toBeLessThan(60000)
})

test('the report warns of battles that play too long, without failing the batch', () => {
  const result: RunResult = { seed: 7, won: true, keys: 3, endedOn: 'final', battles: 2, draws: 0, durations: [20_000, (MAX_BATTLE_SECONDS + 5) * 1000], actions: [] }
  const r = report([result])
  expect(r.seconds.max).toBe(MAX_BATTLE_SECONDS + 5)
  expect(r.warnings).toEqual([`1 of 2 battles play longer than ${MAX_BATTLE_SECONDS}s, in seeds 7`])
  expect(r.failures).toEqual([])
})
