import type { TerrainKind } from './terrain'

/**
 * How a part of the world builds: its streets, its blocks, and the buildings on them. A battle's kind of place says
 * what stands there; its region says how. Sizes are in tiles.
 */
export interface Region {
  name: string
  /** Places in the world built this way, one named for each battle. */
  cities: string[]
  /** How wide its streets are, and how far apart they run: across x, then down y. */
  road: number
  spacing: [number, number]
  /** How much farther apart its streets run down y than across x: long blocks, as Manhattan's are. */
  stretch: number
  /** Whether its cross streets run on, or stop at each street and start again elsewhere, leaving blocks of many shapes. */
  staggered: boolean
  /** Whether its streets are canals, crossed at bridges. */
  canals: boolean
  /** Its buildings' sides, and the yard a house keeps from its lot's edge. */
  building: [number, number]
  setback: number
  /** Wall sections between windows. */
  windowEvery: number
  /** Whether its houses wrap a courtyard, and whether its housing stands as long slabs. */
  courtyards: boolean
  slabs: boolean
  /** How many hills it has, against the kind of place's own. */
  hills: number
  /** Trees and greenery, against the kind of place's own. */
  green: number
  /** The kinds of place found in it. */
  kinds: TerrainKind[]
}

const BASE: Omit<Region, 'name' | 'cities' | 'kinds'> = {
  road: 2,
  spacing: [12, 16],
  stretch: 1,
  staggered: false,
  canals: false,
  building: [4, 8],
  setback: 1,
  windowEvery: 3,
  courtyards: false,
  slabs: false,
  hills: 1,
  green: 1,
}

const region = (r: Partial<Region> & Pick<Region, 'name' | 'cities' | 'kinds'>): Region => ({ ...BASE, ...r })

