import { fx } from './sources'
import { powerOf } from './skills'
import { expect, test } from 'vitest'
import { enterAt, begun } from './roads'
import { apply } from './apply'
import { BURN_STACKS, CRIT_BONUS, SEARING_DAMAGE, SOLDIER_ATTACKS, GRID, type Battle, type Effect, type Stats, type Unit } from './battle'
import { alienUnit } from './spawn'
import { reshaped } from './grid'
import { stepBattle } from './combat'
import type { GameEvent } from './combat-event'
import { alienStats } from './aliens'
import { EFFECTS, generateGear, type Gear } from './gear'
import { type Run } from './run-state'
import { soldierStats } from './squad'
import { MELEE_RANGE, WEAPONS } from './weapons'
import { TUNING } from './tuning'

test('gear does one thing: commons a stat mod, rares a simple effect, epics an elaborate one, each on any weapon', () => {
  const rng = { rng: 7 }
  const kinds = new Set<string>()
  for (let id = 0; id < 900; id++) {
    const rarity = (['common', 'rare', 'epic'] as const)[id % 3]
    const gear = generateGear(rng, id, rarity)
    // A common has a stat mod or feeds a build; better gear has an effect of its rarity.
    expect(gear.effect === null).toBe(Object.keys(gear.stats).length > 0)
    if (rarity !== 'common') expect(gear.effect).not.toBeNull()
    if (gear.effect) expect(EFFECTS[gear.effect].rarity ?? 'rare').toBe(rarity)
    kinds.add(gear.weapon)
    expect(gear.name.endsWith(WEAPONS[gear.weapon].name)).toBe(true)
  }
  expect([...kinds].sort()).toEqual(Object.keys(WEAPONS).sort())
})

test('any soldier wields any weapon: a melee one reaches the next tile and charges in, whatever the class', () => {
  const run = begun(1)
  const [soldier] = run.soldiers
  const rifle = soldierStats(run, soldier)
  soldier.gear = { id: 9, rarity: 'common', name: 'Hammer', weapon: 'hammer', stats: {}, effect: null }
  const hammer = soldierStats(run, soldier)
  expect(hammer).toMatchObject({ range: MELEE_RANGE, damage: rifle.damage })
  apply(run, { type: 'go', index: 1 })
  apply(run, { type: 'advance' })
  expect(run.battle!.reserve[0]).toMatchObject({ stance: 'rush', weapon: 'hammer', effects: expect.arrayContaining([WEAPONS.hammer.effect]) })
})

/** A run whose soldier has learned its first skill and found `gear`. */
function withFind(gear: Omit<Gear, 'id'>): Run {
  const run = begun(1)
  run.soldiers[0].skills = [powerOf(run.soldiers[0].cls!)]
  run.finds.push({ id: 1, owner: run.soldiers[0].id, ...gear })
  run.phase = 'reward'
  return run
}

/** A duel on open ground: one soldier wearing `gear`, one alien beside it, and the soldier too weak to win quickly. */
function duel(gear: Omit<Gear, 'id'>): { battle: Battle; soldier: Unit; alien: Unit; step: () => ReturnType<typeof stepBattle> } {
  const run = withFind(gear)
  apply(run, { type: 'equip', find: 0 })
  apply(run, { type: 'go', index: 1 })
  apply(run, { type: 'advance' })
  // War drums pay off only on a kill, so they leave a duel as it is.
  enterAt(run)
  const battle = run.battle!
  Object.assign(battle, { goal: 'exterminate', uplink: null, waves: [], twist: null })
  battle.ground.fill('pavement')
  battle.props.fill('none')
  battle.bulk.fill(0)
  battle.height.fill(0)
  battle.north.fill('none')
  battle.west.fill('none')
  reshaped(battle)
  const soldier = battle.units.find((u) => u.soldier === run.soldiers[0].id)!
  const alien = battle.units.find((u) => u.side === 'alien')!
  battle.units = [soldier, alien]
  for (const u of battle.units) Object.assign(u, { revealed: true, engaged: true })
  // A soldier of no class in particular: it holds its ground and has no ability or class skill.
  Object.assign(soldier, { x: 10, y: 10, stance: 'anchor', ability: null, weapon: undefined, effects: gear.effect ? [gear.effect] : [] })
  Object.assign(alien, { kind: 'trooper', x: 10, y: 11, hp: 99, armor: 0, target: false, stats: { ...alienStats('trooper', 0, 0), hp: 99, armor: 0, crit: 0 } })
  return { battle, soldier, alien, step: () => stepBattle(battle) }
}

