// Fixed-size picks: a card tapped once is armed and tells its details; tapped again, it goes through.
import type { Action } from '../core/apply'
import type { Gear } from '../core/gear'
import { SELL } from '../core/rewards'
import type { Run, Soldier } from '../core/run-state'
import { boonText, START_PICKS, UTILITIES, type UtilityId } from '../core/utilities'
import { badge, describeGear, gearType } from './html'

export interface Pick {
  /** Which card this is among those on screen. */
  key: string
  /** What a second tap does: an action, or other data attributes for the shell; none when `can` is false. */
  action?: Action
  attrs?: string
  /** A colour class, such as a rarity, or a look. */
  look: string
  body: string
  /** What the armed card tells, in the strip under the cards. */
  detail: string
  /** The prompt for the second tap. */
  go: string
  /** Why a second tap does nothing now; null when it goes through. */
  block?: string | null
  /** Gone from sale: stays in its place, greyed. */
  spent?: boolean
}

/** A card: same size whatever it holds, lit while armed. */
export function pickCard(pick: Pick, armed: string | null): string {
  const live = !pick.block && !pick.spent
  const action = live && pick.action ? ` data-action='${JSON.stringify(pick.action)}'` : ''
  return `<button class="pick ${pick.look}${pick.key === armed ? ' armed' : ''}${pick.spent ? ' bought' : ''}${pick.block ? ' blocked' : ''}" data-arm="${pick.key}"${action}${live && pick.attrs ? ` ${pick.attrs}` : ''}${pick.spent ? ' disabled' : ''}>${pick.body}</button>`
}

/** The strip telling the armed card's details; it keeps its height, so the cards never shift. */
export function pickDetail(picks: Pick[], armed: string | null, idle: string): string {
  const pick = picks.find((p) => p.key === armed && !p.spent)
  return `<div class="detail">${pick ? `${pick.detail}<small class="${pick.block ? 'up' : 'supplies'}">${pick.block ?? pick.go}</small>` : `<small>${idle}</small>`}</div>`
}

/** A piece of gear in full: name, type, rarity and effect. */
const full = (gear: Gear) => `<b class="tier ${gear.rarity}">${gear.rarity} ${gear.name}</b><small>${gearType(gear)}</small><span>${describeGear(gear)}</span>`

/** A held weapon's name, its card shown beside it on hover, focus or tap. */
const heldCard = (gear: Gear) => `<span class="held" tabindex="0" data-card><span class="tier ${gear.rarity}">${gear.name}</span><span class="gearpop ${gear.rarity}" hidden>${full(gear)}</span></span>`

/** A gear choice's arm key: a hero to equip, or the last option. */
const choiceKey = (soldier: Soldier | null) => (soldier ? `g${soldier.id}` : 'g-')

const act = (action: Action) => `data-action='${JSON.stringify(action)}'`

/**
 * Who takes `gear`: the gear, an option per hero to equip it (their held weapon sold), the `last` option, and Confirm,
 * live once an option is chosen. `go` gives Confirm's attributes for an option. Unarmed, the gear arrives.
 */
function gearChoice(run: Run, gear: Gear, armed: string | null, heading: string, go: (soldier: Soldier | null) => string, last: { label: string; fate: string }): string {
  const chosen = armed === choiceKey(null) ? null : run.soldiers.find((s) => choiceKey(s) === armed)
  const option = (soldier: Soldier | null, body: string) => {
    const on = chosen === soldier
    return `<button class="taker${on ? ' chosen' : ''}" role="radio" aria-checked="${on}" data-arm="${choiceKey(soldier)}">${body}</button>`
  }
  const drop = (s: Soldier) => (s.gear ? `drops ${heldCard(s.gear)}` : 'Empty hands')
  const hero = (s: Soldier) => option(s, `<span class="portrait">${badge(s.cls)}</span><span class="text"><b>Equip on ${s.name}</b><small class="drop">${drop(s)}</small></span>`)
  const fate = chosen === undefined ? 'Choose who takes it' : chosen ? `Equip on ${chosen.name}` : last.fate
  return `<div class="gearswap"><h1>New gear</h1><h2>${heading}</h2>
    <div class="side found${armed ? '' : ' arrive'} ${gear.rarity}"><span class="new">NEW</span>${full(gear)}<small class="fate">${fate}</small></div>
    <div class="options" role="radiogroup" aria-label="Who takes it">${run.soldiers.map(hero).join('')}${option(null, `<span class="text"><b>${last.label}</b></span>`)}</div>
    <button class="decide confirm"${chosen === undefined ? ' disabled' : ` ${go(chosen)}`}>Confirm</button></div>`
}

