import { AID, FACILITIES, type FacilityId } from '../core/base'
import { CLASSES } from '../core/classes'
import { SLOTS, type Slot } from '../core/gear'
import { buildCost, holder, level, missionAt, nextStop, RANK_NAMES, RANK_XP, rank, RISKS, soldierStats, type Run, type Soldier, type StopKind, type Zone } from '../core/run'
import { button, gearCard, gearText, keyRow, STOP_NAMES, threatBar } from './html'

/** The views between battles, in tab order. */
export const TABS = ['Map', 'Base', 'Barracks'] as const
export type Tab = (typeof TABS)[number]

/** The gear slot the player is choosing gear for. */
export interface Picking {
  soldier: number
  slot: Slot
}

/** A stop as a chip on the road: its name, and for a fight, how many aliens. */
function chip(run: Run, zone: Zone, stop: StopKind, state = ''): string {
  const fight = stop === 'battle' || stop === 'key' || stop === 'final'
  const aliens = fight ? ` · ${missionAt(run, stop, zone.risk).aliens} aliens${stop === 'battle' ? '' : ' and a boss'}` : ''
  return `<span class="chip ${stop} ${state}">${STOP_NAMES[stop]}${aliens}</span>`
}

/** A zone at a fork: its risk, its stops in order, and what it costs and pays. Clicking it commits the squad to it. */
function zoneCard(run: Run, zone: Zone, index: number): string {
  const risk = RISKS[zone.risk]
  // Battles are sized as they will be once the squad has taken this fork.
  const ahead = { ...run, fork: run.fork + 1 }
  const gear = risk.drops === 0 ? 'no gear' : `${risk.drops} ${risk.rareGear ? 'rare or better ' : ''}gear`
  return button(
    { type: 'zone', index },
    `<small>${risk.text}</small><br><b>${risk.name} zone</b>
    <div class="road">${zone.stops.map((stop) => chip(ahead, zone, stop)).join('<span class="arrow">→</span>')}</div>
    <small>Each battle won: ${risk.supplies} ${risk.supplies === 1 ? 'supply' : 'supplies'}, ${gear}, 1 of 3 aid<br>+${zone.stops.length} threat</small>`,
    `zone ${zone.risk}`,
  )
}

/** The words on the button that travels to the next stop. */
function travelLabel(run: Run, zone: Zone, stop: NonNullable<ReturnType<typeof nextStop>>): string {
  if (stop === 'supply' || stop === 'cache') return `Collect the ${STOP_NAMES[stop].toLowerCase()}`
  const mission = missionAt(run, stop, zone.risk)
  const stakes = stop === 'lastStand' || stop === 'final' ? ' · lose and the run ends' : ''
  return `<b>${STOP_NAMES[stop]}</b><br>${mission.aliens} aliens${stop === 'key' || stop === 'final' ? ' and a boss' : ''}${stakes}`
}

/** The map: at a fork, the three zones to choose from; in a zone, the road through it and a button to travel on. */
function mapView(run: Run): string {
  const zone = run.zone
  if (!zone) {
    return `<h2>A fork in the road. Choose a zone; what lies beyond it is unknown.</h2>
      <div class="choices">${run.zones.map((z, i) => zoneCard(run, z, i)).join('')}</div>`
  }
  const stop = nextStop(run)!
  const road = zone.stops.map((s, i) => chip(run, zone, s, i < run.stop ? 'done' : i === run.stop ? 'here' : '')).join('<span class="arrow">→</span>')
  const where = zone.stops[0] === 'final' ? 'All three keys are won. The alien source is found.' : zone.stops[0] === 'key' ? 'The road ends at a satellite. Its access key is guarded.' : `${RISKS[zone.risk].name} zone`
  return `<h2>${where}</h2>
    <div class="road">${road}</div>
    ${stop === 'lastStand' ? '<p class="up"><b>The threat is full. The aliens attack before the squad can travel on.</b></p>' : ''}
    <button class="travel ${stop}" data-action='${JSON.stringify({ type: 'advance' })}'>${travelLabel(run, zone, stop)}</button>`
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
 * The screen between stops: a header with the keys, threat, supplies and tabs, over the chosen tab's view.
 * The Barracks tab is marked while the stash holds gear. `picking` is the gear slot being filled in the Barracks.
 */
export function overworld(run: Run, tab: Tab, picking: Picking | null): string {
  const views = { Map: mapView, Base: baseView, Barracks: (r: Run) => barracksView(r, picking) }
  const marked = { Map: false, Base: false, Barracks: run.gear.some((gear) => !holder(run, gear)) }
  const tabs = TABS.map((name) => `<button class="tab ${name === tab ? 'active' : ''}" data-tab="${name}">${name}${marked[name] ? ' <b class="up">●</b>' : ''}</button>`)
  return `
    <div class="header">
      <div class="tabs">${tabs.join('')}</div>
      <span>Keys ${keyRow(run.keys)}</span>
      <span>Threat ${threatBar(run.threat)}</span>
      <b class="supplies">${run.supplies} ${run.supplies === 1 ? 'supply' : 'supplies'}</b>
    </div>
    ${views[tab](run)}`
}
