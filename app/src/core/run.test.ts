import { expect, test } from 'vitest'
import { apply } from './apply'
import { FACILITIES } from './base'
import { BASE_STATS, type Side } from './battle'
import { CLASSES } from './classes'
import {
  createRun,
  DROP_SUPPLIES,
  endBattle,
  FORKS,
  KEYS,
  LEG_FORCE,
  LOSS_THREAT,
  missionAt,
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
  run.zone = { risk, terrain: 'town', stops }
  return run
}

/** Travels to the next stop, a battle, and ends it with `winner`: the losing side is dead to the last unit. */
function fight(run: Run, winner: Side): void {
  apply(run, { type: 'advance' })
  apply(run, { type: 'land', zone: 0 })
  const battle = run.battle!
  battle.units = battle.units.filter((u) => u.side === winner)
  battle.phase = 'over'
  battle.winner = winner
  endBattle(run)
}

test('a run begins with one trained clone, at a fork offering one zone of each risk', () => {
  const run = createRun(1)
  expect(run.soldiers).toHaveLength(1)
  expect(rank(run.soldiers[0])).toBe(1)
  expect(run.soldiers[0].cls).not.toBeNull()
  expect(run.zones.map((zone) => zone.risk)).toEqual(['safe', 'standard', 'dangerous'])
  expect(nextStop(run)).toBeNull()
  expect(apply(run, { type: 'advance' }).ok).toBe(false)
  expect(enter(run, 'dangerous')).toEqual({ ok: true })
  expect(run).toMatchObject({ zones: [], fork: 1, zone: { risk: 'dangerous' } })
  expect(apply(run, { type: 'zone', index: 0 }).ok).toBe(false)
})

test.each(['safe', 'standard', 'dangerous'] as const)('a won battle in a %s zone adds threat, pays by the risk, gives experience, and offers aid', (risk) => {
  const run = travelling(['battle', 'battle'], risk)
  fight(run, 'human')
  expect(run).toMatchObject({ phase: 'reward', threat: STOP_THREAT, supplies: START_SUPPLIES + RISKS[risk].supplies, stop: 1 })
  expect(run.gear).toHaveLength(RISKS[risk].drops)
  if (RISKS[risk].rareGear) expect(run.gear.every((gear) => gear.rarity !== 'common')).toBe(true)
  expect(run.report).toMatchObject({ stop: 'battle', won: true, threat: { before: 0, after: STOP_THREAT }, key: false, hired: null })
  expect(run.report!.soldiers).toMatchObject([{ xpBefore: 1, xpAfter: 2, downed: false }])
  expect(new Set(run.offers).size).toBe(3)
  apply(run, { type: 'pick', index: 0 })
  expect(run.aid).toHaveLength(1)
  expect(run.phase).toBe('overworld')
})

