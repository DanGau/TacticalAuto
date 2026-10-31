import { expect, test } from 'vitest'
import { TUNING } from './tuning'
import { apply } from './apply'
import { GRID, isSoldier, BASE_STATS, type Side } from './battle'
import { edgeNear } from './grid'
import { freeTilesNear } from './grid'
import { stepBattle } from './combat'
import type { GameEvent } from './combat-event'
import { CLASSES } from './classes'
import { EVENTS } from './events'
import { odds } from './sight'
import { FORTIFIED_SOAK } from './doctrines'
import { HUB } from './world'
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
import { missionAt } from './missions'
import { RISKS } from './missions'
import { dropGear } from './rewards'
import { SELL } from './rewards'
import { SHOP_RELICS } from './rewards'
import { SHOP_WARES } from './rewards'
import { GEAR_PRICE } from './rewards'
import { squadKeywords } from './squad'
import { RECRUITS } from './squad'
import { hire } from './squad'
import { LEVEL_STATS } from './squad'
import { soldierStats } from './squad'
import { health } from './squad'
import { TRAVEL_HEAL } from './squad'
import { skillOffers } from './squad'
import { MAX_SKILLS } from './squad'
import { XP } from './squad'
import { level } from './squad'
import { xpFor } from './squad'
import { LOSS_THREAT } from './progress'
import { STOP_THREAT } from './progress'
import { THREAT_MAX } from './progress'
import { LEG_STOPS } from './progress'
import { roots, SKILLS, TREES } from './skills'
import { atKey, road, enterAt, begun } from './roads'
import { TRAITS } from './traits'
import { RELICS } from './relics'
import { KIT_SLOTS, SHOP_CONSUMABLES } from './consumables'

/** A run whose first soldier has learned its first skill, so the overworld waits. */
function started(): Run {
  const run = begun(1)
  run.soldiers[0].skills = [roots(run.soldiers[0].cls!)[0]]
  return run
}

