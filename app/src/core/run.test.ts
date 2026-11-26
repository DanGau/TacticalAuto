import { GOALS } from './goals'
import { WEAPONS } from './weapons'
import { expect, test } from 'vitest'
import { TUNING } from './tuning'
import { apply } from './apply'
import { isSoldier, BASE_STATS, type Side } from './battle'
import { CLASSES } from './classes'
import { EVENTS, MEDKIT } from './events'
import { HUB } from './world'
import { OPENING } from './progress'
import {
  createRun,
  DROP_SUPPLIES,
  KEYS,
  nextStop,
  START_SUPPLIES,
  current,
  legOf,
  ways,
} from './run'
import { type Run } from './run-state'
import { type Soldier } from './run-state'
import { type Stop } from './run-state'
import { type StopKind } from './run-state'
import { type Risk } from './run-state'
import { endBattle } from './debrief'
import { HUNTER, missionAt } from './missions'
import { RISKS } from './missions'
import { dropGear } from './rewards'
import { SELL } from './rewards'
import { SHOP_RELICS } from './rewards'
import { SHOP_OTHER_WEAPONS, SHOP_WARES } from './rewards'
import { GEAR_PRICE } from './rewards'
import { makes, reads } from './hero'
import { feeds } from './quantities'
import { CANDIDATES } from './hero'
import { HERO_HP, soldierStats } from './hero'
import { health } from './hero'
import { STOP_THREAT } from './progress'
import { THREAT_MAX } from './progress'
import { LEG_STOPS } from './progress'
import { REST_COLUMNS } from './progress'
import { atKey, road, enterAt, begun } from './roads'
import { RELICS } from './relics'
import { CARDS } from './cards'
import { OFFERS } from './deck'
import { CARD_PRICE, REMOVE_PRICE } from './rewards'

/** A run under way, the overworld waiting. */
const started = (): Run => begun(1)

/** A stop of `kind`; a battle sends one patrol. */
const stopOf = (kind: StopKind, risk: Risk = 'standard'): Stop => ({
  kind,
  risk,
  goal: 'cross',
  terrain: kind === 'key' ? 'compound' : 'town',
  challenge: null,
  twist: null,
  aliens: kind === 'battle' ? ['trooper', 'trooper'] : [],
})

/** Goes on to a road of the given stops, each of `risk`. */
function enter(run: Run, risk: Risk = 'standard', stops: StopKind[] = ['battle']) {
  const result = apply(run, { type: 'go', index: 0 })
  road(run, stops.map((kind) => stopOf(kind, risk)))
  return result
}

/** A run travelling a road of the given stops. */
function travelling(stops: StopKind[], risk: Risk = 'standard'): Run {
  const run = started()
  enter(run, risk, stops)
  return run
}

/** Takes the first way on, if the hero has passed its stop. */
function onward(run: Run): void {
  if (!current(run)) apply(run, { type: 'go', index: ways(run)[0] })
}

/** Travels to the next stop, a battle, and ends it with `winner`: the losing side is down to the last unit. */
function fight(run: Run, winner: Side): void {
  onward(run)
  apply(run, { type: 'advance' })
  // Clear of Danger Close, which costs threat.
  if (run.battle!.phase === 'deploy') enterAt(run)
  const battle = run.battle!
  for (const u of battle.units.filter((u) => isSoldier(u) && winner === 'alien')) battle.downed.push({ soldier: u.soldier!, x: u.x, y: u.y })
  battle.units = battle.units.filter((u) => u.side === winner)
  battle.phase = 'over'
  battle.winner = winner
  endBattle(run)
  // The cards offered are skipped.
  if (run.cardOffers.length > 0) apply(run, { type: 'card', index: null })
}

test('a run begins with its hero choosing where to start among the battles of its first leg', () => {
  const run = begun(1)
  expect(run.phase).toBe('overworld')
  const leg = legOf(run)
  expect(leg.columns).toHaveLength(LEG_STOPS + 1)
  expect(leg.columns[0].length).toBeGreaterThan(1)
  expect(leg.columns[0].every((node) => node.stop!.kind === 'battle')).toBe(true)
  expect(leg.columns.at(-1)).toMatchObject([{ stop: { kind: 'key', terrain: 'compound' } }])
  expect(nextStop(run)).toBeNull()
  expect(apply(run, { type: 'advance' }).ok).toBe(false)
  expect(apply(run, { type: 'go', index: 0 })).toEqual({ ok: true })
  expect(current(run)).toBe(leg.columns[0][0])
  expect(apply(run, { type: 'go', index: 0 }).ok).toBe(false)
})

