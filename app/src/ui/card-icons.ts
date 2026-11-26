// Each card's icon: line art on a 24-unit grid, drawn in the current text colour; a card lending a relic's effect shows the relic's.
import { CARDS, type CardId } from '../core/cards'
import { RELIC_ICONS } from './relic-icons'

const F = 'fill="currentColor"'
const ROUND = '<path d="M9 4h6v12H9z"/><path d="M9 4l3-2 3 2M8 20h8"/>'
const SHIELD = '<path d="M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6z"/>'

/** Cards with an icon of their own; the rest show their role's. */
export const CARD_ICONS: Partial<Record<CardId, string>> = {
  incendiary: `${ROUND}<path d="M12 7c1 1.5 2 2.5 2 4a2 2 0 0 1-4 0c0-1.5 1-2.5 2-4z" ${F}/>`,
  cryoRounds: `${ROUND}<path d="M12 7v7M9.5 9l5 3M14.5 9l-5 3"/>`,
  piercing: `<path d="M3 21L15 9"/><path d="M15 9l6-6-2 6-4 0z" ${F}/><circle cx="8" cy="16" r="2"/>`,
  hollowPoint: '<path d="M8 21V9a4 4 0 0 1 8 0v12z"/><path d="M10 6l2 3 2-3M8 16h8"/>',
  tracer: `<path d="M2 18L14 8"/><circle cx="18" cy="6" r="3"/><circle cx="18" cy="6" r="1" ${F}/><path d="M5 20l2-2M2 15l2-1"/>`,
  leech: '<path d="M12 3c3 4 6 7 6 11a6 6 0 0 1-12 0c0-4 3-7 6-11z"/><path d="M8 14h3l1-2 1 4 1-2h2"/>',
  plating: `${SHIELD}<path d="M5 10h14M5 14h14M12 3v18"/>`,
  bracing: `${SHIELD}<path d="M9 13l3-4 3 4M12 9v7"/>`,
  jumpJets: '<path d="M3 18c4-12 14-12 18 0"/><path d="M3 18l-1 3M21 18l1 3"/><circle cx="12" cy="8" r="2"/>',
  shove: '<path d="M5 20v-8l2-6h3v6h1V5h3v7h1V6h3l1 6v8z"/><path d="M20 3l2 2M17 1v3"/>',
  thunder: `<circle cx="9" cy="12" r="3" ${F}/><path d="M14 8a6 6 0 0 1 0 8M17 5a10 10 0 0 1 0 14M20 3a13 13 0 0 1 0 18"/>`,
  hotLoads: `${ROUND}<path d="M10 8h4M10 11h4"/>`,
  grappleLine: '<path d="M4 20L14 10"/><path d="M14 10l2-6M14 10l6-2M14 10l5 5"/><circle cx="5" cy="19" r="1.5"/>',
  napalm: `<path d="M3 15h7l2-2h3"/><path d="M15 13c2-3 5-3 6 0-1 3-4 4-6 3" ${F}/><path d="M17 8c1 1 1 2 0 3"/>`,
  topple: '<path d="M3 20h9v-4h4v-4h5"/><path d="M8 8l4 4M12 8l-4 4"/><path d="M18 7v4l2-2"/>',
  ricochet: '<path d="M3 18l7-12 4 8 7-10"/><circle cx="10" cy="6" r="1"/><circle cx="14" cy="14" r="1"/>',
  volatile: `<circle cx="12" cy="12" r="3" ${F}/><path d="M12 2v4M12 18v4M2 12h4M18 12h4M5 5l3 3M16 16l3 3M5 19l3-3M16 8l3-3"/>`,
  stagger: RELIC_ICONS.stagger,
  overkill: RELIC_ICONS.overkill,
  spotter: RELIC_ICONS.spotter,
  impetus: RELIC_ICONS.impetus,
  glacial: RELIC_ICONS.glacial,
  brittle: RELIC_ICONS.brittle,
  conductor: RELIC_ICONS.conductor,
  spores: RELIC_ICONS.wildfire,
  thermal: RELIC_ICONS.thermal,
  shatter: RELIC_ICONS.shatter,
  lockOn: RELIC_ICONS.lockOn,
}

/** An icon for each role a card plays: a blade up close, a sight at range, a burst over an area, a shield, a step, a bolt of Energy, a cross, a star for a Power. */
const ROLES = {
  melee: '<path d="M4 20L16 8M14 4l6 6M12 6l6 6"/>',
  ranged: '<circle cx="12" cy="12" r="7"/><path d="M12 2v6M12 16v6M2 12h6M16 12h6"/>',
  area: '<circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4M5 5l3 3M16 16l3 3M5 19l3-3M16 8l3-3"/>',
  block: SHIELD,
  move: '<path d="M3 12h14M13 6l6 6-6 6"/>',
  energy: '<path d="M13 2L5 14h6l-1 8 8-12h-6z"/>',
  heal: '<path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z"/>',
  power: '<path d="M12 2l3 7 7 .5-5.5 4.5 2 7-6.5-4-6.5 4 2-7L2 9.5 9 9z"/>',
}

/** The icon of the role card `id` plays. */
function roleOf(id: CardId): string {
  const k = CARDS[id]
  if (k.type === 'power') return ROLES.power
  if (k.damage) return k.area ? ROLES.area : (k.range ?? Infinity) <= 1 ? ROLES.melee : ROLES.ranged
  if (k.heal) return ROLES.heal
  if (k.block || k.armor) return ROLES.block
  if (k.move || k.retreat || k.pull) return ROLES.move
  return ROLES.energy
}

/** The card's icon as inline SVG, titled with its name. */
export const cardIcon = (id: CardId) =>
  `<svg class="ricon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" role="img"><title>${CARDS[id].name}</title>${CARD_ICONS[id] ?? roleOf(id)}</svg>`
