import type { Unit } from '../core/battle'
import type { ClassId } from '../core/classes'

/**
 * How a unit's attack looks. A shot is a projectile from the muzzle; a strike is the attacker lunging in.
 * `bolts` fly at once in a spread of `spread` pixels, or `stagger` ms apart. `hitstop` freezes the beat on a hit, and
 * `shake` jolts the camera, both doubling on a crit; `kick` knocks the target back in pixels.
 */
export interface Weapon {
  style: 'bolt' | 'beam' | 'orb' | 'strike'
  color: number
  /** Brighter core of the bolt, beam or orb. */
  core: number
  width: number
  ms: number
  bolts: number
  spread: number
  stagger: number
  /** Muzzle flash radius; for a strike, how far the attacker winds back first. */
  flash: number
  hitstop: number
  shake: number
  kick: number
  sparks: number
}

const base = { core: 0xffffff, width: 3, ms: 160, bolts: 1, spread: 0, stagger: 0, flash: 7, hitstop: 40, shake: 0, kick: 3, sparks: 5 }

export const WEAPONS = {
  rifle: { ...base, style: 'bolt', color: 0xffd84d },
  shotgun: { ...base, style: 'bolt', color: 0xffb347, width: 2, ms: 110, bolts: 6, spread: 26, flash: 14, hitstop: 60, shake: 4, kick: 8, sparks: 10 },
  minigun: { ...base, style: 'bolt', color: 0xffe08a, width: 2, ms: 120, bolts: 5, spread: 8, stagger: 55, flash: 9, shake: 2, kick: 5, sparks: 7 },
  /** An engineer's arc welder, and a mech's twin cannons. */
  arc: { ...base, style: 'beam', color: 0x9ad7ff, core: 0xe8f6ff, width: 2, ms: 180, flash: 8, kick: 4, sparks: 9 },
  cannon: { ...base, style: 'bolt', color: 0xff9a3d, width: 4, ms: 150, bolts: 2, spread: 6, stagger: 70, flash: 12, hitstop: 55, shake: 3, kick: 7, sparks: 9 },
  rail: { ...base, style: 'beam', color: 0x7fe7ff, width: 2, ms: 260, flash: 10, hitstop: 90, shake: 3, kick: 6, sparks: 8 },
  plasma: { ...base, style: 'orb', color: 0x7dff6a, core: 0xeaffd8, width: 5, ms: 260, flash: 9, hitstop: 50, kick: 4, sparks: 8 },
  claw: { ...base, style: 'strike', color: 0xd6ffc8, width: 2, ms: 90, bolts: 3, flash: 4, hitstop: 40, kick: 4, sparks: 4 },
  maul: { ...base, style: 'strike', color: 0xffe0a0, width: 6, ms: 140, flash: 12, hitstop: 120, shake: 8, kick: 12, sparks: 12 },
  /** A blademaster's sword: two quick cuts. */
  blade: { ...base, style: 'strike', color: 0xe8f4ff, width: 3, ms: 110, bolts: 2, flash: 8, hitstop: 70, shake: 3, kick: 8, sparks: 8 },
  /** A pyro's flamer: a wide gout of flame. */
  flamer: { ...base, style: 'beam', color: 0xff6a1f, core: 0xffe08a, width: 8, ms: 240, flash: 14, hitstop: 50, shake: 2, kick: 4, sparks: 14 },
  /** A cryo's freeze gun: a frosty orb. */
  freezer: { ...base, style: 'orb', color: 0xbfeaff, core: 0xffffff, width: 5, ms: 240, flash: 8, hitstop: 70, kick: 3, sparks: 10 },
  lance: { ...base, style: 'beam', color: 0xc77dff, core: 0xffe6ff, width: 7, ms: 420, flash: 18, hitstop: 110, shake: 9, kick: 10, sparks: 14 },
} satisfies Record<string, Weapon>

const CLASS_WEAPON: Record<ClassId, keyof typeof WEAPONS> = { assault: 'shotgun', heavy: 'minigun', sniper: 'rail', support: 'rifle', engineer: 'arc', pyro: 'flamer', cryo: 'freezer' }

/** The weapon a unit attacks with: a soldier's by class, or a blade if the squad are `blademasters`; an alien's by kind, a boss's lance, a mech's cannons. */
export function weaponOf(unit: Unit, cls: ClassId | null, blademasters = false): Weapon {
  if (unit.boss) return WEAPONS.lance
  if (unit.kind === 'swarmling') return WEAPONS.claw
  if (unit.kind === 'brute') return WEAPONS.maul
  if (unit.kind) return WEAPONS.plasma
  if (unit.summoner !== null) return WEAPONS.cannon
  if (blademasters && unit.soldier !== null) return WEAPONS.blade
  return WEAPONS[cls ? CLASS_WEAPON[cls] : 'rifle']
}
