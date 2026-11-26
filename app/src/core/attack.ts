// A unit's shot, and what a hit or kill sets off: fire, knockback, the effects of gear, relics and Powers.
import { PLATES_UNDER } from './exams'
import { attackSrc, fx, srcOf } from './sources'
import { type Battle, type Unit, CLOAK_DAMAGE, GUARD_MAX, CRIT_BONUS, CHILL_TURNS, CHILL_DAMAGE, BURN_STACKS, SUPPRESS_DAMAGE, FEAST_HEAL, EXECUTE_BONUS, type Effect, GRID, type Tile, STAGGER_DAMAGE, VOLATILE_DAMAGE, NUMB_SOAK, OVERKILL_FROM, isSoldier } from './battle'
import { freeTilesNear, blocked, crumble, wreck, onGrid, NEIGHBORS, distance } from './grid'
import type { GameEvent, ShotEvent } from './combat-event'
import { onTile, has, spend, shootable, nearest, enemiesOf, fireproof, BOUNTY_DAMAGE } from './fighters'
import { armorCap, carryOverkill, displaced, WEAKEN_TURNS, chillUnit, empower, highCrit, kindle, markUnit, scaledDamage, spendStacks, stackDamage, struck } from './stacks'
import { land, mend, wound } from './wound'
import { shoveOff, knockback, knocksInto, pushesOff } from './knockback'
import { SLAM_DAMAGE } from './wound'
import { TUNING } from './tuning'
import { bite, MIN_DAMAGE, odds } from './sight'
import { random } from './rng'
import { preyed } from './pathing'
import { charge, fury, hold, turned } from './brawlers'
import { threat } from './threat'
import { FUEL_DAMAGE } from './twists'

/** One hit of a card: its reach, and which of the card's hits it is. */
export interface Blow {
  range: number
  nth: number
}

/** Whether an alien closes to fight up close, so rooting it pays most. */
export const closing = (unit: Unit) => unit.stance === 'rush' || unit.stats.range <= 1

/**
 * What a shooter's gear makes a target worth beyond the share of its damage a shot lands, in that share: holding back an alien that closes
 * in, pulling one that keeps its distance, knocking one into harm, and bursts or arcs where aliens crowd.
 */
export function worth(battle: Battle, unit: Unit, enemy: Unit): number {
  const near = (reach: number) => battle.units.filter((u) => u.side === enemy.side && u !== enemy && distance(u, enemy) <= reach).length
  const behind = { x: enemy.x + Math.sign(enemy.x - unit.x), y: enemy.y + Math.sign(enemy.y - unit.y) }
  const harmful = blocked(battle, behind.x, behind.y) || onTile(battle.acid, behind) || onTile(battle.fire, behind)
  return (
    (has(unit, 'snare') && closing(enemy) && enemy.rooted === 0 ? 0.2 : 0) +
    (has(unit, 'booming') && closing(enemy) && enemy.booming === 0 ? 0.15 : 0) +
    (has(unit, 'tether') && !closing(enemy) ? 0.15 : 0) +
    (has(unit, 'thunder') && harmful ? 0.2 : 0) +
    (unit.side === 'human' && pushesOff(battle, unit, enemy) ? LEDGE_WORTH : 0) +
    (has(unit, 'net') && enemy.rooted > 0 ? 0.1 : 0) +
    (has(unit, 'volatile') && enemy.hp + enemy.armor <= unit.stats.damage ? 0.1 * near(1) : 0) +
    (has(unit, 'arc') ? 0.05 * Math.min(ARC_LEAPS, near(ARC_REACH)) : 0)
  )
}

/** What knocking a target off a ledge or the edge is worth beyond a shot's share. */
const LEDGE_WORTH = 0.6

/** What a soldier's full health adds to its worth as an alien's target. */
export const SPREAD = 0.5

/** Tiles a ricochet reaches from its target, an arc leaps, and the leaps it makes. */
export const RICOCHET_REACH = 3

export const ARC_REACH = 3

export const ARC_LEAPS = 2

/** The most armor Bloodforged Plate's kills add over a hero's own. */
export const MOMENTUM_MAX = 5

