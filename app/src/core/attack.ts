// A unit's shot, and what a hit or kill sets off: blasts, fire, knockback, leaps.
import { attackSrc, fx, srcOf } from './sources'
import { type Battle, type Unit, BASE_STATS, SUPPRESS_DAMAGE, SPOTTER_DAMAGE, SLAYER_DAMAGE, SEARING_DAMAGE, RAGE_DAMAGE, isSoldier, INSPIRE_DAMAGE, HURL_TILES, HURL_DAMAGE, REPULSE_TILES, HEADSHOT_DAMAGE, FEAST_HEAL, EXECUTE_BONUS, DODGE_SOAK, CRIT_BONUS, CLEAVE_DAMAGE, CHILL_TURNS, CHILL_DAMAGE, BURN_STACKS, BULWARK_SOAK, BANE_REACH, BANE_DAMAGE, BACKSTAB_DAMAGE, type Effect, SOLDIER_ATTACKS, GRID, type Tile, BLAST_RADIUS, NAPALM_DAMAGE, BIG_BLAST_RADIUS, LEAP_DAMAGE, CLOAK_DAMAGE, SHADOW_DAMAGE } from './battle'
import { cloakOn } from './abilities'
import { duoCrit, duoDamage, duoHit } from './duo-effects'
import { afterHit, EARTHSHAKER_DAMAGE, hallowed, INTANGIBLE_CHANCE } from './keystones'
import { freeTilesNear, blocked, crumble, wreck, onGrid, NEIGHBORS, distance } from './grid'
import { PARRY_SOAK } from './doctrines'
import { FRAG_SPLASH, KNOCK_TILES, type Secondary } from './secondaries'
import type { GameEvent } from './combat-event'
import { aiming, powering, onTile, has, spend, shootable, nearest, enemiesOf, MIRROR_IMAGES, inAura, fireproof, BOUNTY_DAMAGE, immune, FIRE_TURNS } from './fighters'
import { burnFrom, chillFrom, chillUnit, empower, highCrit, kindle, scaledDamage, stackDamage, struck } from './stacks'
import { wound } from './wound'
import { shoveOff, drive, knockback, pushesOff } from './knockback'
import { SLAM_DAMAGE } from './wound'
import { TUNING } from './tuning'
import { bite, MIN_DAMAGE, odds } from './sight'
import { random } from './rng'
import { preyed, leapTo } from './pathing'
import { charge, fury, hold, turned } from './brawlers'
import { threat } from './threat'
import { FUEL_DAMAGE } from './twists'
import { BLOCK_SOAK, WEAPONS, type Guard, type Kit, type Weapon } from './weapons'

/** What a shot of `power` makes of `damage`: a light shot its share; a heavy blow multiplies the first BASE_STATS.damage and adds the rest once. */
export const wielded = (damage: number, power: number) => (power > 1 ? Math.min(damage, BASE_STATS.damage) * power + Math.max(0, damage - BASE_STATS.damage) : damage * power)

/** One shot of a weapon's attack, and what the attack's shots share: one crit roll, and an attack out of cloak. */
interface Blow {
  kit: Kit
  nth: number
  form?: 'throw' | 'rocket'
  crit?: boolean
  unseen?: boolean
}

/** Whether an alien closes to fight up close, so rooting or charging it pays most. */
export const closing = (unit: Unit) => unit.stance === 'rush' || unit.stats.range <= 1

/**
 * What a shooter's gear makes a target worth beyond the share of its damage a shot lands, in that share: holding back an alien that closes
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

/** Damage a volatile kill bursts for, and a thundering hit slams a target into what stops it for. */
export const VOLATILE_DAMAGE = 2

/** The most armor Bloodforged Plate's kills add over a hero's own. */
export const MOMENTUM_MAX = 5

/**
 * A shot, which always lands, at the enemy the unit can shoot and hurt most, a civilian counting PREY_WORTH; the nearest, then the lowest id, wins a tie.
 * An alien that can shoot a taunting soldier, must. With `only`, the shot is at that enemy or not at all.
 * The effects of both units' gear and skills, and of relics, apply. `granted` names the effect that gave a shot
 * beyond the unit's own; such a shot grants no further one. A `secondary` attacks in place of the weapon: its reach, damage and effect.
 * A `blow` is one shot of a weapon's attack, scaled by its kit; what happens once an attack happens on its first.
 */
