// Each weapon's icon: a solid silhouette in a ring.
import { WEAPONS, type WeaponId } from '../core/weapons'
import { framed, type Frame } from './icon-frame'

const RING: Frame = { outline: '<circle cx="12" cy="12" r="10.8" fill="currentColor" fill-opacity=".12" stroke-width="1.4"/><circle cx="12" cy="12" r="8.9" stroke-width=".6" stroke-opacity=".6"/>', scale: 0.7, stroke: 0 }

export const WEAPON_ICONS: Record<WeaponId, string> = {
  rifle: '<g fill="currentColor" stroke="none" transform="rotate(-45 12 12)"><path d="M2 11h4l2-1h11v2h-8l-1 4H8l1-3H6l-3 3H1z"/><rect x="11" y="13" width="2" height="4"/></g>',
  sniper: '<g fill="currentColor" stroke="none" transform="rotate(-45 12 12)"><path d="M1 12h4l2-1h16v1.5H9l-1 3H6.5l.5-2.5H5l-3 3H1z"/><rect x="7" y="8" width="7" height="2" rx="1"/><rect x="9" y="10" width="1" height="1"/></g>',
  shotgun: '<g fill="currentColor" stroke="none" transform="rotate(-45 12 12)"><path d="M2 11h5l1-1.5h11V14H9l-1 2H6l.5-2H5l-3 2z"/><rect x="11" y="14.5" width="5" height="1.5"/></g>',
  smg: '<g fill="currentColor" stroke="none" transform="rotate(-45 12 12)"><path d="M4 10h13v1.5h3V13h-6l-1 2h-2l1-2H8l-1 3H5l1-3H4z"/><rect x="11" y="13" width="2.5" height="8"/></g>',
  lmg: '<g fill="currentColor" stroke="none" transform="rotate(-45 12 12)"><path d="M1 11h5l1-1h10v1h6v1.5H10l-1 3H7l.5-2.5H5l-3 3H1z"/><rect x="9" y="8" width="5" height="2"/><path d="M17 12.5l-2 5h1l2-4 2 4h1l-3-5z"/><path d="M10 15.5h3v1.5h-3z"/></g>',
  pistols: '<g fill="currentColor" stroke="none"><path d="M3 15l9-9 2 2-6 6 1 1-2 2-1-1-2 2z"/><path d="M21 15l-9-9-2 2 6 6-1 1 2 2 1-1 2 2z" fill-opacity="0.75"/></g>',
  hammer: '<g fill="currentColor" stroke="none" transform="rotate(45 12 12)"><rect x="6" y="3" width="12" height="6" rx="1"/><rect x="11" y="9" width="2" height="12" rx="1"/></g>',
  sword: '<g fill="currentColor" stroke="none" transform="rotate(45 12 12)"><path d="M12 1l2 3v10h-4V4z"/><rect x="7" y="14" width="10" height="2" rx="1"/><rect x="11" y="16" width="2" height="5"/><circle cx="12" cy="22" r="1.3"/></g>',
  shield: '<path fill="currentColor" stroke="none" fill-rule="evenodd" d="M12 3l8 3v6c0 5-4 8-8 9-4-1-8-4-8-9V6zM12 6v12c3-1 5-3 5-6V8z"/>',
  fists: '<g fill="currentColor" stroke="none"><path d="M6 7a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v6a6 6 0 0 1-6 6h-1l-1 2H7l-1-3c-1-1-2-3-2-5V9z"/><path fill="currentColor" d="M3 12h3v3H3z"/></g>',
}

/** The weapon's icon as inline SVG, titled with its name. */
export const weaponIcon = (id: WeaponId) => framed('wicon', RING, WEAPON_ICONS[id], WEAPONS[id].name)
