import { expect, test } from 'vitest'
import { apply } from './apply'
import { isSoldier } from './battle'
import { fuelTanks } from './objects'
import { drawUtility, findUtility, settle, stockShop } from './rewards'
import { begun, road } from './roads'
import { createRun } from './run'
import { type Run } from './run-state'
import { drawBattle } from './missions'
import { stepBattle } from './combat'
import { tickBoons } from './boons'
import type { GameEvent } from './combat-event'
import { BOON_WEIGHT, FARSIGHT, KEEN, MEND, MINOR, START_PICKS, OVERCHARGE, RIG, SMOKE_REACH, STUN_TURNS, THRUST, UTILITIES, UTILITY_IDS, UTILITY_PRICE, UTILITY_SLOTS, type UtilityId } from './utilities'

/** A run at a battle's deploy screen, holding `held`. */
function landing(held: UtilityId[], seed = 1): Run {
  const run = begun(seed)
  run.utilities = held
  let stop = drawBattle(run, 'standard')
  for (let tries = 0; stop.goal !== 'exterminate' || stop.terrain === 'hive'; tries++) stop = drawBattle(run, 'standard')
  road(run, [stop])
  apply(run, { type: 'advance' })
  return run
}

const squad = (run: Run) => run.battle!.units.filter(isSoldier)
const aliens = (run: Run) => run.battle!.units.filter((u) => u.side === 'alien')

test('the party starts with no utility, and goes in with a tap', () => {
  const run = landing([])
  expect(apply(run, { type: 'enter' })).toEqual({ ok: true })
  expect(run.battle!.utility).toBeNull()
})

test('a picked utility is never used up, and only a held one can be picked', () => {
  const run = landing(['overcharge'])
  expect(apply(run, { type: 'enter', utility: 1 }).ok).toBe(false)
  const { damage } = run.battle!.reserve[0].stats
  expect(apply(run, { type: 'enter', utility: 0 })).toEqual({ ok: true })
  expect(squad(run)[0].stats.damage).toBe(damage + OVERCHARGE)
  expect(run.utilities).toEqual(['overcharge'])
})

test('thrusters add move; armor crack ignores armor; hover flattens steep ground', () => {
  const thrust = landing(['thrusters'])
  const move = thrust.battle!.reserve[0].stats.move
  apply(thrust, { type: 'enter', utility: 0 })
  expect(squad(thrust)[0].stats.move).toBe(move + THRUST)
  for (const [id, effect] of [['crack', 'piercing'], ['hover', 'hover'], ['rangedShield', 'rangedShield'], ['meleeShield', 'meleeShield']] as const) {
    const run = landing([id])
    apply(run, { type: 'enter', utility: 0 })
    expect(squad(run)[0].effects).toContain(effect)
  }
})

test('a flashbang stuns the first cluster, a smoke bomb shortens every alien shot', () => {
  const flash = landing(['flashbang'])
  apply(flash, { type: 'enter', utility: 0 })
  const stunned = aliens(flash).filter((u) => u.surprised > 0)
  expect(stunned.length).toBeGreaterThan(0)
  expect(new Set(stunned.map((u) => u.cluster)).size).toBe(1)
  expect(stunned.every((u) => u.surprised === (u.boss ? STUN_TURNS - 1 : STUN_TURNS))).toBe(true)

  const smoke = landing(['smoke'], 2)
  const far = smoke.battle!.units.filter((u) => u.side === 'alien' && u.stats.range > SMOKE_REACH).map((u) => [u, u.stats.range] as const)
  apply(smoke, { type: 'enter', utility: 0 })
  expect(far.every(([u]) => u.stats.range === SMOKE_REACH)).toBe(true)
})

