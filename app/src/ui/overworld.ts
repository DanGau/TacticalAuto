import { AID, FACILITIES, type FacilityId } from '../core/base'
import { CLASSES } from '../core/classes'
import { SLOTS, type Slot } from '../core/gear'
import { buildCost, holder, level, payout, RANK_NAMES, RANK_XP, rank, REGIONS, ROUNDS, soldierStats, type Run, type Soldier } from '../core/run'
import { button, gearCard, gearText, missionTitle, threatMeter } from './html'

/** The views between battles, in tab order. */
export const TABS = ['Map', 'Base', 'Barracks'] as const
export type Tab = (typeof TABS)[number]

/** The gear slot the player is choosing gear for. */
export interface Picking {
  soldier: number
  slot: Slot
}

/** Where each region sits on the board, as [column, row], so the board reads as a world map. */
const PLACE = [[1, 1], [1, 2], [2, 1], [2, 2], [3, 1], [3, 2]]

/**
 * The world as a board of regions, each with its threat. A region with a mission on offer is a button that starts
 * it; hovering one shows on every region what choosing it leads to. `landed` animates the aliens' advance per region.
 */
export function board(run: Run, landed?: number[]): string {
  const regions = REGIONS.map((name, region) => {
    const index = landed ? -1 : run.missions.findIndex((m) => m.region === region)
    const mission = run.missions[index]
    const meters = landed
      ? threatMeter(run, region, undefined, landed[region])
      : `<span class="now">${threatMeter(run, region)}</span>${run.missions.map((m, i) => `<span class="preview preview-${i}">${threatMeter(run, region, m)}</span>`).join('')}`
    const body = `<b>${name}</b><div>${meters}</div>`
    const style = `style="grid-column: ${PLACE[region][0]}; grid-row: ${PLACE[region][1]}"`
    if (!mission) return `<div class="region" ${style}>${body}</div>`
    const reward = `+${payout(mission)} supplies, 1 of 3 aid${mission.hard ? ' (rare or better)' : ''}`
    return `<button class="region ${mission.kind} mission-${index}" ${style} data-action='${JSON.stringify({ type: 'mission', index })}'>
      ${body}<div class="mission">${mission.kind === 'lastStand' ? 'Last stand' : 'Alien strike'} · ${mission.aliens} aliens<br><small>${reward}</small></div>
    </button>`
  })
  return `<div class="board">${regions.join('')}</div>`
}

function mapView(run: Run): string {
  const final = run.missions.find((m) => m.kind === 'final')
  if (final) {
    return `<h2>Every region held. One mission remains, and it must be won.</h2>
      ${button({ type: 'mission', index: 0 }, `<b>${missionTitle(final)}</b><br>${final.aliens} aliens · lose and the run ends`, 'final')}`
  }
  const prompt = run.missions.length > 1 ? 'Aliens strike three regions. Click one to answer it; the others gain threat.' : 'A region is overrun. Its last stand must be won.'
  return `<h2>${prompt}</h2>${board(run)}`
}

/** A facility's next level, buyable when the run has the supplies. */
function facilityButton(run: Run, id: FacilityId): string {
  const { name, text, max } = FACILITIES[id]
  const cost = buildCost(run, id)
  const price = cost === null ? 'fully built' : `${cost} supplies`
  return button({ type: 'build', facility: id }, `<b>${name}</b> ${level(run, id)}/${max}<br>${text}<br><small>${price}</small>`, '', cost !== null && cost <= run.supplies)
}

function baseView(run: Run): string {
  const tech = run.aid.filter((id) => AID[id].stats).map((id) => `<li><b>${AID[id].name}</b> ${AID[id].text}</li>`)
  return `<h2>Facilities improve every soldier. Each level costs more.</h2>
    <div class="facilities">${(Object.keys(FACILITIES) as FacilityId[]).map((id) => facilityButton(run, id)).join('')}</div>
    ${tech.length > 0 ? `<h2>Alien tech</h2><ul>${tech.join('')}</ul>` : ''}`
}

/** A soldier's three gear slots. Clicking one opens the gear that fits it. An empty slot says what it takes. */
function slots(run: Run, soldier: Soldier, picking: Picking | null): string {
  return SLOTS.map((slot) => {
    const gear = run.gear.find((g) => g.id === soldier.gear[slot])
    const chosen = picking?.soldier === soldier.id && picking.slot === slot
    const label = gear ? `<b>${gear.name}</b><br><small>${gearText(gear)}</small>` : `<small>Empty ${slot} slot</small>`
    return `<button class="slot gear ${gear?.rarity ?? ''} ${chosen ? 'chosen' : ''}" data-pick='${JSON.stringify({ soldier: soldier.id, slot })}'>${label}</button>`
  }).join('')
}

