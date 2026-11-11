// The UI shell: renders the panel for the run's phase and turns clicks into actions.
import { recruits, story, title } from './menu'
import type { Action } from '../core/apply'
import { nextStop } from '../core/run'
import { type Run } from '../core/run-state'
import { type Report } from '../core/run-state'
import { owesPick } from '../core/squad'
import { battlePage, runSummary } from './summary'
import { installTips } from './tip'
import { acquired, choice, joined, loot, modal, pickChoice, spareChoice, stopReport } from './aftermath'
import { ALIENS } from '../core/aliens'
import { TWISTS } from '../core/twists'
import { CHALLENGES } from '../core/challenges'
import { type Battle } from '../core/battle'
import { HOLD_ROUNDS } from '../core/goals'
import { missionOrder, THREATS } from '../core/objectives'
import { button, STOP_NAMES } from './html'
import { fuelTanks } from '../core/objects'
import { carries, UTILITIES } from '../core/utilities'
import { BOON_CHARGES } from '../core/relics'
import { RECKONING_KILLS } from '../core/doctrines'
import { pickCard, pickDetail, utilityPick, type Pick } from './cards'
import { alienBlock } from './sheet'
import { overworld, type Tab } from './overworld'
import { drift, glide, viewNow } from './globe'
import { collapse, deploy, expand } from './select'

/** How long the helicopter takes to fly between stops, in milliseconds. */
const FLIGHT_MS = 1100

export interface Ui {
  /** Shows `run` in the status line and the panel. */
  update(run: Run): void
}

function status(run: Run): string {
  const battle = run.battle
  if (run.phase !== 'battle' || !battle) return ''
  const title = missionOrder(run)
  if (battle.phase === 'deploy') return title
  const rounds = battle.extract ? ` · ${battle.escaped.length} lifted off` : battle.goal === 'hold' ? ` · held ${Math.min(battle.held, HOLD_ROUNDS)} of ${HOLD_ROUNDS} rounds` : ''
  const clock = battle.deadline !== null && battle.round < battle.deadline ? ` · reinforcements in ${battle.deadline - battle.round} rounds` : ''
  const vip = battle.vip ? ` · the VIP ${{ held: 'held', breached: 'held', freed: 'with the party', out: 'lifted off' }[battle.vip]}` : ''
  const boons = battle.boons.filter((b) => b.until > battle.round).map((b) => ` · ${UTILITIES[b.id].icon} ${UTILITIES[b.id].name} ⏳${b.until - battle.round}`).join('')
  return `${title}${vip}${rounds}${clock}${boons}${counts(run, battle)}`
}

/** The squad's counts toward its every-Nth triggers. */
function counts(run: Run, battle: Battle): string {
  const turn = (battle.round % 3) + 1
  const chrono = run.relics.includes('chrono') ? ` · Chrono Coil: turn ${turn} of 3` : ''
  const oath = battle.rules.includes('reckoning') ? ` · Oath: kill ${battle.kills % RECKONING_KILLS} of ${RECKONING_KILLS}` : ''
  return `${chrono}${oath}`
}

/**
 * Before the landing: what the battle tests, the twist, and how the squad goes in: with no utility held, a tap; else a
 * card per utility, tapped to arm and again to go in with it. A rigged tank then asks which tank, `rigging` holding its index.
 * With the reservoir charged, a boon picked, `doubling` its index, asks for a second or none.
 */
