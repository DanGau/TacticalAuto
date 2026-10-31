import { expect, test } from 'vitest'
import { apply } from './apply'
import { isSoldier } from './battle'
import { foesInSight } from './combat'
import { AIRSTRIKE, CONSUMABLES, HEAL } from './consumables'
import { begun, deploy, road } from './roads'
import { PATHS } from './skills'
import { step } from './step'
import type { Run } from './run'

/** A run at a battle's landing, carrying `kit`. */
function landing(kit: Run['kit']): Run {
  const run = begun(3)
  run.soldiers[0].skills = [PATHS[run.soldiers[0].cls!][0].core]
  apply(run, { type: 'go', index: 0 })
  road(run, [{ kind: 'battle', risk: 'standard', goal: 'exterminate', terrain: 'town', twist: null, packs: [{ name: 'Patrol', kinds: ['trooper', 'trooper', 'trooper'] }] }])
  apply(run, { type: 'advance' })
  run.kit = kit
  return run
}

/** Brings every pod into the fight, in sight. */
const alert = (run: Run) => run.battle!.pods.forEach((pod) => Object.assign(pod, { revealed: true, alert: true }))

test('a consumable is used only in a battle, and one aimed at the aliens only once one is in the fight', () => {
  const run = landing(['airstrike', 'medkit'])
  expect(apply(run, { type: 'use', index: 0 })).toEqual({ ok: false, reason: 'cannot use that now' })
  deploy(run, 0)
  expect(apply(run, { type: 'use', index: 0 }).ok).toBe(false)
  alert(run)
  expect(apply(run, { type: 'use', index: 0 })).toEqual({ ok: true })
  expect(run.kit).toEqual(['medkit'])
})

test('a squad consumable readied on the landing takes effect at the first beat', () => {
  const run = landing(['plating'])
  expect(apply(run, { type: 'use', index: 0 })).toEqual({ ok: true })
  expect(run.battle!.primed).toEqual(['plating'])
  deploy(run, 0)
  const soldier = run.battle!.units.find(isSoldier)!
  const armor = soldier.armor
  const events = step(run)
  expect(events[0]).toMatchObject({ type: 'used', consumable: 'plating', on: [soldier.id] })
  expect(soldier.armor).toBeGreaterThan(armor)
  expect(run.battle!.primed).toEqual([])
})

test('an airstrike wounds the aliens it falls on and adds threat; a medkit heals', () => {
  const run = landing(['airstrike', 'medkit'])
  deploy(run, 0)
  alert(run)
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
  deploy(run, 0)
  const before = run.battle!.units.length
  apply(run, { type: 'use', index: 0 })
  const events = step(run)
  expect(run.battle!.units).toHaveLength(before + 1)
  expect(events).toContainEqual(expect.objectContaining({ type: 'spawn' }))
})
