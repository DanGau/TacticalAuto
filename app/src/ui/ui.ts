import type { Action } from '../core/apply'
import { preview, RANK_NAMES, rank, REGIONS, ROUNDS, THREAT_MAX, type Mission, type Run } from '../core/run'
import { UPGRADES, type UpgradeId } from '../core/upgrades'
import { tileAt } from '../view/view'

const SIDE = { human: 'Humans', alien: 'Aliens' }

export interface Ui {
  /** Shows `run` in the status line and the panel. */
  update(run: Run): void
}

const button = (action: Action, label: string, cls = '') => `<button class="${cls}" data-action='${JSON.stringify(action)}'>${label}</button>`

function missionTitle(mission: Mission): string {
  if (mission.kind === 'final') return 'Final assault on the alien ship'
  return `${mission.kind === 'lastStand' ? 'Last stand' : 'Strike'}: ${REGIONS[mission.region]}`
}

const pips = (threat: number) => `<span class="threat">${'■'.repeat(threat)}${'□'.repeat(THREAT_MAX - threat)}</span>`

/** One line per region whose threat `after` changes, marking a region pushed into a last stand. */
function threatChanges(run: Run, after: number[]): string {
  const lines = REGIONS.flatMap((name, i) => {
    if (after[i] === run.threat[i]) return []
    const change = after[i] - run.threat[i]
    const alarm = after[i] === THREAT_MAX ? ' <b class="up">last stand</b>' : ''
    return [`<div>${name} ${pips(after[i])} <span class="${change > 0 ? 'up' : 'down'}">${change > 0 ? '+' : ''}${change}</span>${alarm}</div>`]
  })
  return lines.join('') || '<div>No threat changes</div>'
}

/** A mission choice that states everything choosing it leads to. */
function missionButton(run: Run, mission: Mission, index: number): string {
  const { won, lost } = preview(run, mission)
  const aid = mission.kind === 'final' ? 'Earth is saved' : `take 1 of 3 upgrades${mission.hard ? ', one rare or better' : ''}`
  return button(
    { type: 'mission', index },
    `<b>${missionTitle(mission)}</b><br>${mission.aliens} aliens
    <h3 class="down">If you win</h3>${mission.kind === 'final' ? '' : threatChanges(run, won)}<div>${aid}</div>
    <h3 class="up">If you lose</h3>${lost ? threatChanges(run, lost) : '<div><b class="up">The run ends</b></div>'}`,
    mission.kind,
  )
}

function upgradeCard(id: UpgradeId, index: number): string {
  const { name, rarity, text } = UPGRADES[id]
  return button({ type: 'pick', index }, `<small>${rarity}</small><br><b>${name}</b><br>${text}`, `card ${rarity}`)
}

function mapPanel(run: Run): string {
  const threat = REGIONS.map((name, i) => `<tr><td>${name}</td><td>${pips(run.threat[i])}</td></tr>`)
  const squad = run.soldiers.map((s) => `<li>${RANK_NAMES[rank(s)]} ${s.name}</li>`)
  const held = [...new Set(run.upgrades)].map((id) => `<li>${UPGRADES[id].name} ×${run.upgrades.filter((u) => u === id).length}</li>`)
  return `
    <h1>${run.round > ROUNDS ? 'The final assault' : `Round ${run.round} of ${ROUNDS}`}</h1>
    ${run.battle && run.battle.winner !== 'human' ? `<p class="up">Mission lost: ${REGIONS[run.mission!.region]} gained threat.</p>` : ''}
    <h2>${run.missions.length > 1 ? 'Aliens strike three regions. Answer one.' : 'One mission. It must be won.'}</h2>
    <div class="choices">${run.missions.map((mission, index) => missionButton(run, mission, index)).join('')}</div>
    <div class="columns">
      <div><h2>Threat now</h2><table>${threat.join('')}</table></div>
      <div><h2>Squad</h2><ul>${squad.join('')}</ul></div>
      <div><h2>Base</h2><ul>${held.join('') || '<li>No upgrades</li>'}</ul></div>
    </div>`
}

function panel(run: Run): string {
  switch (run.phase) {
    case 'map':
      return mapPanel(run)
    case 'reward':
      return `<h1>Mission won</h1><h2>${REGIONS[run.mission!.region]} offers aid. Take one.</h2>
        <div class="choices">${run.offers.map(upgradeCard).join('')}</div>`
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
    else if (target?.dataset.action) act(JSON.parse(target.dataset.action))
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