/** Steps until the alien has shot once, returning every event up to then. */
function untilAlienShoots(d: ReturnType<typeof duel>) {
  const events = []
  for (let beats = 0; ; beats++) {
    if (beats > 200) throw new Error('the alien never shot')
    const beat = d.step()
    events.push(...beat)
    if (beat.some((e) => e.type === 'shot' && e.id === d.alien.id)) return events
  }
}

test('a scorching weapon burns its target at the start of the target\'s turns', () => {
  const d = duel({ weapon: 'rifle', rarity: 'rare', name: 'Scorching Steady Carbine', stats: {}, effect: 'incendiary' })
  d.soldier.stats = { ...d.soldier.stats, damage: 1, crit: 0 }
  const events = untilAlienShoots(d)
  expect(events).toContainEqual(expect.objectContaining({ type: 'effect', id: d.alien.id, effect: 'incendiary', amount: 0 }))
  // Each attack adds its stacks; the alien takes them all at the start of its turn.
  expect(events).toContainEqual(expect.objectContaining({ type: 'effect', id: d.alien.id, effect: 'incendiary', amount: -SOLDIER_ATTACKS * BURN_STACKS }))
  expect(d.alien.hp).toBe(99 - SOLDIER_ATTACKS - SOLDIER_ATTACKS * BURN_STACKS)
})

test('a rimed weapon chills its target, and a shatterglass edge and thermal shock core pay off on it', () => {
  const d = duel({ weapon: 'rifle', rarity: 'rare', name: 'Rimed Steady Carbine', stats: {}, effect: 'frostbite' })
  d.soldier.stats = { ...d.soldier.stats, damage: 2, crit: 0 }
  d.soldier.effects.push('shatter', 'thermal')
  const shots = () => {
    const events = untilAlienShoots(d)
    return events.filter((e) => e.type === 'shot' && e.id === d.soldier.id)
  }
  const [first] = shots()
  expect(first).toMatchObject({ damage: 2 })
  expect(d.alien.chill).toBeGreaterThan(0)
  d.alien.burn = 5
  const [second] = shots()
  expect(second).toMatchObject({ damage: 2 + TUNING.shatterDamage + TUNING.thermalDamage })
})

test('an alien that resists frost and burn is neither chilled nor set burning', () => {
  const d = duel({ weapon: 'rifle', rarity: 'rare', name: 'Rimed Steady Carbine', stats: {}, effect: 'frostbite' })
  d.soldier.stats = { ...d.soldier.stats, damage: 1, crit: 0 }
  d.soldier.effects.push('incendiary')
  d.alien.resists = ['frost', 'burn']
  untilAlienShoots(d)
  expect(d.alien.chill).toBe(0)
  expect(d.alien.burn).toBe(0)
})

test('overkill coils carry damage beyond a kill to the nearest other alien', () => {
  const d = duel({ weapon: 'rifle', rarity: 'rare', name: 'Steady Carbine', stats: {}, effect: null })
  d.soldier.stats = { ...d.soldier.stats, damage: 10, crit: 0 }
  d.soldier.effects.push('overkill')
  d.alien.hp = 4
  d.alien.armor = 0
  const other = alienUnit(d.battle, { kind: 'trooper', stats: { ...d.alien.stats, hp: 99, armor: 0 }, stance: 'anchor', boss: false, spawns: false, target: false, resists: [] }, { x: d.alien.x + 1, y: d.alien.y }, true)
  d.battle.units.push(other)
  const events = []
  while (d.alien.hp > 0) events.push(...d.step())
  const shot = events.find((e) => e.type === 'shot' && e.target === d.alien.id)
  expect(shot).toBeDefined()
  expect(events).toContainEqual(expect.objectContaining({ type: 'effect', id: other.id, effect: 'overkill', amount: -(shot!.type === 'shot' ? shot!.damage - 4 : 0) }))
})

