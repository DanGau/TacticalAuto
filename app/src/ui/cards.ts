// Fixed-size picks: a card tapped once is armed and tells its details; tapped again, it goes through.
import type { Action } from '../core/apply'
import type { Stats } from '../core/battle'
import type { Gear } from '../core/gear'
import { SELL } from '../core/rewards'
import { type Run, type Soldier } from '../core/run-state'
import { soldierStats, weaponOf } from '../core/squad'
import { WEAPONS, type Weapon } from '../core/weapons'
import { UTILITIES, type UtilityId } from '../core/utilities'
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
  return `<button class="pick ${pick.look}${pick.key === armed ? ' armed' : ''}${pick.spent ? ' bought' : ''}${pick.block ? ' blocked' : ''}" data-arm="${pick.key}"${action}${live && pick.attrs ? ` ${pick.attrs}` : ''}${pick.spent ? ' disabled' : ''}>${pick.body}</button>`
}

/** The strip telling the armed card's details; it keeps its height, so the cards never shift. */
export function pickDetail(picks: Pick[], armed: string | null, idle: string): string {
  const pick = picks.find((p) => p.key === armed && !p.spent)
  return `<div class="detail">${pick ? `${pick.detail}<small class="${pick.block ? 'up' : 'supplies'}">${pick.block ?? pick.go}</small>` : `<small>${idle}</small>`}</div>`
}

/** A weapon's attack with `damage`: its hits a turn by what each does, and those summed. */
const attack = ({ attack: { shots, power } }: Weapon, damage: number) => `${shots}×${Math.round(10 * power * damage) / 10}`
const blow = ({ attack: { shots, power } }: Weapon, damage: number) => shots * power * damage

const percent = new Set<keyof Stats>(['crit'])
const show = (key: keyof Stats, n: number) => (percent.has(key) ? `${Math.round(100 * n)}%` : `${n}`)

/** A piece of gear on one line: its rarity's name in its colour, then its name; or empty hands. */
const named = (gear: Gear | null) => (gear ? `<span class="tier ${gear.rarity}">${gear.rarity}</span> ${gear.name}` : '<span class="tier">empty hands</span>')

/**
 * A card per soldier who could take `gear`, each with what it holds now and what it would hold, in their rarities,
 * and each stat that changes, before and after.
 */
export function gearPicks(run: Run, gear: Gear, action: (soldier: Soldier) => Action, verb: string, block: string | null = null): Pick[] {
  return run.soldiers.map((soldier) => {
    const old = soldier.gear
    const now = soldierStats(run, soldier)
    const then = soldierStats(run, { ...soldier, gear })
    const row = (name: string, before: string, after: string, better: boolean) => `<tr><td>${name}</td><td>${before}</td><td>→</td><td class="${before === after ? '' : better ? 'down' : 'up'}">${after}</td></tr>`
    const [was, will] = [weaponOf(soldier), WEAPONS[gear.weapon]]
    const rows = [
      row('Attack', was ? attack(was, now.damage) : '–', attack(will, then.damage), !was || blow(will, then.damage) > blow(was, now.damage)),
      ...(Object.keys(now) as (keyof Stats)[]).filter((key) => now[key] !== then[key]).map((key) => row(STAT_NAMES[key], show(key, now[key]), show(key, then[key]), then[key] > now[key])),
    ]
    return {
      key: `s${soldier.id}`,
      action: action(soldier),
      look: 'compare',
      body: `<span class="who"><span class="portrait">${badge(soldier.cls)}</span><b>${soldier.name}</b></span>
        <small class="was">Now: ${named(old)}</small>
        <small class="will">New: ${named(gear)}</small>
        <table class="stats">${rows.join('')}</table>`,
      detail: `<p><b>Now.</b> ${old ? `${named(old)}: ${gearText(old)}` : 'Empty hands.'}</p><p><b>New.</b> ${named(gear)}: ${describeGear(gear)}</p>`,
      go: `Tap again to ${verb} ${soldier.name}${old ? `, selling ${old.name} for ${SELL[old.rarity]}` : ''}`,
      block,
    }
  })
}

/** A utility as a card: `top` says what tapping it means, `go` what the second tap does. */
export function utilityPick(key: string, action: Action | undefined, id: UtilityId, top: string, go: string, extra: Partial<Pick> = {}): Pick {
  const { icon, name, text } = UTILITIES[id]
  return { key, action, look: 'utility', body: `<small>${top}</small><b>${icon} ${name}</b>`, detail: `<p><b>${name}.</b> ${text}.</p>`, go, ...extra }
}

/** Selling a find, as a card among those who could take it. */
export const sellPick = (gear: Gear, find: number): Pick => ({
  key: 'sell',
  action: { type: 'sell', find },
  look: 'compare sell',
  body: `<b>Sell</b><small class="was">${named(gear)}</small><b class="supplies">+${SELL[gear.rarity]}</b>`,
  detail: `<p>Nobody takes ${gear.name}.</p>`,
  go: `Tap again to sell for ${SELL[gear.rarity]} supplies`,
})
