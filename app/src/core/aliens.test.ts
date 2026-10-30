import { PATHS } from './skills'
import { expect, test } from 'vitest'
import { ALIENS, alienStats, HATCH_TURNS, muster, NODE_EVERY, PACKS, REGEN_HEAL, type AlienKind } from './aliens'
import { deploy, zoneOf, begun } from './roads'
import { apply } from './apply'
import { isSoldier, reshaped, ACID_DAMAGE, alienUnit, mechUnit, AMBUSH_AIM, BACKSTAB_DAMAGE, BURST_DAMAGE, REVIVE_HEALTH, PSI_BACKLASH, SPAWN_EVERY, SPIT_DAMAGE, GRID, HUNKER_DEFENSE, type Battle, type Unit } from './battle'
import { stepBattle, type GameEvent } from './combat'
import { odds } from './sight'

test('a mission musters packs its depth allows, for exactly its force, and a lone scout only to use up the last of it', () => {
  const rng = { rng: 5 }
  for (let depth = 0; depth < 6; depth++) {
    for (let force = 1; force < 12; force++) {
      const packs = muster(rng, force, depth)
      for (const pack of packs) expect(pack.from).toBeLessThanOrEqual(depth)
      expect(packs.reduce((sum, pack) => sum + pack.cost, 0)).toBe(force)
      expect(packs.filter((pack) => pack.cost === 1).length).toBeLessThanOrEqual(1)
    }
  }
  expect(new Set(PACKS.map((pack) => pack.name)).size).toBe(PACKS.length)
})

/**
 * A battle on open ground with one soldier at (10, 10) and the given aliens placed around it, all revealed.
 * The soldier never misses and never crits.
 */
function arena(aliens: { kind: AlienKind; x: number; y: number; boss?: boolean }[]): { battle: Battle; soldier: Unit; aliens: Unit[]; until: (done: (events: GameEvent[]) => boolean) => GameEvent[] } {
  const run = begun(1)
  run.soldiers[0].skills = [PATHS[run.soldiers[0].cls!][0].core]
  apply(run, { type: 'go', index: 1 })
  apply(run, { type: 'advance' })
  // A cold zone, so no drop pod impact lands in the fight.
  const zone = zoneOf(run.battle!, 'stealth')
  deploy(run, zone)
  const battle = run.battle!
  Object.assign(battle, { goal: 'exterminate', uplink: null, waves: [] })
  battle.ground.fill('pavement')
  battle.cover.fill(0)
  battle.height.fill(0)
  battle.props.fill('none')
  battle.north.fill('none')
  battle.west.fill('none')
  reshaped(battle)
  const soldier = battle.units.find(isSoldier)!
  Object.assign(soldier, { x: 10, y: 10, stance: 'anchor', ability: null, hp: 30, stats: { ...soldier.stats, hp: 30, aim: 2, crit: 0, damage: 3 } })
  const units = aliens.map(({ kind, x, y, boss = false }) => alienUnit(battle, { kind, stats: alienStats(kind, 0, 0), stance: ALIENS[kind].stance, boss, spawns: boss || (ALIENS[kind].spawns ?? false), target: false, resists: ALIENS[kind].resists }, { x, y }, 0))
  battle.units = [soldier, ...units]
  battle.pods = [{ name: 'Test', revealed: true, alert: true, stalking: false, ambushed: false, surprised: false, reeling: false, stalked: 0, guard: false, waypoint: { x: 0, y: 0 } }]
  battle.concealed = false
  const until = (done: (events: GameEvent[]) => boolean) => {
    const all: GameEvent[] = []
    for (let beats = 0; beats < 60; beats++) {
      all.push(...stepBattle(battle))
      if (done(all)) return all
    }
    throw new Error(`never happened; saw ${JSON.stringify(all)}`)
  }
  return { battle, soldier, aliens: units, until }
}

const has = (type: GameEvent['type']) => (events: GameEvent[]) => events.some((e) => e.type === type)

test('a swarmling attacks only from the next tile', () => {
  const { soldier, aliens, until } = arena([{ kind: 'swarmling', x: 10, y: 22 }])
  soldier.stats = { ...soldier.stats, move: 0, range: 0 }
  const events = until((all) => all.some((e) => e.type === 'shot' && e.id === aliens[0].id))
  const shot = events.findIndex((e) => e.type === 'shot' && e.id === aliens[0].id)
  expect(events.slice(0, shot).some((e) => e.type === 'move' && e.id === aliens[0].id)).toBe(true)
  expect(Math.max(Math.abs(aliens[0].x - 10), Math.abs(aliens[0].y - 10))).toBe(1)
})

