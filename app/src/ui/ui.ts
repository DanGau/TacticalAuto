import type { Action } from '../core/apply'
import { AID, FACILITIES, type AidId, type FacilityId } from '../core/base'
import { buildCost, level, payout, preview, RANK_NAMES, rank, REGIONS, ROUNDS, THREAT_MAX, type Mission, type Report, type Run } from '../core/run'
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
 */
function threatTable(run: Run, mission?: Mission): string {
  const outcome = mission && preview(run, mission)
  const rows = REGIONS.map((name, i) => {
    const now = run.threat[i]
    // A skipped region ends the same won or lost; the mission's own region does not.
    const own = mission?.region === i
    const gained = outcome && !own ? outcome.won[i] - now : 0
    const meter = `${'■'.repeat(now)}<span class="gained">${'■'.repeat(gained)}</span>${'□'.repeat(THREAT_MAX - now - gained)}`
    let note = now + gained === THREAT_MAX ? 'last stand' : ''
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
    ${run.battle && run.battle.winner !== 'human' ? `<p class="up">Mission lost: ${REGIONS[run.mission!.region]} gained threat.</p>` : ''}
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
    const note = to[i] === THREAT_MAX ? 'last stand next' : signed(to[i] - from[i])
    return [`<tr><td>${name}</td><td class="threat">${meter}</td><td class="note">${note}</td></tr>`]
  })
  return `<table>${rows.join('')}</table>`
}

/** The step after a battle: first what the squad changed, then what the aliens did meanwhile. */
function debriefPanel(run: Run, report: Report): string {
  const { before, afterMission, afterAliens } = report.threat
  const moved = afterAliens.some((t, i) => t !== afterMission[i])
  const lines = [
    report.supplies > 0 ? `<li class="supplies">+${report.supplies} supplies</li>` : '',
    ...report.promoted.map((p) => `<li class="down">${p}</li>`),
    ...report.fallen.map((name) => `<li class="up">${name} died</li>`),
  ]
  return `
    <h1 class="${report.won ? 'down' : 'up'}">Mission ${report.won ? 'won' : 'lost'} · ${missionTitle(run.mission!)}</h1>
    <div class="stage">
      <h2>${report.won ? 'You pushed them back' : 'You lost ground'}</h2>
      ${threatMoves(before, afterMission)}
      <ul>${lines.join('')}</ul>
    </div>
    <div class="stage second">
      <h2>${moved ? 'Meanwhile, the aliens advanced' : 'The aliens made no other moves'}</h2>
      ${threatMoves(afterMission, afterAliens)}
    </div>
    <button id="continue" class="stage third">Continue</button>`
}

function panel(run: Run): string {
  switch (run.phase) {
    case 'map':
      return mapPanel(run)
    case 'reward':
      return `<h1>Mission won</h1><h2>${REGIONS[run.mission!.region]} offers aid. Take one.</h2>
        <div class="choices">${run.offers.map(aidCard).join('')}</div>`
    case 'won':
      return `<h1>Earth is saved</h1><button id="again">New run</button>`
    case 'lost':
      return `<h1>Earth has fallen</h1><h2>Lost: ${missionTitle(run.mission!)}, round ${Math.min(run.round, ROUNDS)}</h2><button id="again">New run</button>`
    case 'battle':
      return ''
  }
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
  /** The report the player has already continued past. */
  let reviewed: Report | null = null
  let shown: Run | null = null
  let html = ''

  function render(run: Run): void {
    shown = run
    const debrief = run.report !== reviewed && run.report && (run.phase === 'map' || run.phase === 'reward')
    const next = debrief ? debriefPanel(run, run.report!) : panel(run)
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
    else if (target?.id === 'continue') {
      reviewed = shown!.report
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
