import { expect, test } from 'vitest'
import { apply } from './apply'
import { GRID } from './battle'
import { BASE_SQUAD, createRun, type Run } from './run'

const y = GRID - 1

/** A run deploying for its first mission, on a map with no cover, so every zone tile is free. */
function deploying(): Run {
  const run = createRun(1)
  apply(run, { type: 'mission', index: 0 })
  run.battle!.cover.fill(0)
  return run
}

test('deploy places the next soldier in the zone', () => {
  const run = deploying()
  expect(apply(run, { type: 'deploy', x: 0, y })).toEqual({ ok: true })
  expect(run.battle!.units.at(-1)).toMatchObject({ side: 'human', x: 0, y, soldier: run.soldiers[0].id })
})

test.each([
  ['outside the deployment zone', { x: 0, y: 0 }],
  ['off the grid', { x: GRID, y }],
  ['off the grid', { x: 0.5, y }],
])('deploy rejects: %s', (reason, at) => {
  const run = deploying()
  const before = structuredClone(run)
  expect(apply(run, { type: 'deploy', ...at })).toEqual({ ok: false, reason })
  expect(run).toEqual(before)
})

test('deploy rejects a blocked tile and a deployed squad', () => {
  const run = deploying()
  apply(run, { type: 'deploy', x: 0, y })
  expect(apply(run, { type: 'deploy', x: 0, y })).toEqual({ ok: false, reason: 'tile blocked' })
  run.battle!.cover[y * GRID + 1] = 1
  expect(apply(run, { type: 'deploy', x: 1, y })).toEqual({ ok: false, reason: 'tile blocked' })
  run.battle!.cover[y * GRID + 1] = 0
  for (let x = 1; x < BASE_SQUAD; x++) apply(run, { type: 'deploy', x, y })
  expect(apply(run, { type: 'deploy', x: BASE_SQUAD, y })).toEqual({ ok: false, reason: 'squad is deployed' })
})

test('start needs a deployed soldier and happens once', () => {
  const run = deploying()
  expect(apply(run, { type: 'start' }).ok).toBe(false)
  apply(run, { type: 'deploy', x: 0, y })
  expect(apply(run, { type: 'start' })).toEqual({ ok: true })
  expect(apply(run, { type: 'start' }).ok).toBe(false)
})

test('actions outside their phase are rejected', () => {
  const run = createRun(1)
  expect(apply(run, { type: 'pick', index: 0 }).ok).toBe(false)
  expect(apply(run, { type: 'deploy', x: 0, y }).ok).toBe(false)
  expect(apply(run, { type: 'mission', index: 9 }).ok).toBe(false)
  apply(run, { type: 'mission', index: 0 })
  expect(apply(run, { type: 'mission', index: 0 }).ok).toBe(false)
})
