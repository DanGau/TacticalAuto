// Fixed-size picks: a card tapped once is armed and tells its details; tapped again, it goes through.
import type { Action } from '../core/apply'
import { EFFECTS, type Gear } from '../core/gear'
import { WEAPONS } from '../core/weapons'
import { SELL } from '../core/rewards'
import type { Run } from '../core/run-state'
import { boonText, START_PICKS, UTILITIES, type UtilityId } from '../core/utilities'
import { badge, describeGear, gearName, weaponDoes } from './html'

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
const full = (gear: Gear) => `<b class="tier ${gear.rarity}">${gear.rarity} ${gearName(gear)}</b><span>${describeGear(gear)}</span>`

const act = (action: Action) => `data-action='${JSON.stringify(action)}'`

/** What `next` changes from `held`, stat by stat, then the special each brings. */
function changes(held: Gear | null, next: Gear): string[] {
  const keys = [...new Set([...Object.keys(held?.stats ?? {}), ...Object.keys(next.stats)])] as (keyof Gear['stats'])[]
  const stat = (key: keyof Gear['stats']) => {
    const by = (next.stats[key] ?? 0) - (held?.stats[key] ?? 0)
    const shown = key === 'crit' ? `${Math.round(100 * by)}%` : `${by}`
    return by === 0 ? '' : `<li class="${by > 0 ? 'up' : 'down'}">${by > 0 ? '+' : ''}${shown} ${key}</li>`
  }
  const effect = held?.effect === next.effect ? [] : [next.effect && `<li class="up">gains ${EFFECTS[next.effect].prefix}</li>`, held?.effect && `<li class="down">loses ${EFFECTS[held.effect].prefix}</li>`]
  return [...keys.map(stat), ...effect].filter((line): line is string => Boolean(line))
}

/**
 * `gear` beside the weapon its owner holds now, what it changes, and two buttons: Equip, and `last`, selling or leaving it.
 * Unarmed, the gear arrives.
 */
function gearChoice(run: Run, gear: Gear, armed: string | null, heading: string, equip: string, last: { label: string; attrs: string }): string {
  const owner = run.soldiers.find((s) => s.id === gear.owner)
  const held = owner?.gear ?? null
  const diff = changes(held, gear)
  return `<div class="gearswap"><h1>${owner ? `<span class="portrait">${badge(owner.cls)}</span> New ${WEAPONS[gear.weapon].name.toLowerCase()} for ${owner.name}` : 'New gear'}</h1><h2>${heading}</h2>
    <div class="compare">
      <div class="side now ${held?.rarity ?? ''}"><span class="tag">NOW</span>${held ? `${full(held)}<small>${weaponDoes(held)}</small>` : '<b>Empty hands</b>'}</div>
      <div class="side found${armed ? '' : ' arrive'} ${gear.rarity}"><span class="new">NEW</span>${full(gear)}<small>${weaponDoes(gear)}</small>${diff.length > 0 ? `<ul class="changes">${diff.join('')}</ul>` : ''}</div>
    </div>
    <div class="actions">${owner ? `<button class="decide confirm" ${equip}>Equip on ${owner.name}</button>` : ''}<button class="confirm" ${last.attrs}>${last.label}</button></div></div>`
}

/** The find at `index`, with `note` after its heading: equipped on its owner, dropping theirs, or sold. */
export function findSwap(run: Run, index: number, armed: string | null, note = ''): string {
  const { rarity } = run.finds[index]
  return gearChoice(run, run.finds[index], armed, `Equip it or sell it${note}`, act({ type: 'equip', find: index }), { label: `Sell · <span class="value">+${SELL[rarity]} supplies</span>`, attrs: act({ type: 'sell', find: index }) })
}

/** The shop's ware at `index`, at `price`: bought for its owner, dropping theirs, or left. */
export function shopSwap(run: Run, index: number, price: number, armed: string | null): string {
  const { gear } = run.shop!.wares[index]
  return gearChoice(run, gear, armed, `For sale · <span class="value">${price} supplies</span>`, act({ type: 'gear', index }), { label: 'Leave it', attrs: 'data-ware=""' })
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
