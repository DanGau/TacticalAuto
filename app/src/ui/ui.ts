import type { Action } from '../core/apply'
import type { Report, Run } from '../core/run'
import type { View } from '../view/view'
import { runEnd, stopReport } from './aftermath'
import { ALIENS, type AlienKind } from '../core/aliens'
import { STOP_NAMES } from './html'
import { overworld, type Picking, type Tab } from './overworld'

const SIDE = { human: 'Humans', alien: 'Aliens' }

export interface Ui {
  /** Shows `run` in the status line and the panel. */
  update(run: Run): void
}

/** What the squad faces: each pod by name with its members, then what each kind present does. */
function roster(run: Run): string {
  const battle = run.battle!
  const aliens = battle.units.filter((u) => u.side === 'alien')
  const pods = battle.pods.map((pod, index) => {
    const members = aliens.filter((u) => u.pod === index)
    const names = [...new Set(members.map((u) => (u.boss ? 'Boss' : ALIENS[u.kind!].name)))]
    const counted = names.map((name) => {
      const count = members.filter((u) => (u.boss ? 'Boss' : ALIENS[u.kind!].name) === name).length
      return count === 1 ? name : `${count} ${name}s`
    })
    return `<div><b>${pod.name}:</b> ${counted.join(', ')}</div>`
  })
  const kinds = [...new Set(aliens.filter((u) => !u.boss).map((u) => u.kind!))] as AlienKind[]
  const rules = kinds.map((kind) => `<div><b>${ALIENS[kind].name}.</b> ${ALIENS[kind].text}.</div>`)
  if (aliens.some((u) => u.boss)) rules.unshift('<div><b>Boss.</b> Tough and armored, hits hard and far, and spawns swarmlings.</div>')
  return `${pods.join('')}<hr>${rules.join('')}<hr><div>The squad lands unseen. The first pod it sights is ambushed: caught in the open, and easier to hit.</div>`
}

function status(run: Run): string {
  const battle = run.battle
  if (run.phase !== 'battle' || !battle) return ''
  const title = STOP_NAMES[run.mission!.kind]
  if (battle.phase === 'deploy') return `${title} · click a landing zone<div class="roster">${roster(run)}</div>`
  return `${title} · ${SIDE[battle.turn]}' turn${battle.concealed ? ' · unseen' : ''}`
}

/** Turns clicks into actions and hands them to `act`. */
export function createUi(view: View, act: (action: Action) => void): Ui {
  const statusLine = document.getElementById('status')!
  const overlay = document.getElementById('panel')!
  /** The report the player has continued past. */
  let seen: Report | null = null
  let tab: Tab = 'Map'
  let picking: Picking | null = null
  let shown: Run | null = null
  let html = ''

  /**
   * The panel for where the player is. After a stop comes its report: for a won battle it ends when aid is taken,
   * otherwise at Continue. Then the overworld, opened on the base after a battle.
   */
  function panel(run: Run): string {
    const report = run.report
    if (run.phase === 'battle') return ''
    if (run.phase === 'won' || run.phase === 'lost') return runEnd(run)
    if (run.phase === 'reward') {
      seen = report
      tab = 'Base'
      return stopReport(run, report!)
    }
    if (report && seen !== report) {
      if (report.soldiers.length > 0) tab = 'Base'
      return stopReport(run, report)
    }
    return overworld(run, tab, picking)
  }

  function render(run: Run): void {
    shown = run
    const next = panel(run)
    // Rewriting unchanged content would restart its animations.
    if (next !== html) overlay.innerHTML = html = next
    overlay.hidden = run.phase === 'battle'
  }

  view.canvas.addEventListener('click', (e) => {
    const zone = view.zoneAt(e.offsetX, e.offsetY)
    if (zone !== null) act({ type: 'land', zone })
  })
  overlay.addEventListener('click', (e) => {
    const target = (e.target as HTMLElement).closest('button')
    if (!target || target.disabled) return
    if (target.id === 'again') location.href = location.pathname
    else if (target.dataset.seen) seen = shown!.report
    else if (target.dataset.tab) tab = target.dataset.tab as Tab
    else if (target.dataset.pick) {
      const pick: Picking = JSON.parse(target.dataset.pick)
      // Clicking what is open closes it.
      picking = picking?.soldier === pick.soldier && picking.part === pick.part ? null : pick
    } else if (target.dataset.action) {
      const action: Action = JSON.parse(target.dataset.action)
      // Choosing a skill keeps the soldier's details open, to show it learned and the next choice if one is owed.
      if (action.type !== 'skill') picking = null
      act(action)
      return
    }
    render(shown!)
  })

  return {
    update(run) {
      statusLine.innerHTML = status(run)
      render(run)
    },
  }
}
