// A unit's shot, and what a hit or kill sets off: blasts, fire, knockback, leaps.
import { type Battle, type Unit, SUPPRESS_AIM, SPOTTER_AIM, SLAYER_DAMAGE, SEARING_DAMAGE, RECKLESS_AIM, RAGE_DAMAGE, isSoldier, INSPIRE_AIM, HURL_TILES, HURL_DAMAGE, HEADSHOT_DAMAGE, FEAST_HEAL, EXECUTE_BONUS, DODGE_CHANCE, CRIT_BONUS, CLEAVE_DAMAGE, CHILL_TURNS, CHILL_AIM, BURN_TURNS, BULWARK_DEFENSE, BANE_REACH, BANE_AIM, BACKSTAB_DAMAGE, type Effect, SOLDIER_ATTACKS, GRID, type Tile, BLAST_RADIUS, NAPALM_DAMAGE, BIG_BLAST_RADIUS, LEAP_DAMAGE, CLOAK_AIM, CLOAK_DAMAGE, SHADOW_DAMAGE } from './battle'
import { cloakOn } from './abilities'
import { freeTilesNear } from './grid'
import { blocked } from './grid'
import { walkingDistances } from './grid'
import { crumble } from './grid'
import { wreck } from './grid'
import { onGrid } from './grid'
import { NEIGHBORS } from './grid'
import { distance } from './grid'
import { PARRY_CHANCE } from './doctrines'
import type { GameEvent } from './combat-event'
import { onTile, has, spend, shootable, nearest, enemiesOf, MIRROR_IMAGES, inAura, fireproof, chillFrom, burnFrom, BOUNTY_DAMAGE, immune, FIRE_TURNS } from './fighters'
import { tallyOf, wound, knockback } from './wound'
import { TUNING } from './tuning'
import { odds, coverAgainst } from './sight'
import { random } from './rng'
import { paths, bestPath, preyed, walk, leapTo, exposure } from './pathing'
import { FUEL_DAMAGE } from './twists'

/** Whether an alien closes to fight up close, so rooting or charging it pays most. */
export const closing = (unit: Unit) => unit.stance === 'rush' || unit.stats.range <= 1

/**
 * What a shooter's gear makes a target worth beyond the hit chance, in hit chance: holding back an alien that closes
 * in, pulling one that keeps its distance, knocking one into harm, and bursts or arcs where aliens crowd.
 */
export function worth(battle: Battle, unit: Unit, enemy: Unit): number {
  const near = (reach: number) => battle.units.filter((u) => u.side === enemy.side && u !== enemy && distance(u, enemy) <= reach).length
  const behind = { x: enemy.x + Math.sign(enemy.x - unit.x), y: enemy.y + Math.sign(enemy.y - unit.y) }
  const harmful = blocked(battle, behind.x, behind.y) || onTile(battle.acid, behind) || onTile(battle.fire, behind) || onTile(battle.caltrops, behind)
  return (
    (has(unit, 'snare') && closing(enemy) && enemy.rooted === 0 ? 0.2 : 0) +
    (has(unit, 'booming') && closing(enemy) && enemy.booming === 0 ? 0.15 : 0) +
    (has(unit, 'tether') && !closing(enemy) ? 0.15 : 0) +
    (has(unit, 'thunder') && harmful ? 0.2 : 0) +
    (has(unit, 'net') && enemy.rooted > 0 ? 0.1 : 0) +
    (has(unit, 'volatile') && enemy.hp + enemy.armor <= unit.stats.damage ? 0.1 * near(1) : 0) +
    (has(unit, 'arc') ? 0.05 * Math.min(ARC_LEAPS, near(ARC_REACH)) : 0)
  )
}

/** Tiles a ricochet reaches from its first target, an arc leaps, and the leaps it makes. */
export const RICOCHET_REACH = 3

export const ARC_REACH = 3

export const ARC_LEAPS = 2

/** Damage a volatile kill bursts for, and a thundering hit slams a target into what stops it for. */
export const VOLATILE_DAMAGE = 2

export const MIRROR_CHANCE = 0.5

/**
 * A shot at the enemy the unit can shoot and is likeliest to hit, a civilian counting PREY_WORTH; the nearest, then the lowest id, wins a tie.
 * An alien that can shoot a taunting soldier must. With `only`, the shot is at that enemy or not at all.
 * The effects of both units' gear and skills, and of relics, apply. `granted` names the effect that gave a shot
 * beyond the unit's own; such a shot grants no further one.
 */
