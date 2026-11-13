// Each relic's icon: line art on a 24-unit grid, drawn in the current text colour.
import { RELICS, type RelicId } from '../core/relics'

const F = 'fill="currentColor"'
const SHIELD = '<path d="M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6z"/>'
const FLAKE = '<path d="M12 2v20M3.3 7l17.4 10M3.3 17L20.7 7"/>'

export const RELIC_ICONS: Record<RelicId, string> = {
  plasma: `<circle cx="12" cy="12" r="3.5" ${F}/><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(30 12 12)"/><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(-30 12 12)"/>`,
  alloys: '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M4 7.5l8 4.5 8-4.5M12 12v9"/>',
  servos: '<path d="M3 6l6 6-6 6M11 6l6 6-6 6M19 6v12"/>',
  lens: '<circle cx="10" cy="10" r="6.5"/><path d="M15 15l6 6M7 10h6M10 7v6"/>',
  glassCannon: '<rect x="2" y="9" width="13" height="6" rx="1"/><path d="M15 10l6-2v8l-6-2M7 9l2 3-2 3"/>',
  capacitor: '<rect x="2" y="7" width="17" height="10" rx="2"/><path d="M21 10v4M12 8l-3 4h4l-3 4"/>',
  plating: `${SHIELD}<path d="M12 9v6M9 12h6"/>`,
  nanites: '<circle cx="7" cy="8" r="2"/><circle cx="17" cy="8" r="2"/><circle cx="12" cy="16" r="2"/><path d="M9 8h6M8 10l3 4M16 10l-3 4M12 18v4M5 6L3 4M19 6l2-2"/>',
  phoenix: '<path d="M12 20V9C9 4 5 4 2 6c3 1 5 3 6 6M12 9c3-5 7-5 10-3-3 1-5 3-6 6M8 20h8M10 17l2 3 2-3"/><circle cx="12" cy="6" r="1.5"/>',
  echo: `<circle cx="5" cy="12" r="2" ${F}/><path d="M9 8a6 6 0 0 1 0 8M13 5a10 10 0 0 1 0 14M17 2a14 14 0 0 1 0 20"/>`,
  drones: '<rect x="9" y="10" width="6" height="4" rx="1"/><path d="M9 11L6 8M15 11l3-3M9 13l-3 3M15 13l3 3M2 7h7M15 7h7M2 17h7M15 17h7"/>',
  contact: '<path d="M5 21c0-5 3-8 7-8s7 3 7 8M6 10c0-4 3-7 6-7s6 3 6 7c-2 1-4 1.5-6 1.5S8 11 6 10z"/><path d="M9 8h2M13 8h2"/>',
  uplink: '<path d="M4 9a10 10 0 0 0 11 11z"/><path d="M9.5 14.5l5-5M15 4a5 5 0 0 1 5 5M15 1a8 8 0 0 1 8 8"/>',
  accelerant: `<path d="M12 2c3 4 6 7 6 12a6 6 0 0 1-12 0c0-5 3-8 6-12z"/><path d="M12 11c1 2 2 3 2 4.5a2 2 0 0 1-4 0c0-1.5 1-2.5 2-4.5z" ${F}/>`,
  wildfire: `<circle cx="12" cy="12" r="3" ${F}/><circle cx="4.5" cy="4.5" r="1.5"/><circle cx="19.5" cy="4.5" r="1.5"/><circle cx="4.5" cy="19.5" r="1.5"/><circle cx="19.5" cy="19.5" r="1.5"/><path d="M9.5 9.5l-4-4M14.5 9.5l4-4M9.5 14.5l-4 4M14.5 14.5l4 4"/>`,
  salamander: '<circle cx="12" cy="12" r="10"/><path d="M12 5c2 3 4 5 4 8a4 4 0 0 1-8 0c0-2 1-3 2-4 0 2 1 3 2 3-1-2 0-5 0-7z"/>',
  lattice: `${FLAKE}<path d="M9.5 3.5L12 6l2.5-2.5M9.5 20.5L12 18l2.5 2.5"/>`,
  shatter: '<path d="M4 21l5-9-3-1 8-9 4 3-5 5 3 2z"/>',
  thermal: `<circle cx="12" cy="12" r="10"/><path d="M12 2v20M17 7v10M14 9.5l6 5M14 14.5l6-5"/><path d="M7 7c1 2 2.5 3.5 2.5 6a2.5 2.5 0 0 1-5 0c0-2.5 1.5-4 2.5-6z" ${F}/>`,
  spotter: '<circle cx="7" cy="15" r="4"/><circle cx="17" cy="15" r="4"/><path d="M11 15h2M4 12l2-7h3l1 6M20 12l-2-7h-3l-1 6"/>',
  hunt: `<path d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6S2 12 2 12z"/><circle cx="12" cy="12" r="3" ${F}/>`,
  bloodforged: `<path d="M5 3l4 2h6l4-2 1 9c0 5-4 8-8 9-4-1-8-4-8-9z"/><path d="M12 9c1.5 2 2.5 3 2.5 4.5a2.5 2.5 0 0 1-5 0c0-1.5 1-2.5 2.5-4.5z" ${F}/>`,
  rite: `<path d="M5 3h14c0 5-2 8-7 8S5 8 5 3zM12 11v7M8 21h8"/><path d="M12 4.5c1 1.5 1.5 2 1.5 3a1.5 1.5 0 0 1-3 0c0-1 .5-1.5 1.5-3z" ${F}/>`,
  impetus: '<path d="M2 12h12M10 7l5 5-5 5M19 2v20M22 5l-3 3M22 12l-3 1M22 19l-3-3"/>',
  catalyst: '<path d="M12 3l8 15H4zM1 10l7 4M16 13l7-3M16 15l7 2"/>',
  chrono: '<circle cx="12" cy="13" r="8.5"/><path d="M12 8v5l3 2M9 2h6"/>',
  reservoir: '<path d="M9 2h6M10 2v6L4.5 18.5A2 2 0 0 0 6.3 21h11.4a2 2 0 0 0 1.8-2.5L14 8V2M7 14h10"/>',
  zenith: '<path d="M5 2h14M5 22h14M7 2c0 5 5 7 5 10s-5 5-5 10M17 2c0 5-5 7-5 10s5 5 5 10"/>',
  streak: '<path d="M5 21l7-5 7 5M5 14.5l7-5 7 5M5 8l7-5 7 5"/>',
  fracture: '<path d="M12 2l8 10-8 10-8-10zM12 2l-1.5 6 3 3-3 4 1.5 7M7.5 7.5l3 1M16.5 16.5l-3-1.5"/>',
  conductor: `<path d="M1 12h3c1-4 2-4 3 0s2 4 3 0 2-4 3 0 2 4 3 0 2-4 3 0h4"/><circle cx="12" cy="4" r="1.5" ${F}/><circle cx="12" cy="20" r="1.5" ${F}/>`,
  kindling: `${SHIELD}<path d="M12 8c1.5 2.5 3 4 3 6a3 3 0 0 1-6 0c0-2 1.5-3.5 3-6z" ${F}/>`,
  overkill: '<circle cx="8" cy="12" r="6"/><circle cx="8" cy="12" r="2"/><path d="M8 12h14M19 9l3 3-3 3"/>',
  brittle: '<path d="M2 4h20M4 4l2 10 2-10M10 4l2 17 2-17M16 4l2 8 2-8"/>',
  pyre: '<path d="M4 22l16-4M4 18l16 4M12 16c-3 0-4.5-2-4.5-4 0-3 3-4.5 4.5-9 1.5 4.5 4.5 6 4.5 9 0 2-1.5 4-4.5 4z"/>',
  hex: '<circle cx="12" cy="12" r="10"/><path d="M12 3l5.3 16.3L3.4 9.2h17.2L6.7 19.3z"/>',
  domino: '<rect x="3" y="7" width="5" height="12" rx="1" transform="rotate(-20 5.5 13)"/><rect x="10" y="6" width="5" height="12" rx="1" transform="rotate(-8 12.5 12)"/><rect x="17" y="6" width="5" height="12" rx="1"/><path d="M5 10v.1M12.5 9v.1M19.5 9v.1"/>',
  sentinel: '<path d="M12 22V7M12 2L9 7h6zM12 9c4 0 6 2 6 5h-6M9 18h6"/>',
  net: '<path d="M3 3l18 18M21 3L3 21M3 12l9-9 9 9-9 9z"/>',
  glacial: '<path d="M2 15h20M2 15l2.5-6 2.5 6 2.5-6 2.5 6 2.5-6 2.5 6 2.5-6 2.5 6M12 2v4M10 4h4"/>',
  juggernaut: '<path d="M4 15a8 8 0 0 1 16 0v4H4zM4 15h16M10 15v4M14 15v4M12 7V3"/>',
  encore: `<path d="M12 4v10M5 5l2 2M19 5l-2 2M3 12h2M19 12h2"/><circle cx="12" cy="19" r="1.5" ${F}/>`,
  charges: '<circle cx="10" cy="14" r="7"/><path d="M15 9l3-3M18 6c1-2 3-2.5 4-1.5M20 1.5l.5 1"/>',
  shredder: '<circle cx="12" cy="12" r="3"/><path d="M12 2l3 3h4v4l3 3-3 3v4h-4l-3 3-3-3H5v-4l-3-3 3-3V5h4z"/>',
  cryo: '<rect x="7" y="5" width="10" height="17" rx="2"/><path d="M10 2h4M12 9v9M9 11l6 5M9 16l6-5"/>',
  bulwark: '<rect x="2" y="6" width="20" height="12"/><path d="M2 10h20M2 14h20M8 6v4M16 6v4M5 10v4M12 10v4M19 10v4M8 14v4M16 14v4"/>',
  turrets: '<path d="M8 10h8v6H8zM16 12h6M10 10V7h4v3M12 16l-5 6M12 16l5 6M12 16v6"/>',
  beacon: `<circle cx="12" cy="8" r="2" ${F}/><path d="M8.5 4.5a5 5 0 0 0 0 7M15.5 4.5a5 5 0 0 1 0 7M5.5 1.5a9 9 0 0 0 0 13M18.5 1.5a9 9 0 0 1 0 13M12 10v12M9 22h6"/>`,
  charity: `<path d="M3 11l9-8 9 8M5 9v12h14V9"/><path d="M12 18l-3-3a1.8 1.8 0 0 1 3-2 1.8 1.8 0 0 1 3 2z" ${F}/>`,
  relay: '<path d="M12 8L7 22M12 8l5 14M9 16h6M8 19h8M8 2a6 6 0 0 0 0 8M16 2a6 6 0 0 1 0 8"/><circle cx="12" cy="6" r="2"/>',
  flare: `<path d="M2 22C6 12 12 6 19 4M15 9l1 2M12 7l2 1M8 12l2 1"/><circle cx="20" cy="4" r="2.5" ${F}/>`,
  bounty: `<circle cx="12" cy="12" r="8"/><path d="M12 1v6M12 17v6M1 12h6M17 12h6"/><circle cx="12" cy="12" r="2" ${F}/>`,
}

/** The relic's icon as inline SVG, titled with its name. */
export const relicIcon = (id: RelicId) =>
  `<svg class="ricon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" role="img"><title>${RELICS[id].name}</title>${RELIC_ICONS[id]}</svg>`
