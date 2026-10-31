// How each weapon's attack looks on screen.
import type { Unit } from '../core/battle'
import type { SecondaryId } from '../core/secondaries'
import type { WeaponId } from '../core/weapons'

/**
 * How a unit's attack looks. A shot is a projectile from the muzzle; a strike is the attacker lunging in.
 * `bolts` fly at once in a spread of `spread` pixels, or `stagger` ms apart. `hitstop` freezes the beat on a hit, and
 * `shake` jolts the camera, both doubling on a crit; `kick` knocks the target back in pixels.
 */
export interface Attack {
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
  /** How high a thrown thing arcs, in pixels. */
  arc?: number
}

const base = { core: 0xffffff, width: 3, ms: 160, bolts: 1, spread: 0, stagger: 0, flash: 7, hitstop: 40, shake: 0, kick: 3, sparks: 5 }

const ATTACKS = {
  rifle: { ...base, style: 'bolt', color: 0xffd84d },
  shotgun: { ...base, style: 'bolt', color: 0xffb347, width: 2, ms: 110, bolts: 6, spread: 26, flash: 14, hitstop: 60, shake: 4, kick: 8, sparks: 10 },
  smg: { ...base, style: 'bolt', color: 0xfff0a0, width: 2, ms: 100, bolts: 3, spread: 6, stagger: 45, flash: 7, kick: 3, sparks: 5 },
  minigun: { ...base, style: 'bolt', color: 0xffe08a, width: 2, ms: 120, bolts: 5, spread: 8, stagger: 55, flash: 9, shake: 2, kick: 5, sparks: 7 },
  /** A mech's twin cannons. */
  cannon: { ...base, style: 'bolt', color: 0xff9a3d, width: 4, ms: 150, bolts: 2, spread: 6, stagger: 70, flash: 12, hitstop: 55, shake: 3, kick: 7, sparks: 9 },
  rail: { ...base, style: 'beam', color: 0x7fe7ff, width: 2, ms: 260, flash: 10, hitstop: 90, shake: 3, kick: 6, sparks: 8 },
  plasma: { ...base, style: 'orb', color: 0x7dff6a, core: 0xeaffd8, width: 5, ms: 260, flash: 9, hitstop: 50, kick: 4, sparks: 8 },
  claw: { ...base, style: 'strike', color: 0xd6ffc8, width: 2, ms: 90, bolts: 3, flash: 4, hitstop: 40, kick: 4, sparks: 4 },
  maul: { ...base, style: 'strike', color: 0xffe0a0, width: 6, ms: 140, flash: 12, hitstop: 120, shake: 8, kick: 12, sparks: 12 },
  /** A sword: two quick cuts. */
  blade: { ...base, style: 'strike', color: 0xe8f4ff, width: 3, ms: 110, bolts: 2, flash: 8, hitstop: 70, shake: 3, kick: 8, sparks: 8 },
  /** A shield bash. */
  bash: { ...base, style: 'strike', color: 0x9ad7ff, width: 7, ms: 130, flash: 10, hitstop: 90, shake: 5, kick: 10, sparks: 9 },
  /** Power fists: a flurry of punches. */
  fists: { ...base, style: 'strike', color: 0xffc46b, width: 4, ms: 80, bolts: 3, flash: 6, hitstop: 60, shake: 3, kick: 7, sparks: 7 },
  lance: { ...base, style: 'beam', color: 0xc77dff, core: 0xffe6ff, width: 7, ms: 420, flash: 18, hitstop: 110, shake: 9, kick: 10, sparks: 14 },
} satisfies Record<string, Attack>

const WEAPON_ATTACK: Record<WeaponId, keyof typeof ATTACKS> = { rifle: 'rifle', sniper: 'rail', shotgun: 'shotgun', smg: 'smg', lmg: 'minigun', hammer: 'maul', sword: 'blade', shield: 'bash', fists: 'fists' }

const SECONDARY_ATTACKS: Record<SecondaryId, Attack> = {
  sidearm: { ...base, style: 'bolt', color: 0xf4f4f4, width: 2, ms: 90, flash: 5 },
  frag: { ...base, style: 'orb', color: 0x9acd5a, core: 0xfff4c0, width: 4, ms: 230, arc: 34, flash: 3, hitstop: 70, shake: 6, kick: 10, sparks: 16 },
  shieldThrow: { ...base, style: 'orb', color: 0x5aa9ff, width: 7, ms: 170, flash: 3, hitstop: 80, shake: 5, kick: 12, sparks: 10 },
  pistol: { ...base, style: 'bolt', color: 0xffffff, width: 2, ms: 70, bolts: 2, stagger: 50, flash: 6, hitstop: 50, shake: 2, kick: 5, sparks: 7 },
  flare: { ...base, style: 'orb', color: 0xff5a5a, core: 0xffe0e0, width: 4, ms: 200, arc: 18, flash: 4, sparks: 12 },
  shockCoil: { ...base, style: 'beam', color: 0xfff27a, ms: 170, flash: 8, hitstop: 70, shake: 3, kick: 5, sparks: 10 },
  flameBurst: { ...base, style: 'bolt', color: 0xff7a2a, core: 0xffd38a, width: 4, ms: 120, bolts: 5, spread: 20, stagger: 15, flash: 12, hitstop: 50, shake: 3, kick: 6, sparks: 12 },
  iceShard: { ...base, style: 'bolt', color: 0xa8ecff, width: 5, ms: 130, flash: 6, hitstop: 80, shake: 3, kick: 5, sparks: 12 },
  knives: { ...base, style: 'bolt', color: 0xd8dde8, width: 2, ms: 90, bolts: 3, spread: 12, stagger: 40, flash: 1, hitstop: 60, shake: 2, kick: 6, sparks: 6 },
}

/** How a hero's secondary looks. */
export const secondaryAttack = (id: SecondaryId) => SECONDARY_ATTACKS[id]

/** A combo's first blow comes out quicker; its second lands harder. */
export const opener = (gun: Attack): Attack => ({ ...gun, ms: gun.ms * 0.6 })
export const finisher = (gun: Attack): Attack => ({ ...gun, hitstop: gun.hitstop * 1.6, shake: gun.shake + 4, kick: gun.kick * 1.5, sparks: gun.sparks * 2 })

/** How a unit's attack looks: a soldier's by its weapon, or a blade if the squad are `blademasters`; an alien's by kind, a boss's lance, a mech's cannons. */
export function attackOf(unit: Unit, weapon: WeaponId | null, blademasters = false): Attack {
  if (unit.boss) return ATTACKS.lance
  if (unit.kind === 'swarmling') return ATTACKS.claw
  if (unit.kind === 'brute') return ATTACKS.maul
  if (unit.kind) return ATTACKS.plasma
  if (unit.summoner !== null) return ATTACKS.cannon
  if (blademasters && unit.soldier !== null) return ATTACKS.blade
  return ATTACKS[weapon ? WEAPON_ATTACK[weapon] : 'rifle']
}
