// What happens as a side's turn begins: burns, acid, mending, cooldowns, spawns, goals that tick.
import { REGEN_HEAL, alienStats, ALIENS, NODE_EVERY } from './aliens'
import { type Battle, AURA_REACH, BURN_DAMAGE, isSoldier, SPAWN_EVERY, type Unit } from './battle'
import { placePod } from './setup'
import { alienUnit } from './spawn'
import { openNear, spacedTile } from './grid'
import { freeTilesNear } from './grid'
import { distance } from './grid'
import type { GameEvent } from './combat-event'
import { has, foeHas, onTile, FIRE_TURNS, uplinkReach, EXTRACT_CLEARANCE, silenced, centreOf, nearest } from './fighters'
import { HOLD_ROUNDS, HOLD_WAVE_EVERY } from './goals'
import { wound } from './wound'

/**
 * What happens as a side's turn begins: burning hurts and mending armor heals. On the aliens' turn the next pod may
 * engage, waves come in, acid wears off, cooldowns run down, and a boss whose spawn is ready spawns a swarmling.
 */
export function upkeep(battle: Battle): GameEvent[] {
  const events: GameEvent[] = []
  for (const unit of battle.units.filter((u) => u.side === battle.turn)) {
    // An explosion earlier in this upkeep may have killed it.
    if (unit.hp <= 0) continue
    unit.moved = false
    unit.order = null
    if (unit.suppressed > 0) unit.suppressed--
    if (unit.chilled > 0) unit.chilled--
    if (unit.rooted > 0) unit.rooted--
    if (unit.booming > 0) unit.booming--
    if (unit.cloaked && --unit.cloaked === 0) events.push({ type: 'cloak', id: unit.id, on: false })
    if (has(unit, 'vitality')) {
      for (const mate of battle.units.filter((u) => u.side === unit.side && u !== unit && u.hp < u.stats.hp && distance(u, unit) <= AURA_REACH)) {
        mate.hp++
        events.push({ type: 'effect', id: mate.id, effect: 'vitality', amount: 1 })
      }
    }
    if (has(unit, 'rearm') && unit.armor < unit.stats.armor) {
      unit.armor++
      events.push({ type: 'effect', id: unit.id, effect: 'rearm', amount: 0 })
    }
    if (unit.kind === 'regenerator' && unit.burning === 0 && unit.hp < unit.stats.hp) {
      const amount = Math.min(REGEN_HEAL, unit.stats.hp - unit.hp)
      unit.hp += amount
      events.push({ type: 'effect', id: unit.id, effect: 'regen', amount })
    }
    if (unit.burning > 0) {
      if (foeHas(battle, unit, 'pyre') && !onTile(battle.fire, unit)) battle.fire.push({ x: unit.x, y: unit.y, turns: FIRE_TURNS })
      unit.burning--
      events.push({ type: 'effect', id: unit.id, effect: 'incendiary', amount: -BURN_DAMAGE })
      wound(battle, unit, BURN_DAMAGE, events)
    }
    if (unit.hp > 0 && unit.hp < unit.stats.hp && has(unit, 'regen')) {
      unit.hp++
      events.push({ type: 'effect', id: unit.id, effect: 'regen', amount: 1 })
    }
  }
  if (battle.turn !== 'alien') return events
  battle.round++
  // A hold counts only the rounds the squad ends standing on it. Once held, the uplink is done and the squad extracts.
  if (battle.uplink && battle.units.some((u) => isSoldier(u) && distance(u, battle.uplink!) <= uplinkReach(battle))) battle.held++
  if (battle.uplink && battle.held >= HOLD_ROUNDS) {
    battle.extract = spacedTile(battle, [battle.uplink], EXTRACT_CLEARANCE, 'edge')
    battle.uplink = null
    events.push({ type: 'extract', ...battle.extract })
  }
  for (const husk of battle.husks.splice(0)) {
    const [tile] = freeTilesNear(battle, husk, 1)
    if (!tile) continue
    const unit = alienUnit(battle, { kind: 'husk', stats: alienStats('husk', 0, 0), stance: ALIENS.husk.stance, boss: false, spawns: false, target: false, resists: [] }, tile, husk.pod)
    battle.units.push(unit)
    events.push({ type: 'wave', units: [{ id: unit.id, x: unit.x, y: unit.y }] })
  }
  rally(battle)
  // Waves come in a pack at a time, at the encounter's gate nearest the squad yet clear of it; a hold's without end.
  const soldiers = battle.units.filter(isSoldier)
  if (battle.waves.length > 0 && soldiers.length > 0 && battle.round % HOLD_WAVE_EVERY === 0) {
    const from = centreOf(soldiers)
    const clear = battle.gates.filter((g) => distance(g, from) >= WAVE_CLEAR)
    const centre = openNear(battle, nearest(clear, from) ?? battle.gates.reduce((a, b) => (distance(b, from) > distance(a, from) ? b : a)))
    const wave = battle.waves.shift()!
    if (battle.goal === 'hold') battle.waves.push(wave)
    // It comes in unseen but in the fight, and shows once the squad sights it.
    const units = placePod(battle, wave, centre, false)
    battle.pods.at(-1)!.engaged = true
    events.push({ type: 'wave', units: units.map(({ id, x, y }) => ({ id, x, y })) })
  }
  battle.acid = battle.acid.map((pool) => ({ ...pool, turns: pool.turns - 1 })).filter((pool) => pool.turns > 0)
  battle.fire = battle.fire.map((pool) => ({ ...pool, turns: pool.turns - 1 })).filter((pool) => pool.turns > 0)
  for (const unit of battle.units.filter((u) => u.side === 'alien')) {
    const fighting = battle.pods[unit.pod!].engaged
    // An incubator's time runs only once it is in the fight.
    if (unit.cooldown > 0 && (unit.kind !== 'incubator' || fighting)) unit.cooldown--
    if (unit.kind === 'incubator' && unit.cooldown === 0) {
      events.push(...hatch(battle, unit))
      continue
    }
    if (!unit.spawns || unit.cooldown > 0 || !fighting || silenced(battle, unit)) continue
    const [tile] = freeTilesNear(battle, unit, 1)
    if (!tile || (unit.kind === 'hiveNode' && unit.charges <= 0)) continue
    if (unit.kind === 'hiveNode') unit.charges--
    unit.cooldown = unit.kind === 'hiveNode' ? NODE_EVERY : SPAWN_EVERY
    const spawn = alienUnit(battle, { kind: 'swarmling', stats: alienStats('swarmling', 0, 0), stance: ALIENS.swarmling.stance, boss: false, spawns: false, target: false, resists: [] }, tile, unit.pod!)
    battle.units.push(spawn)
    events.push({ type: 'spawn', id: unit.id, unit: { id: spawn.id, x: spawn.x, y: spawn.y } })
  }
  return events
}

