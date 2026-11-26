// The UI shell: renders the panel for the run's phase and turns clicks into actions.
import { candidates, story, title } from './menu'
import type { Action } from '../core/apply'
import { current, nextStop } from '../core/run'
import { type Run } from '../core/run-state'
import { type Report } from '../core/run-state'
import { makes } from '../core/hero'
import { battlePage, runSummary } from './summary'
import { installTips } from './tip'
import { acquired, choice, loot, modal, stopReport } from './aftermath'
import { ALIENS } from '../core/aliens'
import { TWISTS } from '../core/twists'
import { CHALLENGES } from '../core/challenges'
import { type Battle, CHRONO_EVERY } from '../core/battle'
import { HOLD_ROUNDS } from '../core/goals'
import { missionOrder, THREATS } from '../core/objectives'
import { button, describe, STOP_NAMES } from './html'
import { aimed } from '../core/cards'
import { DRAW, ENERGY, targetsOf } from '../core/turn'
import { startDeck } from './card-face'
import { handPanel } from './hand'
import { ARENA_KINDS } from '../core/arena-kinds'
import { QUANTITIES } from '../core/quantities'
import { pickCard, type Pick } from './cards'
import { alienBlock } from './sheet'
import { overworld, type Tab } from './overworld'
import { drift, glide, viewNow } from './globe'
import { collapse, deploy, expand } from './select'

/** How long the helicopter takes to fly between stops, in milliseconds. */
const FLIGHT_MS = 1100

export interface Ui {
  /** Shows `run` in the status line and the panel. */
  update(run: Run): void
  /** The player tapped the unit `id` on the board: the target of the card picked, if it can be. */
  tap(id: number): void
}

function status(run: Run): string {
  const battle = run.battle
  if (run.phase !== 'battle' || !battle) return ''
  const title = missionOrder(run)
  if (battle.phase === 'deploy') return title
  const rounds = battle.goal === 'hold' ? ` · held ${Math.min(battle.held, HOLD_ROUNDS)} of ${HOLD_ROUNDS} rounds` : ''
  const clock = battle.deadline !== null && battle.round < battle.deadline ? ` · reinforcements in ${battle.deadline - battle.round} rounds` : ''
  return `${title}${rounds}${clock}${counts(run, battle)}`
}

/** The hero's count toward Chrono Coil's Energy. */
function counts(run: Run, battle: Battle): string {
  return run.relics.includes('chrono') ? ` · Chrono Coil: turn ${(battle.round % CHRONO_EVERY) + 1} of ${CHRONO_EVERY}` : ''
}

/** Before the landing: the ground, what the battle tests, the twist, the aliens, and the rule of the turn. */
function drop(run: Run, battle: Battle, armed: string | null): string {
  const twist = battle.twist ? `<p title="${TWISTS[battle.twist].text}">${TWISTS[battle.twist].icon} <b>${TWISTS[battle.twist].name}</b></p>` : ''
  const test = battle.challenge ? `<h2 class="challenge" title="${CHALLENGES[battle.challenge].test}">${CHALLENGES[battle.challenge].icon} ${THREATS[battle.challenge]}</h2>` : ''
  const clock = battle.deadline !== null ? `<p>⏱️ Reinforcements arrive in round ${battle.deadline}.</p>` : ''
  const hint = `Each turn the hero moves on its own, then draws ${DRAW} cards and gains ${ENERGY} Energy.`
  return `${groundOf(run, battle)}${test}${clock}${twist}${foes(battle, armed)}<p class="auto">${hint}</p>${button({ type: 'enter' }, 'Deploy', 'primary', true)}`
}

/** The ground scouted: its name and what it does, and which of what the hero's build makes it multiplies. */
function groundOf(run: Run, battle: Battle): string {
  const ground = ARENA_KINDS[battle.arenaKind]
  const yours = ground.reads.filter((q) => makes(run).includes(q)).map((q) => `${QUANTITIES[q].icon} ${QUANTITIES[q].name}`)
  return `<h2 class="challenge ground" title="${ground.text}">${ground.icon} ${ground.name}</h2><p class="ground-text">${describe(ground.text, { reads: ground.reads })}${yours.length > 0 ? ` <b>${yours.join(' and ')} pays here.</b>` : ''}</p>`
}

/** The encounter: each alien kind on the deploy screen and how many; tapped, its stat block. Burrowers stay hidden. */
function foes(battle: Battle, armed: string | null): string {
  const seen = battle.units.filter((u) => u.side === 'alien' && u.kind && u.kind !== 'burrower')
  const kinds = [...new Set(seen.map((u) => u.kind!))]
  const picks = kinds.map((kind): Pick => {
    const like = seen.filter((u) => u.kind === kind)
    return { key: `a${kind}`, look: 'foe', body: `${like.length} ${ALIENS[kind].name}${like.length > 1 ? 's' : ''}`, detail: alienBlock(kind, like[0].stats), go: '' }
  })
  const open = picks.find((p) => p.key === armed)
  return `<div class="foes">${picks.map((p) => pickCard(p, armed)).join('')}</div>${open ? open.detail : ''}`
}

