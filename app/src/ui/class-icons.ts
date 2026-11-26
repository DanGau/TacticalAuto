// Each class's icon: line art with a solid heart in a diamond.
import { CLASSES, type ClassId } from '../core/classes'
import { framed, type Frame } from './icon-frame'

const DIAMOND = 'M12 1l11 11-11 11L1 12z'
const TINT = 'fill="currentColor" fill-opacity=".16"'
const KIT: Frame = { outline: `<path d="${DIAMOND}" ${TINT} stroke-width="1.6"/>`, scale: 0.58, stroke: 2.6 }


export const CLASS_ICONS: Record<ClassId, string> = {
  assault: '<path d="M4 18h3l3-6 3 6h3" /><path d="M7 10l3-4 3 4M13 10l3-4 3 4"/><circle cx="10" cy="17" r="2" fill="currentColor"/>',
  heavy: '<circle cx="15" cy="15" r="4" fill="currentColor"/><path d="M5 5l6 6M9 4l4 4M4 9l4 4"/>',
  sniper: '<path d="M4 12s3-5 8-5 8 5 8 5-3 5-8 5-8-5-8-5z"/><circle cx="12" cy="12" r="2.5" fill="currentColor"/><path d="M12 4v2M12 18v2"/>',
  support: '<path d="M10 7h4v3h3v4h-3v3h-4v-3H7v-4h3z" fill="currentColor"/><path d="M5 5l1.5 1.5M19 5l-1.5 1.5M5 19l1.5-1.5M19 19l-1.5-1.5"/>',
  engineer: '<rect x="8" y="5" width="8" height="6" rx="1" fill="currentColor"/><path d="M9 11v4l-2 4M15 11v4l2 4M8 8H5M16 8h3"/>',
  pyro: '<circle cx="14" cy="14" r="4.5" fill="currentColor"/><path d="M4 6l6 4M6 4l5 6M4 10l5 2"/>',
  cryo: '<path d="M6 20v-8l2-6 2 5 2-5 1 6"/><path d="M15 6v8M11.5 8l7 4M11.5 12l7-4"/><circle cx="8" cy="15" r="2" fill="currentColor"/>',
  phantom: '<path d="M5 19c0-8 3-14 7-14s7 6 7 14z"/><path d="M8.5 13c1-1.5 2-2 3.5-2s2.5.5 3.5 2c-1 1.5-2 2-3.5 2s-2.5-.5-3.5-2z" fill="currentColor"/>',
}

export const classIcon = (cls: ClassId) => framed('aicon', KIT, CLASS_ICONS[cls], CLASSES[cls].name)
