// Damage landing on a unit, what it sets off, and the tally it adds to.
import { REVIVE_REACH, REVIVE_HEALTH, PSI_BACKLASH, PHOENIX_HEALTH, isSoldier, BURST_DAMAGE, BURN_TURNS, BLAST_RADIUS, type Battle, type Unit, type Tile, type Effect } from './battle'
import { blocked } from './grid'
import { passable } from './grid'
import { wreck } from './grid'
import { unitAt } from './grid'
import { distance } from './grid'
import type { GameEvent } from './combat-event'
import { OVERKILL, type FeatId, type Tally } from './feats'
import { has, fireproof, chillFrom, foeHas, nearest, immune, onTile } from './fighters'

/** A soldier's tally for this battle, begun empty. */
export function tallyOf(battle: Battle, soldier: number): Tally {
  return (battle.tally[soldier] ??= { dealt: 0, kills: 0, taken: 0, shots: 0, hits: 0, feats: [] })
}

export const feat = (tally: Tally, id: FeatId) => tally.feats.includes(id) || tally.feats.push(id)

/**
 * Deals `damage` to a unit: its armor takes it first, then its health. At zero health the unit is removed and its
 * death reported. A burster that dies explodes, and a psion that dies hurts the other aliens of its pod.
 */
export function wound(battle: Battle, target: Unit, dealt: number, events: GameEvent[], pierce = false, crit = false): void {
  if (target.hp <= 0) return
  const damage = target.kind === 'wraith' && !crit ? Math.min(dealt, 1) : dealt
  const full = target.hp === target.stats.hp
  // A juggernaut's plate stops a hit whole, and is lost to it.
  const plated = target.kind === 'juggernaut' && !pierce && target.armor > 0
  const absorbed = plated ? damage : pierce ? 0 : Math.min(target.armor, damage)
  // Health lost: damage past what the target had left is counted for nobody.
  const lost = Math.min(target.hp, damage - absorbed)
  target.armor -= plated ? 1 : absorbed
  target.hp -= damage - absorbed
  if (target.soldier !== null) tallyOf(battle, target.soldier).taken += lost
  // A mech's work is its engineer's.
  const by = battle.units.find((u) => u.id === battle.actor)
  const credited = by && by.side !== target.side ? (by.soldier ?? by.summoner) : null
  const tally = credited !== null && credited !== undefined ? tallyOf(battle, credited) : null
  if (tally) {
    tally.dealt += lost
    if (damage >= OVERKILL) feat(tally, 'overkill')
  }
  if (target.hp > 0) return
  // An alien that dies burning spreads the fire, if the squad carries wildfire or its killer backdraft; one that dies
  // chilled, the chill, if its killer has avalanche.
  const wildfire = battle.units.some((u) => u.side !== target.side && has(u, 'wildfire'))
  const killer = by && by.side !== target.side ? by : null
  const beside = battle.units.filter((u) => u.side === target.side && u !== target && distance(u, target) <= 1)
  if (target.burning > 0 && (wildfire || (killer && has(killer, 'backdraft')))) {
    for (const other of beside.filter((u) => !fireproof(battle, u))) {
      other.burning = BURN_TURNS
      events.push({ type: 'effect', id: other.id, effect: wildfire ? 'wildfire' : 'backdraft', amount: 0 })
    }
  }
  if (target.chilled > 0 && killer && has(killer, 'avalanche')) {
    for (const other of beside.filter((u) => !u.resists.includes('frost'))) {
      other.chilled = chillFrom(killer)
      events.push({ type: 'effect', id: other.id, effect: 'avalanche', amount: 0 })
    }
  }
  // A soldier who would fall may be got back up: by a squadmate's revive, or once by the squad's phoenix protocol.
  const reviver = battle.units.find((u) => u.side === target.side && u !== target && u.hp > 0 && distance(u, target) <= REVIVE_REACH && has(u, 'revive') && !u.spent.includes('revive'))
  const rises = reviver ? 'revive' : has(target, 'phoenix') && !battle.used.includes('phoenix') ? 'phoenix' : null
  if (rises) {
    if (reviver) reviver.spent.push('revive')
    else battle.used.push('phoenix')
    target.hp = rises === 'revive' ? REVIVE_HEALTH : PHOENIX_HEALTH
    events.push({ type: 'effect', id: target.id, effect: rises, amount: target.hp })
    return
  }
  battle.units = battle.units.filter((u) => u !== target)
  // A soldier falls where it stands, dropping whoever it carried.
  if (isSoldier(target)) {
    for (const body of battle.downed.filter((d) => d.carrier === target.id)) Object.assign(body, { x: target.x, y: target.y, carrier: null })
    battle.downed.push({ soldier: target.soldier!, x: target.x, y: target.y, carrier: null })
  }
  events.push({ type: 'death', id: target.id })
  if (target.civilian && killer?.kind === 'harvester') battle.husks.push({ x: target.x, y: target.y, pod: killer.pod! })
  if (has(target, 'detonate')) {
    const caught = battle.units.filter((u) => u.side !== target.side && distance(u, target) <= 1)
    events.push({ type: 'rocket', id: target.id, x: target.x, y: target.y, hits: caught.map((u) => ({ target: u.id, damage: DETONATE_DAMAGE })) })
    for (const u of caught) wound(battle, u, DETONATE_DAMAGE, events)
  }
  if (tally) {
    tally.kills++
    if (full) feat(tally, 'oneShot')
    if (target.boss || target.target) feat(tally, 'giantSlayer')
    if (tally.kills === 3) feat(tally, 'hatTrick')
  }
  // A hexed death passes the mark to the nearest unmarked alien.
  const heir = target.marked && foeHas(battle, target, 'hex') ? nearest(battle.units.filter((u) => u.side === target.side && !u.marked && !u.resists.includes('mark')), target) : undefined
  if (heir) {
    heir.marked = true
    events.push({ type: 'effect', id: heir.id, effect: 'hex', amount: 0 })
  }
  if (target.kind === 'burster') {
    const caught = battle.units.filter((u) => distance(target, u) <= BLAST_RADIUS && !immune(battle, u, 'blast'))
    events.push({ type: 'rocket', id: target.id, x: target.x, y: target.y, hits: caught.map((u) => ({ target: u.id, damage: BURST_DAMAGE })) })
    wreck(battle, target)
    for (const unit of caught) wound(battle, unit, BURST_DAMAGE, events)
  }
  if (target.kind === 'psion') {
    for (const unit of battle.units.filter((u) => u.pod === target.pod)) {
      events.push({ type: 'hurt', id: unit.id, amount: PSI_BACKLASH, cause: 'backlash' })
      wound(battle, unit, PSI_BACKLASH, events)
    }
  }
}