export function shoot(battle: Battle, unit: Unit, seen: Set<number>, granted?: Effect, only?: Unit, secondary?: Secondary, blow?: Blow): GameEvent[] {
  const aim = blow?.kit.range ? { ...unit, stats: { ...unit.stats, range: blow.kit.range } } : aiming(unit, secondary)
  const first = !blow?.nth
  const inReach = (only ? [only] : battle.units).filter((other) => other.side !== unit.side && shootable(battle, aim, unit, other, seen))
  const taunting = inReach.filter((other) => has(other, 'taunt'))
  // Aliens spread their fire: a healthier soldier is the likelier target, so wounds fall across the squad.
  const spread = (other: Unit) => (unit.side === 'alien' && !other.civilian ? SPREAD * (other.hp / other.stats.hp) : 0)
  const landed = (other: Unit) => preyed(other, bite(battle, unit, other, unit.stats)) / (turned(unit, other) ? 2 : 1) + worth(battle, unit, other)
  // Heroes weigh each alien by the harm a shot stops: see threat.
  const value = (other: Unit) => (unit.side === 'human' && other.side === 'alien' ? landed(other) * threat(battle, other, bite(battle, unit, other, unit.stats) * unit.stats.damage) : spread(other) + landed(other))
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
  if (taunting.length > 0 && taunting.length < inReach.length) events.push(fx(enemy.id, 'taunt', 0))
  const baned = battle.units.some((u) => u.side !== unit.side && has(u, 'bane') && distance(u, unit) <= BANE_REACH)
  // An attack out of cloak strikes past armor and harder, and breaks the cloak.
  const unseen = !!unit.cloaked || !!blow?.unseen
  if (blow) blow.unseen = unseen
  if (unit.cloaked && !has(unit, 'livingShadow')) {
    unit.cloaked = 0
    events.push({ type: 'cloak', id: unit.id, on: false })
  }
  const gain = odds(battle, unit, enemy)
  const parried = has(enemy, 'parry') && distance(unit, enemy) > 1
  if (has(enemy, 'dodge')) events.push(fx(enemy.id, 'dodge', 0))
  if (parried) events.push(fx(enemy.id, 'parry', 0))
  const shielded = has(enemy, 'block') && distance(unit, enemy) > 1
  if (shielded) events.push(fx(enemy.id, 'block', 0))
  const blunted =
    (unit.chill > 0 ? CHILL_DAMAGE : 0) +
    (inAura(battle, enemy, 'bulwark') ? BULWARK_SOAK : 0) +
    (baned ? BANE_DAMAGE : 0) +
    (unit.suppressed > 0 ? SUPPRESS_DAMAGE : 0) +
    (has(enemy, 'dodge') ? DODGE_SOAK : 0) +
    (parried ? PARRY_SOAK : 0) +
    (shielded ? BLOCK_SOAK : 0)

  const sure = when(spend(unit, 'opener'), 'opener', 1) + when(enemy.hp === enemy.stats.hp, 'assassinate', 1) + when(!unit.moved, 'sureShot', 1) + when(enemy.marked, 'apex', 1) > 0 || duoCrit(battle, unit, enemy, events)
  const crit = !enemy.resists.includes('crit') && (sure || (blow ? (blow.crit ??= random(battle) < unit.stats.crit + highCrit(battle, unit, enemy)) : random(battle) < unit.stats.crit + highCrit(battle, unit, enemy)))
  unit.hits++
  // A mirror hits as hard as the squad's hardest hitter; a feeder as hard as it has grown.
  const base = unit.kind === 'mirror' ? Math.max(unit.stats.damage, ...battle.units.filter(isSoldier).map((s) => s.stats.damage)) : unit.stats.damage
  const dealt =
    base +
    (secondary?.damage ?? 0) +
    gain -
    blunted +
    (inAura(battle, unit, 'inspire') ? INSPIRE_DAMAGE : 0) +
    when(enemy.marked, 'spotter', SPOTTER_DAMAGE) +
    when(!unit.moved, 'steady', 1) +
    (unseen ? CLOAK_DAMAGE + when(true, 'shadowStrike', SHADOW_DAMAGE) : 0) +
    (crit ? CRIT_BONUS + when(true, 'headshot', HEADSHOT_DAMAGE) : 0) +
    when(enemy.hp <= enemy.stats.hp / 2, 'executioner', EXECUTE_BONUS) +
    when(!battle.units.some((u) => u.side === enemy.side && u !== enemy && distance(u, enemy) <= 1), 'backstab', BACKSTAB_DAMAGE) +
    when(unit.hp <= unit.stats.hp / 2, 'rage', RAGE_DAMAGE) +
    when(enemy.hp < enemy.stats.hp, 'slayer', SLAYER_DAMAGE) +
    (enemy.marked ? TUNING.markDamage : 0) +
    when(enemy.burn > 0, 'accelerant', enemy.burn) +
    when(enemy.chill > 0, 'shatter', TUNING.shatterDamage) +
    when(enemy.burn > 0, 'searing', SEARING_DAMAGE) +
    when(enemy.chill > 0, 'icebreak', SEARING_DAMAGE) +
    when(enemy.burn > 0 && enemy.chill > 0, 'thermal', TUNING.thermalDamage) +
    when(unit.armor > 0, 'armored', 1) +
    when(enemy.rooted > 0, 'net', 2) +
    when(enemy.boss, 'bounty', BOUNTY_DAMAGE) +
    stackDamage(unit, enemy, used) +
    fury(battle, unit, enemy) +
    duoDamage(battle, unit, enemy, events)
  // Light shots split bonuses by power too; a heavy blow adds them once. A fraction is a chance of one point more, so small shots add up to their share.
  const power = blow?.kit.power ?? 1
  const scaled = power !== 1 ? Math.floor(wielded(base, power) + (dealt - base) * Math.min(1, power) + random(battle)) : dealt
  let damage = scaledDamage(unit, enemy, base > 0 ? Math.max(MIN_DAMAGE, scaled) : Math.max(0, scaled), used)
  const warded = has(enemy, distance(unit, enemy) > 1 ? 'rangedShield' : 'meleeShield')
  if (warded) {
    damage = Math.ceil(damage / 2)
    events.push(fx(enemy.id, distance(unit, enemy) > 1 ? 'rangedShield' : 'meleeShield', 0))
  }
  if (has(enemy, 'fortress') || hallowed(battle, enemy) || turned(unit, enemy)) damage = Math.ceil(damage / 2)
  if (enemy.invulnerable) damage = 0
  if (has(enemy, 'intangible') && random(battle) < INTANGIBLE_CHANCE) {
    damage = 0
    events.push(fx(enemy.id, 'intangible', 0))
  }
  const deflect = guard(enemy, distance(unit, enemy) > 1, damage)
  if (deflect) damage = Math.floor(damage * deflect.lands)
  if (when(enemy.armor > 0, 'shred', 1)) enemy.armor = 0
  const pierced = unseen || secondary?.effect === 'pierce' || has(unit, 'piercing') || has(unit, 'pierce') || has(unit, 'psionic') || unit.resists.includes('ward') || when(enemy.chill > 0, 'brittle', 1) > 0
  const left = enemy.hp + (pierced ? 0 : enemy.armor)
  if (has(enemy, 'mirror') && enemy.spent.filter((e) => e === 'mirror').length < MIRROR_IMAGES) {
    damage = 0
    enemy.spent.push('mirror')
    events.push(fx(enemy.id, 'mirror', 0))
  } else if (spend(enemy, 'shield')) {
    damage = 0
    events.push(fx(enemy.id, 'shield', 0))
    // No one shot kills a commander from full health.
  } else if (damage >= left && ((enemy.target && enemy.hp === enemy.stats.hp) || spend(enemy, 'lastStand'))) {
    damage = left - 1
    events.push(fx(enemy.id, 'lastStand', 0))
  }
  // Those beside the target, for a volley or a cleave, as they stand before the hit.
  const beside = battle.units.filter((u) => u.side === enemy.side && u !== enemy && distance(u, enemy) <= 1)
  // The weapon's attack of a turn with a secondary still to come opens a combo.
  const opens = !secondary && !granted && isSoldier(unit) && battle.actor === unit.id && battle.attacks < attacksOf(unit)
  const shock = first && !secondary && unit.weapon ? WEAPONS[unit.weapon].stun : undefined
  events.unshift({ type: 'shot', src: used[0] ? srcOf(used[0]) : attackSrc(unit, secondary ? unit.secondary : undefined), id: unit.id, target: enemy.id, crit, damage, with: used, ...(deflect ? { deflect: deflect.word } : {}), ...(shock ? { ring: shock.reach } : {}), ...(secondary ? { secondary: unit.secondary } : {}), ...(opens ? { opens } : {}), ...(blow ? { nth: blow.nth, ...(blow.kit.ms ? { lasts: blow.kit.ms } : {}), ...(blow.form ? { form: blow.form } : {}) } : {}) })
  if (battle.twist === 'crumbling' && damage > 0) crumble(battle, enemy, unit)
  const alive = enemy.hp > 0
  wound(battle, enemy, damage, events, pierced, crit)
  if (damage > 0) struck(battle, unit, enemy, crit, events)
  const surged = !secondary && alive && enemy.hp <= 0 && unit.weapon && !battle.rules.includes('reckoning') ? WEAPONS[unit.weapon].surge : undefined
  if (surged) surge(unit, surged, events)
  if (battle.twist === 'fuel' && damage > 0) events.push(...ignite(battle, enemy))
  // A ricochet strikes another alien near the target for half.
  const bounce = damage > 0 ? nearest(inReach.filter((u) => u !== enemy && u.hp > 0 && distance(u, enemy!) <= RICOCHET_REACH), enemy) : undefined
  if (bounce && when(true, 'ricochet', 1)) {
    const half = Math.max(MIN_DAMAGE, Math.floor(damage / 2))
    events.push(fx(bounce.id, 'ricochet', -half))
    wound(battle, bounce, half, events)
  }
  const spare = enemy.hp <= 0 ? when(damage > left, 'overkill', damage - left) : 0
  const next = spare > 0 ? nearest(battle.units.filter((u) => u.side === enemy.side && u.hp > 0), enemy) : undefined
  if (next) {
    events.push(fx(next.id, 'overkill', -spare))
    wound(battle, next, spare, events)
  }
  const splash = when(damage > 0, 'volley', Math.ceil(damage / 2)) || when(enemy.hp <= 0, 'cleave', CLEAVE_DAMAGE)
  for (const other of splash > 0 ? beside : []) {
    events.push(fx(other.id, has(unit, 'volley') ? 'volley' : 'cleave', -splash))
    wound(battle, other, splash, events)
  }
  if (blow?.kit.wide && damage > 0) {
    for (const other of beside.filter((u) => u.hp > 0)) {
      const amount = Math.max(MIN_DAMAGE, Math.round(damage * blow.kit.wide))
      events.push({ type: 'hurt', id: other.id, amount, cause: 'impact' })
      wound(battle, other, amount, events)
    }
  }
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
    for (const other of beside.filter((u) => u.hp > 0)) {
      events.push(fx(other.id, 'volatile', -VOLATILE_DAMAGE))
      wound(battle, other, VOLATILE_DAMAGE, events)
    }
  }
  if (enemy.hp > 0 && !enemy.resists.includes('mark') && (when(true, 'mark', 1) || when(true, 'apex', 1) || when(true, 'tracer', 1) || when(crit, 'exploit', 1))) enemy.marked = true
  const cryo = damage > 0 && unit.ability === 'cryo'
  if (enemy.hp > 0 && !enemy.resists.includes('frost') && (when(first && damage > 0, 'frostbite', 1) || (first && cryo) || when(crit, 'freeze', 1))) {
    events.push(fx(enemy.id, has(unit, 'frostbite') ? 'frostbite' : cryo ? 'cryo' : 'freeze', 0))
    chillUnit(battle, enemy, chillFrom(unit), events)
    if (when(true, 'glacial', 1) + when(true, 'rimeLock', 1) > 0) enemy.rooted = CHILL_TURNS
    for (const other of enemy.marked && has(unit, 'conductor') ? battle.units.filter((u) => u.side === enemy.side && u !== enemy && distance(u, enemy) <= 1) : []) {
      events.push(fx(other.id, 'conductor', 0))
      chillUnit(battle, other, 1, events)
    }
  }
  if (enemy.hp > 0 && crit && enemy.chill > 0 && when(true, 'stasis', 1) + when(true, 'deepFreeze', 1) > 0) {
    enemy.panicked = true
    events.push(fx(enemy.id, has(unit, 'stasis') ? 'stasis' : 'deepFreeze', 0))
  }
  if (shock) for (const other of battle.units.filter((u) => u.side === enemy.side && distance(u, enemy) <= shock.reach)) stun(other, shock.chance, battle, events)
  if (first && enemy.hp > 0 && damage > 0 && when(true, 'hurl', 1)) knockback(battle, unit, enemy, events, 1, HURL_TILES, HURL_DAMAGE, 'hurl')
  else if (first && enemy.hp > 0 && damage > 0 && when(true, 'repulse', 1)) knockback(battle, unit, enemy, events, 1, REPULSE_TILES, SLAM_DAMAGE, 'repulse')
  else if (first && enemy.hp > 0 && damage > 0 && when(true, 'thunder', 1)) knockback(battle, unit, enemy, events)
  else if (first && enemy.hp > 0 && damage > 0 && when(true, 'shove', 1)) knockback(battle, unit, enemy, events, 1, 1, SLAM_DAMAGE, 'shove')
  if (first && enemy.hp > 0 && crit && when(true, 'gale', 1)) knockback(battle, unit, enemy, events, 1, REPULSE_TILES, SLAM_DAMAGE, 'gale')
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
  if (enemy.hp > 0 && unseen && !enemy.boss && when(true, 'daze', 1)) {
    enemy.panicked = true
    events.push(fx(enemy.id, 'daze', 0))
  }
  if (enemy.hp <= 0 && unseen && when(true, 'afterimage', 1)) events.push(cloakOn(unit))
  if (enemy.hp > 0 && enemy.hp <= enemy.stats.hp / 2 && spend(enemy, 'blink')) blink(battle, enemy, events)
  if (enemy.hp > 0 && enemy.hp <= enemy.stats.hp / 2 && !enemy.cloaked && spend(enemy, 'vanish')) events.push(cloakOn(enemy))
  if (enemy.hp <= 0 && unit.armor < unit.stats.armor + MOMENTUM_MAX && when(true, 'momentum', 1)) unit.armor++
  if (enemy.hp <= 0 && has(unit, 'bloodRite')) empower(unit, 1, 'bloodRite', events)
  if (enemy.hp > 0 && when(true, 'suppress', 1)) enemy.suppressed = 2
  if (enemy.hp > 0 && crit && has(unit, 'concussion')) {
    enemy.panicked = true
    events.push(fx(enemy.id, 'concussion', 0))
  }
  if (enemy.hp > 0 && !fireproof(battle, enemy) && ((first && damage > 0 && (has(unit, 'incendiary') || has(unit, 'tinder'))) || when(crit, 'ignite', 1))) {
    kindle(battle, enemy, burnFrom(unit))
    events.push(fx(enemy.id, has(unit, 'incendiary') ? 'incendiary' : has(unit, 'tinder') ? 'tinder' : 'ignite', 0))
  }
  const healing = (first && damage > 0 && has(unit, 'vampiric') ? 1 : 0) + (enemy.hp <= 0 && has(unit, 'feast') ? FEAST_HEAL : 0)
  const healed = Math.min(healing, unit.stats.hp - unit.hp)
  if (healed > 0) {
    unit.hp += healed
    events.push(fx(unit.id, enemy.hp <= 0 && has(unit, 'feast') ? 'feast' : 'vampiric', healed))
  }
  if (has(enemy, 'kindling') && enemy.armor > 0 && !fireproof(battle, unit)) {
    kindle(battle, unit, BURN_STACKS)
    events.push(fx(unit.id, 'kindling', 0))
  }
  if (has(enemy, 'rime')) {
    events.push(fx(unit.id, 'rime', 0))
    chillUnit(battle, unit, 1, events)
  }
  if (has(enemy, 'thorns')) {
    events.push(fx(unit.id, 'thorns', -1))
    wound(battle, unit, 1, events)
  }
  if (first && when(true, 'demolish', 1)) {
    wreck(battle, enemy)
    events.push(fx(enemy.id, 'demolish', 0))
  }
  if (secondary && damage > 0) secondaryHit(battle, unit, enemy, beside, secondary, events)
  afterHit(battle, unit, enemy, damage, beside, events)
  duoHit(battle, unit, enemy, damage, { crit, unseen }, beside, events)
  if (first && enemy.kind === 'brute' && enemy.hp > 0 && unit.hp > 0) charge(battle, enemy, unit, events)
  if (first && damage > 0) hold(unit, enemy, events)
  return blow ? events : [...events, ...again(battle, unit, seen, granted, enemy.hp <= 0)]
}

