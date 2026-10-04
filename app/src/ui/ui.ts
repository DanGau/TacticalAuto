import type { Action } from '../core/apply'
import { AID, FACILITIES, type AidId, type FacilityId } from '../core/base'
import { buildCost, level, payout, preview, RANK_NAMES, rank, REGIONS, ROUNDS, THREAT_MAX, type Mission, type Run } from '../core/run'
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

const pips = (threat: number) => `<span class="threat">${'■'.repeat(threat)}${'□'.repeat(THREAT_MAX - threat)}</span>`

/** A threat change, marking a region it pushes into a last stand. */
function change(from: number, to: number): string {
  const by = to - from
  const alarm = to === THREAT_MAX ? ' → last stand' : ''
  return `<span class="${by > 0 ? 'up' : 'down'}">${by > 0 ? '+' : ''}${by} threat${alarm}</span>`
}

/**
 * A mission choice. Hovering it reveals what winning and losing do there,
 * and reveals on each other choice what skipping that one does.
 */
function missionButton(run: Run, mission: Mission, index: number): string {
  const now = run.threat[mission.region]
  const { won, lost } = preview(run, mission)
  const reward = mission.kind === 'final' ? '' : ` · +${payout(mission)} supplies, 1 of 3 aid${mission.hard ? ' (rare or better)' : ''}`
  const win = mission.kind === 'final' ? '<span class="down">Earth is saved</span>' : change(now, won[mission.region])
  const lose = lost ? change(now, lost[mission.region]) : '<span class="up">the run ends</span>'
  const other = run.missions.find((m) => m !== mission)
  const skipped = other ? change(now, preview(run, other).won[mission.region]) : ''
  return button(
    { type: 'mission', index },
    `<b>${missionTitle(mission)}</b><br>${mission.aliens} aliens${reward}
    <div class="outcome"><span class="chosen">Win: ${win} · Lose: ${lose}</span><span class="skipped">Skipped: ${skipped}</span></div>`,
    mission.kind,
  )
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
  const threat = REGIONS.map((name, i) => `<tr><td>${name}</td><td>${pips(run.threat[i])}</td></tr>`)
  const squad = run.soldiers.map((s) => `<li>${RANK_NAMES[rank(s)]} ${s.name}</li>`)
  const tech = run.aid.filter((id) => AID[id].stats).map((id) => `<li>${AID[id].name}</li>`)
  return `
    <h1>${run.round > ROUNDS ? 'The final assault' : `Round ${run.round} of ${ROUNDS}`}</h1>
    ${run.battle && run.battle.winner !== 'human' ? `<p class="up">Mission lost: ${REGIONS[run.mission!.region]} gained threat.</p>` : ''}
    <div class="columns">
      <div class="side">
        <h2>Threat now</h2><table>${threat.join('')}</table>
        <h2>Squad</h2><ul>${squad.join('')}</ul>
        ${tech.length > 0 ? `<h2>Alien tech</h2><ul>${tech.join('')}</ul>` : ''}
      </div>
      <div>
        <h2>1. Build your base · <b class="supplies">${run.supplies} ${run.supplies === 1 ? 'supply' : 'supplies'}</b></h2>
        <div class="facilities">${(Object.keys(FACILITIES) as FacilityId[]).map((id) => facilityButton(run, id)).join('')}</div>
        <h2>2. ${run.missions.length > 1 ? 'Aliens strike three regions. Answer one; hover to see what it leads to.' : 'One mission. It must be won.'}</h2>
        <div class="choices">${run.missions.map((mission, index) => missionButton(run, mission, index)).join('')}</div>
      </div>
    </div>`
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

  canvas.addEventListener('click', (e) => {
    const box = canvas.getBoundingClientRect()
    act({ type: 'deploy', ...tileAt(e.clientX - box.left, e.clientY - box.top) })
  })
  start.addEventListener('click', () => act({ type: 'start' }))
  overlay.addEventListener('click', (e) => {
    const target = (e.target as HTMLElement).closest('button')
    if (target?.id === 'again') location.href = location.pathname
    else if (target?.dataset.action && !target.disabled) act(JSON.parse(target.dataset.action))
  })

  return {
    update(run) {
      statusLine.textContent = status(run)
      start.hidden = run.phase !== 'battle' || run.battle?.phase !== 'deploy'
      overlay.innerHTML = panel(run)
      overlay.hidden = run.phase === 'battle'
    },
  }
}
