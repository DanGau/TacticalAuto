// The player's actions, checked and applied to the run: the only way a player changes state.
import { land } from './landing'
import { CARDS } from './cards'
import { arrive, MEDKIT, depart, EVENTS, RELIC_PRICE } from './events'
import { advance, choose, current, go, nextStop, ways } from './run'
import { awaiting } from './combat'
import { endTurn, whyNot } from './turn'
import { type Run } from './run-state'
import { gainRelic, takeRelic } from './rewards'
import { sellFind } from './rewards'
import { buyWare } from './rewards'
import { buyCard, CARD_PRICE, REMOVE_PRICE, removeCard, takeCard, upgradeCard } from './rewards'
import { GEAR_PRICE } from './rewards'
import { equipFind } from './rewards'
import { takePerk, takeSkill } from './rewards'
import { UPGRADED } from './deck'
import { mend, wounded } from './hero'
import { minorOffers, skillOffers } from './hero'

export type Action =
  /** At the run's start: take the candidate at `index` of run.candidates as the run's hero. */
  | { type: 'hero'; index: number }
  /** Shop: buy the gear at `index` of shop.wares for the hero to wield, discarding what it replaces. */
  | { type: 'gear'; index: number }
  /** Shop: buy the relic at `index` of shop.relics. */
  | { type: 'buy'; index: number }
  /** Shop: buy the card at `index` of shop.cards into the deck. */
  | { type: 'buyCard'; index: number }
  /** Shop: remove the card at `index` of the deck, once a shop. */
  | { type: 'remove'; index: number }
  /** Shop: heal the hero some, once. */
  | { type: 'medkit' }
  /** Shop: leave for the road. */
  | { type: 'leave' }
  /** Event: meet it the way its option at `index` says. */
  | { type: 'choose'; index: number }
  /** Overworld, choosing where to go: enter the stop at `index` of the next column, one the last stop leads to. */
  | { type: 'go'; index: number }
  /** Overworld: travel to the next stop. */
  | { type: 'advance' }
  /** Deploy phase: land, and begin. */
  | { type: 'enter' }
  /** Battle, on the hero's turn: play the card at `index` of the hand, at the alien `target` if it is aimed. */
  | { type: 'play'; index: number; target: number | null }
  /** Battle, on the hero's turn: end it. */
  | { type: 'endTurn' }
  /** Reward phase: take the relic at `index` of run.relicOffers. */
  | { type: 'relic'; index: number }
  /** Reward phase: add the offered card at `index` to the deck, or with null skip. */
  | { type: 'card'; index: number | null }
  /** Reward phase, at a safehouse: upgrade the card at `index` of the deck, or with null rest, healing fully. */
  | { type: 'upgrade'; index: number | null }
  /** Reward phase: put the find at `find` of run.finds on the hero, discarding what it replaces. */
  | { type: 'equip'; find: number }
  /** Reward phase: sell the find at `find` of run.finds. */
  | { type: 'sell'; find: number }
  /** Any time: the player has read the first of run.gains. */
  | { type: 'ack' }
  /** Reward phase: the hero learns the skill, or takes the perk, at `index` of its offers. */
  | { type: 'skill'; index: number }
  | { type: 'perk'; index: number }

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
  if (action.type === 'hero') {
    if (run.phase !== 'select') return no('not choosing a hero')
    if (!run.candidates[action.index]) return no('no such hero')
    choose(run, action.index)
    return ok
  }
  if (run.phase === 'select') return no('choose a hero first')
  if (action.type === 'enter') {
    const battle = run.battle
    if (run.phase !== 'battle' || !battle || battle.phase !== 'deploy') return no('not entering')
    land(battle)
    return ok
  }
  if (action.type === 'play' || action.type === 'endTurn') {
    const battle = run.battle
    if (run.phase !== 'battle' || !battle || !awaiting(battle)) return no('not the hero\'s turn')
    if (action.type === 'endTurn') endTurn(battle)
    else {
      const why = whyNot(battle, action.index, action.target)
      if (why) return no(why)
      battle.queued = { index: action.index, target: action.target }
    }
    return ok
  }
  if (action.type === 'relic' || action.type === 'equip' || action.type === 'sell' || action.type === 'skill' || action.type === 'perk' || action.type === 'card' || action.type === 'upgrade') {
    if (run.phase !== 'reward') return no('nothing to choose')
    if (action.type === 'card') {
      if (run.cardOffers.length === 0) return no('no cards on offer')
      if (action.index !== null && !run.cardOffers[action.index]) return no('no such card')
      takeCard(run, action.index)
    } else if (action.type === 'upgrade') {
      if (!run.upgrading) return no('no upgrade owed')
      if (action.index !== null && !(run.deck[action.index]?.level < UPGRADED)) return no('no such card to upgrade')
      upgradeCard(run, action.index)
    } else if (action.type === 'relic') {
      const id = run.relicOffers[action.index]
      if (!id) return no('no such relic')
      takeRelic(run, id)
    } else if (action.type === 'skill') {
      if (!skillOffers(run.hero)[action.index]) return no('no such skill on offer')
      takeSkill(run, action.index)
    } else if (action.type === 'perk') {
      if (!minorOffers(run.hero)[action.index]) return no('no such perk on offer')
      takePerk(run, action.index)
    } else {
      if (!run.finds[action.find]) return no('no such find')
      if (action.type === 'sell') sellFind(run, action.find)
      else equipFind(run, action.find)
    }
    return ok
  }
  if (action.type === 'gear' || action.type === 'buy' || action.type === 'buyCard' || action.type === 'remove' || action.type === 'medkit' || action.type === 'leave') {
    const shop = run.shop
    if (run.phase !== 'shop' || !shop) return no('not in a shop')
    if (action.type === 'gear') {
      const ware = shop.wares[action.index]
      if (!ware || ware.sold) return no('no such gear for sale')
      if (GEAR_PRICE[ware.gear.rarity as keyof typeof GEAR_PRICE] > run.supplies) return no('not enough supplies')
      buyWare(run, action.index)
    } else if (action.type === 'buy') {
      const relic = shop.relics[action.index]
      if (!relic || relic.sold) return no('no such relic for sale')
      if (RELIC_PRICE > run.supplies) return no('not enough supplies')
      run.supplies -= RELIC_PRICE
      gainRelic(run, relic.id, true)
      relic.sold = true
    } else if (action.type === 'buyCard') {
      const item = shop.cards[action.index]
      if (!item || item.sold) return no('no such card for sale')
      if (CARD_PRICE[CARDS[item.id].rarity] > run.supplies) return no('not enough supplies')
      buyCard(run, action.index)
    } else if (action.type === 'remove') {
      if (shop.removed) return no('a card already removed here')
      if (!run.deck[action.index]) return no('no such card')
      if (REMOVE_PRICE > run.supplies) return no('not enough supplies')
      removeCard(run, action.index)
    } else if (action.type === 'medkit') {
      if (shop.medkit) return no('medkit already bought')
      if (!wounded(run)) return no('the hero is not hurt')
      if (MEDKIT.price > run.supplies) return no('not enough supplies')
      run.supplies -= MEDKIT.price
      mend(run, MEDKIT.heal)
      shop.medkit = true
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
  if (stop === 'shop' || stop === 'unknown') arrive(run)
  else advance(run)
  return ok
}
