// A battle's beat: whose turn it is, and the next unit's action.
import { RESCUE_QUORUM } from './goals'
import {
  BIG_BLAST_RADIUS,
  BLAST_RADIUS,
  isSoldier,
  MAX_BEATS,
  ROCKET_DAMAGE,
  type Battle,
} from './battle'
import type { GameEvent } from './combat-event'
import { has, spotted, vipOf } from './fighters'
import { SECONDARIES } from './secondaries'
import { attacksOf, blast, leap, napalm, shoot, weaponAttack } from './attack'
import { leverage } from './objects'
import { alienAction, cloak, deploy, drone, feed, flashbang, forceField, heal, pulse, secondWind, skirmish, slam, strew } from './abilities'
import { armed, dash, moveSide, stride } from './sides'
import { IMPACT_DAMAGE, tesla } from './keystones'
import { bladeDance, command, pincer } from './follow-ups'
import { ultimate } from './ultimates'
import { tallyOf } from './wound'
import { firefall } from './duo-effects'
/**
 * The next attack of the side on turn: a soldier makes SOLDIER_ATTACKS a turn, its weapon's then its secondary, an alien one. A panicked soldier loses its turn; a phantom may cloak in place of its attacks.
 * An alien does what its kind does in place of a shot, if anything. Otherwise, first comes what does not cost the
 * shot: a medic's heal. Then a rocket, when its moment has come, or else a shot.
 * Empty when no unit is left.
 */
function actNext(battle: Battle): GameEvent[] {
  const seen = spotted(battle)
  for (const unit of battle.units) {
    if (unit.side !== battle.turn || unit.id < battle.shooter || unit.civilian || !armed(unit)) continue
    if (unit.id === battle.shooter) {
      if (battle.attacks >= attacksOf(unit)) continue
      // The secondary: a walk to a shot if it has none, the shot, then what follows the last, ending with a step back.
      battle.attacks++
      battle.actor = unit.id
      const secondary = unit.secondary && SECONDARIES[unit.secondary]
      const events = [...stride(battle, unit, seen, true, secondary)]
      const bonus = shoot(battle, unit, seen, undefined, undefined, secondary)
      events.push(...bonus, ...(bonus.length > 0 && secondary ? bladeDance(battle, unit, seen, secondary, bonus) : []))
      if (battle.attacks >= attacksOf(unit) && unit.hp > 0) events.push(...drone(battle, unit), ...tesla(battle, unit, seen), ...command(battle, unit, seen), ...pincer(battle, unit, seen), ...skirmish(battle, unit), ...stride(battle, unit, seen, false))
      battle.actor = null
      if (events.length === 0) continue
      return events
    }
    if (unit.panicked) {
      unit.panicked = false
      battle.shooter = unit.id
      battle.attacks = attacksOf(unit)
      return [{ type: 'frozen', id: unit.id }]
    }
    const cloaked = cloak(battle, unit, seen)
    if (cloaked.length > 0) {
      battle.shooter = unit.id
      battle.attacks = attacksOf(unit)
      return cloaked
    }
    const special = alienAction(battle, unit)
    if (special) {
      if (special.length === 0) continue
      battle.shooter = unit.id
      battle.attacks = 1
      return special
    }
    const before = battle.attacks
    battle.attacks = 1
    battle.actor = unit.id
    const healed = unit.charges > 0 && unit.ability === 'medic' ? heal(battle, unit) : []
    const fired =
      unit.charges <= 0 ? [] : unit.ability === 'rocket' ? blast(battle, unit, seen, ROCKET_DAMAGE + (has(unit, 'impact') ? IMPACT_DAMAGE : 0), has(unit, 'bigBlast') ? BIG_BLAST_RADIUS : BLAST_RADIUS) : unit.ability === 'napalm' ? napalm(battle, unit, seen) : []
    if (unit.ability === 'rocket') fired.push(...firefall(battle, unit, fired))
    if (healed.length + fired.length > 0 && !(has(unit, 'firestorm') && fired.some((e) => e.type === 'death' && e.id !== unit.id))) unit.charges--
    const powers = [...ultimate(battle, unit, seen), ...pulse(battle, unit, 'warcry'), ...pulse(battle, unit, 'emp'), ...flashbang(battle, unit, seen), ...forceField(battle, unit), ...leap(battle, unit, seen)]
    const slammed = fired.length > 0 ? [] : slam(battle, unit)
    const levered = fired.length + slammed.length > 0 ? [] : leverage(battle, unit)
    const primary = fired.length > 0 ? fired : slammed.length > 0 ? slammed : levered.length > 0 ? levered : [...dash(battle, unit, seen), ...weaponAttack(battle, unit, seen)]
    // A hero its weapon cannot bring to bear still has its secondary, and that is its turn's attacking.
    const fallback = primary.length === 0 && unit.secondary && unit.stats.range > 0 && unit.stats.damage > 0 ? shoot(battle, unit, seen, undefined, undefined, SECONDARIES[unit.secondary]) : []
    if (fallback.length > 0) battle.attacks = attacksOf(unit)
    const struck = [...primary, ...fallback]
    const acted = [...secondWind(unit), ...strew(battle, unit), ...deploy(battle, unit, seen), ...powers, ...healed, ...struck]
    // What follows an action: a drone's shot, then a skirmisher's step back.
    const events = acted.length > 0 && unit.hp > 0 && attacksOf(unit) === 1 ? [...acted, ...drone(battle, unit), ...tesla(battle, unit, seen), ...skirmish(battle, unit)] : acted
    battle.actor = null
    if (unit.side === 'human') events.push(...feed(battle, unit, events))
    if (events.length === 0) {
      battle.attacks = before
      continue
    }
    battle.shooter = unit.id
    // An alien unseen gives itself away when it opens fire.
    if (!unit.revealed) {
      unit.revealed = true
      events.unshift({ type: 'reveal', units: [{ id: unit.id, x: unit.x, y: unit.y }] })
    }
    return events
  }
  return []
}

