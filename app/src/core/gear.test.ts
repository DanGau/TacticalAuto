import { PATHS, SKILLS } from './skills'
import { expect, test } from 'vitest'
import { deploy, zoneOf, begun } from './roads'
import { apply } from './apply'
import { alienUnit, CHILL_TURNS, CRIT_BONUS, SEARING_DAMAGE, SOLDIER_ATTACKS, GRID, type Battle, type Effect, type Stats, type Unit } from './battle'
import { stepBattle, type GameEvent } from './combat'
import { alienStats } from './aliens'
import { EFFECTS, generateGear, type Gear } from './gear'
import { SELL, soldierStats, type Run } from './run'
import { TUNING } from './tuning'

test('gear does one thing: commons a stat mod, rares a simple effect, epics an elaborate one, each for its slot', () => {
  const rng = { rng: 7 }
  for (let id = 0; id < 200; id++) {
    const rarity = (['common', 'rare', 'epic'] as const)[id % 3]
    const gear = generateGear(rng, id, rarity)
    expect(gear.name.split(' ').length).toBe(2)
    expect(gear.effect === null).toBe(rarity === 'common')
    expect(Object.keys(gear.stats).length > 0).toBe(rarity === 'common')
    if (gear.effect) expect([EFFECTS[gear.effect].slot, !!EFFECTS[gear.effect].epic]).toEqual([gear.slot, rarity === 'epic'])
  }
})

/** A run whose soldier has learned its first skill and found `gear`. */
function withFind(gear: Omit<Gear, 'id'>): Run {
  const run = begun(1)
  run.soldiers[0].skills = [PATHS[run.soldiers[0].cls!][0].core]
  run.finds.push({ soldier: run.soldiers[0].id, gear: { id: 1, ...gear } })
  run.phase = 'reward'
  return run
}

test('found gear is equipped on its finder, selling what it replaces, or sold; then the reward phase ends', () => {
  const vest = { slot: 'armor', rarity: 'common', name: 'Sturdy Vest', stats: { armor: 2 }, effect: null } as const
  const run = withFind(vest)
  const [soldier] = run.soldiers
  expect(soldierStats(run, soldier).armor).toBe(0)
  expect(apply(run, { type: 'keep' })).toEqual({ ok: true })
  expect(soldierStats(run, soldier).armor).toBe(2)
  expect(run).toMatchObject({ finds: [], phase: 'overworld' })
  const supplies = run.supplies
  run.finds.push({ soldier: soldier.id, gear: { id: 2, ...vest, rarity: 'rare', stats: { armor: 4 } } })
  run.phase = 'reward'
  apply(run, { type: 'keep' })
  expect(run.supplies).toBe(supplies + SELL.common)
  expect(soldier.gear.armor).toMatchObject({ id: 2 })
  run.finds.push({ soldier: soldier.id, gear: { id: 3, ...vest, rarity: 'epic' } })
  run.phase = 'reward'
  apply(run, { type: 'sell' })
  expect(run.supplies).toBe(supplies + SELL.common + SELL.epic)
  expect(soldier.gear.armor).toMatchObject({ id: 2 })
  expect(apply(run, { type: 'sell' }).ok).toBe(false)
})

