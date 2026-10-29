import type { Action } from '../core/apply'
import type { Report, Run } from '../core/run'
import type { View } from '../view/view'
import { choice, runEnd, stopReport } from './aftermath'
import { ALIENS } from '../core/aliens'
import { RELICS, type Relic } from '../core/relics'
import { known } from './intro'
import { TWISTS } from '../core/twists'
import { onTheWay, PLANS, TEAMS, ZONE_NAMES, type Battle, type Unit } from '../core/battle'
import { GOALS, HOLD_ROUNDS } from '../core/goals'
import { DETECT, PATROL_DETECT } from '../core/sight'
import { alienName, button, resistChip, STOP_NAMES, tip } from './html'
import { overworld, type Tab } from './overworld'
import { drawTrails } from './trails'

const SIDE = { human: 'Humans', alien: 'Aliens' }

export interface Ui {
  /** Shows `run` in the status line and the panel. */
  update(run: Run): void
}

/**
 * What the squad faces: each pod by name with its members, then what each kind present does. A pod with a kind the
 * player has not met is an unknown contact, unless the squad has a recon uplink.
 */
function roster(run: Run): string {
  const battle = run.battle!
  const aliens = battle.units.filter((u) => u.side === 'alien')
  const recon = run.relics.some((id) => (RELICS[id] as Relic).recon)
  const pods = battle.pods.map((pod, index) => {
    const members = aliens.filter((u) => u.pod === index)
    if (!recon && members.some((u) => !known(u.kind!))) return `<div><b>Unknown contact:</b> ${members.length}</div>`
    const names = [...new Set(members.map((u) => (u.boss ? 'Boss' : ALIENS[u.kind!].name)))]
    const counted = names.map((name) => {
      const count = members.filter((u) => (u.boss ? 'Boss' : ALIENS[u.kind!].name) === name).length
      return count === 1 ? name : `${count} ${name}s`
    })
    return `<div><b>${pod.name}:</b> ${counted.join(', ')}</div>`
  })
  const kinds = [...new Set(aliens.filter((u) => !u.boss).map((u) => u.kind!))].filter((kind) => recon || known(kind))
  const boss = aliens.find((u) => u.boss)
  const rules = [...(boss ? [`${tip('Boss', 'Tough and armored, hits hard and far, and spawns swarmlings')}${boss.resists.map(resistChip).join('')}`] : []), ...kinds.map((kind) => alienName(kind))]
  return `${pods.join('')}<hr><div>${rules.join(' · ')}</div><hr><div>${tip('Stealth', `Soldiers notice an unseen alien within ${DETECT} tiles; a patrol notices a soldier within ${PATROL_DETECT}. Cover and holding still shrink that reach; high ground stretches it. Whoever notices first ambushes: a caught pod is easier to hit, and a pod that notices the squad first stalks it unseen and opens fire with the same bonus. Once every alert alien is dead, the squad is unseen again`)}</div>`
}

function status(run: Run): string {
  const battle = run.battle
  if (run.phase !== 'battle' || !battle) return ''
  const mission = run.mission!
  const title = mission.kind === 'battle' || mission.kind === 'escape' ? `${GOALS[mission.goal].name}: ${GOALS[mission.goal].text}` : STOP_NAMES[mission.kind]
  if (battle.phase === 'deploy') return `${title}<div class="roster">${roster(run)}</div>`
  const rounds = battle.goal === 'hold' ? ` · held ${Math.min(battle.held, HOLD_ROUNDS)} of ${HOLD_ROUNDS} rounds` : battle.escape ? ` · ${battle.escaped} lifted off` : ''
  return `${title}${rounds} · ${SIDE[battle.turn]}' turn${battle.concealed ? ' · unseen' : ''}`
}

