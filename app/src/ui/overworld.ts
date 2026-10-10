import { FACILITIES, type FacilityId } from '../core/base'
import { CLASSES } from '../core/classes'
import { SLOTS, type Slot } from '../core/gear'
import { RELICS } from '../core/relics'
import { buildCost, built, charges, holder, level, missionAt, nextStop, RISKS, soldierStats, xpFor, type Run, type Soldier, type StopKind, type Zone } from '../core/run'
import { SKILLS } from '../core/skills'
import { TERRAIN_TEXT } from '../core/terrain'
import { button, gearCard, gearText, keyRow, STOP_NAMES, threatBar } from './html'

/** The views between battles, in tab order. */
export const TABS = ['Map', 'Base', 'Barracks'] as const
export type Tab = (typeof TABS)[number]

/** What the player has opened in the Barracks: a soldier's details, or one of the soldier's gear slots. */
export interface Picking {
  soldier: number
  part: Slot | 'details'
}

/** A stop as a chip on the road: its name, and for a fight, how many aliens. */
function chip(run: Run, zone: Zone, stop: StopKind, state = ''): string {
  const fight = stop === 'battle' || stop === 'key' || stop === 'final'
  const aliens = fight ? ` · force ${missionAt(run, stop, zone.risk).force}${stop === 'battle' ? '' : ', with a boss'}` : ''
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
    `<small>${risk.text}</small><br><b>${risk.name} ${TERRAIN_TEXT[zone.terrain].name.toLowerCase()}</b>
    <small>${TERRAIN_TEXT[zone.terrain].text}</small>
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
  return `<b>${STOP_NAMES[stop]}</b><br>Alien force ${mission.force}${stop === 'key' || stop === 'final' ? ', with a boss' : ''}${stakes}`
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
  const where = zone.stops[0] === 'final' ? 'All three keys are won. The alien source is found.' : zone.stops[0] === 'key' ? 'The road ends at a satellite. Its access key is guarded.' : `${RISKS[zone.risk].name} ${TERRAIN_TEXT[zone.terrain].name.toLowerCase()}: ${TERRAIN_TEXT[zone.terrain].text}`
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
  return button({ type: 'build', facility: id }, `<b>${name}</b> ${built(run, id)}/${max}<br>${text}<br><small>${price}</small>`, '', cost !== null && cost <= run.supplies)
}

function baseView(run: Run): string {
  const relics = run.relics.map((id) => `<div class="gear relic"><small>relic</small><br><b>${RELICS[id].name}</b><br>${RELICS[id].text}</div>`)
  return `<h2>Facilities improve every soldier. Each level costs more.</h2>
    <div class="facilities">${(Object.keys(FACILITIES) as FacilityId[]).map((id) => facilityButton(run, id)).join('')}</div>
    ${relics.length > 0 ? `<h2>Relics</h2><div class="stash">${relics.join('')}</div>` : ''}`
}

/**
 * A soldier's card, kept short: level, class, name, experience, and three gear slots. The name opens the soldier's
 * details, and says so when a skill waits to be chosen; a slot opens the gear that fits it.
 */
function soldierCard(run: Run, soldier: Soldier, picking: Picking | null): string {
  const r = level(soldier)
  const cls = soldier.cls && CLASSES[soldier.cls]
  const filled = (100 * (soldier.xp - xpFor(r))) / (xpFor(r + 1) - xpFor(r))
  const chosen = (part: Picking['part']) => (picking?.soldier === soldier.id && picking.part === part ? 'chosen' : '')
  const pick = (part: Picking['part']) => `data-pick='${JSON.stringify({ soldier: soldier.id, part })}'`
  const slots = SLOTS.map((slot) => {
    const gear = run.gear.find((g) => g.id === soldier.gear[slot])
    const label = gear ? `<b>${gear.name}</b>` : `<small>Empty ${slot} slot</small>`
    return `<button class="slot gear ${gear?.rarity ?? ''} ${chosen(slot)}" title="${gear ? gearText(gear) : ''}" ${pick(slot)}>${label}</button>`
  })
  return `<div class="soldier">
    <button class="who ${chosen('details')}" ${pick('details')}><small>Level ${r}${cls ? ` · ${cls.name}` : ''}</small><br><b>${soldier.name}</b>${soldier.offers.length > 0 ? ' <b class="supplies">▲ choose a skill</b>' : ''}</button>
    <div class="bar"><div style="width: ${filled}%"></div></div>
    ${slots.join('')}
  </div>`
}

/** Everything about one soldier: a skill to choose if one waits, then progress, stats, how the class fights, skills, and what the gear does. */
function details(run: Run, soldier: Soldier): string {
  const r = level(soldier)
  const cls = soldier.cls && CLASSES[soldier.cls]
  const stats = soldierStats(run, soldier)
  const offers = soldier.offers.map((id, index) => button({ type: 'skill', soldier: soldier.id, index }, `<small>${cls ? cls.name : ''} skill</small><br><b>${SKILLS[id].name}</b><br>${SKILLS[id].text}`, 'card skill'))
  const choose = offers.length > 0 ? `<h2><b class="supplies">${soldier.name} reached a new level.</b> Choose a skill${soldier.picks > 1 ? `; ${soldier.picks - 1} more to choose after it` : ''}.</h2><div class="choices">${offers.join('')}</div>` : ''
  const skills = soldier.skills.map((id) => `<p><b>${SKILLS[id].name}.</b> ${SKILLS[id].text}.</p>`)
  const uses = charges(run, soldier)
  const gear = SLOTS.flatMap((slot) => run.gear.filter((g) => g.id === soldier.gear[slot])).map((g) => `<div class="gear ${g.rarity}">${gearCard(g)}</div>`)
  const toNext = xpFor(r + 1) - soldier.xp
  return `${choose}<h2>${soldier.name} · ${toNext} more ${toNext === 1 ? 'battle' : 'battles'} to level ${r + 1}</h2>
    <div class="details">
      <table class="stats">
        <tr><td>Health</td><td>${stats.hp}</td><td>Armor</td><td>${stats.armor}</td></tr>
        <tr><td>Aim</td><td>${Math.round(100 * stats.aim)}%</td><td>Crit</td><td>${Math.round(100 * stats.crit)}%</td></tr>
        <tr><td>Damage</td><td>${stats.damage}</td><td>Range</td><td>${stats.range}</td></tr>
        <tr><td>Move</td><td>${stats.move}</td><td></td><td></td></tr>
      </table>
      <div>${cls ? `<p>${cls.stanceText}.</p><p><b>${cls.abilityName}${uses > 0 ? ` ×${uses}` : ''}.</b> ${cls.abilityText}.</p>` : ''}${skills.join('')}</div>
      ${gear.join('')}
    </div>`
}

/** The gear that fits the chosen slot: what the soldier has there, then the stash, then what squadmates hold. */
function gearPicker(run: Run, soldier: Soldier, slot: Slot): string {
  const worn = run.gear.find((gear) => gear.id === soldier.gear[slot])
  const fits = run.gear.filter((gear) => gear.slot === slot && gear !== worn)
  fits.sort((a, b) => Number(!!holder(run, a)) - Number(!!holder(run, b)))
  const cards = fits.map((gear) => {
    const held = holder(run, gear)
    return button({ type: 'equip', soldier: soldier.id, gear: gear.id }, `${gearCard(gear)}${held ? `<br><small>Held by ${held.name}</small>` : ''}`, `gear ${gear.rarity}`)
  })
  const current = worn ? button({ type: 'unequip', soldier: soldier.id, slot }, `${gearCard(worn)}<br><small>Equipped · click to unequip</small>`, `gear ${worn.rarity} chosen`) : ''
  return `<h2>${soldier.name}'s ${slot}. ${fits.length > 0 ? 'Click gear to equip it.' : 'Nothing else fits this slot yet.'}</h2>
    <div class="stash">${current}${cards.join('')}</div>`
}

/** The squad as short cards, and below them whatever the player has opened: a soldier's details, a slot's gear, or else the stash by name. */
function barracksView(run: Run, picking: Picking | null): string {
  const soldier = run.soldiers.find((s) => s.id === picking?.soldier)
  const stash = run.gear.filter((gear) => !holder(run, gear))
  const names = stash.map((gear) => `<span class="chip gear ${gear.rarity}" title="${gearText(gear)}">${gear.name}</span>`)
  const opened = !soldier || !picking
    ? `<h2>Click a soldier for details, or a slot to change its gear. Stash: ${stash.length === 0 ? 'empty' : ''}</h2><div class="road">${names.join('')}</div>`
    : picking.part === 'details'
      ? details(run, soldier)
      : gearPicker(run, soldier, picking.part)
  return `<div class="squad">${run.soldiers.map((s) => soldierCard(run, s, picking)).join('')}</div>${opened}`
}

/**
 * The screen between stops: a header with the keys, threat, supplies and tabs, over the chosen tab's view.
 * The Barracks tab is marked while the stash holds gear or a skill waits to be chosen.
 * `picking` is what the player has opened in the Barracks.
 */
export function overworld(run: Run, tab: Tab, picking: Picking | null): string {
  const views = { Map: mapView, Base: baseView, Barracks: (r: Run) => barracksView(r, picking) }
  const marked = { Map: false, Base: false, Barracks: run.gear.some((gear) => !holder(run, gear)) || run.soldiers.some((s) => s.offers.length > 0) }
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