/** A duel on open ground: one soldier wearing `gear`, one alien beside it, and the soldier too weak to win quickly. */
function duel(gear: Omit<Gear, 'id'>): { battle: Battle; soldier: Unit; alien: Unit; step: () => ReturnType<typeof stepBattle> } {
  const run = withFind(gear)
  apply(run, { type: 'keep' })
  apply(run, { type: 'go', index: 1 })
  apply(run, { type: 'advance' })
  // War drums pay off only on a kill, so they leave a duel as it is.
  // A cold zone, so no drop pod impact lands in the fight.
  const zone = zoneOf(run.battle!, 'stealth')
  deploy(run, zone)
  const battle = run.battle!
  Object.assign(battle, { goal: 'exterminate', uplink: null, waves: [], twist: null })
  battle.ground.fill('pavement')
  battle.props.fill('none')
  battle.cover.fill(0)
  battle.height.fill(0)
  battle.north.fill('none')
  battle.west.fill('none')
  const soldier = battle.units.find((u) => u.soldier === run.soldiers[0].id)!
  const alien = battle.units.find((u) => u.side === 'alien')!
  battle.units = [soldier, alien]
  battle.pods.forEach((pod) => Object.assign(pod, { revealed: true, alert: true }))
  // A soldier of no class in particular: it holds its ground and has no ability or class skill.
  Object.assign(soldier, { x: 10, y: 10, stance: 'anchor', ability: null, effects: soldier.effects.filter((e) => !Object.values(SKILLS).some((s) => s.effect === e)) })
  Object.assign(alien, { kind: 'trooper', x: 10, y: 11, hp: 99, armor: 0, target: false, stats: { ...alienStats('trooper', 0, 0), hp: 99, armor: 0, aim: 2, crit: 0 } })
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

test('warded armor absorbs the first hit and only the first', () => {
  const d = duel({ slot: 'armor', rarity: 'rare', name: 'Warded Sturdy Vest', stats: {}, effect: 'shield' })
  expect(untilAlienShoots(d)).toContainEqual({ type: 'effect', id: d.soldier.id, effect: 'shield', amount: 0 })
  expect(d.soldier.hp).toBe(d.soldier.stats.hp)
  untilAlienShoots(d)
  expect(d.soldier.hp).toBe(d.soldier.stats.hp - d.alien.stats.damage)
})

test('barbed armor wounds whoever hits its wearer', () => {
  const d = duel({ slot: 'armor', rarity: 'rare', name: 'Barbed Sturdy Vest', stats: {}, effect: 'thorns' })
  d.soldier.stats = { ...d.soldier.stats, damage: 0, crit: 0 }
  untilAlienShoots(d)
  expect(d.alien.hp).toBe(98)
})

test('a scorching weapon burns its target at the start of the target\'s turns', () => {
  const d = duel({ slot: 'weapon', rarity: 'rare', name: 'Scorching Steady Carbine', stats: { aim: 2 }, effect: 'incendiary' })
  d.soldier.stats = { ...d.soldier.stats, damage: 1, crit: 0 }
  const events = untilAlienShoots(d)
  expect(events).toContainEqual({ type: 'effect', id: d.alien.id, effect: 'incendiary', amount: 0 })
  expect(events).toContainEqual({ type: 'effect', id: d.alien.id, effect: 'incendiary', amount: -1 })
  expect(d.alien.hp).toBe(99 - SOLDIER_ATTACKS - 1)
})

test('a rimed weapon chills its target, and a shatterglass edge and thermal shock core pay off on it', () => {
  const d = duel({ slot: 'weapon', rarity: 'rare', name: 'Rimed Steady Carbine', stats: { aim: 2 }, effect: 'frostbite' })
  d.soldier.stats = { ...d.soldier.stats, damage: 2, crit: 0 }
  d.soldier.effects.push('shatter', 'thermal')
  const shots = () => {
    const events = untilAlienShoots(d)
    return events.filter((e) => e.type === 'shot' && e.id === d.soldier.id)
  }
  const [first] = shots()
  expect(first).toMatchObject({ hit: true, damage: 2 })
  expect(d.alien.chilled).toBeGreaterThan(0)
  d.alien.burning = 5
  const [second] = shots()
  expect(second).toMatchObject({ hit: true, damage: 2 + TUNING.shatterDamage + TUNING.thermalDamage })
})

test('an alien that resists frost and burn is neither chilled nor set burning', () => {
  const d = duel({ slot: 'weapon', rarity: 'rare', name: 'Rimed Steady Carbine', stats: { aim: 2 }, effect: 'frostbite' })
  d.soldier.stats = { ...d.soldier.stats, damage: 1, crit: 0 }
  d.soldier.effects.push('incendiary')
  d.alien.resists = ['frost', 'burn']
  untilAlienShoots(d)
  expect(d.alien.chilled).toBe(0)
  expect(d.alien.burning).toBe(0)
})

test('overkill coils carry damage beyond a kill to the nearest other alien', () => {
  const d = duel({ slot: 'weapon', rarity: 'rare', name: 'Steady Carbine', stats: { aim: 2 }, effect: null })
  d.soldier.stats = { ...d.soldier.stats, damage: 10, crit: 0 }
  d.soldier.effects.push('overkill')
  d.alien.hp = 4
  d.alien.armor = 0
  const other = alienUnit(d.battle, { kind: 'trooper', stats: { ...d.alien.stats, hp: 99, armor: 0 }, stance: 'anchor', boss: false, spawns: false, target: false, resists: [] }, { x: d.alien.x + 1, y: d.alien.y }, 0)
  d.battle.units.push(other)
  const events = []
  while (d.alien.hp > 0) events.push(...d.step())
  const shot = events.find((e) => e.type === 'shot' && e.target === d.alien.id && e.hit)
  expect(shot).toBeDefined()
  expect(events).toContainEqual({ type: 'effect', id: other.id, effect: 'overkill', amount: -(shot!.type === 'shot' ? shot!.damage - 4 : 0) })
})

/** Another alien in the duel, at `dx`, `dy` from the first, too tough to die. */
function another(d: ReturnType<typeof duel>, dx: number, dy: number): Unit {
  const other = alienUnit(d.battle, { kind: 'trooper', stats: { ...d.alien.stats, hp: 99, armor: 0 }, stance: 'anchor', boss: false, spawns: false, target: false, resists: [] }, { x: d.alien.x + dx, y: d.alien.y + dy }, 0)
  d.battle.units.push(other)
  return other
}

/** A duel with the soldier holding `effects` and the given stats. */
function armed(effects: Effect[], stats: Partial<Stats> = {}) {
  const d = duel({ slot: 'weapon', rarity: 'rare', name: 'Carbine', stats: {}, effect: null })
  d.soldier.effects.push(...effects)
  d.soldier.stats = { ...d.soldier.stats, aim: 2, crit: 0, damage: 1, ...stats }
  return d
}

const effectsOf = (events: GameEvent[], effect: Effect) => events.filter((e) => e.type === 'effect' && e.effect === effect)

test('a ricochet bounces a miss to another alien near the target', () => {
  const d = armed(['ricochet'], { aim: -9 })
  const other = another(d, 1, 0)
  const events = untilAlienShoots(d)
  expect(events).toContainEqual(expect.objectContaining({ type: 'shot', id: d.soldier.id, target: other.id, with: ['ricochet'] }))
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
  expect(events).toContainEqual({ type: 'effect', id: other.id, effect: 'volatile', amount: -2 })
})

test('a thundering hit knocks the target back, or slams it into what stops it', () => {
  const d = armed(['thunder'])
  const events = untilAlienShoots(d)
  expect(events).toContainEqual({ type: 'move', id: d.alien.id, path: [{ x: 10, y: 12 }], with: 'thunder' })
  another(d, 0, 1)
  expect(effectsOf(untilAlienShoots(d), 'thunder')).toEqual(Array(SOLDIER_ATTACKS).fill({ type: 'effect', id: d.alien.id, effect: 'thunder', amount: -1 }))
})

test('mirror images pop in place of hits, two at most', () => {
  const d = duel({ slot: 'armor', rarity: 'rare', name: 'Mirrored Vest', stats: {}, effect: 'mirror' })
  d.soldier.stats = { ...d.soldier.stats, hp: 999, damage: 0 }
  d.soldier.hp = 999
  const events = Array.from({ length: 20 }, () => untilAlienShoots(d)).flat()
  expect(effectsOf(events, 'mirror')).toHaveLength(2)
})

test('a bonded squadmate takes the hit meant for the soldier beside it', () => {
  const d = armed([], { damage: 0 })
  const guard: Unit = { ...d.soldier, id: 999, x: 9, y: 10, effects: ['bond'], spent: [] }
  d.battle.units.push(guard)
  d.alien.stats = { ...d.alien.stats, range: 1 }
  d.soldier.effects.push('taunt')
  const events = untilAlienShoots(d)
  const shot = events.find((e) => e.type === 'shot' && e.id === d.alien.id)!
  expect(events).toContainEqual({ type: 'effect', id: guard.id, effect: 'bond', amount: -(shot.type === 'shot' ? shot.damage : 0) })
  expect(d.soldier.hp).toBe(d.soldier.stats.hp)
})

test('spirit guardians strike an alien that ends its move near the wearer', () => {
  const d = armed(['guardians'], { damage: 0 })
  d.alien.stats = { ...d.alien.stats, move: 0 }
  expect(effectsOf(untilAlienShoots(d), 'guardians')).toContainEqual({ type: 'effect', id: d.alien.id, effect: 'guardians', amount: -1 })
})

test('blinking gear carries a soldier hit to half health to safety, once', () => {
  const d = armed(['blink'], { damage: 0 })
  d.soldier.armor = 0
  d.alien.stats = { ...d.alien.stats, damage: d.soldier.stats.hp - 1 }
  const events = untilAlienShoots(d)
  expect(events).toContainEqual(expect.objectContaining({ type: 'move', id: d.soldier.id, with: 'blink' }))
  expect(d.soldier.spent).toContain('blink')
})

test('a chicken claw turns an alien into a chicken that loses its next action', () => {
  const d = armed(['polymorph'], { damage: 0 })
  const events = untilAlienShoots(d)
  expect(events).toContainEqual({ type: 'effect', id: d.alien.id, effect: 'polymorph', amount: 0 })
  expect(events).toContainEqual({ type: 'frozen', id: d.alien.id })
})

test('a null field stops a spitter spitting', () => {
  const d = armed(['null'], { damage: 0 })
  d.alien.kind = 'spitter'
  d.alien.stats = { ...d.alien.stats, move: 0 }
  expect(untilAlienShoots(d).some((e) => e.type === 'spit')).toBe(false)
})

test('a pyre censer sets the ground under a burning alien ablaze', () => {
  const d = armed(['pyre'], { damage: 0, aim: -9 })
  d.alien.burning = 3
  const { x, y } = d.alien
  untilAlienShoots(d)
  expect(d.battle.fire).toContainEqual(expect.objectContaining({ x, y }))
})

test('a stasis field freezes a chilled alien a crit lands on', () => {
  const d = armed(['stasis'], { crit: 1 })
  d.alien.chilled = 5
  const events = untilAlienShoots(d)
  expect(events).toContainEqual({ type: 'effect', id: d.alien.id, effect: 'stasis', amount: 0 })
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
  expect(events).toContainEqual({ type: 'effect', id: d.alien.id, effect: 'booming', amount: -3 })
})

test('a tethered hit pulls its target a tile toward the shooter', () => {
  const d = armed(['tether'])
  Object.assign(d.alien, { x: 10, y: 13 })
  d.alien.stats = { ...d.alien.stats, move: 0 }
  expect(untilAlienShoots(d)).toContainEqual({ type: 'move', id: d.alien.id, path: [{ x: 10, y: 12 }], with: 'tether' })
})

test('caltrops are strewn in the path of an alien closing in', () => {
  const d = armed(['caltrops'], { damage: 0 })
  Object.assign(d.alien, { x: 10, y: 15 })
  d.alien.stats = { ...d.alien.stats, range: 1 }
  untilAlienShoots(d)
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
  expect(effectsOf(events, 'caltrops')).toContainEqual({ type: 'effect', id: d.alien.id, effect: 'caltrops', amount: -1 })
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
  const d = duel({ slot: 'armor', rarity: 'common', name: 'Light Vest', stats: {}, effect: null })
  d.soldier.stats = { ...d.soldier.stats, damage: 120, crit: 0 }
  while (d.alien.hp > 0) d.step()
  expect(d.battle.tally[d.soldier.soldier!]).toMatchObject({ kills: 1, dealt: 99, feats: ['overkill', 'oneShot'] })
})

test('cryo rounds chill the target; an icebreaker hits a chilled one harder, and permafrost holds the chill longer', () => {
  const d = armed(['icebreak', 'permafrost'])
  d.soldier.ability = 'cryo'
  const shots = () => untilAlienShoots(d).filter((e) => e.type === 'shot' && e.id === d.soldier.id)
  expect(shots()[0]).toMatchObject({ hit: true, damage: 1 })
  expect(d.alien.chilled).toBeGreaterThan(CHILL_TURNS)
  expect(shots()[0]).toMatchObject({ hit: true, damage: 1 + SEARING_DAMAGE })
})

test('incendiary rounds set the target burning, and searing hits a burning one harder', () => {
  const d = armed(['tinder', 'searing'])
  const shots = () => untilAlienShoots(d).filter((e) => e.type === 'shot' && e.id === d.soldier.id)
  expect(shots()[0]).toMatchObject({ hit: true, damage: 1 })
  expect(d.alien.burning).toBeGreaterThan(0)
  expect(shots()[0]).toMatchObject({ hit: true, damage: 1 + SEARING_DAMAGE })
})

test('napalm blasts aliens standing together, setting them burning and the ground alight', () => {
  const d = armed([])
  Object.assign(d.soldier, { ability: 'napalm', charges: 1 })
  d.alien.y = 13
  const other = another(d, 1, 0)
  const events = untilAlienShoots(d)
  expect(events).toContainEqual(expect.objectContaining({ type: 'rocket', id: d.soldier.id, fire: true }))
  expect(d.soldier.charges).toBe(0)
  expect([d.alien.burning, other.burning].every((turns) => turns > 0)).toBe(true)
  expect(d.battle.fire).toContainEqual(expect.objectContaining({ x: 10, y: 13 }))
})

test('a fire suit keeps its wearer from burning in fire', () => {
  const d = armed(['fireSuit'])
  d.battle.fire.push({ x: d.soldier.x, y: d.soldier.y, turns: 9 })
  untilAlienShoots(d)
  expect(d.soldier.burning).toBe(0)
})

test('a kill on an alien burning and chilled spreads both to those beside it, with backdraft and avalanche', () => {
  const d = armed(['backdraft', 'avalanche'], { damage: 5 })
  Object.assign(d.alien, { hp: 1, burning: 9, chilled: 9 })
  const other = another(d, 1, 0)
  const events = []
  while (d.alien.hp > 0) events.push(...d.step())
  expect(effectsOf(events, 'backdraft')).toContainEqual({ type: 'effect', id: other.id, effect: 'backdraft', amount: 0 })
  expect(effectsOf(events, 'avalanche')).toContainEqual({ type: 'effect', id: other.id, effect: 'avalanche', amount: 0 })
})
