// What happens as a side's turn begins: burns, acid, mending, cooldowns, spawns, goals that tick.
import { REGROWTH } from './exams'
import { ADRENAL_MAX } from './relics'
import { alienSrc, fx } from './sources'
import { REGEN_HEAL, alienStats, ALIENS, NODE_EVERY } from './aliens'
import { replenish } from './abilities'
import { type Battle, AURA_REACH, BURN_STACKS, isSoldier, SPAWN_EVERY, type Unit } from './battle'
import { armorCap, chrono, empower, kindle, lastingArmor } from './stacks'
import { CONFLAGRATION_DAMAGE, HELLFIRE_REACH } from './keystones'
import { stormBlows } from './ultimates'
import { placeAlien } from './setup'
import { alienUnit } from './spawn'
import { openNear } from './grid'
import { freeTilesNear } from './grid'
import { distance } from './grid'
import type { GameEvent } from './combat-event'
import { engageNearest, walkersFighting, has, fireproof, foeHas, onTile, FIRE_TURNS, uplinkReach, extractionFrom, silenced, centreOf } from './fighters'
import { HOLD_ROUNDS, WAVE_EVERY } from './goals'
import { randomInt } from './rng'
import { tickBoons } from './boons'
import { mend, wound } from './wound'
import { talentTurn } from './talents'

/**
 * What happens as a side's turn begins: burning hurts and mending armor heals. On the aliens' turn more aliens may
 * engage, waves come in, acid wears off, cooldowns run down, and a boss whose spawn is ready spawns a swarmling.
 */
export function upkeep(battle: Battle): GameEvent[] {
  const events: GameEvent[] = []
  // Chill wears off a stack once its side's turn is over.
  for (const unit of battle.units.filter((u) => u.side !== battle.turn && u.chill > 0 && !u.frozen)) unit.chill--
  if (battle.turn === 'human') {
    chrono(battle, events)
    tickBoons(battle, events)
  }
  for (const unit of battle.units.filter((u) => u.side === battle.turn)) {
    // An explosion earlier in this upkeep may have killed it.
    if (unit.hp <= 0) continue
    unit.moved = false
    unit.order = null
    if (unit.suppressed > 0) unit.suppressed--
    if (unit.exposed > 0) unit.exposed--
    lastingArmor(unit)
    if (unit.rooted > 0) unit.rooted--
    if (unit.booming > 0) unit.booming--
    if (unit.cloaked && --unit.cloaked === 0) events.push({ type: 'cloak', id: unit.id, on: false })
    if (unit.invulnerable) unit.invulnerable--
    if (unit.storm) {
      unit.storm--
      stormBlows(battle, unit, events)
    }
    if (has(unit, 'vitality')) {
      for (const mate of battle.units.filter((u) => u.side === unit.side && u !== unit && u.hp < u.stats.hp && distance(u, unit) <= AURA_REACH)) {
        mate.hp++
        events.push(fx(mate.id, 'vitality', 1))
      }
    }
    events.push(...replenish(battle, unit))
    if (has(unit, 'glacialArmor') && unit.armor < unit.stats.armor) {
      unit.armor = unit.stats.armor
      events.push(fx(unit.id, 'glacialArmor', 0))
    }
    talentTurn(battle, unit, events)
    if (has(unit, 'adrenal') && battle.round < ADRENAL_MAX) empower(unit, 1, 'adrenal', events)
    if (has(unit, 'rampage')) empower(unit, 1, 'rampage', events)
    if (has(unit, 'regrowth') && unit.burn === 0) mend(unit, Math.ceil(unit.stats.hp * REGROWTH.turn), 'regrowth', events, Math.round(unit.stats.hp * REGROWTH.most))
    if (has(unit, 'rearm') && unit.armor < armorCap(unit, unit.stats.armor)) {
      unit.armor++
      events.push(fx(unit.id, 'rearm', 0))
    }
    if (unit.kind === 'regenerator' && unit.burn === 0 && unit.hp < unit.stats.hp) {
      const amount = Math.min(REGEN_HEAL, unit.stats.hp - unit.hp)
      unit.hp += amount
      events.push(fx(unit.id, 'regen', amount))
    }
    if (battle.units.some((u) => u.side !== unit.side && has(u, 'hellfire') && distance(u, unit) <= HELLFIRE_REACH) && !fireproof(battle, unit)) {
      kindle(battle, unit, 1)
      events.push(fx(unit.id, 'hellfire', 0))
    }
    if (unit.burn > 0) {
      const raging = foeHas(battle, unit, 'conflagration')
      if (raging) {
        for (const other of battle.units.filter((u) => u.side === unit.side && u !== unit && distance(u, unit) <= 1 && u.burn === 0)) kindle(battle, other, BURN_STACKS)
      }
      if (foeHas(battle, unit, 'pyre') && !onTile(battle.fire, unit)) battle.fire.push({ x: unit.x, y: unit.y, turns: FIRE_TURNS })
      const damage = unit.burn + (raging ? CONFLAGRATION_DAMAGE : 0)
      if (!foeHas(battle, unit, 'eternal')) unit.burn--
      events.push(fx(unit.id, 'incendiary', -damage))
      wound(battle, unit, damage, events)
    }
    if (unit.hp > 0 && unit.hp < unit.stats.hp && has(unit, 'regen')) {
      unit.hp++
      events.push(fx(unit.id, 'regen', 1))
    }
  }
  if (battle.turn !== 'alien') return events
  battle.round++
  // A hold counts only the rounds the squad ends standing on it. Once held, the uplink is done and the squad extracts.
  if (battle.uplink && battle.units.some((u) => isSoldier(u) && distance(u, battle.uplink!) <= uplinkReach(battle))) battle.held++
  if (battle.uplink && battle.held >= HOLD_ROUNDS) {
    battle.extract = extractionFrom(battle, battle.uplink)
    battle.uplink = null
    events.push({ type: 'extract', ...battle.extract })
  }
  for (const husk of battle.husks.splice(0)) {
    const [tile] = freeTilesNear(battle, husk, 1)
    if (!tile) continue
    const unit = alienUnit(battle, { kind: 'husk', stats: alienStats('husk', 0, 0), stance: ALIENS.husk.stance, boss: false, spawns: false, target: false, resists: [] }, tile, true)
    battle.units.push(unit)
    events.push({ type: 'wave', units: [{ id: unit.id, x: unit.x, y: unit.y }] })
  }
  rally(battle)
  // Waves come in a pack at a time, at one of the encounter's two gates nearest the squad yet clear of it; a hold's without end until it is held.
  const soldiers = battle.units.filter(isSoldier)
  if (battle.waves.length > 0 && soldiers.length > 0 && (battle.deadline === null ? battle.challenge === 'swarm' || battle.round % WAVE_EVERY === 0 : battle.round >= battle.deadline)) {
    const from = centreOf(soldiers)
    const clear = battle.gates.filter((g) => distance(g, from) >= WAVE_CLEAR)
    const near = [...clear].sort((a, b) => distance(a, from) - distance(b, from)).slice(0, 2)
    const centre = openNear(battle, near[randomInt(battle, near.length)] ?? battle.gates.reduce((a, b) => (distance(b, from) > distance(a, from) ? b : a)))
    const wave = battle.waves.shift()!
    if (battle.goal === 'hold' && !battle.extract) battle.waves.push(wave)
    // It comes in unseen but in the fight, and shows once the squad sights it.
    const units = freeTilesNear(battle, centre, wave.length).map((tile, i) => placeAlien(battle, wave[i], tile, true, false))
    events.push({ type: 'wave', units: units.map(({ id, x, y }) => ({ id, x, y })) })
  }
  battle.acid = battle.acid.map((pool) => ({ ...pool, turns: pool.turns - 1 })).filter((pool) => pool.turns > 0)
  battle.fire = battle.fire.map((pool) => ({ ...pool, turns: pool.turns - 1 })).filter((pool) => pool.turns > 0)
  for (const unit of battle.units.filter((u) => u.side === 'alien')) {
    const fighting = unit.engaged
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
    const spawn = alienUnit(battle, { kind: 'swarmling', stats: alienStats('swarmling', 0, 0), stance: ALIENS.swarmling.stance, boss: false, spawns: false, target: false, resists: [] }, tile, true)
    battle.units.push(spawn)
    events.push({ type: 'spawn', src: alienSrc(unit), id: unit.id, unit: { id: spawn.id, x: spawn.x, y: spawn.y } })
  }
  return events
}

