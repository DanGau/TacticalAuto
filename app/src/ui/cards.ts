// Fixed-size picks: a card tapped once is armed and tells its details; tapped again, it goes through.
import type { Action } from '../core/apply'
import type { Stats } from '../core/battle'
import type { Gear } from '../core/gear'
import { SELL } from '../core/rewards'
import { type Run, type Soldier } from '../core/run-state'
import { soldierStats } from '../core/squad'
import { badge, describeGear, gearText, STAT_NAMES } from './html'

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
  return `<button class="pick ${pick.look}${pick.key === armed ? ' armed' : ''}${pick.spent ? ' bought' : ''}" data-arm="${pick.key}"${action}${live && pick.attrs ? ` ${pick.attrs}` : ''}${pick.spent ? ' disabled' : ''}>${pick.body}</button>`
}

/** The strip telling the armed card's details; it keeps its height, so the cards never shift. */
export function pickDetail(picks: Pick[], armed: string | null, idle: string): string {
  const pick = picks.find((p) => p.key === armed && !p.spent)
  return `<div class="detail">${pick ? `${pick.detail}<small class="${pick.block ? 'up' : 'supplies'}">${pick.block ?? pick.go}</small>` : `<small>${idle}</small>`}</div>`
}

const percent = new Set<keyof Stats>(['crit'])
const show = (key: keyof Stats, n: number) => (percent.has(key) ? `${Math.round(100 * n)}%` : `${n}`)

/** A piece of gear on one line: its rarity's name in its colour, then its name; or an empty slot. */
const named = (gear: Gear | null | undefined, slot: string) =>
  gear ? `<span class="tier ${gear.rarity}">${gear.rarity}</span> ${gear.name}` : `<span class="tier">empty</span> ${slot} slot`

/**
 * A card per soldier who could take `gear`, each with what it wears now and what it would wear, in their rarities,
 * and each stat that changes, before and after.
 */
export function gearPicks(run: Run, gear: Gear, action: (soldier: Soldier) => Action, verb: string, block: string | null = null): Pick[] {
  return run.soldiers.map((soldier) => {
    const old = soldier.gear[gear.slot]
    const now = soldierStats(run, soldier)
    const then = soldierStats(run, { ...soldier, gear: { ...soldier.gear, [gear.slot]: gear } })
    const rows = (Object.keys(now) as (keyof Stats)[]).filter((key) => now[key] !== then[key]).map((key) => `<tr><td>${STAT_NAMES[key]}</td><td>${show(key, now[key])}</td><td>→</td><td class="${then[key] > now[key] ? 'down' : 'up'}">${show(key, then[key])}</td></tr>`)
    return {
      key: `s${soldier.id}`,
      action: action(soldier),
      look: 'compare',
      body: `<span class="who"><span class="portrait">${badge(soldier.cls)}</span><b>${soldier.name}</b></span>
        <small class="was">Now: ${named(old, gear.slot)}</small>
        <small class="will">New: ${named(gear, gear.slot)}</small>
        <table class="stats">${rows.join('') || '<tr><td>Stats unchanged</td></tr>'}</table>`,
      detail: `<p><b>Now.</b> ${old ? `${named(old, gear.slot)}: ${gearText(old)}` : `Empty ${gear.slot} slot.`}</p><p><b>New.</b> ${named(gear, gear.slot)}: ${describeGear(gear)}</p>`,
      go: `Tap again to ${verb} ${soldier.name}${old ? `, selling ${old.name} for ${SELL[old.rarity]}` : ''}`,
      block,
    }
  })
}

/** Selling a find, as a card among those who could take it. */
export const sellPick = (gear: Gear, find: number): Pick => ({
  key: 'sell',
  action: { type: 'sell', find },
  look: 'compare sell',
  body: `<b>Sell</b><small class="was">${named(gear, gear.slot)}</small><b class="supplies">+${SELL[gear.rarity]}</b>`,
  detail: `<p>Nobody takes ${gear.name}.</p>`,
  go: `Tap again to sell for ${SELL[gear.rarity]} supplies`,
})
