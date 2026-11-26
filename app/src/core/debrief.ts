// Settling a finished battle into the run: losses, loot and threat.
import { CIVILIANS, CIVILIANS_PER_THREAT, CIVILIAN_SUPPLIES } from './goals'
import { RISKS } from './missions'
import { STOP_THREAT, LOSS_THREAT, THREAT_MAX } from './progress'
import { type Relic, RELICS, offerable, RELIC_OFFERS, drawRelic, STREAK_FIGHTS, bridged } from './relics'
import { feeds } from './quantities'
import { dropGear, offerCards, settle } from './rewards'
import { random, randomInt } from './rng'
import { drawStops, passStop } from './run'
import { type Run } from './run-state'
import { makes, reads, soldierStats } from './hero'
import { tallyOf } from './wound'

/**
 * Settles a finished battle: threat, rewards, and where the hero stands on the road. Fallen in any battle, the run is lost.
 */
export function endBattle(run: Run): void {
  const battle = run.battle!
  const mission = run.mission!
  const won = battle.winner === 'human'
  const rescued = mission.goal === 'rescue' ? battle.saved + battle.units.filter((u) => u.civilian).length : null
  const s = run.hero
  const tally = tallyOf(battle, s.id)
  // Health carries on: what it ends standing or lifted off with.
  const maxHp = soldierStats(run, s).hp
  const hp = Math.max(0, Math.min(maxHp, battle.units.find((u) => u.soldier === s.id)?.hp ?? battle.lifted[s.id] ?? 0))
  const fell = hp === 0
  s.wounds = maxHp - hp
  const hero = { hp, maxHp, tally }

  run.log.push({ stop: mission.kind, goal: mission.goal, won, rounds: battle.round, tally })
  const before = run.threat
  const risk = RISKS[mission.risk]
  // An ambush won empties the threat; any other battle is a stop, and adds to it.
  if (mission.kind === 'ambush') run.threat = won ? 0 : run.threat
  else run.threat = Math.min(run.threat + STOP_THREAT + (won ? 0 : LOSS_THREAT) + (rescued === null ? 0 : Math.floor((CIVILIANS - (won ? rescued : 0)) / CIVILIANS_PER_THREAT)), THREAT_MAX)
  const held = run.relics.map((id): Relic => RELICS[id])
  const earned = won ? risk.supplies + (rescued ?? 0) * (CIVILIAN_SUPPLIES + held.reduce((sum, relic) => sum + (relic.civilianSupplies ?? 0), 0)) + held.reduce((sum, relic) => sum + (relic.supplies ?? 0), 0) : 0
  // A clean streak pays every STREAK_FIGHTS fights.
  run.streak = won ? run.streak + 1 : 0
  const supplies = earned + (run.streak > 0 && run.streak % STREAK_FIGHTS === 0 ? held.reduce((sum, relic) => sum + (relic.streak ?? 0), 0) : 0)
  run.supplies += supplies
  // At most a piece of gear: a key mission always drops one, rare or better; a battle by its goal and risk; nothing else does.
  const byGoal = { cross: risk.gear, assassinate: 1, hold: 0, rescue: 0, ambush: 0 }[mission.goal]
  const chance = mission.kind === 'key' ? 1 : mission.kind === 'battle' ? byGoal : 0
  if (won && chance > 0 && random(run) < chance) dropGear(run, risk.rareGear || mission.kind === 'key' || held.some((relic) => relic.rareGear))
  // Every battle won offers cards; an elite's, one with a boss or commander, are rare or better.
  if (won && mission.kind !== 'final') offerCards(run, mission.kind !== 'battle' || mission.goal === 'assassinate' || battle.challenge === 'bigOne')
  const key = won && mission.kind === 'key'
  run.report = { stop: mission.kind, won, threat: { before, after: run.threat }, supplies, key, hero, rescued }

  // Falling anywhere, or losing a satellite, an ambush or the hub, loses the run.
  if (fell || mission.kind === 'final' || (mission.kind !== 'battle' && !won)) {
    run.phase = mission.kind === 'final' && won ? 'won' : 'lost'
    return
  }
  // An ambush stands in front of the stop it interrupted.
  if (key) {
    run.keys++
    run.stop = 0
    drawStops(run)
  }
  if (mission.kind === 'battle') passStop(run)
  // A satellite, an ambush, a hold or an Overrun battle won offers relics.
  if (won && (mission.kind === 'key' || mission.kind === 'ambush' || (mission.kind === 'battle' && (mission.goal === 'hold' || mission.risk === 'dangerous')))) {
    offerRelics(run)
  }
  settle(run)
}

/**
 * Offers RELIC_OFFERS relics, the first one that reads a quantity the hero makes or makes one it reads, when one can,
 * a bridge of a cancellation it makes both halves of first; the rest drawn as drawRelic leans. Those turned down come
 * back only once every other is spent.
 */
export function offerRelics(run: Run): void {
  const all = offerable(run.relics)
  const unpassed = all.filter((id) => !run.passed.includes(id))
  const pool = unpassed.length > 0 ? unpassed : all
  const made = makes(run)
  const read = reads(run)
  const bridges = pool.filter((id) => bridged(id, made))
  const fits = bridges.length > 0 ? bridges : pool.filter((id) => feeds(RELICS[id], made, read))
  if (fits.length > 0) run.relicOffers.push(...pool.splice(pool.indexOf(fits[randomInt(run, fits.length)]), 1))
  while (run.relicOffers.length < RELIC_OFFERS && pool.length > 0) run.relicOffers.push(drawRelic(run, pool, made, read))
}
