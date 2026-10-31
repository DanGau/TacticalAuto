// The UI shell: renders the panel for the run's phase and turns clicks into actions.
import { recruits, story, title } from './menu'
import type { Action } from '../core/apply'
import { nextStop } from '../core/run'
import { type Run } from '../core/run-state'
import { type Report } from '../core/run-state'
import { skillOffers } from '../core/squad'
import type { View } from '../view/view'
import { choice, joined, loot, modal, runEnd, skillChoice, stopReport } from './aftermath'
import { TWISTS } from '../core/twists'
import { ZONE_NAMES, type Battle } from '../core/battle'
import { STRIKE } from '../core/setup'
import { PLANS } from '../core/setup'
import { GOALS, HOLD_ROUNDS } from '../core/goals'
import { button, STOP_NAMES } from './html'
import { canUse } from '../core/apply'
import { CONSUMABLES, KIT_SLOTS } from '../core/consumables'
import { overworld, type Tab } from './overworld'
import { glide, viewNow } from './globe'

/** How long the helicopter takes to fly between stops, in milliseconds. */
const FLIGHT_MS = 1100

export interface Ui {
  /** Shows `run` in the status line and the panel. */
  update(run: Run): void
}

function status(run: Run): string {
  const battle = run.battle
  if (run.phase !== 'battle' || !battle) return ''
  const mission = run.mission!
  const title = mission.kind === 'battle' || mission.kind === 'ambush' || mission.kind === 'recovery' ? `${GOALS[mission.goal].name}: ${GOALS[mission.goal].text}` : STOP_NAMES[mission.kind]
  if (battle.phase === 'deploy') return title
  const rounds = battle.extract ? ` · ${battle.escaped.length} lifted off` : battle.goal === 'hold' ? ` · held ${Math.min(battle.held, HOLD_ROUNDS)} of ${HOLD_ROUNDS} rounds` : ''
  const vip = battle.vip ? ` · the VIP ${{ held: 'held', breached: 'held', freed: 'with the squad', out: 'lifted off' }[battle.vip]}` : ''
  return `${title}${vip}${rounds}`
}

/** Before the landing: a button per zone that flies the camera there, one back to the whole map, and the chosen zone's plan. */
function drop(battle: Battle, zone: number | null, greed: number): string {
  if (battle.goal === 'raid') return raids(battle, greed)
  const barrage = (i: number) => (i === battle.barrage ? '💥 Barrage' : '')
  const zones = battle.plans.map((plan, i) => `<button data-zone="${i}" class="${i === zone ? 'on' : ''}">${[ZONE_NAMES[i], PLANS[plan].icon, PLANS[plan].name, barrage(i)].filter(Boolean).join(' ')}</button>`)
  const overview = `<button data-zone="" class="overview ${zone === null ? 'on' : ''}" title="Whole map">🗺️</button>`
  const strike = `<p>An artillery strike softens the pod in front: each alien -${STRIKE.damage} health. <span class="up">+${STRIKE.threat} threat</span>.</p>`
  const detail =
    zone === null
      ? '<small>Pick a landing zone to fly to it.</small>'
      : `${PLANS[battle.plans[zone]].text ? `<p>${PLANS[battle.plans[zone]].text}.</p>` : ''}${zone === battle.barrage ? strike : ''}${button({ type: 'land', zone }, `Land at ${ZONE_NAMES[zone]}`)}`
  const twist = battle.twist ? `<p>${TWISTS[battle.twist].icon} <b>${TWISTS[battle.twist].name}.</b> ${TWISTS[battle.twist].text}.</p>` : ''
  return `${twist}<div class="zones">${zones.join('')}${overview}</div>${detail}`
}