/** The next move stage or action, passing the turn when a side has nothing left to do. */
function act(battle: Battle): GameEvent[] {
  // After each side has passed once, nobody can act this beat.
  for (let passes = 0; passes < 2; passes++) {
    if (battle.stage === 'move') {
      const moves = moveSide(battle)
      battle.stage = 'shoot'
      battle.shooter = 0
      if (moves.length > 0) return moves
    }
    const action = actNext(battle)
    if (action.length > 0) return action
    if (battle.turn === 'alien') for (const u of battle.units) u.surprised = Math.max(0, u.surprised - 1)
    battle.turn = battle.turn === 'human' ? 'alien' : 'human'
    battle.stage = 'move'
    for (const u of battle.units) u.guarded = []
  }
  return []
}

/** Credits each heal to the hero who gave it, or whose mech did; health a hero's own effect gives back, to that hero. */
function tallyHealing(battle: Battle, events: GameEvent[]): void {
  for (const e of events) {
    const amount = e.type === 'heal' || (e.type === 'effect' && e.amount > 0) ? e.amount : 0
    if (amount === 0 || !('id' in e)) continue
    const giver = battle.units.find((u) => u.id === e.id && u.side === 'human')
    const hero = giver?.soldier ?? giver?.summoner
    if (hero !== null && hero !== undefined) tallyOf(battle, hero).healed += amount
  }
}

/** Advances a battle one beat: a side's simultaneous move, or one unit's action. Does nothing outside the battle phase. */
export function stepBattle(battle: Battle): GameEvent[] {
  if (battle.phase !== 'battle') return []
  battle.beat++
  const events = act(battle)
  tallyHealing(battle, events)
  const humans = battle.units.some(isSoldier)
  // Every sentry down before the clock runs out: no reinforcements come.
  if (battle.deadline !== null && battle.round < battle.deadline && !battle.units.some((u) => u.side === 'alien')) battle.waves = []
  // Aliens left to beat: none once the commander falls, for the rest flee.
  const fled = battle.goal === 'assassinate' && !battle.units.some((u) => u.target)
  // A VIP rescue is done once the VIP is out, and not before.
  const aliens = !fled && battle.vip !== 'out' && (battle.units.some((u) => u.side === 'alien') || battle.waves.length > 0 || battle.vip !== null)
  // A rescue is over once no civilian is left to save: won if any were. A raid is won once it has every cache.
  const emptied = battle.goal === 'rescue' && !battle.units.some((u) => u.civilian)
  const loaded = battle.goal === 'raid' && battle.caches.length === 0
  // A VIP rescue is lost with the VIP.
  const lost = battle.vip !== null && battle.vip !== 'out' && !vipOf(battle)
  if (!humans || !aliens || emptied || loaded || lost || battle.beat >= MAX_BEATS) {
    battle.phase = 'over'
    // With every alien beaten the squad has won, even if its last soldier fell to the same blast.
    battle.winner = lost ? 'alien' : !aliens || loaded || emptied || (!humans && battle.escaped.length > 0) ? 'human' : humans ? null : 'alien'
    // A rescue is won only by saving more than RESCUE_QUORUM: those got out, and those alive once no alien is left.
    if (battle.goal === 'rescue' && battle.winner === 'human' && battle.saved + battle.units.filter((u) => u.civilian).length <= RESCUE_QUORUM) battle.winner = 'alien'
    events.push({ type: 'end', winner: battle.winner })
  }
  return events
}
