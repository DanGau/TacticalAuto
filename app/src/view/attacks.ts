// How each weapon's attack looks on screen.
import { melee } from '../core/aliens'
import type { Unit } from '../core/battle'
import type { WeaponId } from '../core/weapons'

/**
 * How a unit's attack looks. A shot is a projectile from the muzzle; a strike is the attacker lunging in.
 * `bolts` fly at once in a spread of `spread` pixels, or `stagger` ms apart. `hands` fires from each hand in turn. `hitstop` freezes the beat on a hit, and
 * `shake` jolts the camera, both doubling on a crit; `kick` knocks the target back in pixels.
 */
export interface Attack {
  style: 'bolt' | 'beam' | 'orb' | 'strike'
  hands?: true
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
  /** How high an orb arcs, in pixels. */
  arc?: number
}

const base = { core: 0xffffff, width: 3, ms: 160, bolts: 1, spread: 0, stagger: 0, flash: 7, hitstop: 40, shake: 0, kick: 3, sparks: 5 }

const ATTACKS = {
  /** A burst, each round plain. */
  rifle: { ...base, style: 'bolt', color: 0xffd84d, ms: 110, hitstop: 12, kick: 2, sparks: 3 },
  /** Two shots, a hand each, with room between them. */
  pistols: { ...base, style: 'bolt', color: 0xfff6d0, width: 3, ms: 110, flash: 9, hitstop: 25, shake: 1, kick: 5, sparks: 5, hands: true },
  /** One wide blast. */
  shotgun: { ...base, style: 'bolt', color: 0xffb347, width: 2, ms: 110, bolts: 8, spread: 56, flash: 14, hitstop: 60, shake: 4, kick: 8, sparks: 10 },
  /** A rapid rattle at short range. */
  smg: { ...base, style: 'bolt', color: 0xfff0a0, width: 2, ms: 70, flash: 5, hitstop: 6, kick: 1, sparks: 2 },
  /** A long heavy stream. */
  minigun: { ...base, style: 'bolt', color: 0xffe08a, width: 2, ms: 90, flash: 8, hitstop: 8, shake: 1, kick: 2, sparks: 3 },
  rail: { ...base, style: 'beam', color: 0x7fe7ff, width: 2, ms: 260, flash: 10, hitstop: 90, shake: 3, kick: 6, sparks: 8 },
  plasma: { ...base, style: 'orb', color: 0x7dff6a, core: 0xeaffd8, width: 5, ms: 260, flash: 9, hitstop: 50, kick: 4, sparks: 8 },
  claw: { ...base, style: 'strike', color: 0xd6ffc8, width: 2, ms: 90, bolts: 3, flash: 4, hitstop: 40, kick: 4, sparks: 4 },
  maul: { ...base, style: 'strike', color: 0xffe0a0, width: 6, ms: 140, flash: 12, hitstop: 120, shake: 8, kick: 12, sparks: 12 },
  /** A sword: two quick cuts. */
  blade: { ...base, style: 'strike', color: 0xe8f4ff, width: 3, ms: 110, bolts: 2, flash: 8, hitstop: 70, shake: 3, kick: 8, sparks: 8 },
  /** A shield bash. */
  bash: { ...base, style: 'strike', color: 0x9ad7ff, width: 7, ms: 130, flash: 10, hitstop: 90, shake: 5, kick: 10, sparks: 9 },
  /** Power fists: one punch, then the other. */
  fists: { ...base, style: 'strike', color: 0xffc46b, width: 4, ms: 80, flash: 6, hitstop: 30, shake: 3, kick: 7, sparks: 7 },
  lance: { ...base, style: 'beam', color: 0xc77dff, core: 0xffe6ff, width: 7, ms: 420, flash: 18, hitstop: 110, shake: 9, kick: 10, sparks: 14 },
} satisfies Record<string, Attack>

const WEAPON_ATTACK: Record<WeaponId, keyof typeof ATTACKS> = { pistols: 'pistols', rifle: 'rifle', sniper: 'rail', shotgun: 'shotgun', smg: 'smg', lmg: 'minigun', hammer: 'maul', sword: 'blade', shield: 'bash', fists: 'fists' }

/** How a unit's attack looks: a soldier's by its weapon; an alien's by kind, a boss's lance. */
export function attackOf(unit: Unit): Attack {
  if (unit.boss) return ATTACKS.lance
  if (unit.kind && melee(unit.kind)) return unit.stats.strength >= 3 ? ATTACKS.maul : ATTACKS.claw
  if (unit.kind) return ATTACKS.plasma
  return ATTACKS[unit.weapon ? WEAPON_ATTACK[unit.weapon] : 'rifle']
}
