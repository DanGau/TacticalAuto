import type { Action } from '../core/apply'
import { TUNING } from '../core/tuning'
import type { Report, Run } from '../core/run'
import type { View } from '../view/view'
import { choice, runEnd, stopReport } from './aftermath'
import { ALIENS } from '../core/aliens'
import { RELICS, type Relic } from '../core/relics'
import { known } from './intro'
import { TWISTS } from '../core/twists'
import { AMBUSH_AIM, AMBUSH_CRIT, BOONS, distance, heightAt, IMPACT_REACH, nearestAlien, ZONE_NAMES, zoneInfo, type Battle } from '../core/battle'
import { KEYWORDS } from '../core/keywords'
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
  const title = mission.kind === 'battle' ? `${GOALS[mission.goal].name}: ${GOALS[mission.goal].text}` : STOP_NAMES[mission.kind]
  if (battle.phase === 'deploy') return `${title}<div class="roster">${roster(run)}</div>`
  const rounds = battle.goal === 'hold' ? ` · round ${Math.min(battle.round, HOLD_ROUNDS)} of ${HOLD_ROUNDS}` : ''
  return `${title}${rounds} · ${SIDE[battle.turn]}' turn${battle.concealed ? ' · unseen' : ''}`
}

/** A landing zone's pros, in green, and cons, in red, as short chips; hovering one tells it in full. */
function tradeoffs(battle: Battle, zone: number): string {
  const tile = battle.zones[zone]
  const { cover, contact } = zoneInfo(battle, tile)
  const chip = (good: boolean, label: string, text: string) => `<span class="${good ? 'pro' : 'con'}" title="${text}">${label}</span>`
  const chips = [
    cover >= 12 ? chip(true, '🛡️ Cover', 'Heavy cover to land behind') : cover >= 5 ? '' : chip(false, '🎯 Open', 'Open ground: the squad lands exposed'),
    heightAt(battle, tile) > 0 ? chip(true, '⛰️ High', 'High ground: sees farther and shoots down at aliens') : '',
  ]
  if (zone === battle.hot) {
    const pod = battle.pods[nearestAlien(battle, tile)!.pod!].name
    chips.push(
      chip(true, '☄️ Impact', `Drop pods deal ${TUNING.impactDamage} damage to each alien within ${IMPACT_REACH} tiles`),
      chip(true, '😵 Surprised', `The ${pod} can't shoot its first turn, and the squad's first volley gets +${100 * AMBUSH_AIM}% aim and +${100 * AMBUSH_CRIT}% crit`),
      chip(false, '📣 Loud', 'Every other pod hears the landing and converges on it'),
    )
  } else if (battle.uplink) {
    const far = distance(tile, battle.uplink)
    chips.push(chip(far <= 8, `📡 ${far}`, `Uplink ${far} tiles away: ${far <= 8 ? 'a short run to hold it' : 'a long run before the waves'}`))
  } else chips.push(chip(contact > 6, `👽 ${contact}`, `Aliens ${contact} tiles away: ${contact <= 6 ? 'the fight starts at once' : 'time to spread out first'}`))
  return chips.join('')
}

/** Before the landing: a button per zone that flies the camera there, one back to the whole map, and the chosen zone's boon and case. */
function drop(battle: Battle, zone: number | null): string {
  const zones = battle.boons.map((boon, i) => `<button data-zone="${i}" class="${i === zone ? 'on' : ''}" title="${i === battle.hot ? 'Land on top of a pod' : BOONS[boon].text}">${ZONE_NAMES[i]} ${i === battle.hot ? '☄️ Hot drop' : `${KEYWORDS[boon].icon} ${BOONS[boon].name}`}</button>`)
  const overview = `<button data-zone="" class="overview ${zone === null ? 'on' : ''}" title="Whole map">🗺️</button>`
  const detail =
    zone === null
      ? '<small>Pick a landing zone to fly to it.</small>'
      : `<p>${zone === battle.hot ? 'Land on top of a pod.' : `${BOONS[battle.boons[zone]].text}.`}</p><div class="tradeoffs">${tradeoffs(battle, zone)}</div>${button({ type: 'land', zone }, `Land at ${ZONE_NAMES[zone]}`)}`
  const twist = battle.twist ? `<p>${TWISTS[battle.twist].icon} <b>${TWISTS[battle.twist].name}.</b> ${TWISTS[battle.twist].text}.</p>` : ''
  return `${twist}<div class="zones">${zones.join('')}${overview}</div>${detail}`
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
    if (run.phase === 'reward') return `${report ? `<small>${STOP_NAMES[report.stop]}${report.soldiers.length > 0 ? (report.won ? ' won' : ' lost') : ''}</small>` : ''}${choice(run)}`
    if (run.phase === 'shop' || run.phase === 'event') {
      // Arriving shows the shop or event; the other tabs stay open to the player while they decide.
      if (phase !== run.phase) tab = 'Map'
      phase = run.phase
      return overworld(run, tab, open)
    }
    phase = run.phase
    if (report && seen !== report) {
      return stopReport(run, report)
    }
    return overworld(run, tab, open)
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
