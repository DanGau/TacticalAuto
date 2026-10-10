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

/** The aliens of a battle by kind, as "2 Troopers, 4 Swarmlings", with what each kind does. */
function roster(run: Run): string {
  const aliens = run.battle!.units.filter((u) => u.side === 'alien')
  const kinds = [...new Set(aliens.filter((u) => !u.boss).map((u) => u.kind!))] as AlienKind[]
  const lines = kinds.map((kind) => {
    const count = aliens.filter((u) => u.kind === kind && !u.boss).length
    return `<div><b>${count} ${ALIENS[kind].name}${count === 1 ? '' : 's'}.</b> ${ALIENS[kind].text}.</div>`
  })
  if (aliens.some((u) => u.boss)) lines.unshift('<div><b>A boss.</b> Tough, hits hard and far, and spawns swarmlings.</div>')
  return lines.join('')
}

function status(run: Run): string {
  const battle = run.battle
  if (run.phase !== 'battle' || !battle) return ''
  const title = STOP_NAMES[run.mission!.kind]
  if (battle.phase === 'deploy') return `${title} · click a landing zone<div class="roster">${roster(run)}</div>`
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
      // Clicking what is open closes it.
      picking = picking?.soldier === pick.soldier && picking.part === pick.part ? null : pick
    } else if (target.dataset.action) {
      picking = null
      act(JSON.parse(target.dataset.action))
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
