import type { Action } from '../core/apply'
import type { Report, Run } from '../core/run'
import type { View } from '../view/view'
import { alienAdvance, missionEnd, runEnd, world } from './aftermath'
import { missionTitle } from './html'
import { overworld, type Picking, type Tab } from './overworld'

const SIDE = { human: 'Humans', alien: 'Aliens' }

export interface Ui {
  /** Shows `run` in the status line and the panel. */
  update(run: Run): void
}

function status(run: Run): string {
  const battle = run.battle
  if (run.phase !== 'battle' || !battle) return ''
  const title = missionTitle(run.mission!)
  if (battle.phase === 'deploy') return `${title} · ${run.mission!.aliens} aliens · click a landing zone`
  return `${title} · ${SIDE[battle.turn]}' turn`
}

/** Turns clicks into actions and hands them to `act`. */
export function createUi(view: View, act: (action: Action) => void): Ui {
  const statusLine = document.getElementById('status')!
  const overlay = document.getElementById('panel')!
  /** The report whose screen of each kind the player has continued past. */
  const seen: Record<string, Report | null> = { mission: null, world: null }
  /** The report after which the player has already been brought back to the base. */
  let returned: Report | null = null
  let tab: Tab = 'Map'
  let picking: Picking | null = null
  let shown: Run | null = null
  let html = ''

  /**
   * The panel for where the player is. After a battle comes the mission's end, then the overworld, opened on the
   * base. What the aliens did meanwhile shows when the player first opens the map.
   */
  function panel(run: Run): string {
    const report = run.report
    if (run.phase === 'battle') return ''
    if (run.phase === 'won' || run.phase === 'lost') return runEnd(run)
    if (run.phase === 'reward') return missionEnd(run, report!)
    // A won mission's screen ended when its aid was taken.
    if (report && !report.won && seen.mission !== report) return missionEnd(run, report)
    if (report && returned !== report) {
      returned = report
      tab = 'Base'
    }
    const news = report !== null && seen.world !== report && alienAdvance(run, report).some((n) => n > 0)
    if (news && tab === 'Map') return world(run, report)
    return overworld(run, tab, news, picking)
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
    else if (target.dataset.seen) seen[target.dataset.seen] = shown!.report
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
