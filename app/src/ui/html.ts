import type { Action } from '../core/apply'
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