test("a spitter's spit always lands and leaves acid that burns a unit that stays in it", () => {
  const { battle, soldier, aliens, until } = arena([{ kind: 'spitter', x: 10, y: 16 }])
  aliens[0].hp = aliens[0].stats.hp = 99
  // Hold the soldier still, so it is in the acid after its side moves.
  soldier.stats = { ...soldier.stats, move: 0, range: 0 }
  const events = until(has('hurt'))
  expect(events).toContainEqual({ type: 'spit', id: aliens[0].id, target: soldier.id, damage: SPIT_DAMAGE })
  expect(events).toContainEqual({ type: 'hurt', id: soldier.id, amount: ACID_DAMAGE, cause: 'acid' })
  expect(battle.acid).toMatchObject([{ x: 10, y: 10 }])
})

test('a soldier free to move steps out of acid and is not burned by it', () => {
  const { soldier, aliens, until } = arena([{ kind: 'spitter', x: 10, y: 16 }])
  aliens[0].hp = aliens[0].stats.hp = 99
  const events = until((all) => all.filter((e) => e.type === 'spit').length >= 2)
  const spat = events.findIndex((e) => e.type === 'spit')
  expect(events.slice(spat).some((e) => e.type === 'move' && e.id === soldier.id)).toBe(true)
  // Stepping out each time, it takes the spit and never the acid.
  expect(events.some((e) => e.type === 'hurt')).toBe(false)
})

test('a burster explodes where it dies, hurting everything beside it', () => {
  const { soldier, aliens, until } = arena([
    { kind: 'burster', x: 10, y: 13 },
    { kind: 'trooper', x: 11, y: 13 },
  ])
  soldier.stats = { ...soldier.stats, move: 0, damage: 50 }
  aliens[1].hp = aliens[1].stats.hp = BURST_DAMAGE + 5
  aliens[0].stats = { ...aliens[0].stats, move: 0 }
  aliens[1].stats = { ...aliens[1].stats, move: 0, aim: 0 }
  const events = until(has('rocket'))
  expect(events).toContainEqual({ type: 'rocket', id: aliens[0].id, x: 10, y: 13, hits: [{ target: aliens[1].id, damage: BURST_DAMAGE }] })
  expect(aliens[1].hp).toBeLessThanOrEqual(5)
})

test('a burster beside a soldier blows itself up', () => {
  const { soldier, aliens, until } = arena([{ kind: 'burster', x: 10, y: 15 }])
  soldier.stats = { ...soldier.stats, move: 0, range: 0 }
  until(has('rocket'))
  expect(soldier.hp).toBe(30 - BURST_DAMAGE)
  expect(aliens[0].hp).toBeLessThanOrEqual(0)
})

test('a brute that survives a hit charges the shooter', () => {
  const { soldier, aliens, until } = arena([{ kind: 'brute', x: 10, y: 14 }])
  soldier.stats = { ...soldier.stats, move: 0, damage: 1 }
  const events = until(has('shot'))
  const shot = events.findIndex((e) => e.type === 'shot' && e.id === soldier.id)
  expect(events[shot + 1]).toMatchObject({ type: 'move', id: aliens[0].id })
  expect(aliens[0].y).toBe(14 - aliens[0].stats.move)
})

test('a psion panics a soldier, who loses its next action, and hurts its pod when it dies', () => {
  const { soldier, aliens, until } = arena([
    { kind: 'psion', x: 10, y: 15 },
    { kind: 'trooper', x: 16, y: 10 },
  ])
  soldier.stats = { ...soldier.stats, move: 0, damage: 50, range: 9 }
  aliens[1].stats = { ...aliens[1].stats, move: 0, aim: 0 }
  aliens[0].stats = { ...aliens[0].stats, move: 0 }
  // The soldier shoots first and would kill the psion, so make the psion outlast a turn of shots.
  aliens[0].hp = 150
  const events = until(has('frozen'))
  expect(events).toContainEqual({ type: 'panic', id: aliens[0].id, target: soldier.id })
  expect(events.at(-1)).toEqual({ type: 'frozen', id: soldier.id })
  const after = until(has('death'))
  expect(after).toContainEqual({ type: 'hurt', id: aliens[1].id, amount: PSI_BACKLASH, cause: 'backlash' })
})

test('a spawner spawns a swarmling every few alien turns', () => {
  const { battle, soldier, aliens, until } = arena([{ kind: 'trooper', x: 10, y: 25, boss: true }])
  soldier.stats = { ...soldier.stats, move: 0, range: 0 }
  aliens[0].stats = { ...aliens[0].stats, move: 0, range: 0 }
  expect(aliens[0].cooldown).toBe(SPAWN_EVERY)
  until(has('spawn'))
  expect(battle.units.filter((u) => u.kind === 'swarmling')).toHaveLength(1)
})

