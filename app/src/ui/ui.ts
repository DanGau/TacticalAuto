import { recruits, story, title } from './menu'
import type { Action } from '../core/apply'
import { nextStop, skillOffers, type Report, type Run } from '../core/run'
import type { View } from '../view/view'
import { choice, joined, loot, modal, runEnd, skillChoice, stopReport } from './aftermath'
import { ALIENS } from '../core/aliens'
import { RELICS, type Relic } from '../core/relics'
import { known } from './intro'
import { TWISTS } from '../core/twists'
import { onTheWay, PLANS, STRIKE, TEAMS, ZONE_NAMES, type Battle, type Unit } from '../core/battle'
import { GOALS, HOLD_ROUNDS } from '../core/goals'
import { DETECT, PATROL_DETECT } from '../core/sight'
import { alienName, button, resistChip, STOP_NAMES, tip } from './html'
import { overworld, type Tab } from './overworld'
import { glide, viewNow } from './globe'

const SIDE = { human: 'Humans', alien: 'Aliens' }
/** How long the helicopter takes to fly between stops, in milliseconds. */
const FLIGHT_MS = 1100

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
  const rounds = battle.escape ? ` · ${battle.escaped.length} lifted off` : battle.goal === 'hold' ? ` · held ${Math.min(battle.held, HOLD_ROUNDS)} of ${HOLD_ROUNDS} rounds` : ''
  return `${title}${rounds} · ${SIDE[battle.turn]}' turn${battle.concealed ? ' · unseen' : ''}`
}

/** Before the landing: a button per zone that flies the camera there, one back to the whole map, and the chosen zone's plan. */
function drop(battle: Battle, zone: number | null, teams: number, greed: number): string {
  if (battle.start) return escapes(battle, zone)
  if (battle.goal === 'rescue') return splits(battle, teams)
  if (battle.goal === 'raid') return raids(battle, greed)
  const zones = battle.plans.map((plan, i) => `<button data-zone="${i}" class="${i === zone ? 'on' : ''}">${[ZONE_NAMES[i], PLANS[plan].icon, PLANS[plan].name].filter(Boolean).join(' ')}</button>`)
  const overview = `<button data-zone="" class="overview ${zone === null ? 'on' : ''}" title="Whole map">🗺️</button>`
  const detail =
    zone === null
      ? '<small>Pick a landing zone to fly to it.</small>'
      : `${PLANS[battle.plans[zone]].text ? `<p>${PLANS[battle.plans[zone]].text}.</p>` : ''}${button({ type: 'land', zone }, `Land at ${ZONE_NAMES[zone]}`)}`
  const twist = battle.twist ? `<p>${TWISTS[battle.twist].icon} <b>${TWISTS[battle.twist].name}.</b> ${TWISTS[battle.twist].text}.</p>` : ''
  return `${twist}<div class="zones">${zones.join('')}${overview}</div>${detail}`
}

/** Before any landing: an orbital strike that wounds every alien, for threat. */
function strike(battle: Battle): string {
  return button({ type: 'strike' }, battle.strike ? '🛰️ Strike called' : `🛰️ Orbital strike: every alien -${STRIKE.damage} health; <span class="up">+${STRIKE.threat} threat</span>`, 'strike', !battle.strike)
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
  /** Whether the player has left the title screen, and the recruit picked before confirming. */
  let started = false
  /** Whether the story has been told, before the first choice. */
  let told = false
  let recruit: number | null = null
  /** The report whose joining hero has been met, and the soldier whose skill choice is open. */
  let met: Report | null = null
  let ability: number | null = null
  /** The crates opened on the debrief shown, whether a pop-up has been over it, and the crate open now. */
  let opened: { report: Report | null; crates: Set<number>; still: boolean } = { report: null, crates: new Set(), still: false }
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
      if (opened.report !== report) opened = { report, crates: new Set(), still: false }
      const learner = run.soldiers.find((s) => s.id === ability && skillOffers(s).length > 0)
      // A pop-up opened over it leaves the debrief at rest behind: nothing in it plays again.
      if (learner || crate !== null) opened.still = true
      const debrief = stopReport(run, report, opened.crates, opened.still)
      return learner ? debrief + modal(skillChoice(run, learner)) : crate !== null ? debrief + loot(run, crate) : debrief
    }
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
      teams = 1
      greed = 1
      view.showTeams(teams)
    }
    dropPanel.innerHTML = drop(battle, zone, teams, greed) + strike(battle)
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
  addEventListener('resize', () => requestAnimationFrame(shrink))

  /** Sets the squad in to the stop it stands at: a fight dives down through the clouds to it. */
  function setIn(): void {
    const next = nextStop(shown!)
    if (!next) return
    if (next === 'supply' || next === 'cache' || next === 'shop') act({ type: 'advance' })
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
    else if (target.dataset.shut) {
      opened.crates.add(Number(target.dataset.shut))
      crate = null
    }
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