/** On a raid: a button per number of caches to go for, then what that pays and costs. */
function raids(battle: Battle, greed: number): string {
  const buttons = battle.caches.map((_, i) => `<button data-greed="${i + 1}" class="${i + 1 === greed ? 'on' : ''}">📦 ${i + 1}</button>`)
  const what = greed === 1 ? 'Grab the nearest cache and lift off.' : `Grab ${greed} caches before lifting off: ${greed} times the supplies, and ${greed - 1} more threat.`
  return `<div class="zones">${buttons.join('')}</div><p>${what}</p>${button({ type: 'grab', caches: greed }, `Go for ${greed}`)}`
}

/**
 * The consumables carried into a battle, a slot each: one usable now uses it at a click; one readied on the landing
 * screen waits, lit, for the landing.
 */
function kit(run: Run): string {
  const battle = run.battle!
  const readied = battle.primed.map((id) => `<button class="primed" disabled title="${CONSUMABLES[id].text}">${CONSUMABLES[id].icon} ${CONSUMABLES[id].name}<small>${battle.phase === 'deploy' ? 'on landing' : 'now'}</small></button>`)
  const held = run.kit.map((id, index) => {
    const item = CONSUMABLES[id]
    const usable = canUse(run, index)
    const when = !usable ? 'once aliens are in the fight' : battle.phase === 'deploy' ? 'ready for the landing' : 'use now'
    return button({ type: 'use', index }, `${item.icon} ${item.name}<small>${when}${item.threat ? ` · +${item.threat} threat` : ''}</small>`, '', usable).replace('<button', `<button title="${item.text}"`)
  })
  const empty = Array.from({ length: Math.max(0, KIT_SLOTS - readied.length - held.length) }, () => '<button class="empty" disabled>Empty slot</button>')
  return [...readied, ...held, ...empty].join('')
}

