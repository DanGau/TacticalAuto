import type { RegionId } from '../core/regions'
import type { Ground } from '../core/terrain'
import type { RoofStyle } from './roofs'

/**
 * How a region looks: its buildings' walls, a colour picked for each building in turn; their floors; the ground
 * between them; how tall its walls stand, in screen pixels; and the light its windows glow with.
 */
export interface Look {
  walls: number[]
  floor: number
  ground: Partial<Record<Ground, number>>
  up: number
  glass: number
  /** The trim along its walls' tops: tiled eaves, snow, a parapet, a neon strip. */
  cap: number
  tree: TreeStyle
  /** Its leaves' colour. */
  leaves: number
  fence: FenceStyle
  fenceColor: number
  /** Its crates' colours, its rocks' and rubble's, and its cars'. */
  crates: number[]
  rock: number
  cars: number[]
  /** Its roofs' colours, one picked for each building; flat concrete, a shade of its walls, where it gives none. */
  roofs?: number[]
  /** The ways it roofs its buildings, one picked for each, likelier if listed more. */
  roof: RoofStyle[]
}

export type TreeStyle = 'round' | 'pine' | 'palm' | 'cypress' | 'blossom' | 'acacia'
export type FenceStyle = 'picket' | 'hedge' | 'stone' | 'rail' | 'bamboo' | 'iron'

