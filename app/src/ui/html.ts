import type { Action } from '../core/apply'
import type { Stats } from '../core/battle'
import { EFFECTS, type Gear } from '../core/gear'
import { KEYS, THREAT_MAX, type Mission, type StopKind } from '../core/run'

/** A button that performs `action` when clicked. */
export const button = (action: Action, label: string, cls = '', enabled = true) =>
  `<button class="${cls}" data-action='${JSON.stringify(action)}' ${enabled ? '' : 'disabled'}>${label}</button>`

export const signed = (n: number) => `${n > 0 ? '+' : ''}${n}`

/** What each kind of stop is called. */
export const STOP_NAMES: Record<StopKind | Mission['kind'], string> = {
  battle: 'Battle',
  supply: 'Supply drop',
  cache: 'Gear cache',
  key: 'Satellite',
  final: 'The alien source',
  lastStand: 'Last stand',
}

/** The threat bar. `landed` is how many of the newest pips animate in. */
export function threatBar(threat: number, landed = 0): string {
  const pips = `${'■'.repeat(threat - landed)}<span class="landed">${'■'.repeat(landed)}</span>${'□'.repeat(THREAT_MAX - threat)}`
  return `<span class="threat">${pips}</span>${threat === THREAT_MAX ? '<b class="up">last stand next</b>' : ''}`
}

/** The access keys, won and still to win. */
export const keyRow = (keys: number) => `<span class="keys">${'◆'.repeat(keys)}${'◇'.repeat(KEYS - keys)}</span>`

const percent = (n: number) => `${signed(Math.round(100 * n))}%`

/** How each stat change reads on a piece of gear. */
const STAT_TEXT: Record<keyof Stats, (n: number) => string> = {
  hp: (n) => `${signed(n)} health`,
  armor: (n) => `${signed(n)} armor`,
  aim: (n) => `${percent(n)} aim`,
  damage: (n) => `${signed(n)} damage`,
  range: (n) => `${signed(n)} range`,
  move: (n) => `${signed(n)} move`,
  crit: (n) => `${percent(n)} crit`,
  close: (n) => `${percent(n)} aim per tile closer`,
}

/** What a piece of gear changes, as plain text: its stat changes, then its effect. */
export function gearText(gear: Gear): string {
  const stats = (Object.keys(gear.stats) as (keyof Stats)[]).map((key) => STAT_TEXT[key](gear.stats[key]!))
  return `${stats.join(', ')}${gear.effect ? `. ${EFFECTS[gear.effect].text}.` : ''}`
}

/** A piece of gear as a card's contents: rarity and slot, name, and what it changes. */
export function gearCard(gear: Gear): string {
  return `<small>${gear.rarity} ${gear.slot}</small><br><b>${gear.name}</b><br>${gearText(gear)}`
}
