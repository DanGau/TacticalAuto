import { expect, test } from 'vitest'
import { arena } from './arena'
import { BLOODBATH_HEAL, TESLA } from './keystones'
import { upkeep } from './upkeep'

const shots = (events: { type: string }[]) => events.filter((e) => e.type === 'shot') as { type: 'shot'; id: number; target: number; crit: boolean; damage: number }[]

test('Bloodbath: a kill heals and adds damage for the battle', () => {
  const { hero, aliens, beats } = arena(['bloodbath'], [{ x: 11, y: 10 }, { x: 12, y: 12 }])
  Object.assign(aliens[0], { hp: 1 })
  hero.hp = 2
  beats(1)
  expect(hero.hp).toBe(2 + BLOODBATH_HEAL)
  expect(hero.fury).toBe(1)
})

test('Riposte: whoever hits the hero takes its damage back', () => {
  const { battle, hero, aliens, beats } = arena(['riposte'], [{ x: 11, y: 10 }])
  hero.stats = { ...hero.stats, damage: 0 }
  battle.turn = 'alien'
  beats(2)
  expect(aliens[0].hp).toBe(40)
  hero.stats = { ...hero.stats, damage: 5 }
  beats(6)
  expect(aliens[0].hp).toBeLessThan(40)
})

test('Earthshaker: Heroic Leap comes back every turn', () => {
  const { hero, beats } = arena(['leap', 'earthshaker'], [{ x: 14, y: 10 }, { x: 14, y: 11 }])
  hero.stats = { ...hero.stats, move: 4 }
  const events = beats(1)
  expect(events.some((e) => e.type === 'move' && e.with === 'leap')).toBe(true)
  expect(hero.spent).not.toContain('leap')
})

test('Impact: Meteor Strike falls on a lone alien, harder', () => {
  const { hero, aliens, beats } = arena(['impact'], [{ x: 14, y: 10 }])
  Object.assign(hero, { ability: 'rocket', charges: 1 })
  beats(1)
  expect(aliens[0].hp).toBe(40 - 8)
  expect(hero.charges).toBe(0)
})

test('Fortress and Sacred Ground halve a hit; Intangible lets some pass through', () => {
  for (const effect of ['fortress', 'sacredGround'] as const) {
    const { battle, hero, aliens, beats } = arena([effect], [{ x: 11, y: 10 }])
    Object.assign(aliens[0], { stats: { ...aliens[0].stats, damage: 6 } })
    hero.stats = { ...hero.stats, damage: 0 }
    Object.assign(hero, { hp: 50 })
    battle.turn = 'alien'
    expect(shots(beats(2)).find((s) => s.id === aliens[0].id)?.damage).toBe(3)
  }
  const { battle, hero, aliens, beats } = arena(['intangible'], [{ x: 11, y: 10 }])
  Object.assign(aliens[0], { stats: { ...aliens[0].stats, damage: 2 } })
  hero.stats = { ...hero.stats, damage: 0 }
  Object.assign(hero, { hp: 500 })
  battle.turn = 'alien'
  const taken = shots(beats(200)).filter((s) => s.id === aliens[0].id).map((s) => s.damage)
  expect(taken).toContain(0)
  expect(taken.some((d) => d > 0)).toBe(true)
})

test('Aftershock and Shardstorm hurt those beside the target; Shardstorm chills them', () => {
  for (const effect of ['aftershock', 'shardstorm'] as const) {
    const { aliens, beats } = arena([effect], [{ x: 11, y: 10 }, { x: 12, y: 10 }])
    const [hit] = shots(beats(1))
    const other = aliens.find((a) => a.id !== hit.target)!
    expect(other.hp).toBe(38)
    expect(other.chilled > 0).toBe(effect === 'shardstorm')
  }
})

test('Sure Shot crits standing still; Apex Predator marks, then crits the marked', () => {
  const still = arena(['sureShot'], [{ x: 11, y: 10 }])
  still.hero.stats = { ...still.hero.stats, crit: 0 }
  expect(shots(still.beats(1))[0].crit).toBe(true)
  const apex = arena(['apex'], [{ x: 11, y: 10 }])
  apex.hero.stats = { ...apex.hero.stats, crit: 0 }
  expect(shots(apex.beats(1))[0].crit).toBe(false)
  expect(apex.aliens[0].marked).toBe(true)
  apex.aliens[0].resists = []
  apex.hero.effects.push('apex')
  apex.battle.turn = 'human'
  apex.battle.shooter = 0
  expect(shots(apex.beats(1))[0].crit).toBe(true)
})

test('Ghost Shot fires through a wall and past armor', () => {
  const { battle, aliens, beats } = arena(['psionic'], [{ x: 14, y: 10 }])
  aliens[0].armor = 9
  battle.west[10 * 96 + 12] = 'wall'
  expect(shots(beats(1))[0].target).toBe(aliens[0].id)
  expect(aliens[0].armor).toBe(9)
})

