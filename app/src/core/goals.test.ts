import { PATHS } from './skills'
import { expect, test } from 'vitest'
import { apply } from './apply'
import { stepBattle, UPLINK_REACH, type GameEvent } from './combat'
import { CIVILIAN_SUPPLIES, CIVILIANS, CIVILIANS_PER_THREAT, HOLD_ROUNDS, type Goal } from './goals'
import { distance, edgeDepths, freeTilesNear, GRID, INNER, isSoldier, revealed } from './battle'
import { road, deploy, begun } from './roads'
import { endBattle, LOSS_THREAT, RISKS, START_SUPPLIES, STOP_THREAT, THREAT_MAX, XP, type Run } from './run'

/** A run about to fight a battle of `goal`, with three packs to muster. */
function before(goal: Goal): Run {
  const run = begun(1)
  run.soldiers[0].skills = [PATHS[run.soldiers[0].cls!][0].core]
  apply(run, { type: 'go', index: 1 })
  const patrol = { name: 'Patrol', kinds: ['trooper', 'trooper'] as const }
  road(run, [{ kind: 'battle', risk: 'standard', goal, terrain: 'town', twist: null, packs: [patrol, patrol, patrol].map((p) => ({ ...p, kinds: [...p.kinds] })) }])
  apply(run, { type: 'advance' })
  return run
}

test('every battle on the leg under way has its aliens mustered in advance; no other stop has any', () => {
  const run = begun(1)
  for (const node of run.legs[0].columns.flat()) expect(node.stop!.packs.length > 0).toBe(node.stop!.kind === 'battle')
})

test('a hold sets its uplink within, the squad coming at it from the edge; once held, it is won only when the squad left reaches the extraction zone in the edge', () => {
  const run = before('hold')
  const battle = run.battle!
  expect(battle.plans).toEqual(['march', 'march', 'march'])
  expect(battle.uplink).not.toBeNull()
  expect(battle.waves).toHaveLength(1)
  deploy(run, 1)
  battle.held = HOLD_ROUNDS
  while (!battle.escape) stepBattle(battle)
  expect(battle.phase).toBe('battle')
  expect(battle.uplink).toBeNull()
  const depth = edgeDepths(battle)[battle.escape.y * GRID + battle.escape.x]
  expect(depth).toBeLessThanOrEqual(INNER)
  // Waves keep coming as the squad extracts.
  expect(battle.waves.length).toBeGreaterThan(0)
  const soldiers = battle.units.filter(isSoldier)
  freeTilesNear(battle, battle.escape, soldiers.length).forEach((tile, i) => Object.assign(soldiers[i], tile))
  while (battle.phase === 'battle') stepBattle(battle)
  expect(battle.winner).toBe('human')
  expect(battle.escaped).toHaveLength(soldiers.length)
  endBattle(run)
  expect(run.report!.soldiers.every((s) => !s.taken)).toBe(true)
  expect(run.relicOffers).toHaveLength(3)
  expect(run.finds).toEqual([])
})

test("a hold's waves come in from the edges, each pack larger every time it returns", () => {
  const run = before('hold')
  const battle = run.battle!
  deploy(run, 0)
  // The squad holds out for as many waves as it takes.
  for (const soldier of battle.units.filter(isSoldier)) soldier.hp = 999
  const size = battle.waves[0].aliens.length
  for (let wave = 0; wave < 2 && battle.phase === 'battle'; ) {
    for (const e of stepBattle(battle)) {
      if (e.type !== 'wave') continue
      wave++
      for (const at of e.units) expect(edgeDepths(battle)[at.y * GRID + at.x]).toBeLessThanOrEqual(INNER + 2)
    }
  }
  expect(battle.waves[0].aliens.length).toBe(size + 2)
})

