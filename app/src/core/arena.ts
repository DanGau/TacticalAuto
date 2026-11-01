// Test helper: a squad of one on open ground, against aliens where a test puts them.
import { apply } from './apply'
import { alienStats } from './aliens'
import { type Battle, type Effect, type Tile, type Unit } from './battle'
import { reshaped } from './grid'
import { begun, enterAt } from './roads'
import { stepBattle } from './combat'
import type { GameEvent } from './combat-event'

/** For tests: a battle cleared to bare ground, one hero at 10,10 with `effects`, and tough aliens at `spots`. */
export function arena(effects: Effect[], spots: Tile[]): { battle: Battle; hero: Unit; aliens: Unit[]; beats: (n: number) => GameEvent[] } {
  const run = begun(1)
  apply(run, { type: 'go', index: 1 })
  apply(run, { type: 'advance' })
  enterAt(run)
  const battle = run.battle!
  Object.assign(battle, { goal: 'exterminate', uplink: null, waves: [], twist: null, deadline: null, opening: false, phase: 'battle' })
  battle.ground.fill('pavement')
  battle.props.fill('none')
  battle.bulk.fill(0)
  battle.height.fill(0)
  battle.north.fill('none')
  battle.west.fill('none')
  reshaped(battle)
  const hero = battle.units.find((u) => u.soldier === run.soldiers[0].id)!
  const model = battle.units.find((u) => u.side === 'alien')!
  Object.assign(hero, { x: 10, y: 10, stance: 'anchor', ability: null, charges: 0, effects, spent: [], weapon: undefined, secondary: undefined, stats: { ...hero.stats, move: 0, range: 8 } })
  const aliens = spots.map((tile, i) => ({ ...model, id: 1000 + i, ...tile, kind: 'trooper' as const, boss: false, target: false, spawns: false, resists: [], effects: [], revealed: true, engaged: true, cluster: 0, hp: 40, armor: 0, stats: { ...alienStats('trooper', 0, 0), hp: 40, move: 0, range: 8 } }))
  battle.units = [hero, ...aliens]
  battle.nextId = 2000
  Object.assign(battle, { turn: 'human', stage: 'shoot', shooter: 0, attacks: 0, actor: null })
  return { battle, hero, aliens, beats: (n) => Array.from({ length: n }, () => stepBattle(battle)).flat() }
}
