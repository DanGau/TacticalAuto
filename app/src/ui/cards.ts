// Fixed-size picks: a card tapped once is armed and tells its details; tapped again, it goes through.
import type { Action } from '../core/apply'
import type { Gear } from '../core/gear'
import { SELL } from '../core/rewards'
import type { Run, Soldier } from '../core/run-state'
import { UTILITIES, type UtilityId } from '../core/utilities'
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

/** A piece of gear on a card: its rarity and name, in its rarity's colour; or empty hands. */
const named = (gear: Gear | null) => (gear ? `<span class="tier ${gear.rarity}">${gear.rarity} ${gear.name}</span>` : '<span class="tier">Empty hands</span>')

/** A piece of gear in full: name, type, rarity and effect. */
const full = (gear: Gear | null) => (gear ? `<b class="tier ${gear.rarity}">${gear.rarity} ${gear.name}</b><small>${gearType(gear)}</small><span>${describeGear(gear)}</span>` : '<small>Empty hands</small>')

/** A hero's card: who, what they hold, and what they would. */
const heroBody = (soldier: Soldier, gear: Gear) => `<span class="who"><span class="portrait">${badge(soldier.cls)}</span><b>${soldier.name}</b></span>
  <small class="was">${named(soldier.gear)}</small>
  <small class="arrow">↓</small>
  <small class="will">${named(gear)}</small>`

/** A side of the swap with what happens to it. */
const side = (verb: 'keep' | 'sell', gear: Gear | null, extra = '') => `<div class="side ${verb}"><small class="verb">${verb}${extra}</small>${full(gear)}</div>`

/** A card per soldier who could take `gear`, tapped again to `verb` them; armed, the strip keeps the new and sells the old. */
export function gearPicks(run: Run, gear: Gear, action: (soldier: Soldier) => Action, verb: string, block: string | null = null): Pick[] {
  return run.soldiers.map((soldier) => ({
    key: `s${soldier.id}`,
    action: action(soldier),
    look: 'compare',
    body: heroBody(soldier, gear),
    detail: `<div class="swap">${side('keep', gear)}${side('sell', soldier.gear, soldier.gear ? ` · +${SELL[soldier.gear.rarity]}` : '')}</div>`,
    go: `Tap again to ${verb} ${soldier.name}`,
    block,
  }))
}

/** Which of a hero's two weapons stays: the one held, or the one found. */
export type Keep = 'old' | 'new'

/** A swap's arm key: the hero's card, and which weapon is kept. */
export const swapKey = (soldier: Soldier, keep: Keep) => `s${soldier.id}~${keep}`

/** Which weapon `armed` keeps for `soldier`: as chosen, else the one held, so a hasty confirm changes no loadout. */
export function kept(soldier: Soldier, armed: string | null): Keep {
  const chosen = armed?.split('~')
  if (chosen?.[0] === `s${soldier.id}` && (chosen[1] === 'old' || chosen[1] === 'new')) return chosen[1]
  return soldier.gear ? 'old' : 'new'
}

/** What confirming does: keeping the find equips it, selling the held; keeping the held sells the find. */
export const swapAction = (find: number, soldier: Soldier, keep: Keep): Action => (keep === 'new' ? { type: 'equip', find, soldier: soldier.id } : { type: 'sell', find })

/** The swap for the find at `index`: whose weapon it sets against, then the two, one kept and one sold, and Confirm. */
export function findSwap(run: Run, index: number, armed: string | null): string {
  const gear = run.finds[index]
  const chosen = armed?.split('~')[0]
  const soldier = run.soldiers.find((s) => `s${s.id}` === chosen) ?? run.soldiers[0]
  const keep = kept(soldier, armed)
  const option = (which: Keep, item: Gear | null) => {
    const on = which === keep
    const extra = !on && item ? ` · +${SELL[item.rarity]} supplies` : ''
    return `<button class="side ${on ? 'keep' : 'sell'}" role="radio" aria-checked="${on}" data-arm="${swapKey(soldier, which)}"><small class="verb">${on ? 'keep' : 'sell'}${extra}</small><small class="label">${which === 'new' ? 'Found' : `${soldier.name} holds`}</small>${full(item)}</button>`
  }
  const heroes = run.soldiers.length > 1 ? `<div class="takers">${run.soldiers.map((s) => `<button class="who${s === soldier ? ' chosen' : ''}" data-arm="${swapKey(s, kept(s, null))}"><span class="portrait">${badge(s.cls)}</span>${s.name}</button>`).join('')}</div>` : ''
  return `${heroes}<div class="swap" role="radiogroup" aria-label="Keep which weapon">${option('old', soldier.gear)}${option('new', gear)}</div>
    <button class="decide confirm" data-action='${JSON.stringify(swapAction(index, soldier, keep))}'>Confirm</button>`
}

/** A utility as a card: `top` says what tapping it means, `go` what the second tap does. */
export function utilityPick(key: string, action: Action | undefined, id: UtilityId, top: string, go: string, extra: Partial<Pick> = {}): Pick {
  const { icon, name, text } = UTILITIES[id]
  return { key, action, look: 'utility', body: `<small>${top}</small><b>${icon} ${name}</b>`, detail: `<p><b>${name}.</b> ${text}.</p>`, go, ...extra }
}