/** The nearest to the squad a wave comes in. */
export const WAVE_CLEAR = 7

/** Rounds without a walker fighting before the next cluster comes on its own, and rounds any fight keeps the next back. */
export const RALLY_EVERY = 2
export const RALLY_PATIENCE = 6

/** Nobody left to fight, or a fight dragging on, brings in the cluster nearest the squad, so a battle never stands still. */
export function rally(battle: Battle): void {
  const soldiers = battle.units.filter(isSoldier)
  // Sentries hold their posts: the squad must go to them.
  if (soldiers.length === 0 || battle.deadline !== null) return
  if (battle.round - battle.rallied >= (walkersFighting(battle) > 0 ? RALLY_PATIENCE : RALLY_EVERY)) engageNearest(battle, soldiers)
}

/** An incubator hatches: it is gone, and two brutes stand where it was. */
export function hatch(battle: Battle, unit: Unit): GameEvent[] {
  battle.units = battle.units.filter((u) => u !== unit)
  const events: GameEvent[] = [{ type: 'death', id: unit.id }]
  for (const tile of freeTilesNear(battle, unit, 2)) {
    const brute = alienUnit(battle, { kind: 'brute', stats: alienStats('brute', unit.stats.armor, 0), stance: ALIENS.brute.stance, boss: false, spawns: false, target: false, resists: ALIENS.brute.resists }, tile, true)
    battle.units.push(brute)
    events.push({ type: 'spawn', src: alienSrc(unit), id: unit.id, unit: { id: brute.id, x: brute.x, y: brute.y } })
  }
  return events
}
