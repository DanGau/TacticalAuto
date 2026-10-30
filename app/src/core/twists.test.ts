import { expect, test } from 'vitest'
import { alienStats } from './aliens'
import { deploy, zoneOf, begun } from './roads'
import { apply } from './apply'
import { coverAt, crumble, GRID, type Battle } from './battle'
import { stepBattle, type GameEvent } from './combat'
import { PATHS } from './skills'
import { coverAgainst, detects, sees } from './sight'
import { generateTerrain } from './terrain'
import { drawTwist, FUEL_DAMAGE, TWISTS, type Twist } from './twists'

/** A soldier at (10, 10) and a trooper at (10, 12) on open, flat ground, with `twist`. */
function duel(twist: Twist | null): Battle {
  const run = begun(1)
  run.soldiers[0].skills = [PATHS[run.soldiers[0].cls!][0].core]
  apply(run, { type: 'go', index: 1 })
  apply(run, { type: 'advance' })
  deploy(run, zoneOf(run.battle!, 'stealth'))
  const battle = run.battle!
  Object.assign(battle, { goal: 'exterminate', uplink: null, waves: [], twist })
  battle.ground.fill('pavement')
  battle.cover.fill(0)
  battle.props.fill('none')
  battle.height.fill(0)
  battle.north.fill('none')
  battle.west.fill('none')
  const soldier = battle.units.find((u) => u.side === 'human' && !u.civilian)!
  const alien = battle.units.find((u) => u.side === 'alien')!
  battle.units = [soldier, alien]
  battle.pods.forEach((pod) => Object.assign(pod, { revealed: true, alert: true }))
  Object.assign(soldier, { x: 10, y: 10, effects: [], stats: { ...soldier.stats, move: 0, range: 8 } })
  Object.assign(alien, { kind: 'trooper', x: 10, y: 12, hp: 99, armor: 0, target: false, stats: { ...alienStats('trooper', 0, 0), hp: 99, armor: 0, move: 0 } })
  return battle
}

/** Steps the battle until the soldier fires, and returns that beat's events. */
function untilShot(battle: Battle): GameEvent[] {
  const soldier = battle.units.find((u) => u.side === 'human' && !u.civilian)!
  for (let beat = 0; beat < 100; beat++) {
    const events = stepBattle(battle)
    if (events.some((e) => e.type === 'shot' && e.id === soldier.id)) return events
  }
  throw new Error('no shot')
}

test('no twist on the first leg; each later leg opens its own twists, and only those', () => {
  const rng = { rng: 3 }
  for (let leg = 0; leg < 4; leg++) {
    for (let i = 0; i < 200; i++) {
      const twist = drawTwist(rng, leg)
      if (leg === 0) expect(twist).toBeNull()
      if (twist) expect(TWISTS[twist].from).toBeLessThanOrEqual(leg)
    }
  }
})

test('narrow ground leaves void off the battlefield, which blocks walking but neither sight nor shelters', () => {
  const terrain = generateTerrain({ rng: 5 }, GRID, 'town', 'narrow')
  const gone = terrain.ground.filter((g) => g === 'void').length
  expect(gone).toBeGreaterThan(GRID * GRID * 0.2)
  expect(gone).toBeLessThan(GRID * GRID * 0.8)
  const battle = duel(null)
  battle.props[11 * GRID + 10] = 'void'
  battle.cover[11 * GRID + 10] = 1
  expect(coverAgainst(battle, { x: 10, y: 10 }, { x: 10, y: 14 })).toBe(0)
  expect(sees(battle, { x: 10, y: 10 }, { x: 10, y: 14 })).toBe(true)
})

test('crumbling cover breaks a level with each hit: high cover to rubble, rubble to nothing', () => {
  const battle = duel('crumbling')
  battle.props[11 * GRID + 10] = 'stack'
  battle.cover[11 * GRID + 10] = 2
  crumble(battle, { x: 10, y: 10 }, { x: 10, y: 12 })
  expect([battle.props[11 * GRID + 10], coverAt(battle, 10, 11)]).toEqual(['rubble', 1])
  crumble(battle, { x: 10, y: 10 }, { x: 10, y: 12 })
  expect(coverAt(battle, 10, 11)).toBe(0)
})

test('a shot that misses a unit beside a fuel tank sets it off', () => {
  const battle = duel('fuel')
  const [soldier, alien] = battle.units
  soldier.stats = { ...soldier.stats, aim: -9 }
  battle.props[12 * GRID + 11] = 'fuel'
  battle.cover[12 * GRID + 11] = 1
  const events = untilShot(battle)
  expect(events).toContainEqual(expect.objectContaining({ type: 'rocket', x: 11, y: 12 }))
  expect(alien.hp).toBe(99 - FUEL_DAMAGE)
  expect(alien.burning).toBeGreaterThan(0)
  expect(battle.props[12 * GRID + 11]).toBe('none')
})

test('in the rain nothing burns', () => {
  const battle = duel('rain')
  const [soldier, alien] = battle.units
  Object.assign(soldier, { effects: ['incendiary'], stats: { ...soldier.stats, aim: 9 } })
  untilShot(battle)
  expect(alien.burning).toBe(0)
})

test('fog shortens sight, and night noticing', () => {
  const battle = duel(null)
  const [soldier, alien] = battle.units
  Object.assign(alien, { x: 10, y: 17, moved: true })
  expect(sees(battle, soldier, alien)).toBe(true)
  expect(detects(battle, soldier, alien)).toBe(true)
  battle.twist = 'fog'
  expect(sees(battle, soldier, alien)).toBe(false)
  battle.twist = 'night'
  expect(detects(battle, soldier, alien)).toBe(false)
})

test('narrow ground leaves no open ground cut off by cover or walls', () => {
  for (let seed = 1; seed <= 40; seed++) {
    const t = generateTerrain({ rng: seed }, GRID, 'town', 'narrow')
    const open = (i: number) => t.ground[i] !== 'void' && t.props[i] === 'none'
    const start = t.props.findIndex((_, i) => open(i))
    const reached = new Set([start])
    const queue = [start]
    for (let i = 0; i < queue.length; i++) {
      const at = queue[i]
      const steps = [
        [at - GRID, t.north[at]],
        [at + GRID, t.north[at + GRID]],
        [at % GRID > 0 ? at - 1 : -1, t.west[at]],
        [at % GRID < GRID - 1 ? at + 1 : -1, t.west[at + 1]],
      ] as const
      for (const [n, edge] of steps) {
        if (n < 0 || n >= GRID * GRID || edge !== 'none' || !open(n) || reached.has(n)) continue
        reached.add(n)
        queue.push(n)
      }
    }
    expect(t.props.filter((_, i) => open(i)).length).toBe(reached.size)
  }
})
