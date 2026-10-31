// The battle's colours: of units and marks, of the ground, and of how height and fog tint them.
import type { AlienKind } from '../core/aliens'
import type { Ground } from '../core/terrain'

/** The night the world sits in: the background, and what the distance fades into. */
export const NIGHT = 0x10141c

export const COLOR = {
  hider: 0xe0a24a,
  runner: 0xe8e2c8,
  vip: 0x6ec8ff,
  mech: 0x9aa9bf,
  human: 0x4da3ff,
  alien: 0x7ddc5a,
  boss: 0xc77dff,
  zone: 0x2f6fb0,
  zoneHover: 0x4d9be6,
  fog: 0x05070b,
  /** Glow under an alien the squad hasn't found, so the player sees trouble coming. */
  lurk: 0xff3030,
  /** Tint of a cover block or unit standing in fog. */
  dim: 0x5a5f6b,
  line: 0x10141c,
  hit: 0xffd84d,
  crit: 0xff7a3d,
  miss: 0x77808f,
  heal: 0x7ddc5a,
  acid: 0xa6e22e,
  fire: 0xff6a1f,
  spike: 0xc9d1dc,
  /** Ring under a rooted unit, and under one charged by a booming hit. */
  rooted: 0x8fd14f,
  booming: 0xff9a3d,
  psi: 0xff6bd6,
  /** A cloaked unit's tint. */
  cloak: 0x8fe8ff,
  contact: 0xff6b5e,
  /** Health left and lost, on an ally and on an enemy. */
  allyHp: 0x4fe08a,
  allyLost: 0x1f3a2a,
  enemyHp: 0xff5555,
  enemyLost: 0x3a2226,
  uplink: 0xffd84d,
  extract: 0x5dff9a,
}

/** Each ground's colour, where its region's look gives none. */
export const GROUND_COLOR: Record<Ground, number> = { pavement: 0x2b3240, road: 0x1c2029, grass: 0x25402c, floor: 0x4b4136, scorched: 0x34302c, hive: 0x2a1838, water: 0x1d5f5c, void: 0x000000 }

/** How each kind of alien is drawn: its colour, and its size against a soldier's. */
export const ALIEN_LOOK: Record<AlienKind, { color: number; scale: number }> = {
  trooper: { color: 0x7ddc5a, scale: 1 },
  swarmling: { color: 0x3f8f4a, scale: 0.6 },
  spitter: { color: 0xa6e22e, scale: 0.9 },
  burster: { color: 0xff9a3d, scale: 0.8 },
  brute: { color: 0xb5533c, scale: 1.4 },
  psion: { color: 0xff6bd6, scale: 1 },
  juggernaut: { color: 0x8a8f99, scale: 1.5 },
  incubator: { color: 0xd8c27a, scale: 1.1 },
  wraith: { color: 0xb8c8ff, scale: 1 },
  burrower: { color: 0x9c6b3f, scale: 1.1 },
  feeder: { color: 0xc23b6e, scale: 1.1 },
  regenerator: { color: 0x2fc7a0, scale: 1.1 },
  sprinter: { color: 0xf2e04b, scale: 0.8 },
  hiveNode: { color: 0x6b3fa0, scale: 1.3 },
  mirror: { color: 0xe6f0ff, scale: 1 },
  turret: { color: 0x5f7a6a, scale: 1.1 },
  harvester: { color: 0x7a2fd1, scale: 1.1 },
  husk: { color: 0x9a9a7a, scale: 0.9 },
}

/** A colour lightened toward white, a step for each level of height, so high ground reads at a glance. */
export const highland = (color: number, level: number) => {
  const lift = (c: number) => Math.round(c + (255 - c) * 0.12 * level)
  return (lift(color >> 16) << 16) | (lift((color >> 8) & 255) << 8) | lift(color & 255)
}

/** Colour `own` darkened by `tint`, channel by channel, as a tint multiplies. */
export function mixTint(own: number, tint: number): number {
  const ch = (shift: number) => Math.round((((own >> shift) & 255) * ((tint >> shift) & 255)) / 255) << shift
  return ch(16) | ch(8) | ch(0)
}