test('every boon lasts its rounds, then ends on the units it held and gives back what it added', () => {
  for (const id of ['thrusters', 'overcharge', 'ironSkin', 'farsight', 'keen', 'hover', 'crack', 'gravity', 'dampener', 'smoke'] as const) {
    const run = landing([id], 5)
    apply(run, { type: 'enter', utility: 0 })
    const battle = run.battle!
    const before = new Map(battle.units.map((u) => [u.id, { ...u.stats, effects: u.effects.length }]))
    const events = []
    while (battle.round < UTILITIES[id].rounds && battle.phase === 'battle') events.push(...stepBattle(battle))
    while (battle.turn !== 'human' && battle.phase === 'battle') events.push(...stepBattle(battle))
    if (battle.phase !== 'battle') continue
    events.push(...stepBattle(battle))
    expect(events).toContainEqual(expect.objectContaining({ type: 'used', utility: id, ended: true }))
    expect(battle.boons).toHaveLength(0)
    for (const u of battle.units.filter((u) => u.hp > 0 && before.has(u.id) && (isSoldier(u) || u.side === 'alien'))) {
      const was = before.get(u.id)!
      if (id === 'thrusters' && isSoldier(u)) expect(u.stats.move).toBeLessThanOrEqual(was.move)
      if (id === 'gravity' && u.side === 'alien') expect(u.stats.move).toBeGreaterThanOrEqual(was.move)
      if (id === 'overcharge' && isSoldier(u)) expect(u.stats.damage).toBe(was.damage - OVERCHARGE)
      if (id === 'dampener' && u.side === 'alien' && was.damage > 1) expect(u.stats.damage).toBeGreaterThan(was.damage)
      if (id === 'farsight' && isSoldier(u)) expect(u.stats.range).toBe(was.range - FARSIGHT)
      if (id === 'keen' && isSoldier(u)) expect(u.stats.crit).toBeCloseTo(was.crit - KEEN)
      if ((id === 'hover' || id === 'crack') && isSoldier(u)) expect(u.effects).not.toContain(id === 'crack' ? 'piercing' : 'hover')
    }
  }
})

test('mending heals the squad each turn it lasts', () => {
  const run = landing(['mending'], 2)
  apply(run, { type: 'enter', utility: 0 })
  const battle = run.battle!
  const [hero] = squad(run)
  hero.hp = hero.stats.hp - 5
  while (battle.turn === 'human' && battle.phase === 'battle') stepBattle(battle)
  const events = []
  while (battle.turn !== 'human' && battle.phase === 'battle') events.push(...stepBattle(battle))
  events.push(...stepBattle(battle))
  expect(events).toContainEqual(expect.objectContaining({ type: 'effect', id: hero.id, effect: 'regen', amount: MEND }))
})

test('a shield halves hits of its own kind and leaves the other kind alone', () => {
  for (const [id, apart, halved] of [['rangedShield', 3, true], ['rangedShield', 1, false], ['meleeShield', 1, true], ['meleeShield', 3, false]] as const) {
    const run = landing([id])
    apply(run, { type: 'enter', utility: 0 })
    const battle = run.battle!
    const [hero] = squad(run)
    const alien = aliens(run)[0]
    battle.units = [hero, alien]
    Object.assign(hero, { x: 40, y: 40, hp: 99, armor: 0, weapon: undefined, stats: { ...hero.stats, hp: 99, move: 0, range: 0, damage: 0 } })
    Object.assign(alien, { x: 40 + apart, y: 40, hp: 99, armor: 0, kind: 'trooper', engaged: true, revealed: true, surprised: 0, stats: { ...alien.stats, hp: 99, damage: 4, range: 5, move: 0 } })
    battle.ground.fill('pavement'); battle.props.fill('none'); battle.bulk.fill(0); battle.height.fill(0); battle.north.fill('none'); battle.west.fill('none')
    const shots = []
    for (let i = 0; i < 40 && shots.length === 0; i++) shots.push(...stepBattle(battle).filter((e) => e.type === 'shot' && e.id === alien.id))
    expect(shots[0]).toMatchObject({ damage: halved ? 2 : 4 })
  }
})

test('a rigged tank is picked, stands until aliens crowd it, then blows on them', () => {
  let run = landing(['tank'])
  for (let seed = 2; fuelTanks(run.battle!).length < 2; seed++) run = landing(['tank'], seed)
  expect(apply(run, { type: 'enter', utility: 0, tank: 99 }).ok).toBe(false)
  apply(run, { type: 'enter', utility: 0, tank: 1 })
  const battle = run.battle!
  const tank = battle.rigged!
  expect(tank).toEqual(fuelTanks(battle)[1])
  const [foe] = aliens(run)
  const crowd = Array.from({ length: RIG.crowd }, (_, i) => ({ ...foe, id: 900 + i, y: tank.y + i - 1 }))
  battle.units = [...squad(run), foe]
  // Not a crowd: it stands.
  Object.assign(foe, { x: tank.x + 1, y: tank.y, hp: 99, armor: 0, engaged: true, surprised: 2, stats: { ...foe.stats, hp: 99, move: 0 } })
  for (const hero of squad(run)) Object.assign(hero, { x: tank.x - 20, y: tank.y })
  battle.turn = 'alien'
  battle.stage = 'move'
  stepBattle(battle)
  expect(battle.rigged).toEqual(tank)
  for (const c of crowd) Object.assign(c, { x: tank.x + 2, hp: 99, armor: 0, revealed: true, engaged: true, surprised: 2, stats: { ...foe.stats, hp: 99, move: 0 } })
  battle.units.push(...crowd)
  battle.turn = 'alien'
  battle.stage = 'move'
  const events = stepBattle(battle)
  expect(events).toContainEqual(expect.objectContaining({ type: 'rocket', src: { kind: 'object', id: 'rig' } }))
  expect(battle.rigged).toBeNull()
  expect(foe.hp).toBeLessThanOrEqual(99 - RIG.damage)
})

