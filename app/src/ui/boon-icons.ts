// Each boon's icon: line art on a 24-unit grid, drawn in the current text colour.
import { UTILITIES, type UtilityId } from '../core/utilities'

const F = 'fill="currentColor"'
const ROUND = '<path d="M9 4h6v12H9z"/><path d="M9 4l3-2 3 2M8 20h8"/>'
const SHIELD = '<path d="M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6z"/>'
const RAM = '<path d="M3 9h9v6H3zM12 10h4l3-3v10l-3-3h-4"/>'

export const BOON_ICONS: Record<UtilityId, string> = {
  incendiary: `${ROUND}<path d="M12 7c1 1.5 2 2.5 2 4a2 2 0 0 1-4 0c0-1.5 1-2.5 2-4z" ${F}/>`,
  cryo: `${ROUND}<path d="M12 7v7M9.5 9l5 3M14.5 9l-5 3"/>`,
  overcharge: '<rect x="3" y="7" width="15" height="10" rx="2"/><path d="M20 10v4M11 8l-3 4h4l-3 4"/><path d="M21 3l-2 2M22 7h-2"/>',
  plasma: `<path d="M3 21L15 9"/><path d="M15 9l6-6-2 6-4 0z" ${F}/><circle cx="8" cy="16" r="2"/>`,
  hollowPoint: '<path d="M8 21V9a4 4 0 0 1 8 0v12z"/><path d="M10 6l2 3 2-3M8 16h8"/>',
  tracer: `<path d="M2 18L14 8"/><circle cx="18" cy="6" r="3"/><circle cx="18" cy="6" r="1" ${F}/><path d="M5 20l2-2M2 15l2-1"/>`,
  nanoweave: '<path d="M4 4h16v16H4z"/><path d="M4 9l5-5M4 14l10-10M4 19l15-15M9 20l11-11M14 20l6-6"/>',
  leech: '<path d="M12 3c3 4 6 7 6 11a6 6 0 0 1-12 0c0-4 3-7 6-11z"/><path d="M8 14h3l1-2 1 4 1-2h2"/>',
  regen: '<rect x="4" y="9" width="16" height="10" rx="2"/><path d="M12 11v6M9 14h6M9 9V6h6v3"/>',
  plating: `${SHIELD}<path d="M5 10h14M5 14h14M12 3v18"/>`,
  bracing: `${SHIELD}<path d="M9 13l3-4 3 4M12 9v7"/>`,
  ablative: '<path d="M4 18a8 8 0 0 1 16 0"/><path d="M7 18a5 5 0 0 1 10 0"/><path d="M12 2v5M8 4l2 3M16 4l-2 3"/>',
  deflector: '<path d="M14 3a12 12 0 0 1 0 18"/><path d="M2 8h7M2 12h8M2 16h7"/><path d="M9 6l2 2-2 2M10 14l2 2-2 2"/>',
  riot: '<rect x="6" y="3" width="12" height="18" rx="2"/><path d="M9 7h6M12 10v8"/>',
  afterburner: '<path d="M4 12l6-6h8l2 6-2 6h-8z"/><path d="M4 12H1M5 8L2 6M5 16l-3 2"/><circle cx="14" cy="12" r="2"/>',
  hoverPack: '<path d="M7 4h10v9H7z"/><path d="M5 16h14M8 19l-1 2M12 19v2M16 19l1 2"/>',
  gravBoots: '<path d="M7 3v11l-3 3v3h13l3-3v-2l-6-1V3z"/><path d="M5 22h15M12 7l2-2 2 2"/>',
  jumpJets: '<path d="M3 18c4-12 14-12 18 0"/><path d="M3 18l-1 3M21 18l1 3"/><circle cx="12" cy="8" r="2"/>',
  gauntlet: '<path d="M5 20v-8l2-6h3v6h1V5h3v7h1V6h3l1 6v8z"/><path d="M20 3l2 2M17 1v3"/>',
  concussion: `<circle cx="9" cy="12" r="3" ${F}/><path d="M14 8a6 6 0 0 1 0 8M17 5a10 10 0 0 1 0 14M20 3a13 13 0 0 1 0 18"/>`,
  thermite: `${RAM}<path d="M7 5c1 1 1.5 2 1.5 3M5 6l1 2" />`,
  cryoRams: `${RAM}<path d="M7 3v4M5 4l4 2M9 4L5 6"/>`,
  longshot: '<path d="M2 12h14M16 9h5v6h-5z"/><circle cx="18.5" cy="12" r="1"/><path d="M6 12l-2 6M10 12v6"/>',
  suppression: '<circle cx="12" cy="12" r="8"/><path d="M12 2v6M12 16v6M2 12h6M16 12h6"/><path d="M9 9l6 6"/>',
}

/** The boon's icon as inline SVG, titled with its name. */
export const boonIcon = (id: UtilityId) =>
  `<svg class="ricon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" role="img"><title>${UTILITIES[id].name}</title>${BOON_ICONS[id]}</svg>`