test('a leg is a map of trails that part and meet without crossing; every way through is its stops then the satellite, and legs ahead are blank', () => {
  for (let seed = 1; seed <= 20; seed++) {
    const run = begun(seed)
    for (const leg of run.legs.slice(0, -1)) {
      const { columns } = leg
      expect(columns).toHaveLength(LEG_STOPS + 1)
      columns.slice(0, -1).forEach((column, c) => {
        expect(column.length).toBeLessThanOrEqual(4)
        for (const node of column) expect(node.next.length).toBeGreaterThan(0)
        // Each stop is reached from the column before.
        if (c > 0) column.forEach((_, i) => expect(columns[c - 1].some((n) => n.next.includes(i))).toBe(true))
        for (const a of column) for (const b of column) if (a.row < b.row) for (const x of a.next) for (const y of b.next) expect(columns[c + 1][x].row).toBeLessThanOrEqual(columns[c + 1][y].row)
      })
      expect(new Set(columns.map((column) => column.length)).size).toBeGreaterThan(1)
    }
    expect(run.legs.slice(1).every((leg) => leg.columns.flat().every((node) => node.stop === null))).toBe(true)
  }
})

test.each(['safe', 'standard', 'dangerous'] as const)('a won battle in a %s zone adds threat, pays by the risk, gives gear for the player to hand out, and relics if Overrun', (risk) => {
  const run = travelling(['battle', 'battle'], risk)
  fight(run, 'human')
  expect(run).toMatchObject({ threat: STOP_THREAT, stop: 1 })
  expect(run.supplies).toBeGreaterThanOrEqual(START_SUPPLIES + RISKS[risk].supplies)
  expect(run.finds.length).toBeLessThanOrEqual(1)
  if (RISKS[risk].gear !== 0.5) expect(run.finds).toHaveLength(RISKS[risk].gear)
  if (RISKS[risk].rareGear) expect(run.finds[0].rarity).not.toBe('common')
  expect(run.report).toMatchObject({ stop: 'battle', won: true, threat: { before: 0, after: STOP_THREAT }, key: false })
  expect(run.report!.hero).toMatchObject({ maxHp: soldierStats(run, run.hero).hp })
  while (run.finds.length > 0) apply(run, { type: 'sell', find: 0 })
  // An Overrun battle won offers relics too.
  expect(run.relicOffers).toHaveLength(risk === 'dangerous' ? 3 : 0)
  if (risk === 'dangerous') apply(run, { type: 'relic', index: 0 })
  expect(run.phase).toBe('overworld')
})

test("a find is a piece of the hero's weapon: equipped, replacing and discarding what it held, or sold; nothing is taken off", () => {
  const run = started()
  expect(run.hero.gear).toMatchObject({ rarity: 'common' })
  dropGear(run, false)
  dropGear(run, false)
  const [gear] = run.finds
  const supplies = run.supplies
  run.phase = 'reward'
  expect(gear.weapon).toBe(run.hero.gear!.weapon)
  expect(apply(run, { type: 'equip', find: 0 })).toEqual({ ok: true })
  expect(run.hero.gear).toBe(gear)
  expect(run.supplies).toBe(supplies)
  const [other] = run.finds
  expect(apply(run, { type: 'sell', find: 0 })).toEqual({ ok: true })
  expect(run.supplies).toBe(supplies + SELL[other.rarity])
  expect(run).toMatchObject({ finds: [] })
})

test('the hero falling in a battle on the road loses the run', () => {
  const run = travelling(['battle', 'battle'])
  fight(run, 'alien')
  expect(run.phase).toBe('lost')
  expect(run.report!.hero).toMatchObject({ hp: 0 })
})

test('the hero falling at a satellite loses the run', () => {
  const run = started()
  atKey(run)
  fight(run, 'alien')
  expect(run.phase).toBe('lost')
})