export const LOOKS: Record<RegionId, Look> = {
  suburb: { walls: [0xc8b89a, 0xa9b8c4, 0xd6cfc0, 0x9fae8f], floor: 0x5a4a3a, ground: { grass: 0x2f5a34, road: 0x23262d }, up: 26, glass: 0x9fd4f0, cap: 0x6a4a3a, tree: 'round', leaves: 0x2f6b3c, fence: 'picket', fenceColor: 0xeeeeea, crates: [0x9a7742], rock: 0x7c8087, cars: [0xb8413a, 0x3f6fb5, 0xc9c9c2, 0x2a2a2e], roofs: [0x4a3e38, 0x3a3e46], roof: ['gable', 'gable', 'hip', 'hip'] },
  downtown: { walls: [0x6f7b8c, 0x8a8f99, 0x5d6878, 0xa1927e], floor: 0x3e434d, ground: { pavement: 0x3a3f4a, road: 0x18191d }, up: 44, glass: 0xffe08a, cap: 0x3a3f4a, tree: 'round', leaves: 0x3d6b3c, fence: 'iron', fenceColor: 0x22252b, crates: [0x8a7a5a, 0x5a6a7a], rock: 0x6b6f76, cars: [0xf2c230, 0xf2c230, 0x2a2a2e, 0xc9c9c2], roof: ['flat', 'flat', 'clutter'] },
  oldTown: { walls: [0xc98f5a, 0xe0c08a, 0xb5764a, 0xd9a66b], floor: 0x5c4232, ground: { pavement: 0x5a4d42, road: 0x4a4038 }, up: 34, glass: 0xffd27a, cap: 0xb5502e, tree: 'cypress', leaves: 0x2d5a34, fence: 'stone', fenceColor: 0xa89a82, crates: [0x8a6a42, 0x6a8a3a], rock: 0x9a8a72, cars: [0xe8e0d0, 0x8a2a2a, 0x2f5a8a], roofs: [0xa8442e, 0xb5502e, 0x9a3e2a], roof: ['gable', 'hip', 'hip', 'flat'] },
  boulevards: { walls: [0xe4d8bd, 0xd8cba8, 0xcbbd99], floor: 0x5a4c3c, ground: { pavement: 0x55534e, road: 0x2a2a2c, grass: 0x34502f }, up: 38, glass: 0xfff0c0, cap: 0x4a5560, tree: 'round', leaves: 0x4a7a3a, fence: 'hedge', fenceColor: 0x2f5a2c, crates: [0x7a6a52], rock: 0x9a968a, cars: [0x2a2a2e, 0x5a6a7a, 0xc9c9c2], roofs: [0x4e5a66, 0x5a6672], roof: ['mansard', 'mansard', 'mansard', 'flat'] },
  canals: { walls: [0x8a3b2c, 0x5c2f25, 0xa65a3a, 0x3b3a44], floor: 0x4a3a30, ground: { pavement: 0x4d4844, water: 0x1f4d5a }, up: 34, glass: 0xffd27a, cap: 0xe8e4dc, tree: 'round', leaves: 0x3d6b3c, fence: 'iron', fenceColor: 0x1e2226, crates: [0x6a4a32, 0x8a5a3a], rock: 0x6a5a52, cars: [0x2a4a6a, 0xe0e0e0], roofs: [0x3a3a40, 0x5a3a30], roof: ['gable', 'gable', 'gable', 'hip'] },
  tokyo: { walls: [0x6c7a8e, 0x8796a8, 0x515c6e, 0x9aa3b0], floor: 0x2f343e, ground: { pavement: 0x30353f, road: 0x15161b }, up: 46, glass: 0xff4fd8, cap: 0x4fe7ff, tree: 'blossom', leaves: 0xf0a8c8, fence: 'rail', fenceColor: 0xb8c0c8, crates: [0x3a6ad8, 0xd8d8d8, 0xe85a3a], rock: 0x7a808a, cars: [0xe8e8ec, 0x1e1e22, 0x3a6ad8, 0xe8e8ec], roof: ['clutter', 'clutter', 'flat', 'eaves'] },
  hutong: { walls: [0x6a6e74, 0x7a7d82, 0x8a5a44], floor: 0x4a3c34, ground: { pavement: 0x55575b, road: 0x47494d, grass: 0x3a5234 }, up: 24, glass: 0xff6b4a, cap: 0x3a3e44, tree: 'acacia', leaves: 0x4a6a34, fence: 'stone', fenceColor: 0x6a6e74, crates: [0x8a3a2a, 0x6a4a32], rock: 0x6a6a6a, cars: [0x8a2a2a, 0x2a2a2e, 0x5a7a5a], roofs: [0x3a3e44, 0x45494f], roof: ['eaves', 'eaves', 'eaves', 'gable'] },
  bazaar: { walls: [0xe07b39, 0xd94f6b, 0x3fa7a0, 0xf0c040, 0x8e5ac8], floor: 0x5a4030, ground: { pavement: 0x6b5a48, road: 0x584a3c }, up: 28, glass: 0xffc04d, cap: 0xf0f0e8, tree: 'round', leaves: 0x3a7a34, fence: 'bamboo', fenceColor: 0xc8b070, crates: [0xe07b39, 0xd94f6b, 0x3fa7a0, 0xf0c040], rock: 0x9a7a5a, cars: [0xf2d030, 0x2f8a3a, 0xf2d030, 0x2a2a2e], roof: ['clutter', 'flat', 'flat', 'tin'] },
  medina: { walls: [0xd8b47e, 0xcfa46c, 0xe2c497], floor: 0x7a5a3c, ground: { pavement: 0x8a7050, road: 0x7a6246, grass: 0x5a6a3a }, up: 30, glass: 0x6fc4d8, cap: 0xeadcb8, tree: 'palm', leaves: 0x5a8a3a, fence: 'stone', fenceColor: 0xc8a470, crates: [0x8a5a3a, 0x3a6a8a, 0xb84a3a], rock: 0xb8946a, cars: [0xe8e0d0, 0xb8a070], roof: ['flat', 'flat', 'dome'] },
  oasis: { walls: [0xb8865a, 0xa87448, 0xc89a6a], floor: 0x6a4a30, ground: { pavement: 0x9a7a52, road: 0x8a6a46, grass: 0x6a7a3a }, up: 30, glass: 0xffb35a, cap: 0x8a5a3a, tree: 'palm', leaves: 0x6a9a3a, fence: 'stone', fenceColor: 0xa87a4a, crates: [0x8a6a42], rock: 0xc09060, cars: [0xd8c8a0, 0x8a6a42], roof: ['flat', 'flat', 'dome'] },
  island: { walls: [0xf2f2ee, 0xeaeef2, 0xf6f0e6], floor: 0x6a7a8a, ground: { pavement: 0xb0aaa0, road: 0x9a9488, grass: 0x6a7a4a }, up: 24, glass: 0x3a7ad8, cap: 0x2f6fd8, tree: 'cypress', leaves: 0x3a5a2c, fence: 'stone', fenceColor: 0xf0f0ea, crates: [0x3a7ad8, 0xe8e0d0], rock: 0xc8c0b0, cars: [0xf0f0ea, 0x3a7ad8], roof: ['flat', 'flat', 'dome'] },
  estate: { walls: [0x9a9a94, 0xb0aca2, 0x8a8e94], floor: 0x45484c, ground: { pavement: 0x45484e, road: 0x2a2c30, grass: 0x34452f }, up: 40, glass: 0xffe4a0, cap: 0x6a6e74, tree: 'round', leaves: 0x4a6a34, fence: 'rail', fenceColor: 0x5a6a7a, crates: [0x6a6e5a, 0x8a5a3a], rock: 0x8a8e94, cars: [0xc9c9c2, 0x4a6a8a, 0x8a3a2a, 0xd8c8a0], roof: ['flat', 'flat', 'clutter'] },
  favela: { walls: [0xd94f3d, 0x3f8fd9, 0xe3c13b, 0x5fb36a, 0xe08a3c, 0xc76bd0], floor: 0x5a4636, ground: { pavement: 0x5a4c40, road: 0x4c4036, grass: 0x3a5a2e }, up: 22, glass: 0xfff0a0, cap: 0x8a8e94, tree: 'palm', leaves: 0x3a7a34, fence: 'rail', fenceColor: 0x7a7e84, crates: [0x3f8fd9, 0xe3c13b, 0xd94f3d], rock: 0x8a6a52, cars: [0xe8e0d0, 0xe3c13b, 0x3a3a3e], roofs: [0x8a8e94, 0x9a6a4a], roof: ['tin', 'tin', 'flat', 'clutter'] },
  township: { walls: [0x9aa3ad, 0x7d8f6a, 0xb8865a, 0x5f8fb0], floor: 0x4a3e34, ground: { pavement: 0x7a5a42, road: 0x6a4e3a, grass: 0x5a6a34 }, up: 22, glass: 0xffd27a, cap: 0x9aa3ad, tree: 'acacia', leaves: 0x5a7a34, fence: 'rail', fenceColor: 0x8a8e94, crates: [0x5f8fb0, 0xb8865a, 0xd8c040], rock: 0x8a5a3a, cars: [0xe8e8e0, 0xd8c040, 0x3a5a8a], roofs: [0x9aa3ad, 0x8a6a4a, 0x6a8aa0], roof: ['tin', 'tin', 'gable'] },
  village: { walls: [0x9e3b2e, 0x6b4a30, 0xe8dcc4, 0x7a5236], floor: 0x4e3a2a, ground: { grass: 0x3a5a2e, road: 0x5a4c3e, pavement: 0x4e4a44 }, up: 26, glass: 0xffd27a, cap: 0x3a2a22, tree: 'pine', leaves: 0x2a4a2c, fence: 'picket', fenceColor: 0x8a6a4a, crates: [0x7a5a3a], rock: 0x8a8a8a, cars: [0x3a5a3a, 0x8a2a2a], roofs: [0x3a2a22, 0x4a4a52], roof: ['gable', 'gable', 'hip'] },
  arctic: { walls: [0xc23b30, 0x2f6fa8, 0xe3b33b, 0xe8e4da], floor: 0x4a4440, ground: { grass: 0xd8dde4, pavement: 0xb8bec8, road: 0x8a909a, water: 0x2a4a62 }, up: 26, glass: 0xffe08a, cap: 0xf4f8fc, tree: 'pine', leaves: 0x2a4a3a, fence: 'picket', fenceColor: 0x8a5a3a, crates: [0x2f6fa8, 0xc23b30], rock: 0x9aa4b0, cars: [0xc23b30, 0x2a2a2e, 0xe3b33b], roofs: [0x2a2a30, 0x8a2a2a], roof: ['gable', 'gable', 'tin', 'flat'] },
  colonial: { walls: [0xf08a9a, 0x6fd0c0, 0xf2d06a, 0x8ab8f0, 0xf0a860], floor: 0x6a4a3a, ground: { grass: 0x2f7a3a, pavement: 0x7a6e60, road: 0x4a4440, water: 0x1f8a90 }, up: 28, glass: 0xfff0b0, cap: 0xf4f0e6, tree: 'palm', leaves: 0x3a9a3a, fence: 'iron', fenceColor: 0x2a3a3a, crates: [0x6fd0c0, 0xf2d06a, 0xf08a9a], rock: 0x9a8a72, cars: [0x6fd0c0, 0xf08a9a, 0xf2d06a, 0x8ab8f0], roofs: [0xa8442e, 0xb86a3a], roof: ['flat', 'hip', 'hip', 'clutter'] },
  freeway: { walls: [0xd8c8a8, 0xb8b0a0, 0x8a9aa8, 0xe8e0d0], floor: 0x4a4440, ground: { pavement: 0x5a5a58, road: 0x26272b, grass: 0x5a6a3a }, up: 24, glass: 0xa8d8f0, cap: 0xc8402e, tree: 'palm', leaves: 0x4a7a3a, fence: 'rail', fenceColor: 0xc8ccd0, crates: [0x9a7742, 0x5a6a7a], rock: 0xa89a82, cars: [0xc9c9c2, 0x2a2a2e, 0xb8413a, 0x3f6fb5, 0xe8e8ec], roof: ['flat', 'flat', 'hip'] },
  barrio: { walls: [0xe0a070, 0x70b8c8, 0xd8d070, 0xc87a8a, 0x9ac878], floor: 0x5a4636, ground: { pavement: 0x6a5a4a, road: 0x4a4038, grass: 0x4a6a34 }, up: 24, glass: 0xffe08a, cap: 0x8a8e94, tree: 'round', leaves: 0x3a6a34, fence: 'iron', fenceColor: 0x2a2a2e, crates: [0xe0a070, 0x70b8c8], rock: 0x8a7a62, cars: [0xe8e0d0, 0x3a6a8a, 0xb8413a], roofs: [0x9a5a3a, 0x8a8e94], roof: ['flat', 'clutter', 'tin'] },
  eixample: { walls: [0xd8b890, 0xc8a478, 0xe0c8a0], floor: 0x5a4a3a, ground: { pavement: 0x6a6460, road: 0x2e2e30, grass: 0x4a6a3a }, up: 40, glass: 0xffe0a0, cap: 0x8a5a3a, tree: 'round', leaves: 0x5a7a3a, fence: 'iron', fenceColor: 0x22252b, crates: [0x8a6a42, 0xc8402e], rock: 0xa89a82, cars: [0xf2d030, 0x2a2a2e, 0xc9c9c2], roofs: [0x9a4a32, 0x8a8a84], roof: ['flat', 'flat', 'clutter'] },
  terraces: { walls: [0x8a4a32, 0x7a3e2c, 0x9a5a3e, 0x6a3a2a], floor: 0x4a3a30, ground: { pavement: 0x4e4c4a, road: 0x2a2a2c, grass: 0x34502f }, up: 28, glass: 0xffe0a0, cap: 0x3a3a40, tree: 'round', leaves: 0x3a5a32, fence: 'hedge', fenceColor: 0x2f4a2a, crates: [0x5a6a7a], rock: 0x6a6a6a, cars: [0x2a2a2e, 0xc9c9c2, 0x3a4a6a, 0x8a2a2a], roofs: [0x3a3c44, 0x44464e], roof: ['gable', 'gable', 'gable', 'hip'] },
  jpSuburb: { walls: [0xe8e4dc, 0xc8c0b0, 0x8a8478, 0xd8d0c0], floor: 0x5a4c3e, ground: { pavement: 0x5a5c5e, road: 0x3a3c40, grass: 0x4a6a3a }, up: 24, glass: 0xffe8c0, cap: 0x3a4a5a, tree: 'blossom', leaves: 0xf0b8d0, fence: 'stone', fenceColor: 0x9a968e, crates: [0x3a6ad8, 0xd8d8d8], rock: 0x8a8a86, cars: [0xe8e8ec, 0x6a8aa8, 0xe8e8ec, 0x2a2a2e], roofs: [0x3a4a5a, 0x2e3a46, 0x6a3a2a], roof: ['eaves', 'eaves', 'gable', 'hip'] },
  shophouses: { walls: [0xe8c86a, 0x7ac0a8, 0xe89a7a, 0xd8d8c8, 0x8ab0d8], floor: 0x5a4636, ground: { pavement: 0x5e5a52, road: 0x34322e, grass: 0x3a6a34 }, up: 34, glass: 0xffd27a, cap: 0x8a3a2a, tree: 'palm', leaves: 0x3a8a3a, fence: 'iron', fenceColor: 0x2a3a3a, crates: [0x3a6ad8, 0xe85a3a, 0xf0c040], rock: 0x8a7a6a, cars: [0xe8e8ec, 0xd83a3a, 0x3a3a3e, 0xf2d030], roofs: [0x8a3a2a, 0x9a5a3a], roof: ['eaves', 'clutter', 'flat', 'tin'] },
  kampung: { walls: [0x8a6a42, 0x9a7a4a, 0x6a5232], floor: 0x7a5a3a, ground: { pavement: 0x6a5a42, road: 0x5a4a36, grass: 0x2f7a34, water: 0x2a6a5a }, up: 22, glass: 0xffd27a, cap: 0xa8402e, tree: 'palm', leaves: 0x3a9a3a, fence: 'bamboo', fenceColor: 0xc8b070, crates: [0x8a6a42], rock: 0x6a6a5a, cars: [0x3a8a5a, 0xd8c040], roofs: [0x8a7a4a, 0x6a5a3a], roof: ['gable', 'gable', 'eaves'] },
  gulf: { walls: [0xe8dcc4, 0xa8c8d8, 0xd8c8a8, 0x8ab8d0], floor: 0x6a5a48, ground: { pavement: 0xb8a888, road: 0x2a2a2e, grass: 0x4a7a3a }, up: 46, glass: 0x7fd8ff, cap: 0xd8b86a, tree: 'palm', leaves: 0x4a8a3a, fence: 'rail', fenceColor: 0xd8d8d0, crates: [0xd8d8d0, 0x8a6a42], rock: 0xc8a878, cars: [0xf0f0f0, 0x2a2a2e, 0xe8e8e0, 0xd8b86a], roof: ['flat', 'flat', 'clutter', 'dome'] },
  steppe: { walls: [0xe8e8e0, 0x3a8ad8, 0xc8a070, 0xd84a3a], floor: 0x5a4a3a, ground: { pavement: 0x7a7060, road: 0x5a5244, grass: 0x6a7a4a }, up: 24, glass: 0xffe08a, cap: 0x3a8ad8, tree: 'round', leaves: 0x5a7a3a, fence: 'rail', fenceColor: 0x8a7a62, crates: [0xd84a3a, 0x3a8ad8], rock: 0x9a8a72, cars: [0xc9c9c2, 0x3a5a3a, 0xe8e8e0], roofs: [0x3a8ad8, 0x8a8e94], roof: ['flat', 'gable', 'tin'] },
  compounds: { walls: [0xb86a3a, 0xa85a32, 0xc87a48], floor: 0x7a5a3a, ground: { pavement: 0xa86a42, road: 0x9a5e3a, grass: 0x6a7a34 }, up: 26, glass: 0x5a3a2a, cap: 0x8a4a2a, tree: 'acacia', leaves: 0x5a7a2a, fence: 'stone', fenceColor: 0xa85a32, crates: [0xe8c040, 0x3a8a5a, 0xd83a3a], rock: 0xa86a42, cars: [0xe8e0d0, 0xd8c040, 0x3a6a3a], roof: ['flat', 'flat', 'dome'] },
  highlands: { walls: [0x6fa8c8, 0xe8d8a8, 0x9ac878, 0xd8a070], floor: 0x5a4636, ground: { pavement: 0x7a5a42, road: 0x6a4a34, grass: 0x3a7a34 }, up: 24, glass: 0xffe08a, cap: 0x9aa3ad, tree: 'acacia', leaves: 0x3a7a34, fence: 'hedge', fenceColor: 0x2f5a2a, crates: [0x5f8fb0, 0xe8c040], rock: 0x7a5a42, cars: [0xe8e8e0, 0x3a6ad8, 0xd8c040], roofs: [0x9aa3ad, 0x8a4a3a], roof: ['tin', 'gable', 'hip'] },
  outback: { walls: [0xc8b898, 0xa8a8a0, 0xb88a5a], floor: 0x5a4636, ground: { pavement: 0xa8603a, road: 0x4a4440, grass: 0x8a7a4a }, up: 22, glass: 0xffe08a, cap: 0x8a8e94, tree: 'acacia', leaves: 0x6a7a4a, fence: 'rail', fenceColor: 0x8a8e94, crates: [0x9a7742], rock: 0xb8603a, cars: [0xe8e0d0, 0x8a3a2a, 0x3a5a3a], roof: ['tin', 'tin', 'gable', 'hip'] },
}
