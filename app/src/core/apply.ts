import { land, STRIKE, TEAMS } from './battle'
import { arrive, BRIBE, CREDIT_THREAT, depart, EVENTS, RELIC_PRICE } from './events'
import { advance, buyWare, current, GEAR_PRICE, go, keepFind, mend, nextStop, recruit, sellFind, skillOffers, takeRelic, takeSkill, THREAT_MAX, TRAVEL_HEAL, ways, type Run } from './run'

export type Action =
  /** At the run's start: take the recruit at `index` of run.recruits as the first soldier. */
  | { type: 'recruit'; index: number }
  /** Shop: buy the gear at `index` of shop.wares, for the soldier it is fitted to. */
  | { type: 'gear'; index: number }
  /** Shop: buy the relic at `index` of shop.relics. */
  | { type: 'buy'; index: number }
  /** Shop: take the relic at `index` of shop.relics on credit, for threat instead of supplies. */
  | { type: 'owe'; index: number }
  /** Shop: pay to lower the threat, once. */
  | { type: 'bribe' }
  /** Shop: leave for the road. */
  | { type: 'leave' }
  /** Event: meet it the way its option at `index` says. */
  | { type: 'choose'; index: number }
  /** Overworld, choosing where to go: enter the stop at `index` of the next column, one the last stop leads to. */
  | { type: 'go'; index: number }
  /** Overworld, in a zone: travel to the next stop. */
  | { type: 'advance' }
  /** Deploy phase: land the squad on the zone at `zone` of battle.zones and begin the battle. */
  | { type: 'land'; zone: number }
  /** Deploy phase, before landing: call an orbital strike that wounds every alien, for threat. Once a battle. */
  | { type: 'strike' }
  /** On a rescue, in place of a landing zone: how many teams the squad splits into, each landing apart. */
  | { type: 'split'; teams: number }
  /** On a raid, in place of a landing zone: how many supply caches the squad goes for before it lifts off. */
  | { type: 'grab'; caches: number }
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
  if (action.type === 'recruit') {
    if (run.phase !== 'recruit') return no('not recruiting')
    if (!run.recruits[action.index]) return no('no such recruit')
    recruit(run, action.index)
    return ok
  }
  if (run.phase === 'recruit') return no('choose a recruit first')
  if (action.type === 'strike') {
    const battle = run.battle
    if (run.phase !== 'battle' || !battle || battle.phase !== 'deploy') return no('not landing')
    if (battle.strike) return no('already struck')
    battle.strike = true
    run.threat = Math.min(run.threat + STRIKE.threat, THREAT_MAX)
    for (const alien of battle.units.filter((u) => u.side === 'alien')) alien.hp = Math.max(1, alien.hp - STRIKE.damage)
    return ok
  }
  if (action.type === 'grab') {
    const battle = run.battle
    if (run.phase !== 'battle' || !battle || battle.phase !== 'deploy' || battle.goal !== 'raid') return no('not raiding')
    if (!Number.isInteger(action.caches) || action.caches < 1 || action.caches > battle.caches.length) return no('no such raid')
    battle.greed = action.caches
    land(battle, battle.zones[0])
    return ok
  }
  if (action.type === 'split') {
    const battle = run.battle
    if (run.phase !== 'battle' || !battle || battle.phase !== 'deploy' || battle.goal !== 'rescue') return no('not splitting up')
    if (!Number.isInteger(action.teams) || action.teams < 1 || action.teams > Math.min(TEAMS, battle.reserve.length)) return no('no such split')
    land(battle, battle.zones[0], action.teams)
    return ok
  }
  if (action.type === 'land') {
    const battle = run.battle
    if (run.phase !== 'battle' || !battle || battle.phase !== 'deploy') return no('not landing')
    if (battle.goal === 'rescue') return no('a rescue splits up instead')
    if (battle.goal === 'raid') return no('a raid picks how many caches to grab instead')
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
  if (action.type === 'gear' || action.type === 'buy' || action.type === 'owe' || action.type === 'bribe' || action.type === 'leave') {
    const shop = run.shop
    if (run.phase !== 'shop' || !shop) return no('not in a shop')
    if (action.type === 'gear') {
      const ware = shop.wares[action.index]
      if (!ware) return no('no such gear for sale')
      if (GEAR_PRICE[ware.gear.rarity as keyof typeof GEAR_PRICE] > run.supplies) return no('not enough supplies')
      buyWare(run, action.index)
    } else if (action.type === 'buy') {
      const relic = shop.relics[action.index]
      if (!relic) return no('no such relic for sale')
      if (RELIC_PRICE > run.supplies) return no('not enough supplies')
      run.supplies -= RELIC_PRICE
      run.relics.push(relic)
      shop.relics.splice(action.index, 1)
    } else if (action.type === 'owe') {
      const relic = shop.relics[action.index]
      if (!relic) return no('no such relic for sale')
      run.threat = Math.min(run.threat + CREDIT_THREAT, THREAT_MAX)
      run.relics.push(relic)
      shop.relics.splice(action.index, 1)
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