/** Turns clicks into actions and hands them to `act`. */
export function createUi(view: View, act: (action: Action) => void): Ui {
  const statusLine = document.getElementById('status')!
  const overlay = document.getElementById('panel')!
  const dropPanel = document.getElementById('drop')!
  const kitPanel = document.getElementById('kit')!
  let kitHtml = ''
  kitPanel.addEventListener('click', (e) => {
    const target = (e.target as HTMLElement).closest('button')
    if (target?.dataset.action && !target.disabled) act(JSON.parse(target.dataset.action) as Action)
  })
  /** The landing zone chosen in the deploy phase, and the battle it was chosen in. */
  let zone: number | null = null
  /** The caches chosen to go for on a raid. */
  let greed = 1
  let zoneBattle: Battle | null = null
  /** The report the player has continued past. */
  let seen: Report | null = null
  let tab: Tab = 'Map'
  /** The soldier opened in the Barracks. */
  let open: number | null = null
  /** The stop ahead the player clicked to look at, before setting out for it. */
  let picked: number | null = null
  let shown: Run | null = null
  /** Whether the player has left the title screen, and the recruit picked before confirming. */
  let started = false
  /** Whether the story has been told, before the first choice. */
  let told = false
  let recruit: number | null = null
  /** The report whose joining hero has been met, and the soldier whose skill choice is open. */
  let met: Report | null = null
  let ability: number | null = null
  /** The debrief shown, whether a pop-up has been over it, and the crate open now, by index into run.finds. */
  let opened: { report: Report | null; still: boolean } = { report: null, still: false }
  let crate: number | null = null
  let html = ''

  /** The run's phase when the panel was last drawn. */
  let phase: Run['phase'] | null = null

  /**
   * The panel for where the player is. After a stop come its choices, one screen each, then its summary until
   * Continue. Then the overworld.
   */
  function panel(run: Run): string {
    const report = run.report
    if (run.phase === 'recruit') return !started ? title() : !told ? story() : recruits(run, recruit)
    if (run.phase === 'battle') return ''
    if (run.phase === 'won' || run.phase === 'lost') return runEnd(run)
    // After a fight: a hero joining, then the debrief, where each soldier owed a skill chooses it, then the rewards.
    if (report && seen !== report && report.soldiers.length > 0) {
      if (report.hired && met !== report) return joined(run, report.hired)
      if (opened.report !== report) opened = { report, still: false }
      const learner = run.soldiers.find((s) => s.id === ability && skillOffers(s).length > 0)
      const find = crate !== null && run.finds[crate] ? crate : null
      // A pop-up opened over it leaves the debrief at rest behind: nothing in it plays again.
      if (learner || find !== null) opened.still = true
      const debrief = stopReport(run, report, opened.still)
      return learner ? debrief + modal(skillChoice(run, learner)) : find !== null ? debrief + loot(run, find) : debrief
    }
    if (run.phase === 'reward') return `${report ? `<small>${STOP_NAMES[report.stop]}${report.soldiers.length > 0 ? (report.won ? ' won' : ' lost') : ''}</small>` : ''}${choice(run)}`
    if (run.phase === 'shop' || run.phase === 'event') {
      // Arriving shows the shop or event; the other tabs stay open to the player while they decide.
      if (phase !== run.phase) tab = 'Map'
      phase = run.phase
      return overworld(run, tab, open, picked)
    }
    phase = run.phase
    return report && seen !== report ? stopReport(run, report) : overworld(run, tab, open, picked)
  }

  function render(run: Run): void {
    shown = run
    const from = viewNow()
    const next = panel(run)
    // Rewriting unchanged content would restart its animations.
    if (next !== html) {
      overlay.innerHTML = html = next
      glide(overlay, from)
      overlay.hidden = run.phase === 'battle'
      shrink()
    }
    overlay.hidden = run.phase === 'battle'
  }

  /** Shrinks the panel until its content fits the screen: a game never scrolls. */
  function shrink(): void {
    overlay.style.setProperty('--shrink', '1')
    for (let i = 0; i < 4 && overlay.scrollHeight > overlay.clientHeight + 1; i++) {
      const now = Number(overlay.style.getPropertyValue('--shrink'))
      overlay.style.setProperty('--shrink', String(now * Math.max(0.5, overlay.clientHeight / overlay.scrollHeight)))
    }
  }

  function showDrop(run: Run): void {
    const battle = run.phase === 'battle' && run.battle?.phase === 'deploy' ? run.battle : null
    dropPanel.hidden = !battle
    if (!battle) return
    if (battle !== zoneBattle) {
      zoneBattle = battle
      zone = null
      greed = 1
    }
    dropPanel.innerHTML = drop(battle, zone, greed)
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
    } else choose(target.dataset.zone ? Number(target.dataset.zone) : null)
  })
  addEventListener('resize', () => requestAnimationFrame(shrink))

  /** Sets the squad in to the stop it stands at: a fight dives down through the clouds to it. */
  function setIn(): void {
    const next = nextStop(shown!)
    if (!next) return
    if (next === 'supply' || next === 'cache' || next === 'shop' || next === 'medic') act({ type: 'advance' })
    else dive(() => act({ type: 'advance' }))
  }

  /** How long the dive through the clouds takes, in milliseconds. */
  const DIVE_MS = 1400
  /** Zooms the map down onto the helicopter and through a bank of clouds, then `land`s while the clouds part. */
  function dive(land: () => void): void {
    const chopper = overlay.querySelector<HTMLElement>('.chopper')
    const globe = overlay.querySelector<HTMLElement>('.globe')
    // The stop the helicopter stands over comes to the middle of the screen as the map falls away round it.
    if (globe && chopper) {
      const [x, y] = [chopper.offsetLeft, chopper.offsetTop]
      globe.style.transformOrigin = `${x}px ${y}px`
      globe.classList.add('diving')
      globe.style.transform = `translate(${globe.clientWidth / 2 - x}px, ${globe.clientHeight / 2 - y}px) scale(14)`
    }
    const clouds = document.createElement('div')
    clouds.className = 'clouds'
    clouds.innerHTML = Array.from({ length: 9 }, (_, i) => `<i style="--x:${(i * 37) % 100}%;--y:${(i * 61) % 100}%;--d:${i * 0.07}s"></i>`).join('')
    document.body.append(clouds)
    flying = true
    setTimeout(() => {
      flying = false
      land()
      clouds.classList.add('parting')
      setTimeout(() => clouds.remove(), 1200)
    }, DIVE_MS)
  }

  /** Whether the helicopter is in the air, the map waiting for it to land. */
  let flying = false
  /** Flies the squad's helicopter from where it stands to the stop `to` is pinned at, then `land`s. */
  function fly(to: HTMLElement, land: () => void): void {
    const chopper = overlay.querySelector<HTMLElement>('.chopper')
    const cell = to.closest<HTMLElement>('.cell')
    if (!chopper || !cell) return land()
    flying = true
    const dx = cell.offsetLeft - chopper.offsetLeft
    chopper.classList.toggle('east', dx > 0)
    chopper.classList.add('flying')
    chopper.style.left = cell.style.left
    chopper.style.top = cell.style.top
    setTimeout(() => {
      flying = false
      land()
    }, FLIGHT_MS)
  }
  overlay.addEventListener('click', (e) => {
    const target = (e.target as HTMLElement).closest('button')
    if (!target || target.disabled || flying) return
    if (target.id === 'again') location.href = location.pathname
    else if (target.id === 'start') started = true
    else if (target.id === 'begin' || target.dataset.begin !== undefined) told = true
    else if (target.dataset.recruit) {
      // A city tapped once shows who waits there; tapped again, the run begins there.
      const index = Number(target.dataset.recruit)
      if (recruit !== index) recruit = index
      else return act({ type: 'recruit', index })
    }
    else if (target.dataset.seen) seen = shown!.report
    else if (target.dataset.met) met = shown!.report
    else if (target.dataset.ability) ability = Number(target.dataset.ability)
    else if (target.dataset.crate) crate = Number(target.dataset.crate)
    else if (target.dataset.tab) tab = target.dataset.tab as Tab
    else if (target.dataset.pick) {
      // A stop tapped once is picked to look at; tapped again, the squad sets out for it.
      const index = Number(target.dataset.pick)
      if (picked !== index) picked = index
      // The squad flies there and sets in: a fight dives down through the clouds.
      else return fly(target, () => {
        picked = null
        act({ type: 'go', index })
        setIn()
      })
    }
    else if (target.dataset.in !== undefined) return setIn()
    else if (target.dataset.open) {
      // Clicking the soldier open closes it.
      const id = Number(target.dataset.open)
      open = open === id ? null : id
    } else if (target.dataset.action) {
      picked = null
      crate = null
      act(JSON.parse(target.dataset.action) as Action)
      return
    }
    render(shown!)
  })

  const dial = document.getElementById('dial')!
  /** Half turns the dial has made: it only ever spins on, so a swap never jumps back. */
  let halves = 0
  /** Shows whose turn it is on the dial in battle: the sphere turns its half for that side to the front. */
  function turnDial(run: Run): void {
    const battle = run.phase === 'battle' && run.battle?.phase === 'battle' ? run.battle : null
    dial.hidden = !battle
    if (battle && (halves % 2 === 1) !== (battle.turn === 'alien')) dial.style.setProperty('--turn', `${++halves * 180}deg`)
  }

  function showKit(run: Run): void {
    const shown = run.phase === 'battle' && !!run.battle && run.battle.phase !== 'over' && run.kit.length + run.battle.primed.length > 0
    kitPanel.hidden = !shown
    const next = shown ? kit(run) : ''
    if (next !== kitHtml) kitPanel.innerHTML = kitHtml = next
  }

  return {
    update(run) {
      statusLine.innerHTML = status(run)
      showKit(run)
      turnDial(run)
      render(run)
      showDrop(run)
    },
  }
}