/**
 * A unit's weapon attack: its shots, each at whichever enemy suits it then, up close if any is in reach, else thrown or
 * rocketed if its weapon can and the attack is not `granted`. What the shots earn comes once, after the last.
 */
export function weaponAttack(battle: Battle, unit: Unit, seen: Set<number>, granted?: Effect, only?: Unit): GameEvent[] {
  const weapon = unit.weapon && WEAPONS[unit.weapon]
  if (!weapon) return shoot(battle, unit, seen, granted, only)
  const near = (only ? [only] : battle.units).some((other) => other.side !== unit.side && shootable(battle, unit, unit, other, seen))
  const form = near || granted ? undefined : weapon.thrown ? 'throw' : weapon.rocket ? 'rocket' : undefined
  const blow: Blow = { kit: form === 'throw' ? weapon.thrown! : form === 'rocket' ? weapon.rocket! : weapon.attack, nth: 0, form }
  const events: GameEvent[] = []
  for (; blow.nth < blow.kit.shots && unit.hp > 0 && (!only || only.hp > 0); blow.nth++) {
    const shot = shoot(battle, unit, seen, granted, only, undefined, blow)
    if (shot.length === 0) break
    events.push(...shot)
  }
  return events.length === 0 ? [] : [...events, ...again(battle, unit, seen, granted, events.some((e) => e.type === 'death' && e.id !== unit.id))]
}

