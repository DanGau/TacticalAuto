import type { Action } from '../core/apply'
import { AID, FACILITIES, type AidId, type FacilityId } from '../core/base'
import { buildCost, level, payout, preview, RANK_NAMES, RANK_XP, rank, REGIONS, ROUNDS, THREAT_MAX, type Mission, type Report, type Run } from '../core/run'
import { tileAt } from '../view/view'

const SIDE = { human: 'Humans', alien: 'Aliens' }

export interface Ui {
  /** Shows `run` in the status line and the panel. */
  update(run: Run): void
}

const button = (action: Action, label: string, cls = '', enabled = true) =>
  `<button class="${cls}" data-action='${JSON.stringify(action)}' ${enabled ? '' : 'disabled'}>${label}</button>`

function missionTitle(mission: Mission): string {
  if (mission.kind === 'final') return 'Final assault on the alien ship'
  return `${mission.kind === 'lastStand' ? 'Last stand' : 'Strike'}: ${REGIONS[mission.region]}`
}

const signed = (n: number) => `${n > 0 ? '+' : ''}${n}`

/**
 * The threat meters. Given a mission, they show what choosing it leads to: threat the skipped regions gain
 * as extra pips, and beside the mission's own region, what a win and a loss do.
 * `landed` counts, per region, the newest pips to animate in as the aliens' advance.
 */
function threatTable(run: Run, mission?: Mission, landed?: number[]): string {
  const outcome = mission && preview(run, mission)
  const rows = REGIONS.map((name, i) => {
    const now = run.threat[i]
    // A skipped region ends the same won or lost; the mission's own region does not.
    const own = mission?.region === i
    const gained = outcome && !own ? outcome.won[i] - now : 0
    const fresh = landed?.[i] ?? 0
    const meter = `${'■'.repeat(now - fresh)}<span class="landed">${'■'.repeat(fresh)}</span><span class="gained">${'■'.repeat(gained)}</span>${'□'.repeat(THREAT_MAX - now - gained)}`
    let note = now + gained === THREAT_MAX ? 'last stand' : fresh > 0 ? signed(fresh) : ''
    if (outcome && own) note = `${signed(outcome.won[i] - now)} won · ${outcome.lost ? `${signed(outcome.lost[i] - now)} lost` : 'run ends if lost'}`
    return `<tr class="${own ? 'own' : ''}"><td>${name}</td><td class="threat">${meter}</td><td class="note">${note}</td></tr>`
  })
  return `<table>${rows.join('')}</table>`
}

function missionButton(mission: Mission, index: number): string {
  const reward = mission.kind === 'final' ? 'Lose and the run ends' : `+${payout(mission)} supplies, 1 of 3 aid${mission.hard ? ' (rare or better)' : ''}`
  return button({ type: 'mission', index }, `<b>${missionTitle(mission)}</b><br>${mission.aliens} aliens<br>${reward}`, `${mission.kind} mission-${index}`)
}

function aidCard(id: AidId, index: number): string {
  const { name, rarity, text } = AID[id]
  return button({ type: 'pick', index }, `<small>${rarity}</small><br><b>${name}</b><br>${text}`, `card ${rarity}`)
}

/** A facility's next level, buyable when the run has the supplies. */
function facilityButton(run: Run, id: FacilityId): string {
  const { name, text, max } = FACILITIES[id]
  const cost = buildCost(run, id)
  const price = cost === null ? 'fully built' : `${cost} supplies`
  return button({ type: 'build', facility: id }, `<b>${name}</b> ${level(run, id)}/${max}<br>${text}<br><small>${price}</small>`, '', cost !== null && cost <= run.supplies)
}