export function shoot(battle: Battle, unit: Unit, seen: Set<number>, granted?: Effect, only?: Unit): GameEvent[] {
  const piercing = has(unit, 'piercing') || has(unit, 'pierce') || has(unit, 'psionic')
  const chanceAt = (target: Unit) => odds(battle, unit, target, unit.stats, piercing)
  const inReach = (only ? [only] : battle.units).filter((other) => other.side !== unit.side && shootable(battle, unit, unit, other, seen))
  const taunting = inReach.filter((other) => has(other, 'taunt'))
  const value = (other: Unit) => preyed(other, chanceAt(other).hit) + worth(battle, unit, other)
  let enemy: Unit | undefined
  for (const other of taunting.length > 0 ? taunting : inReach) {
    const gain = enemy ? value(other) - value(enemy) : 1
    if (gain > 0 || (gain === 0 && distance(unit, other) < distance(unit, enemy!))) enemy = other
  }
  if (!enemy) return []
  /** The effects of the shooter that shaped this shot, for the player to see. */
  const used: Effect[] = granted ? [granted] : []
  const when = (applies: boolean, effect: Effect, worth: number) => {
    if (!applies || !has(unit, effect)) return 0
    used.push(effect)
    return worth
  }
  const events: GameEvent[] = []
  if (taunting.length > 0 && taunting.length < inReach.length) events.push({ type: 'effect', id: enemy.id, effect: 'taunt', amount: 0 })
  const chance = chanceAt(enemy)
  const baned = battle.units.some((u) => u.side !== unit.side && has(u, 'bane') && distance(u, unit) <= BANE_REACH)
  // An attack out of cloak strikes surer and harder, and breaks the cloak.
  const unseen = !!unit.cloaked
  if (unseen) {
    unit.cloaked = 0
    events.push({ type: 'cloak', id: unit.id, on: false })
  }
  const toHit =
    chance.hit +
    (unseen ? CLOAK_AIM : 0) +
    (inAura(battle, unit, 'inspire') ? INSPIRE_AIM : 0) +
    when(true, 'reckless', RECKLESS_AIM) +
    (has(enemy, 'reckless') ? RECKLESS_AIM : 0) +
    when(enemy.marked, 'spotter', SPOTTER_AIM) -
    (unit.chilled > 0 ? CHILL_AIM : 0) -
    (inAura(battle, enemy, 'bulwark') ? BULWARK_DEFENSE : 0) -
    (baned ? BANE_AIM : 0) -
    (unit.suppressed > 0 ? SUPPRESS_AIM : 0)
  // Steady aim rolls twice and takes the better.
  const rolls = 1 + when(!unit.moved, 'steady', 1)
  let hit = Array.from({ length: rolls }, () => random(battle) < toHit).some(Boolean)
  if (hit && has(enemy, 'dodge') && random(battle) < DODGE_CHANCE) {
    hit = false
    events.push({ type: 'effect', id: enemy.id, effect: 'dodge', amount: 0 })
  }
  if (hit && has(enemy, 'mirror') && enemy.spent.filter((e) => e === 'mirror').length < MIRROR_IMAGES && random(battle) < MIRROR_CHANCE) {
    hit = false
    enemy.spent.push('mirror')
    events.push({ type: 'effect', id: enemy.id, effect: 'mirror', amount: 0 })
  }
  if (hit && has(enemy, 'parry') && distance(unit, enemy) > 1 && random(battle) < PARRY_CHANCE) {
    hit = false
    events.push({ type: 'effect', id: enemy.id, effect: 'parry', amount: 0 })
  }
  if (unit.soldier !== null) {
    const tally = tallyOf(battle, unit.soldier)
    tally.shots++
    if (hit) tally.hits++
  }
  if (!hit) {
    // A ricochet bounces a miss to another alien near the target, for one more roll.
    const bounce = granted ? undefined : has(unit, 'ricochet') ? nearest(inReach.filter((u) => u !== enemy && distance(u, enemy!) <= RICOCHET_REACH), enemy) : undefined
    return [{ type: 'shot', id: unit.id, target: enemy.id, hit, crit: false, damage: 0, with: used }, ...events, ...(battle.twist === 'fuel' ? ignite(battle, enemy) : []), ...(bounce ? shoot(battle, unit, seen, 'ricochet', bounce) : again(battle, unit, seen, granted, false))]
  }

  const sure = when(spend(unit, 'opener'), 'opener', 1) + when(enemy.hp === enemy.stats.hp, 'assassinate', 1) > 0
  const crit = !enemy.resists.includes('crit') && (sure || random(battle) < chance.crit)
  // A mirror hits as hard as the squad's hardest hitter; a feeder as hard as it has grown.
  const base = unit.kind === 'mirror' ? Math.max(unit.stats.damage, ...battle.units.filter(isSoldier).map((s) => s.stats.damage)) : unit.stats.damage
  let damage =
    base +
    (unit.kind === 'feeder' ? unit.fury : 0) +
    (unseen ? CLOAK_DAMAGE + when(true, 'shadowStrike', SHADOW_DAMAGE) : 0) +
    (crit ? CRIT_BONUS + when(true, 'headshot', HEADSHOT_DAMAGE) : 0) +
    when(enemy.hp <= enemy.stats.hp / 2, 'executioner', EXECUTE_BONUS) +
    when(coverAgainst(battle, enemy, unit) === 0, 'backstab', BACKSTAB_DAMAGE) +
    when(unit.hp <= unit.stats.hp / 2, 'rage', RAGE_DAMAGE) +
    when(enemy.hp < enemy.stats.hp, 'slayer', SLAYER_DAMAGE) +
    (enemy.marked ? TUNING.markDamage : 0) +
    when(enemy.burning > 0, 'accelerant', TUNING.accelerantDamage) +
    when(enemy.chilled > 0, 'shatter', TUNING.shatterDamage) +
    when(enemy.burning > 0, 'searing', SEARING_DAMAGE) +
    when(enemy.chilled > 0, 'icebreak', SEARING_DAMAGE) +
    when(enemy.burning > 0 && enemy.chilled > 0, 'thermal', TUNING.thermalDamage) +
    when(unit.armor > 0, 'armored', 1) +
    when(enemy.rooted > 0, 'net', 2) +
    when(enemy.boss, 'bounty', BOUNTY_DAMAGE) +
    when(unit.fury > 0, 'bloodRite', unit.fury)
  if (when(enemy.armor > 0, 'shred', 1)) enemy.armor = 0
  const pierced = unit.resists.includes('ward') || when(enemy.chilled > 0, 'brittle', 1) + when(enemy.chilled > 0, 'frostbreak', 1) > 0
  const left = enemy.hp + (pierced ? 0 : enemy.armor)
  if (spend(enemy, 'shield')) {
    damage = 0
    events.push({ type: 'effect', id: enemy.id, effect: 'shield', amount: 0 })
    // No one shot kills a commander from full health.
  } else if (damage >= left && ((enemy.target && enemy.hp === enemy.stats.hp) || spend(enemy, 'lastStand'))) {
    damage = left - 1
    events.push({ type: 'effect', id: enemy.id, effect: 'lastStand', amount: 0 })
  }
  // Those beside the target, for a volley or a cleave, as they stand before the hit.
  const beside = battle.units.filter((u) => u.side === enemy.side && u !== enemy && distance(u, enemy) <= 1)
  events.unshift({ type: 'shot', id: unit.id, target: enemy.id, hit, crit, damage, with: used })
  if (battle.twist === 'crumbling' && damage > 0) crumble(battle, enemy, unit)
  // A bonded squadmate beside the target takes the hit in its place.
  const guard = battle.units.find((u) => u.side === enemy.side && u !== enemy && u.hp > 0 && has(u, 'bond') && distance(u, enemy) <= 1)
  if (guard && damage > 0) {
    events.push({ type: 'effect', id: guard.id, effect: 'bond', amount: -damage })
    wound(battle, guard, damage, events, pierced, crit)
  } else wound(battle, enemy, damage, events, pierced, crit)
  const spare = enemy.hp <= 0 ? when(damage > left, 'overkill', damage - left) : 0
  const next = spare > 0 ? nearest(battle.units.filter((u) => u.side === enemy.side && u.hp > 0), enemy) : undefined
  if (next) {
    events.push({ type: 'effect', id: next.id, effect: 'overkill', amount: -spare })
    wound(battle, next, spare, events)
  }
  const splash = when(damage > 0, 'volley', Math.ceil(damage / 2)) || when(enemy.hp <= 0, 'cleave', CLEAVE_DAMAGE)
  for (const other of splash > 0 ? beside : []) {
    events.push({ type: 'effect', id: other.id, effect: has(unit, 'volley') ? 'volley' : 'cleave', amount: -splash })
    wound(battle, other, splash, events)
  }
  // An arc leaps from the target to the nearest alien not yet struck, and on again.
  if (crit && damage > 0 && when(true, 'arc', 1)) {
    const struck = new Set([enemy.id])
    let from: Unit = enemy
    for (let leap = 0; leap < ARC_LEAPS; leap++) {
      const next = nearest(battle.units.filter((u) => u.side === enemy.side && !struck.has(u.id) && distance(u, from) <= ARC_REACH), from)
      if (!next) break
      struck.add(next.id)
      events.push({ type: 'effect', id: next.id, effect: 'arc', amount: -Math.ceil(damage / 2) })
      wound(battle, next, Math.ceil(damage / 2), events)
      from = next
    }
  }
  if (enemy.hp <= 0 && when(true, 'volatile', 1)) {
    for (const other of beside.filter((u) => u.hp > 0)) {
      events.push({ type: 'effect', id: other.id, effect: 'volatile', amount: -VOLATILE_DAMAGE })
      wound(battle, other, VOLATILE_DAMAGE, events)
    }
  }
  if (enemy.hp > 0 && !enemy.resists.includes('mark') && (when(true, 'mark', 1) || when(true, 'tracer', 1) || when(crit, 'exploit', 1))) enemy.marked = true
  const cryo = damage > 0 && unit.ability === 'cryo'
  if (enemy.hp > 0 && !enemy.resists.includes('frost') && (when(damage > 0, 'frostbite', 1) || cryo || when(crit, 'freeze', 1))) {
    enemy.chilled = chillFrom(unit)
    if (when(true, 'glacial', 1) + when(true, 'rimeLock', 1) > 0) enemy.rooted = CHILL_TURNS
    events.push({ type: 'effect', id: enemy.id, effect: has(unit, 'frostbite') ? 'frostbite' : cryo ? 'cryo' : 'freeze', amount: 0 })
    if (enemy.marked && has(unit, 'conductor')) {
      for (const other of battle.units.filter((u) => u.side === enemy.side && u !== enemy && distance(u, enemy) <= 1 && !u.resists.includes('frost'))) {
        other.chilled = CHILL_TURNS
        events.push({ type: 'effect', id: other.id, effect: 'conductor', amount: 0 })
      }
    }
  }
  if (enemy.hp > 0 && crit && enemy.chilled > 0 && when(true, 'stasis', 1) + when(true, 'deepFreeze', 1) > 0) {
    enemy.panicked = true
    events.push({ type: 'effect', id: enemy.id, effect: has(unit, 'stasis') ? 'stasis' : 'deepFreeze', amount: 0 })
  }
  if (enemy.hp > 0 && damage > 0 && distance(unit, enemy) <= 1 && when(true, 'hurl', 1)) knockback(battle, unit, enemy, events, 1, HURL_TILES, HURL_DAMAGE, 'hurl')
  else if (enemy.hp > 0 && damage > 0 && when(true, 'thunder', 1)) knockback(battle, unit, enemy, events)
  if (enemy.hp > 0 && damage > 0 && when(true, 'tether', 1)) knockback(battle, unit, enemy, events, -1)
  if (enemy.hp > 0 && when(true, 'snare', 1)) {
    enemy.rooted = CHILL_TURNS
    events.push({ type: 'effect', id: enemy.id, effect: 'snare', amount: 0 })
  }
  if (enemy.hp > 0 && when(true, 'booming', 1)) {
    enemy.booming = CHILL_TURNS
    events.push({ type: 'effect', id: enemy.id, effect: 'booming', amount: 0 })
  }
  if (enemy.hp > 0 && unseen && !enemy.boss && when(true, 'daze', 1)) {
    enemy.panicked = true
    events.push({ type: 'effect', id: enemy.id, effect: 'daze', amount: 0 })
  }
  if (enemy.hp <= 0 && unseen && when(true, 'afterimage', 1)) events.push(cloakOn(unit))
  if (enemy.hp > 0 && enemy.hp <= enemy.stats.hp / 2 && spend(enemy, 'blink')) blink(battle, enemy, events)
  if (enemy.hp > 0 && enemy.hp <= enemy.stats.hp / 2 && !enemy.cloaked && spend(enemy, 'vanish')) events.push(cloakOn(enemy))
  if (enemy.hp <= 0 && when(true, 'momentum', 1)) unit.armor++
  if (enemy.hp <= 0 && when(true, 'bloodRite', 1)) unit.fury++
  if (enemy.hp > 0 && when(true, 'suppress', 1)) enemy.suppressed = 2
  if (enemy.hp > 0 && crit && has(unit, 'concussion')) {
    enemy.panicked = true
    events.push({ type: 'effect', id: enemy.id, effect: 'concussion', amount: 0 })
  }
  if (enemy.hp > 0 && !fireproof(battle, enemy) && ((damage > 0 && (has(unit, 'incendiary') || has(unit, 'tinder'))) || when(crit, 'ignite', 1))) {
    enemy.burning = burnFrom(unit)
    events.push({ type: 'effect', id: enemy.id, effect: has(unit, 'incendiary') ? 'incendiary' : has(unit, 'tinder') ? 'tinder' : 'ignite', amount: 0 })
  }
  const healing = (damage > 0 && has(unit, 'vampiric') ? 1 : 0) + (enemy.hp <= 0 && has(unit, 'feast') ? FEAST_HEAL : 0)
  const healed = Math.min(healing, unit.stats.hp - unit.hp)
  if (healed > 0) {
    unit.hp += healed
    events.push({ type: 'effect', id: unit.id, effect: enemy.hp <= 0 && has(unit, 'feast') ? 'feast' : 'vampiric', amount: healed })
  }
  if (has(enemy, 'kindling') && enemy.armor > 0 && !fireproof(battle, unit)) {
    unit.burning = BURN_TURNS
    events.push({ type: 'effect', id: unit.id, effect: 'kindling', amount: 0 })
  }
  if (has(enemy, 'rime')) {
    unit.chilled = CHILL_TURNS
    events.push({ type: 'effect', id: unit.id, effect: 'rime', amount: 0 })
  }
  if (has(enemy, 'thorns')) {
    events.push({ type: 'effect', id: unit.id, effect: 'thorns', amount: -1 })
    wound(battle, unit, 1, events)
  }
  if (when(true, 'demolish', 1)) {
    wreck(battle, enemy)
    events.push({ type: 'effect', id: enemy.id, effect: 'demolish', amount: 0 })
  }
  if (enemy.kind === 'brute' && enemy.hp > 0 && unit.hp > 0) charge(battle, enemy, unit, events)
  return [...events, ...again(battle, unit, seen, granted, enemy.hp <= 0)]
}