/** What a secondary's hit also does. */
function secondaryHit(battle: Battle, unit: Unit, enemy: Unit, beside: Unit[], { effect }: Secondary, events: GameEvent[]): void {
  if (effect === 'splash') {
    for (const other of beside.filter((u) => u.hp > 0)) {
      events.push({ type: 'hurt', id: other.id, amount: FRAG_SPLASH, cause: 'impact' })
      wound(battle, other, FRAG_SPLASH, events)
      if (other.hp > 0) drive(battle, other, { x: Math.sign(other.x - enemy.x), y: Math.sign(other.y - enemy.y) }, 1, events, 0, 'shove')
    }
  }
  if (enemy.hp <= 0) return
  if (effect === 'knock') knockback(battle, unit, enemy, events, 1, KNOCK_TILES)
  if (effect === 'mark' && !enemy.resists.includes('mark')) enemy.marked = true
  if (effect === 'suppress') enemy.suppressed = 2
  if (effect === 'burn') kindle(battle, enemy, burnFrom(unit))
  if (effect === 'root') enemy.rooted = CHILL_TURNS
}

/**
 * The one more attack, always the weapon's and never thrown, an attack may grant: after a kill, to a soldier with frenzy or a frenzied weapon; else to one with
 * double tap who did not move; else, once per battle, to one with action surge.
 */
