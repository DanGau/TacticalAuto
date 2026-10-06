import type { Action } from '../core/apply'
import type { Stats } from '../core/battle'
import { EFFECTS, type Gear } from '../core/gear'
import { preview, REGIONS, THREAT_MAX, type Mission, type Run } from '../core/run'

/** A button that performs `action` when clicked. */
export const button = (action: Action, label: string, cls = '', enabled = true) =>
  `<button class="${cls}" data-action='${JSON.stringify(action)}' ${enabled ? '' : 'disabled'}>${label}</button>`

export const signed = (n: number) => `${n > 0 ? '+' : ''}${n}`

export function missionTitle(mission: Mission): string {
  if (mission.kind === 'final') return 'Final assault on the alien ship'
  return `${mission.kind === 'lastStand' ? 'Last stand' : 'Strike'}: ${REGIONS[mission.region]}`
}

/**
 * One region's threat meter and a note beside it. Given a mission, it shows what choosing that mission leads to
 * here: a pip gained if this region is skipped, or what a win and a loss do if the mission is here.
 * `landed` is how many of the newest pips animate in as the aliens' advance.
 */
export function threatMeter(run: Run, region: number, mission?: Mission, landed = 0): string {
  const now = run.threat[region]
  const outcome = mission && preview(run, mission)
  // A skipped region ends the same won or lost; the mission's own region does not.
  const own = mission?.region === region
  const gained = outcome && !own ? outcome.won[region] - now : 0
  let note = now + gained === THREAT_MAX ? 'last stand' : landed > 0 ? signed(landed) : ''
  if (outcome && own) note = `${signed(outcome.won[region] - now)} won · ${outcome.lost ? `${signed(outcome.lost[region] - now)} lost` : 'run ends if lost'}`
  const pips = `${'■'.repeat(now - landed)}<span class="landed">${'■'.repeat(landed)}</span><span class="gained">${'■'.repeat(gained)}</span>${'□'.repeat(THREAT_MAX - now - gained)}`
  return `<span class="threat">${pips}</span><span class="note">${note}</span>`
}

const percent = (n: number) => `${signed(Math.round(100 * n))}%`

/** How each stat change reads on a piece of gear. */
const STAT_TEXT: Record<keyof Stats, (n: number) => string> = {
  hp: (n) => `${signed(n)} health`,
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