test('a hold counts only the rounds the squad ends inside the uplink zone', () => {
  const run = before('hold')
  const battle = run.battle!
  deploy(run, 0)
  while (battle.round < 3 && battle.phase === 'battle') {
    const [round, held] = [battle.round, battle.held]
    stepBattle(battle)
    if (battle.round > round) expect(battle.held - held).toBe(battle.units.some((u) => isSoldier(u) && Math.max(Math.abs(u.x - battle.uplink!.x), Math.abs(u.y - battle.uplink!.y)) <= UPLINK_REACH) ? 1 : 0)
  }
  expect(battle.held).toBeLessThan(battle.round + 1)
})

test('an assassination is won when the commander falls, though its guard lives', () => {
  const run = before('assassinate')
  const battle = run.battle!
  deploy(run, 0)
  const commander = battle.units.filter((u) => u.target)
  expect(commander).toHaveLength(1)
  expect(battle.units.filter((u) => u.pod === commander[0].pod && !u.target)).toHaveLength(2)
  battle.units = battle.units.filter((u) => !u.target)
  stepBattle(battle)
  expect(battle.winner).toBe('human')
  endBattle(run)
  expect(run.finds.length + run.decisions.length).toBeGreaterThan(0)
})

test('a rescue pays supplies and experience for each civilian saved or alive; a raid pays by the cache grabbed, and costs a threat for each sought beyond the first', () => {
  const rescue = before('rescue')
  deploy(rescue, 0)
  expect(rescue.battle!.units.filter((u) => u.civilian)).toHaveLength(CIVILIANS)
  const supplies = rescue.supplies
  // One civilian is lost.
  const lost = rescue.battle!.units.find((u) => u.civilian)
  rescue.battle!.units = rescue.battle!.units.filter((u) => u !== lost)
  const alive = CIVILIANS - 1
  rescue.battle!.winner = 'human'
  endBattle(rescue)
  expect(rescue.report!.rescued).toBe(alive)
  expect(rescue.report!.soldiers[0].earned).toContainEqual({ label: `${alive} civilians saved`, xp: alive * XP.civilian })
  expect(rescue.supplies).toBe(supplies + RISKS.standard.supplies + alive * CIVILIAN_SUPPLIES)

  const raid = before('raid')
  expect(apply(raid, { type: 'land', zone: 0 }).ok).toBe(false)
  apply(raid, { type: 'grab', caches: 2 })
  const threat = raid.threat
  raid.battle!.grabbed = 2
  raid.battle!.winner = 'human'
  endBattle(raid)
  expect(raid.supplies).toBe(START_SUPPLIES + 2 * RISKS.standard.supplies)
  expect(raid.threat).toBe(threat + STOP_THREAT + 1)
  expect(raid.finds).toEqual([])
})

/** A rescue whose squad has landed rooted and harmless, so only the aliens act on the civilians. */
function terror(seed: number): Run {
  const run = before('rescue')
  run.battle!.rng = seed
  deploy(run, 0)
  for (const s of run.battle!.units.filter(isSoldier)) Object.assign(s, { rooted: 999, stats: { ...s.stats, aim: -10 } })
  return run
}

test('a rescue is a terror site: aliens and civilians in the open from the start, and aliens with no soldier to fight kill civilians', () => {
  const run = terror(1)
  const battle = run.battle!
  expect(battle.concealed).toBe(false)
  expect(battle.pods.every((p) => p.revealed && p.alert)).toBe(true)
  expect(battle.units.filter((u) => u.civilian).every((u) => revealed(battle, u))).toBe(true)
  const civilians = new Set(battle.units.filter((u) => u.civilian).map((u) => u.id))
  let killed = 0
  while (battle.phase === 'battle' && battle.round < 10) {
    const soldiers = battle.units.filter(isSoldier)
    for (const e of stepBattle(battle)) {
      if (e.type === 'death' && civilians.has(e.id)) killed++
      // An alien that sees a soldier fights it rather than a civilian.
      const alien = e.type === 'shot' && civilians.has(e.target) ? battle.units.find((u) => u.id === e.id) : undefined
      if (alien) expect(soldiers.some((s) => distance(s, alien) <= alien.stats.range)).toBe(false)
    }
  }
  expect(killed).toBeGreaterThan(0)
})