test('a supply drop and a cache are collected on arrival, each adding threat', () => {
  const run = travelling(['supply', 'cache', 'battle'])
  apply(run, { type: 'advance' })
  expect(run).toMatchObject({ phase: 'overworld', supplies: START_SUPPLIES + DROP_SUPPLIES, threat: STOP_THREAT, stop: 1 })
  expect(run.report).toMatchObject({ stop: 'supply', supplies: DROP_SUPPLIES, hero: null })
  onward(run)
  apply(run, { type: 'advance' })
  expect(run).toMatchObject({ report: { stop: 'cache' } })
  expect(run.finds).toHaveLength(1)
  expect(run.threat).toBe(2 * STOP_THREAT)
})

test('every stop on the way across a continent is at a real town, none twice', () => {
  for (let seed = 0; seed < 20; seed++) {
    const run = begun(seed)
    for (const leg of run.legs.slice(0, KEYS)) {
      const towns = leg.columns.flat().map((node) => node.town)
      expect(towns.every((town) => town !== null)).toBe(true)
      expect(new Set(towns).size).toBe(towns.length)
    }
  }
})

test('the hero keeps its health between battles and heals nothing on the road', () => {
  const run = travelling(['battle', 'battle', 'battle'])
  const hero = run.hero
  const most = soldierStats(run, hero).hp
  apply(run, { type: 'advance' })
  enterAt(run)
  const battle = run.battle!
  battle.units.find((u) => u.soldier === hero.id)!.hp = 3
  battle.units = battle.units.filter((u) => u.side === 'human')
  Object.assign(battle, { phase: 'over', winner: 'human' })
  endBattle(run)
  run.phase = 'overworld'
  expect(health(run, hero)).toBe(3)
  expect(run.report!.hero).toMatchObject({ hp: 3, maxHp: most })
  onward(run)
  apply(run, { type: 'advance' })
  expect(run.battle!.reserve[0].hp).toBe(3)
})

test('every stop in a rest column is a safehouse, and no other is', () => {
  for (let seed = 0; seed < 20; seed++) {
    const leg = begun(seed).legs[0]
    leg.columns.slice(0, LEG_STOPS).forEach((column, c) => expect(column.every((n) => (n.stop!.kind === 'safehouse') === REST_COLUMNS.includes(c))).toBe(true))
  }
})

test('after the stops of a leg comes its satellite: winning it wins a key and the next leg', () => {
  const run = started()
  enter(run, 'safe', ['battle', 'battle'])
  for (let i = 0; i < 2; i++) {
    fight(run, 'human')
  }
  onward(run)
  expect(current(run)!.stop).toMatchObject({ kind: 'key', terrain: 'compound' })
  expect(nextStop(run)).toBe('key')
  run.threat = 0
  fight(run, 'human')
  expect(run).toMatchObject({ keys: 1, stop: 0, phase: 'reward' })
  expect(current(run)).toBeNull()
  expect(run.report).toMatchObject({ stop: 'key', key: true })
  expect(run.finds.every((find) => find.rarity !== 'common')).toBe(true)
  expect(legOf(run).columns.flat().every((node) => node.stop !== null)).toBe(true)
})

test('each leg crosses a continent to a satellite in one of its cities; the last leads to the hub', () => {
  const run = started()
  expect(run.route).toHaveLength(KEYS + 1)
  expect(new Set(run.route.slice(0, KEYS).map((stage) => stage.continent)).size).toBe(KEYS)
  expect(run.route[KEYS].to).toBe(HUB)
})


test('an ambush has no landing: the hero is down at once, every posted alien in the fight, more coming, the Hunter stronger than its best soldier by HUNTER', () => {
  const run = travelling(['battle', 'battle'])
  run.threat = THREAT_MAX
  apply(run, { type: 'advance' })
  const battle = run.battle!
  expect(battle).toMatchObject({ goal: 'ambush', phase: 'battle', flow: 'flood' })
  expect(battle.units.filter(isSoldier)).toHaveLength(1)
  for (const u of battle.units.filter((a) => a.side === 'alien')) expect(u.engaged).toBe(true)
  const hunter = battle.units.find((u) => u.boss)!.stats
  const best = soldierStats(run, run.hero)
  expect(hunter.hp * hunter.damage).toBeGreaterThanOrEqual(0.9 * HUNTER.hp * HUNTER.damage * best.hp * best.damage)
  expect(hunter.hp * hunter.damage).toBeLessThanOrEqual(1.15 * HUNTER.hp * HUNTER.damage * best.hp * best.damage)
})