test('War Machine builds a stronger mech; Endless Swarm builds a drone a turn, up to its limit', () => {
  const mech = arena(['warMachine'], [{ x: 14, y: 10 }])
  Object.assign(mech.hero, { ability: 'mech', charges: 1 })
  mech.beats(1)
  expect(mech.battle.units.find((u) => u.summoner !== null)!.stats.hp).toBe(13)
  const swarm = arena(['swarm', 'endlessSwarm'], [{ x: 14, y: 10 }])
  for (let i = 0; i < 8; i++) upkeep(swarm.battle)
  expect(swarm.battle.units.filter((u) => u.summoner !== null)).toHaveLength(5)
  swarm.battle.units = swarm.battle.units.filter((u) => u.summoner === null)
  for (let i = 0; i < 20; i++) {
    upkeep(swarm.battle)
    swarm.battle.units = swarm.battle.units.filter((u) => u.summoner === null)
  }
  expect(swarm.hero.spent.filter((e) => e === 'endlessSwarm')).toHaveLength(10)
})

test('Tesla Coil arcs to the nearest aliens after the hero acts', () => {
  const { hero, beats, aliens } = arena(['tesla'], [{ x: 11, y: 10 }, { x: 12, y: 10 }, { x: 13, y: 10 }, { x: 14, y: 12 }])
  hero.secondary = 'pistol'
  const bolts = beats(2).filter((e) => e.type === 'shot' && e.with.includes('tesla'))
  expect(bolts).toHaveLength(TESLA.bolts)
  expect(aliens.filter((a) => a.hp < 40).length).toBeGreaterThanOrEqual(TESLA.bolts)
})

test('Font of Life heals every wounded ally in reach at one use', () => {
  const { battle, hero, beats } = arena(['fontOfLife'], [{ x: 16, y: 10 }])
  Object.assign(hero, { ability: 'medic', charges: 2, hp: hero.stats.hp - 1 })
  const mate = { ...hero, id: 500, soldier: 99, x: 11, y: 11, hp: hero.stats.hp - 1 }
  battle.units.push(mate)
  const heals = beats(1).filter((e) => e.type === 'heal')
  expect(heals).toHaveLength(2)
  expect(hero.charges).toBe(1)
})

test('Command: the ally who hits hardest attacks after the hero acts', () => {
  const { battle, hero, beats } = arena(['command'], [{ x: 11, y: 10 }])
  hero.secondary = 'pistol'
  const mate = { ...hero, id: 500, soldier: 99, x: 11, y: 11, effects: [], secondary: undefined }
  battle.units.push(mate)
  expect(shots(beats(2)).some((s) => s.id === mate.id)).toBe(true)
})

test('Firestorm gives a Fireball back on a kill', () => {
  const { hero, aliens, beats } = arena(['firestorm'], [{ x: 13, y: 10 }, { x: 14, y: 10 }])
  Object.assign(hero, { ability: 'napalm', charges: 1 })
  aliens[0].hp = 1
  beats(1)
  expect(hero.charges).toBe(1)
})

test('Conflagration burns harder and spreads; Hellfire sets aliens near the hero burning', () => {
  const fire = arena(['conflagration'], [{ x: 14, y: 10 }, { x: 15, y: 10 }])
  fire.aliens[0].burning = 2
  fire.battle.turn = 'alien'
  upkeep(fire.battle)
  expect(fire.aliens[0].hp).toBe(37)
  expect(fire.aliens[1].burning).toBeGreaterThan(0)
  const hell = arena(['hellfire'], [{ x: 11, y: 10 }])
  hell.battle.turn = 'alien'
  upkeep(hell.battle)
  expect(hell.aliens[0].hp).toBe(39)
})

test('Frozen Heart freezes a chilled alien it hits; a boss stands firm', () => {
  const { aliens, beats } = arena(['frozenHeart'], [{ x: 11, y: 10 }])
  aliens[0].chilled = 2
  beats(1)
  expect(aliens[0].panicked).toBe(true)
  const big = arena(['frozenHeart'], [{ x: 11, y: 10 }])
  Object.assign(big.aliens[0], { chilled: 2, boss: true })
  big.beats(1)
  expect(big.aliens[0].panicked).toBe(false)
})

test('Glacial Armor returns in full each turn', () => {
  const { battle, hero } = arena(['glacialArmor'], [{ x: 16, y: 10 }])
  hero.stats = { ...hero.stats, armor: 5 }
  hero.armor = 0
  upkeep(battle)
  expect(hero.armor).toBe(5)
})

test('Living Shadow keeps the Cloak through an attack', () => {
  const { hero, beats } = arena(['livingShadow'], [{ x: 11, y: 10 }])
  hero.cloaked = 2
  beats(1)
  expect(hero.cloaked).toBe(2)
})

test('Blade Dance carries the bonus attack on to more aliens', () => {
  const { hero, beats } = arena(['bladeDance'], [{ x: 11, y: 10 }, { x: 12, y: 10 }, { x: 13, y: 10 }])
  hero.secondary = 'knives'
  const bonus = shots(beats(2)).filter((s) => 'secondary' in s)
  expect(new Set(bonus.map((s) => s.target)).size).toBe(3)
})
