import { expect, test } from 'vitest'
import { apply } from './apply'
import { BASE_STATS, GRID, type Battle } from './battle'
import { stepBattle as step } from './combat'
import { createRun } from './run'

function battle(seed: number): Battle {
  const run = createRun(seed)
  apply(run, { type: 'mission', index: 0 })
  // Cover blocks some tiles; a rejected deploy is skipped.
  for (let x = 0; x < GRID; x++) apply(run, { type: 'deploy', x, y: GRID - 1 })
  apply(run, { type: 'start' })
  return run.battle!
}

test('the first beat moves every human at most its move and no alien', () => {
  const state = battle(1)
  const humans = state.units.filter((u) => u.side === 'human').map((u) => u.id)
  const events = step(state)
  expect(events.map((e) => e.type)).toEqual(humans.map(() => 'move'))
  for (const e of events) {
    if (e.type !== 'move') continue
    expect(humans).toContain(e.id)
    expect(e.path.length).toBeLessThanOrEqual(BASE_STATS.move)
  }
})

test('a turn is one move beat, then one shot per beat in id order, then the other side', () => {
  const state = battle(1)
  let turn = state.turn
  let stage = 'move'
  let shooter = 0
  while (state.phase === 'battle') {
    const before = structuredClone(state.units)
    const [first] = step(state)
    if (!first || first.type === 'end') continue
    const side = before.find((u) => u.id === first.id)!.side
    if (side !== turn) {
      turn = side
      stage = 'move'
      shooter = 0
    }
    if (first.type === 'move') {
      expect(stage).toBe('move')
      stage = 'shoot'
    } else {
      stage = 'shoot'
      expect(first.id).toBeGreaterThan(shooter)
      shooter = first.id
    }
  }
  expect(state.winner).not.toBeNull()
})
