// What happens as a side's turn begins: burns, acid, mending, cooldowns, spawns, goals that tick.
import { REGROWTH } from './exams'
import { alienSrc, fx } from './sources'
import { REGEN_HEAL, alienStats, ALIENS, NODE_EVERY } from './aliens'
import { type Battle, ADRENAL_FROM, ADRENAL_MAX, isSoldier, LODESTONE_REACH, SPAWN_EVERY, type Unit } from './battle'
import { pull } from './knockback'
import { armorCap, empower } from './stacks'
import { placeAlien } from './setup'
import { alienUnit } from './spawn'
import { openNear } from './grid'
import { freeTilesNear } from './grid'
import { distance } from './grid'
import type { GameEvent } from './combat-event'
import { engageNearest, walkersFighting, has, nearest, foeHas, onTile, FIRE_TURNS, uplinkReach, centreOf } from './fighters'
import { WAVE_EVERY } from './goals'
import { randomInt } from './rng'
import { mend, wound } from './wound'

/**
 * What happens as a side's turn begins: burning hurts and mending armor heals. On the aliens' turn more aliens may
 * engage, waves come in, acid wears off, cooldowns run down, and a boss whose spawn is ready spawns a swarmling.
 */
export function upkeep(battle: Battle): GameEvent[] {
  const events: GameEvent[] = []
  // Chill wears off a stack once its side's turn is over.
  for (const unit of battle.units.filter((u) => u.side !== battle.turn && u.chill > 0 && !u.frozen)) unit.chill--
  if (battle.turn === 'human') lodestone(battle, events)
  for (const unit of battle.units.filter((u) => u.side === battle.turn)) {
    // An explosion earlier in this upkeep may have killed it.
    if (unit.hp <= 0) continue
    const shifted = unit.shifted
    unit.shifted = false
    if (unit.numb > 0) unit.numb--
    unit.moved = false
    if (unit.suppressed > 0) unit.suppressed--
    if (unit.exposed > 0) unit.exposed--
    if (unit.rooted > 0) unit.rooted--
    if (unit.booming > 0) unit.booming--
    if (unit.cloaked && --unit.cloaked === 0) events.push({ type: 'cloak', id: unit.id, on: false })
    if (has(unit, 'adrenal') && battle.round >= ADRENAL_FROM && battle.round < ADRENAL_FROM + ADRENAL_MAX) empower(unit, 1, 'adrenal', events)
    if (has(unit, 'rampage') && !shifted) empower(unit, 1, 'rampage', events)
    if (has(unit, 'regrowth') && unit.burn === 0 && unit.chill === 0) mend(unit, Math.ceil(unit.stats.hp * REGROWTH.turn), 'regrowth', events, Math.round(unit.stats.hp * REGROWTH.most))
    if (has(unit, 'rearm') && unit.armor < armorCap(unit, unit.stats.armor)) {
      unit.armor++
      events.push(fx(unit.id, 'rearm', 0))
    }
    if (unit.kind === 'regenerator' && unit.burn === 0 && unit.hp < unit.stats.hp) {
      const amount = Math.min(REGEN_HEAL, unit.stats.hp - unit.hp)
      unit.hp += amount
      events.push(fx(unit.id, 'regen', amount))
    }
    if (unit.burn > 0) {
      if (foeHas(battle, unit, 'pyre') && !onTile(battle.fire, unit)) battle.fire.push({ x: unit.x, y: unit.y, turns: FIRE_TURNS })
      const damage = unit.burn
      if (!foeHas(battle, unit, 'eternal')) unit.burn--
      events.push(fx(unit.id, 'incendiary', -damage))
      wound(battle, unit, damage, events)
    }
  }
  if (battle.turn !== 'alien') return events
  battle.round++
  // A hold counts only the rounds the hero ends standing on it.
  if (battle.uplink && battle.units.some((u) => isSoldier(u) && distance(u, battle.uplink!) <= uplinkReach(battle))) battle.held++
  for (const husk of battle.husks.splice(0)) {
    const [tile] = freeTilesNear(battle, husk, 1)
    if (!tile) continue
    const unit = alienUnit(battle, { kind: 'husk', stats: alienStats('husk', 0, 0), stance: ALIENS.husk.stance, boss: false, spawns: false, target: false, resists: [] }, tile, true)
    battle.units.push(unit)
    events.push({ type: 'wave', units: [{ id: unit.id, x: unit.x, y: unit.y }] })
  }
  rally(battle)
  // Waves come in a pack at a time, at one of the encounter's two gates nearest the hero yet clear of it; a hold's without end until it is held.
  const soldiers = battle.units.filter(isSoldier)
  if (battle.waves.length > 0 && soldiers.length > 0 && (battle.deadline === null ? battle.challenge === 'swarm' || battle.round % WAVE_EVERY === 0 : battle.round >= battle.deadline)) {
    const from = centreOf(soldiers)
    const clear = battle.gates.filter((g) => distance(g, from) >= WAVE_CLEAR)
    const near = [...clear].sort((a, b) => distance(a, from) - distance(b, from)).slice(0, 2)
    const centre = openNear(battle, near[randomInt(battle, near.length)] ?? battle.gates.reduce((a, b) => (distance(b, from) > distance(a, from) ? b : a)))
    const wave = battle.waves.shift()!
    if (battle.goal === 'hold') battle.waves.push(wave)
    // It comes in unseen but in the fight, and shows once the hero sights it.
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
    if (!unit.spawns || unit.cooldown > 0 || !fighting) continue
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

/** The nearest to the hero a wave comes in. */
export const WAVE_CLEAR = 7

/** Rounds without a walker fighting before the next cluster comes on its own, and rounds any fight keeps the next back. */
export const RALLY_EVERY = 2
export const RALLY_PATIENCE = 6

/** Nobody left to fight, or a fight dragging on, brings in the cluster nearest the team, so a battle never stands still. */
export function rally(battle: Battle): void {
  const soldiers = battle.units.filter(isSoldier)
  // Sentries hold their posts: the hero must go to them.
  if (soldiers.length === 0 || battle.challenge === 'scattered') return
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

/** Lodestone Harness: the hero with the most armor pulls the nearest alien within LODESTONE_REACH, not yet beside it, to beside it. */
function lodestone(battle: Battle, events: GameEvent[]): void {
  const heroes = battle.units.filter((u) => isSoldier(u) && u.hp > 0 && has(u, 'lodestone'))
  if (heroes.length === 0) return
  const tank = heroes.reduce((a, b) => (b.armor > a.armor ? b : a))
  const prey = nearest(battle.units.filter((u) => u.side === 'alien' && u.hp > 0 && u.engaged && u.revealed && distance(u, tank) > 1 && distance(u, tank) <= LODESTONE_REACH), tank)
  if (prey) pull(battle, prey, tank, events)
}
