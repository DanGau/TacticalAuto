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
  run.hero.skills = [powerOf(run.hero.cls!)]
  apply(run, { type: 'go', index: 1 })
  current(run)!.stop!.goal = 'cross'
  apply(run, { type: 'advance' })
  return run as Run & { battle: Battle }
}

test('entering puts the hero on an open tile and begins the battle', () => {
  const run = entering()
  expect(enterAt(run)).toEqual({ ok: true })
  const heroes = run.battle.units.filter(isSoldier)
  expect(heroes.map((u) => u.soldier)).toEqual([run.hero.id])
  expect(bulkAt(run.battle, heroes[0].x, heroes[0].y)).toBe(0)
  expect(run.battle).toMatchObject({ phase: 'battle', reserve: [] })
})

test('actions outside their phase are rejected and change nothing', () => {
  const run = begun(1)
  run.hero.skills = [powerOf(run.hero.cls!)]
  const before = structuredClone(run)
  expect(apply(run, { type: 'hero', index: 0 }).ok).toBe(false)
  expect(apply(run, { type: 'skill', index: 0 }).ok).toBe(false)
  expect(apply(run, { type: 'equip', find: 0 }).ok).toBe(false)
  expect(apply(run, { type: 'enter', card: run.hand.length > 0 ? 0 : null, fuse: false }).ok).toBe(false)
  expect(apply(run, { type: 'go', index: 9 }).ok).toBe(false)
  expect(apply(run, { type: 'advance' }).ok).toBe(false)
  expect(run).toEqual(before)
  apply(run, { type: 'go', index: 1 })
  current(run)!.stop!.goal = 'rescue'
  apply(run, { type: 'advance' })
  expect(apply(run, { type: 'advance' }).ok).toBe(false)
  expect(apply(run, { type: 'gear', index: 0 }).ok).toBe(false)
  apply(run, { type: 'enter', card: run.hand.length > 0 ? 0 : null, fuse: false })
  expect(apply(run, { type: 'enter', card: run.hand.length > 0 ? 0 : null, fuse: false }).ok).toBe(false)
})