test("the first pod a concealed squad sights is ambushed: it does not move to cover, and is easier to hit until the squad's turn ends", () => {
  const { battle, soldier, aliens, until } = arena([{ kind: 'trooper', x: 10, y: 13 }])
  battle.concealed = true
  Object.assign(battle.pods[0], { revealed: false, alert: false })
  // An aim that hits only with the ambush bonus, against an alien that would otherwise walk to cover.
  soldier.stats = { ...soldier.stats, move: 0, aim: 1 - AMBUSH_AIM, close: 0, range: 7 }
  aliens[0].hp = aliens[0].stats.hp = 99
  battle.props[14 * GRID + 10] = 'stack'
  battle.cover[14 * GRID + 10] = 2
  soldier.x = 10
  soldier.y = 4
  // Stops 7 tiles off: inside the squad's notice, outside the patrol's.
  soldier.stats = { ...soldier.stats, move: 2 }
  const events = until((all) => all.some((e) => e.type === 'shot' && e.id === soldier.id))
  const reveal = events.find((e) => e.type === 'reveal')
  expect(reveal).toMatchObject({ ambush: true })
  expect(events.some((e) => e.type === 'move' && e.id === aliens[0].id)).toBe(false)
  expect(battle.concealed).toBe(false)
  expect(battle.pods[0].ambushed).toBe(true)
  until((all) => all.some((e) => e.type === 'shot' && e.id === aliens[0].id) || all.some((e) => e.type === 'move' && e.id === aliens[0].id))
  expect(battle.pods[0].ambushed).toBe(false)
})

test('a pod that notices the squad first stalks it unseen, then gives itself away when it opens fire', () => {
  const { battle, soldier, aliens, until } = arena([{ kind: 'trooper', x: 10, y: 22 }])
  Object.assign(battle.pods[0], { revealed: false, alert: false })
  battle.concealed = true
  soldier.stats = { ...soldier.stats, move: 0, range: 0 }
  // The trooper looks down from a hill: it notices the soldier from farther than the soldier notices it.
  for (let y = 20; y < 25; y++) for (let x = 8; x < 13; x++) battle.height[y * GRID + x] = 5
  aliens[0].stats = { ...aliens[0].stats, move: 0, range: 12 }
  const events = until((all) => all.some((e) => e.type === 'shot' && e.id === aliens[0].id))
  expect(events.findIndex((e) => e.type === 'reveal')).toBeLessThan(events.findIndex((e) => e.type === 'shot'))
  expect(events.find((e) => e.type === 'reveal')).toMatchObject({ ambush: false, stalked: true })
  expect(battle.concealed).toBe(false)
})

test('once every alert alien is dead, the squad slips back into stealth', () => {
  const { battle, aliens, until } = arena([{ kind: 'swarmling', x: 10, y: 12 }, { kind: 'trooper', x: 30, y: 30 }])
  // A second pod, far off and unaware, keeps the battle going.
  aliens[1].pod = 1
  battle.pods.push({ name: 'Far', revealed: false, alert: false, stalking: false, ambushed: false, surprised: false, reeling: false, stalked: 0, guard: false, waypoint: { x: 30, y: 30 } })
  battle.concealed = false
  until((all) => all.some((e) => e.type === 'death'))
  until(() => battle.concealed)
  expect(battle.pods[1].alert).toBe(false)
})

test('backstab adds damage against a target with no cover; shredder destroys armor before the damage lands', () => {
  for (const [effect, expected] of [['backstab', 3 + BACKSTAB_DAMAGE], ['shred', 3 + 2]] as const) {
    const { soldier, aliens, until } = arena([{ kind: 'trooper', x: 10, y: 13 }])
    soldier.effects = [effect]
    soldier.stats = { ...soldier.stats, move: 0 }
    aliens[0].stats = { ...aliens[0].stats, move: 0 }
    aliens[0].armor = 2
    until((all) => all.some((e) => e.type === 'shot' && e.id === soldier.id))
    // Armor takes the first two points unless it is shredded.
    expect(aliens[0].stats.hp - aliens[0].hp + (2 - aliens[0].armor)).toBe(expected)
  }
})

test('a soldier on overwatch shoots an alien that moves in its sights on the alien turn', () => {
  const { soldier, aliens, until } = arena([{ kind: 'swarmling', x: 10, y: 22 }])
  soldier.effects = ['overwatch']
  soldier.stats = { ...soldier.stats, move: 0, range: 4 }
  aliens[0].hp = aliens[0].stats.hp = 99
  const events = until((all) => all.some((e) => e.type === 'shot' && e.id === soldier.id))
  const shot = events.findIndex((e) => e.type === 'shot' && e.id === soldier.id)
  // The shot comes in the beat the alien moved, not in the soldier's own turn.
  expect(events[shot - 1]).toMatchObject({ type: 'move', id: aliens[0].id })
})