function soldierCard(run: Run, soldier: Soldier, picking: Picking | null): string {
  const r = rank(soldier)
  const cls = soldier.cls && CLASSES[soldier.cls]
  const next = RANK_XP[r + 1]
  const filled = next === undefined ? 100 : (100 * (soldier.xp - RANK_XP[r])) / (next - RANK_XP[r])
  const stats = soldierStats(run, soldier)
  return `<div class="soldier">
    <small>${RANK_NAMES[r]}${cls ? ` · ${cls.name}` : ''}</small><br><b>${soldier.name}</b>
    <div class="bar"><div style="width: ${filled}%"></div></div>
    <small>${next === undefined ? 'Top rank' : `${next - soldier.xp} more ${next - soldier.xp === 1 ? 'battle' : 'battles'} to ${RANK_NAMES[r + 1]}`}</small>
    <table class="stats">
      <tr><td>Health</td><td>${stats.hp}</td><td>Aim</td><td>${Math.round(100 * stats.aim)}%</td></tr>
      <tr><td>Damage</td><td>${stats.damage}</td><td>Range</td><td>${stats.range}</td></tr>
      <tr><td>Move</td><td>${stats.move}</td><td>Crit</td><td>${Math.round(100 * stats.crit)}%</td></tr>
    </table>
    ${cls ? `<p>${cls.stanceText}.</p><p><b>${cls.abilityName}.</b> ${cls.abilityText}.</p>` : '<p>A rookie gets a class, at random, on first promotion.</p>'}
    ${slots(run, soldier, picking)}
  </div>`
}

/** The gear the player can put in the chosen slot, or, with no slot chosen, the stash. Gear a soldier holds says who. */
function gearList(run: Run, picking: Picking | null): string {
  const stash = run.gear.filter((gear) => !holder(run, gear))
  if (!picking) {
    const cards = stash.map((gear) => `<div class="gear ${gear.rarity}">${gearCard(gear)}</div>`)
    return `<h2>Stash: ${stash.length} unequipped. Click a slot on a soldier to fill it.</h2><div class="stash">${cards.join('')}</div>`
  }
  const soldier = run.soldiers.find((s) => s.id === picking.soldier)!
  const fits = run.gear.filter((gear) => gear.slot === picking.slot && gear.id !== soldier.gear[picking.slot])
  // Stash first, so taking from a squadmate is the later choice.
  fits.sort((a, b) => Number(!!holder(run, a)) - Number(!!holder(run, b)))
  const cards = fits.map((gear) => {
    const held = holder(run, gear)
    return button({ type: 'equip', soldier: soldier.id, gear: gear.id }, `${gearCard(gear)}${held ? `<br><small>Held by ${held.name}</small>` : ''}`, `gear ${gear.rarity}`)
  })
  const clear = soldier.gear[picking.slot] === null ? '' : button({ type: 'unequip', soldier: soldier.id, slot: picking.slot }, 'Unequip', 'gear')
  return `<h2>${soldier.name}'s ${picking.slot}: click gear to equip it.${fits.length === 0 ? ' Nothing else fits this slot yet.' : ''}</h2>
    <div class="stash">${cards.join('')}${clear}</div>`
}

function barracksView(run: Run, picking: Picking | null): string {
  return `<h2>The squad. Everyone fights every mission; the dead are replaced by rookies, and their gear returns to the stash.</h2>
    <div class="squad">${run.soldiers.map((s) => soldierCard(run, s, picking)).join('')}</div>
    ${gearList(run, picking)}`
}

/**
 * The screen between battles: a header with the round, supplies and tabs, over the chosen tab's view.
 * `mapNews` marks the Map tab while the aliens' latest advance waits there unseen; the Barracks tab is marked
 * while the stash holds gear. `picking` is the gear slot being filled in the Barracks.
 */
export function overworld(run: Run, tab: Tab, mapNews: boolean, picking: Picking | null): string {
  const views = { Map: mapView, Base: baseView, Barracks: (r: Run) => barracksView(r, picking) }
  const marked = { Map: mapNews, Base: false, Barracks: run.gear.some((gear) => !holder(run, gear)) }
  const tabs = TABS.map((name) => `<button class="tab ${name === tab ? 'active' : ''}" data-tab="${name}">${name}${marked[name] ? ' <b class="up">●</b>' : ''}</button>`)
  return `
    <div class="header">
      <h1>${run.round > ROUNDS ? 'The final assault' : `Round ${run.round} of ${ROUNDS}`}</h1>
      <div class="tabs">${tabs.join('')}</div>
      <b class="supplies">${run.supplies} ${run.supplies === 1 ? 'supply' : 'supplies'}</b>
    </div>
    ${views[tab](run)}`
}
