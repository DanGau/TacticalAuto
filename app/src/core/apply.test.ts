import { expect, test } from 'vitest'
import { apply } from './apply'
import { createState, GRID, SQUAD, type State } from './state'

/** A battle with no cover, so every zone tile is free. */
function open(): State {
  const state = createState(1)
  state.cover.fill(0)
  return state
}

const y = GRID - 1

test('deploy places a human in the zone', () => {
  const state = open()
  expect(apply(state, { type: 'deploy', x: 0, y })).toEqual({ ok: true })
  expect(state.units.at(-1)).toMatchObject({ side: 'human', x: 0, y })
})

test.each([
  ['outside the deployment zone', { x: 0, y: 0 }],
  ['off the grid', { x: GRID, y }],
  ['off the grid', { x: 0.5, y }],
])('deploy rejects: %s', (reason, at) => {
  const state = open()
  const before = structuredClone(state)
  expect(apply(state, { type: 'deploy', ...at })).toEqual({ ok: false, reason })
  expect(state).toEqual(before)
})

test('deploy rejects a blocked tile and a full squad', () => {
  const state = open()
  apply(state, { type: 'deploy', x: 0, y })
  expect(apply(state, { type: 'deploy', x: 0, y })).toEqual({ ok: false, reason: 'tile blocked' })
  state.cover[y * GRID + 1] = 1
  expect(apply(state, { type: 'deploy', x: 1, y })).toEqual({ ok: false, reason: 'tile blocked' })
  state.cover[y * GRID + 1] = 0
  for (let x = 1; x < SQUAD; x++) apply(state, { type: 'deploy', x, y })
  expect(apply(state, { type: 'deploy', x: SQUAD, y })).toEqual({ ok: false, reason: 'squad is full' })
})

test('start needs a deployed unit and happens once', () => {
  const state = open()
  expect(apply(state, { type: 'start' }).ok).toBe(false)
  apply(state, { type: 'deploy', x: 0, y })
  expect(apply(state, { type: 'start' })).toEqual({ ok: true })
  expect(apply(state, { type: 'start' }).ok).toBe(false)
})
