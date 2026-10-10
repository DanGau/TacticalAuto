import { expect, test } from 'vitest'
import { ALIENS, alienStats, muster, type AlienKind } from './aliens'
import { apply } from './apply'
import { ACID_DAMAGE, alienUnit, BASE_STATS, BURST_DAMAGE, PSI_BACKLASH, SPAWN_EVERY, SPIT_DAMAGE, type Battle, type Unit } from './battle'
import { stepBattle, type GameEvent } from './combat'
import { createRun } from './run'

test('a mission musters kinds its depth allows, for exactly its force', () => {
  const rng = { rng: 5 }
  for (let depth = 0; depth < 6; depth++) {
    for (let force = 1; force < 12; force++) {
      const kinds = muster(rng, force, depth)
      for (const kind of kinds) expect(ALIENS[kind].from).toBeLessThanOrEqual(depth)
      const cost = (Object.keys(ALIENS) as AlienKind[]).reduce((sum, kind) => sum + (kinds.filter((k) => k === kind).length / ALIENS[kind].pack) * ALIENS[kind].cost, 0)
      expect(cost).toBe(force)
    }
  }
})

/**
 * A battle on open ground with one soldier at (10, 10) and the given aliens placed around it, all revealed.
 * The soldier never misses and never crits.
 */
function arena(aliens: { kind: AlienKind; x: number; y: number; boss?: boolean }[]): { battle: Battle; soldier: Unit; aliens: Unit[]; until: (done: (events: GameEvent[]) => boolean) => GameEvent[] } {
  const run = createRun(1)
  apply(run, { type: 'zone', index: 1 })
  apply(run, { type: 'advance' })
  apply(run, { type: 'land', zone: 0 })
  const battle = run.battle!
  battle.cover.fill(0)
  battle.props.fill('none')
  battle.north.fill('none')
  battle.west.fill('none')
  const soldier = battle.units.find((u) => u.side === 'human')!
  Object.assign(soldier, { x: 10, y: 10, hp: 30, stats: { ...soldier.stats, hp: 30, aim: 2, crit: 0, damage: 3 } })
  const units = aliens.map(({ kind, x, y, boss = false }) => alienUnit(battle, { kind, stats: alienStats(kind, BASE_STATS), stance: ALIENS[kind].stance, boss }, { x, y }, 0))
  battle.units = [soldier, ...units]
  battle.pods = [{ revealed: true, surprised: false, waypoint: { x: 0, y: 0 } }]
  const until = (done: (events: GameEvent[]) => boolean) => {
    const all: GameEvent[] = []
    for (let beats = 0; beats < 60; beats++) {
      all.push(...stepBattle(battle))
      if (done(all)) return all
    }
    throw new Error(`never happened; saw ${JSON.stringify(all)}`)
  }
  return { battle, soldier, aliens: units, until }
}

const has = (type: GameEvent['type']) => (events: GameEvent[]) => events.some((e) => e.type === type)

test('a swarmling attacks only from the next tile', () => {
  const { soldier, aliens, until } = arena([{ kind: 'swarmling', x: 10, y: 22 }])
  soldier.stats = { ...soldier.stats, move: 0, range: 0 }
  const events = until((all) => all.some((e) => e.type === 'shot' && e.id === aliens[0].id))
  const shot = events.findIndex((e) => e.type === 'shot' && e.id === aliens[0].id)
  expect(events.slice(0, shot).some((e) => e.type === 'move' && e.id === aliens[0].id)).toBe(true)
  expect(Math.max(Math.abs(aliens[0].x - 10), Math.abs(aliens[0].y - 10))).toBe(1)
})

test("a spitter's spit always lands and leaves acid that burns whoever starts a turn in it", () => {
  const { battle, soldier, aliens, until } = arena([{ kind: 'spitter', x: 10, y: 16 }])
  aliens[0].hp = aliens[0].stats.hp = 99
  // Hold the soldier still, so it starts its next turn in the acid.
  soldier.stats = { ...soldier.stats, move: 0, range: 0 }
  const events = until(has('hurt'))
  expect(events).toContainEqual({ type: 'spit', id: aliens[0].id, target: soldier.id, damage: SPIT_DAMAGE })
  expect(events).toContainEqual({ type: 'hurt', id: soldier.id, amount: ACID_DAMAGE, cause: 'acid' })
  expect(battle.acid).toMatchObject([{ x: 10, y: 10 }])
})