test('revive gets a fallen squadmate back up, once', () => {
  const { battle, soldier, aliens, until } = arena([{ kind: 'trooper', x: 10, y: 13 }])
  const medic: Unit = { ...structuredClone(soldier), id: 900, x: 11, y: 10, effects: ['revive'] }
  battle.units.push(medic)
  for (const unit of [soldier, medic]) unit.stats = { ...unit.stats, move: 0, range: 0 }
  soldier.hp = 1
  medic.hp = 500
  aliens[0].stats = { ...aliens[0].stats, move: 0, aim: 2, crit: 0 }
  const events = until((all) => all.some((e) => e.type === 'effect' && e.effect === 'revive'))
  expect(events).toContainEqual({ type: 'effect', id: soldier.id, effect: 'revive', amount: REVIVE_HEALTH })
  expect(battle.units).toContain(soldier)
  until((all) => all.some((e) => e.type === 'death' && e.id === soldier.id))
  expect(battle.units).not.toContain(soldier)
})

test('a shot names the skills that shaped it, and an extra shot names the skill that granted it, after its two', () => {
  const { soldier, aliens, until } = arena([{ kind: 'trooper', x: 10, y: 13 }])
  soldier.effects = ['backstab', 'doubleTap']
  soldier.stats = { ...soldier.stats, move: 0 }
  aliens[0].hp = aliens[0].stats.hp = 99
  aliens[0].stats = { ...aliens[0].stats, move: 0 }
  const shots = until((all) => all.filter((e) => e.type === 'shot' && e.id === soldier.id).length >= 3).filter((e) => e.type === 'shot' && e.id === soldier.id)
  expect(shots[0]).toMatchObject({ with: ['backstab'] })
  expect(shots[1]).toMatchObject({ with: ['backstab'] })
  expect(shots[2]).toMatchObject({ with: ['doubleTap', 'backstab'] })
})

test('a soldier whose skills pay for standing still holds a tile it can shoot from', () => {
  const { soldier, aliens, until } = arena([{ kind: 'trooper', x: 10, y: 13 }])
  soldier.effects = ['steady']
  // A rushing soldier, whose aim rises as it closes in, would close in.
  soldier.stance = 'rush'
  soldier.stats = { ...soldier.stats, aim: 0.4 }
  aliens[0].hp = aliens[0].stats.hp = 99
  aliens[0].stats = { ...aliens[0].stats, move: 0 }
  const start = { x: soldier.x, y: soldier.y }
  const events = until((all) => all.filter((e) => e.type === 'shot' && e.id === soldier.id).length >= 3)
  expect(events.some((e) => e.type === 'move' && e.id === soldier.id)).toBe(false)
  expect(soldier).toMatchObject(start)
})

test('an alien that can shoot a taunting soldier must, and cannot shoot a ghost from far off', () => {
  for (const [effect, shot] of [['taunt', true], ['ghost', false]] as const) {
    const { battle, soldier, aliens, until } = arena([{ kind: 'trooper', x: 10, y: 15 }])
    // A decoy nearer the alien than the soldier with the skill.
    const decoy: Unit = { ...structuredClone(soldier), id: 900, x: 11, y: 12, hp: 500 }
    battle.units.push(decoy)
    soldier.effects = [effect]
    soldier.hp = 500
    for (const unit of [soldier, decoy]) unit.stats = { ...unit.stats, move: 0, range: 0 }
    aliens[0].stats = { ...aliens[0].stats, move: 0 }
    const events = until((all) => all.filter((e) => e.type === 'shot').length >= 3)
    expect(events.some((e) => e.type === 'shot' && e.target === soldier.id)).toBe(shot)
    if (shot) expect(events.every((e) => e.type !== 'shot' || e.target === soldier.id)).toBe(true)
  }
})

test('cleave hurts the aliens beside a kill; a skirmisher steps away after its last attack', () => {
  const { soldier, aliens, until } = arena([
    { kind: 'swarmling', x: 10, y: 13 },
    { kind: 'trooper', x: 11, y: 13 },
  ])
  soldier.effects = ['cleave', 'skirmish']
  soldier.stats = { ...soldier.stats, damage: 50, move: 0 }
  aliens[0].stats = { ...aliens[0].stats, move: 0, range: 0 }
  aliens[1].stats = { ...aliens[1].stats, move: 0, range: 5 }
  aliens[1].hp = aliens[1].stats.hp = 99
  const events = until((all) => all.some((e) => e.type === 'death'))
  expect(events).toContainEqual({ type: 'effect', id: aliens[1].id, effect: 'cleave', amount: -2 })
  expect(aliens[1].hp).toBe(97)
  expect(events.some((e) => e.type === 'move')).toBe(false)
  const second = until((all) => all.some((e) => e.type === 'move'))
  expect(second).toContainEqual(expect.objectContaining({ type: 'shot', id: soldier.id, target: aliens[1].id }))
  expect(second.at(-1)).toMatchObject({ type: 'move', id: soldier.id, with: 'skirmish' })
})

