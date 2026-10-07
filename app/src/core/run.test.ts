import { expect, test } from 'vitest'
import { apply } from './apply'
import { FACILITIES } from './base'
import { BASE_STATS, type Side } from './battle'
import { CLASSES } from './classes'
import {
  BASE_SQUAD,
  createRun,
  DROP_SUPPLIES,
  endBattle,
  FORKS,
  KEYS,
  LOSS_THREAT,
  nextStop,
  rank,
  RISKS,
  soldierStats,
  START_SUPPLIES,
  STOP_THREAT,
  THREAT_MAX,
  type Risk,
  type Run,
  type StopKind,
} from './run'

const enter = (run: Run, risk: Risk) => apply(run, { type: 'zone', index: run.zones.findIndex((zone) => zone.risk === risk) })

/** A run travelling a zone of the given stops. */
function travelling(stops: StopKind[], risk: Risk = 'standard'): Run {
  const run = createRun(1)
  enter(run, risk)
  run.zone = { risk, stops }
  return run
}

/** Travels to the next stop, a battle, and ends it with `winner`: one soldier fought, the rest stayed in reserve, and the losing side is dead. */
function fight(run: Run, winner: Side): void {
  apply(run, { type: 'advance' })
  apply(run, { type: 'land', zone: 0 })
  const battle = run.battle!
  const [fighter, ...rest] = battle.units.filter((u) => u.side === 'human')
  battle.reserve = winner === 'human' ? rest.map((u) => ({ soldier: u.soldier!, stats: u.stats, ability: u.ability, charges: u.charges, stance: u.stance, effects: u.effects })) : []
  battle.units = battle.units.filter((u) => u.side === winner && (u.side === 'alien' || u === fighter))
  battle.phase = 'over'
  battle.winner = winner
  endBattle(run)
}

test('a run begins at a fork offering one zone of each risk, and travel waits for a choice', () => {
  const run = createRun(1)
  expect(run.zones.map((zone) => zone.risk)).toEqual(['safe', 'standard', 'dangerous'])
  expect(nextStop(run)).toBeNull()
  expect(apply(run, { type: 'advance' }).ok).toBe(false)
  expect(enter(run, 'dangerous')).toEqual({ ok: true })
  expect(run).toMatchObject({ zones: [], fork: 1, zone: { risk: 'dangerous' } })
  expect(apply(run, { type: 'zone', index: 0 }).ok).toBe(false)
})

test.each(['safe', 'standard', 'dangerous'] as const)('a won battle in a %s zone adds threat, pays by the risk, promotes the survivor, and offers aid', (risk) => {
  const run = travelling(['battle', 'battle'], risk)
  fight(run, 'human')
  expect(run).toMatchObject({ phase: 'reward', threat: STOP_THREAT, supplies: START_SUPPLIES + RISKS[risk].supplies, stop: 1 })
  expect(run.gear).toHaveLength(RISKS[risk].drops)
  if (RISKS[risk].rareGear) expect(run.gear.every((gear) => gear.rarity !== 'common')).toBe(true)
  expect(run.report).toMatchObject({ stop: 'battle', won: true, threat: { before: 0, after: STOP_THREAT }, key: false })
  expect(run.report!.soldiers.map((s) => s.xpAfter - s.xpBefore).sort()).toEqual([0, 0, 0, 1])
  expect(run.soldiers.map((s) => s.cls !== null)).toEqual(run.soldiers.map((s) => rank(s) > 0))
  expect(new Set(run.offers).size).toBe(3)
  apply(run, { type: 'pick', index: 0 })
  expect(run.aid).toHaveLength(1)
  expect(run.phase).toBe('overworld')
})

test('a lost battle adds more threat, replaces the dead, pays nothing, and the squad travels on', () => {
  const run = travelling(['battle', 'battle'])
  const before = run.soldiers.map((s) => s.id)
  fight(run, 'alien')
  expect(run).toMatchObject({ phase: 'overworld', threat: STOP_THREAT + LOSS_THREAT, supplies: START_SUPPLIES, gear: [], stop: 1 })
  expect(run.soldiers).toHaveLength(before.length)
  expect(run.soldiers.some((s) => before.includes(s.id))).toBe(false)
  expect(run.report!.soldiers.every((s) => s.died)).toBe(true)
})

