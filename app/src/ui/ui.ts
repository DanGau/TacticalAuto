// The UI shell: renders the panel for the run's phase and turns clicks into actions.
import { recruits, story, title } from './menu'
import type { Action } from '../core/apply'
import { nextStop } from '../core/run'
import { type Run } from '../core/run-state'
import { type Report } from '../core/run-state'
import { skillOffers } from '../core/squad'
import { choice, joined, loot, modal, runEnd, skillChoice, spareChoice, stopReport } from './aftermath'
import { TWISTS } from '../core/twists'
import { CHALLENGES } from '../core/challenges'
import { type Battle } from '../core/battle'
import { ENTRANCE_KINDS } from '../core/entrances'
import { GOALS, HOLD_ROUNDS } from '../core/goals'
import { button, STOP_NAMES } from './html'
import { fuelTanks } from '../core/objects'
import { UTILITIES } from '../core/utilities'
import { pickCard, pickDetail, utilityPick, type Pick } from './cards'
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
  const clock = battle.deadline !== null && battle.round < battle.deadline ? ` · reinforcements in ${battle.deadline - battle.round} rounds` : ''
  const vip = battle.vip ? ` · the VIP ${{ held: 'held', breached: 'held', freed: 'with the squad', out: 'lifted off' }[battle.vip]}` : ''
  return `${title}${vip}${rounds}${clock}`
}

/**
 * Before the entrance: the twist, what the entrance is, and how the squad goes in: with no utility held, a tap; else a
 * card per utility, tapped to arm and again to go in with it. A rigged tank then asks which tank, `rigging` holding its index.
 */
function drop(run: Run, battle: Battle, armed: string | null, rigging: number | null): string {
  const { icon, name, text } = ENTRANCE_KINDS[battle.entrance!.kind]
  const twist = battle.twist ? `<p>${TWISTS[battle.twist].icon} <b>${TWISTS[battle.twist].name}.</b> ${TWISTS[battle.twist].text}.</p>` : ''
  const tanks = fuelTanks(battle)
  const challenge = battle.challenge && CHALLENGES[battle.challenge]
  const go = (detail: string, picks: Pick[], idle: string) => `<p>${detail}</p><div class="picks">${picks.map((p) => pickCard(p, armed)).join('')}</div>${pickDetail(picks, armed, idle)}`
  const chosen =
    rigging !== null
      ? go('Rig which tank?', tanks.map((_, tank): Pick => utilityPick(`t${tank}`, { type: 'enter', utility: rigging, tank }, 'tank', 'rig', `Tap again to rig tank ${tank + 1} and go in`, { body: `<small>rig</small><b>🛢️ Tank ${tank + 1}</b>` })), 'Tap a tank, then tap it again to go in.')
      : run.utilities.length === 0
        ? button({ type: 'enter' }, `${icon} ${name}!`)
        : go(
            'Pick a utility for this fight.',
            run.utilities.map((id, i): Pick =>
              utilityPick(`u${i}`, id === 'tank' ? undefined : { type: 'enter', utility: i }, id, challenge?.answers.includes(id) ? 'answers this' : 'utility', id === 'tank' ? 'Tap again to choose a tank' : `Tap again to go in with ${UTILITIES[id].name}`, id === 'tank' ? { attrs: `data-rig="${i}"`, block: tanks.length === 0 ? 'No fuel tanks on this ground' : null } : {}),
            ),
            'Tap a utility for its details; tap it again to go in with it.',
          )
  const test = challenge ? `<h2 class="challenge">${challenge.icon} ${challenge.name}</h2><p>${challenge.test}.</p>` : ''
  return `${test}${twist}<p>${icon} <b>${name}.</b> ${text}.</p>${chosen}`
}

/** Turns clicks into actions and hands them to `act`. */
export function createUi(act: (action: Action) => void): Ui {
  const statusLine = document.getElementById('status')!
  const overlay = document.getElementById('panel')!
  const dropPanel = document.getElementById('drop')!
  let choosing: Battle | null = null
  /** On the deploy screen, the rigged tank held at this index awaiting its tank. */
  let rigging: number | null = null
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
  /** The fixed card tapped once, whose second tap goes through; and the shop gear whose wearer is being picked. */
  let armed: string | null = null
  let ware: number | null = null
  let html = ''

  /** The run's phase when the panel was last drawn. */
  let phase: Run['phase'] | null = null

  /**
   * The panel for where the player is. After a stop come its choices, one screen each, then its summary until
   * Continue. Then the overworld.
   */
  function panel(run: Run): string {
    const screen = phaseScreen(run)
    return run.spare ? screen + spareChoice(run, armed) : screen
  }

  function phaseScreen(run: Run): string {
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
      return learner ? debrief + modal(skillChoice(run, learner)) : find !== null ? debrief + loot(run, find, armed) : debrief
    }
    if (run.phase === 'reward') return `${report ? `<small>${STOP_NAMES[report.stop]}${report.soldiers.length > 0 ? (report.won ? ' won' : ' lost') : ''}</small>` : ''}${choice(run, armed)}`
    if (run.phase === 'shop' || run.phase === 'event') {
      // Arriving shows the shop or event; the other tabs stay open to the player while they decide.
      if (phase !== run.phase) tab = 'Map'
      phase = run.phase
      return overworld(run, tab, open, picked, armed, ware)
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
    if (battle !== choosing) {
      choosing = battle
      rigging = null
      armed = null
    }
    dropPanel.innerHTML = drop(run, battle, armed, rigging)
  }

  dropPanel.addEventListener('click', (e) => {
    const target = (e.target as HTMLElement).closest('button')
    if (!target) return
    if (target.dataset.arm && armed !== target.dataset.arm) {
      armed = target.dataset.arm
      return showDrop(shown!)
    }
    if (target.dataset.rig) {
      rigging = Number(target.dataset.rig)
      armed = null
      showDrop(shown!)
    } else if (target.dataset.action) {
      armed = null
      act(JSON.parse(target.dataset.action) as Action)
    }
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
    if (target.dataset.arm && armed !== target.dataset.arm) {
      armed = target.dataset.arm
      return render(shown!)
    }
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
    else if (target.dataset.ware !== undefined) {
      ware = target.dataset.ware ? Number(target.dataset.ware) : null
      armed = null
    }
    else if (target.dataset.tab) {
      tab = target.dataset.tab as Tab
      armed = null
      ware = null
    }
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
      armed = null
      ware = null
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

  return {
    update(run) {
      statusLine.innerHTML = status(run)
      turnDial(run)
      render(run)
      showDrop(run)
    },
  }
}
