import { roots } from './skills'
import { expect, test } from 'vitest'
import { apply } from './apply'
import { goalOf, stepBattle, UPLINK_REACH, vipOf, type GameEvent } from './combat'
import { CIVILIAN_SUPPLIES, CIVILIANS, CIVILIANS_PER_THREAT, HOLD_ROUNDS, RESCUE_QUORUM, type Goal } from './goals'
import { distance, edgeDepths, freeTilesNear, GRID, INNER, isSoldier } from './battle'
import { road, deploy, begun } from './roads'
import { endBattle, LOSS_THREAT, RISKS, START_SUPPLIES, STOP_THREAT, THREAT_MAX, XP, type Run } from './run'

/** A run about to fight a battle of `goal`, with three packs to muster. */
function before(goal: Goal): Run {
  const run = begun(1)
  run.soldiers[0].skills = [roots(run.soldiers[0].cls!)[0]]
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
  while (!battle.extract) stepBattle(battle)
  expect(battle.phase).toBe('battle')
  expect(battle.uplink).toBeNull()
  const depth = edgeDepths(battle)[battle.extract.y * GRID + battle.extract.x]
  expect(depth).toBeLessThanOrEqual(INNER)
  // Waves keep coming as the squad extracts.
  expect(battle.waves.length).toBeGreaterThan(0)
  const soldiers = battle.units.filter(isSoldier)
  freeTilesNear(battle, battle.extract, soldiers.length).forEach((tile, i) => Object.assign(soldiers[i], tile))
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
  expect(run.finds.length).toBeGreaterThan(0)
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

test('a rescue is won, and pays, only with more than RESCUE_QUORUM civilians saved', () => {
  for (const saved of [RESCUE_QUORUM, RESCUE_QUORUM + 1]) {
    const run = before('rescue')
    deploy(run, 0)
    const battle = run.battle!
    battle.units = battle.units.filter((u) => !u.civilian)
    battle.saved = saved
    const supplies = run.supplies
    stepBattle(battle)
    expect(battle.winner).toBe(saved > RESCUE_QUORUM ? 'human' : 'alien')
    endBattle(run)
    expect(run.supplies > supplies).toBe(saved > RESCUE_QUORUM)
  }
})

/** A rescue whose squad has landed rooted and harmless, so only the aliens act on the civilians. */
function terror(seed: number): Run {
  const run = before('rescue')
  run.battle!.rng = seed
  deploy(run, 0)
  for (const s of run.battle!.units.filter(isSoldier)) Object.assign(s, { rooted: 999, stats: { ...s.stats, aim: -10 } })
  return run
}

test('a rescue lands among the civilians, in contact: every pod is in sight and fighting, and the squad is never concealed', () => {
  const run = before('rescue')
  const battle = run.battle!
  const civilians = battle.units.filter((u) => u.civilian)
  for (const zone of battle.zones) expect(Math.min(...civilians.map((c) => distance(c, zone)))).toBeLessThanOrEqual(14)
  deploy(run, 0)
  expect(battle.pods.every((p) => p.revealed && p.alert)).toBe(true)
  expect(battle.concealed).toBe(false)
})

test('on a rescue aliens with no soldier to fight kill civilians', () => {
  const run = terror(1)
  const battle = run.battle!
  const civilians = new Set(battle.units.filter((u) => u.civilian).map((u) => u.id))
  let killed = 0
  while (battle.phase === 'battle' && battle.round < 10) for (const e of stepBattle(battle)) if (e.type === 'death' && civilians.has(e.id)) killed++
  expect(killed).toBeGreaterThan(0)
})

test('a rescue mixes civilians who hide, taking cover and staying put, with civilians who run from the aliens', () => {
  const run = terror(3)
  const battle = run.battle!
  const civilians = battle.units.filter((u) => u.civilian)
  expect(new Set(civilians.map((u) => u.civilian))).toEqual(new Set(['hider', 'runner']))
  stepBattle(battle)
  while (battle.turn !== 'human') stepBattle(battle)
  const hidden = civilians.filter((u) => u.civilian === 'hider' && battle.units.includes(u)).map((u) => ({ u, x: u.x, y: u.y }))
  let ran = false
  for (let i = 0; i < 6 && battle.phase === 'battle'; i++)
    for (const e of stepBattle(battle)) {
      const mover = e.type === 'move' ? civilians.find((c) => c.id === e.id) : undefined
      if (mover?.civilian === 'runner') ran = true
      expect(hidden.some((h) => h.u === mover)).toBe(false)
    }
  expect(hidden.length).toBeGreaterThan(0)
  expect(ran).toBe(true)
})

test('on a rescue a soldier makes for the alien nearest a civilian, and with none near one, for the nearest civilian', () => {
  const run = before('rescue')
  deploy(run, 0)
  const battle = run.battle!
  const soldier = battle.units.find(isSoldier)!
  const alien = battle.units.find((u) => u.side === 'alien')!
  const civilian = battle.units.find((u) => u.civilian)!
  battle.units = battle.units.filter((u) => u === soldier || u === alien || u === civilian)
  Object.assign(battle.pods[alien.pod!], { revealed: true, alert: true })
  const tiles = freeTilesNear(battle, soldier, 3000)
  Object.assign(alien, tiles.find((t) => distance(t, soldier) === 10))
  Object.assign(civilian, tiles.find((t) => distance(t, alien) === 6 && distance(t, soldier) === 14))
  expect(goalOf(battle, soldier, [alien])).toBe(alien)
  // Hunting no one, the alien is passed by for the civilian.
  Object.assign(civilian, tiles.find((t) => distance(t, alien) > 12 && distance(t, soldier) === 14))
  expect(goalOf(battle, soldier, [alien])).toBe(civilian)
})

test('a civilian a harvester kills rises on the next alien turn as a husk', () => {
  const run = terror(2)
  const battle = run.battle!
  const harvester = battle.units.find((u) => u.kind === 'harvester')!
  expect(harvester).toBeDefined()
  battle.units = battle.units.filter((u) => u.side !== 'alien' || u === harvester)
  // Beside the hider farthest from the squad, which stays put.
  const soldier = battle.units.find(isSoldier)!
  const prey = battle.units.filter((u) => u.civilian === 'hider').sort((a, b) => distance(b, soldier) - distance(a, soldier))[0]
  Object.assign(harvester, freeTilesNear(battle, prey, 30).find((t) => distance(t, prey) === 2))
  let died = false
  while (battle.phase === 'battle' && !battle.units.some((u) => u.kind === 'husk')) {
    for (const e of stepBattle(battle)) if (e.type === 'death' && !battle.units.some((u) => u.id === e.id)) died = true
    expect(battle.round).toBeLessThan(20)
  }
  expect(died).toBe(true)
  expect(battle.units.find((u) => u.kind === 'husk')!.pod).toBe(harvester.pod)
})

test('on a rescue soldiers reach civilians to get them out', () => {
  let saved = 0
  for (let seed = 1; seed <= 6; seed++) {
    const run = before('rescue')
    run.battle!.rng = seed
    deploy(run, seed % 3)
    const battle = run.battle!
    // Only the harvesters, sighted, so a lone soldier lives long enough.
    battle.units = battle.units.filter((u) => u.side !== 'alien' || u.kind === 'harvester')
    for (const pod of battle.pods) Object.assign(pod, { revealed: true, alert: true })
    while (battle.phase === 'battle') for (const e of stepBattle(battle)) if (e.type === 'saved') saved++
    expect(battle.saved).toBeLessThanOrEqual(CIVILIANS)
  }
  expect(saved).toBeGreaterThan(0)
})

test('left-behind civilians on a lost rescue add threat', () => {
  const run = before('rescue')
  deploy(run, 0)
  const battle = run.battle!
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

test('a VIP rescue: the VIP waits within under guard, the squad landing as on an exterminate; the aliens leave a held VIP be', () => {
  const run = before('vip')
  const battle = run.battle!
  const vip = vipOf(battle)!
  expect(battle.vip).toBe('held')
  expect(edgeDepths(battle)[vip.y * GRID + vip.x]).toBeGreaterThan(INNER)
  expect(battle.pods[0].guard).toBe(true)
  expect(Math.min(...battle.units.filter((u) => u.pod === 0).map((u) => distance(u, vip)))).toBeLessThanOrEqual(2)
  expect(battle.plans).toEqual(['march', 'march', 'march'])
  deploy(run, 0)
  for (const pod of battle.pods) Object.assign(pod, { revealed: true, alert: true })
  while (battle.round < 4 && battle.phase === 'battle') for (const e of stepBattle(battle)) expect(e.type === 'shot' && e.target === vip.id).toBe(false)
  expect(battle.units).toContain(vip)
})

test('a soldier near the VIP breaches, catching the guards; beside them it frees them, and every pod comes as the extraction zone appears', () => {
  const run = before('vip')
  const battle = run.battle!
  deploy(run, 0)
  const vip = vipOf(battle)!
  const soldier = battle.units.find(isSoldier)!
  Object.assign(soldier, freeTilesNear(battle, vip, 30).find((t) => distance(t, vip) === 3), { rooted: 999 })
  const events: GameEvent[] = []
  while (battle.vip === 'held') events.push(...stepBattle(battle))
  expect(events).toContainEqual(expect.objectContaining({ type: 'rocket', id: soldier.id, hits: [] }))
  expect(battle.pods[0]).toMatchObject({ revealed: true, alert: true })
  Object.assign(soldier, freeTilesNear(battle, vip, 9).find((t) => distance(t, vip) === 1))
  while (battle.vip === 'breached') stepBattle(battle)
  expect(battle.vip).toBe('freed')
  expect(edgeDepths(battle)[battle.extract!.y * GRID + battle.extract!.x]).toBeLessThanOrEqual(INNER)
  expect(battle.pods.every((p) => p.alert && !p.guard)).toBe(true)
})

test('a VIP rescue is lost with the VIP, and won once the VIP and the squad lift off, for a relic', () => {
  const lost = before('vip')
  deploy(lost, 0)
  lost.battle!.units = lost.battle!.units.filter((u) => u.civilian !== 'vip')
  stepBattle(lost.battle!)
  expect(lost.battle!.winner).toBe('alien')

  const run = before('vip')
  const battle = run.battle!
  deploy(run, 0)
  battle.units = battle.units.filter((u) => u.side !== 'alien')
  // With no alien left the squad still has to get the VIP out.
  stepBattle(battle)
  expect(battle.phase).toBe('battle')
  while (battle.phase === 'battle' && battle.beat < 900) stepBattle(battle)
  expect(battle.vip).toBe('out')
  expect(battle.winner).toBe('human')
  endBattle(run)
  expect(run.relicOffers).toHaveLength(3)
})
