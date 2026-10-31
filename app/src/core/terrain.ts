// What a battlefield is made of: ground, props, walls, the cover each gives, and the kinds of place.
import type { RegionId } from './regions'

/** What the ground of a tile is. It changes only how the tile looks, but void: no ground at all, off the battlefield. */
export type Ground = 'pavement' | 'road' | 'grass' | 'floor' | 'scorched' | 'hive' | 'water' | 'void'

/**
 * The object standing on a tile. A spire and a growth are what the aliens build; a fuel tank explodes. Void stands
 * where there is no ground: as low cover it blocks movement, not sight, and it shelters no one.
 */
export type Prop = 'none' | 'car' | 'truck' | 'tree' | 'crate' | 'stack' | 'fence' | 'rubble' | 'spire' | 'growth' | 'water' | 'fuel' | 'void'

/** What stands on the line between two tiles. A window blocks movement, but soldiers shoot through it. */
export type Edge = 'none' | 'wall' | 'window'

/** Cover: 0 nothing, 1 low, 2 high. Both kinds block movement; high cover blocks shots. */
export type Cover = 0 | 1 | 2

export const PROP_COVER: Record<Prop, Cover> = { none: 0, car: 1, truck: 2, tree: 2, crate: 1, stack: 2, fence: 1, rubble: 1, spire: 2, growth: 1, water: 1, fuel: 1, void: 1 }
export const EDGE_COVER: Record<Edge, Cover> = { none: 0, window: 1, wall: 2 }

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

/** What the player is told about each kind of place. */
const TERRAIN_TEXT: Record<TerrainKind, { name: string; text: string }> = {
  town: { name: 'Town', text: 'houses, parks, a market or a square' },
  city: { name: 'City', text: 'buildings close together; cover everywhere' },
  countryside: { name: 'Countryside', text: 'open fields and orchards; cover is scarce' },
  industrial: { name: 'Industrial yard', text: 'warehouses, crates and trucks' },
  ruins: { name: 'Ruins', text: 'fallen buildings; broken walls and rubble' },
  compound: { name: 'Satellite compound', text: 'a walled yard around the dish' },
  hive: { name: 'Alien hive', text: 'spires and growths; nothing human' },
}

export const TERRAIN_KINDS = Object.keys(TERRAIN_TEXT) as TerrainKind[]

/** Where in the world a battlefield lies: how its region builds, and the place it is named for. */
export interface Locale {
  region: RegionId
  city: string
}