test.each(['human', 'alien'] as const)('full threat puts an ambush before the next stop; %s win', (winner) => {
  const run = travelling(['battle', 'battle'])
  run.threat = THREAT_MAX
  expect(nextStop(run)).toBe('ambush')
  fight(run, winner)
  expect(run.report!.stop).toBe('ambush')
  if (winner === 'alien') return expect(run.phase).toBe('lost')
  expect(run).toMatchObject({ phase: 'reward', threat: 0, stop: 0 })
  expect(nextStop(run)).toBe('battle')
})

test.each(['human', 'alien'] as const)('with every key won only the final mission remains, and it decides the run; %s win', (winner) => {
  const run = started()
  for (let key = 0; key < KEYS; key++) {
    atKey(run)
    run.threat = 0
    fight(run, 'human')
    apply(run, { type: 'relic', index: 0 })
    while (run.finds.length > 0) apply(run, { type: 'equip', find: 0 })
    expect(run.phase).toBe('overworld')
  }
  expect(run.relics).toHaveLength(KEYS)
  onward(run)
  expect(current(run)!.stop).toMatchObject({ kind: 'final', terrain: 'hive' })
  run.threat = 0
  fight(run, winner)
  expect(run.phase).toBe(winner === 'human' ? 'won' : 'lost')
})

test('alien force follows the leg; an alien\'s health never grows, but deeper aliens wear armor', () => {
  const run = started()
  enter(run, 'standard')
  const m0 = missionAt(run, 'battle', 'standard')
  expect(m0.force).toBe(TUNING.legForce[0] + GOALS[m0.goal].force)
  apply(run, { type: 'advance' })
  const early = run.battle!.units.filter((u) => u.side === 'alien')
  expect(early.filter((u) => !u.target).every((u) => u.stats.armor === 0)).toBe(true)

  const late = started()
  late.keys = 2
  enter(late, 'standard')
  const m2 = missionAt(late, 'battle', 'standard')
  expect(m2.force).toBe(TUNING.legForce[2] + GOALS[m2.goal].force)
  apply(late, { type: 'advance' })
  const troopers = (units: typeof early) => units.filter((u) => u.kind === 'trooper' && !u.boss && !u.target)
  for (const trooper of troopers(late.battle!.units)) expect(trooper.stats.armor).toBe(2)
  for (const trooper of troopers(late.battle!.units)) expect(trooper.stats.hp).toBe(Math.round(BASE_STATS.hp * TUNING.alienHp))
  for (const trooper of troopers(early)) expect(trooper.stats.hp).toBe(Math.round(BASE_STATS.hp * TUNING.alienHp))
})

test('a key mission has one boss, with an escort for each key already won', () => {
  for (const keys of [0, 2]) {
    const run = started()
    run.keys = keys
    atKey(run)
    apply(run, { type: 'advance' })
    const battle = run.battle!
    const boss = battle.units.filter((u) => u.boss)
    expect(boss).toHaveLength(1)
    expect(battle.units.filter((u) => u.side === 'alien').length).toBeGreaterThanOrEqual(1 + keys)
    expect(boss[0].spawns).toBe(keys >= 1)
  }
})

const soldier = (extra: Partial<Soldier>): Soldier => ({ id: 0, name: '', cls: null, gear: null, home: HUB, wounds: 0, ...extra })

test('max HP comes from the hero, relics and events, never from class; stats add class movement and relics to the base', () => {
  const run = begun(1)
  run.relics = ['plasma']
  const stats = soldierStats(run, soldier({}))
  expect(stats.hp).toBe(HERO_HP)
  expect(stats.damage).toBe(BASE_STATS.damage + 1)
  expect(soldierStats(run, soldier({ cls: 'heavy' })).hp).toBe(HERO_HP)
  expect(soldierStats(run, soldier({ cls: 'assault' })).move).toBe(stats.move + CLASSES.assault.stats.move!)
  run.relics = ['plasma', 'glassCannon']
  expect(soldierStats(run, soldier({})).damage).toBe(stats.damage + RELICS.glassCannon.stats!.damage!)
  expect(soldierStats(run, soldier({})).hp).toBe(HERO_HP + RELICS.glassCannon.stats!.hp!)
  run.maxHp = 4
  expect(soldierStats(run, soldier({})).hp).toBe(HERO_HP + RELICS.glassCannon.stats!.hp! + 4)
})

