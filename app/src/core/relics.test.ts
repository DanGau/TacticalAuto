import { expect, test } from 'vitest'
import { apply } from './apply'
import { CHARGE_REACH } from './entrances'
import { distance } from './grid'
import { current } from './run'
import { type Run } from './run-state'
import { offerable, REQUIRES, type RelicId } from './relics'
import { begun, enterAt } from './roads'

/** A run entering an exterminate battle with `relics`. */
function landed(relics: RelicId[]): Run {
  const run = begun(1)
  run.relics = relics
  apply(run, { type: 'go', index: 1 })
  current(run)!.stop!.goal = 'exterminate'
  apply(run, { type: 'advance' })
  const { entrances, units } = run.battle!
  const contact = (i: number) => Math.min(...units.filter((u) => u.side === 'alien').map((u) => distance(u, entrances[i].at)))
  enterAt(run, entrances.reduce((best, _, i) => (contact(i) < contact(best) ? i : best), 0))
  return run
}

test('entrance relics strip, chill and wall in where the squad comes in, and bring a turret', () => {
  const plain = landed([]).battle!
  const battle = landed(['shredder', 'cryo', 'bulwark', 'turrets']).battle!
  const near = battle.units.filter((u) => u.side === 'alien' && distance(u, battle.entered!.at) <= CHARGE_REACH)
  expect(near.length).toBeGreaterThan(0)
  for (const alien of near) expect(alien).toMatchObject({ armor: 0, chilled: 2 })
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