/**
 * The one more shot a shot may grant: after a kill, to a soldier with frenzy or a frenzied weapon; else to one with
 * double tap who did not move; else, once per battle, to one with action surge.
 */
export function again(battle: Battle, unit: Unit, seen: Set<number>, granted: Effect | undefined, killed: boolean): GameEvent[] {
  if (granted || unit.hp <= 0) return []
  // Twin and double tap add one shot to a turn's attacks, after the last.
  const last = battle.attacks >= attacksOf(unit)
  const by: Effect | null =
    killed && has(unit, 'frenzy') ? 'frenzy' : killed && has(unit, 'chain') ? 'chain' : last && has(unit, 'twin') ? 'twin' : last && has(unit, 'doubleTap') && !unit.moved ? 'doubleTap' : has(unit, 'surge') && !unit.spent.includes('surge') ? 'surge' : null
  if (!by) return []
  const shots = shoot(battle, unit, seen, by)
  if (by === 'surge' && shots.length > 0) unit.spent.push('surge')
  return shots
}

/** Primary attacks the unit makes each turn. */
export const attacksOf = (unit: Unit) => (isSoldier(unit) ? SOLDIER_ATTACKS : 1)

/** A shot missed `target`: a fuel tank beside it goes up, hurting and setting burning everyone beside the tank. */
export function ignite(battle: Battle, target: Unit): GameEvent[] {
  const tank = NEIGHBORS.map(([dx, dy]) => ({ x: target.x + dx, y: target.y + dy })).find((t) => onGrid(t.x, t.y) && battle.props[t.y * GRID + t.x] === 'fuel')
  if (!tank) return []
  const caught = battle.units.filter((u) => distance(u, tank) <= 1 && !immune(battle, u, 'blast'))
  const events: GameEvent[] = [{ type: 'rocket', id: target.id, x: tank.x, y: tank.y, hits: caught.map((u) => ({ target: u.id, damage: FUEL_DAMAGE })) }]
  wreck(battle, tank, 0)
  for (const unit of caught) {
    wound(battle, unit, FUEL_DAMAGE, events)
    if (unit.hp > 0 && !fireproof(battle, unit)) unit.burning = BURN_TURNS
  }
  return events
}