test('a satellite won offers three relics; a relic held changes the run', () => {
  const run = started()
  atKey(run)
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
  expect(paid(['contact']).finds.every((find) => find.rarity !== 'common')).toBe(true)
})

test("a shop stocks one-of-a-kind gear, each piece one hero's weapon, relics the hero lacks, cards, removing a card, and a medkit, each sold once and kept in its place; and is left for the road", () => {
  const run = travelling(['shop', 'battle'])
  expect(apply(run, { type: 'gear', index: 0 })).toEqual({ ok: false, reason: 'not in a shop' })
  apply(run, { type: 'advance' })
  expect(run).toMatchObject({ phase: 'shop', threat: STOP_THREAT })
  const shop = run.shop!
  expect(shop.wares).toHaveLength(SHOP_WARES)
  expect(new Set(shop.wares.map((w) => w.gear.effect)).size).toBe(SHOP_WARES)
  expect(shop.wares.every((w) => w.gear.rarity !== 'common')).toBe(true)
  expect(shop.relics).toHaveLength(SHOP_RELICS)
  run.supplies = 100
  const { gear } = shop.wares[0]
  expect(apply(run, { type: 'gear', index: 0 })).toEqual({ ok: true })
  expect(new Set(shop.wares.map((w) => w.gear.weapon)).size).toBe(1 + SHOP_OTHER_WEAPONS)
  expect(run.hero.gear).toBe(gear)
  expect(run.supplies).toBe(100 - GEAR_PRICE[gear.rarity as keyof typeof GEAR_PRICE])
  expect(shop.wares).toHaveLength(SHOP_WARES)
  expect(shop.wares[0]).toEqual({ gear, sold: true })
  expect(apply(run, { type: 'gear', index: 0 }).ok).toBe(false)
  const last = SHOP_RELICS - 1
  const relic = shop.relics[last].id
  expect(apply(run, { type: 'buy', index: last })).toEqual({ ok: true })
  expect(run.relics).toContain(relic)
  expect(shop.relics[last]).toEqual({ id: relic, sold: true })
  expect(apply(run, { type: 'buy', index: last }).ok).toBe(false)
  expect(new Set(shop.cards.map((c) => c.id)).size).toBe(OFFERS)
  const before = { supplies: run.supplies, deck: run.deck.length }
  expect(apply(run, { type: 'buyCard', index: 0 })).toEqual({ ok: true })
  expect(run.deck.at(-1)).toEqual({ id: shop.cards[0].id, level: 1 })
  expect(run.supplies).toBe(before.supplies - CARD_PRICE[CARDS[shop.cards[0].id].rarity])
  expect(apply(run, { type: 'buyCard', index: 0 }).ok).toBe(false)
  const removed = run.deck[0]
  expect(apply(run, { type: 'remove', index: 0 })).toEqual({ ok: true })
  expect(run.deck).toHaveLength(before.deck)
  expect(run.deck).not.toContain(removed)
  expect(run.supplies).toBe(before.supplies - CARD_PRICE[CARDS[shop.cards[0].id].rarity] - REMOVE_PRICE)
  expect(apply(run, { type: 'remove', index: 0 }).ok).toBe(false)
  run.hero.wounds = 6
  expect(apply(run, { type: 'medkit' })).toEqual({ ok: true })
  expect(run.hero.wounds).toBe(6 - MEDKIT.heal)
  expect(apply(run, { type: 'medkit' }).ok).toBe(false)
  run.supplies = 0
  expect(apply(run, { type: 'gear', index: 1 })).toEqual({ ok: false, reason: 'not enough supplies' })
  apply(run, { type: 'leave' })
  expect(run).toMatchObject({ phase: 'overworld', shop: null, stop: 1 })
})

