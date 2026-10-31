import { expect, test } from 'vitest'
import { apply } from './apply'
import { isSoldier } from './battle'
import { foesInSight } from './combat'
import { AIRSTRIKE, CONSUMABLES, HEAL } from './consumables'
import { begun, enterAt, road } from './roads'
import { roots } from './skills'
import { step } from './step'
import type { Run } from './run-state'

/** A run at a battle's landing, carrying `kit`. */
function landing(kit: Run['kit']): Run {
  const run = begun(3)
  run.soldiers[0].skills = [roots(run.soldiers[0].cls!)[0]]
  apply(run, { type: 'go', index: 0 })
  road(run, [{ kind: 'battle', risk: 'standard', goal: 'exterminate', terrain: 'town', twist: null, aliens: ['trooper', 'trooper', 'trooper'] }])
  apply(run, { type: 'advance' })
  run.kit = kit
  return run
}

/** Brings every alien into the fight, in sight. */
const engage = (run: Run) => run.battle!.units.forEach((u) => Object.assign(u, { revealed: true, engaged: true }))

test('a consumable is used only in a battle, and one aimed at the aliens only once one is in the fight', () => {
  const run = landing(['airstrike', 'medkit'])
  expect(apply(run, { type: 'use', index: 0 })).toEqual({ ok: false, reason: 'cannot use that now' })
  enterAt(run, 0)
  for (const u of run.battle!.units) if (u.side === 'alien') u.engaged = false
  expect(apply(run, { type: 'use', index: 0 }).ok).toBe(false)
  engage(run)
  expect(apply(run, { type: 'use', index: 0 })).toEqual({ ok: true })
  expect(run.kit).toEqual(['medkit'])
})

test('a squad consumable readied on the landing takes effect at the first beat', () => {
  const run = landing(['plating'])
  expect(apply(run, { type: 'use', index: 0 })).toEqual({ ok: true })
  expect(run.battle!.primed).toEqual(['plating'])
  enterAt(run, 0)
  const soldier = run.battle!.units.find(isSoldier)!
  const armor = soldier.armor
  const events = step(run)
  expect(events[0]).toMatchObject({ type: 'used', consumable: 'plating', on: [soldier.id] })
  expect(soldier.armor).toBeGreaterThan(armor)
  expect(run.battle!.primed).toEqual([])
})

test('an airstrike wounds the aliens it falls on and adds threat; a medkit heals', () => {
  const run = landing(['airstrike', 'medkit'])
  enterAt(run, 0)
  engage(run)
  const soldier = run.battle!.units.find(isSoldier)!
  soldier.hp = 1
  const struck = foesInSight(run.battle!).map((u) => ({ u, hp: u.hp + u.armor }))
  const threat = run.threat
  apply(run, { type: 'use', index: 0 })
  apply(run, { type: 'use', index: 0 })
  expect(run.threat).toBe(threat + CONSUMABLES.airstrike.threat!)
  step(run)
  expect(struck.some(({ u, hp }) => u.hp + u.armor <= hp - AIRSTRIKE.damage)).toBe(true)
  expect(soldier.hp).toBe(1 + HEAL)
})

test('a sentry drop lands a turret for the squad', () => {
  const run = landing(['sentry'])
  enterAt(run, 0)
  const before = run.battle!.units.length
  apply(run, { type: 'use', index: 0 })
  const events = step(run)
  expect(run.battle!.units).toHaveLength(before + 1)
  expect(events).toContainEqual(expect.objectContaining({ type: 'spawn' }))
})