/**
 * A shot, which always lands, at the enemy the unit can shoot and hurt most, a civilian counting PREY_WORTH; the nearest, then the lowest id, wins a tie.
 * With `only`, the shot is at that enemy or not at all. The effects of both units' gear and relics, and of Powers, apply.
 * `granted` names the effect that gave the shot. A `blow` is one hit of a card; what happens once a card's attack happens on its first.
 */
export function shoot(battle: Battle, unit: Unit, granted?: Effect, only?: Unit, blow?: Blow): GameEvent[] {
  const aim = blow ? { ...unit, stats: { ...unit.stats, range: blow.range } } : unit
  const first = !blow?.nth
  const inReach = (only ? [only] : battle.units).filter((other) => other.side !== unit.side && shootable(battle, aim, unit, other))
  // Aliens spread their fire: a healthier soldier is the likelier target.
  const spread = (other: Unit) => (unit.side === 'alien' && !other.civilian ? SPREAD * (other.hp / other.stats.hp) : 0)
  const landed = (other: Unit) => preyed(other, bite(battle, unit, other, unit.stats)) / (turned(unit, other) ? 2 : 1) + worth(battle, unit, other)
  const value = (other: Unit) => (unit.side === 'human' && other.side === 'alien' ? landed(other) * threat(battle, other, bite(battle, unit, other, unit.stats) * unit.stats.damage) : spread(other) + landed(other))
  let enemy: Unit | undefined
  for (const other of inReach) {
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
  // An attack out of cloak strikes harder and past armor, and breaks the cloak.
  const unseen = !!unit.cloaked
  if (unit.cloaked) {
    unit.cloaked = 0
    events.push({ type: 'cloak', id: unit.id, on: false })
  }
  const gain = odds(battle, unit, enemy)
  const blunted = (unit.chill > 0 ? CHILL_DAMAGE : 0) + (unit.suppressed > 0 ? Math.max(SUPPRESS_DAMAGE, Math.round(unit.stats.damage / 4)) : 0) + (enemy.numb > 0 ? NUMB_SOAK : 0)
  const sure = when(spend(unit, 'opener'), 'opener', 1) > 0
  const crit = !enemy.resists.includes('crit') && (sure || random(battle) < unit.stats.crit + highCrit(battle, unit, enemy))
  unit.hits++
  // A mirror hits as hard as the hero; a card hit as hard as the card.
  const base = unit.kind === 'mirror' ? Math.max(unit.stats.damage, ...battle.units.filter(isSoldier).map((s) => s.stats.damage)) : (unit.dealing ?? unit.stats.damage)
  const dealt =
    base +
    gain -
    blunted +
    (crit ? CRIT_BONUS : 0) +
    (unseen ? CLOAK_DAMAGE : 0) +
    when(enemy.hp <= enemy.stats.hp / 2, 'executioner', EXECUTE_BONUS) +
    (enemy.mark > 0 ? TUNING.markDamage : 0) +
    when(unit.armor > 0, 'armored', 1) +
    when(enemy.rooted > 0, 'net', 2) +
    when(enemy.shifted, 'stagger', STAGGER_DAMAGE) +
    when(enemy.boss, 'bounty', BOUNTY_DAMAGE) +
    stackDamage(unit, used) +
    spendStacks(battle, unit, enemy, used, events) +
    fury(battle, unit, enemy)
  let damage = scaledDamage(unit, enemy, base > 0 ? Math.max(MIN_DAMAGE, dealt) : Math.max(0, dealt), used)
  if (turned(unit, enemy)) damage = Math.ceil(damage / 2)
  if (has(enemy, 'plates') && damage > 1 && damage < PLATES_UNDER) {
    damage = Math.ceil(damage / 2)
    events.push(fx(enemy.id, 'plates', 0))
  }
  const pierced = unseen || has(unit, 'piercing') || unit.resists.includes('armor') || when(enemy.chill > 0, 'brittle', 1) > 0
  const left = enemy.hp + (pierced ? 0 : enemy.armor)
  // No one shot kills a commander from full health.
  if (damage >= left && enemy.target && enemy.hp === enemy.stats.hp) damage = left - 1
  // Those beside the target, as they stand before the hit.
  const beside = battle.units.filter((u) => u.side === enemy.side && u !== enemy && distance(u, enemy) <= 1)
  const shot: ShotEvent = { type: 'shot', src: used[0] ? srcOf(used[0]) : attackSrc(unit), id: unit.id, target: enemy.id, crit, damage, with: used, ...(blow ? { nth: blow.nth } : {}) }
  events.unshift(shot)
  if (battle.twist === 'crumbling' && damage > 0) crumble(battle, enemy, unit)
  land(battle, shot, enemy, events, pierced, crit)
  if (damage > 0) struck(battle, unit, enemy, events)
  if (battle.twist === 'fuel' && damage > 0) events.push(...ignite(battle, enemy))
  // A ricochet strikes another alien near the target for half.
  const bounce = damage > 0 ? nearest(inReach.filter((u) => u !== enemy && u.hp > 0 && distance(u, enemy!) <= RICOCHET_REACH), enemy) : undefined
  if (bounce && when(true, 'ricochet', 1)) {
    const half = Math.max(MIN_DAMAGE, Math.floor(damage / 2))
    events.push(fx(bounce.id, 'ricochet', -half))
    wound(battle, bounce, half, events)
  }
  if (when(damage > OVERKILL_FROM, 'overkill', 1)) carryOverkill(battle, enemy, damage - OVERKILL_FROM, events)
  // An arc leaps from the target to the nearest alien not yet struck, and on again.
  if (crit && damage > 0 && when(true, 'arc', 1)) {
    const struck = new Set([enemy.id])
    let from: Unit = enemy
    for (let leap = 0; leap < ARC_LEAPS; leap++) {
      const next = nearest(battle.units.filter((u) => u.side === enemy.side && !struck.has(u.id) && distance(u, from) <= ARC_REACH), from)
      if (!next) break
      struck.add(next.id)
      events.push(fx(next.id, 'arc', -Math.ceil(damage / 2)))
      wound(battle, next, Math.ceil(damage / 2), events)
      from = next
    }
  }
  if (enemy.hp <= 0 && when(true, 'volatile', 1)) {
    const burst = Math.max(VOLATILE_DAMAGE, damage - left)
    for (const other of beside.filter((u) => u.hp > 0)) {
      events.push(fx(other.id, 'volatile', -burst))
      wound(battle, other, burst, events)
    }
  }
  if (enemy.hp <= 0 && when(true, 'chain', 1)) battle.energy++
  if (enemy.hp > 0 && (when(true, 'tracer', 1) || when(crit, 'exploit', 1))) markUnit(enemy, 1)
  if (enemy.hp > 0 && enemy.numb === 0 && !enemy.resists.includes('chill') && (when(damage > 0, 'frostbite', 1) || when(crit, 'freeze', 1))) {
    events.push(fx(enemy.id, has(unit, 'frostbite') ? 'frostbite' : 'freeze', 0))
    chillUnit(battle, enemy, 1, events)
    if (when(true, 'glacial', 1)) enemy.rooted = CHILL_TURNS
  }
  // A thunder that would hit nothing leaves the alien where the hero can finish it.
  if (first && enemy.hp > 0 && damage > 0 && (unit.side !== 'human' || knocksInto(battle, unit, enemy)) && when(true, 'thunder', 1)) knockback(battle, unit, enemy, events)
  else if (first && enemy.hp > 0 && damage > 0 && when(true, 'shove', 1)) knockback(battle, unit, enemy, events, 1, 1, SLAM_DAMAGE, 'shove')
  else if (first && enemy.hp > 0 && damage > 0 && unit.side === 'human' && when(true, 'gravity', 1)) {
    // A boss is too heavy to knock: it reels where it stands, moved for what reads it.
    if (enemy.boss) displaced(battle, enemy, events)
    else knockback(battle, unit, enemy, events, 1, 1, SLAM_DAMAGE, 'gravity')
  }
  if (first && enemy.hp > 0 && damage > 0) shoveOff(battle, unit, enemy, events)
  if (first && enemy.hp > 0 && damage > 0 && when(true, 'tether', 1)) knockback(battle, unit, enemy, events, -1)
  if (enemy.hp > 0 && when(true, 'snare', 1)) {
    enemy.rooted = CHILL_TURNS
    events.push(fx(enemy.id, 'snare', 0))
  }
  if (enemy.hp > 0 && when(true, 'booming', 1)) {
    enemy.booming = CHILL_TURNS
    events.push(fx(enemy.id, 'booming', 0))
  }
  if (enemy.hp > 0 && enemy.hp <= enemy.stats.hp / 2 && spend(enemy, 'blink')) blink(battle, enemy, events)
  if (enemy.hp <= 0 && unit.armor < armorCap(unit, unit.stats.armor + MOMENTUM_MAX) && when(true, 'momentum', 1)) unit.armor++
  if (enemy.hp <= 0 && has(unit, 'bloodRite')) empower(unit, 1, 'bloodRite', events)
  if (enemy.hp > 0 && damage > 0 && when(true, 'sapping', 1)) enemy.suppressed = Math.max(enemy.suppressed, WEAKEN_TURNS)
  if (damage > 0 && unit.armor < armorCap(unit, unit.stats.armor + GUARD_MAX) && when(true, 'braced', 1)) unit.armor++
  if (enemy.hp > 0 && enemy.numb === 0 && !fireproof(battle, enemy) && ((damage > 0 && has(unit, 'incendiary')) || when(crit, 'ignite', 1))) {
    kindle(battle, enemy, has(unit, 'incendiary') && !first ? 1 : BURN_STACKS, events)
    events.push(fx(enemy.id, has(unit, 'incendiary') ? 'incendiary' : 'ignite', 0))
  }
  if (damage > 0 && has(unit, 'vampiric')) mend(unit, 1, 'vampiric', events)
  if (enemy.hp <= 0 && has(unit, 'feast')) mend(unit, FEAST_HEAL, 'feast', events)
  if (has(enemy, 'kindling') && enemy.armor > 0 && !fireproof(battle, unit)) {
    kindle(battle, unit, BURN_STACKS, events)
    events.push(fx(unit.id, 'kindling', 0))
  }
  if (has(enemy, 'thorns')) {
    events.push(fx(unit.id, 'thorns', -1))
    wound(battle, unit, 1, events)
  }
  if (first && enemy.kind === 'brute' && enemy.hp > 0 && unit.hp > 0) charge(battle, enemy, unit, events)
  if (first && damage > 0) hold(unit, enemy, events)
  return events
}

/** A shot struck `target`: a fuel tank beside it goes up, hurting and setting burning everyone beside the tank. */
export function ignite(battle: Battle, target: Unit): GameEvent[] {
  const tank = NEIGHBORS.map(([dx, dy]) => ({ x: target.x + dx, y: target.y + dy })).find((t) => onGrid(t.x, t.y) && battle.props[t.y * GRID + t.x] === 'fuel')
  if (!tank) return []
  const caught = battle.units.filter((u) => distance(u, tank) <= 1)
  const events: GameEvent[] = [{ type: 'rocket', src: { kind: 'object', id: 'fuel' }, id: target.id, x: tank.x, y: tank.y, hits: caught.map((u) => ({ target: u.id, damage: FUEL_DAMAGE })) }]
  wreck(battle, tank, 0)
  for (const unit of caught) {
    wound(battle, unit, FUEL_DAMAGE, events)
    kindle(battle, unit, BURN_STACKS, events)
  }
  return events
}

export const BLINK_REACH = 5

/** Blink: the unit vanishes to the free tile within reach farthest from the enemy. */
export function blink(battle: Battle, unit: Unit, events: GameEvent[]): void {
  const enemies = enemiesOf(battle, unit)
  const away = (t: Tile) => Math.min(...enemies.map((e) => distance(e, t)))
  const tiles = freeTilesNear(battle, unit, 4 * BLINK_REACH * BLINK_REACH).filter((t) => distance(t, unit) <= BLINK_REACH)
  const to = tiles.reduce<Tile | undefined>((best, t) => (!best || away(t) > away(best) ? t : best), undefined)
  if (!to) return
  unit.x = to.x
  unit.y = to.y
  events.push({ type: 'move', src: srcOf('blink'), id: unit.id, path: [to], with: 'blink' })
}

