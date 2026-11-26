// Damage landing on a unit, what it sets off, and the tally it adds to.
import { alienSrc, fx } from './sources'
import { GUARD_MAX, SHELL_MAX, PSI_BACKLASH, PSI_BACKLASH_REACH, PHOENIX_HEALTH, isSoldier, BURST_DAMAGE, BLAST_RADIUS, type Battle, type Effect, type Unit } from './battle'
import { wreck } from './grid'
import { distance } from './grid'
import type { GameEvent, ShotEvent } from './combat-event'
import { emptyTally, type Tally } from './battle'
import { engage, has, fireproof } from './fighters'
import { armorCap, died, kindle } from './stacks'
import { TUNING } from './tuning'

/** A soldier's tally for this battle, begun empty. */
export function tallyOf(battle: Battle, soldier: number): Tally {
  return (battle.tally[soldier] ??= emptyTally())
}

/** `shot` lands on `target` for its damage, and keeps what `target` has left, so the view shows each hit as it lands. */
export function land(battle: Battle, shot: ShotEvent, target: Unit, events: GameEvent[], pierce = false, crit = false): void {
  wound(battle, target, shot.damage, events, pierce, crit)
  shot.after = { hp: target.hp, armor: target.armor, temp: target.temp ?? 0 }
}

/**
 * Deals `damage` to a unit: its temp HP takes it first, then its armor, then its health. At zero health the unit is removed and its
 * death reported. A burster that dies explodes, and a psion that dies hurts the aliens near it. An alien hurt
 * engages.
 */
export function wound(battle: Battle, target: Unit, dealt: number, events: GameEvent[], pierce = false, crit = false): void {
  if (target.hp <= 0) return
  if (!target.engaged) engage(battle, target)
  const struck = target.kind === 'wraith' && !crit ? Math.min(dealt, 1) : dealt
  const blocked = Math.min(target.block ?? 0, struck)
  if (blocked > 0) target.block! -= blocked
  const hit = struck - blocked
  const soaked = Math.min(target.temp ?? 0, hit)
  if (soaked > 0) target.temp! -= soaked
  const damage = hit - soaked
    // A juggernaut's plate stops a hit whole, and is lost to it.
  const plated = target.kind === 'juggernaut' && !pierce && target.armor > 0 && damage > 0
  const absorbed = plated ? damage : pierce ? 0 : Math.min(target.armor, damage)
  // Health lost: damage past what the target had left is counted for nobody.
  const lost = Math.min(target.hp, damage - absorbed)
  target.armor -= plated ? 1 : absorbed
  target.hp -= damage - absorbed
  if (target.hp > 0 && hit > 0 && has(target, 'shell') && target.shelled !== battle.round && target.armor < armorCap(target, target.stats.armor + SHELL_MAX)) {
    target.shelled = battle.round
    target.armor++
    events.push(fx(target.id, 'shell', 0))
  }
  if (target.soldier !== null) {
    tallyOf(battle, target.soldier).taken += lost
    tallyOf(battle, target.soldier).blocked += (plated ? 0 : absorbed) + soaked
  }
  const by = battle.units.find((u) => u.id === battle.actor)
  const credited = by && by.side !== target.side ? by.soldier : null
  const tally = credited !== null && credited !== undefined ? tallyOf(battle, credited) : null
  if (tally) tally.dealt += lost
  if (target.hp > 0) return
  // An alien that dies burning spreads the fire, if the hero carries wildfire.
  const killer = by && by.side !== target.side ? by : null
  const beside = battle.units.filter((u) => u.side === target.side && u !== target && distance(u, target) <= 1)
  if (target.burn > 0 && battle.units.some((u) => u.side !== target.side && has(u, 'wildfire'))) {
    for (const other of beside.filter((u) => !fireproof(battle, u))) {
      kindle(battle, other, target.burn, events)
      events.push(fx(other.id, 'wildfire', 0))
    }
  }
  // A hero who would fall gets back up once by the phoenix protocol.
  if (has(target, 'phoenix') && !battle.used.includes('phoenix')) {
    battle.used.push('phoenix')
    target.hp = PHOENIX_HEALTH
    events.push(fx(target.id, 'phoenix', target.hp))
    return
  }
  battle.units = battle.units.filter((u) => u !== target)
  // A soldier falls where it stands.
  if (isSoldier(target)) battle.downed.push({ soldier: target.soldier!, x: target.x, y: target.y })
  events.push({ type: 'death', id: target.id })
  died(battle, target, events)
  if (target.civilian && killer?.kind === 'harvester') battle.husks.push({ x: target.x, y: target.y })
  if (tally) tally.kills++
  if (target.kind === 'burster') {
    const caught = battle.units.filter((u) => distance(target, u) <= BLAST_RADIUS)
    events.push({ type: 'rocket', src: alienSrc(target), id: target.id, x: target.x, y: target.y, hits: caught.map((u) => ({ target: u.id, damage: BURST_DAMAGE })) })
    wreck(battle, target)
    for (const unit of caught) wound(battle, unit, BURST_DAMAGE, events)
  }
  if (target.kind === 'psion') {
    for (const unit of battle.units.filter((u) => u.side === 'alien' && distance(u, target) <= PSI_BACKLASH_REACH)) {
      events.push({ type: 'hurt', id: unit.id, amount: PSI_BACKLASH, cause: 'backlash' })
      wound(battle, unit, PSI_BACKLASH, events)
    }
  }
}

/** What befalls a unit that has walked: a booming charge goes off. */
export function moved(battle: Battle, unit: Unit, events: GameEvent[]): void {
  if (unit.booming > 0 && unit.hp > 0) {
    unit.booming = 0
    events.push(fx(unit.id, 'booming', -BOOM_DAMAGE))
    wound(battle, unit, BOOM_DAMAGE, events)
  }
}

/** Damage a booming charge does to a target that moves. */
export const BOOM_DAMAGE = 3

/** Damage a unit knocked into something takes, and so does an alien it slams into. */
export const SLAM_DAMAGE = 1

/** Heals `unit` up to `amount`, to its full health and, for a `capped` source, to what TUNING.healCap, or the cap given, leaves it this battle; says the gain. */
export function mend(unit: Unit, amount: number, effect: Effect, events: GameEvent[], capped: boolean | number = true): void {
  const cap = capped === true ? TUNING.healCap : capped
  const left = cap !== false ? cap - (unit.healed?.[effect] ?? 0) : amount
  const gain = Math.min(amount, left, unit.stats.hp - unit.hp)
  if (unit.hp > 0 && amount > gain && has(unit, 'overflow') && unit.armor < armorCap(unit, unit.stats.armor + GUARD_MAX)) {
    unit.armor = Math.min(armorCap(unit, unit.stats.armor + GUARD_MAX), unit.armor + amount - Math.max(0, gain))
    events.push(fx(unit.id, 'overflow', 0))
  }
  if (gain <= 0 || unit.hp <= 0) return
  unit.hp += gain
  if (cap !== false) (unit.healed ??= {})[effect] = (unit.healed[effect] ?? 0) + gain
  events.push(fx(unit.id, effect, gain))
}