function mapPanel(run: Run): string {
  const squad = run.soldiers.map((s) => `<li>${RANK_NAMES[rank(s)]} ${s.name}</li>`)
  const tech = run.aid.filter((id) => AID[id].stats).map((id) => `<li>${AID[id].name}</li>`)
  return `
    <h1>${run.round > ROUNDS ? 'The final assault' : `Round ${run.round} of ${ROUNDS}`}</h1>
    <div class="columns">
      <div class="side">
        <h2>Threat</h2>
        <div class="now">${threatTable(run)}</div>
        ${run.missions.map((mission, index) => `<div class="preview preview-${index}">${threatTable(run, mission)}</div>`).join('')}
        <h2>Squad</h2><ul>${squad.join('')}</ul>
        ${tech.length > 0 ? `<h2>Alien tech</h2><ul>${tech.join('')}</ul>` : ''}
      </div>
      <div>
        <h2>1. Build your base · <b class="supplies">${run.supplies} ${run.supplies === 1 ? 'supply' : 'supplies'}</b></h2>
        <div class="facilities">${(Object.keys(FACILITIES) as FacilityId[]).map((id) => facilityButton(run, id)).join('')}</div>
        <h2>2. ${run.missions.length > 1 ? 'Aliens strike three regions. Answer one; hover to see the threat it leads to.' : 'One mission. It must be won.'}</h2>
        <div class="choices">${run.missions.map(missionButton).join('')}</div>
      </div>
    </div>`
}

/** Meters for the regions whose threat differs between two moments; falling pips are `cleared`, rising ones `landed`. */
function threatMoves(from: number[], to: number[]): string {
  const rows = REGIONS.flatMap((name, i) => {
    if (from[i] === to[i]) return []
    const kept = Math.min(from[i], to[i])
    const meter = `${'■'.repeat(kept)}<span class="cleared">${'■'.repeat(from[i] - kept)}</span><span class="landed">${'■'.repeat(to[i] - kept)}</span>${'□'.repeat(THREAT_MAX - Math.max(from[i], to[i]))}`
    return [`<tr><td>${name}</td><td class="threat">${meter}</td><td class="note">${signed(to[i] - from[i])} threat</td></tr>`]
  })
  return `<table>${rows.join('')}</table>`
}

/** A soldier's card: rank, an experience bar filling toward the next rank, and a promotion or death. */
function soldierCard(soldier: Report['soldiers'][number]): string {
  const before = rank({ xp: soldier.xpBefore })
  const after = rank({ xp: soldier.xpAfter })
  const span = RANK_XP[before + 1] - RANK_XP[before]
  // At the top rank there is no next threshold and the bar stays full.
  const filled = (xp: number) => (Number.isNaN(span) ? 100 : Math.min(100, (100 * (xp - RANK_XP[before])) / span))
  const badge = soldier.died ? '<b class="up">Killed in action</b>' : after > before ? `<b class="down promoted">Promoted to ${RANK_NAMES[after]}</b>` : `+${soldier.xpAfter - soldier.xpBefore} experience`
  return `<div class="soldier ${soldier.died ? 'died' : ''}">
    <small>${RANK_NAMES[before]}</small><br><b>${soldier.name}</b>
    <div class="bar"><div style="--from: ${filled(soldier.xpBefore)}%; --to: ${filled(soldier.xpAfter)}%"></div></div>
    ${badge}
  </div>`
}

/** The one screen after a battle, revealed top to bottom: the region, the supplies, the squad, then the aid to take. */
function missionEndPanel(run: Run, report: Report): string {
  const last = report.won
    ? `<h2>${REGIONS[run.mission!.region]} offers aid. Take one.</h2><div class="choices">${run.offers.map(aidCard).join('')}</div>`
    : '<button data-seen="mission">Continue</button>'
  return `
    <h1 class="${report.won ? 'down' : 'up'}">Mission ${report.won ? 'won' : 'lost'} · ${missionTitle(run.mission!)}</h1>
    <div class="stage">
      ${threatMoves(report.threat.before, report.threat.afterMission)}
      ${report.supplies > 0 ? `<p class="supplies">+${report.supplies} supplies</p>` : ''}
    </div>
    <div class="stage second"><h2>Squad</h2><div class="squad">${report.soldiers.map(soldierCard).join('')}</div></div>
    <div class="stage third">${last}</div>`
}