export function again(battle: Battle, unit: Unit, seen: Set<number>, granted: Effect | undefined, killed: boolean): GameEvent[] {
  if (granted || unit.hp <= 0) return []
  // Twin and double tap add one shot to a turn's attacks, after the last.
  const last = battle.attacks >= attacksOf(unit)
  const by: Effect | null =
    killed && has(unit, 'frenzy') ? 'frenzy' : killed && has(unit, 'chain') ? 'chain' : last && has(unit, 'twin') ? 'twin' : last && has(unit, 'doubleTap') && !unit.moved ? 'doubleTap' : has(unit, 'surge') && !unit.spent.includes('surge') ? 'surge' : null
  if (!by) return []
  const shots = weaponAttack(battle, unit, seen, by)
  if (by === 'surge' && shots.length > 0) unit.spent.push('surge')
  return shots
}

/** Primary attacks the unit makes each turn. */
export const attacksOf = (unit: Unit) => (isSoldier(unit) ? SOLDIER_ATTACKS * (unit.twice ? 2 : 1) : 1)

/** A shot struck `target`: a fuel tank beside it goes up, hurting and setting burning everyone beside the tank. */
export function ignite(battle: Battle, target: Unit): GameEvent[] {
  const tank = NEIGHBORS.map(([dx, dy]) => ({ x: target.x + dx, y: target.y + dy })).find((t) => onGrid(t.x, t.y) && battle.props[t.y * GRID + t.x] === 'fuel')
  if (!tank) return []
  const caught = battle.units.filter((u) => distance(u, tank) <= 1 && !immune(battle, u, 'blast'))
  const events: GameEvent[] = [{ type: 'rocket', src: { kind: 'object', id: 'fuel' }, id: target.id, x: tank.x, y: tank.y, hits: caught.map((u) => ({ target: u.id, damage: FUEL_DAMAGE })) }]
  wreck(battle, tank, 0)
  for (const unit of caught) {
    wound(battle, unit, FUEL_DAMAGE, events)
    kindle(battle, unit, BURN_STACKS)
  }
  return events
}