test("a blademaster charges in and strikes from the next tile; a parry deflects a shot from beyond arm's reach", () => {
  const { soldier, aliens, until } = arena([{ kind: 'trooper', x: 10, y: 15 }])
  soldier.stance = 'rush'
  soldier.stats = { ...soldier.stats, range: 1, move: 6, damage: 1 }
  aliens[0].hp = aliens[0].stats.hp = 99
  aliens[0].stats = { ...aliens[0].stats, move: 0 }
  const events = until((all) => all.some((e) => e.type === 'shot' && e.id === soldier.id))
  expect(events[0]).toMatchObject({ type: 'move', id: soldier.id })
  expect(Math.max(Math.abs(soldier.x - aliens[0].x), Math.abs(soldier.y - aliens[0].y))).toBe(1)

  const duel = arena([{ kind: 'trooper', x: 10, y: 14 }])
  duel.soldier.effects = ['parry']
  duel.soldier.stats = { ...duel.soldier.stats, range: 1, move: 0, hp: 999 }
  duel.soldier.hp = 999
  duel.aliens[0].stats = { ...duel.aliens[0].stats, move: 0, aim: 2 }
  expect(duel.until((all) => all.some((e) => e.type === 'effect' && e.effect === 'parry'))).toContainEqual({ type: 'effect', id: duel.soldier.id, effect: 'parry', amount: 0 })
})

test('a psionic attack passes through a wall and ignores cover; a demolishing hit wrecks the cover around its target; twin guns add a third shot', () => {
  const psi = arena([{ kind: 'trooper', x: 10, y: 13 }])
  psi.battle.cover[12 * GRID + 10] = 2
  psi.soldier.effects = ['psionic']
  psi.soldier.stats = { ...psi.soldier.stats, range: 6, move: 0 }
  psi.aliens[0].stats = { ...psi.aliens[0].stats, move: 0, range: 0 }
  psi.aliens[0].hp = psi.aliens[0].stats.hp = 99
  expect(psi.until(has('shot'))).toContainEqual(expect.objectContaining({ type: 'shot', id: psi.soldier.id, hit: true }))

  const demo = arena([{ kind: 'trooper', x: 10, y: 13 }])
  demo.battle.cover[14 * GRID + 10] = 1
  demo.soldier.effects = ['demolish']
  demo.soldier.stats = { ...demo.soldier.stats, move: 0 }
  demo.aliens[0].stats = { ...demo.aliens[0].stats, move: 0, range: 0 }
  demo.aliens[0].hp = demo.aliens[0].stats.hp = 99
  expect(demo.until(has('shot'))).toContainEqual({ type: 'effect', id: demo.aliens[0].id, effect: 'demolish', amount: 0 })
  expect(demo.battle.cover[14 * GRID + 10]).toBe(0)

  const twin = arena([{ kind: 'trooper', x: 10, y: 13 }])
  twin.soldier.effects = ['twin']
  twin.soldier.stats = { ...twin.soldier.stats, move: 0 }
  twin.aliens[0].stats = { ...twin.aliens[0].stats, move: 0, range: 0 }
  twin.aliens[0].hp = twin.aliens[0].stats.hp = 99
  const shots = twin.until((all) => all.filter((e) => e.type === 'shot').length >= 3).filter((e) => e.type === 'shot' && e.id === twin.soldier.id)
  expect(shots).toHaveLength(3)
  expect(shots[1]).toMatchObject({ with: [] })
  expect(shots[2]).toMatchObject({ with: ['twin'] })
})

test('an engineer deploys a mech once aliens are in sight, credited with its kills; a mech alone cannot hold the field', () => {
  const { battle, soldier, until } = arena([{ kind: 'trooper', x: 10, y: 14 }])
  Object.assign(soldier, { ability: 'mech', charges: 1, effects: ['titan'] })
  until((events) => events.some((e) => e.type === 'spawn' && e.id === soldier.id))
  const mech = battle.units.find((u) => u.summoner === soldier.soldier)!
  expect(mech).toMatchObject({ side: 'human', stats: { hp: 14, damage: 4 } })
  expect(soldier.charges).toBe(0)
  Object.assign(soldier, { stats: { ...soldier.stats, damage: 0 } })
  until(() => battle.phase === 'over')
  expect(battle.tally[soldier.soldier!]?.kills).toBe(1)

  const lone = arena([{ kind: 'trooper', x: 10, y: 14 }])
  lone.battle.units.push(mechUnit(lone.battle, lone.soldier, { ...lone.soldier.stats }, [], { x: 11, y: 10 }))
  lone.battle.units = lone.battle.units.filter((u) => u !== lone.soldier)
  stepBattle(lone.battle)
  expect(lone.battle).toMatchObject({ phase: 'over', winner: 'alien' })
})