/** Another alien in the duel, at `dx`, `dy` from the first, too tough to die. */
function another(d: ReturnType<typeof duel>, dx: number, dy: number): Unit {
  const other = alienUnit(d.battle, { kind: 'trooper', stats: { ...d.alien.stats, hp: 99, armor: 0 }, stance: 'anchor', boss: false, spawns: false, target: false, resists: [] }, { x: d.alien.x + dx, y: d.alien.y + dy }, true)
  d.battle.units.push(other)
  return other
}

/** A duel with the soldier holding `effects` and the given stats. */
function armed(effects: Effect[], stats: Partial<Stats> = {}) {
  const d = duel({ weapon: 'rifle', rarity: 'rare', name: 'Carbine', stats: {}, effect: null })
  d.soldier.effects.push(...effects)
  d.soldier.stats = { ...d.soldier.stats, crit: 0, damage: 1, ...stats }
  return d
}

const effectsOf = (events: GameEvent[], effect: Effect) => events.filter((e) => e.type === 'effect' && e.effect === effect)

test('a ricochet strikes another alien near the target for half', () => {
  const d = armed(['ricochet'], { damage: 4 })
  const other = another(d, 1, 0)
  const events = untilAlienShoots(d)
  expect(effectsOf(events, 'ricochet')[0]).toMatchObject({ id: other.id, amount: -2 })
})

test('an arcing crit leaps to the two nearest other aliens for half its damage', () => {
  const d = armed(['arc'], { crit: 1, damage: 3 })
  const [a, b] = [another(d, 1, 0), another(d, 2, 0)]
  const events = untilAlienShoots(d)
  const half = Math.ceil((3 + CRIT_BONUS) / 2)
  const arcs = effectsOf(events, 'arc')
  expect(arcs).toHaveLength(2 * SOLDIER_ATTACKS)
  expect(arcs.every((e) => e.type === 'effect' && e.amount === -half && [d.alien.id, a.id, b.id].includes(e.id))).toBe(true)
})

test('a volatile kill bursts on the aliens beside it', () => {
  const d = armed(['volatile'], { damage: 5 })
  d.alien.hp = 1
  const other = another(d, 1, 0)
  const events = []
  for (let beats = 0; d.alien.hp > 0 && beats < 200; beats++) events.push(...d.step())
  expect(events).toContainEqual(expect.objectContaining({ type: 'effect', id: other.id, effect: 'volatile', amount: -2 }))
})

test('a thundering hit knocks the target back, or slams it into what stops it, an alien it slams into taking as much', () => {
  const d = armed(['thunder'])
  const events = untilAlienShoots(d)
  expect(events).toContainEqual(expect.objectContaining({ type: 'move', id: d.alien.id, path: [{ x: 10, y: 12 }], with: 'thunder' }))
  const behind = another(d, 0, 1)
  const slam = [fx(d.alien.id, 'thunder', -1), fx(behind.id, 'thunder', -1)]
  expect(effectsOf(untilAlienShoots(d), 'thunder')).toEqual(Array(SOLDIER_ATTACKS).fill(slam).flat())
})

test('blinking gear carries a soldier hit to half health to safety, once', () => {
  const d = armed(['blink'], { damage: 0 })
  d.soldier.armor = 0
  d.alien.stats = { ...d.alien.stats, damage: d.soldier.stats.hp - 1 }
  const events = untilAlienShoots(d)
  expect(events).toContainEqual(expect.objectContaining({ type: 'move', id: d.soldier.id, with: 'blink' }))
  expect(d.soldier.spent).toContain('blink')
})

test('a null field stops a spitter spitting', () => {
  const d = armed(['null'], { damage: 0 })
  d.alien.kind = 'spitter'
  d.alien.stats = { ...d.alien.stats, move: 0 }
  expect(untilAlienShoots(d).some((e) => e.type === 'spit')).toBe(false)
})

test('a pyre censer sets the ground under a burning alien ablaze', () => {
  const d = armed(['pyre'], { damage: 0 })
  d.alien.burn = 3
  const { x, y } = d.alien
  untilAlienShoots(d)
  expect(d.battle.fire).toContainEqual(expect.objectContaining({ x, y }))
})

