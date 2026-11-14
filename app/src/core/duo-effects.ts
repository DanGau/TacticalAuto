// What each duo does in battle, at the moments combat hands it.
import { fx, srcOf } from './sources'
import { isSoldier, type Battle, type Unit } from './battle'
import type { GameEvent } from './combat-event'
import { CROSSFIRE_DAMAGE, PAYLOAD_DAMAGE, SHATTER_HIT, SHATTER_SPLASH, SPOTTER_REACH, type DuoId } from './duos'
import { fireproof } from './fighters'
import { burnFrom, chillUnit, kindle } from './stacks'
import { distance } from './grid'
import { wound } from './wound'

/** The duos in play, by soldier ids in pair order; and, for Crossfire and Pincer, who hit which alien this round and when Pincer last struck. */
export interface DuoState {
  pairs: { id: DuoId; heroes: [number, number] }[]
  round: number
  /** Soldier ids that hit each alien this round, by alien id. */
  struck: Record<number, number[]>
  /** The alien each soldier last hit, by soldier id. */
  last: Record<number, number>
  /** The round Pincer last struck. */
  pincer: number
}

export const noDuos = (): DuoState => ({ pairs: [], round: -1, struck: {}, last: {}, pincer: -1 })

/** The heroes of duo `id`, in pair order, both standing on the field; null otherwise. */
function heroes(battle: Battle, id: DuoId): [Unit, Unit] | null {
  const pair = battle.duos.pairs.find((p) => p.id === id)
  if (!pair) return null
  const [a, b] = pair.heroes.map((soldier) => battle.units.find((u) => isSoldier(u) && u.soldier === soldier && u.hp > 0))
  return a && b ? [a, b] : null
}

/** The duo's moment: both heroes linked, on `target` if any. */
const moment = (duo: DuoId, [a, b]: [Unit, Unit], target?: Unit): GameEvent => ({ type: 'duo', src: srcOf(duo), duo, ids: [a.id, b.id], ...(target ? { target: target.id } : {}) })

/** Whether `unit` is one of duo `id`'s heroes, at `role` if given; then the pair. */
function as(battle: Battle, id: DuoId, unit: Unit, role?: 0 | 1): [Unit, Unit] | null {
  const pair = heroes(battle, id)
  return pair && (role === undefined ? pair.includes(unit) : pair[role] === unit) ? pair : null
}

/** Whether a duo makes `unit`'s hit on `enemy` a sure crit: Spotter. */
export function duoCrit(battle: Battle, unit: Unit, enemy: Unit, events: GameEvent[]): boolean {
  const pair = as(battle, 'spotting', unit, 0)
  if (!pair || distance(pair[1], enemy) > SPOTTER_REACH) return false
  events.push(moment('spotting', pair, enemy))
  return true
}

/** Damage duos add to `unit`'s hit on `enemy`: Crossfire. */
export function duoDamage(battle: Battle, unit: Unit, enemy: Unit, events: GameEvent[]): number {
  const pair = as(battle, 'crossfire', unit)
  const other = pair?.find((u) => u !== unit)
  if (!pair || !other || !struck(battle, enemy).includes(other.soldier!)) return 0
  events.push(moment('crossfire', pair, enemy))
  return CROSSFIRE_DAMAGE
}

/** The soldiers that hit `enemy` this round, cleared as a round turns. */
function struck(battle: Battle, enemy: Unit): number[] {
  const state = battle.duos
  if (state.round !== battle.round) Object.assign(state, { round: battle.round, struck: {} })
  return (state.struck[enemy.id] ??= [])
}

/** What duos set off once `unit`'s hit on `enemy` for `damage` has landed; `beside` stood by the target. */
export function duoHit(battle: Battle, unit: Unit, enemy: Unit, damage: number, { crit, unseen }: { crit: boolean; unseen: boolean }, beside: Unit[], events: GameEvent[]): void {
  if (battle.duos.pairs.length === 0) return
  if (isSoldier(unit) && damage > 0) {
    struck(battle, enemy).push(unit.soldier!)
    battle.duos.last[unit.soldier!] = enemy.id
  }
  const thermal = as(battle, 'thermalShock', unit)
  if (thermal && enemy.hp > 0 && enemy.burn > 0 && enemy.chill > 0) {
    enemy.burn = 0
    enemy.chill = 0
    events.push(moment('thermalShock', thermal, enemy), fx(enemy.id, 'thermalShock', -SHATTER_HIT))
    wound(battle, enemy, SHATTER_HIT, events)
    for (const other of beside.filter((u) => u.hp > 0)) {
      events.push(fx(other.id, 'thermalShock', -SHATTER_SPLASH))
      wound(battle, other, SHATTER_SPLASH, events)
    }
  }
  const anvil = as(battle, 'anvil', unit, 0)
  if (anvil && enemy.hp > 0 && damage > 0 && !enemy.boss && !enemy.panicked && distance(anvil[1], enemy) <= 1) {
    enemy.panicked = true
    events.push(moment('anvil', anvil, enemy), fx(enemy.id, 'stun', 0))
  }
  const frozen = as(battle, 'flashFreeze', unit, 0)
  if (frozen && crit && enemy.hp > 0 && enemy.chill > 0 && !enemy.panicked) {
    enemy.panicked = true
    events.push(moment('flashFreeze', frozen, enemy), fx(enemy.id, 'flashFreeze', 0))
  }
  const glow = as(battle, 'afterglow', unit, 1)
  if (glow && unseen && enemy.hp <= 0 && glow[0].ability === 'medic') {
    glow[0].charges++
    events.push(moment('afterglow', glow, glow[0]))
  }
  if (unit.side === 'alien' && enemy.summoner !== null) summonHit(battle, unit, enemy, events)
}

