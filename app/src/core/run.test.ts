import { expect, test } from 'vitest'
import { TUNING } from './tuning'
import { apply } from './apply'
import { isSoldier, BASE_STATS, type Side } from './battle'
import { CLASSES } from './classes'
import { EVENTS } from './events'
import { coverAgainst, odds } from './sight'
import {
  createRun,
  DROP_SUPPLIES,
  endBattle,
  FORKS,
  KEYS,
  LOSS_THREAT,
  missionAt,
  level,
  LEVEL_STATS,
  nextStop,
  RISKS,
  skillOffers,
  soldierStats,
  START_SUPPLIES,
  STOP_THREAT,
  THREAT_MAX,
  type Risk,
  type Run,
  type Soldier,
  type Stop,
  type StopKind,
  xpFor,
  XP,
  ZONE_STOPS,
  hire,
  dropGear,
  squadKeywords,
  GEAR_PRICE,
} from './run'
import { PATHS, SKILLS } from './skills'
import { RELICS } from './relics'

/** A run whose first clone has learned its first skill, so the overworld waits. */
function started(): Run {
  const run = createRun(1)
  run.soldiers[0].skills = [PATHS[run.soldiers[0].cls!][0].core]
  return run
}

/** A stop of `kind`; a battle sends one patrol. */
const stopOf = (kind: StopKind, risk: Risk = 'standard'): Stop => ({
  kind,
  risk,
  goal: 'exterminate',
  terrain: kind === 'key' ? 'compound' : 'town',
  twist: null,
  packs: kind === 'battle' ? [{ name: 'Patrol', kinds: ['trooper', 'trooper'] }] : [],
})

/** Takes the fork's first zone, made into one of the given stops, each of `risk`. */
function enter(run: Run, risk: Risk = 'standard', stops: StopKind[] = ['battle']) {
  const result = apply(run, { type: 'zone', index: 0 })
  run.zone = { stops: stops.map((kind) => stopOf(kind, risk)) }
  return result
}

