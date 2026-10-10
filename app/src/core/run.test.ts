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
  level,
  LEVEL_STATS,
  nextStop,
  RISKS,
  soldierStats,
  START_SUPPLIES,
  STOP_THREAT,
  THREAT_MAX,
  type Risk,
  type Run,
  type Soldier,
  type StopKind,
  xpFor,
} from './run'
import { CLASS_SKILLS, SKILL_OFFERS, SKILLS } from './skills'
import { RELICS } from './relics'

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
  expect(level(run.soldiers[0])).toBe(1)
  expect(run.soldiers[0].cls).not.toBeNull()
  expect(run.soldiers[0]).toMatchObject({ skills: [], picks: 1 })
  expect(run.soldiers[0].offers).toHaveLength(SKILL_OFFERS)
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

test("a new clone arrives at the level of the squad's lowest, and one higher for each academy, with a skill to choose for each level", () => {
  const arrival = (academies: number) => {
    const run = createRun(1)
    run.soldiers[0].xp = xpFor(3)
    run.built = Array(academies).fill('academy')
    run.fork = FORKS
    run.zone = { risk: 'standard', terrain: 'compound', stops: ['key'] }
    fight(run, 'human')
    return run.soldiers[1]
  }
  expect(level(arrival(0))).toBe(3)
  expect(level(arrival(1))).toBe(4)
  expect(arrival(0)).toMatchObject({ picks: 3 })
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
    apply(run, { type: 'relic', index: 0 })
    apply(run, { type: 'pick', index: 0 })
  }
  expect(run.soldiers).toHaveLength(KEYS + 1)
  expect(run.relics).toHaveLength(KEYS)
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

const soldier = (extra: Partial<Soldier>): Soldier => ({ id: 0, name: '', xp: 0, cls: null, skills: [], picks: 0, offers: [], gear: { weapon: null, armor: null, utility: null }, ...extra })

test('stats add class, level, skills, facilities and relics to the base', () => {
  const run = createRun(1)
  run.built = ['workshop', 'workshop']
  run.relics = ['plasma']
  const stats = soldierStats(run, soldier({ xp: xpFor(2) }))
  expect(stats.hp).toBe(BASE_STATS.hp + 2 + 2 + 2 * LEVEL_STATS.hp!)
  expect(stats.damage).toBe(BASE_STATS.damage + 1)
  expect(stats.aim).toBeCloseTo(BASE_STATS.aim + 2 * LEVEL_STATS.aim!)
  expect(soldierStats(run, soldier({ xp: xpFor(2), cls: 'heavy' })).hp).toBe(stats.hp + CLASSES.heavy.stats.hp!)
  expect(soldierStats(run, soldier({ xp: xpFor(2), skills: ['sprinter'] })).move).toBe(stats.move + SKILLS.sprinter.stats!.move!)
  run.relics = ['plasma', 'glassCannon']
  expect(soldierStats(run, soldier({ xp: xpFor(2) })).damage).toBe(stats.damage + RELICS.glassCannon.stats!.damage!)
})

test('levels never stop: each takes one more battle than the last', () => {
  expect([0, 1, 2, 3, 6, 10, 15, 21, 28].map((xp) => level({ xp }))).toEqual([0, 1, 1, 2, 3, 4, 5, 6, 7])
  for (let n = 1; n < 30; n++) expect(level({ xp: xpFor(n) })).toBe(n)
})

test('each level gained offers three skills of the class; choosing one learns it and offers the next owed', () => {
  const run = createRun(1)
  const [clone] = run.soldiers
  const pool = CLASS_SKILLS[clone.cls!]
  expect(clone.offers.every((id) => pool.includes(id))).toBe(true)
  expect(new Set(clone.offers).size).toBe(SKILL_OFFERS)
  const first = clone.offers[1]
  expect(apply(run, { type: 'skill', soldier: clone.id, index: 1 })).toEqual({ ok: true })
  expect(clone).toMatchObject({ skills: [first], picks: 0, offers: [] })
  expect(apply(run, { type: 'skill', soldier: clone.id, index: 0 }).ok).toBe(false)
  // The next level offers again, never a skill already known.
  run.phase = 'reward'
  run.offers = ['training']
  clone.xp = xpFor(3) - 1
  apply(run, { type: 'pick', index: 0 })
  expect(level(clone)).toBe(3)
  expect(clone.picks).toBe(1)
  expect(clone.offers).not.toContain(first)
  // Owed two at once, the second is offered when the first is chosen.
  clone.picks = 2
  apply(run, { type: 'skill', soldier: clone.id, index: 0 })
  expect(clone.picks).toBe(1)
  expect(clone.offers.length).toBeGreaterThan(0)
  expect(clone.offers.some((id) => clone.skills.includes(id))).toBe(false)
  // With every skill of the class known, nothing more is owed.
  clone.skills = [...pool]
  clone.picks = 0
  clone.offers = []
  clone.xp = xpFor(9) - 1
  run.phase = 'reward'
  run.offers = ['training']
  apply(run, { type: 'pick', index: 0 })
  expect(clone).toMatchObject({ picks: 0, offers: [] })
})

test('a satellite won offers three relics before the aid; a relic held changes the run', () => {
  const run = createRun(1)
  run.fork = FORKS
  run.zone = { risk: 'standard', terrain: 'compound', stops: ['key'] }
  fight(run, 'human')
  expect(new Set(run.relicOffers).size).toBe(3)
  expect(apply(run, { type: 'pick', index: 0 })).toEqual({ ok: false, reason: 'choose a relic first' })
  const taken = run.relicOffers[2]
  expect(apply(run, { type: 'relic', index: 2 })).toEqual({ ok: true })
  expect(run).toMatchObject({ relics: [taken], relicOffers: [], phase: 'reward' })
  expect(apply(run, { type: 'pick', index: 0 })).toEqual({ ok: true })

  const paid = (relics: Run['relics']) => {
    const r = travelling(['battle', 'battle'])
    r.relics = relics
    fight(r, 'human')
    return r
  }
  expect(paid(['drones']).supplies).toBe(paid([]).supplies + 1)
  expect(paid(['contact']).gear.every((gear) => gear.rarity !== 'common')).toBe(true)
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
  expect(level(take('veteran').soldiers[0])).toBe(2)
})

test("a soldier lands with its class's ability and its uses, the effects of its skills and the squad's relics, and armor from its gear", () => {
  const run = travelling(['battle'])
  run.soldiers[0].cls = 'heavy'
  run.gear.push({ id: 1, slot: 'armor', rarity: 'common', name: 'Sturdy Vest', stats: { armor: 2 }, effect: null })
  apply(run, { type: 'equip', soldier: run.soldiers[0].id, gear: 1 })
  run.soldiers[0].skills = ['arsenal', 'shredder']
  run.relics = ['echo', 'capacitor']
  apply(run, { type: 'advance' })
  apply(run, { type: 'land', zone: 0 })
  const [unit] = run.battle!.units.filter((u) => u.side === 'human')
  expect(unit).toMatchObject({ ability: 'rocket', charges: 3, stance: 'anchor', armor: 2, effects: ['shred', 'opener'] })
  expect(unit.hp).toBe(soldierStats(run, run.soldiers[0]).hp)
})
