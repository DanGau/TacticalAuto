// Each ability's icon: line art with a solid heart in a diamond. Class kits single-ruled, ultimates double, duos dashed, bonus attacks thin.
import { CLASSES, type ClassId } from '../core/classes'
import { DUOS, type DuoId } from '../core/duos'
import { SECONDARIES, type SecondaryId } from '../core/secondaries'
import { SKILLS, type SkillId } from '../core/skills'
import { framed, type Frame } from './icon-frame'

const DIAMOND = 'M12 1l11 11-11 11L1 12z'
const TINT = 'fill="currentColor" fill-opacity=".16"'
const KIT: Frame = { outline: `<path d="${DIAMOND}" ${TINT} stroke-width="1.6"/>`, scale: 0.58, stroke: 2.6 }
const ULTIMATE: Frame = { outline: `<path d="${DIAMOND}" ${TINT} stroke-width="1.6"/><path d="M12 3.6L20.4 12 12 20.4 3.6 12z" stroke-width=".9"/>`, scale: 0.5, stroke: 2.8 }
const DUO: Frame = { outline: `<path d="${DIAMOND}" ${TINT} stroke-width="1.5" stroke-dasharray="2.6 1.6"/>`, scale: 0.58, stroke: 2.6 }
const BONUS: Frame = { outline: `<path d="${DIAMOND}" stroke-width="1"/>`, scale: 0.6, stroke: 2.4 }

/** Each class's kit ability. */
export const KIT_ICONS: Record<ClassId, string> = {
  assault: '<path d="M4 18h3l3-6 3 6h3" /><path d="M7 10l3-4 3 4M13 10l3-4 3 4"/><circle cx="10" cy="17" r="2" fill="currentColor"/>',
  heavy: '<circle cx="15" cy="15" r="4" fill="currentColor"/><path d="M5 5l6 6M9 4l4 4M4 9l4 4"/>',
  sniper: '<path d="M4 12s3-5 8-5 8 5 8 5-3 5-8 5-8-5-8-5z"/><circle cx="12" cy="12" r="2.5" fill="currentColor"/><path d="M12 4v2M12 18v2"/>',
  support: '<path d="M10 7h4v3h3v4h-3v3h-4v-3H7v-4h3z" fill="currentColor"/><path d="M5 5l1.5 1.5M19 5l-1.5 1.5M5 19l1.5-1.5M19 19l-1.5-1.5"/>',
  engineer: '<rect x="8" y="5" width="8" height="6" rx="1" fill="currentColor"/><path d="M9 11v4l-2 4M15 11v4l2 4M8 8H5M16 8h3"/>',
  pyro: '<circle cx="14" cy="14" r="4.5" fill="currentColor"/><path d="M4 6l6 4M6 4l5 6M4 10l5 2"/>',
  cryo: '<path d="M6 20v-8l2-6 2 5 2-5 1 6"/><path d="M15 6v8M11.5 8l7 4M11.5 12l7-4"/><circle cx="8" cy="15" r="2" fill="currentColor"/>',
  phantom: '<path d="M5 19c0-8 3-14 7-14s7 6 7 14z"/><path d="M8.5 13c1-1.5 2-2 3.5-2s2.5.5 3.5 2c-1 1.5-2 2-3.5 2s-2.5-.5-3.5-2z" fill="currentColor"/>',
}

