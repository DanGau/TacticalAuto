import { expect, test } from 'vitest'
import { apply } from './apply'
import { coverAt, distance, ZONE_CLEARANCE, ZONES, type Battle } from './battle'
import { BASE_SQUAD, createRun, type Run } from './run'

/** A run choosing where to land for its first battle. */
function landing(): Run & { battle: Battle } {
  const run = createRun(1)
  apply(run, { type: 'zone', index: 1 })
  apply(run, { type: 'advance' })
  return run as Run & { battle: Battle }
}

test('a battle offers landing zones clear of every alien', () => {
  const { battle } = landing()
  expect(battle.zones).toHaveLength(ZONES)
  for (const zone of battle.zones) {
    for (const alien of battle.units) expect(distance(zone, alien)).toBeGreaterThanOrEqual(ZONE_CLEARANCE)
  }
})

test('landing puts the whole squad on open tiles by the zone and begins the battle', () => {
  const run = landing()
  const zone = run.battle.zones[1]
  expect(apply(run, { type: 'land', zone: 1 })).toEqual({ ok: true })
  const squad = run.battle.units.filter((u) => u.side === 'human')
  expect(squad.map((u) => u.soldier)).toEqual(run.soldiers.map((s) => s.id))
  expect(squad).toHaveLength(BASE_SQUAD)
  for (const unit of squad) {
    expect(distance(unit, zone)).toBeLessThanOrEqual(3)
    expect(coverAt(run.battle, unit.x, unit.y)).toBe(0)
  }
  expect(new Set(squad.map((u) => `${u.x},${u.y}`)).size).toBe(BASE_SQUAD)
  expect(run.battle).toMatchObject({ phase: 'battle', reserve: [] })
})

test('actions outside their phase are rejected and change nothing', () => {
  const run = createRun(1)
  const before = structuredClone(run)
  expect(apply(run, { type: 'pick', index: 0 }).ok).toBe(false)
  expect(apply(run, { type: 'land', zone: 0 }).ok).toBe(false)
  expect(apply(run, { type: 'zone', index: 9 }).ok).toBe(false)
  expect(apply(run, { type: 'advance' }).ok).toBe(false)
  expect(run).toEqual(before)
  apply(run, { type: 'zone', index: 1 })
  apply(run, { type: 'advance' })
  expect(apply(run, { type: 'advance' }).ok).toBe(false)
  expect(apply(run, { type: 'build', facility: 'workshop' }).ok).toBe(false)
  expect(apply(run, { type: 'land', zone: 9 }).ok).toBe(false)
  apply(run, { type: 'land', zone: 0 })
  expect(apply(run, { type: 'land', zone: 0 }).ok).toBe(false)
})
