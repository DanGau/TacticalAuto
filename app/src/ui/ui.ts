import type { Action } from '../core/apply'
import type { Report, Run } from '../core/run'
import type { View } from '../view/view'
import { runEnd, stopReport } from './aftermath'
import { STOP_NAMES } from './html'
import { overworld, type Picking, type Tab } from './overworld'

const SIDE = { human: 'Humans', alien: 'Aliens' }

export interface Ui {
  /** Shows `run` in the status line and the panel. */
  update(run: Run): void
}

function status(run: Run): string {
  const battle = run.battle
  if (run.phase !== 'battle' || !battle) return ''
  const title = STOP_NAMES[run.mission!.kind]
  if (battle.phase === 'deploy') return `${title} · ${run.mission!.aliens} aliens · click a landing zone`
  return `${title} · ${SIDE[battle.turn]}' turn`
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
      // Clicking the chosen slot again closes it.
      picking = picking?.soldier === pick.soldier && picking.slot === pick.slot ? null : pick
    } else if (target.dataset.action) {
      picking = null
      act(JSON.parse(target.dataset.action))
      return
    }
    render(shown!)
  })

  return {
    update(run) {
      statusLine.textContent = status(run)
      render(run)
    },
  }
}