/** The nearest to the squad a wave comes in. */
export const WAVE_CLEAR = 7

/** Rounds a pod has the squad to itself before the next joins it. */
export const RALLY_EVERY = 3

/**
 * One pod at a time comes for the squad: the one waiting nearest it engages once no pod in the fight is left standing,
 * or once RALLY_EVERY rounds have passed since the last joined.
 */
export function rally(battle: Battle): void {
  const soldiers = battle.units.filter(isSoldier)
  const members = (pod: number) => battle.units.filter((u) => u.pod === pod)
  const waiting = battle.pods.flatMap((pod, i) => (!pod.engaged && members(i).length > 0 ? [i] : []))
  if (waiting.length === 0 || soldiers.length === 0) return
  const fighting = battle.pods.some((pod, i) => pod.engaged && members(i).length > 0)
  if (fighting && battle.round - battle.rallied < RALLY_EVERY) return
  const near = (pod: number) => Math.min(...members(pod).flatMap((m) => soldiers.map((s) => distance(m, s))))
  battle.pods[waiting.reduce((a, b) => (near(b) < near(a) ? b : a))].engaged = true
  battle.rallied = battle.round
}

/** An incubator hatches: it is gone, and two brutes of its pod stand where it was. */
export function hatch(battle: Battle, unit: Unit): GameEvent[] {
  battle.units = battle.units.filter((u) => u !== unit)
  const events: GameEvent[] = [{ type: 'death', id: unit.id }]
  for (const tile of freeTilesNear(battle, unit, 2)) {
    const brute = alienUnit(battle, { kind: 'brute', stats: alienStats('brute', unit.stats.armor, 0), stance: ALIENS.brute.stance, boss: false, spawns: false, target: false, resists: ALIENS.brute.resists }, tile, unit.pod!)
    battle.units.push(brute)
    events.push({ type: 'spawn', id: unit.id, unit: { id: brute.id, x: brute.x, y: brute.y } })
  }
  return events
}
