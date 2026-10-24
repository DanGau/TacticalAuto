import type { Action } from '../core/apply'
import { EFFECTS, type Gear } from '../core/gear'
import { ALIENS, type AlienKind } from '../core/aliens'
import { BOONS, type Stats } from '../core/battle'
import { KEYWORDS, RESISTS, type Keyword, type Resist } from '../core/keywords'
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

/** What each stat is called. */
export const STAT_NAMES: Record<keyof Stats, string> = { hp: 'Health', armor: 'Armor', aim: 'Aim', damage: 'Damage', range: 'Range', move: 'Move', crit: 'Crit', close: 'Aim per tile closer' }

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

/** Words that explain themselves on hover. */
export const tip = (label: string, text: string) => `<span class="tip" title="${text}">${label}</span>`

/** A keyword's chip: its icon and name, lit if the squad has it, explained on hover. */
export const keywordChip = (tag: Keyword, held = false) => `<span class="kw ${tag} ${held ? 'held' : ''}" title="${KEYWORDS[tag].name}: ${KEYWORDS[tag].text}">${KEYWORDS[tag].icon} ${KEYWORDS[tag].name}</span>`

/** A keyword something shrugs off: its icon struck through, explained on hover. */
export const resistChip = (tag: Resist) => `<span class="kw ${tag} resist" title="Resists ${KEYWORDS[tag].name}: ${RESISTS[tag]}">${KEYWORDS[tag].icon}</span>`

/** Keyword chips; one the squad already has, in `held`, is lit. */
export const keywordChips = (tags: Keyword[] = [], held: Keyword[] = []) =>
  tags.length === 0 ? '' : `<span class="keywords">${tags.map((tag) => keywordChip(tag, held.includes(tag))).join('')}</span>`

/** An alien kind's name, its rules on hover, and what it resists. */
export const alienName = (kind: AlienKind, label = ALIENS[kind].name) => `${tip(label, ALIENS[kind].text)}${ALIENS[kind].resists.map(resistChip).join('')}`

/** A landing zone's boon: its icon and name, what it does on hover. */
export const boonChip = (tag: Keyword) => `<span class="kw ${tag}" title="${BOONS[tag].text}">${KEYWORDS[tag].icon} ${BOONS[tag].name}</span>`

/** A piece of gear as a card's contents: rarity and slot, name, what it changes, and its keywords. */
export function gearCard(gear: Gear, held: Keyword[] = []): string {
  return `<small>${gear.rarity} ${gear.slot}</small><br><b>${gear.name}</b><br>${gearText(gear)}${keywordChips(gear.effect ? EFFECTS[gear.effect].tags : [], held)}`
}