/**
 * A blast on the enemy in a power's reach with the most enemies around it, if at least two are caught and no ally is.
 * It wrecks the props and walls it catches. A rocket replaces the shot; a grenade does not.
 */
export function blast(battle: Battle, unit: Unit, seen: Set<number>, damage: number, radius = BLAST_RADIUS): GameEvent[] {
  const inBlast = (centre: Tile) => battle.units.filter((u) => distance(centre, u) <= radius)
  let best: Unit[] = []
  let centre: Unit | undefined
  for (const enemy of battle.units) {
    if (enemy.side === unit.side || !shootable(battle, powering(unit), unit, enemy, seen)) continue
    const caught = inBlast(enemy)
    if (caught.every((u) => u.side !== unit.side) && caught.length > Math.max(has(unit, 'impact') ? 0 : 1, best.length)) {
      best = caught
      centre = enemy
    }
  }
  if (!centre) return []
  const events: GameEvent[] = [{ type: 'rocket', src: srcOf(unit.ability ?? 'rocket'), id: unit.id, x: centre.x, y: centre.y, hits: best.map((u) => ({ target: u.id, damage })) }]
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
    if (target) kindle(battle, target, burnFrom(unit))
  }
  return events
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
  if (!has(unit, 'earthshaker')) unit.spent.push('leap')
  const hurt = LEAP_DAMAGE + (has(unit, 'earthshaker') ? EARTHSHAKER_DAMAGE : 0)
  Object.assign(unit, { x: jump.to.x, y: jump.to.y, moved: true })
  const events: GameEvent[] = [{ type: 'move', src: srcOf('leap'), id: unit.id, path: [jump.to], with: 'leap' }]
  for (const foe of jump.caught) {
    foe.rooted = CHILL_TURNS
    events.push(fx(foe.id, 'leap', -hurt))
    wound(battle, foe, hurt, events)
  }
  return events
}

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

/** The target's weapon guard, if it saves this hit, spending it for the turn. */
function guard(target: Unit, far: boolean, damage: number): Guard | undefined {
  const g = target.weapon && WEAPONS[target.weapon].guard
  const reach = g?.each ? (far ? 'far' : 'near') : 'any'
  if (!g || damage <= 0 || target.guarded?.includes(reach)) return undefined
  ;(target.guarded ??= []).push(reach)
  return g
}

/** Stuns `target` at `chance`, short of a boss or one already stunned, so it loses its next action. */
function stun(target: Unit, chance: number, battle: Battle, events: GameEvent[]): void {
  if (target.hp <= 0 || target.boss || target.panicked || random(battle) >= chance) return
  target.panicked = true
  events.push(fx(target.id, 'stun', 0))
}

/** Its wielder gains its weapon's surge of temp HP, to the surge's cap. */
function surge(unit: Unit, { gain, cap }: NonNullable<Weapon['surge']>, events: GameEvent[]): void {
  const temp = Math.min(cap, (unit.temp ?? 0) + gain)
  if (temp <= (unit.temp ?? 0)) return
  unit.temp = temp
  events.push(fx(unit.id, 'surge', 0))
}
