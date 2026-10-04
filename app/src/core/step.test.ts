import { expect, test } from 'vitest'
import { apply } from './apply'
import { createState, GRID, MOVE, SQUAD, type State } from './state'
import { step } from './step'

function battle(seed: number): State {
  const state = createState(seed)
  for (let x = 0; x < SQUAD; x++) apply(state, { type: 'deploy', x, y: GRID - 1 })
  apply(state, { type: 'start' })
  return state
}

test('the first beat moves every human at most MOVE tiles and no alien', () => {
  const state = battle(1)
  const humans = state.units.filter((u) => u.side === 'human').map((u) => u.id)
  const events = step(state)
  expect(events.map((e) => e.type)).toEqual(humans.map(() => 'move'))
  for (const e of events) {
    if (e.type !== 'move') continue
    expect(humans).toContain(e.id)
    expect(e.path.length).toBeLessThanOrEqual(MOVE)
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