/**
 * A blast on the shootable enemy with the most enemies around it, if at least two are caught and no ally is.
 * It wrecks the props and walls it catches. A rocket replaces the shot; a grenade does not.
 */
export function blast(battle: Battle, unit: Unit, seen: Set<number>, damage: number, radius = BLAST_RADIUS): GameEvent[] {
  const inBlast = (centre: Tile) => battle.units.filter((u) => distance(centre, u) <= radius)
  let best: Unit[] = []
  let centre: Unit | undefined
  for (const enemy of battle.units) {
    if (enemy.side === unit.side || !shootable(battle, unit, unit, enemy, seen)) continue
    const caught = inBlast(enemy)
    if (caught.every((u) => u.side !== unit.side) && caught.length > Math.max(1, best.length)) {
      best = caught
      centre = enemy
    }
  }
  if (!centre) return []
  const events: GameEvent[] = [{ type: 'rocket', id: unit.id, x: centre.x, y: centre.y, hits: best.map((u) => ({ target: u.id, damage })) }]
  for (const target of best) wound(battle, target, damage, events)
  wreck(battle, centre, radius)
  return events
}

/** Napalm: a blast that sets those it catches burning and the ground it covers alight. */
export function napalm(battle: Battle, unit: Unit, seen: Set<number>): GameEvent[] {
  const radius = has(unit, 'inferno') ? BIG_BLAST_RADIUS : BLAST_RADIUS
  const events = blast(battle, unit, seen, NAPALM_DAMAGE, radius)
  const landed = events[0]
  if (landed?.type !== 'rocket') return events
  landed.fire = true
  for (let y = landed.y - radius; y <= landed.y + radius; y++) {
    for (let x = landed.x - radius; x <= landed.x + radius; x++) {
      if (onGrid(x, y) && !onTile(battle.fire, { x, y })) battle.fire.push({ x, y, turns: FIRE_TURNS })
    }
  }
  for (const hit of landed.hits) {
    const target = battle.units.find((u) => u.id === hit.target)
    if (target && target.hp > 0 && !fireproof(battle, target)) target.burning = burnFrom(unit)
  }
  return events
}