test('a dronemaster deploys drones that carry its skills, and a self-destructing mech blasts the aliens beside it', () => {
  const { battle, soldier, until } = arena([{ kind: 'trooper', x: 10, y: 14 }])
  Object.assign(soldier, { ability: 'mech', charges: 1, effects: ['swarm', 'hive', 'shock'] })
  until((events) => events.filter((e) => e.type === 'spawn').length === 3)
  const drones = battle.units.filter((u) => u.summoner === soldier.soldier)
  expect(drones).toHaveLength(3)
  expect(drones.every((d) => d.stats.hp === 4 && d.effects.includes('snare'))).toBe(true)

  const blast = arena([{ kind: 'trooper', x: 12, y: 10 }])
  const mech = mechUnit(blast.battle, blast.soldier, { ...blast.soldier.stats, hp: 1 }, ['detonate'], { x: 11, y: 10 })
  mech.hp = 1
  blast.battle.units.push(mech)
  const alien = blast.aliens[0]
  alien.stats = { ...alien.stats, move: 0 }
  Object.assign(blast.soldier, { stats: { ...blast.soldier.stats, damage: 0 } })
  const before = alien.hp
  blast.until((events) => events.some((e) => e.type === 'death' && e.id === mech.id))
  expect(alien.hp).toBeLessThanOrEqual(before - 4)
})

test("a juggernaut's plate stops a whole hit and loses one plate; a wraith takes 1 from anything but a crit", () => {
  const jug = arena([{ kind: 'juggernaut', x: 10, y: 13 }])
  jug.soldier.stats = { ...jug.soldier.stats, move: 0, damage: 50 }
  jug.aliens[0].stats = { ...jug.aliens[0].stats, move: 0, range: 0 }
  const plates = jug.aliens[0].armor
  jug.until((all) => all.some((e) => e.type === 'shot' && e.id === jug.soldier.id))
  expect(jug.aliens[0]).toMatchObject({ hp: jug.aliens[0].stats.hp, armor: plates - 1 })

  for (const crit of [0, 1]) {
    const { soldier, aliens, until } = arena([{ kind: 'wraith', x: 10, y: 13 }])
    soldier.stats = { ...soldier.stats, move: 0, damage: 5, crit }
    aliens[0].hp = aliens[0].stats.hp = 99
    aliens[0].stats = { ...aliens[0].stats, move: 0, range: 0 }
    const shot = until((all) => all.some((e) => e.type === 'shot' && e.id === soldier.id)).find((e) => e.type === 'shot' && e.id === soldier.id)
    expect(99 - aliens[0].hp).toBe(crit ? (shot as { damage: number }).damage : 1)
  }
})

test('an incubator does nothing, then hatches two brutes some alien turns after it is seen', () => {
  const { battle, soldier, aliens, until } = arena([{ kind: 'incubator', x: 10, y: 20 }])
  soldier.stats = { ...soldier.stats, move: 0, range: 0 }
  expect(aliens[0].cooldown).toBe(HATCH_TURNS)
  const events = until(has('spawn'))
  expect(events.some((e) => e.type === 'shot' && e.id === aliens[0].id)).toBe(false)
  expect(battle.round).toBe(HATCH_TURNS)
  expect(battle.units.filter((u) => u.kind === 'brute')).toHaveLength(2)
  expect(battle.units).not.toContain(aliens[0])
})

test('burrowers stay unseen underground, then surface beside the soldier standing most alone', () => {
  const { battle, soldier, aliens, until } = arena([
    { kind: 'burrower', x: 10, y: 17 },
    { kind: 'burrower', x: 11, y: 17 },
  ])
  const loner: Unit = { ...structuredClone(soldier), id: 900, x: 25, y: 25 }
  const mate: Unit = { ...structuredClone(soldier), id: 901, x: 11, y: 10 }
  battle.units.push(loner, mate)
  for (const unit of [soldier, loner, mate]) unit.stats = { ...unit.stats, move: 0, range: 0 }
  Object.assign(battle.pods[0], { revealed: false, alert: false })
  battle.concealed = true
  const events = until(has('reveal'))
  expect(events.find((e) => e.type === 'reveal')).toMatchObject({ stalked: true })
  for (const b of aliens) expect(Math.max(Math.abs(b.x - loner.x), Math.abs(b.y - loner.y))).toBe(1)
})