function drop(run: Run, battle: Battle, armed: string | null, rigging: number | null, doubling: number | null): string {
  const twist = battle.twist ? `<p title="${TWISTS[battle.twist].text}">${TWISTS[battle.twist].icon} <b>${TWISTS[battle.twist].name}</b></p>` : ''
  const tanks = fuelTanks(battle)
  const challenge = battle.challenge && CHALLENGES[battle.challenge]
  const go = (detail: string, picks: Pick[], idle: string) => `<p>${detail}</p><div class="picks">${picks.map((p) => pickCard(p, armed)).join('')}</div>${pickDetail(picks, armed, idle)}`
  const charged = run.relics.includes('reservoir') && run.boons >= BOON_CHARGES && run.utilities.filter((id) => id !== 'tank').length >= 2
  const reservoir = run.relics.includes('reservoir') ? `<p class="reservoir">🔋 Boon Reservoir: ${run.boons} charge${run.boons === 1 ? '' : 's'}${charged ? `; ${BOON_CHARGES} take a second boon in` : `; go in with no boon to charge it`}.</p>` : ''
  const second = (i: number): Pick[] => [
    { key: 'one', action: { type: 'enter', utility: i }, look: 'utility', body: `<small>keep charges</small><b>${UTILITIES[run.utilities[i]].icon} Just one</b>`, detail: '', go: `Tap again to go in with ${UTILITIES[run.utilities[i]].name} alone` },
    ...run.utilities.flatMap((id, j): Pick[] => (j === i || id === 'tank' ? [] : [utilityPick(`s${j}`, { type: 'enter', utility: i, second: j }, id, `+${BOON_CHARGES} charges`, `Tap again to go in with ${UTILITIES[run.utilities[i]].name} and ${UTILITIES[id].name}`)])),
  ]
  const chosen =
    doubling !== null
      ? go(`Spend ${BOON_CHARGES} charges on a second boon?`, second(doubling), 'Tap a second boon, or Just one, then tap it again to go in.')
      : rigging !== null
      ? go('Rig which tank?', tanks.map((_, tank): Pick => utilityPick(`t${tank}`, { type: 'enter', utility: rigging, tank }, 'tank', 'rig', `Tap again to rig tank ${tank + 1} and go in`, { body: `<small>rig</small><b>🛢️ Tank ${tank + 1}</b>` })), 'Tap a tank, then tap it again to go in.')
      : run.utilities.length === 0
        ? button({ type: 'enter' }, 'Go in')
        : go(
            'Pick a boon for this fight.',
            run.utilities.map((id, i): Pick =>
              utilityPick(`u${i}`, id === 'tank' || charged ? undefined : { type: 'enter', utility: i }, id, challenge && carries(id, challenge.answers) ? 'answers this' : 'boon', id === 'tank' ? 'Tap again to choose a tank' : charged ? 'Tap again, then choose a second' : `Tap again to go in with ${UTILITIES[id].name}`, id === 'tank' ? { attrs: `data-rig="${i}"`, block: tanks.length === 0 ? 'No fuel tanks on this ground' : null } : charged ? { attrs: `data-double="${i}"` } : {}),
            ),
            'Tap a boon or an alien to read it; tap a boon again to go in with it.',
          )
  const test = battle.challenge ? `<h2 class="challenge" title="${CHALLENGES[battle.challenge].test}">${CHALLENGES[battle.challenge].icon} ${THREATS[battle.challenge]}</h2>` : ''
  return `${test}${twist}${foes(battle, armed)}${reservoir}${chosen}`
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
  let choosing: Battle | null = null
  /** On the deploy screen, the rigged tank held at this index awaiting its tank. */
  let rigging: number | null = null
  /** On the deploy screen, the boon picked whose second the reservoir may pay for. */
  let doubling: number | null = null
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
    const debriefing = run.report && seen !== run.report && run.report.soldiers.length > 0
    if (run.gains.length > 0 && !debriefing && run.phase !== 'battle' && run.phase !== 'won' && run.phase !== 'lost') return screen + acquired(run, run.gains[0])
    return run.spare ? screen + spareChoice(run, armed) : screen
  }

  function phaseScreen(run: Run): string {
    const report = run.report
    if (run.phase === 'recruit') return !started ? title() : !told ? story() : recruits(run, recruit)
    if (run.phase === 'battle') return ''
    if (run.phase === 'won' || run.phase === 'lost') return runSummary(run)
    // After a fight: a hero joining, then the debrief, where each soldier owed a skill or perk chooses it, then the rewards.
    if (report && seen !== report && report.soldiers.length > 0) {
      if (report.hired && met !== report) return joined(run, report.hired)
      if (opened.report !== report) opened = { report, still: false }
      const learner = run.soldiers.find((s) => s.id === ability && owesPick(s))
      const find = crate !== null && run.finds[crate] ? crate : null
      // A pop-up opened over it leaves the debrief at rest behind: nothing in it plays again.
      if (learner || find !== null) opened.still = true
      if (statsOpen && run.log.length > 0) return stopReport(run, report, true) + modal(battlePage(run, run.log.at(-1)!))
      const debrief = stopReport(run, report, opened.still)
      return learner ? debrief + modal(pickChoice(run, learner, armed)) : find !== null ? debrief + loot(run, find, armed) : debrief
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
      rigging = null
      doubling = null
      armed = null
    }
    dropPanel.innerHTML = drop(run, battle, armed, rigging, doubling)
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
    } else if (target.dataset.double) {
      doubling = Number(target.dataset.double)
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
  /** Closes the open hero's dossier back into their card, and focuses it. */
  function closeDossier(): void {
    const index = recruit
    const card = () => overlay.querySelector<HTMLElement>(`[data-recruit="${index}"]`)
    flying = true
    collapse(overlay, card()?.getBoundingClientRect(), () => {
      flying = false
      recruit = null
      render(shown!)
      card()?.focus()
    })
  }
  addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && recruit !== null && !flying && shown?.phase === 'recruit') closeDossier()
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
    else if (target.dataset.recruit) {
      recruit = Number(target.dataset.recruit)
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
        recruit = null
        act({ type: 'recruit', index })
      })
    }
    else if (target.dataset.stats !== undefined) statsOpen = target.dataset.stats === 'open'
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
