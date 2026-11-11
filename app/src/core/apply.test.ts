import { powerOf } from './skills'
import { expect, test } from 'vitest'
import { enterAt, begun } from './roads'
import { apply } from './apply'
import { isSoldier, type Battle } from './battle'
import { bulkAt } from './grid'
import { current } from './run'
import { type Run } from './run-state'

/** A run about to make its landing for its first battle. */
function entering(seed = 1): Run & { battle: Battle } {
  const run = begun(seed)
  run.soldiers[0].skills = [powerOf(run.soldiers[0].cls!)]
  apply(run, { type: 'go', index: 1 })
  current(run)!.stop!.goal = 'exterminate'
  apply(run, { type: 'advance' })
  return run as Run & { battle: Battle }
}

test('entering puts the whole squad on open tiles and begins the battle', () => {
  const run = entering()
  expect(enterAt(run)).toEqual({ ok: true })
  const squad = run.battle.units.filter(isSoldier)
  expect(squad.map((u) => u.soldier)).toEqual(run.soldiers.map((s) => s.id))
  for (const unit of squad) expect(bulkAt(run.battle, unit.x, unit.y)).toBe(0)
  expect(new Set(squad.map((u) => `${u.x},${u.y}`)).size).toBe(run.soldiers.length)
  expect(run.battle).toMatchObject({ phase: 'battle', reserve: [] })
})

test('actions outside their phase are rejected and change nothing', () => {
  const run = begun(1)
  run.soldiers[0].skills = [powerOf(run.soldiers[0].cls!)]
  const before = structuredClone(run)
  expect(apply(run, { type: 'recruit', index: 0 }).ok).toBe(false)
  expect(apply(run, { type: 'skill', soldier: run.soldiers[0].id, index: 0 }).ok).toBe(false)
  expect(apply(run, { type: 'equip', find: 0 }).ok).toBe(false)
  expect(apply(run, { type: 'enter' }).ok).toBe(false)
  expect(apply(run, { type: 'go', index: 9 }).ok).toBe(false)
  expect(apply(run, { type: 'advance' }).ok).toBe(false)
  expect(run).toEqual(before)
  apply(run, { type: 'go', index: 1 })
  current(run)!.stop!.goal = 'rescue'
  apply(run, { type: 'advance' })
  expect(apply(run, { type: 'advance' }).ok).toBe(false)
  expect(apply(run, { type: 'gear', index: 0 }).ok).toBe(false)
  apply(run, { type: 'enter' })
  expect(apply(run, { type: 'enter' }).ok).toBe(false)
})

