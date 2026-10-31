import type { Action } from '../core/apply'
import { EFFECTS, type Gear } from '../core/gear'
import { ALIENS, type AlienKind } from '../core/aliens'
import type { Stats } from '../core/battle'
import { KEYWORDS, RESISTS, type Keyword, type Resist } from '../core/keywords'
import { TUNING } from '../core/tuning'
import type { ClassId } from '../core/classes'
import { THREAT_MAX, type Mission, type StopKind } from '../core/run'

/** A button that performs `action` when clicked. */
export const button = (action: Action, label: string, cls = '', enabled = true) =>
  `<button class="${cls}" data-action='${JSON.stringify(action)}' ${enabled ? '' : 'disabled'}>${label}</button>`

export const signed = (n: number) => `${n > 0 ? '+' : ''}${n}`

/** What each kind of stop is called. */
export const STOP_NAMES: Record<StopKind | Mission['kind'], string> = {
  battle: 'Battle',
  supply: 'Supply drop',
  cache: 'Gear cache',
  shop: 'Shop',
  medic: 'Medic',
  unknown: '❓ Unknown',
  key: 'Extraction',
  final: 'The alien source',
  ambush: 'Ambush',
  recovery: 'Recovery',
}

/** A soldier's health as a red bar and a count. */
export const healthBar = (hp: number, max: number) => `<div class="health" title="Health ${hp} of ${max}">♥ ${hp}/${max}<div class="bar"><div style="width: ${(100 * hp) / max}%"></div></div></div>`

const BADGES: Record<ClassId, string> = { assault: '🔫', heavy: '🚀', sniper: '🎯', support: '⛑️', engineer: '🔧', pyro: '🔥', cryo: '❄️' }

/** A class's badge; a soldier not yet promoted wears a helmet. */
export const badge = (cls?: ClassId | null) => (cls ? BADGES[cls] : '🪖')

/** The threat bar. `landed` is how much of the newest threat animates in. */
export function threatBar(threat: number, landed = 0): string {
  const pct = (n: number) => `${(100 * n) / THREAT_MAX}%`
  const meter = `<span class="threat" title="The hunt: the fuller the bar, the more aliens every battle has, up to ${Math.round(100 * TUNING.hunt)}% more. Full, it ambushes the squad"><i style="width:${pct(threat - landed)}"></i><i class="landed" style="width:${pct(landed)}"></i></span>`
  return `${meter}${threat === THREAT_MAX ? '<b class="up">ambush next</b>' : ''}`
}

/** The access keys, won and still to win. */

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

/** The words in a description that name a keyword, and which. */
const KEYWORD_WORDS: [RegExp, Keyword][] = [
  [/burning|burns?/, 'burn'],
  [/chilled|chills?/, 'frost'],
  [/marked|marks?/, 'mark'],
  [/crits?/, 'crit'],
  [/kills?/, 'kill'],
  [/armor/, 'ward'],
]
const KEYWORD_PATTERN = new RegExp(`\\b(${KEYWORD_WORDS.map(([re]) => re.source).join('|')})\\b`, 'gi')
const keywordOf = (word: string) => KEYWORD_WORDS.find(([re]) => new RegExp(`^(${re.source})$`, 'i').test(word))![1]

/**
 * A description as Slay the Spire writes a card: each keyword in it coloured in place, lit if the squad has it,
 * and on hover a box beside it defining every keyword it names or carries.
 */
export function describe(text: string, tags: Keyword[] = [], held: Keyword[] = []): string {
  const named = new Set<Keyword>(tags)
  const rich = text.replace(KEYWORD_PATTERN, (word) => {
    const tag = keywordOf(word)
    named.add(tag)
    return `<span class="kwi ${tag} ${held.includes(tag) ? 'held' : ''}">${KEYWORDS[tag].icon}${word}</span>`
  })
  const defs = [...named].map((tag) => `<span class="def"><b class="kwi ${tag}">${KEYWORDS[tag].icon} ${KEYWORDS[tag].name}</b>${KEYWORDS[tag].text}.</span>`)
  // One span, so a flex card keeps the sentence on one line.
  return `<span>${rich}</span>${defs.length > 0 ? `<span class="defs">${defs.join('')}</span>` : ''}`
}

/** Keyword chips; one the squad already has, in `held`, is lit. */
export const keywordChips = (tags: Keyword[] = [], held: Keyword[] = []) =>
  tags.length === 0 ? '' : `<span class="keywords">${tags.map((tag) => keywordChip(tag, held.includes(tag))).join('')}</span>`

/** An alien kind's name, its rules on hover, and what it resists. */
export const alienName = (kind: AlienKind, label = ALIENS[kind].name) => `${tip(label, ALIENS[kind].text)}${ALIENS[kind].resists.map(resistChip).join('')}`


/** A piece of gear as a card's contents: rarity and slot, name, what it changes, and its keywords. */
export function gearCard(gear: Gear, held: Keyword[] = []): string {
  return `<small>${gear.rarity} ${gear.slot}</small><br><b>${gear.name}</b><br>${describe(gearText(gear), gear.effect ? EFFECTS[gear.effect].tags : [], held)}`
}
