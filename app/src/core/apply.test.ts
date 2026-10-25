import { expect, test } from 'vitest'
import { TUNING } from './tuning'
import { apply } from './apply'
import { isSoldier, coverAt, distance, ZONE_CLEARANCE, ZONES, type Battle } from './battle'
import { stepBattle } from './combat'
import { createRun, type Run } from './run'

/** A run choosing where to land for its first battle. */
function landing(): Run & { battle: Battle } {
  const run = createRun(1)
  apply(run, { type: 'skill', soldier: run.soldiers[0].id, index: 0 })
  apply(run, { type: 'zone', index: 1 })
  run.zone!.stops.sort((a, b) => Number(b.kind === 'battle') - Number(a.kind === 'battle'))
  apply(run, { type: 'advance' })
  return run as Run & { battle: Battle }
}

test('a battle offers landing zones clear of every alien, but for a hot drop onto a pod', () => {
  const { battle } = landing()
  expect(battle.zones).toHaveLength(ZONES)
  battle.zones.forEach((zone, i) => {
    const near = Math.min(...battle.units.map((alien) => distance(zone, alien)))
    if (i === battle.hot) expect(near).toBeLessThanOrEqual(2)
    else expect(near).toBeGreaterThanOrEqual(ZONE_CLEARANCE)
  })
})

test('a hot drop breaches: the pod beneath is ambushed and cannot shoot, its members take the impact, and the other pods converge', () => {
  const run = landing()
  const battle = run.battle
  const hot = battle.hot!
  const zone = battle.zones[hot]
  apply(run, { type: 'land', zone: hot })
  const under = battle.units.find((u) => u.side === 'alien' && distance(u, zone) <= 2)!
  expect(battle.pods[under.pod!]).toMatchObject({ revealed: true, ambushed: true, surprised: true })
  expect(battle.concealed).toBe(false)
  battle.pods.forEach((pod, i) => i !== under.pod && expect(pod.waypoint).toEqual(zone))
  const events = stepBattle(battle)
  expect(events).toContainEqual({ type: 'hurt', id: under.id, amount: TUNING.impactDamage, cause: 'impact' })
})

test('landing puts the whole squad on open tiles by the zone and begins the battle', () => {
  const run = landing()
  const cold = run.battle.hot === 1 ? 0 : 1
  const zone = run.battle.zones[cold]
  expect(apply(run, { type: 'land', zone: cold })).toEqual({ ok: true })
  const squad = run.battle.units.filter(isSoldier)
  expect(squad.map((u) => u.soldier)).toEqual(run.soldiers.map((s) => s.id))
  expect(squad).toHaveLength(run.soldiers.length)
  for (const unit of squad) {
    expect(distance(unit, zone)).toBeLessThanOrEqual(3)
    expect(coverAt(run.battle, unit.x, unit.y)).toBe(0)
  }
  expect(new Set(squad.map((u) => `${u.x},${u.y}`)).size).toBe(run.soldiers.length)
  expect(run.battle).toMatchObject({ phase: 'battle', reserve: [] })
})

test('actions outside their phase are rejected and change nothing', () => {
  const run = createRun(1)
  expect(apply(run, { type: 'zone', index: 1 })).toEqual({ ok: false, reason: 'not in the overworld' })
  apply(run, { type: 'skill', soldier: run.soldiers[0].id, index: 0 })
  const before = structuredClone(run)
  expect(apply(run, { type: 'skill', soldier: run.soldiers[0].id, index: 0 }).ok).toBe(false)
  expect(apply(run, { type: 'keep' }).ok).toBe(false)
  expect(apply(run, { type: 'land', zone: 0 }).ok).toBe(false)
  expect(apply(run, { type: 'zone', index: 9 }).ok).toBe(false)
  expect(apply(run, { type: 'advance' }).ok).toBe(false)
  expect(run).toEqual(before)
  apply(run, { type: 'zone', index: 1 })
  run.zone!.stops.sort((a, b) => Number(b.kind === 'battle') - Number(a.kind === 'battle'))
  apply(run, { type: 'advance' })
  expect(apply(run, { type: 'advance' }).ok).toBe(false)
  expect(apply(run, { type: 'build', facility: 'workshop' }).ok).toBe(false)
  expect(apply(run, { type: 'land', zone: 9 }).ok).toBe(false)
  apply(run, { type: 'land', zone: 0 })
  expect(apply(run, { type: 'land', zone: 0 }).ok).toBe(false)
})
