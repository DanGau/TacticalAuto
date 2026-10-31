// What happens as a side's turn begins: burns, acid, mending, cooldowns, spawns, goals that tick.
import { REGEN_HEAL, alienStats, ALIENS, NODE_EVERY } from './aliens'
import { type Battle, AURA_REACH, BURN_DAMAGE, isSoldier, ZONE_CLEARANCE, revealed, SPAWN_EVERY, type Unit } from './battle'
import { placePod } from './setup'
import { alienUnit } from './spawn'
import { spacedTile } from './grid'
import { freeTilesNear } from './grid'
import { distance } from './grid'
import type { GameEvent } from './combat-event'
import { has, foeHas, onTile, FIRE_TURNS, uplinkReach, EXTRACT_CLEARANCE, RESTLESS_ROUND, nearest, silenced } from './fighters'
import { HOLD_ROUNDS, HOLD_WAVE_EVERY } from './goals'
import { wound } from './wound'

/**
 * What happens as a side's turn begins: burning hurts and mending armor heals. On the aliens' turn acid wears off,
 * cooldowns run down, and a boss whose spawn is ready spawns a swarmling.
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
  // A long battle makes the aliens still unseen restless: they patrol toward the squad, so no fight is put off for good.
  if (battle.round >= RESTLESS_ROUND) {
    const soldiers = battle.units.filter(isSoldier)
    for (const pod of battle.pods.filter((p) => !p.revealed)) {
      const member = battle.units.find((u) => battle.pods[u.pod ?? -1] === pod)
      const near = member && nearest(soldiers, member)
      if (near) Object.assign(pod, { guard: false, waypoint: { x: near.x, y: near.y } })
    }
  }
  // A hold's waves come in from the edges, without end, each pack one alien larger every time it returns.
  const hold = battle.goal === 'hold'
  if (battle.waves.length > 0 && battle.round % HOLD_WAVE_EVERY === 0) {
    const centre = spacedTile(battle, battle.units.filter(isSoldier), ZONE_CLEARANCE, hold ? 'edge' : 'anywhere')
    const wave = battle.waves.shift()!
    // Once the squad extracts, they stop growing.
    if (hold) battle.waves.push(battle.extract ? wave : { ...wave, aliens: [...wave.aliens, wave.aliens[0]] })
    // It comes in unseen but hunting, as a stalking pod does, and shows once the squad sights it.
    const units = placePod(battle, wave, centre, false)
    Object.assign(battle.pods.at(-1)!, { alert: true, stalking: true })
    events.push({ type: 'wave', units: units.map(({ id, x, y }) => ({ id, x, y })) })
  }
  battle.acid = battle.acid.map((pool) => ({ ...pool, turns: pool.turns - 1 })).filter((pool) => pool.turns > 0)
  battle.fire = battle.fire.map((pool) => ({ ...pool, turns: pool.turns - 1 })).filter((pool) => pool.turns > 0)
  for (const unit of battle.units.filter((u) => u.side === 'alien')) {
    // An incubator's time runs only once it is seen.
    if (unit.cooldown > 0 && (unit.kind !== 'incubator' || revealed(battle, unit))) unit.cooldown--
    if (unit.kind === 'incubator' && unit.cooldown === 0) {
      events.push(...hatch(battle, unit))
      continue
    }
    if (!unit.spawns || unit.cooldown > 0 || !revealed(battle, unit) || silenced(battle, unit)) continue
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