/** Before the landing: a button per zone that flies the camera there, one back to the whole map, and the chosen zone's plan. */
function drop(battle: Battle, zone: number | null, teams: number, greed: number): string {
  if (battle.start) return escapes(battle, zone)
  if (battle.goal === 'rescue') return splits(battle, teams)
  if (battle.goal === 'raid') return raids(battle, greed)
  const zones = battle.plans.map((plan, i) => `<button data-zone="${i}" class="${i === zone ? 'on' : ''}">${ZONE_NAMES[i]} ${PLANS[plan].icon} ${PLANS[plan].name}</button>`)
  const overview = `<button data-zone="" class="overview ${zone === null ? 'on' : ''}" title="Whole map">🗺️</button>`
  const detail =
    zone === null
      ? '<small>Pick a landing zone to fly to it.</small>'
      : `<p>${PLANS[battle.plans[zone]].text}.</p>${button({ type: 'land', zone }, `Land at ${ZONE_NAMES[zone]}`)}`
  const twist = battle.twist ? `<p>${TWISTS[battle.twist].icon} <b>${TWISTS[battle.twist].name}.</b> ${TWISTS[battle.twist].text}.</p>` : ''
  return `${twist}<div class="zones">${zones.join('')}${overview}</div>${detail}`
}

/** On a raid: a button per number of caches to go for, then what that pays and costs. */
function raids(battle: Battle, greed: number): string {
  const buttons = battle.caches.map((_, i) => `<button data-greed="${i + 1}" class="${i + 1 === greed ? 'on' : ''}">📦 ${i + 1}</button>`)
  const what = greed === 1 ? 'Grab the nearest cache and lift off.' : `Grab ${greed} caches before lifting off: ${greed} times the supplies, and ${greed - 1} more threat.`
  return `<div class="zones">${buttons.join('')}</div><p>${what}</p>${button({ type: 'grab', caches: greed }, `Go for ${greed}`)}`
}

/** The ways a rescue can split a squad of `size`: together, in two teams, or each alone. */
const splitsOf = (size: number) => [...new Set([1, 2, Math.min(TEAMS, size)])].filter((n) => n <= size)

/** On a rescue: a button per way to split the squad, then the chosen split's teams and where they land. */
function splits(battle: Battle, teams: number): string {
  const size = battle.reserve.length
  const name = (n: number) => (n === 1 ? 'Stay together' : n === size ? 'Split up' : `${n} teams`)
  const buttons = splitsOf(size).map((n) => `<button data-split="${n}" class="${n === teams ? 'on' : ''}">${name(n)}</button>`)
  const members = Array.from({ length: teams }, (_, t) => battle.reserve.filter((_, i) => i % teams === t).length)
  const what =
    teams === 1
      ? 'The squad lands as one. Safest, but slow to reach civilians spread across the map.'
      : `${members.join(' + ')}: each team lands apart and makes for the civilians nearest it. More are reached, but a small team is easy prey.`
  return `<div class="zones">${buttons.join('')}</div><p>${what}</p>${button({ type: 'split', teams }, teams === 1 ? 'Land together' : teams === size ? 'Land split up' : `Land in ${teams} teams`)}`
}

/** On an escape: a button per escape zone, then the chosen one's aliens on the way. */
function escapes(battle: Battle, zone: number | null): string {
  const zones = battle.zones.map((_, i) => `<button data-zone="${i}" class="${i === zone ? 'on' : ''}">${ZONE_NAMES[i]} 🚁 ${onTheWay(battle, battle.zones[i]).length} aliens</button>`)
  const overview = `<button data-zone="" class="overview ${zone === null ? 'on' : ''}" title="Whole map">🗺️</button>`
  const kinds = (aliens: Unit[]) => {
    const count = new Map<string, number>()
    for (const u of aliens) {
      const name = u.boss ? 'the Hunter' : ALIENS[u.kind!].name
      count.set(name, (count.get(name) ?? 0) + 1)
    }
    return [...count].map(([name, n]) => `${n} ${name}`).join(', ') || 'none'
  }
  const detail =
    zone === null
      ? '<small>The squad is ambushed. Pick the way out.</small>'
      : `<p>On the way: ${kinds(onTheWay(battle, battle.zones[zone]))}.</p>${button({ type: 'land', zone }, `Break out toward ${ZONE_NAMES[zone]}`)}`
  return `<div class="zones">${zones.join('')}${overview}</div>${detail}`
}

