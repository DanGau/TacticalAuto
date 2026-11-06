// Tier 3 powers: what each keystone adds to a hit, and the reactions and numbers they share.
import { fx, srcOf } from './sources'
import { type Unit, type Battle, MIGHT_MAX } from './battle'
import { chillUnit } from './stacks'
import type { GameEvent } from './combat-event'
import { has, shootable, nearest } from './fighters'
import { distance } from './grid'
import { wound } from './wound'

export const BLOODBATH_HEAL = 3
export const AFTERSHOCK_DAMAGE = 2
export const SHARD_DAMAGE = 2
export const IMPACT_DAMAGE = 4
export const EARTHSHAKER_DAMAGE = 2
export const WAR_MACHINE = { hp: 10, damage: 3, range: 2 }
/** Drones Endless Swarm keeps at once, and builds in a battle: without an end, aliens shooting its drones would never come on. */
export const SWARM_LIMIT = 5
export const SWARM_BUILDS = 10
export const TESLA = { reach: 5, bolts: 3, damage: 2 }
export const FONT_REACH = 4
export const SACRED_REACH = 3
export const CONFLAGRATION_DAMAGE = 2
export const HELLFIRE_REACH = 2
export const INTANGIBLE_CHANCE = 0.5
export const FAN_TARGETS = 2

/** What a keystone sets off once a hit has landed: `unit` struck `enemy`, with `beside` those next to it before the hit. */
export function afterHit(battle: Battle, unit: Unit, enemy: Unit, damage: number, beside: Unit[], events: GameEvent[]): void {
  if (enemy.hp <= 0 && has(unit, 'bloodbath')) {
    unit.might = Math.min(MIGHT_MAX, unit.might + 1)
    const healed = Math.min(BLOODBATH_HEAL, unit.stats.hp - unit.hp)
    unit.hp += healed
    events.push(fx(unit.id, 'bloodbath', healed))
  }
  if (damage > 0 && (has(unit, 'aftershock') || has(unit, 'shardstorm'))) {
    const effect = has(unit, 'aftershock') ? 'aftershock' : 'shardstorm'
    for (const other of beside.filter((u) => u.hp > 0)) {
      if (effect === 'shardstorm') chillUnit(battle, other, 1, events)
      const amount = effect === 'aftershock' ? AFTERSHOCK_DAMAGE : SHARD_DAMAGE
      events.push(fx(other.id, effect, -amount))
      wound(battle, other, amount, events)
    }
  }
  if (enemy.hp > 0 && damage > 0 && !enemy.boss && enemy.chill > 0 && has(unit, 'frozenHeart')) {
    enemy.panicked = true
    events.push(fx(enemy.id, 'frozenHeart', 0))
  }
  if (enemy.hp > 0 && has(enemy, 'riposte') && unit.hp > 0) {
    // The blow back is the hero's own, and so is the credit.
    const actor = battle.actor
    battle.actor = enemy.id
    events.push(fx(unit.id, 'riposte', -enemy.stats.damage))
    wound(battle, unit, enemy.stats.damage, events)
    battle.actor = actor
  }
}

/** Tesla Coil: after a hero acts, bolts strike the nearest aliens in reach. */
export function tesla(battle: Battle, unit: Unit, seen: Set<number>): GameEvent[] {
  if (!has(unit, 'tesla')) return []
  const events: GameEvent[] = []
  const reach = { ...unit, stats: { ...unit.stats, range: TESLA.reach } }
  const inReach = battle.units.filter((u) => u.side !== unit.side && shootable(battle, reach, unit, u, seen))
  for (let i = 0; i < TESLA.bolts; i++) {
    const target = nearest(inReach.filter((u) => u.hp > 0 && !events.some((e) => e.type === 'shot' && e.target === u.id)), unit)
    if (!target) break
    events.push({ type: 'shot', src: srcOf('tesla'), id: unit.id, target: target.id, crit: false, damage: TESLA.damage, with: ['tesla'] })
    wound(battle, target, TESLA.damage, events)
  }
  return events
}

/** Whether a hero within SACRED_REACH of `unit` holds Sacred Ground over it. */
export const hallowed = (battle: Battle, unit: Unit) => battle.units.some((u) => u.side === unit.side && has(u, 'sacredGround') && distance(u, unit) <= SACRED_REACH)