test('a feeder in sight grows on each trick the squad uses; a mirror hits as hard as the hardest-hitting soldier', () => {
  const { battle, soldier, aliens, until } = arena([{ kind: 'feeder', x: 10, y: 13 }])
  soldier.effects = ['grenade']
  soldier.stats = { ...soldier.stats, move: 0 }
  battle.units.push(alienUnit(battle, { kind: 'trooper', stats: alienStats('trooper', 0, 0), stance: 'balanced', boss: false, spawns: false, target: false, resists: [] }, { x: 11, y: 13 }, 0))
  aliens[0].hp = aliens[0].stats.hp = 99
  aliens[0].stats = { ...aliens[0].stats, move: 0, range: 0 }
  expect(until(has('feed'))).toContainEqual({ type: 'feed', id: aliens[0].id, damage: 1 })

  const glass = arena([{ kind: 'mirror', x: 10, y: 13 }])
  glass.soldier.stats = { ...glass.soldier.stats, move: 0, range: 0, damage: 9 }
  glass.aliens[0].stats = { ...glass.aliens[0].stats, move: 0, aim: 2, crit: 0 }
  const hit = glass.until((all) => all.some((e) => e.type === 'shot' && e.id === glass.aliens[0].id)).find((e) => e.type === 'shot' && e.id === glass.aliens[0].id)
  expect(hit).toMatchObject({ hit: true, damage: 9 })
})

test('a regenerator heals each turn unless burning; a chilled sprinter cannot move; a hive node keeps spawning', () => {
  for (const burning of [0, 5]) {
    const { aliens, until, soldier } = arena([{ kind: 'regenerator', x: 10, y: 20 }])
    soldier.stats = { ...soldier.stats, move: 0, range: 0 }
    aliens[0].stats = { ...aliens[0].stats, move: 0, range: 0 }
    aliens[0].hp = aliens[0].stats.hp - REGEN_HEAL - 2
    aliens[0].burning = burning
    const events = until(() => aliens[0].burning < burning || aliens[0].hp !== aliens[0].stats.hp - REGEN_HEAL - 2)
    expect(events.some((e) => e.type === 'effect' && e.effect === 'regen')).toBe(burning === 0)
  }

  const run = arena([{ kind: 'sprinter', x: 10, y: 25 }])
  run.soldier.stats = { ...run.soldier.stats, move: 0, range: 0 }
  run.aliens[0].chilled = 9
  const moves = run.until(() => run.battle.round >= 2)
  expect(moves.some((e) => e.type === 'move' && e.id === run.aliens[0].id)).toBe(false)

  const nest = arena([{ kind: 'hiveNode', x: 10, y: 25 }])
  nest.soldier.stats = { ...nest.soldier.stats, move: 0, range: 0 }
  nest.until(() => nest.battle.round >= 2 * NODE_EVERY + 1)
  expect(nest.battle.units.filter((u) => u.kind === 'swarmling').length).toBeGreaterThanOrEqual(2)
})

test('a guard pod holds its post while unaware, and fights once it notices the squad', () => {
  const { battle, soldier, aliens, until } = arena([{ kind: 'trooper', x: 30, y: 30 }])
  Object.assign(battle.pods[0], { revealed: false, alert: false, guard: true, waypoint: { x: 10, y: 10 } })
  soldier.stats = { ...soldier.stats, move: 0, range: 0 }
  until(() => battle.round >= 3)
  expect(aliens[0]).toMatchObject({ x: 30, y: 30 })
  Object.assign(soldier, { x: 30, y: 27 })
  until((all) => all.some((e) => e.type === 'shot' && e.id === aliens[0].id))
  expect(battle.pods[0].alert).toBe(true)
})

test('a turret never moves, and shoots a soldier in range', () => {
  const { soldier, aliens, until } = arena([{ kind: 'turret', x: 10, y: 16 }])
  soldier.stats = { ...soldier.stats, move: 0, range: 0 }
  const events = until((all) => all.some((e) => e.type === 'shot' && e.id === aliens[0].id))
  expect(events.some((e) => e.type === 'move' && e.id === aliens[0].id)).toBe(false)
  expect(aliens[0]).toMatchObject({ x: 10, y: 16 })
})

