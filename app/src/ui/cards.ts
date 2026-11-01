// Fixed-size picks: a card tapped once is armed and tells its details; tapped again, it goes through.
import type { Action } from '../core/apply'
import type { Stats } from '../core/battle'
import type { Gear } from '../core/gear'
import { SELL } from '../core/rewards'
import { type Run, type Soldier } from '../core/run-state'
import { soldierStats, weaponOf } from '../core/squad'
import { WEAPONS, type Weapon } from '../core/weapons'
import { UTILITIES, type UtilityId } from '../core/utilities'
import { badge, describeGear, gearType, STAT_NAMES } from './html'

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

/** What a weapon's attack does in a turn, all its hits summed. */
const blow = ({ attack: { shots, power } }: Weapon, damage: number) => shots * power * damage

/** A change in a stat as a chip: green if better, red if worse. */
const chip = (name: string, change: number, percent = false) => `<span class="delta ${change > 0 ? 'better' : 'worse'}">${name} ${change > 0 ? '+' : '−'}${percent ? `${Math.round(100 * Math.abs(change))}%` : Math.round(10 * Math.abs(change)) / 10}</span>`

/** A piece of gear on a card: its rarity and name, in its rarity's colour; or empty hands. */
const named = (gear: Gear | null) => (gear ? `<span class="tier ${gear.rarity}">${gear.rarity} ${gear.name}</span>` : '<span class="tier">Empty hands</span>')

/** A piece of gear in full, under what happens to it. */
const side = (verb: 'keep' | 'toss', gear: Gear | null, extra = '') =>
  `<div class="side ${verb}"><small class="verb">${verb === 'keep' ? 'Keep' : 'Toss'}${extra}</small>${gear ? `<b class="tier ${gear.rarity}">${gear.rarity} ${gear.name}</b><small>${gearType(gear)}</small><span>${describeGear(gear)}</span>` : '<small>Nothing</small>'}</div>`

/** What a choice keeps and what it tosses, side by side. */
const swap = (keep: Gear | null, toss: Gear | null, extra = '') => `<div class="swap">${side('keep', keep)}${side('toss', toss, extra)}</div>`

/**
 * A card per soldier who could take `gear`: what it tosses and keeps, in their rarities, and only what changes. Armed,
 * the strip below sets the two side by side.
 */
export function gearPicks(run: Run, gear: Gear, action: (soldier: Soldier) => Action, verb: string, block: string | null = null): Pick[] {
  return run.soldiers.map((soldier) => {
    const old = soldier.gear
    const now = soldierStats(run, soldier)
    const then = soldierStats(run, { ...soldier, gear })
    const was = weaponOf(soldier)
    const hit = blow(WEAPONS[gear.weapon], then.damage) - (was ? blow(was, now.damage) : 0)
    const changes = [
      ...(Math.abs(hit) >= 0.05 ? [chip('Dmg', hit)] : []),
      ...(Object.keys(now) as (keyof Stats)[]).filter((key) => key !== 'damage' && now[key] !== then[key]).map((key) => chip(STAT_NAMES[key], then[key] - now[key], key === 'crit')),
    ]
    return {
      key: `s${soldier.id}`,
      action: action(soldier),
      look: 'compare',
      body: `<span class="who"><span class="portrait">${badge(soldier.cls)}</span><b>${soldier.name}</b></span>
        <small class="was">${named(old)}</small>
        <small class="arrow">↓</small>
        <small class="will">${named(gear)}</small>
        <span class="deltas">${changes.join('')}</span>`,
      detail: swap(gear, old, old ? ` · +${SELL[old.rarity]} supplies` : ''),
      go: `Tap again to ${verb} ${soldier.name}`,
      block,
    }
  })
}

/** A utility as a card: `top` says what tapping it means, `go` what the second tap does. */
export function utilityPick(key: string, action: Action | undefined, id: UtilityId, top: string, go: string, extra: Partial<Pick> = {}): Pick {
  const { icon, name, text } = UTILITIES[id]
  return { key, action, look: 'utility', body: `<small>${top}</small><b>${icon} ${name}</b>`, detail: `<p><b>${name}.</b> ${text}.</p>`, go, ...extra }
}

/** Selling a find, as a card among those who could take it: every hero keeps what it holds. */
export const sellPick = (gear: Gear, find: number): Pick => ({
  key: 'sell',
  action: { type: 'sell', find },
  look: 'compare sell',
  body: `<b>Sell it</b><small class="was">${named(gear)}</small><b class="supplies">+${SELL[gear.rarity]}</b>`,
  detail: swap(null, gear, ` · +${SELL[gear.rarity]} supplies`),
  go: `Tap again to sell for ${SELL[gear.rarity]} supplies`,
})