test('an unknown stop turns out a battle, a shop, or an event met once a run, whose options change the run', () => {
  const kinds = new Set<string>()
  for (let seed = 0; seed < 40; seed++) {
    const run = begun(seed)
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

test('every event offers a real choice, ending in one the hero can always take, and no two options say the same', () => {
  const options = Object.values(EVENTS).flatMap((event) => {
    expect(event.options.length).toBeGreaterThan(1)
    expect(event.options.at(-1)!.can).toBeUndefined()
    return event.options.map((o) => o.quip)
  })
  expect(new Set(options).size).toBe(options.length)
})

test('the Smugglers\' Tunnel skips the next two stops and comes out anywhere in the third; refusing the Raiders makes every next stop an Overrun battle', () => {
  const run = started()
  apply(run, { type: 'go', index: 0 })
  run.event = 'tunnel'
  run.phase = 'event'
  apply(run, { type: 'choose', index: 0 })
  expect(run.stop).toBe(3)
  const column = legOf(run).columns[3]
  if (column.length > 1) expect(ways(run)).toEqual(column.map((_, i) => i))

  const raided = started()
  apply(raided, { type: 'go', index: 0 })
  const next = current(raided)!.next
  raided.event = 'raiders'
  raided.phase = 'event'
  apply(raided, { type: 'choose', index: 0 })
  for (const i of next) expect(legOf(raided).columns[1][i].stop).toMatchObject({ kind: 'battle', risk: 'dangerous' })
})

test("a soldier lands with its stance and the effects of its gear and the hero's relics", () => {
  const run = travelling(['battle'])
  run.hero.cls = 'heavy'
  run.hero.gear = { id: 0, rarity: 'rare', name: 'Seeking Rifle', weapon: 'rifle', stats: {}, effect: 'tracer' }
  run.relics = ['capacitor']
  apply(run, { type: 'advance' })
  enterAt(run)
  const [unit] = run.battle!.units.filter(isSoldier)
  expect(unit).toMatchObject({ stance: 'anchor', effects: ['tracer', 'opener'] })
  expect(unit.hp).toBe(soldierStats(run, run.hero).hp)
})

test('the first relic offered reads a quantity the hero makes, or makes one it reads', () => {
  for (let seed = 1; seed <= 5; seed++) {
    const run = started()
    run.rng = seed
    run.deck.push({ id: 'calledShot', level: 1 })
    atKey(run)
    fight(run, 'human')
    expect(feeds(RELICS[run.relicOffers[0]], makes(run), reads(run))).toBe(true)
  }
})

test('a run begins with a choice of heroes of different classes, each with a common weapon', () => {
  for (let seed = 1; seed <= 20; seed++) {
    const run = createRun(seed)
    expect(run.phase).toBe('select')
    expect(new Set(run.candidates.map((r) => r.cls)).size).toBe(CANDIDATES)
    for (const r of run.candidates) {
      expect(r.gear!.stats).toEqual({})
      expect(r.gear).toMatchObject({ rarity: 'common' })
    }
  }
  const run = createRun(1)
  const chosen = run.candidates[0]
  expect(apply(run, { type: 'hero', index: 0 })).toEqual({ ok: true })
  expect(run.hero).toBe(chosen)
  expect(run.supplies).toBe(START_SUPPLIES)
  expect(run.candidates).toHaveLength(0)
  expect(run.phase).not.toBe('select')
  expect(apply(run, { type: 'hero', index: 0 }).ok).toBe(false)
})

test('heroes start with every weapon between them, melee among them', () => {
  const kinds = new Set<string>()
  for (let seed = 1; seed <= 60; seed++) for (const c of createRun(seed).candidates) kinds.add(c.gear!.weapon)
  expect([...kinds].sort()).toEqual(Object.keys(WEAPONS).sort())
})

test('the first leg opens with OPENING battles and meets no challenge before its satellite', () => {
  for (let seed = 1; seed <= 40; seed++) {
    const run = createRun(seed)
    apply(run, { type: 'hero', index: 0 })
    const columns = legOf(run).columns.slice(0, LEG_STOPS)
    for (const column of columns.slice(0, OPENING)) for (const node of column) expect(node.stop!.kind).toBe('battle')
    for (const column of columns) for (const node of column) expect(node.stop!.challenge).toBeNull()
  }
})
