// The player's actions, checked and applied to the run: the only way a player changes state.
import { land } from './landing'
import { fuelTanks } from './objects'
import { UTILITY_PRICE } from './utilities'
import { arrive, BRIBE, depart, EVENTS, RELIC_PRICE } from './events'
import { advance, current, go, nextStop, recruit, ways } from './run'
import { type Run } from './run-state'
import { gainRelic, takeRelic } from './rewards'
import { sellFind } from './rewards'
import { buyWare } from './rewards'
import { buyUtility, keepUtility } from './rewards'
import { GEAR_PRICE } from './rewards'
import { equipFind } from './rewards'
import { takeSkill } from './rewards'
import { mend } from './squad'
import { TRAVEL_HEAL } from './squad'
import { skillOffers } from './squad'

export type Action =
  /** At the run's start: take the recruit at `index` of run.recruits as the first soldier. */
  | { type: 'recruit'; index: number }
  /** Shop: buy the gear at `index` of shop.wares for the soldier with id `soldier` to wear, selling what it replaces. */
  | { type: 'gear'; index: number; soldier: number }
  /** Shop: buy the relic at `index` of shop.relics. */
  | { type: 'buy'; index: number }
  /** Shop: buy the utility at `index` of shop.utilities. */
  | { type: 'utility'; index: number }
  /** Shop or reward phase, with a utility to spare: drop the one held at `drop`, or with -1, the new one. */
  | { type: 'keep'; drop: number }
  /** Shop: pay to lower the threat, once. */
  | { type: 'bribe' }
  /** Shop: leave for the road. */
  | { type: 'leave' }
  /** Event: meet it the way its option at `index` says. */
  | { type: 'choose'; index: number }
  /** Overworld, choosing where to go: enter the stop at `index` of the next column, one the last stop leads to. */
  | { type: 'go'; index: number }
  /** Overworld: travel to the next stop. */
  | { type: 'advance' }
  /** Deploy phase: land with the utility held at `utility`, rigging the tank at `tank` of fuelTanks if it is one, and begin. */
  | { type: 'enter'; utility?: number; tank?: number }
  /** Reward phase: take the relic at `index` of run.relicOffers. */
  | { type: 'relic'; index: number }
  /** Reward phase: put the find at `find` of run.finds on the soldier with id `soldier`, selling what it replaces. */
  | { type: 'equip'; find: number; soldier: number }
  /** Reward phase: sell the find at `find` of run.finds. */
  | { type: 'sell'; find: number }
  /** Any time: the player has read the first of run.gains. */
  | { type: 'ack' }
  /** Reward phase: the soldier with id `soldier` learns the skill at `index` of its offers. */
  | { type: 'skill'; soldier: number; index: number }

export type Result = { ok: true } | { ok: false; reason: string }

const ok: Result = { ok: true }
const no = (reason: string): Result => ({ ok: false, reason })

/** The only way a player changes state. A rejected action leaves state untouched. */
export function apply(run: Run, action: Action): Result {
  if (action.type === 'ack') {
    if (run.gains.length === 0) return no('nothing to acknowledge')
    run.gains.shift()
    return ok
  }
  if (action.type === 'recruit') {
    if (run.phase !== 'recruit') return no('not recruiting')
    if (!run.recruits[action.index]) return no('no such recruit')
    recruit(run, action.index)
    return ok
  }
  if (run.phase === 'recruit') return no('choose a recruit first')
  if (run.spare !== null && action.type !== 'keep') return no('choose what to drop first')
  if (action.type === 'enter') {
    const battle = run.battle
    if (run.phase !== 'battle' || !battle || battle.phase !== 'deploy') return no('not entering')
    const utility = action.utility === undefined ? null : run.utilities[action.utility]
    if (utility === undefined) return no('no such utility')
    if (utility === 'tank' && !fuelTanks(battle)[action.tank ?? 0]) return no('no such tank')
    land(battle, utility, action.tank)
    return ok
  }
  if (action.type === 'keep') {
    if (run.spare === null) return no('no utility to spare')
    if (action.drop !== -1 && !run.utilities[action.drop]) return no('no such utility')
    keepUtility(run, action.drop)
    return ok
  }
  if (action.type === 'relic' || action.type === 'equip' || action.type === 'sell' || action.type === 'skill') {
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
      if (!run.finds[action.find]) return no('no such find')
      if (action.type === 'sell') sellFind(run, action.find)
      else {
        const soldier = run.soldiers.find((s) => s.id === action.soldier)
        if (!soldier) return no('no such soldier')
        equipFind(run, action.find, soldier)
      }
    }
    return ok
  }
  if (action.type === 'gear' || action.type === 'buy' || action.type === 'utility' || action.type === 'bribe' || action.type === 'leave') {
    const shop = run.shop
    if (run.phase !== 'shop' || !shop) return no('not in a shop')
    if (action.type === 'gear') {
      const ware = shop.wares[action.index]
      if (!ware || ware.sold) return no('no such gear for sale')
      const soldier = run.soldiers.find((s) => s.id === action.soldier)
      if (!soldier) return no('no such soldier')
      if (GEAR_PRICE[ware.gear.rarity as keyof typeof GEAR_PRICE] > run.supplies) return no('not enough supplies')
      buyWare(run, action.index, soldier)
    } else if (action.type === 'buy') {
      const relic = shop.relics[action.index]
      if (!relic || relic.sold) return no('no such relic for sale')
      if (RELIC_PRICE > run.supplies) return no('not enough supplies')
      run.supplies -= RELIC_PRICE
      gainRelic(run, relic.id, true)
      relic.sold = true
    } else if (action.type === 'utility') {
      const item = shop.utilities[action.index]
      if (!item || item.sold) return no('no such utility for sale')
      if (UTILITY_PRICE > run.supplies) return no('not enough supplies')
      buyUtility(run, action.index)
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
  if (action.type === 'go') {
    if (current(run)) return no('already on the way to a stop')
    if (!ways(run).includes(action.index)) return no('no way there')
    go(run, action.index)
    return ok
  }
  if (!current(run)) return no('choose where to go first')
  const stop = nextStop(run)
  mend(run, TRAVEL_HEAL)
  if (stop === 'shop' || stop === 'unknown' || stop === 'medic') arrive(run)
  else advance(run)
  return ok
}
