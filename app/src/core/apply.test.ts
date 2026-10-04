import { expect, test } from 'vitest'
import { apply } from './apply'
import { createState, GRID, SQUAD } from './state'

const y = GRID - 1

test('deploy places a human in the zone', () => {
  const state = createState(1)
  expect(apply(state, { type: 'deploy', x: 0, y })).toEqual({ ok: true })
  expect(state.units.at(-1)).toMatchObject({ side: 'human', x: 0, y })
})

test.each([
  ['outside the deployment zone', { x: 0, y: 0 }],
  ['off the grid', { x: GRID, y }],
  ['off the grid', { x: 0.5, y }],
])('deploy rejects: %s', (reason, at) => {
  const state = createState(1)
  const before = structuredClone(state)
  expect(apply(state, { type: 'deploy', ...at })).toEqual({ ok: false, reason })
  expect(state).toEqual(before)
})

test('deploy rejects an occupied tile and a full squad', () => {
  const state = createState(1)
  apply(state, { type: 'deploy', x: 0, y })
  expect(apply(state, { type: 'deploy', x: 0, y })).toEqual({ ok: false, reason: 'tile occupied' })
  for (let x = 1; x < SQUAD; x++) apply(state, { type: 'deploy', x, y })
  expect(apply(state, { type: 'deploy', x: SQUAD, y })).toEqual({ ok: false, reason: 'squad is full' })
})

test('start needs a deployed unit and happens once', () => {
  const state = createState(1)
  expect(apply(state, { type: 'start' }).ok).toBe(false)
  apply(state, { type: 'deploy', x: 0, y })
  expect(apply(state, { type: 'start' })).toEqual({ ok: true })
  expect(apply(state, { type: 'start' }).ok).toBe(false)
})