test('a lost battle adds more threat and pays nothing; the fallen soldier is cloned anew with everything they had, but no experience', () => {
  const run = travelling(['battle', 'battle'])
  run.gear.push({ id: 1, slot: 'armor', rarity: 'common', name: 'Sturdy Vest', stats: { armor: 2 }, effect: null })
  apply(run, { type: 'equip', soldier: run.soldiers[0].id, gear: 1 })
  const before = structuredClone(run.soldiers)
  fight(run, 'alien')
  expect(run).toMatchObject({ phase: 'overworld', threat: STOP_THREAT + LOSS_THREAT, supplies: START_SUPPLIES, stop: 1 })
  expect(run.soldiers).toEqual(before)
  expect(run.report!.soldiers).toMatchObject([{ downed: true, xpBefore: 1, xpAfter: 1 }])
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

test('after the forks of a leg comes its satellite: winning it wins a key, a new clone, and the next leg; losing it means fighting it again', () => {
  const run = createRun(1)
  for (let fork = 0; fork < FORKS; fork++) {
    enter(run, 'dangerous')
    fight(run, 'alien')
  }
  expect(run.zone).toMatchObject({ risk: 'standard', terrain: 'compound', stops: ['key'] })
  fight(run, 'alien')
  expect(run).toMatchObject({ keys: 0, zone: { stops: ['key'] }, stop: 0 })
  expect(run.soldiers).toHaveLength(1)
  run.threat = 0
  fight(run, 'human')
  expect(run).toMatchObject({ keys: 1, fork: 0, zone: null, phase: 'reward' })
  expect(run.soldiers).toHaveLength(2)
  expect(run.report).toMatchObject({ stop: 'key', key: true, hired: run.soldiers[1].name })
  expect(run.gear.every((gear) => gear.rarity !== 'common')).toBe(true)
  expect(run.zones).toHaveLength(3)
})

test('a new clone arrives at the rank of the squad\'s lowest, and one higher for each academy', () => {
  const arrival = (academies: number) => {
    const run = createRun(1)
    run.soldiers[0].xp = 6
    run.built = Array(academies).fill('academy')
    run.fork = FORKS
    run.zone = { risk: 'standard', terrain: 'compound', stops: ['key'] }
    fight(run, 'human')
    return run.soldiers[1]
  }
  // The first soldier is a Sergeant, and gains a battle's experience before the clone arrives.
  expect(rank(arrival(0))).toBe(3)
  expect(rank(arrival(1))).toBe(4)
  expect(arrival(0).cls).not.toBeNull()
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

test.each(['human', 'alien'] as const)('with every key won the squad is four, only the final mission remains, and it decides the run; %s win', (winner) => {
  const run = createRun(1)
  for (let key = 0; key < KEYS; key++) {
    run.fork = FORKS
    run.zone = { risk: 'standard', terrain: 'compound', stops: ['key'] }
    run.threat = 0
    fight(run, 'human')
    apply(run, { type: 'pick', index: 0 })
  }
  expect(run.soldiers).toHaveLength(KEYS + 1)
  expect(run.zone).toMatchObject({ terrain: 'hive', stops: ['final'] })
  run.threat = 0
  fight(run, winner)
  expect(run.phase).toBe(winner === 'human' ? 'won' : 'lost')
})

test('alien force follows the leg; an alien\'s health never grows, but deeper aliens wear armor', () => {
  const run = createRun(1)
  enter(run, 'standard')
  expect(missionAt(run, 'battle', 'standard').force).toBe(LEG_FORCE[0])
  apply(run, { type: 'advance' })
  const early = run.battle!.units.filter((u) => u.side === 'alien')
  expect(early.every((u) => u.stats.armor === 0)).toBe(true)

  const late = createRun(1)
  late.keys = 2
  enter(late, 'standard')
  expect(missionAt(late, 'battle', 'standard').force).toBe(LEG_FORCE[2])
  apply(late, { type: 'advance' })
  const troopers = (units: typeof early) => units.filter((u) => u.kind === 'trooper' && !u.boss)
  for (const alien of late.battle!.units.filter((u) => u.side === 'alien')) expect(alien.stats.armor).toBe(4)
  for (const trooper of troopers(late.battle!.units)) expect(trooper.stats.hp).toBe(BASE_STATS.hp)
  for (const trooper of troopers(early)) expect(trooper.stats.hp).toBe(BASE_STATS.hp)
})

test('a key mission has one boss, with an escort for each key already won', () => {
  for (const keys of [0, 2]) {
    const run = createRun(1)
    run.keys = keys
    run.fork = FORKS
    run.zone = { risk: 'standard', terrain: 'compound', stops: ['key'] }
    apply(run, { type: 'advance' })
    const battle = run.battle!
    const boss = battle.units.filter((u) => u.boss)
    expect(boss).toHaveLength(1)
    expect(battle.units.filter((u) => u.pod === boss[0].pod)).toHaveLength(1 + keys)
    expect(boss[0].spawns).toBe(keys >= 1)
  }
})

test('stats add class, rank, facilities and aid to the base', () => {
  const run = createRun(1)
  run.built = ['workshop', 'workshop']
  run.aid = ['plasma']
  const stats = soldierStats(run, { id: 0, name: '', xp: 3, cls: null, gear: { weapon: null, armor: null, utility: null } })
  expect(stats.hp).toBe(BASE_STATS.hp + 2 + 2 + 2)
  expect(stats.damage).toBe(BASE_STATS.damage + 1)
  expect(stats.aim).toBeCloseTo(BASE_STATS.aim + 0.06)
  expect(soldierStats(run, { id: 0, name: '', xp: 3, cls: 'heavy', gear: { weapon: null, armor: null, utility: null } }).hp).toBe(stats.hp + CLASSES.heavy.stats.hp!)
})

test('building costs more each level, stops at the maximum, and needs supplies', () => {
  const run = createRun(1)
  run.supplies = 100
  const { cost, max } = FACILITIES.optics
  for (let n = 1; n <= max; n++) expect(apply(run, { type: 'build', facility: 'optics' })).toEqual({ ok: true })
  expect(run.supplies).toBe(100 - cost - 2 * cost)
  expect(apply(run, { type: 'build', facility: 'optics' })).toEqual({ ok: false, reason: 'fully built' })
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
  expect(take('training').soldiers[0].xp).toBe(2)
  expect(rank(take('veteran').soldiers[0])).toBe(3)
})

test('a soldier lands with its class\'s ability, and armor from its gear as armor', () => {
  const run = travelling(['battle'])
  run.soldiers[0].cls = 'heavy'
  run.gear.push({ id: 1, slot: 'armor', rarity: 'common', name: 'Sturdy Vest', stats: { armor: 2 }, effect: null })
  apply(run, { type: 'equip', soldier: run.soldiers[0].id, gear: 1 })
  apply(run, { type: 'advance' })
  apply(run, { type: 'land', zone: 0 })
  const [unit] = run.battle!.units.filter((u) => u.side === 'human')
  expect(unit).toMatchObject({ ability: 'rocket', charges: 1, stance: 'anchor', armor: 2 })
  expect(unit.hp).toBe(soldierStats(run, run.soldiers[0]).hp)
})
