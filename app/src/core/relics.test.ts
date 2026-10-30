import { expect, test } from 'vitest'
import { apply } from './apply'
import { distance, isSoldier, POD_REACH } from './battle'
import { current, type Run } from './run'
import { offerable, REQUIRES, type RelicId } from './relics'
import { zoneOf, begun } from './roads'

/** A run landing for an exterminate battle with `relics`, at its hot drop so aliens are near. */
function landed(relics: RelicId[]): Run {
  const run = begun(1)
  run.relics = relics
  apply(run, { type: 'go', index: 1 })
  current(run)!.stop!.goal = 'exterminate'
  apply(run, { type: 'advance' })
  apply(run, { type: 'land', zone: zoneOf(run.battle!, 'hot') })
  return run
}

test('drop pod relics strip, chill and wall in where the squad lands, and drop a turret', () => {
  const plain = landed([]).battle!
  const battle = landed(['shredder', 'cryopods', 'bulwark', 'turrets']).battle!
  const soldier = battle.units.find(isSoldier)!
  const near = battle.units.filter((u) => u.side === 'alien' && distance(u, soldier) <= POD_REACH)
  expect(near.length).toBeGreaterThan(0)
  for (const alien of near) expect(alien).toMatchObject({ armor: 0, chilled: 2 })
  expect(battle.props.filter((p) => p === 'stack').length).toBeGreaterThan(plain.props.filter((p) => p === 'stack').length)
  expect(battle.units.filter((u) => u.side === 'human' && u.soldier === null && u.stats.move === 0)).toHaveLength(1)
  expect(battle.breach).toBe(true)
})

test('a relic that needs another is offered only once that one is held', () => {
  for (const [id, need] of Object.entries(REQUIRES)) {
    expect(offerable([])).not.toContain(id)
    expect(offerable([need])).toContain(id)
  }
})