test('a supply drop and a cache are collected on arrival, each adding threat', () => {
  const run = travelling(['supply', 'cache', 'battle'])
  apply(run, { type: 'advance' })
  expect(run).toMatchObject({ phase: 'overworld', supplies: START_SUPPLIES + DROP_SUPPLIES, threat: STOP_THREAT, stop: 1 })
  expect(run.report).toMatchObject({ stop: 'supply', supplies: DROP_SUPPLIES, soldiers: [] })
  apply(run, { type: 'advance' })
  expect(run.gear).toHaveLength(1)
  expect(run.report).toMatchObject({ stop: 'cache', gear: run.gear })
  expect(run.threat).toBe(2 * STOP_THREAT)
})

test('after the forks of a leg comes its satellite: winning it wins a key and opens the next leg; losing it means fighting it again', () => {
  const run = createRun(1)
  for (let fork = 0; fork < FORKS; fork++) {
    enter(run, 'dangerous')
    fight(run, 'alien')
  }
  expect(run.zone).toEqual({ risk: 'standard', stops: ['key'] })
  fight(run, 'alien')
  expect(run).toMatchObject({ keys: 0, zone: { stops: ['key'] }, stop: 0 })
  run.threat = 0
  fight(run, 'human')
  expect(run).toMatchObject({ keys: 1, fork: 0, zone: null, phase: 'reward' })
  expect(run.report).toMatchObject({ stop: 'key', key: true })
  expect(run.gear.every((gear) => gear.rarity !== 'common')).toBe(true)
  expect(run.zones).toHaveLength(3)
})

test.each(['human', 'alien'] as const)('full threat puts a last stand before the next stop; %s win', (winner) => {
  const run = travelling(['battle', 'battle'])
  run.threat = THREAT_MAX
  expect(nextStop(run)).toBe('lastStand')
  fight(run, winner)
  expect(run.report!.stop).toBe('lastStand')
  if (winner === 'alien') return expect(run.phase).toBe('lost')
  expect(run).toMatchObject({ phase: 'reward', threat: 0, stop: 0 })
  expect(nextStop(run)).toBe('battle')
})

test.each(['human', 'alien'] as const)('with every key won, only the final mission remains, and it decides the run; %s win', (winner) => {
  const run = createRun(1)
  run.keys = KEYS - 1
  run.fork = FORKS
  run.zone = { risk: 'standard', stops: ['key'] }
  fight(run, 'human')
  apply(run, { type: 'pick', index: 0 })
  expect(run.zone).toEqual({ risk: 'standard', stops: ['final'] })
  run.threat = 0
  fight(run, winner)
  expect(run.phase).toBe(winner === 'human' ? 'won' : 'lost')
})

test('aliens grow in number along the road, and a key mission has a boss', () => {
  const run = createRun(1)
  const count = () => {
    apply(run, { type: 'advance' })
    return run.battle!.units.filter((u) => u.side === 'alien')
  }
  enter(run, 'standard')
  const first = count()
  expect(first.some((u) => u.boss)).toBe(false)
  run.phase = 'overworld'
  run.fork = FORKS
  run.zone = { risk: 'standard', stops: ['key'] }
  const key = count()
  expect(key.length).toBeGreaterThan(first.length)
  expect(key.filter((u) => u.boss)).toHaveLength(1)
})

test('stats add rank, facilities and aid to the base', () => {
  const run = createRun(1)
  run.built = ['workshop', 'workshop']
  run.aid = ['plasma']
  const stats = soldierStats(run, { id: 0, name: '', xp: 3, cls: null, gear: { weapon: null, armor: null, utility: null } })
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
    run.threat = 3
    run.offers = [id]
    apply(run, { type: 'pick', index: 0 })
    return run
  }
  expect(take('convoy').supplies).toBe(START_SUPPLIES + 6)
  expect(take('jammer').threat).toBe(1)
  expect(take('training').soldiers.every((s) => s.xp === 1)).toBe(true)
  expect(take('veteran').soldiers.map(rank).sort()).toEqual([0, 0, 0, 3])
})

test('a class changes stats and gives the unit its ability', () => {
  const run = travelling(['battle'])
  run.soldiers[0].xp = 1
  run.soldiers[0].cls = 'heavy'
  expect(soldierStats(run, run.soldiers[0]).hp).toBe(BASE_STATS.hp + 1 + CLASSES.heavy.stats.hp!)
  apply(run, { type: 'advance' })
  apply(run, { type: 'land', zone: 0 })
  const units = run.battle!.units.filter((u) => u.side === 'human')
  expect(units[0]).toMatchObject({ ability: 'rocket', charges: 1, stance: 'anchor' })
  expect(units[1]).toMatchObject({ ability: null, charges: 0, stance: 'balanced' })
})