export const REGIONS = {
  suburb: region({ name: 'Suburb', cities: ['Columbus', 'Phoenix', 'Mississauga', 'Perth'], spacing: [15, 19], building: [5, 8], setback: 2, green: 1.4, kinds: ['town', 'countryside', 'industrial', 'ruins'] }),
  grid: region({ name: 'Downtown grid', cities: ['Manhattan', 'Chicago', 'Buenos Aires', 'Melbourne'], road: 3, spacing: [10, 12], stretch: 2.2, building: [6, 10], setback: 0, windowEvery: 2, hills: 0, green: 0.3, kinds: ['city', 'industrial', 'ruins'] }),
  oldTown: region({ name: 'Old town', cities: ['Lisbon', 'Prague', 'Siena', 'Kraków'], road: 1, spacing: [8, 12], staggered: true, building: [4, 9], setback: 0, windowEvery: 2, hills: 1.5, green: 0.5, kinds: ['town', 'city', 'ruins'] }),
  boulevards: region({ name: 'Boulevards', cities: ['Paris', 'Barcelona', 'Vienna', 'Budapest'], road: 3, spacing: [14, 16], building: [8, 12], setback: 0, windowEvery: 2, courtyards: true, hills: 0.3, green: 0.8, kinds: ['city', 'town', 'ruins'] }),
  canals: region({ name: 'Canal quarter', cities: ['Amsterdam', 'Venice', 'Bruges', 'Suzhou'], spacing: [9, 12], staggered: true, canals: true, building: [4, 7], setback: 0, windowEvery: 2, hills: 0, green: 0.6, kinds: ['town', 'city', 'ruins'] }),
  megacity: region({ name: 'Megacity', cities: ['Tokyo', 'Hong Kong', 'Seoul', 'Shanghai'], spacing: [10, 13], building: [5, 10], setback: 0, windowEvery: 2, hills: 0.5, green: 0.3, kinds: ['city', 'industrial', 'ruins'] }),
  hutong: region({ name: 'Hutong', cities: ['Beijing', 'Xi’an', 'Pingyao', 'Kyoto'], road: 1, spacing: [10, 13], stretch: 1.6, building: [7, 9], setback: 0, windowEvery: 4, courtyards: true, hills: 0, green: 0.7, kinds: ['town', 'city', 'ruins'] }),
  bazaar: region({ name: 'Bazaar', cities: ['Mumbai', 'Jaipur', 'Dhaka', 'Kathmandu'], road: 1, spacing: [7, 10], staggered: true, building: [4, 6], setback: 0, windowEvery: 2, hills: 0.7, green: 0.4, kinds: ['town', 'city', 'ruins', 'industrial'] }),
  medina: region({ name: 'Medina', cities: ['Fez', 'Marrakesh', 'Cairo', 'Tunis'], road: 1, spacing: [9, 12], staggered: true, building: [6, 9], setback: 0, windowEvery: 5, courtyards: true, hills: 0.5, green: 0.2, kinds: ['town', 'city', 'ruins'] }),
  oasis: region({ name: 'Desert town', cities: ['Timbuktu', 'Shibam', 'Yazd', 'Alice Springs'], spacing: [14, 20], staggered: true, building: [4, 7], setback: 2, windowEvery: 5, courtyards: true, hills: 0.6, green: 0.3, kinds: ['town', 'countryside', 'ruins'] }),
  island: region({ name: 'Whitewashed island', cities: ['Santorini', 'Mykonos', 'Bonifacio', 'Procida'], road: 1, spacing: [7, 10], staggered: true, building: [4, 6], setback: 0, windowEvery: 3, hills: 3, green: 0.3, kinds: ['town', 'ruins'] }),
  blocks: region({ name: 'Housing estate', cities: ['Minsk', 'Novosibirsk', 'Bucharest', 'Almaty'], road: 3, spacing: [18, 24], building: [4, 14], setback: 3, windowEvery: 2, slabs: true, hills: 0.5, green: 1.2, kinds: ['city', 'industrial', 'ruins'] }),
  favela: region({ name: 'Hillside favela', cities: ['Rio de Janeiro', 'Medellín', 'Caracas', 'La Paz'], road: 1, spacing: [7, 9], staggered: true, building: [4, 5], setback: 0, windowEvery: 2, hills: 2.5, green: 0.6, kinds: ['town', 'ruins'] }),
  township: region({ name: 'Township', cities: ['Soweto', 'Lagos', 'Nairobi', 'Accra'], road: 2, spacing: [9, 11], building: [4, 5], setback: 1, windowEvery: 3, hills: 0.8, green: 0.6, kinds: ['town', 'industrial', 'ruins'] }),
  village: region({ name: 'Mountain village', cities: ['Hallstatt', 'Zermatt', 'Shirakawa-gō', 'Cusco'], road: 1, spacing: [17, 22], staggered: true, building: [4, 6], setback: 3, hills: 2.5, green: 1.6, kinds: ['town', 'countryside'] }),
  arctic: region({ name: 'Arctic town', cities: ['Tromsø', 'Nuuk', 'Longyearbyen', 'Yellowknife'], spacing: [14, 18], building: [4, 7], setback: 2, windowEvery: 4, hills: 1.2, green: 0.2, kinds: ['town', 'countryside', 'industrial', 'ruins'] }),
  tropics: region({ name: 'Tropical port', cities: ['Havana', 'Cartagena', 'Zanzibar', 'Manila'], road: 2, spacing: [10, 13], building: [4, 7], setback: 0, windowEvery: 2, courtyards: true, hills: 0.6, green: 1.5, kinds: ['town', 'city', 'industrial', 'ruins'] }),
} satisfies Record<string, Region>

export type RegionId = keyof typeof REGIONS
export const REGION_IDS = Object.keys(REGIONS) as RegionId[]

/** The regions a kind of place is found in; a compound or hive may stand in any. */
export const regionsFor = (kind: TerrainKind): RegionId[] => {
  const fit = REGION_IDS.filter((id) => REGIONS[id].kinds.includes(kind))
  return fit.length > 0 ? fit : REGION_IDS
}