test('a stasis field freezes a chilled alien a crit lands on', () => {
  const d = armed(['stasis'], { crit: 1 })
  d.alien.chill = 5
  const events = untilAlienShoots(d)
  expect(events).toContainEqual(expect.objectContaining({ type: 'effect', id: d.alien.id, effect: 'stasis', amount: 0 }))
  expect(events).toContainEqual({ type: 'frozen', id: d.alien.id })
})

test("a witch's hex passes a marked alien's mark to the nearest alien when it dies", () => {
  const d = armed(['hex'], { damage: 5 })
  Object.assign(d.alien, { hp: 1, marked: true })
  const other = another(d, 2, 0)
  for (let beats = 0; d.alien.hp > 0 && beats < 200; beats++) d.step()
  expect(other.marked).toBe(true)
})

test('a snaring hit roots its target, and a hunter\'s net hits a rooted alien harder', () => {
  const d = armed(['snare', 'net'], { damage: 1 })
  const shots = untilAlienShoots(d).filter((e) => e.type === 'shot' && e.id === d.soldier.id)
  expect(d.alien.rooted).toBeGreaterThan(0)
  expect(shots[0]).toMatchObject({ damage: 1 })
  const [next] = untilAlienShoots(d).filter((e) => e.type === 'shot' && e.id === d.soldier.id)
  expect(next).toMatchObject({ damage: 3 })
})

test('a rooted alien does not move, and a glacial snare roots what it chills', () => {
  const d = armed(['frostbite', 'glacial'])
  Object.assign(d.alien, { x: 10, y: 15 })
  d.alien.stats = { ...d.alien.stats, range: 1 }
  const events = untilAlienShoots({ ...d, alien: d.soldier })
  expect(d.alien.rooted).toBeGreaterThan(0)
  expect(events.some((e) => e.type === 'move' && e.id === d.alien.id)).toBe(false)
})

test('a booming charge hurts a target that moves on its next turn', () => {
  const d = armed(['booming'])
  Object.assign(d.alien, { x: 10, y: 14 })
  d.alien.stats = { ...d.alien.stats, range: 1 }
  const events = untilAlienShoots(d)
  expect(events).toContainEqual(expect.objectContaining({ type: 'effect', id: d.alien.id, effect: 'booming', amount: -3 }))
})

test('a tethered hit pulls its target a tile toward the shooter', () => {
  const d = armed(['tether'])
  Object.assign(d.alien, { x: 10, y: 13 })
  d.alien.stats = { ...d.alien.stats, move: 0 }
  expect(untilAlienShoots(d)).toContainEqual(expect.objectContaining({ type: 'move', id: d.alien.id, path: [{ x: 10, y: 12 }], with: 'tether' }))
})

test('caltrops are strewn in the path of an alien closing in', () => {
  const d = armed(['caltrops'], { damage: 0, move: 0 })
  d.soldier.hp = d.soldier.stats.hp = 999
  Object.assign(d.alien, { x: 10, y: 15 })
  d.alien.stats = { ...d.alien.stats, range: 1 }
  for (let beats = 0; d.battle.caltrops.length === 0 && beats < 200; beats++) d.step()
  expect(d.battle.caltrops).toHaveLength(9)
})

test('caltrops slow an alien that must cross them, and hurt it', () => {
  const d = armed([], { damage: 0 })
  Object.assign(d.alien, { x: 10, y: 15 })
  d.alien.stats = { ...d.alien.stats, range: 1, move: 4 }
  // The soldier holds its ground, so the alien must come to it.
  d.soldier.stats = { ...d.soldier.stats, move: 0 }
  d.battle.caltrops = Array.from({ length: GRID }, (_, x) => ({ x, y: 13 }))
  const events = untilAlienShoots(d)
  const steps = events.find((e) => e.type === 'move' && e.id === d.alien.id)
  expect(steps?.type === 'move' && steps.path.length).toBeLessThan(4)
  expect(effectsOf(events, 'caltrops')).toContainEqual(expect.objectContaining({ type: 'effect', id: d.alien.id, effect: 'caltrops', amount: -1 }))
})