/** A run travelling a zone of the given stops. */
function travelling(stops: StopKind[], risk: Risk = 'standard'): Run {
  const run = started()
  enter(run, risk, stops)
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

test('a run begins with one level 1 recruit on a path of its class, at a fork of three zones of three stops, each with a battle', () => {
  const run = createRun(1)
  expect(run.soldiers).toHaveLength(1)
  expect(level(run.soldiers[0])).toBe(1)
  expect(PATHS[run.soldiers[0].cls!].map((p) => p.core)).toContain(run.soldiers[0].skills[0])
  expect(run).toMatchObject({ phase: 'overworld', soldiers: [{ skills: [expect.anything()] }] })
  expect(run.zones).toHaveLength(3)
  for (const zone of run.zones) {
    expect(zone.stops).toHaveLength(ZONE_STOPS)
    expect(zone.stops.some((stop) => stop.kind === 'battle')).toBe(true)
  }
  expect(nextStop(run)).toBeNull()
  expect(apply(run, { type: 'advance' }).ok).toBe(false)
  const [first] = run.zones
  expect(apply(run, { type: 'zone', index: 0 })).toEqual({ ok: true })
  expect(run).toMatchObject({ zones: [], fork: 1, zone: first })
  expect(apply(run, { type: 'zone', index: 0 }).ok).toBe(false)
})

test.each(['safe', 'standard', 'dangerous'] as const)('a won battle in a %s zone adds threat, pays by the risk, gives experience, and gear its finder decides on', (risk) => {
  const run = travelling(['battle', 'battle'], risk)
  fight(run, 'human')
  expect(run).toMatchObject({ threat: STOP_THREAT, stop: 1 })
  expect(run.supplies).toBeGreaterThanOrEqual(START_SUPPLIES + RISKS[risk].supplies)
  expect(run.finds.length + run.decisions.length).toBe(RISKS[risk].drops)
  // The first find fills an empty slot, so its finder wears it without asking.
  if (RISKS[risk].drops > 0) expect(run.decisions[0]).toMatchObject({ soldier: run.soldiers[0].name, kept: true })
  if (RISKS[risk].rareGear) expect(run.decisions[0].gear.rarity).not.toBe('common')
  expect(run.report).toMatchObject({ stop: 'battle', won: true, threat: { before: 0, after: STOP_THREAT }, key: false, hired: null })
  const [report] = run.report!.soldiers
  expect(report).toMatchObject({ xpBefore: xpFor(1), downed: false })
  expect(report.earned).toEqual(expect.arrayContaining([{ label: 'survived', xp: XP.survived }, { label: 'won', xp: XP.won }]))
  expect(report.xpAfter - report.xpBefore).toBe(report.earned.reduce((sum, e) => sum + e.xp, 0))
  while (run.finds.length > 0) apply(run, { type: 'sell' })
  expect(run.phase).toBe('overworld')
})

test('a finder wears a find for an empty slot or a rarer one, sells a commoner or identical one, and asks only when they match', () => {
  const run = started()
  const rank = { common: 0, rare: 1, epic: 2 }
  for (let i = 0; i < 60; i++) {
    const before = structuredClone(run.soldiers[0].gear)
    dropGear(run, false)
    const decided = run.decisions.at(-1)
    if (run.finds.length > 0) {
      const { gear } = run.finds.pop()!
      expect(before[gear.slot]!.rarity).toBe(gear.rarity)
    } else if (decided!.kept) {
      expect(run.soldiers[0].gear[decided!.gear.slot]).toBe(decided!.gear)
      if (before[decided!.gear.slot]) expect(rank[decided!.gear.rarity]).toBeGreaterThan(rank[before[decided!.gear.slot]!.rarity])
    } else {
      const old = before[decided!.gear.slot]!
      if (old.rarity === decided!.gear.rarity) expect(decided!.gear).toMatchObject({ effect: old.effect, stats: old.stats })
      else expect(rank[decided!.gear.rarity]).toBeLessThan(rank[old.rarity])
    }
  }
})

test('a lost battle adds more threat and pays nothing; the fallen soldier is cloned anew with everything they had, but no experience', () => {
  const run = travelling(['battle', 'battle'])
  run.soldiers[0].gear.armor = { id: 1, slot: 'armor', rarity: 'common', name: 'Sturdy Vest', stats: { armor: 2 }, effect: null }
  const before = structuredClone(run.soldiers)
  fight(run, 'alien')
  expect(run).toMatchObject({ phase: 'overworld', threat: STOP_THREAT + LOSS_THREAT, supplies: START_SUPPLIES, stop: 1 })
  expect(run.soldiers).toEqual(before)
  expect(run.report!.soldiers).toMatchObject([{ downed: true, xpBefore: xpFor(1), xpAfter: xpFor(1), earned: [] }])
})

test('a supply drop and a cache are collected on arrival, each adding threat', () => {
  const run = travelling(['supply', 'cache', 'battle'])
  apply(run, { type: 'advance' })
  expect(run).toMatchObject({ phase: 'overworld', supplies: START_SUPPLIES + DROP_SUPPLIES, threat: STOP_THREAT, stop: 1 })
  expect(run.report).toMatchObject({ stop: 'supply', supplies: DROP_SUPPLIES, soldiers: [] })
  apply(run, { type: 'advance' })
  expect(run).toMatchObject({ report: { stop: 'cache' } })
  expect(run.decisions).toMatchObject([{ kept: true }])
  expect(run.threat).toBe(2 * STOP_THREAT)
})

test('after the forks of a leg comes its satellite: winning it wins a key, a new clone, and the next leg; losing it means fighting it again', () => {
  const run = started()
  for (let fork = 0; fork < FORKS; fork++) {
    enter(run, 'dangerous')
    fight(run, 'alien')
  }
  expect(run.zone).toMatchObject({ stops: [{ kind: 'key', terrain: 'compound' }] })
  fight(run, 'alien')
  expect(run).toMatchObject({ keys: 0, zone: { stops: [{ kind: 'key' }] }, stop: 0 })
  expect(run.soldiers).toHaveLength(1)
  run.threat = 0
  fight(run, 'human')
  expect(run).toMatchObject({ keys: 1, fork: 0, zone: null, phase: 'reward' })
  expect(run.soldiers).toHaveLength(2)
  expect(run.report).toMatchObject({ stop: 'key', key: true, hired: run.soldiers[1].name })
  expect([...run.finds, ...run.decisions].every((find) => find.gear.rarity !== 'common')).toBe(true)
  expect(run.zones).toHaveLength(3)
})

test("a new clone arrives a level 1 recruit on a path of its class, however seasoned the squad", () => {
  const run = started()
  run.soldiers[0].xp = xpFor(5)
  run.fork = FORKS
  run.zone = { stops: [stopOf('key')] }
  fight(run, 'human')
  const recruit = run.soldiers[1]
  expect(level(recruit)).toBe(1)
  expect(PATHS[recruit.cls!].map((p) => p.core)).toContain(recruit.skills[0])
  expect(skillOffers(recruit)).toEqual([])
})

test('experience follows what a soldier did: kills and damage its own, feats only the first time', () => {
  const run = travelling(['battle', 'battle', 'battle'])
  const [clone] = run.soldiers
  const battle = () => {
    apply(run, { type: 'advance' })
    apply(run, { type: 'land', zone: 0 })
    const b = run.battle!
    b.tally[clone.id] = { dealt: 12, kills: 3, taken: 4, feats: ['hatTrick'] }
    b.units = b.units.filter((u) => u.side === 'human')
    Object.assign(b, { phase: 'over', winner: 'human' })
    endBattle(run)
    while (run.finds.length > 0) apply(run, { type: 'sell' })
    return run.report!.soldiers[0]
  }
  const first = battle()
  expect(first.feats).toEqual(['hatTrick'])
  expect(first.earned).toEqual([
    { label: 'survived', xp: XP.survived },
    { label: 'won', xp: XP.won },
    { label: '3 kills', xp: 3 * XP.kill },
    { label: '12 damage', xp: Math.floor(12 / XP.damage) },
    { label: 'Hat Trick', xp: XP.feat },
  ])
  expect(battle().feats).toEqual([])
  expect(clone.feats).toEqual(['hatTrick'])
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
  const run = started()
  for (let key = 0; key < KEYS; key++) {
    run.fork = FORKS
    run.zone = { stops: [stopOf('key')] }
    run.threat = 0
    fight(run, 'human')
    apply(run, { type: 'relic', index: 0 })
    while (run.finds.length > 0) apply(run, { type: 'keep' })
    for (const s of run.soldiers) while (skillOffers(s).length > 0) apply(run, { type: 'skill', soldier: s.id, index: 0 })
    expect(run.phase).toBe('overworld')
  }
  expect(run.soldiers).toHaveLength(KEYS + 1)
  expect(run.relics).toHaveLength(KEYS)
  expect(run.zone).toMatchObject({ stops: [{ kind: 'final', terrain: 'hive' }] })
  run.threat = 0
  fight(run, winner)
  expect(run.phase).toBe(winner === 'human' ? 'won' : 'lost')
})

test('alien force follows the leg; an alien\'s health never grows, but deeper aliens wear armor', () => {
  const run = started()
  enter(run, 'standard')
  expect(missionAt(run, 'battle', 'standard').force).toBe(TUNING.legForce[0])
  apply(run, { type: 'advance' })
  const early = run.battle!.units.filter((u) => u.side === 'alien')
  expect(early.filter((u) => !u.target).every((u) => u.stats.armor === 0)).toBe(true)

  const late = started()
  late.keys = 2
  enter(late, 'standard')
  expect(missionAt(late, 'battle', 'standard').force).toBe(TUNING.legForce[2])
  apply(late, { type: 'advance' })
  const troopers = (units: typeof early) => units.filter((u) => u.kind === 'trooper' && !u.boss && !u.target)
  for (const alien of late.battle!.units.filter((u) => u.side === 'alien' && !u.target)) expect(alien.stats.armor).toBe(4)
  for (const trooper of troopers(late.battle!.units)) expect(trooper.stats.hp).toBe(Math.round(BASE_STATS.hp * TUNING.alienHp))
  for (const trooper of troopers(early)) expect(trooper.stats.hp).toBe(Math.round(BASE_STATS.hp * TUNING.alienHp))
})

test('a key mission has one boss, with an escort for each key already won', () => {
  for (const keys of [0, 2]) {
    const run = started()
    run.keys = keys
    run.fork = FORKS
    run.zone = { stops: [stopOf('key')] }
    apply(run, { type: 'advance' })
    const battle = run.battle!
    const boss = battle.units.filter((u) => u.boss)
    expect(boss).toHaveLength(1)
    expect(battle.units.filter((u) => u.pod === boss[0].pod)).toHaveLength(1 + keys)
    expect(boss[0].spawns).toBe(keys >= 1)
  }
})

const soldier = (extra: Partial<Soldier>): Soldier => ({ id: 0, name: '', xp: 0, cls: null, skills: [], feats: [], gear: { weapon: null, armor: null, utility: null }, ...extra })

test('stats add class, level, skills and relics to the base', () => {
  const run = createRun(1)
  run.relics = ['plasma']
  const stats = soldierStats(run, soldier({ xp: xpFor(2) }))
  expect(stats.hp).toBe(BASE_STATS.hp + 2 * LEVEL_STATS.hp!)
  expect(stats.damage).toBe(BASE_STATS.damage + 1)
  expect(stats.aim).toBeCloseTo(BASE_STATS.aim + 2 * LEVEL_STATS.aim!)
  expect(soldierStats(run, soldier({ xp: xpFor(2), cls: 'heavy' })).hp).toBe(stats.hp + CLASSES.heavy.stats.hp!)
  expect(soldierStats(run, soldier({ xp: xpFor(2), skills: ['sprinter'] })).move).toBe(stats.move + SKILLS.sprinter.stats!.move!)
  run.relics = ['plasma', 'glassCannon']
  expect(soldierStats(run, soldier({ xp: xpFor(2) })).damage).toBe(stats.damage + RELICS.glassCannon.stats!.damage!)
})

test('levels never stop: each takes more experience than the last', () => {
  for (let n = 1; n < 30; n++) {
    expect(level({ xp: xpFor(n) })).toBe(n)
    expect(level({ xp: xpFor(n + 1) - 1 })).toBe(n)
    expect(xpFor(n + 1) - xpFor(n)).toBeGreaterThan(xpFor(n) - xpFor(n - 1))
  }
})

test('a soldier chooses one of each pair along its path; past the last, levels add stats only', () => {
  const run = createRun(1)
  const [clone] = run.soldiers
  const other = PATHS[clone.cls!][1]
  clone.skills = [other.core]
  expect(skillOffers(clone)).toEqual([])
  // Two levels gained at once are chosen one after the other, along the path taken.
  clone.xp = xpFor(3)
  run.phase = 'reward'
  expect(skillOffers(clone)).toEqual(other.tiers[0])
  apply(run, { type: 'skill', soldier: clone.id, index: 0 })
  expect(skillOffers(clone)).toEqual(other.tiers[1])
  apply(run, { type: 'skill', soldier: clone.id, index: 1 })
  expect(clone.skills).toEqual([other.core, other.tiers[0][0], other.tiers[1][1]])
  clone.xp = xpFor(9)
  expect(skillOffers(clone)).toEqual([])
})

test('a satellite won offers three relics; a relic held changes the run', () => {
  const run = started()
  run.fork = FORKS
  run.zone = { stops: [stopOf('key')] }
  fight(run, 'human')
  expect(new Set(run.relicOffers).size).toBe(3)
  const taken = run.relicOffers[2]
  expect(apply(run, { type: 'relic', index: 2 })).toEqual({ ok: true })
  expect(run).toMatchObject({ relics: [taken], relicOffers: [] })

  const paid = (relics: Run['relics']) => {
    const r = travelling(['battle', 'battle'])
    r.relics = relics
    fight(r, 'human')
    return r
  }
  expect(paid(['drones']).supplies).toBe(paid([]).supplies + 1)
  expect(paid(['contact']).finds.every((find) => find.gear.rarity !== 'common')).toBe(true)
})

test('a shop stocks one-of-a-kind gear fitted to a soldier, relics the squad lacks, and a bribe, each sold once; and is left for the road', () => {
  const run = travelling(['shop', 'battle'])
  expect(apply(run, { type: 'gear', index: 0 })).toEqual({ ok: false, reason: 'not in a shop' })
  apply(run, { type: 'advance' })
  expect(run).toMatchObject({ phase: 'shop', threat: STOP_THREAT })
  const shop = run.shop!
  expect(shop.wares).toHaveLength(2)
  expect(new Set(shop.wares.map((w) => w.gear.effect)).size).toBe(2)
  expect(shop.wares.every((w) => w.gear.rarity !== 'common')).toBe(true)
  expect(shop.relics).toHaveLength(2)
  run.supplies = 100
  const { gear, soldier } = shop.wares[0]
  expect(apply(run, { type: 'gear', index: 0 })).toEqual({ ok: true })
  expect(run.soldiers.find((s) => s.id === soldier)!.gear[gear.slot]).toBe(gear)
  expect(run.supplies).toBe(100 - GEAR_PRICE[gear.rarity as keyof typeof GEAR_PRICE])
  expect(shop.wares).toHaveLength(1)
  const relic = shop.relics[1]
  expect(apply(run, { type: 'buy', index: 1 })).toEqual({ ok: true })
  expect(run.relics).toContain(relic)
  expect(apply(run, { type: 'buy', index: 1 }).ok).toBe(false)
  expect(apply(run, { type: 'bribe' })).toEqual({ ok: true })
  expect(run.threat).toBe(0)
  expect(apply(run, { type: 'bribe' }).ok).toBe(false)
  run.supplies = 0
  expect(apply(run, { type: 'gear', index: 0 })).toEqual({ ok: false, reason: 'not enough supplies' })
  apply(run, { type: 'leave' })
  expect(run).toMatchObject({ phase: 'overworld', shop: null, stop: 1 })
})

test('an unknown stop turns out a battle, a shop, or an event met once a run, whose options change the run', () => {
  const kinds = new Set<string>()
  for (let seed = 0; seed < 40; seed++) {
    const run = createRun(seed)
    run.soldiers[0].skills = [PATHS[run.soldiers[0].cls!][0].core]
    enter(run, 'standard', ['unknown', 'battle'])
    apply(run, { type: 'advance' })
    kinds.add(run.phase)
    if (run.phase === 'event') {
      expect(run.met).toEqual([run.event])
      expect(apply(run, { type: 'choose', index: EVENTS[run.event!].options.length - 1 })).toEqual({ ok: true })
      expect(run).toMatchObject({ event: null, stop: 1 })
    }
  }
  expect([...kinds].sort()).toEqual(['battle', 'event', 'shop'])
})

test('every event offers a real choice, ending in one the squad can always take, and no two options say the same', () => {
  const options = Object.values(EVENTS).flatMap((event) => {
    expect(event.options.length).toBeGreaterThan(1)
    expect(event.options.at(-1)!.can).toBeUndefined()
    return event.options.map((o) => o.quip)
  })
  expect(new Set(options).size).toBe(options.length)
})

test('the Smugglers\' Tunnel skips the rest of the zone; refusing the Raiders makes the next stop an Overrun battle', () => {
  const run = started()
  run.zone = { stops: [stopOf('unknown'), stopOf('supply'), stopOf('cache')] }
  run.event = 'tunnel'
  run.phase = 'event'
  apply(run, { type: 'choose', index: 0 })
  expect(run.zone).toBeNull()
  run.zone = { stops: [stopOf('unknown'), stopOf('supply')] }
  run.stop = 0
  run.event = 'raiders'
  run.phase = 'event'
  apply(run, { type: 'choose', index: 0 })
  expect(run.zone.stops[1]).toMatchObject({ kind: 'battle', risk: 'dangerous' })
})

test('doctrines change the run: Lone Wolf leaves one soldier and stops recruits; Specialists give every soldier its own class', () => {
  const run = started()
  for (let i = 0; i < 3; i++) hire(run)
  run.event = 'instructor'
  run.phase = 'event'
  run.zone = { stops: [stopOf('battle')] }
  const levels = run.soldiers.map(level)
  apply(run, { type: 'choose', index: 0 })
  expect(new Set(run.soldiers.map((s) => s.cls)).size).toBe(4)
  expect(run.soldiers.map(level)).toEqual(levels.map((l) => l + 1))
  expect(run.doctrines).toEqual(['specialists'])

  const wolf = started()
  hire(wolf)
  const hp = soldierStats(wolf, wolf.soldiers[0]).hp
  Object.assign(wolf, { event: 'survivor', phase: 'event', zone: { stops: [stopOf('battle')] } })
  apply(wolf, { type: 'choose', index: 0 })
  expect(wolf.soldiers).toHaveLength(1)
  expect(soldierStats(wolf, wolf.soldiers[0]).hp).toBe(hp + 40)
  wolf.zone = { stops: [stopOf('key')] }
  fight(wolf, 'human')
  expect(wolf.soldiers).toHaveLength(1)
})

test('under exosuits cover shields aliens but not soldiers; fortification makes every cover count for more', () => {
  const run = travelling(['battle'])
  apply(run, { type: 'advance' })
  apply(run, { type: 'land', zone: 0 })
  const battle = run.battle!
  const soldier = battle.units.find(isSoldier)!
  const alien = battle.units.find((u) => u.side === 'alien')!
  const cover = (unit: typeof soldier) => coverAgainst(battle, unit, unit === soldier ? alien : soldier)
  const hit = (from: typeof soldier, to: typeof soldier) => odds(battle, from, to, from.stats).hit
  const plain = [hit(alien, soldier), hit(soldier, alien)]
  battle.rules = ['fortified']
  if (cover(soldier) > 0) expect(hit(alien, soldier)).toBeLessThan(plain[0])
  battle.rules = ['exosuits']
  expect(hit(alien, soldier)).toBeGreaterThanOrEqual(plain[0])
  expect(hit(soldier, alien)).toBe(plain[1])
})

test("a soldier lands with its class's ability and its uses, the effects of its skills and the squad's relics, and armor from its gear", () => {
  const run = travelling(['battle'])
  run.soldiers[0].cls = 'heavy'
  run.soldiers[0].gear.armor = { id: 1, slot: 'armor', rarity: 'common', name: 'Sturdy Vest', stats: { armor: 2 }, effect: null }
  run.soldiers[0].skills = ['arsenal', 'shredder']
  run.relics = ['echo', 'capacitor']
  apply(run, { type: 'advance' })
  run.battle!.boons[0] = 'crit'
  apply(run, { type: 'land', zone: 0 })
  const [unit] = run.battle!.units.filter(isSoldier)
  expect(unit).toMatchObject({ ability: 'rocket', charges: 3, stance: 'anchor', armor: 2, effects: ['shred', 'opener'] })
  expect(unit.hp).toBe(soldierStats(run, run.soldiers[0]).hp)
})

test("the first relic offered shares a keyword with the squad's skills, gear or relics", () => {
  for (let seed = 1; seed <= 5; seed++) {
    const run = started()
    run.rng = seed
    run.soldiers[0].skills = ['mark']
    run.fork = FORKS
    run.zone = { stops: [stopOf('key')] }
    fight(run, 'human')
    expect(RELICS[run.relicOffers[0]].tags!.some((tag) => squadKeywords(run).includes(tag))).toBe(true)
  }
})