/** Damage a self-destructing mech does to each alien beside it. */
export const DETONATE_DAMAGE = 4

/** What befalls a unit that has walked `path`: caltrops it stepped on hurt an alien, and a booming charge goes off. */
export function moved(battle: Battle, unit: Unit, path: Tile[], events: GameEvent[]): void {
  const spikes = unit.side === 'alien' ? path.filter((t) => onTile(battle.caltrops, t)).length : 0
  if (spikes > 0) {
    events.push({ type: 'effect', id: unit.id, effect: 'caltrops', amount: -spikes })
    wound(battle, unit, spikes, events)
  }
  if (unit.booming > 0 && unit.hp > 0) {
    unit.booming = 0
    events.push({ type: 'effect', id: unit.id, effect: 'booming', amount: -BOOM_DAMAGE })
    wound(battle, unit, BOOM_DAMAGE, events)
  }
}

/** Damage a booming charge does to a target that moves. */
export const BOOM_DAMAGE = 3

/**
 * A knockback: the target is driven `tiles` straight back from `unit`; if something stops it, it slams into that for
 * `slam` damage, and an alien it slams into takes as much. With `way` -1, a tethered hit pulls it a tile toward the
 * shooter, as far as the way is free.
 */
export function knockback(battle: Battle, unit: Unit, target: Unit, events: GameEvent[], way = 1, tiles = 1, slam = SLAM_DAMAGE, effect: Effect = way > 0 ? 'thunder' : 'tether'): void {
  const step = { x: way * Math.sign(target.x - unit.x), y: way * Math.sign(target.y - unit.y) }
  const path: Tile[] = []
  let stopped = false
  for (let i = 0; i < tiles && !stopped; i++) {
    const from = path.at(-1) ?? target
    const to = { x: from.x + step.x, y: from.y + step.y }
    stopped = blocked(battle, to.x, to.y) || !passable(battle, from, to)
    if (!stopped) path.push(to)
  }
  const end = path.at(-1)
  if (end) {
    target.x = end.x
    target.y = end.y
    events.push({ type: 'move', id: target.id, path, with: effect })
  }
  if (!stopped || way < 0) return
  const into = unitAt(battle, target.x + step.x, target.y + step.y)
  events.push({ type: 'effect', id: target.id, effect, amount: -slam })
  wound(battle, target, slam, events)
  if (into && into.side === target.side) {
    events.push({ type: 'effect', id: into.id, effect, amount: -slam })
    wound(battle, into, slam, events)
  }
}

export const SLAM_DAMAGE = 1