/** A brute that survives a hit charges: it moves at once as near the shooter as its move allows. */
export function charge(battle: Battle, brute: Unit, shooter: Unit, events: GameEvent[]): void {
  const toShooter = walkingDistances(battle, shooter)
  walk(brute, bestPath(paths(battle, brute, brute.stats.move), brute, (end) => [toShooter[end.y * GRID + end.x]]), events)
}

export const BLINK_REACH = 5

/**
 * Heroic Leap: once per battle, onto two or more foes, or onto one when it has nothing to attack from where it stands.
 * Each foe beside the landing is hurt and rooted.
 */
export function leap(battle: Battle, unit: Unit, seen: Set<number>): GameEvent[] {
  const jump = leapTo(battle, unit)
  const idle = !battle.units.some((u) => u.side !== unit.side && shootable(battle, unit, unit, u, seen))
  if (!jump || (jump.caught.length < 2 && !idle)) return []
  unit.spent.push('leap')
  Object.assign(unit, { x: jump.to.x, y: jump.to.y, moved: true })
  const events: GameEvent[] = [{ type: 'move', id: unit.id, path: [jump.to], with: 'leap' }]
  for (const foe of jump.caught) {
    foe.rooted = CHILL_TURNS
    events.push({ type: 'effect', id: foe.id, effect: 'leap', amount: -LEAP_DAMAGE })
    wound(battle, foe, LEAP_DAMAGE, events)
  }
  return events
}

/** Blink: the unit vanishes to the free tile within reach where the enemy's best shot at it is worst. */
export function blink(battle: Battle, unit: Unit, events: GameEvent[]): void {
  const enemies = enemiesOf(battle, unit)
  const tiles = freeTilesNear(battle, unit, 4 * BLINK_REACH * BLINK_REACH).filter((t) => distance(t, unit) <= BLINK_REACH)
  const to = tiles.reduce<Tile | undefined>((best, t) => (!best || exposure(battle, enemies, t) < exposure(battle, enemies, best) ? t : best), undefined)
  if (!to) return
  unit.x = to.x
  unit.y = to.y
  events.push({ type: 'move', id: unit.id, path: [to], with: 'blink' })
}