test('a civilian a harvester kills rises on the next alien turn as a husk', () => {
  const run = terror(2)
  const battle = run.battle!
  const harvester = battle.units.find((u) => u.kind === 'harvester')!
  expect(harvester).toBeDefined()
  battle.units = battle.units.filter((u) => u.side !== 'alien' || u === harvester)
  let died = false
  while (battle.phase === 'battle' && !battle.units.some((u) => u.kind === 'husk')) {
    for (const e of stepBattle(battle)) if (e.type === 'death' && !battle.units.some((u) => u.id === e.id)) died = true
    expect(battle.round).toBeLessThan(20)
  }
  expect(died).toBe(true)
  expect(battle.units.find((u) => u.kind === 'husk')!.pod).toBe(harvester.pod)
})

test('on a rescue soldiers reach civilians to get them out, and aliens hunt them', () => {
  let saved = 0
  let shotAt = 0
  for (let seed = 1; seed <= 6; seed++) {
    const run = before('rescue')
    run.battle!.rng = seed
    deploy(run, seed % 3)
    const battle = run.battle!
    // Only the harvesters, so a lone soldier lives long enough.
    battle.units = battle.units.filter((u) => u.side !== 'alien' || u.kind === 'harvester')
    while (battle.phase === 'battle') {
      const civilians = new Set(battle.units.filter((u) => u.civilian).map((u) => u.id))
      for (const e of stepBattle(battle)) {
        if (e.type === 'saved') saved++
        if (e.type === 'shot' && civilians.has(e.target)) shotAt++
      }
    }
    expect(battle.saved).toBeLessThanOrEqual(CIVILIANS)
  }
  expect(saved).toBeGreaterThan(0)
  expect(shotAt).toBeGreaterThan(0)
})

test('a rescue squad split into teams lands each team apart, and left-behind civilians add threat', () => {
  const run = before('rescue')
  run.battle!.reserve = [...run.battle!.reserve, ...run.battle!.reserve.map((r) => ({ ...r, soldier: r.soldier + 100 }))]
  apply(run, { type: 'split', teams: 2 })
  const battle = run.battle!
  const [a, b] = [0, 1].map((t) => battle.units.filter((u) => isSoldier(u) && u.team === t))
  expect(a).toHaveLength(1)
  expect(b).toHaveLength(1)
  expect(Math.max(Math.abs(a[0].x - b[0].x), Math.abs(a[0].y - b[0].y))).toBeGreaterThan(4)
  const threat = run.threat
  battle.winner = 'alien'
  endBattle(run)
  expect(run.threat).toBe(Math.min(THREAT_MAX, threat + STOP_THREAT + LOSS_THREAT + Math.floor(CIVILIANS / CIVILIANS_PER_THREAT)))
})

test('no one shot kills a commander from full health; brought low, it blinks away', () => {
  const run = before('assassinate')
  const battle = run.battle!
  deploy(run, 0)
  const commander = battle.units.find((u) => u.target)!
  battle.units = battle.units.filter((u) => u.side !== 'alien' || u === commander)
  battle.pods[commander.pod!] = { ...battle.pods[commander.pod!], revealed: true, alert: true }
  const soldier = battle.units.find(isSoldier)!
  Object.assign(soldier, freeTilesNear(battle, commander, 2)[1], { stats: { ...soldier.stats, damage: 99, aim: 10, crit: 1, move: 0 } })
  Object.assign(battle, { turn: 'human', stage: 'move', concealed: false })
  const events: GameEvent[] = []
  while (!events.some((e) => e.type === 'shot' && e.target === commander.id)) events.push(...stepBattle(battle))
  expect(commander.hp).toBe(1)
  expect(events).toContainEqual({ type: 'effect', id: commander.id, effect: 'lastStand', amount: 0 })
  expect(events).toContainEqual(expect.objectContaining({ type: 'move', id: commander.id, with: 'blink' }))
})