/** An alien's hit on a summoned machine: Target Painter marks it; Napalm Payload bursts the machine destroyed. */
function summonHit(battle: Battle, alien: Unit, machine: Unit, events: GameEvent[]): void {
  const painter = heroes(battle, 'painter')
  if (painter && painter[0].soldier === machine.summoner && alien.hp > 0 && alien.mark === 0 && !alien.resists.includes('mark')) {
    alien.mark = 1
    events.push(moment('painter', painter, alien), fx(alien.id, 'painter', 0))
  }
  const payload = heroes(battle, 'payload')
  if (!payload || payload[0].soldier !== machine.summoner || machine.hp > 0) return
  events.push(moment('payload', payload, machine))
  const actor = battle.actor
  battle.actor = payload[0].id
  for (const other of battle.units.filter((u) => u.side === 'alien' && u.hp > 0 && distance(u, machine) <= 1)) {
    events.push(fx(other.id, 'payload', -PAYLOAD_DAMAGE))
    wound(battle, other, PAYLOAD_DAMAGE, events)
    kindle(battle, other, burnFrom(payload[1]), events)
  }
  battle.actor = actor
}

/** Who a medic's heal may reach besides the wounded in reach: Lifeline's Vanguard, hurt at all, anywhere. */
export function lifelineTo(battle: Battle, medic: Unit): Unit | undefined {
  const pair = as(battle, 'lifeline', medic, 0)
  return pair && pair[1].hp < pair[1].stats.hp ? pair[1] : undefined
}

/** What duos add to a medic's heal of `target`, which healed `healed` of `amount`: Lifeline's armor, Cold Comfort's chill. */
export function duoHeal(battle: Battle, medic: Unit, target: Unit, amount: number, healed: number, events: GameEvent[]): void {
  const life = as(battle, 'lifeline', medic, 0)
  if (life && target === life[1] && amount > healed) {
    target.armor += amount - healed
    events.push(moment('lifeline', life, target), fx(target.id, 'lifeline', 0))
  }
  const cold = as(battle, 'coldComfort', medic, 0)
  const near = battle.units.filter((u) => u.side === 'alien' && u.hp > 0 && distance(u, target) <= 1 && !u.resists.includes('chill'))
  if (!cold || near.length === 0) return
  events.push(moment('coldComfort', cold, target))
  for (const alien of near) {
    events.push(fx(alien.id, 'coldComfort', 0))
    chillUnit(battle, alien, 1, events)
  }
}

/** Firefall: a Meteor Strike's `fired` events set each alien they hit burning. */
export function firefall(battle: Battle, unit: Unit, fired: GameEvent[]): GameEvent[] {
  const pair = as(battle, 'firefall', unit, 0)
  const hit = fired.flatMap((e) => (e.type === 'rocket' ? e.hits.map((h) => battle.units.find((u) => u.id === h.target)) : []))
  const burnt = hit.filter((u): u is Unit => !!u && u.side === 'alien' && u.hp > 0 && !fireproof(battle, u))
  if (!pair || burnt.length === 0) return []
  const events: GameEvent[] = [moment('firefall', pair), ...burnt.map((u): GameEvent => fx(u.id, 'firefall', 0))]
  for (const alien of burnt) kindle(battle, alien, burnFrom(pair[1]), events)
  return events
}

/** Pincer: once a round, after the Vanguard's attacks, the alien it last hit, for the Phantom to strike; then the pair. */
export function pincerOn(battle: Battle, unit: Unit): { pair: [Unit, Unit]; target: Unit } | null {
  const pair = as(battle, 'pincer', unit, 0)
  if (!pair || battle.duos.pincer === battle.round) return null
  const target = battle.units.find((u) => u.id === battle.duos.last[unit.soldier!] && u.hp > 0)
  return target ? { pair, target } : null
}

/** Marks Pincer used this round, and its moment. */
export function pinced(battle: Battle, pair: [Unit, Unit], target: Unit): GameEvent {
  battle.duos.pincer = battle.round
  return moment('pincer', pair, target)
}