test('a soldier free to move steps out of acid', () => {
  const { soldier, aliens, until } = arena([{ kind: 'spitter', x: 10, y: 16 }])
  aliens[0].hp = aliens[0].stats.hp = 99
  const events = until((all) => all.filter((e) => e.type === 'spit').length >= 1 && all.at(-1)?.type === 'move')
  expect(events.some((e) => e.type === 'move' && e.id === soldier.id)).toBe(true)
  expect([soldier.x, soldier.y]).not.toEqual([10, 10])
})

test('a burster explodes where it dies, hurting everything beside it', () => {
  const { soldier, aliens, until } = arena([
    { kind: 'burster', x: 10, y: 13 },
    { kind: 'trooper', x: 11, y: 13 },
  ])
  soldier.stats = { ...soldier.stats, move: 0, damage: 50 }
  aliens[1].hp = aliens[1].stats.hp = BURST_DAMAGE + 5
  aliens[0].stats = { ...aliens[0].stats, move: 0 }
  aliens[1].stats = { ...aliens[1].stats, move: 0, aim: 0 }
  const events = until(has('rocket'))
  expect(events).toContainEqual({ type: 'rocket', id: aliens[0].id, x: 10, y: 13, hits: [{ target: aliens[1].id, damage: BURST_DAMAGE }] })
  expect(aliens[1].hp).toBeLessThanOrEqual(5)
})

test('a burster beside a soldier blows itself up', () => {
  const { soldier, aliens, until } = arena([{ kind: 'burster', x: 10, y: 15 }])
  soldier.stats = { ...soldier.stats, move: 0, range: 0 }
  until(has('rocket'))
  expect(soldier.hp).toBe(30 - BURST_DAMAGE)
  expect(aliens[0].hp).toBeLessThanOrEqual(0)
})

test('a brute that survives a hit charges the shooter', () => {
  const { soldier, aliens, until } = arena([{ kind: 'brute', x: 10, y: 14 }])
  soldier.stats = { ...soldier.stats, move: 0, damage: 1 }
  const events = until(has('shot'))
  const shot = events.findIndex((e) => e.type === 'shot' && e.id === soldier.id)
  expect(events[shot + 1]).toMatchObject({ type: 'move', id: aliens[0].id })
  expect(aliens[0].y).toBe(14 - aliens[0].stats.move)
})

test('a psion panics a soldier, who loses its next action, and hurts its pod when it dies', () => {
  const { soldier, aliens, until } = arena([
    { kind: 'psion', x: 10, y: 15 },
    { kind: 'trooper', x: 16, y: 10 },
  ])
  soldier.stats = { ...soldier.stats, move: 0, damage: 50, range: 9 }
  aliens[1].stats = { ...aliens[1].stats, move: 0, aim: 0 }
  aliens[0].stats = { ...aliens[0].stats, move: 0 }
  // The soldier shoots first and would kill the psion, so make the psion outlast one shot.
  aliens[0].hp = 80
  const events = until(has('frozen'))
  expect(events).toContainEqual({ type: 'panic', id: aliens[0].id, target: soldier.id })
  expect(events.at(-1)).toEqual({ type: 'frozen', id: soldier.id })
  const after = until(has('death'))
  expect(after).toContainEqual({ type: 'hurt', id: aliens[1].id, amount: PSI_BACKLASH, cause: 'backlash' })
})

test('a boss spawns a swarmling every few alien turns', () => {
  const { battle, soldier, aliens, until } = arena([{ kind: 'trooper', x: 10, y: 25, boss: true }])
  soldier.stats = { ...soldier.stats, move: 0, range: 0 }
  aliens[0].stats = { ...aliens[0].stats, move: 0, range: 0 }
  expect(aliens[0].cooldown).toBe(SPAWN_EVERY)
  until(has('spawn'))
  expect(battle.units.filter((u) => u.kind === 'swarmling')).toHaveLength(1)
})
