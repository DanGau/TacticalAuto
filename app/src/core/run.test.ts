import { expect, test } from 'vitest'
import { apply } from './apply'
import { BASE_STATS, type Side } from './battle'
import { createRun, endBattle, LOSS_THREAT, rank, ROUNDS, SKIP_THREAT, soldierStats, START_THREAT, STRIKES, THREAT_MAX, WIN_THREAT, type Run } from './run'

/** Ends the battle being deployed with `winner`: one soldier deployed, and every unit of the other side dead. */
function finish(run: Run, winner: Side): void {
  const battle = run.battle!
  battle.cover.fill(0)
  apply(run, { type: 'deploy', x: 0, y: 19 })
  battle.units = battle.units.filter((u) => u.side === winner)
  battle.reserve = winner === 'human' ? battle.reserve : []
  battle.phase = 'over'
  battle.winner = winner
  endBattle(run)
}

test('a round offers strikes in different regions; skipped ones gain threat', () => {
  const run = createRun(1)
  expect(run.missions.map((m) => m.kind)).toEqual(Array(STRIKES).fill('strike'))
  expect(new Set(run.missions.map((m) => m.region)).size).toBe(STRIKES)
  const [chosen, ...skipped] = run.missions
  apply(run, { type: 'mission', index: 0 })
  expect(run.threat[chosen.region]).toBe(START_THREAT)
  for (const m of skipped) expect(run.threat[m.region]).toBe(START_THREAT + SKIP_THREAT)
})

test('a won strike lowers threat, promotes the survivor, and offers three different upgrades', () => {
  const run = createRun(1)
  const region = run.missions[0].region
  apply(run, { type: 'mission', index: 0 })
  finish(run, 'human')
  expect(run.threat[region]).toBe(START_THREAT - WIN_THREAT)
  expect(run.phase).toBe('reward')
  expect(new Set(run.offers).size).toBe(3)
  expect(run.soldiers.filter((s) => rank(s) === 1)).toHaveLength(1)
  apply(run, { type: 'pick', index: 0 })
  expect(run.upgrades).toHaveLength(1)
  expect(run).toMatchObject({ phase: 'map', round: 2 })
})

test('a lost strike raises threat, replaces the dead, and the run goes on', () => {
  const run = createRun(1)
  const region = run.missions[0].region
  const before = run.soldiers.map((s) => s.id)
  apply(run, { type: 'mission', index: 0 })
  finish(run, 'alien')
  expect(run.threat[region]).toBe(START_THREAT + LOSS_THREAT)
  expect(run.soldiers).toHaveLength(before.length)
  expect(run.soldiers.some((s) => before.includes(s.id))).toBe(false)
  expect(run).toMatchObject({ phase: 'map', round: 2 })
})

test.each(['human', 'alien'] as const)('a region at maximum threat forces a last stand; %s win', (winner) => {
  const run = createRun(1)
  run.threat[2] = THREAT_MAX
  apply(run, { type: 'mission', index: 0 })
  finish(run, 'alien')
  expect(run.missions).toMatchObject([{ kind: 'lastStand', region: 2 }])
  apply(run, { type: 'mission', index: 0 })
  finish(run, winner)
  if (winner === 'human') expect(run.threat[2]).toBe(0)
  expect(run.phase).toBe(winner === 'human' ? 'reward' : 'lost')
})

test.each(['human', 'alien'] as const)('after the last round comes the final assault, which decides the run; %s win', (winner) => {
  const run = createRun(1)
  run.round = ROUNDS
  apply(run, { type: 'mission', index: 0 })
  finish(run, 'alien')
  expect(run.missions).toMatchObject([{ kind: 'final' }])
  apply(run, { type: 'mission', index: 0 })
  finish(run, winner)
  expect(run.phase).toBe(winner === 'human' ? 'won' : 'lost')
})

test('stats add rank and upgrades to the base', () => {
  const run = createRun(1)
  run.upgrades = ['workshop', 'workshop', 'foundry']
  const stats = soldierStats(run, { id: 0, name: '', xp: 3 })
  expect(stats.hp).toBe(BASE_STATS.hp + 2 + 2 + 2)
  expect(stats.damage).toBe(BASE_STATS.damage + 1)
  expect(stats.aim).toBeCloseTo(BASE_STATS.aim + 0.06)
})
