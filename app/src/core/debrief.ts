// Settling a finished battle into the run: experience, losses, loot and threat.
import { KIT_SLOTS, CONSUMABLE_DROP, CONSUMABLE_IDS } from './consumables'
import { DOCTRINES, type Doctrine } from './doctrines'
import { CIVILIANS, CIVILIANS_PER_THREAT, CIVILIAN_SUPPLIES } from './goals'
import { RISKS } from './missions'
import { STOP_THREAT, LOSS_THREAT, THREAT_MAX } from './progress'
import { type Relic, RELICS, offerable, RELIC_OFFERS } from './relics'
import { dropGear, settle } from './rewards'
import { random, randomInt } from './rng'
import { drawStops, passStop } from './run'
import { type Run } from './run-state'
import { earn, soldierStats, join, squadKeywords } from './squad'

/**
 * Settles a finished battle: experience, threat, rewards, and where the squad stands on the road. Every soldier earns
 * experience. A soldier downed comes home if the squad won with a soldier standing on the field. Otherwise only
 * those carried out do, and the aliens take the rest. A wipe, with none standing or lifted off, loses the run.
 */
export function endBattle(run: Run): void {
  const battle = run.battle!
  const mission = run.mission!
  const won = battle.winner === 'human'
  // A wipe, every soldier downed and none lifted off, loses the run.
  const standing = battle.units.some((u) => u.side === 'human' && u.soldier !== null)
  const wiped = !standing && battle.escaped.length === 0
  const field = won && standing
  const taken = new Set(field ? [] : battle.downed.map((d) => d.soldier))
  // A recovery won brings every captive home.
  run.captives = mission.kind === 'recovery' && won ? [] : [...new Set([...run.captives, ...taken])]
  const rescued = mission.goal === 'rescue' ? battle.saved + battle.units.filter((u) => u.civilian).length : null
  const soldiers = run.soldiers.map((s) => {
    const xpBefore = s.xp
    const { earned, feats, tally } = earn(battle, s, won, rescued)
    s.xp += earned.reduce((sum, e) => sum + e.xp, 0)
    // Health carries on: what it ends standing or lifted off with; downed, it comes back at 1.
    const maxHp = soldierStats(run, s).hp
    const hp = Math.max(1, Math.min(maxHp, battle.units.find((u) => u.soldier === s.id)?.hp ?? battle.lifted[s.id] ?? 0))
    s.wounds = maxHp - hp
    return { id: s.id, name: s.name, cls: s.cls, xpBefore, xpAfter: s.xp, taken: run.captives.includes(s.id), earned, feats, hp, maxHp, tally }
  })

  const before = run.threat
  const risk = RISKS[mission.risk]
  // An ambush won empties the threat; any other battle is a stop, and adds to it.
  if (mission.kind === 'ambush') run.threat = won ? 0 : run.threat
  else if (mission.kind !== 'recovery') run.threat = Math.min(run.threat + STOP_THREAT + (won ? 0 : LOSS_THREAT) + (mission.goal === 'raid' ? Math.max(0, battle.greed - 1) : 0) + (rescued === null ? 0 : Math.floor((CIVILIANS - (won ? rescued : 0)) / CIVILIANS_PER_THREAT)), THREAT_MAX)
  const held = run.relics.map((id): Relic => RELICS[id])
  const supplies = won ? risk.supplies * (mission.goal === 'raid' ? battle.grabbed : 1) + (rescued ?? 0) * (CIVILIAN_SUPPLIES + held.reduce((sum, relic) => sum + (relic.civilianSupplies ?? 0), 0)) + held.reduce((sum, relic) => sum + (relic.supplies ?? 0), 0) : 0
  run.supplies += supplies
  // At most a piece of gear: a key mission always drops one, rare or better; a battle by its goal and risk; nothing else does.
  const byGoal = { exterminate: risk.gear, assassinate: 1, hold: 0, rescue: 0, vip: 0, raid: 0, ambush: 0, recover: 0 }[mission.goal]
  const chance = mission.kind === 'key' ? 1 : mission.kind === 'battle' ? byGoal : 0
  if (won && chance > 0 && random(run) < chance) dropGear(run, risk.rareGear || mission.kind === 'key' || held.some((relic) => relic.rareGear))
  const found = won && mission.kind !== 'final' && run.kit.length < KIT_SLOTS && random(run) < CONSUMABLE_DROP ? CONSUMABLE_IDS[randomInt(run, CONSUMABLE_IDS.length)] : null
  if (found) run.kit.push(found)
  const key = won && mission.kind === 'key'
  // Each hero extracted joins the squad.
  const hero = run.route[run.keys]?.hero
  const hired = key && hero && !run.doctrines.some((id) => (DOCTRINES[id] as Doctrine).noRecruits) ? join(run, hero).name : null
  run.report = { stop: mission.kind, won, threat: { before, after: run.threat }, supplies, key, soldiers, hired, rescued, found }

  // Losing the hero's extraction, an ambush, a recovery or the hub loses the run, as does a wipe.
  if (mission.kind === 'final' || (mission.kind !== 'battle' && !won) || wiped) {
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
  // A satellite, an ambush, a hold, a VIP rescue or an Overrun battle won offers relics.
  if (won && (mission.kind === 'key' || mission.kind === 'ambush' || (mission.kind === 'battle' && (mission.goal === 'hold' || mission.goal === 'vip' || mission.risk === 'dangerous')))) {
    const pool = offerable(run.relics)
    // The first offer builds on a keyword the squad already has, when one can.
    const held = squadKeywords(run)
    const fits = pool.filter((id) => RELICS[id].tags?.some((tag) => held.includes(tag)))
    if (fits.length > 0) run.relicOffers.push(...pool.splice(pool.indexOf(fits[randomInt(run, fits.length)]), 1))
    while (run.relicOffers.length < RELIC_OFFERS && pool.length > 0) run.relicOffers.push(...pool.splice(randomInt(run, pool.length), 1))
  }
  settle(run)
}
