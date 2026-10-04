import type { Action } from '../core/apply'
import { RANK_NAMES, rank, REGIONS, ROUNDS, THREAT_MAX, type Mission, type Run } from '../core/run'
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

function missionButton(mission: Mission, index: number): string {
  const stakes = mission.kind === 'strike' ? (mission.hard ? 'rare aid guaranteed' : 'common aid likely') : 'lose this and the run ends'
  return button({ type: 'mission', index }, `<b>${missionTitle(mission)}</b><br>${mission.aliens} aliens · ${stakes}`, mission.kind)
}

function upgradeCard(id: UpgradeId, index: number): string {
  const { name, rarity, text } = UPGRADES[id]
  return button({ type: 'pick', index }, `<small>${rarity}</small><br><b>${name}</b><br>${text}`, `card ${rarity}`)
}

function mapPanel(run: Run): string {
  const threat = REGIONS.map((name, i) => `<tr><td>${name}</td><td class="threat">${'■'.repeat(run.threat[i])}${'□'.repeat(THREAT_MAX - run.threat[i])}</td></tr>`)
  const squad = run.soldiers.map((s) => `<li>${RANK_NAMES[rank(s)]} ${s.name}</li>`)
  const held = [...new Set(run.upgrades)].map((id) => `<li>${UPGRADES[id].name} ×${run.upgrades.filter((u) => u === id).length}</li>`)
  return `
    <h1>${run.round > ROUNDS ? 'The final assault' : `Round ${run.round} of ${ROUNDS}`}</h1>
    ${run.battle && run.battle.winner !== 'human' ? `<p class="lost">Mission lost: ${REGIONS[run.mission!.region]} gains threat.</p>` : ''}
    <div class="columns">
      <div><h2>Threat</h2><table>${threat.join('')}</table></div>
      <div><h2>Squad</h2><ul>${squad.join('')}</ul></div>
      <div><h2>Base</h2><ul>${held.join('') || '<li>No upgrades</li>'}</ul></div>
    </div>
    <h2>${run.missions.length > 1 ? 'Aliens strike three regions. Answer one; the others gain threat.' : 'One mission. It must be won.'}</h2>
    <div class="choices">${run.missions.map(missionButton).join('')}</div>`
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