/** Threat each region gained from the strikes left unanswered, capped at what aid taken since has left. */
function alienAdvance(run: Run, report: Report): number[] {
  return run.threat.map((now, i) => Math.min(Math.max(report.threat.afterAliens[i] - report.threat.afterMission[i], 0), now))
}

/** The screen between a mission and the base: what the aliens did elsewhere meanwhile. */
function worldPanel(run: Run, report: Report): string {
  const lastStand = run.missions[0]?.kind === 'lastStand' ? `<p class="up stage second"><b>${REGIONS[run.missions[0].region]} is overrun. A last stand is next.</b></p>` : ''
  return `
    <h1 class="up">Meanwhile, the aliens advanced</h1>
    ${threatTable(run, undefined, alienAdvance(run, report))}
    ${lastStand}
    <button class="stage second" data-seen="world">Continue</button>`
}

function endPanel(run: Run): string {
  if (run.phase === 'won') return `<h1 class="down">Earth is saved</h1><button id="again">New run</button>`
  return `<h1 class="up">Earth has fallen</h1><h2>Lost: ${missionTitle(run.mission!)}, round ${Math.min(run.round, ROUNDS)}</h2><button id="again">New run</button>`
}

function status(run: Run): string {
  const battle = run.battle
  if (run.phase !== 'battle' || !battle) return ''
  const title = missionTitle(run.mission!)
  if (battle.phase === 'deploy') return `${title} · click the blue zone to deploy, ${battle.reserve.length} left`
  return `${title} · ${SIDE[battle.turn]}' turn`
}

/** Turns clicks into actions and hands them to `act`. */
export function createUi(canvas: HTMLCanvasElement, act: (action: Action) => void): Ui {
  const statusLine = document.getElementById('status')!
  const start = document.getElementById('start') as HTMLButtonElement
  const overlay = document.getElementById('panel')!
  /** The report whose screen of each kind the player has continued past. */
  const seen: Record<string, Report | null> = { mission: null, world: null }
  let shown: Run | null = null
  let html = ''

  /** The panel for where the player is: after a battle, the mission's end, then the world, then the base. */
  function panel(run: Run): string {
    const report = run.report
    if (run.phase === 'battle') return ''
    if (run.phase === 'won' || run.phase === 'lost') return endPanel(run)
    if (run.phase === 'reward') return missionEndPanel(run, report!)
    // A won mission's screen ended when its aid was taken.
    if (report && !report.won && seen.mission !== report) return missionEndPanel(run, report)
    if (report && seen.world !== report && alienAdvance(run, report).some((n) => n > 0)) return worldPanel(run, report)
    return mapPanel(run)
  }

  function render(run: Run): void {
    shown = run
    const next = panel(run)
    // Rewriting unchanged content would restart its animations.
    if (next !== html) overlay.innerHTML = html = next
    overlay.hidden = run.phase === 'battle'
  }

  canvas.addEventListener('click', (e) => {
    const box = canvas.getBoundingClientRect()
    act({ type: 'deploy', ...tileAt(e.clientX - box.left, e.clientY - box.top) })
  })
  start.addEventListener('click', () => act({ type: 'start' }))
  overlay.addEventListener('click', (e) => {
    const target = (e.target as HTMLElement).closest('button')
    if (target?.id === 'again') location.href = location.pathname
    else if (target?.dataset.seen) {
      seen[target.dataset.seen] = shown!.report
      render(shown!)
    }
    else if (target?.dataset.action && !target.disabled) act(JSON.parse(target.dataset.action))
  })

  return {
    update(run) {
      statusLine.textContent = status(run)
      start.hidden = run.phase !== 'battle' || run.battle?.phase !== 'deploy'
      render(run)
    },
  }
}
