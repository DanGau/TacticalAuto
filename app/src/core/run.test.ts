import { expect, test } from 'vitest'
import { apply } from './apply'
import { BASE_STATS, type Side } from './battle'
import { FACILITIES } from './base'
import { CLASSES } from './classes'
import {
  BASE_SQUAD,
  createRun,
  endBattle,
  LOSS_THREAT,
  payout,
  preview,
  rank,
  ROUNDS,
  SKIP_THREAT,
  soldierStats,
  START_SUPPLIES,
  START_THREAT,
  STRIKES,
  THREAT_MAX,
  WIN_THREAT,
  type Run,
} from './run'

/** Ends the battle awaiting a landing with `winner`: one soldier fought, the rest stayed in reserve, and the losing side is dead. */
function finish(run: Run, winner: Side): void {
  const battle = run.battle!
  apply(run, { type: 'land', zone: 0 })
  const [fighter, ...rest] = battle.units.filter((u) => u.side === 'human')
  battle.reserve = winner === 'human' ? rest.map((u) => ({ soldier: u.soldier!, stats: u.stats, ability: u.ability, charges: u.charges, stance: u.stance })) : []
  battle.units = battle.units.filter((u) => u.side === winner && (u.side === 'alien' || u === fighter))
  battle.phase = 'over'
  battle.winner = winner
  endBattle(run)
}

test('a round offers strikes in different regions; skipped ones gain threat once the battle ends', () => {
  const run = createRun(1)
  expect(run.missions.map((m) => m.kind)).toEqual(Array(STRIKES).fill('strike'))
  expect(new Set(run.missions.map((m) => m.region)).size).toBe(STRIKES)
  const [chosen, ...skipped] = run.missions
  const { won, lost } = preview(run, chosen)
  expect(won[chosen.region]).toBe(START_THREAT - WIN_THREAT)
  expect(lost![chosen.region]).toBe(START_THREAT + LOSS_THREAT)
  for (const m of skipped) expect(won[m.region]).toBe(START_THREAT + SKIP_THREAT)
  apply(run, { type: 'mission', index: 0 })
  expect(run.threat).toEqual(Array(6).fill(START_THREAT))
  finish(run, 'human')
  expect(run.threat).toEqual(won)
  expect(run.report!.threat.before).toEqual(Array(6).fill(START_THREAT))
  expect(run.report!.threat.afterMission[chosen.region]).toBe(START_THREAT - WIN_THREAT)
  for (const m of skipped) expect(run.report!.threat.afterMission[m.region]).toBe(START_THREAT)
  expect(run.report!.threat.afterAliens).toEqual(won)
})

test('a won strike lowers threat, pays supplies, promotes the survivor, and offers three different aid cards', () => {
  const run = createRun(1)
  const region = run.missions[0].region
  const pay = payout(run.missions[0])
  apply(run, { type: 'mission', index: 0 })
  finish(run, 'human')
  expect(run.threat[region]).toBe(START_THREAT - WIN_THREAT)
  expect(run.phase).toBe('reward')
  expect(run.supplies).toBe(START_SUPPLIES + pay)
  expect(new Set(run.offers).size).toBe(3)
  expect(run.soldiers.filter((s) => rank(s) === 1)).toHaveLength(1)
  expect(run.soldiers.map((s) => s.cls !== null)).toEqual(run.soldiers.map((s) => rank(s) > 0))
  expect(run.report).toMatchObject({ won: true, supplies: pay })
  expect(run.report!.soldiers.map((s) => s.xpAfter - s.xpBefore).sort()).toEqual([0, 0, 0, 1])
  expect(run.report!.soldiers.some((s) => s.died)).toBe(false)
  apply(run, { type: 'pick', index: 0 })
  expect(run.aid).toHaveLength(1)
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
  expect(run.report).toMatchObject({ won: false, supplies: 0 })
  expect(run.report!.soldiers.every((s) => s.died)).toBe(true)
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

test('stats add rank, facilities and aid to the base', () => {
  const run = createRun(1)
  run.built = ['workshop', 'workshop']
  run.aid = ['plasma']
  const stats = soldierStats(run, { id: 0, name: '', xp: 3, cls: null })
  expect(stats.hp).toBe(BASE_STATS.hp + 2 + 2 + 2)
  expect(stats.damage).toBe(BASE_STATS.damage + 1)
  expect(stats.aim).toBeCloseTo(BASE_STATS.aim + 0.06)
})

test('building costs more each level, stops at the maximum, and needs supplies', () => {
  const run = createRun(1)
  run.supplies = 100
  const { cost, max } = FACILITIES.barracks
  for (let n = 1; n <= max; n++) {
    expect(apply(run, { type: 'build', facility: 'barracks' })).toEqual({ ok: true })
    expect(run.soldiers).toHaveLength(BASE_SQUAD + n)
  }
  expect(run.supplies).toBe(100 - cost - 2 * cost)
  expect(apply(run, { type: 'build', facility: 'barracks' })).toEqual({ ok: false, reason: 'fully built' })
  run.supplies = 0
  expect(apply(run, { type: 'build', facility: 'workshop' })).toEqual({ ok: false, reason: 'not enough supplies' })
})

test('aid applies at once: supplies, threat, experience, promotion', () => {
  const take = (id: Run['offers'][number]) => {
    const run = createRun(1)
    run.phase = 'reward'
    run.offers = [id]
    apply(run, { type: 'pick', index: 0 })
    return run
  }
  expect(take('convoy').supplies).toBe(START_SUPPLIES + 6)
  expect(take('satellite').threat).toEqual(Array(6).fill(START_THREAT - 1))
  expect(take('training').soldiers.every((s) => s.xp === 1)).toBe(true)
  expect(take('veteran').soldiers.map(rank).sort()).toEqual([0, 0, 0, 3])
})

test('a class changes stats and gives the unit its ability', () => {
  const run = createRun(1)
  run.soldiers[0].xp = 1
  run.soldiers[0].cls = 'heavy'
  expect(soldierStats(run, run.soldiers[0]).hp).toBe(BASE_STATS.hp + 1 + CLASSES.heavy.stats.hp!)
  apply(run, { type: 'mission', index: 0 })
  apply(run, { type: 'land', zone: 0 })
  const units = run.battle!.units.filter((u) => u.side === 'human')
  expect(units[0]).toMatchObject({ ability: 'rocket', charges: 1, stance: 'anchor' })
  expect(units[1]).toMatchObject({ ability: null, charges: 0, stance: 'balanced' })
})
