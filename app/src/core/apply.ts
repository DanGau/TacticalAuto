import { land } from './battle'
import { FACILITIES, type FacilityId } from './base'
import { arrive, BRIBE, depart, EVENTS, RELIC_PRICE } from './events'
import { advance, build, buildCost, enterZone, keepFind, nextStop, sellFind, skillOffers, takeRelic, takeSkill, type Run } from './run'

export type Action =
  /** Shop: build the facility's next level. */
  | { type: 'build'; facility: FacilityId }
  /** Shop: buy its relic. */
  | { type: 'buy' }
  /** Shop: pay to lower the threat, once. */
  | { type: 'bribe' }
  /** Shop: leave for the road. */
  | { type: 'leave' }
  /** Event: meet it the way its option at `index` says. */
  | { type: 'choose'; index: number }
  /** Overworld, at a fork: commit to the zone at `index` of run.zones. */
  | { type: 'zone'; index: number }
  /** Overworld, in a zone: travel to the next stop. */
  | { type: 'advance' }
  /** Deploy phase: land the squad on the zone at `zone` of battle.zones and begin the battle. */
  | { type: 'land'; zone: number }
  /** Reward phase: take the relic at `index` of run.relicOffers. */
  | { type: 'relic'; index: number }
  /** Reward phase: equip the first of run.finds on the soldier who found it, selling what it replaces. */
  | { type: 'keep' }
  /** Reward phase: sell the first of run.finds. */
  | { type: 'sell' }
  /** Reward phase: the soldier with id `soldier` learns the skill at `index` of its offers. */
  | { type: 'skill'; soldier: number; index: number }

export type Result = { ok: true } | { ok: false; reason: string }

const ok: Result = { ok: true }
const no = (reason: string): Result => ({ ok: false, reason })

/** The only way a player changes state. A rejected action leaves state untouched. */
export function apply(run: Run, action: Action): Result {
  if (action.type === 'land') {
    const battle = run.battle
    if (run.phase !== 'battle' || !battle || battle.phase !== 'deploy') return no('not landing')
    const zone = battle.zones[action.zone]
    if (!zone) return no('no such landing zone')
    land(battle, zone)
    return ok
  }
  if (action.type === 'relic' || action.type === 'keep' || action.type === 'sell' || action.type === 'skill') {
    if (run.phase !== 'reward') return no('nothing to choose')
    if (action.type === 'relic') {
      const id = run.relicOffers[action.index]
      if (!id) return no('no such relic')
      takeRelic(run, id)
    } else if (action.type === 'skill') {
      const soldier = run.soldiers.find((s) => s.id === action.soldier)
      if (!soldier || !skillOffers(soldier)[action.index]) return no('no such skill on offer')
      takeSkill(run, soldier, action.index)
    } else {
      if (run.finds.length === 0) return no('no gear found')
      if (action.type === 'keep') keepFind(run)
      else sellFind(run)
    }
    return ok
  }
  if (action.type === 'build' || action.type === 'buy' || action.type === 'bribe' || action.type === 'leave') {
    const shop = run.shop
    if (run.phase !== 'shop' || !shop) return no('not in a shop')
    if (action.type === 'build') {
      if (!(action.facility in FACILITIES)) return no('no such facility')
      const cost = buildCost(run, action.facility)
      if (cost === null) return no('fully built')
      if (cost > run.supplies) return no('not enough supplies')
      build(run, action.facility)
    } else if (action.type === 'buy') {
      if (!shop.relic) return no('no relic for sale')
      if (RELIC_PRICE > run.supplies) return no('not enough supplies')
      run.supplies -= RELIC_PRICE
      run.relics.push(shop.relic)
      shop.relic = null
    } else if (action.type === 'bribe') {
      if (shop.bribed) return no('already bribed')
      if (BRIBE.price > run.supplies) return no('not enough supplies')
      run.supplies -= BRIBE.price
      run.threat = Math.max(0, run.threat - BRIBE.threat)
      shop.bribed = true
    } else depart(run)
    return ok
  }
  if (action.type === 'choose') {
    if (run.phase !== 'event' || !run.event) return no('no event')
    const option = EVENTS[run.event].options[action.index]
    if (!option) return no('no such option')
    if (option.can && !option.can(run)) return no('cannot take that option')
    option.take(run)
    depart(run)
    return ok
  }
  if (run.phase !== 'overworld') return no('not in the overworld')
  if (action.type === 'zone') {
    const zone = run.zones[action.index]
    if (!zone) return no('no such zone')
    enterZone(run, zone)
    return ok
  }
  if (!run.zone) return no('choose a zone first')
  const stop = nextStop(run)
  if (stop === 'shop' || stop === 'unknown') arrive(run)
  else advance(run)
  return ok
}
