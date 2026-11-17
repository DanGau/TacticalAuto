// What a battlefield is made of: ground, props, walls, how solid each is, and the kinds of place.
import type { RegionId } from './regions'
import type { ArenaKind } from './arena-kinds'

/** What the ground of a tile is. It changes only how the tile looks, but mire, dear to cross; ice, frozen water; and void: no ground at all, off the battlefield. */
export type Ground = 'pavement' | 'road' | 'grass' | 'floor' | 'scorched' | 'hive' | 'water' | 'mire' | 'ice' | 'void'

/**
 * The object standing on a tile. A spire and a growth are what the aliens build; a fuel tank explodes; a wreck is a thrown car. Void stands
 * where there is no ground: as a low object it blocks movement, not sight, and it shelters no one.
 */
export type Prop = 'none' | 'car' | 'truck' | 'tree' | 'crate' | 'stack' | 'fence' | 'rubble' | 'spire' | 'growth' | 'water' | 'fuel' | 'void' | 'wreck'

/** What stands on the line between two tiles. A window blocks movement, but soldiers shoot through it. */
export type Edge = 'none' | 'wall' | 'window'

/** How solid: 0 nothing, 1 low, 2 tall. Both kinds block movement; a tall one blocks shots. */
export type Bulk = 0 | 1 | 2

export const PROP_BULK: Record<Prop, Bulk> = { none: 0, car: 1, truck: 2, tree: 2, crate: 1, stack: 2, fence: 1, rubble: 1, spire: 2, growth: 1, water: 1, fuel: 1, void: 1, wreck: 1 }
export const EDGE_BULK: Record<Edge, Bulk> = { none: 0, window: 1, wall: 2 }

/**
 * A battlefield's ground, objects and walls. Each array has one entry per tile, row by row.
 * `north` and `west` hold what stands on a tile's north and west edges.
 */
export interface Terrain {
  ground: Ground[]
  /** How high each tile stands: 0 on the flat, 1 on a hill, 2 on its crest. */
  height: number[]
  props: Prop[]
  north: Edge[]
  west: Edge[]
  /** The part of the world it stands in, and the place there it is named for. */
  region: RegionId
  city: string
}

/** The kinds of place a zone's battles may be fought in. */
export const ZONE_TERRAINS = ['town', 'city', 'countryside', 'industrial', 'ruins'] as const

/** The kind of place a battle is fought in. A satellite stands in a compound; the alien source is a hive. */
export type TerrainKind = (typeof ZONE_TERRAINS)[number] | 'compound' | 'hive'

export const TERRAIN_KINDS: TerrainKind[] = [...ZONE_TERRAINS, 'compound', 'hive']

/** Where in the world a battlefield lies: how its region builds, and the place it is named for. */
export interface Locale {
  region: RegionId
  city: string
  /** The ground drawn for it ahead; drawn by the battle when absent. */
  ground?: ArenaKind
}