/** Each ultimate, by the skill that grants it. */
export const ULTIMATE_ICONS: Partial<Record<SkillId, string>> = {
  killingSpree: '<path d="M4 18l4-6 4 4 4-8 4 4"/><circle cx="8" cy="12" r="1.5" fill="currentColor"/><circle cx="16" cy="8" r="1.5" fill="currentColor"/><path d="M17 4l3 0 0 3"/>',
  indestructible: '<path d="M12 4l7 3v5c0 4-3 6-7 8-4-2-7-4-7-8V7z" fill="currentColor"/><path d="M4 4l2 2M20 4l-2 2"/>',
  levelBlock: '<rect x="5" y="13" width="5" height="6" fill="currentColor"/><path d="M14 19v-6l3-2 3 2v6M12 4v5M10 7l2 2 2-2"/>',
  extinction: '<circle cx="12" cy="14" r="4" fill="currentColor"/><path d="M4 20h16M4 10l3 2M20 10l-3 2M12 4v4"/>',
  titanForm: '<circle cx="12" cy="6" r="2" fill="currentColor"/><path d="M7 20l2-6-3-4h12l-3 4 2 6M12 10v4"/>',
  earthquake: '<path d="M4 14l3-3 3 4 3-5 3 4 4-3"/><path d="M4 19h16" /><rect x="10" y="4" width="4" height="4" fill="currentColor"/>',
  bulletTime: '<path d="M8 10h7l4 2-4 2H8z" fill="currentColor"/><path d="M4 10h2M4 14h2M5 6h6M5 18h6"/>',
  deathSentence: '<path d="M7 11a5 5 0 0 1 10 0v3h-2v3H9v-3H7z" fill="currentColor"/><path d="M10 17v3M14 17v3"/>',
  hallOfMirrors: '<rect x="4" y="6" width="5" height="12" rx="1"/><rect x="15" y="6" width="5" height="12" rx="1"/><circle cx="12" cy="12" r="2.5" fill="currentColor"/>',
  colossus: '<rect x="7" y="4" width="10" height="7" rx="1" fill="currentColor"/><path d="M5 11h14M8 11v9M16 11v9M5 20h6M13 20h6"/>',
  droneStorm: '<rect x="9" y="4" width="6" height="4" rx="1" fill="currentColor"/><path d="M6 11l-1 3M10 11l-1 3M14 11l-1 3M18 11l-1 3M8 16l-1 3M16 16l-1 3"/>',
  orbital: '<rect x="10" y="4" width="4" height="12" fill="currentColor"/><path d="M5 19h14M7 16l-2-2M17 16l2-2"/>',
  resurrection: '<path d="M12 20V8M8 12l4-4 4 4M7 20h10"/><circle cx="12" cy="5" r="2" fill="currentColor"/>',
  divineShield: '<path d="M12 6l6 2.5v4c0 3.5-2.5 5.5-6 7-3.5-1.5-6-3.5-6-7v-4z" fill="currentColor"/><ellipse cx="12" cy="4.5" rx="4" ry="1.2"/>',
  timeStop: '<circle cx="12" cy="12" r="7"/><path d="M12 8v4"/><rect x="9" y="13" width="2" height="4" fill="currentColor"/><rect x="13" y="13" width="2" height="4" fill="currentColor"/>',
  supernova: '<path d="M12 4l2 6 6 2-6 2-2 6-2-6-6-2 6-2z" fill="currentColor"/><path d="M6 6l2 2M18 6l-2 2M6 18l2-2M18 18l-2-2"/>',
  worldAblaze: '<circle cx="12" cy="13" r="6"/><path d="M6 13h12"/><path d="M12 4c2 2 3 3.5 3 5a3 3 0 0 1-6 0c0-1.5 1-3 3-5z" fill="currentColor"/>',
  phoenixRising: '<path d="M12 18V10M12 10C10 6 7 5 4 6c2 1 4 3 5 6M12 10c2-4 5-5 8-4-2 1-4 3-5 6"/><path d="M12 13l2 3-2 4-2-4z" fill="currentColor"/>',
  absoluteZero: '<path d="M12 4v16M5 8l14 8M5 16l14-8"/><circle cx="12" cy="12" r="3" fill="currentColor"/>',
  blizzard: '<path d="M6 11a4 4 0 0 1 4-5 5 5 0 0 1 9 3 3 3 0 0 1-1 2z" fill="currentColor"/><path d="M8 14l-2 5M12 14l-2 5M16 14l-2 5"/>',
  hailOfIcicles: '<path d="M5 5h14" /><path d="M7 7l1.5 7L10 7zM14 7l1.5 10L17 7z" fill="currentColor"/>',
  eclipse: '<circle cx="12" cy="12" r="7"/><path d="M14 5.5a7 7 0 0 1 0 13 7 7 0 0 0 0-13z" fill="currentColor"/><circle cx="10" cy="12" r="5" fill="currentColor"/>',
  reap: '<path d="M8 20L15 6M15 6c-4-1-8 1-10 4 3-1 6-1 9 0"/><path d="M15 6c-4-1-8 1-10 4 3-1 6-1 9 0z" fill="currentColor"/>',
  phantomLegion: '<path d="M4 19c0-6 2-10 4-10s4 4 4 10M12 19c0-6 2-10 4-10s4 4 4 10"/><path d="M8 19c0-8 2-13 4-13s4 5 4 13z" fill="currentColor"/>',
}

