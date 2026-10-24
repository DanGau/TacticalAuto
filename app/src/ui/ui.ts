import type { Action } from '../core/apply'
import type { Report, Run } from '../core/run'
import type { View } from '../view/view'
import { choice, runEnd, stopReport } from './aftermath'
import { ALIENS, type AlienKind } from '../core/aliens'
import { BOONS, distance, heightAt, zoneInfo, type Battle } from '../core/battle'
import { KEYWORDS } from '../core/keywords'
import { GOALS, HOLD_ROUNDS } from '../core/goals'
import { alienName, button, describe, resistChip, STOP_NAMES, tip } from './html'
import { overworld, type Tab } from './overworld'

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
  const boss = aliens.find((u) => u.boss)
  const rules = [...(boss ? [`${tip('Boss', 'Tough and armored, hits hard and far, and spawns swarmlings')}${boss.resists.map(resistChip).join('')}`] : []), ...kinds.map((kind) => alienName(kind))]
  return `${pods.join('')}<hr><div>${rules.join(' · ')}</div><hr><div>${tip('Land unseen', 'The first pod the squad sights is ambushed: caught in the open, and easier to hit')}</div>`
}

function status(run: Run): string {
  const battle = run.battle
  if (run.phase !== 'battle' || !battle) return ''
  const mission = run.mission!
  const title = mission.kind === 'battle' ? `${GOALS[mission.goal].name}: ${GOALS[mission.goal].text}` : STOP_NAMES[mission.kind]
  if (battle.phase === 'deploy') return `${title}<div class="roster">${roster(run)}</div>`
  const rounds = battle.goal === 'hold' ? ` · round ${Math.min(battle.round, HOLD_ROUNDS)} of ${HOLD_ROUNDS}` : ''
  return `${title}${rounds} · ${SIDE[battle.turn]}' turn${battle.concealed ? ' · unseen' : ''}`
}

const ZONE_NAMES = 'ABC'

/** A landing zone's pros, in green, and cons, in red. */
function tradeoffs(battle: Battle, zone: number): string {
  const tile = battle.zones[zone]
  const { cover, contact } = zoneInfo(battle, tile)
  const line = (good: boolean, text: string) => `<div class="${good ? 'pro' : 'con'}">${good ? '+' : '−'} ${text}</div>`
  const lines = [
    cover >= 12 ? line(true, 'Heavy cover to land behind') : cover >= 5 ? '' : line(false, 'Open ground: the squad lands exposed'),
    heightAt(battle, tile) > 0 ? line(true, 'High ground: sees farther and shoots down at aliens') : '',
  ]
  if (battle.uplink) {
    const far = distance(tile, battle.uplink)
    lines.push(far <= 8 ? line(true, `Uplink ${far} tiles away: a short run to hold it`) : line(false, `Uplink ${far} tiles away: a long run before the waves`))
  } else lines.push(contact <= 6 ? line(false, `Aliens ${contact} tiles away: the fight starts at once`) : line(true, `Aliens ${contact} tiles away: time to spread out first`))
  return lines.join('')
}

/** Before the landing: a button per zone that flies the camera there, one back to the whole map, and the chosen zone's case. */
function drop(battle: Battle, zone: number | null): string {
  const zones = battle.boons.map((boon, i) => `<button data-zone="${i}" class="${i === zone ? 'on' : ''}">${ZONE_NAMES[i]} ${KEYWORDS[boon].icon} ${BOONS[boon].name}</button>`)
  const overview = `<button data-zone="" class="overview ${zone === null ? 'on' : ''}" title="Whole map">🗺️</button>`
  const detail =
    zone === null
      ? '<small>Pick a landing zone to fly to it.</small>'
      : `<div class="described"><b>${KEYWORDS[battle.boons[zone]].icon} ${BOONS[battle.boons[zone]].name}:</b> ${describe(BOONS[battle.boons[zone]].text)}</div>${tradeoffs(battle, zone)}${button({ type: 'land', zone }, `Land at ${ZONE_NAMES[zone]}`)}`
  return `<div class="zones">${zones.join('')}${overview}</div>${detail}`
}

/** Turns clicks into actions and hands them to `act`. */
export function createUi(view: View, act: (action: Action) => void): Ui {
  const statusLine = document.getElementById('status')!
  const overlay = document.getElementById('panel')!
  const dropPanel = document.getElementById('drop')!
  /** The landing zone chosen in the deploy phase, and the battle it was chosen in. */
  let zone: number | null = null
  let zoneBattle: Battle | null = null
  /** The report the player has continued past. */
  let seen: Report | null = null
  let tab: Tab = 'Map'
  /** The soldier opened in the Barracks. */
  let open: number | null = null
  let shown: Run | null = null
  let html = ''

  /**
   * The panel for where the player is. After a stop comes its report: it ends when its last choice is made,
   * or at Continue if it left none. Then the overworld, opened on the base after a battle.
   */
  function panel(run: Run): string {
    const report = run.report
    if (run.phase === 'battle') return ''
    if (run.phase === 'won' || run.phase === 'lost') return runEnd(run)
    if (run.phase === 'reward') {
      seen = report
      // After a stop the squad returns to the base; the run's first choice leaves it on the map.
      if (report) tab = 'Base'
      return report ? stopReport(run, report) : choice(run)
    }
    if (report && seen !== report) {
      if (report.soldiers.length > 0) tab = 'Base'
      return stopReport(run, report)
    }
    return overworld(run, tab, open)
  }

  function render(run: Run): void {
    shown = run
    const next = panel(run)
    // Rewriting unchanged content would restart its animations.
    if (next !== html) overlay.innerHTML = html = next
    overlay.hidden = run.phase === 'battle'
  }

  function showDrop(run: Run): void {
    const battle = run.phase === 'battle' && run.battle?.phase === 'deploy' ? run.battle : null
    dropPanel.hidden = !battle
    if (!battle) return
    if (battle !== zoneBattle) {
      zoneBattle = battle
      zone = null
    }
    dropPanel.innerHTML = drop(battle, zone)
  }

  function choose(next: number | null): void {
    zone = next
    view.focus(zone)
    showDrop(shown!)
  }

  view.canvas.addEventListener('click', (e) => {
    const at = view.zoneAt(e.offsetX, e.offsetY)
    if (at !== null) choose(at)
  })
  dropPanel.addEventListener('click', (e) => {
    const target = (e.target as HTMLElement).closest('button')
    if (!target) return
    if (target.dataset.action) act(JSON.parse(target.dataset.action) as Action)
    else choose(target.dataset.zone ? Number(target.dataset.zone) : null)
  })
  overlay.addEventListener('click', (e) => {
    const target = (e.target as HTMLElement).closest('button')
    if (!target || target.disabled) return
    if (target.id === 'again') location.href = location.pathname
    else if (target.dataset.seen) seen = shown!.report
    else if (target.dataset.tab) tab = target.dataset.tab as Tab
    else if (target.dataset.open) {
      // Clicking the soldier open closes it.
      const id = Number(target.dataset.open)
      open = open === id ? null : id
    } else if (target.dataset.action) {
      act(JSON.parse(target.dataset.action) as Action)
      return
    }
    render(shown!)
  })

  return {
    update(run) {
      statusLine.innerHTML = status(run)
      render(run)
      showDrop(run)
    },
  }
}