test('the sentinel protocol shoots an alien that walks away from beside a soldier', () => {
  const d = armed(['sentinel'], { damage: 0 })
  d.alien.stance = 'standoff'
  const events = untilAlienShoots(d)
  expect(events).toContainEqual(expect.objectContaining({ type: 'shot', id: d.soldier.id, with: ['sentinel'] }))
})

test('a snaring soldier shoots the alien closing in over an equal shot at one that keeps its distance', () => {
  const d = armed(['snare'], { damage: 0 })
  d.alien.stats = { ...d.alien.stats, move: 0 }
  d.alien.stance = 'anchor'
  const rusher = another(d, 1, -1)
  rusher.stats = { ...rusher.stats, range: 1, move: 0 }
  const [shot] = untilAlienShoots(d).filter((e) => e.type === 'shot' && e.id === d.soldier.id)
  expect(shot).toMatchObject({ target: rusher.id })
})

test("a soldier's kills, damage and feats are credited to it", () => {
  const d = duel({ weapon: 'rifle', rarity: 'common', name: 'Rifle', stats: {}, effect: null })
  d.soldier.stats = { ...d.soldier.stats, damage: 120, crit: 0 }
  while (d.alien.hp > 0) d.step()
  expect(d.battle.tally[d.soldier.soldier!]).toMatchObject({ kills: 1, dealt: 99, feats: ['overkill', 'oneShot'] })
})

test('cryo rounds chill the target, an icebreaker hits a chilled one harder, and permafrost adds a stack to each chill', () => {
  const d = armed(['icebreak', 'permafrost'])
  d.soldier.ability = 'cryo'
  const events = []
  while (d.battle.turn === 'human' || d.battle.beat < 2) events.push(...d.step())
  const shots = events.filter((e) => e.type === 'shot' && e.id === d.soldier.id)
  expect(shots[0]).toMatchObject({ damage: 1 })
  expect(shots[1]).toMatchObject({ damage: 1 + SEARING_DAMAGE })
  // Two attacks of two stacks each: past CHILL_FREEZE it freezes, loses its action, and thaws with no chill.
  expect(events).toContainEqual(expect.objectContaining({ type: 'effect', id: d.alien.id, effect: 'frozen', amount: 0 }))
  expect(events).toContainEqual({ type: 'frozen', id: d.alien.id })
  expect(d.alien).toMatchObject({ frozen: false, chill: 0 })
})

test('incendiary rounds set the target burning, and searing hits a burning one harder', () => {
  const d = armed(['tinder', 'searing'])
  const shots = () => untilAlienShoots(d).filter((e) => e.type === 'shot' && e.id === d.soldier.id)
  expect(shots()[0]).toMatchObject({ damage: 1 })
  expect(d.alien.burn).toBeGreaterThan(0)
  expect(shots()[0]).toMatchObject({ damage: 1 + SEARING_DAMAGE })
})

test('napalm blasts aliens standing together, setting them burning and the ground alight', () => {
  const d = armed([])
  Object.assign(d.soldier, { ability: 'napalm', charges: 1 })
  d.alien.y = 13
  const other = another(d, 1, 0)
  const events = untilAlienShoots(d)
  expect(events).toContainEqual(expect.objectContaining({ type: 'rocket', id: d.soldier.id, fire: true }))
  expect(d.soldier.charges).toBe(0)
  expect([d.alien.burn, other.burn].every((turns) => turns > 0)).toBe(true)
  expect(d.battle.fire).toContainEqual(expect.objectContaining({ x: 10, y: 13 }))
})

test('a fire suit keeps its wearer from burning in fire', () => {
  const d = armed(['fireSuit'])
  d.battle.fire.push({ x: d.soldier.x, y: d.soldier.y, turns: 9 })
  untilAlienShoots(d)
  expect(d.soldier.burn).toBe(0)
})

test('a kill on a burning alien spreads the fire to those beside it, with backdraft', () => {
  const d = armed(['backdraft'], { damage: 5 })
  Object.assign(d.alien, { hp: 1, burn: 9 })
  const other = another(d, 1, 0)
  const events = []
  while (d.alien.hp > 0) events.push(...d.step())
  expect(effectsOf(events, 'backdraft')).toContainEqual(expect.objectContaining({ type: 'effect', id: other.id, effect: 'backdraft', amount: 0 }))
})