export const DUO_ICONS: Record<DuoId, string> = {
  thermalShock: '<path d="M11 5c-3 4-5 6-5 9a5 5 0 0 0 5 5z" fill="currentColor"/><path d="M13 5v14M13 9l5-2M13 13l5 0M13 17l5 2"/>',
  spotting: '<circle cx="8" cy="12" r="3.5"/><circle cx="16" cy="12" r="3.5"/><circle cx="16" cy="12" r="1.5" fill="currentColor"/><path d="M11.5 12h1"/>',
  lifeline: '<path d="M7 9h2v2h2v2H9v2H7v-2H5v-2h2z" fill="currentColor"/><path d="M11 12h2l1.5-3 2 6 1.5-3h2"/>',
  anvil: '<rect x="5" y="4" width="8" height="5" rx="1" fill="currentColor"/><path d="M9 9v4M5 16h14l-2 4H7z"/>',
  painter: '<circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2" fill="currentColor"/><path d="M4 4l4 4M12 4v2M12 18v2M18 12h2"/>',
  coldComfort: '<path d="M6 9h3v3h3v3H9v3H6v-3H4v-3h2z" fill="currentColor"/><path d="M17 6v10M13 8.5l8 5M13 13.5l8-5"/>',
  firefall: '<circle cx="9" cy="10" r="4" fill="currentColor"/><path d="M4 4l2 2"/><path d="M16 12c2 3 3 4 3 5.5a3 3 0 0 1-6 0c0-1.5 1-2.5 3-5.5z"/>',
  pincer: '<path d="M4 6l7 6M20 6l-7 6M4 18l3-3M20 18l-3-3"/><circle cx="12" cy="13" r="2" fill="currentColor"/>',
  payload: '<rect x="8" y="9" width="8" height="6" rx="1" fill="currentColor"/><path d="M5 5l2 2M19 5l-2 2M5 19l2-2M19 19l-2-2M12 4v2M12 18v2"/>',
  flashFreeze: '<path d="M13 4l-5 9h4l-1 7 5-9h-4z" fill="currentColor"/><path d="M5 6v6M3 9h4M19 12v6M17 15h4"/>',
  crossfire: '<circle cx="12" cy="12" r="5"/><path d="M4 4l16 16M20 4L4 20"/><circle cx="12" cy="12" r="2" fill="currentColor"/>',
  afterglow: '<path d="M14 5a7 7 0 1 0 5 9 5 5 0 0 1-5-9z" fill="currentColor"/><path d="M17 4v4M15 6h4"/>',
}

/** Each bonus attack. */
export const BONUS_ICONS: Record<SecondaryId, string> = {
  sidearm: '<path d="M5 9h12v4h-5l-1 5H8l1-5H5z" fill="currentColor"/><path d="M19 11h1"/>',
  frag: '<circle cx="12" cy="12" r="3" fill="currentColor"/><path d="M12 4v3M12 17v3M4 12h3M17 12h3"/>',
  slug: '<circle cx="8" cy="12" r="3" fill="currentColor"/><path d="M13 8l4 4-4 4M17 8l3 4-3 4"/>',
  pistol: '<path d="M4 18l6-10 4 6 6-8"/><circle cx="20" cy="6" r="1.5" fill="currentColor"/><circle cx="4" cy="18" r="2" fill="currentColor"/>',
  flare: '<path d="M4 20l9-9"/><path d="M13 11l2-6 4 4-6 2z" fill="currentColor"/><path d="M17 15v4M15 17h4"/>',
  shockCoil: '<path d="M12 4l-4 8h4l-2 8 6-10h-4l2-6z" fill="currentColor"/><path d="M5 9c-2 2-2 4 0 6M19 9c2 2 2 4 0 6"/>',
  flameBurst: '<path d="M4 18l6-6"/><path d="M14 5c3 3 5 5 5 8a4 4 0 0 1-8 0c0-3 1-5 3-8z" fill="currentColor"/>',
  iceShard: '<path d="M4 12h9"/><path d="M13 9l6 3-6 3z" fill="currentColor"/><path d="M6 17v3M4 20h4"/>',
  knives: '<path d="M6 18L15 5l1 4-7 11z" fill="currentColor"/><path d="M14 19l4-6M10 8l-4-2"/>',
}

export const kitIcon = (cls: ClassId) => framed('aicon', KIT, KIT_ICONS[cls], CLASSES[cls].abilityName)
export const ultimateIcon = (id: SkillId) => framed('aicon ult', ULTIMATE, ULTIMATE_ICONS[id]!, SKILLS[id].name)
export const duoIcon = (id: DuoId) => framed('aicon', DUO, DUO_ICONS[id], DUOS[id].name)
export const bonusIcon = (id: SecondaryId) => framed('aicon', BONUS, BONUS_ICONS[id], SECONDARIES[id].name)