/** Turns clicks into actions and hands them to `act`. */
export function createUi(act: (action: Action) => void): Ui {
  const statusLine = document.getElementById('status')!
  const overlay = document.getElementById('panel')!
  installTips(overlay)
  const dropPanel = document.getElementById('drop')!
  const handEl = document.getElementById('hand')!
  let choosing: Battle | null = null
  /** The aimed card of the hand the player picked, waiting for its target. */
  let aiming: Battle['pile']['hand'][number] | null = null
  /** Whether the player has seen the starting deck and set out; and whether the shop's deck is open to remove a card. */
  let dealt = false
  let removing = false
  /** The report the player has continued past. */
  let seen: Report | null = null
  let tab: Tab = 'Map'
  /** The stop ahead the player clicked to look at, before setting out for it. */
  let picked: number | null = null
  let shown: Run | null = null
  /** Whether the player has left the title screen, and the candidate opened before confirming. */
  let started = false
  /** Whether the story has been told, before the first choice. */
  let told = false
  let candidate: number | null = null
  /** The debrief shown, whether a pop-up has been over it, and the crate open now, by index into run.finds. */
  let opened: { report: Report | null; still: boolean } = { report: null, still: false }
  let crate: number | null = null
  /** The fixed card tapped once, whose second tap goes through; and the shop gear whose wearer is being aiming. */
  let armed: string | null = null
  let ware: number | null = null
  /** Whether the battle's statistics page is open over the debrief. */
  let statsOpen = false
  let html = ''

  /** The run's phase when the panel was last drawn. */
  let phase: Run['phase'] | null = null

  /**
   * The panel for where the player is. After a stop come its choices, one screen each, then its summary until
   * Continue. Then the overworld.
   */
  function panel(run: Run): string {
    const screen = phaseScreen(run)
    // Told after the debrief, once the player has seen how the fight went.
    const debriefing = run.report && seen !== run.report && run.report.hero
    if (run.gains.length > 0 && !debriefing && run.phase !== 'battle' && run.phase !== 'won' && run.phase !== 'lost') return screen + acquired(run, run.gains[0])
    return screen
  }

  function phaseScreen(run: Run): string {
    const report = run.report
    if (run.phase === 'select') return !started ? title() : !told ? story() : candidates(run, candidate)
    if (run.phase === 'battle') return ''
    if (run.phase === 'won' || run.phase === 'lost') return runSummary(run)
    // After a fight: the debrief, then the rewards.
    if (report && seen !== report && report.hero) {
      if (opened.report !== report) opened = { report, still: false }
      const find = crate !== null && run.finds[crate] ? crate : null
      // A pop-up opened over it leaves the debrief at rest behind: nothing in it plays again.
      if (find !== null) opened.still = true
      if (statsOpen && run.log.length > 0) return stopReport(run, report, true) + modal(battlePage(run, run.log.at(-1)!))
      const debrief = stopReport(run, report, opened.still)
      return find !== null ? debrief + loot(run, find, armed) : debrief
    }
    if (run.phase === 'reward') return `${report ? `<small>${STOP_NAMES[report.stop]}${report.hero ? (report.won ? ' won' : ' lost') : ''}</small>` : ''}${choice(run, armed)}`
    if (run.phase === 'shop' || run.phase === 'event') {
      // Arriving shows the shop or event; the other tabs stay open to the player while they decide.
      if (phase !== run.phase) tab = 'Map'
      phase = run.phase
      return overworld(run, tab, picked, armed, ware, removing)
    }
    phase = run.phase
    if (!dealt && run.log.length === 0 && run.keys === 0 && run.stop === 0 && !current(run)) return startDeck(run)
    return report && seen !== report ? stopReport(run, report) : overworld(run, tab, picked)
  }

  function render(run: Run): void {
    shown = run
    const from = viewNow()
    const next = panel(run)
    // Rewriting unchanged content would restart its animations.
    if (next !== html) {
      overlay.innerHTML = html = next
      glide(overlay, from)
      drift(overlay)
      overlay.hidden = run.phase === 'battle'
      shrink()
    }
    overlay.hidden = run.phase === 'battle'
  }

  /** Shrinks the panel until its content fits the screen: a game never scrolls. */
  function shrink(): void {
    overlay.style.setProperty('--shrink', '1')
    // The post-game summary may be long: it scrolls, staying legible.
    if (overlay.querySelector('.summary')) return
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
      armed = null
    }
    dropPanel.innerHTML = drop(run, battle, armed)
  }

  function showHand(run: Run): void {
    const battle = run.phase === 'battle' && run.battle?.phase === 'battle' ? run.battle : null
    handEl.hidden = !battle
    if (!battle) return
    const at = aiming ? battle.pile.hand.indexOf(aiming) : -1
    if (at < 0 || battle.stage !== 'play') aiming = null
    handEl.innerHTML = handPanel(run, battle, aiming ? at : null)
  }

  /** Plays the aiming card at `target`. */
  function playAt(target: number): void {
    const battle = shown?.battle
    if (!battle || !aiming) return
    const index = battle.pile.hand.indexOf(aiming)
    if (!targetsOf(battle, aiming).some((u) => u.id === target)) return
    aiming = null
    act({ type: 'play', index, target })
  }

  handEl.addEventListener('click', (e) => {
    const target = (e.target as HTMLElement).closest('button')
    const battle = shown?.battle
    if (!target || target.disabled || !battle) return
    if (target.dataset.end !== undefined) {
      aiming = null
      return act({ type: 'endTurn' })
    }
    if (target.dataset.target) return playAt(Number(target.dataset.target))
    if (target.dataset.card) {
      const index = Number(target.dataset.card)
      const card = battle.pile.hand[index]
      if (!aimed(card.id)) {
        aiming = null
        return act({ type: 'play', index, target: null })
      }
      // A tap picks an aimed card; a second on it takes it back.
      aiming = aiming === card ? null : card
      showHand(shown!)
    }
  })

  dropPanel.addEventListener('click', (e) => {
    const target = (e.target as HTMLElement).closest('button')
    if (!target) return
    if (target.dataset.arm && armed !== target.dataset.arm) {
      armed = target.dataset.arm
      return showDrop(shown!)
    }
    if (target.dataset.action) {
      armed = null
      act(JSON.parse(target.dataset.action) as Action)
    }
  })
  addEventListener('resize', () => requestAnimationFrame(shrink))

  /** Sets the hero in to the stop it stands at: a fight dives down through the clouds to it. */
  function setIn(): void {
    const next = nextStop(shown!)
    if (!next) return
    if (next === 'supply' || next === 'cache' || next === 'shop' || next === 'safehouse') act({ type: 'advance' })
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
  /** Flies the hero's helicopter from where it stands to the stop `to` is pinned at, then `land`s. */
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
  /** Closes the open hero's dossier back into their card, and focuses it. */
  function closeDossier(): void {
    const index = candidate
    const card = () => overlay.querySelector<HTMLElement>(`[data-candidate="${index}"]`)
    flying = true
    collapse(overlay, card()?.getBoundingClientRect(), () => {
      flying = false
      candidate = null
      render(shown!)
      card()?.focus()
    })
  }
  addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && candidate !== null && !flying && shown?.phase === 'select') closeDossier()
  })
  // Arrow keys move a radio group's choice, as a radio group's do.
  overlay.addEventListener('keydown', (e) => {
    const radio = (e.target as HTMLElement).closest<HTMLElement>('[role=radio]')
    if (!radio || !e.key.startsWith('Arrow')) return
    const options = [...radio.closest('[role=radiogroup]')!.querySelectorAll<HTMLElement>('[role=radio]')]
    const step = e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 1
    e.preventDefault()
    options[(options.indexOf(radio) + step + options.length) % options.length].click()
  })
  overlay.addEventListener('click', (e) => {
    const target = (e.target as HTMLElement).closest('button')
    if (!target || target.disabled || flying) return
    if (target.dataset.arm && armed !== target.dataset.arm) {
      armed = target.dataset.arm
      render(shown!)
      if (target.role === 'radio') overlay.querySelector<HTMLElement>(`[data-arm="${armed}"]`)?.focus()
      return
    }
    if (target.id === 'again') location.href = location.pathname
    else if (target.id === 'start') started = true
    else if (target.id === 'begin' || target.dataset.begin !== undefined) told = true
    else if (target.dataset.candidate) {
      candidate = Number(target.dataset.candidate)
      const card = target.getBoundingClientRect()
      render(shown!)
      return expand(overlay, card)
    }
    else if (target.dataset.back !== undefined) return closeDossier()
    else if (target.dataset.deploy) {
      flying = true
      const index = Number(target.dataset.deploy)
      return deploy(overlay, () => {
        flying = false
        candidate = null
        act({ type: 'hero', index })
      })
    }
    else if (target.dataset.stats !== undefined) statsOpen = target.dataset.stats === 'open'
    else if (target.dataset.seen) seen = shown!.report
    else if (target.dataset.crate) crate = Number(target.dataset.crate)
    else if (target.dataset.ware !== undefined) {
      ware = target.dataset.ware ? Number(target.dataset.ware) : null
      armed = null
    }
    else if (target.dataset.dealt !== undefined) dealt = true
    else if (target.dataset.remove !== undefined) {
      removing = target.dataset.remove === 'open'
      armed = null
    }
    else if (target.dataset.tab) {
      tab = target.dataset.tab as Tab
      armed = null
      ware = null
    }
    else if (target.dataset.pick) {
      // A stop tapped once is picked to look at; tapped again, the hero sets out for it.
      const index = Number(target.dataset.pick)
      if (picked !== index) picked = index
      // The hero flies there and sets in: a fight dives down through the clouds.
      else return fly(target, () => {
        picked = null
        act({ type: 'go', index })
        setIn()
      })
    }
    else if (target.dataset.in !== undefined) return setIn()
    else if (target.dataset.action) {
      picked = null
      crate = null
      armed = null
      ware = null
      removing = false
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
      showHand(run)
    },
    tap: (id) => playAt(id),
  }
}
