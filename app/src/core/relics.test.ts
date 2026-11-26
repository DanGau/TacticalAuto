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
import { begun, enterAt } from './roads'

/** A run entering a crossing with `relics`. */
function landed(relics: RelicId[]): Run {
  const run = begun(1)
  run.relics = relics
  apply(run, { type: 'go', index: 1 })
  current(run)!.stop!.goal = 'cross'
  apply(run, { type: 'advance' })
  const { entry, units } = run.battle!
  // Some alien stands within the charges' reach.
  const [tile] = freeTilesNear(run.battle!, entry!, 20).slice(-1)
  Object.assign(units.find((u) => u.side === 'alien')!, tile)
  enterAt(run)
  return run
}

test('landing relics strip, chill and wall in where the hero comes in', () => {
  const plain = landed([]).battle!
  const battle = landed(['shredder', 'cryo', 'bulwark']).battle!
  const near = battle.units.filter((u) => u.side === 'alien' && distance(u, battle.entry!) <= CHARGE_REACH)
  expect(near.length).toBeGreaterThan(0)
  for (const alien of near) expect(alien).toMatchObject({ armor: 0, chill: 1 })
  expect(battle.props.filter((p) => p === 'stack').length).toBeGreaterThan(plain.props.filter((p) => p === 'stack').length)
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
    expect(new Set(run.passed)).toEqual(passed)
  }
})

test('the candidates a run starts from are of different classes, from different continents', () => {
  const run = createRun(4)
  expect(new Set(run.candidates.map((c) => c.cls)).size).toBe(run.candidates.length)
  expect(new Set(run.candidates.map((c) => c.home.country)).size).toBe(run.candidates.length)
})