/** The find at `index`, with `note` after its heading: equipped on a hero, dropping theirs, or sold. */
export function findSwap(run: Run, index: number, armed: string | null, note = ''): string {
  const { rarity } = run.finds[index]
  const go = (s: Soldier | null) => act(s ? { type: 'equip', find: index, soldier: s.id } : { type: 'sell', find: index })
  return gearChoice(run, run.finds[index], armed, `Equip it or sell it${note}`, go, { label: `Sell · <span class="value">+${SELL[rarity]} supplies</span>`, fate: `Sold for ${SELL[rarity]} supplies` })
}

/** The shop's ware at `index`, at `price`: bought for a hero, dropping theirs, or left. */
export function shopSwap(run: Run, index: number, price: number, armed: string | null): string {
  const { gear } = run.shop!.wares[index]
  const go = (s: Soldier | null) => (s ? act({ type: 'gear', index, soldier: s.id }) : 'data-ware=""')
  return gearChoice(run, gear, armed, `For sale · <span class="value">${price} supplies</span>`, go, { label: 'Leave it', fate: 'Left on the shelf' })
}

/** A utility as a card: `top` says what tapping it means, `go` what the second tap does. */
export function utilityPick(key: string, action: Action | undefined, id: UtilityId, top: string, go: string, extra: Partial<Pick> = {}): Pick {
  const { icon, name, rounds, rarity } = UTILITIES[id]
  return { key, action, look: `utility ${rarity}`, body: `<small>${top}</small><b>${icon} ${name}</b><small class="rounds"><span class="tier ${rarity}">${rarity}</span> · ⏳ ${rounds}</small>`, detail: `<p><b>${name}</b> <span class="tier ${rarity}">${rarity}</span>. ${boonText(id)}.</p>`, go, ...extra }
}

/** The arm key of the starting offers picked, by index. */
const startKey = (picks: number[]) => `b${[...picks].sort().join('-')}`

/** The offers picked in `armed`, by index. */
const startPicks = (armed: string | null) => (armed?.match(/^b[\d-]*$/) ? armed.slice(1).split('-').filter(Boolean).map(Number) : [])

/** The run's first boons: START_PICKS of the offers, each card tapped to take or put back, then Confirm. */
export function startChoice(run: Run, armed: string | null): string {
  const picks = startPicks(armed)
  const card = (id: UtilityId, i: number) => {
    const on = picks.includes(i)
    const next = on ? picks.filter((p) => p !== i) : picks.length < START_PICKS ? [...picks, i] : [...picks.slice(1), i]
    const { icon, name, rounds, rarity } = UTILITIES[id]
    return `<button class="side ${on ? 'keep' : 'sell'}" role="checkbox" aria-checked="${on}" data-arm="${startKey(next)}"><small class="verb">${on ? 'take' : 'leave'}</small><small class="tier ${rarity}">${rarity} · ⏳ ${rounds} rounds</small><b>${icon} ${name}</b><span>${UTILITIES[id].text}</span></button>`
  }
  const ready = picks.length === START_PICKS
  return `<div class="gearswap boons"><h1>Starting boons</h1><h2>Take ${START_PICKS}: each lasts the run, and one goes into each fight</h2>
    <div class="swap">${run.boonOffers.map(card).join('')}</div>
    <button class="decide confirm"${ready ? ` data-action='${JSON.stringify({ type: 'boons', picks })}'` : ' disabled'}>${ready ? 'Confirm' : `Pick ${START_PICKS - picks.length} more`}</button></div>`
}