/** A stop of `kind`; a battle sends one patrol. */
const stopOf = (kind: StopKind, risk: Risk = 'standard'): Stop => ({
  kind,
  risk,
  goal: 'exterminate',
  terrain: kind === 'key' ? 'compound' : 'town',
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

/** Takes the first way on, if the squad has passed its stop. */
function onward(run: Run): void {
  if (!current(run)) apply(run, { type: 'go', index: ways(run)[0] })
}

/** Travels to the next stop, a battle, and ends it with `winner`: the losing side is down to the last unit. */
function fight(run: Run, winner: Side): void {
  onward(run)
  apply(run, { type: 'advance' })
  // Clear of Danger Close, which costs threat.
  if (run.battle!.phase === 'deploy') enterAt(run, run.battle!.entrances[0].kind === 'strike' ? 1 : 0)
  const battle = run.battle!
  for (const u of battle.units.filter((u) => isSoldier(u) && winner === 'alien')) battle.downed.push({ soldier: u.soldier!, x: u.x, y: u.y, carrier: null })
  battle.units = battle.units.filter((u) => u.side === winner)
  battle.phase = 'over'
  battle.winner = winner
  endBattle(run)
}

test('a run begins with one level 1 recruit on a path of its class, choosing where to start among the battles of its first leg', () => {
  const run = begun(1)
  expect(run.soldiers).toHaveLength(1)
  expect(level(run.soldiers[0])).toBe(1)
  expect(roots(run.soldiers[0].cls!)).toContain(run.soldiers[0].skills[0])
  expect(run).toMatchObject({ phase: 'overworld', soldiers: [{ skills: [expect.anything()] }] })
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

test.each(['safe', 'standard', 'dangerous'] as const)('a won battle in a %s zone adds threat, pays by the risk, gives experience and gear for the player to hand out, and relics if Overrun', (risk) => {
  const run = travelling(['battle', 'battle'], risk)
  fight(run, 'human')
  expect(run).toMatchObject({ threat: STOP_THREAT, stop: 1 })
  expect(run.supplies).toBeGreaterThanOrEqual(START_SUPPLIES + RISKS[risk].supplies)
  expect(run.finds.length).toBeLessThanOrEqual(1)
  if (RISKS[risk].gear !== 0.5) expect(run.finds).toHaveLength(RISKS[risk].gear)
  if (RISKS[risk].rareGear) expect(run.finds[0].rarity).not.toBe('common')
  expect(run.report).toMatchObject({ stop: 'battle', won: true, threat: { before: 0, after: STOP_THREAT }, key: false, hired: null })
  const [report] = run.report!.soldiers
  expect(report).toMatchObject({ xpBefore: xpFor(1), taken: false })
  expect(report.earned).toEqual(expect.arrayContaining([{ label: 'fought', xp: XP.fought }, { label: 'won', xp: XP.won }]))
  expect(report.xpAfter - report.xpBefore).toBe(report.earned.reduce((sum, e) => sum + e.xp, 0))
  while (run.finds.length > 0) apply(run, { type: 'sell', find: 0 })
  // An Overrun battle won offers relics too.
  expect(run.relicOffers).toHaveLength(risk === 'dangerous' ? 3 : 0)
  if (risk === 'dangerous') apply(run, { type: 'relic', index: 0 })
  expect(run.phase).toBe('overworld')
})

test('a find goes to the soldier the player picks, replacing and selling what it wore in the slot, or is sold; nothing is taken off', () => {
  const run = started()
  hire(run)
  const [first, second] = run.soldiers
  expect(first.gear.weapon).toMatchObject({ weapon: 'rifle', rarity: 'common' })
  dropGear(run, false)
  dropGear(run, false)
  const [gear] = run.finds
  const old = second.gear[gear.slot]
  const supplies = run.supplies
  run.phase = 'reward'
  expect(apply(run, { type: 'equip', find: 0, soldier: 99 }).ok).toBe(false)
  expect(apply(run, { type: 'equip', find: 0, soldier: second.id })).toEqual({ ok: true })
  expect(second.gear[gear.slot]).toBe(gear)
  expect(run.supplies).toBe(supplies + (old ? SELL[old.rarity] : 0))
  const [other] = run.finds
  expect(apply(run, { type: 'sell', find: 0 })).toEqual({ ok: true })
  expect(run.supplies).toBe(supplies + (old ? SELL[old.rarity] : 0) + SELL[other.rarity])
  expect(run).toMatchObject({ finds: [] })
})

test('a battle lost with every soldier down pays nothing and loses the run, the aliens taking them; they still earn experience', () => {
  const run = travelling(['battle', 'battle'])
  fight(run, 'alien')
  expect(run).toMatchObject({ phase: 'lost', threat: STOP_THREAT + LOSS_THREAT, supplies: START_SUPPLIES, captives: [run.soldiers[0].id] })
  expect(run.report!.soldiers).toMatchObject([{ taken: true, xpBefore: xpFor(1), earned: [{ label: 'fought', xp: XP.fought }] }])
})

test('a wipe loses the run even when the last alien falls with the last soldier', () => {
  const run = travelling(['battle', 'battle'])
  apply(run, { type: 'advance' })
  enterAt(run, 0)
  const battle = run.battle!
  const [soldier] = battle.units.filter(isSoldier)
  battle.downed.push({ soldier: soldier.soldier!, x: soldier.x, y: soldier.y, carrier: null })
  Object.assign(battle, { units: [], phase: 'over', winner: 'human' })
  endBattle(run)
  expect(run.phase).toBe('lost')
})

/** A run of two soldiers whose battle ended lost with the second left downed on the field, the first standing. */
function leftBehind(): Run {
  const run = travelling(['battle', 'battle'])
  hire(run).skills.splice(1)
  run.phase = 'overworld'
  apply(run, { type: 'advance' })
  enterAt(run, 0)
  const battle = run.battle!
  const fallen = battle.units.find((u) => u.soldier === run.soldiers[1].id)!
  battle.downed.push({ soldier: fallen.soldier!, x: fallen.x, y: fallen.y, carrier: null })
  battle.units.splice(battle.units.indexOf(fallen), 1)
  Object.assign(battle, { phase: 'over', winner: 'alien' })
  endBattle(run)
  return run
}

test('soldiers left downed on a field the squad did not hold are taken, and a recovery comes next: all or nothing', () => {
  const run = leftBehind()
  const [free, held] = run.soldiers
  expect(run).toMatchObject({ phase: 'overworld', captives: [held.id], stop: 1 })
  expect(run.report!.soldiers).toMatchObject([{ taken: false }, { taken: true }])
  onward(run)
  expect(nextStop(run)).toBe('recovery')
  apply(run, { type: 'advance' })
  const battle = run.battle!
  expect(run.mission).toMatchObject({ kind: 'recovery', goal: 'recover' })
  expect(battle.reserve.map((r) => r.soldier)).toEqual([free.id])
  expect(battle.captives.map((r) => r.soldier)).toEqual([held.id])
  expect(battle.downed).toMatchObject([{ soldier: held.id, carrier: null }])
  expect(battle.waves.length).toBeGreaterThan(0)

  const lost = structuredClone(run)
  fight(lost, 'alien')
  expect(lost.phase).toBe('lost')

  fight(run, 'human')
  expect(run.captives).toEqual([])
  expect(run.soldiers).toHaveLength(2)
  expect(run.stop).toBe(1)
  expect(nextStop(run)).toBe('battle')
})

test('on a recovery, a soldier who reaches a held squadmate gets them up at half health to fight', () => {
  const run = leftBehind()
  onward(run)
  apply(run, { type: 'advance' })
  enterAt(run, 0)
  const battle = run.battle!
  const [body] = battle.downed
  const rescuer = battle.units.find(isSoldier)!
  Object.assign(rescuer, freeTilesNear(battle, body, 2).find((t) => t.x !== body.x || t.y !== body.y)!)
  // It cannot end the battle by shooting, nor walk off, before it gets them up.
  rescuer.stats = { ...rescuer.stats, damage: 0, move: 0 }
  rescuer.ability = null
  const events: GameEvent[] = []
  for (let beats = 0; beats < 50 && !events.some((e) => e.type === 'freed'); beats++) events.push(...stepBattle(battle))
  const freed = battle.units.find((u) => u.soldier === body.soldier)!
  expect(events).toContainEqual(expect.objectContaining({ type: 'freed', unit: expect.objectContaining({ id: freed.id }) }))
  expect(battle.captives).toEqual([])
  expect(freed.hp).toBeLessThanOrEqual(Math.ceil(freed.stats.hp / 2))
})

test('getting out, a soldier picks up a squadmate down, walks at half its move carrying them, and lifts off with them', () => {
  const run = travelling(['battle', 'battle'])
  hire(run).skills.splice(1)
  run.phase = 'overworld'
  apply(run, { type: 'advance' })
  enterAt(run, 0)
  const battle = run.battle!
  const [carrier, fallen] = battle.units.filter(isSoldier)
  // One alien is left, rooted and harmless, and the carrier cannot kill it: the battle ends only by lifting off.
  Object.assign(carrier, { ability: null, effects: [], spent: ['throw', 'throw', 'throw'], stats: { ...carrier.stats, damage: 0 } })
  const alien = battle.units.find((u) => u.side === 'alien')!
  Object.assign(alien, { hp: 9999, stats: { ...alien.stats, damage: 0, move: 0 } })
  battle.units = [carrier, alien]
  battle.waves = []
  battle.extract = edgeNear(battle, { x: GRID - carrier.x, y: GRID - carrier.y })
  battle.downed.push({ soldier: fallen.soldier!, x: carrier.x, y: carrier.y, carrier: null })
  const events: GameEvent[] = []
  for (let beats = 0; beats < 3000 && battle.phase === 'battle'; beats++) events.push(...stepBattle(battle))
  expect(events).toContainEqual({ type: 'carried', id: carrier.id, soldier: fallen.soldier })
  const picked = events.findIndex((e) => e.type === 'carried')
  const walks = events.slice(picked).filter((e) => e.type === 'move' && e.id === carrier.id && !e.with)
  expect(walks.length).toBeGreaterThan(0)
  for (const walk of walks) expect(walk.type === 'move' && walk.path.length).toBeLessThanOrEqual(Math.ceil(carrier.stats.move / 2))
  expect(battle.escaped).toEqual([carrier.soldier, fallen.soldier])
  endBattle(run)
  expect(run.captives).toEqual([])
  expect(run.report!.soldiers.every((s) => !s.taken)).toBe(true)
})

test('a supply drop and a cache are collected on arrival, each adding threat', () => {
  const run = travelling(['supply', 'cache', 'battle'])
  apply(run, { type: 'advance' })
  expect(run).toMatchObject({ phase: 'overworld', supplies: START_SUPPLIES + DROP_SUPPLIES, threat: STOP_THREAT, stop: 1 })
  expect(run.report).toMatchObject({ stop: 'supply', supplies: DROP_SUPPLIES, soldiers: [] })
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

test('soldiers keep their health between battles, heal TRAVEL_HEAL for each stop travelled to, and come back from downed at 1', () => {
  const run = travelling(['battle', 'battle', 'battle'])
  hire(run).skills.splice(1)
  run.phase = 'overworld'
  const [hurt, fallen] = run.soldiers
  const most = soldierStats(run, hurt).hp
  apply(run, { type: 'advance' })
  enterAt(run, 0)
  const battle = run.battle!
  battle.units.find((u) => u.soldier === hurt.id)!.hp = 3
  const body = battle.units.find((u) => u.soldier === fallen.id)!
  battle.downed.push({ soldier: fallen.id, x: body.x, y: body.y, carrier: null })
  battle.units = battle.units.filter((u) => u.side === 'human' && u !== body)
  Object.assign(battle, { phase: 'over', winner: 'human' })
  endBattle(run)
  run.phase = 'overworld'
  expect(health(run, hurt)).toBe(3)
  expect(health(run, fallen)).toBe(1)
  expect(run.report!.soldiers).toMatchObject([{ hp: 3, maxHp: most }, { hp: 1 }])
  onward(run)
  apply(run, { type: 'advance' })
  expect(run.battle!.reserve.find((r) => r.soldier === hurt.id)!.hp).toBe(3 + TRAVEL_HEAL)
})

test('at a medic every soldier heals fully; at full health the squad takes a bonus instead', () => {
  const run = travelling(['medic', 'medic', 'battle'])
  run.soldiers[0].wounds = 7
  apply(run, { type: 'advance' })
  expect(run).toMatchObject({ phase: 'event', event: 'medic' })
  const can = () => EVENTS.medic.options.flatMap((o, i) => (!o.can || o.can(run) ? [i] : []))
  expect(can()).toEqual([0, 3])
  apply(run, { type: 'choose', index: 0 })
  expect(run.soldiers[0].wounds).toBe(0)
  expect(run.met).toEqual([])
  onward(run)
  apply(run, { type: 'advance' })
  expect(can()).toEqual([1, 2, 3])
  const xp = run.soldiers[0].xp
  apply(run, { type: 'choose', index: 2 })
  expect(run.soldiers[0].xp).toBeGreaterThan(xp)
})

test('after the stops of a leg comes its satellite: winning it wins a key, a hero, and the next leg', () => {
  const run = started()
  enter(run, 'safe', ['battle', 'battle'])
  for (let i = 0; i < 2; i++) {
    fight(run, 'human')
    while (skillOffers(run.soldiers[0]).length > 0) apply(run, { type: 'skill', soldier: run.soldiers[0].id, index: 0 })
  }
  onward(run)
  expect(current(run)!.stop).toMatchObject({ kind: 'key', terrain: 'compound' })
  expect(nextStop(run)).toBe('key')
  expect(run.soldiers).toHaveLength(1)
  run.threat = 0
  fight(run, 'human')
  expect(run).toMatchObject({ keys: 1, stop: 0, phase: 'reward' })
  expect(current(run)).toBeNull()
  expect(run.soldiers).toHaveLength(2)
  expect(run.report).toMatchObject({ stop: 'key', key: true, hired: run.soldiers[1].name })
  expect(run.finds.every((find) => find.rarity !== 'common')).toBe(true)
  expect(legOf(run).columns.flat().every((node) => node.stop !== null)).toBe(true)
})

test("each leg crosses a continent to a hero in one of its cities, who joins seasoned once extracted; the last leads to the hub", () => {
  const run = started()
  expect(run.route).toHaveLength(KEYS + 1)
  expect(new Set(run.route.slice(0, KEYS).map((stage) => stage.continent)).size).toBe(KEYS)
  expect(run.route[KEYS].to).toBe(HUB)
  const hero = run.route[0].hero!
  atKey(run)
  fight(run, 'human')
  expect(run.soldiers[1]).toBe(hero)
  expect(level(hero)).toBeGreaterThan(1)
  expect(roots(hero.cls!)).toContain(hero.skills[0])
  expect(skillOffers(hero)).toEqual([])
})

test("losing a hero's extraction loses the run", () => {
  const run = started()
  atKey(run)
  fight(run, 'alien')
  expect(run.phase).toBe('lost')
})

test('experience follows what a soldier did: kills and damage its own, feats only the first time', () => {
  const run = travelling(['battle', 'battle', 'battle'])
  const [soldier] = run.soldiers
  const battle = () => {
    apply(run, { type: 'advance' })
    enterAt(run, 0)
    const b = run.battle!
    b.tally[soldier.id] = { dealt: 12, kills: 3, taken: 4, feats: ['hatTrick'] }
    b.units = b.units.filter((u) => u.side === 'human')
    Object.assign(b, { phase: 'over', winner: 'human' })
    endBattle(run)
    while (run.finds.length > 0) apply(run, { type: 'sell', find: 0 })
    return run.report!.soldiers[0]
  }
  const first = battle()
  expect(first.feats).toEqual(['hatTrick'])
  expect(first.earned).toEqual([
    { label: 'fought', xp: XP.fought },
    { label: 'won', xp: XP.won },
    { label: '3 kills', xp: 3 * XP.kill },
    { label: '12 damage', xp: Math.floor(12 / XP.damage) },
    { label: 'Hat Trick', xp: XP.feat },
  ])
  expect(battle().feats).toEqual([])
  expect(soldier.feats).toEqual(['hatTrick'])
})

test('an ambush has no entrance: the squad is down at once, every alien in sight, the Hunter engaged first and half again as strong as its best soldier', () => {
  const run = travelling(['battle', 'battle'])
  run.threat = THREAT_MAX
  apply(run, { type: 'advance' })
  const battle = run.battle!
  expect(battle).toMatchObject({ goal: 'ambush', phase: 'battle', waves: [] })
  expect(battle.units.filter(isSoldier)).toHaveLength(run.soldiers.length)
  for (const u of battle.units.filter((a) => a.side === 'alien')) expect(u.engaged).toBe(u.boss)
  const hunter = battle.units.find((u) => u.boss)!.stats
  const best = soldierStats(run, run.soldiers[0])
  expect(hunter.hp * hunter.damage).toBeGreaterThanOrEqual(1.4 * best.hp * best.damage)
  expect(hunter.hp * hunter.damage).toBeLessThanOrEqual(1.8 * best.hp * best.damage)
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

test.each(['human', 'alien'] as const)('with every key won the squad is four, only the final mission remains, and it decides the run; %s win', (winner) => {
  const run = started()
  for (let key = 0; key < KEYS; key++) {
    atKey(run)
    run.threat = 0
    fight(run, 'human')
    apply(run, { type: 'relic', index: 0 })
    while (run.finds.length > 0) apply(run, { type: 'equip', find: 0, soldier: run.soldiers[0].id })
    for (const s of run.soldiers) while (skillOffers(s).length > 0) apply(run, { type: 'skill', soldier: s.id, index: 0 })
    expect(run.phase).toBe('overworld')
  }
  expect(run.soldiers).toHaveLength(KEYS + 1)
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
    atKey(run)
    apply(run, { type: 'advance' })
    const battle = run.battle!
    const boss = battle.units.filter((u) => u.boss)
    expect(boss).toHaveLength(1)
    expect(battle.units.filter((u) => u.side === 'alien').length).toBeGreaterThanOrEqual(1 + keys)
    expect(boss[0].spawns).toBe(keys >= 1)
  }
})

const soldier = (extra: Partial<Soldier>): Soldier => ({ id: 0, name: '', xp: 0, cls: null, skills: [], feats: [], gear: { weapon: null, armor: null, utility: null }, trait: null, home: null, wounds: 0, seed: 0, ...extra })

test('stats add class, level, skills and relics to the base', () => {
  const run = begun(1)
  run.relics = ['plasma']
  const stats = soldierStats(run, soldier({ xp: xpFor(2) }))
  expect(stats.hp).toBe(BASE_STATS.hp + 2 * LEVEL_STATS.hp!)
  expect(stats.damage).toBe(BASE_STATS.damage + 1)
  expect(stats.crit).toBeCloseTo(BASE_STATS.crit + 2 * LEVEL_STATS.crit!)
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

test('each level offers one guard, one control and one power skill its tree has opened, the same until chosen; past the last, levels add stats only', () => {
  const run = begun(1)
  const [soldier] = run.soldiers
  expect(skillOffers(soldier)).toEqual([])
  soldier.xp = xpFor(MAX_SKILLS + 5)
  run.phase = 'reward'
  const seen = new Set<string>()
  for (let n = 1; n < MAX_SKILLS; n++) {
    const offers = skillOffers(soldier)
    expect(skillOffers(soldier)).toEqual(offers)
    expect(offers.map((id) => SKILLS[id].role)).toEqual(['guard', 'control', 'power'])
    for (const id of offers) {
      expect(TREES[soldier.cls!]).toContain(id)
      expect(soldier.skills).not.toContain(id)
      expect(!SKILLS[id].after || SKILLS[id].after.some((a) => soldier.skills.includes(a as never))).toBe(true)
      seen.add(id)
    }
    apply(run, { type: 'skill', soldier: soldier.id, index: n % 3 })
  }
  expect(soldier.skills).toHaveLength(MAX_SKILLS)
  expect(skillOffers(soldier)).toEqual([])
  // Two soldiers of a class are offered different things.
  const offered = (seed: number) => skillOffers({ ...soldier, skills: soldier.skills.slice(0, 1), seed })
  expect(Array.from({ length: 8 }, (_, seed) => offered(seed).join()).some((o) => o !== offered(0).join())).toBe(true)
})

test("every class's tree holds roots of each role, at least three skills of each, and opens each skill from skills in that tree", () => {
  for (const cls of Object.keys(TREES) as (keyof typeof TREES)[]) {
    const tree = TREES[cls]
    for (const role of ['guard', 'control', 'power'] as const) {
      expect(roots(cls).some((id) => SKILLS[id].role === role)).toBe(true)
      expect(tree.filter((id) => SKILLS[id].role === role).length).toBeGreaterThanOrEqual(3)
    }
    for (const id of tree) for (const a of SKILLS[id].after ?? []) expect(tree).toContain(a)
  }
  expect(new Set(Object.values(TREES).flat()).size).toBe(Object.keys(SKILLS).length)
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

test('a shop stocks one-of-a-kind gear for the soldier the player picks, relics the squad lacks, consumables, and a bribe, each sold once and kept in its place; and is left for the road', () => {
  const run = travelling(['shop', 'battle'])
  const buyer = run.soldiers[0].id
  expect(apply(run, { type: 'gear', index: 0, soldier: buyer })).toEqual({ ok: false, reason: 'not in a shop' })
  apply(run, { type: 'advance' })
  expect(run).toMatchObject({ phase: 'shop', threat: STOP_THREAT })
  const shop = run.shop!
  expect(shop.wares).toHaveLength(SHOP_WARES)
  expect(new Set(shop.wares.map((w) => w.gear.effect)).size).toBe(SHOP_WARES)
  expect(shop.wares.every((w) => w.gear.rarity !== 'common')).toBe(true)
  expect(shop.relics).toHaveLength(SHOP_RELICS)
  run.supplies = 100
  const { gear } = shop.wares[0]
  const old = run.soldiers[0].gear[gear.slot]
  expect(apply(run, { type: 'gear', index: 0, soldier: buyer })).toEqual({ ok: true })
  expect(run.soldiers[0].gear[gear.slot]).toBe(gear)
  expect(run.supplies).toBe(100 - GEAR_PRICE[gear.rarity as keyof typeof GEAR_PRICE] + (old ? SELL[old.rarity] : 0))
  expect(shop.wares).toHaveLength(SHOP_WARES)
  expect(shop.wares[0]).toEqual({ gear, sold: true })
  expect(apply(run, { type: 'gear', index: 0, soldier: buyer }).ok).toBe(false)
  const last = SHOP_RELICS - 1
  const relic = shop.relics[last].id
  expect(apply(run, { type: 'buy', index: last })).toEqual({ ok: true })
  expect(run.relics).toContain(relic)
  expect(shop.relics[last]).toEqual({ id: relic, sold: true })
  expect(apply(run, { type: 'buy', index: last }).ok).toBe(false)
  expect(new Set(shop.consumables.map((c) => c.id)).size).toBe(SHOP_CONSUMABLES)
  run.kit = Array(KIT_SLOTS - 1).fill('medkit')
  expect(apply(run, { type: 'consumable', index: 0 })).toEqual({ ok: true })
  expect(run.kit.at(-1)).toBe(shop.consumables[0].id)
  expect(apply(run, { type: 'consumable', index: 1 })).toEqual({ ok: false, reason: 'the kit is full' })
  expect(apply(run, { type: 'bribe' })).toEqual({ ok: true })
  expect(run.threat).toBe(0)
  expect(apply(run, { type: 'bribe' }).ok).toBe(false)
  run.supplies = 0
  expect(apply(run, { type: 'gear', index: 1, soldier: buyer })).toEqual({ ok: false, reason: 'not enough supplies' })
  apply(run, { type: 'leave' })
  expect(run).toMatchObject({ phase: 'overworld', shop: null, stop: 1 })
})

test('an unknown stop turns out a battle, a shop, or an event met once a run, whose options change the run', () => {
  const kinds = new Set<string>()
  for (let seed = 0; seed < 40; seed++) {
    const run = begun(seed)
    run.soldiers[0].skills = [roots(run.soldiers[0].cls!)[0]]
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

test('doctrines change the run: Lone Wolf leaves one soldier and stops recruits; Specialists give every soldier its own class', () => {
  const run = started()
  for (let i = 0; i < 3; i++) hire(run)
  run.event = 'instructor'
  run.phase = 'event'
  enter(run)
  const levels = run.soldiers.map(level)
  apply(run, { type: 'choose', index: 0 })
  expect(new Set(run.soldiers.map((s) => s.cls)).size).toBe(4)
  expect(run.soldiers.map(level)).toEqual(levels.map((l) => l + 1))
  expect(run.doctrines).toEqual(['specialists'])

  const wolf = started()
  hire(wolf)
  const hp = soldierStats(wolf, wolf.soldiers[0]).hp
  enter(wolf)
  Object.assign(wolf, { event: 'survivor', phase: 'event' })
  apply(wolf, { type: 'choose', index: 0 })
  expect(wolf.soldiers).toHaveLength(1)
  expect(soldierStats(wolf, wolf.soldiers[0]).hp).toBe(hp + 40)
  atKey(wolf)
  fight(wolf, 'human')
  expect(wolf.soldiers).toHaveLength(1)
})

test('under fortification every hit does 1 less damage, on either side', () => {
  const run = begun(1)
  apply(run, { type: 'go', index: 1 })
  apply(run, { type: 'advance' })
  enterAt(run, 0)
  const battle = run.battle!
  const soldier = battle.units.find(isSoldier)!
  const alien = battle.units.find((u) => u.side === 'alien')!
  const plain = odds(battle, alien, soldier)
  battle.rules = ['fortified']
  expect(odds(battle, alien, soldier)).toBe(plain - FORTIFIED_SOAK)
})

test("a soldier lands with its class's ability and its uses, the effects of its skills and the squad's relics, and armor from its gear", () => {
  const run = travelling(['battle'])
  run.soldiers[0].cls = 'heavy'
  run.soldiers[0].gear.armor = { id: 1, slot: 'armor', rarity: 'common', name: 'Sturdy Vest', stats: { armor: 2 }, effect: null }
  run.soldiers[0].skills = ['arsenal', 'shredder']
  run.relics = ['echo', 'capacitor']
  apply(run, { type: 'advance' })
  enterAt(run, 0)
  const [unit] = run.battle!.units.filter(isSoldier)
  expect(unit).toMatchObject({ ability: 'rocket', charges: 3, stance: 'anchor', armor: 2, effects: ['shred', 'opener'] })
  expect(unit.hp).toBe(soldierStats(run, run.soldiers[0]).hp)
})

test("the first relic offered shares a keyword with the squad's skills, gear or relics", () => {
  for (let seed = 1; seed <= 5; seed++) {
    const run = started()
    run.rng = seed
    run.soldiers[0].skills = ['mark']
    atKey(run)
    fight(run, 'human')
    expect(RELICS[run.relicOffers[0]].tags!.some((tag) => squadKeywords(run).includes(tag))).toBe(true)
  }
})

test('a run begins with a choice of recruits of different classes, one plain, the rest each with its own trait, applied on joining', () => {
  for (let seed = 1; seed <= 20; seed++) {
    const run = createRun(seed)
    expect(run.phase).toBe('recruit')
    expect(run.soldiers).toHaveLength(0)
    expect(new Set(run.recruits.map((r) => r.cls)).size).toBe(RECRUITS)
    expect(run.recruits.filter((r) => r.trait === null)).toHaveLength(1)
    expect(new Set(run.recruits.map((r) => r.trait)).size).toBe(RECRUITS)
    // A veteran joins with its skills learned.
    for (const r of run.recruits) expect(r.skills).toHaveLength(r.trait === 'veteran' ? 3 : 1)
  }
  const run = createRun(1)
  run.recruits[0].trait = 'quartermaster'
  run.recruits[1].trait = 'veteran'
  const chosen = run.recruits[0]
  expect(apply(run, { type: 'recruit', index: 0 })).toEqual({ ok: true })
  expect(run.soldiers).toEqual([chosen])
  expect(run.supplies).toBe(START_SUPPLIES + TRAITS.quartermaster.supplies)
  expect(soldierStats(run, chosen).hp).toBe(soldierStats(run, { ...chosen, trait: null }).hp + TRAITS.quartermaster.stats.hp)
  expect(run.recruits).toHaveLength(0)
  expect(run.phase).not.toBe('recruit')
  expect(apply(run, { type: 'recruit', index: 0 }).ok).toBe(false)
})