test('a utility found with three held forces a choice of which to drop', () => {
  const run = landing(['hover', 'smoke', 'crack'])
  expect(run.utilities).toHaveLength(UTILITY_SLOTS)
  findUtility(run)
  settle(run)
  const found = run.spare!
  expect(['hover', 'smoke', 'crack']).not.toContain(found)
  expect(run.phase).toBe('reward')
  expect(apply(run, { type: 'advance' }).ok).toBe(false)
  apply(run, { type: 'keep', drop: 1 })
  expect(run.utilities).toEqual(['hover', found, 'crack'])
  expect(run.spare).toBeNull()
})

test('a boon bought with no room and put back returns to the shelf, its price repaid', () => {
  const run = begun(1)
  run.phase = 'shop'
  run.shop = stockShop(run)
  run.utilities = UTILITY_IDS.filter((id) => !run.shop!.utilities.some((item) => item.id === id)).slice(0, UTILITY_SLOTS)
  run.supplies = UTILITY_PRICE
  apply(run, { type: 'utility', index: 0 })
  expect(run.spare).toBe(run.shop.utilities[0].id)
  apply(run, { type: 'keep', drop: -1 })
  expect(run.spare).toBeNull()
  expect(run.supplies).toBe(UTILITY_PRICE)
  expect(run.shop.utilities[0].sold).toBe(false)
})

test('boons are drawn by rarity: a common six times as often as an epic; only combos are epic or carry a minor part', () => {
  const rng = { rng: 7 }
  const drawn = { common: 0, rare: 0, epic: 0 }
  for (let i = 0; i < 20000; i++) drawn[UTILITIES[drawUtility(rng, [...UTILITY_IDS])].rarity]++
  const each = (rarity: keyof typeof drawn) => drawn[rarity] / UTILITY_IDS.filter((id) => UTILITIES[id].rarity === rarity).length
  expect(each('common') / each('epic')).toBeCloseTo(BOON_WEIGHT.common / BOON_WEIGHT.epic, 0)
  expect(each('rare') / each('epic')).toBeCloseTo(BOON_WEIGHT.rare / BOON_WEIGHT.epic, 0)
  for (const id of UTILITY_IDS) {
    const { parts, rarity } = UTILITIES[id]
    expect(parts.slice(1).every((p) => p.minor)).toBe(true)
    if (parts.length > 2) expect(rarity).toBe('epic')
    if (parts.length === 2) expect(rarity).toBe('rare')
  }
})

test("a combo's effects take hold together, the minor at its lesser strength, and end together", () => {
  const run = landing(['warpath'], 3)
  const { damage, move } = run.battle!.reserve[0].stats
  apply(run, { type: 'enter', utility: 0 })
  const battle = run.battle!
  const hero = squad(run)[0]
  expect(hero.stats.damage).toBe(damage + OVERCHARGE)
  expect(hero.stats.move).toBe(move + MINOR.thrusters)
  const events: GameEvent[] = []
  battle.round += UTILITIES.warpath.rounds - 1
  tickBoons(battle, events)
  expect(battle.boons).toHaveLength(1)
  battle.round++
  tickBoons(battle, events)
  expect(events.filter((e) => e.type === 'used' && e.ended)).toEqual([expect.objectContaining({ utility: 'warpath' })])
  expect(battle.boons).toHaveLength(0)
  expect([hero.stats.damage, hero.stats.move]).toEqual([damage, move])
})

test('a run starts with three commons offered, exactly two picked before anything else', () => {
  const run = createRun(5)
  apply(run, { type: 'recruit', index: 0 })
  expect(run.boonOffers).toHaveLength(3)
  expect(run.boonOffers.every((id) => UTILITIES[id].rarity === 'common')).toBe(true)
  expect(apply(run, { type: 'go', index: 0 }).ok).toBe(false)
  expect(apply(run, { type: 'boons', picks: [1] }).ok).toBe(false)
  expect(apply(run, { type: 'boons', picks: [1, 1] }).ok).toBe(false)
  const offered = [...run.boonOffers]
  expect(apply(run, { type: 'boons', picks: [2, 0] })).toEqual({ ok: true })
  expect(run.utilities).toEqual([offered[2], offered[0]])
  expect(run.utilities).toHaveLength(START_PICKS)
  expect(run.phase).toBe('overworld')
})
