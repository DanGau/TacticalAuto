// A battle's beat: the round's stage, and the next unit's action.
import { settle } from './knockback'
import { HOLD_ROUNDS, RESCUE_QUORUM } from './goals'
import { isSoldier, MAX_BEATS, type Battle } from './battle'

/** Rounds after which a battle still undecided is lost. */
export const MAX_ROUNDS = 40
import type { GameEvent } from './combat-event'
import { spotted } from './fighters'
import { weaponAttack } from './attack'
import { alienAction } from './abilities'
import { armed, moveSide } from './sides'
import { tallyOf } from './wound'
import { thaw } from './stacks'
import { beginTurn, resolve } from './turn'

/** The next alien's action on the enemy's turn, each acting once, lowest id first: what its kind does in place of a shot, else a shot. Empty once every alien has acted. */
function alienActs(battle: Battle): GameEvent[] {
  for (const unit of battle.units) {
    const drift = settle(battle, unit)
    if (drift.length > 0) return drift
  }
  const seen = spotted(battle)
  for (const unit of battle.units) {
    if (unit.side !== 'alien' || unit.id <= battle.shooter || !armed(unit)) continue
    battle.shooter = unit.id
    if (unit.panicked) {
      unit.panicked = false
      thaw(battle, unit)
      return [{ type: 'frozen', id: unit.id }]
    }
    const special = alienAction(battle, unit)
    if (special) {
      if (special.length === 0) continue
      return special
    }
    battle.actor = unit.id
    const events = weaponAttack(battle, unit, seen)
    battle.actor = null
    if (events.length === 0) continue
    // An alien unseen gives itself away when it opens fire.
    if (!unit.revealed) {
      unit.revealed = true
      events.unshift({ type: 'reveal', units: [{ id: unit.id, x: unit.x, y: unit.y }] })
    }
    return events
  }
  return []
}

/**
 * The round's next step. Move: the aliens move, then the hero's automatic move, and the hero's turn begins. Play: the
 * card the player queued resolves; with none, the battle waits. Enemy: each alien acts in turn, then the round ends.
 */
function act(battle: Battle): GameEvent[] {
  for (let tries = 0; tries < 3; tries++) {
    if (battle.stage === 'move') {
      const events = moveSide(battle)
      const heroes = battle.turn === 'human'
      if (heroes) beginTurn(battle)
      else battle.turn = 'human'
      if (events.length > 0 || heroes) return events
      continue
    }
    if (battle.stage === 'play') return battle.queued ? resolve(battle) : []
    const action = alienActs(battle)
    if (action.length > 0) return action
    for (const u of battle.units) {
      u.surprised = Math.max(0, u.surprised - 1)
      u.guarded = []
    }
    battle.stage = 'move'
  }
  return []
}

/** Whether the battle waits for the player: on the hero's turn with no card queued. */
export const awaiting = (battle: Battle) => battle.phase === 'battle' && battle.stage === 'play' && !battle.queued

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

/** Advances a battle one beat: a side's move, a card played, or one alien's action. Does nothing outside the battle phase or while it waits for the player. */
export function stepBattle(battle: Battle): GameEvent[] {
  if (battle.phase !== 'battle' || awaiting(battle)) return []
  battle.beat++
  const events = act(battle)
  tallyHealing(battle, events)
  const humans = battle.units.some(isSoldier)
  // Every sentry down before the clock runs out: no reinforcements come.
  if (battle.deadline !== null && battle.round < battle.deadline && !battle.units.some((u) => u.side === 'alien')) battle.waves = []
  // Aliens left to beat: none once the targets fall, for the rest flee.
  const fled = battle.quarry && !battle.units.some((u) => u.target)
  const aliens = !fled && (battle.units.some((u) => u.side === 'alien') || battle.waves.length > 0)
  // A rescue is over once no civilian is left to save: won if any were. A hold is won once held.
  const emptied = battle.goal === 'rescue' && !battle.units.some((u) => u.civilian)
  const held = battle.goal === 'hold' && battle.held >= HOLD_ROUNDS
  // A fight dragged past MAX_ROUNDS is lost: the aliens hold the field.
  const stalled = battle.round > MAX_ROUNDS
  if (!humans || !aliens || emptied || held || stalled || battle.beat >= MAX_BEATS) {
    battle.phase = 'over'
    // With every alien beaten the hero has won, even if it fell to the same blast.
    battle.winner = stalled ? 'alien' : !aliens || emptied || held || (!humans && battle.escaped.length > 0) ? 'human' : humans ? null : 'alien'
    // A rescue is won only by saving more than RESCUE_QUORUM: those got out, and those alive once no alien is left.
    if (battle.goal === 'rescue' && battle.winner === 'human' && battle.saved + battle.units.filter((u) => u.civilian).length <= RESCUE_QUORUM) battle.winner = 'alien'
    events.push({ type: 'end', winner: battle.winner })
  }
  return events
}