/** Turns clicks into actions and hands them to `act`. */
export function createUi(view: View, act: (action: Action) => void): Ui {
  const statusLine = document.getElementById('status')!
  const overlay = document.getElementById('panel')!
  const dropPanel = document.getElementById('drop')!
  /** The landing zone chosen in the deploy phase, and the battle it was chosen in. */
  let zone: number | null = null
  /** The teams chosen to split a rescue's squad into, and the caches chosen to go for on a raid. */
  let teams = 1
  let greed = 1
  let zoneBattle: Battle | null = null
  /** The report the player has continued past. */
  let seen: Report | null = null
  let tab: Tab = 'Map'
  /** The soldier opened in the Barracks. */
  let open: number | null = null
  /** The stop ahead the player clicked to look at, before setting out for it. */
  let picked: number | null = null
  /** How the player picked to settle the find on screen, before confirming. */
  let gear: 'keep' | 'sell' | null = null
  let shown: Run | null = null
  let html = ''

  /** The run's phase when the panel was last drawn. */
  let phase: Run['phase'] | null = null

  /**
   * The panel for where the player is. After a stop come its choices, one screen each, then its summary until
   * Continue. Then the overworld.
   */
  function panel(run: Run): string {
    const report = run.report
    if (run.phase === 'battle') return ''
    if (run.phase === 'won' || run.phase === 'lost') return runEnd(run)
    if (run.phase === 'reward') return `${report ? `<small>${STOP_NAMES[report.stop]}${report.soldiers.length > 0 ? (report.won ? ' won' : ' lost') : ''}</small>` : ''}${choice(run, gear)}`
    if (run.phase === 'shop' || run.phase === 'event') {
      // Arriving shows the shop or event; the other tabs stay open to the player while they decide.
      if (phase !== run.phase) tab = 'Map'
      phase = run.phase
      return overworld(run, tab, open, picked)
    }
    phase = run.phase
    if (report && seen !== report) {
      return stopReport(run, report)
    }
    return overworld(run, tab, open, picked)
  }

  function render(run: Run): void {
    shown = run
    const next = panel(run)
    // Rewriting unchanged content would restart its animations.
    if (next !== html) {
      overlay.innerHTML = html = next
      const map = overlay.querySelector('.map')
      if (map) drawTrails(map)
      overlay.querySelector('.map .here, .map .option')?.scrollIntoView({ block: 'center', inline: 'nearest' })
    }
    overlay.hidden = run.phase === 'battle'
  }

  function showDrop(run: Run): void {
    const battle = run.phase === 'battle' && run.battle?.phase === 'deploy' ? run.battle : null
    dropPanel.hidden = !battle
    if (!battle) return
    if (battle !== zoneBattle) {
      zoneBattle = battle
      zone = null
      teams = 1
      greed = 1
      view.showTeams(teams)
    }
    dropPanel.innerHTML = drop(battle, zone, teams, greed)
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
    else if (target.dataset.greed) {
      greed = Number(target.dataset.greed)
      showDrop(shown!)
    } else if (target.dataset.split) {
      teams = Number(target.dataset.split)
      view.showTeams(teams)
      showDrop(shown!)
    } else choose(target.dataset.zone ? Number(target.dataset.zone) : null)
  })
  overlay.addEventListener('click', (e) => {
    const target = (e.target as HTMLElement).closest('button')
    if (!target || target.disabled) return
    if (target.id === 'again') location.href = location.pathname
    else if (target.dataset.seen) seen = shown!.report
    else if (target.dataset.tab) tab = target.dataset.tab as Tab
    else if (target.dataset.pick) picked = Number(target.dataset.pick)
    else if (target.dataset.gear) gear = target.dataset.gear as 'keep' | 'sell'
    else if (target.dataset.open) {
      // Clicking the soldier open closes it.
      const id = Number(target.dataset.open)
      open = open === id ? null : id
    } else if (target.dataset.action) {
      picked = null
      gear = null
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
