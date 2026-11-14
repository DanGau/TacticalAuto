import { beforeAll, expect, test } from 'vitest'
import { powerOf } from './skills'
import { apply } from './apply'
import { enterAt, begun } from './roads'
import { isSoldier, type Battle, type Unit } from './battle'
import { reshaped } from './grid'
import { ALIENS, alienStats, type AlienKind } from './aliens'
import { alienUnit } from './spawn'
import { shoot } from './attack'
import { spotted } from './fighters'
import { harm, threat } from './threat'
import { TUNING } from './tuning'

// These choices are staged on aliens of a set toughness, whatever the balance numbers are.
beforeAll(() => void Object.assign(TUNING, { alienHp: 0.4 }))

function arena(aliens: { kind: AlienKind; x: number; y: number }[]): { battle: Battle; hero: Unit; aliens: Unit[] } {
  const run = begun(1)
  run.soldiers[0].skills = [powerOf(run.soldiers[0].cls!)]
  apply(run, { type: 'go', index: 1 })
  apply(run, { type: 'advance' })
  enterAt(run)
  const battle = run.battle!
  Object.assign(battle, { goal: 'exterminate', uplink: null, waves: [] })
  for (const layer of [battle.bulk, battle.height]) layer.fill(0)
  battle.ground.fill('pavement')
  battle.props.fill('none')
  battle.north.fill('none')
  battle.west.fill('none')
  reshaped(battle)
  const hero = battle.units.find(isSoldier)!
  Object.assign(hero, { x: 10, y: 10, ability: null, weapon: undefined, effects: [], hp: 30, stats: { ...hero.stats, hp: 30, crit: 0, damage: 3, range: 8 } })
  const units = aliens.map(({ kind, x, y }) => alienUnit(battle, { kind, stats: alienStats(kind, 0, 0), stance: ALIENS[kind].stance, boss: false, spawns: false, target: false, resists: ALIENS[kind].resists }, { x, y }, true))
  battle.units = [hero, ...units]
  return { battle, hero, aliens: units }
}

const shotAt = (battle: Battle, hero: Unit) => shoot(battle, hero, spotted(battle)).find((e) => e.type === 'shot')

test('a hero shoots the psion behind a brute', () => {
  const { battle, hero, aliens } = arena([{ kind: 'brute', x: 10, y: 12 }, { kind: 'psion', x: 10, y: 16 }])
  expect(shotAt(battle, hero)).toMatchObject({ target: aliens[1].id })
})

test('a melee alien that can reach no hero next turn counts half its harm', () => {
  const { battle, aliens } = arena([{ kind: 'brute', x: 10, y: 11 }, { kind: 'brute', x: 10, y: 29 }])
  expect(harm(battle, aliens[1])).toBe(harm(battle, aliens[0]) / 2)
})

test('a hit that kills is worth more than its share of the harm', () => {
  const { battle, aliens } = arena([{ kind: 'trooper', x: 10, y: 14 }])
  const alien = aliens[0]
  expect(threat(battle, alien, alien.hp)).toBeGreaterThan(threat(battle, alien, alien.hp - 1))
  expect(threat(battle, alien, alien.hp)).toBeGreaterThan(harm(battle, alien))
})
