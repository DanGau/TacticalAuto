import { freeTilesNear } from './grid'
import { expect, test } from 'vitest'
import { apply } from './apply'
import { CHARGE_REACH } from './landing'
import { distance } from './grid'
import { createRun, current } from './run'
import { type Run } from './run-state'
import { offerable, RELIC_OFFERS, REQUIRES, type RelicId } from './relics'
import { offerRelics } from './debrief'
import { takeRelic } from './rewards'
import { draft } from './squad'
import { begun, enterAt } from './roads'

/** A run entering an exterminate battle with `relics`. */
function landed(relics: RelicId[]): Run {
  const run = begun(1)
  run.relics = relics
  apply(run, { type: 'go', index: 1 })
  current(run)!.stop!.goal = 'exterminate'
  apply(run, { type: 'advance' })
  const { entry, units } = run.battle!
  // Some alien stands within the charges' reach.
  const [tile] = freeTilesNear(run.battle!, entry!, 20).slice(-1)
  Object.assign(units.find((u) => u.side === 'alien')!, tile)
  enterAt(run)
  return run
}

test('landing relics strip, chill and wall in where the squad comes in, and bring a turret', () => {
  const plain = landed([]).battle!
  const battle = landed(['shredder', 'cryo', 'bulwark', 'turrets']).battle!
  const near = battle.units.filter((u) => u.side === 'alien' && distance(u, battle.entry!) <= CHARGE_REACH)
  expect(near.length).toBeGreaterThan(0)
  for (const alien of near) expect(alien).toMatchObject({ armor: 0, chill: 1 })
  expect(battle.props.filter((p) => p === 'stack').length).toBeGreaterThan(plain.props.filter((p) => p === 'stack').length)
  expect(battle.units.filter((u) => u.side === 'human' && u.soldier === null && u.stats.move === 0)).toHaveLength(1)
  expect(battle.opening).toBe(true)
})

test('a relic that needs another is offered only once that one is held', () => {
  for (const [id, need] of Object.entries(REQUIRES)) {
    expect(offerable([])).not.toContain(id)
    expect(offerable([need])).toContain(id)
  }
})

test('relics turned down are not offered again until every other is spent', () => {
  const run = begun(1)
  const passed = new Set<RelicId>()
  for (let round = 0; round < 6; round++) {
    run.relicOffers = []
    offerRelics(run)
    const fresh = offerable(run.relics).filter((id) => !passed.has(id))
    if (fresh.length >= RELIC_OFFERS) expect(run.relicOffers.filter((id) => passed.has(id))).toEqual([])
    run.relicOffers.slice(1).forEach((id) => passed.add(id))
    takeRelic(run, run.relicOffers[0])
    expect(new Set(run.passed.relics)).toEqual(passed)
  }
})

test('recruit classes turned down are not drafted again while others are left', () => {
  const run = createRun(4)
  const declined = run.recruits.slice(1).map((r) => r.cls!)
  apply(run, { type: 'recruit', index: 0 })
  expect(run.passed.classes).toEqual(declined)
  for (let i = 0; i < 10; i++) expect(declined).not.toContain(draft(run, []).cls)
})