test('an ambushed pod reels: on its next turn it moves at most half its move and does not act; then it fights as normal', () => {
  const { battle, soldier, aliens, until } = arena([{ kind: 'trooper', x: 10, y: 13 }])
  battle.concealed = true
  Object.assign(battle.pods[0], { revealed: false, alert: false })
  soldier.stats = { ...soldier.stats, move: 2, aim: 0, close: 0, range: 7 }
  aliens[0].hp = aliens[0].stats.hp = 99
  soldier.x = 10
  soldier.y = 4
  until((all) => all.some((e) => e.type === 'reveal' && e.ambush))
  expect(battle.pods[0].reeling).toBe(true)
  until(() => battle.turn === 'alien')
  const reeling: GameEvent[] = []
  while (battle.turn === 'alien') reeling.push(...stepBattle(battle))
  for (const e of reeling) {
    if (e.type === 'move' && e.id === aliens[0].id) expect(e.path.length).toBeLessThanOrEqual(Math.ceil(aliens[0].stats.move / 2))
    expect(e.type === 'shot' && e.id === aliens[0].id).toBe(false)
  }
  expect(battle.pods[0].reeling).toBe(false)
  until((all) => all.some((e) => e.type === 'shot' && e.id === aliens[0].id))
})

/** A squadmate for the arena's soldier, beside it at full health. */
function squadmate(battle: Battle, soldier: Unit): Unit {
  const mate = { ...structuredClone(soldier), id: battle.nextId++, x: soldier.x + 2, y: soldier.y, soldier: soldier.soldier! + 1 }
  battle.units.push(mate)
  return mate
}

test('a soldier with no shot hunkers when wounded and exposed, harder to hit until its next turn', () => {
  const { battle, soldier, aliens, until } = arena([{ kind: 'trooper', x: 10, y: 14 }])
  Object.assign(battle, { turn: 'human', stage: 'move' })
  Object.assign(soldier, { hp: 5, stats: { ...soldier.stats, move: 0, range: 0 } })
  const mate = squadmate(battle, soldier)
  mate.hp = 30
  mate.stats = { ...mate.stats, move: 0, range: 0 }
  aliens[0].stats = { ...aliens[0].stats, move: 0 }
  const open = odds(battle, aliens[0], soldier, aliens[0].stats).hit
  const events = until((all) => all.some((e) => e.type === 'order'))
  expect(events).toContainEqual({ type: 'order', id: soldier.id, order: 'hunker' })
  expect(odds(battle, aliens[0], soldier, aliens[0].stats).hit).toBeCloseTo(Math.max(0, open - HUNKER_DEFENSE))
})

test('a soldier with no shot and an enemy that could reach it prepares, and shoots the first alien to come in range', () => {
  const { battle, soldier, aliens, until } = arena([{ kind: 'swarmling', x: 10, y: 16 }])
  Object.assign(battle, { turn: 'human', stage: 'move' })
  soldier.stats = { ...soldier.stats, move: 0, range: 3 }
  aliens[0].hp = aliens[0].stats.hp = 99
  expect(until((all) => all.some((e) => e.type === 'order'))).toContainEqual({ type: 'order', id: soldier.id, order: 'prepare' })
  const events = until((all) => all.some((e) => e.type === 'shot' && e.id === soldier.id))
  expect(events).toContainEqual(expect.objectContaining({ type: 'shot', id: soldier.id, with: expect.arrayContaining(['overwatch']) }))
  expect(battle.turn).toBe('alien')
})

test('a soldier with nothing in reach sprints, moving again in place of attacking, in a straight line', () => {
  const { battle, soldier, until } = arena([{ kind: 'trooper', x: 10, y: 45 }])
  const events = until((all) => all.some((e) => e.type === 'order')).slice(-2)
  expect(events).toContainEqual({ type: 'order', id: soldier.id, order: 'sprint' })
  const walked = events.find((e) => e.type === 'move' && e.id === soldier.id)
  expect(walked?.type === 'move' && walked.path.length).toBeGreaterThan(soldier.stats.move)
  // On open ground it walks straight, not weaving.
  expect(walked?.type === 'move' && walked.path.every((t) => t.x === 10)).toBe(true)
  expect(stepBattle(battle).some((e) => e.type === 'shot' && e.id === soldier.id)).toBe(false)
})

test('a soldier closing in stops short of where a known enemy could walk into range of it next turn', () => {
  const { battle, soldier, aliens } = arena([{ kind: 'trooper', x: 10, y: 22 }])
  soldier.stats = { ...soldier.stats, move: 4, range: 0 }
  aliens[0].stats = { ...aliens[0].stats, move: 4 }
  const reach = aliens[0].stats.move + aliens[0].stats.range
  while (battle.turn === 'alien' || !battle.units.some((u) => u === soldier && u.moved)) stepBattle(battle)
  expect(Math.abs(soldier.y - aliens[0].y)).toBeGreaterThan(reach)
  expect(soldier.y).toBeGreaterThan(10)
})
