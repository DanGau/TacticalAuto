import type { Streets } from './streets'
import type { TerrainKind } from './terrain'

/**
 * How a part of the world builds: its streets, the lots between them, and the buildings on those. A battle's kind of
 * place says what stands there; its region says how. Sizes are in tiles.
 */
export interface Region {
  name: string
  /** Places in the world built this way, one named for each battle. */
  cities: string[]
  streets: Streets
  /** A lot's sides, the gap left between neighbouring lots, and the share of lots built on rather than left open. */
  lot: [number, number]
  gap: number
  built: number
  /** Its buildings' smallest and largest sides, and the yard a building keeps from its lot's edge. */
  building: [number, number]
  setback: number
  /** Wall sections between windows. */
  windowEvery: number
  /** Whether its houses wrap a courtyard, and whether its housing stands as long slabs. */
  courtyards: boolean
  slabs: boolean
  /** How many hills it has, against the kind of place's own, and its trees and greenery, against the kind's. */
  hills: number
  green: number
  /** The kinds of place found in it. */
  kinds: TerrainKind[]
}

const BASE: Omit<Region, 'name' | 'cities' | 'kinds' | 'streets'> = {
  lot: [6, 10],
  gap: 1,
  built: 0.6,
  building: [4, 8],
  setback: 1,
  windowEvery: 3,
  courtyards: false,
  slabs: false,
  hills: 1,
  green: 1,
}

const region = (r: Partial<Region> & Pick<Region, 'name' | 'cities' | 'kinds' | 'streets'>): Region => ({ ...BASE, ...r })
const streets = (plan: Streets['plan'], width: number, spacing: [number, number], stretch = 1): Streets => ({ plan, width, spacing, stretch })
const CITY = ['city', 'industrial', 'ruins'] as TerrainKind[]
const TOWN = ['town', 'ruins'] as TerrainKind[]

export const REGIONS = {
  // North America: a downtown grid, a freeway city, and its suburbs.
  downtown: region({ name: 'Downtown grid', cities: ['Manhattan', 'Chicago', 'Philadelphia', 'Toronto'], streets: streets('grid', 3, [9, 11], 2.4), lot: [5, 9], gap: 0, built: 0.85, building: [5, 10], setback: 0, windowEvery: 2, hills: 0, green: 0.3, kinds: CITY }),
  freeway: region({ name: 'Freeway sprawl', cities: ['Houston', 'Los Angeles', 'Phoenix', 'Atlanta'], streets: streets('freeway', 3, [16, 22]), lot: [8, 14], gap: 2, built: 0.35, building: [6, 12], setback: 2, hills: 0.3, green: 0.5, kinds: ['city', 'industrial', 'town', 'ruins'] }),
  suburb: region({ name: 'Suburb', cities: ['Columbus', 'Mississauga', 'Perth', 'Plano'], streets: streets('cul-de-sacs', 2, [6, 9]), lot: [6, 8], gap: 0, built: 0.85, building: [4, 6], setback: 2, green: 1.5, kinds: ['town', 'countryside', 'ruins'] }),
  // Latin America: a colonial grid, a hillside favela, a barrio.
  colonial: region({ name: 'Colonial grid', cities: ['Havana', 'Cartagena', 'Oaxaca', 'Antigua'], streets: streets('grid', 2, [9, 11]), lot: [4, 7], gap: 0, built: 0.9, building: [4, 7], setback: 0, windowEvery: 2, courtyards: true, hills: 0.6, green: 1.3, kinds: ['town', 'city', 'ruins'] }),
  favela: region({ name: 'Hillside favela', cities: ['Rio de Janeiro', 'Medellín', 'Caracas', 'La Paz'], streets: streets('winding', 1, [6, 8]), lot: [3, 5], gap: 0, built: 0.95, building: [3, 5], setback: 0, windowEvery: 2, hills: 2.8, green: 0.6, kinds: TOWN }),
  barrio: region({ name: 'Barrio', cities: ['Lima', 'Bogotá', 'Guadalajara', 'Quito'], streets: streets('plots', 2, [7, 9]), lot: [4, 6], gap: 0, built: 0.8, building: [4, 6], setback: 0, hills: 1.2, green: 0.6, kinds: ['town', 'industrial', 'ruins'] }),
  // Europe: an old town, Paris, Barcelona, a canal city, terraces, a Soviet estate.
  oldTown: region({ name: 'Old town', cities: ['Lisbon', 'Siena', 'Prague', 'Toledo'], streets: streets('winding', 1, [8, 12]), lot: [4, 8], gap: 0, built: 0.95, building: [4, 8], setback: 0, windowEvery: 2, hills: 1.5, green: 0.4, kinds: ['town', 'city', 'ruins'] }),
  boulevards: region({ name: 'Boulevards', cities: ['Paris', 'Vienna', 'Budapest', 'Brussels'], streets: streets('star', 3, [10, 14]), lot: [6, 10], gap: 0, built: 0.9, building: [6, 10], setback: 0, windowEvery: 2, courtyards: true, hills: 0.3, green: 0.8, kinds: CITY }),
  eixample: region({ name: 'Chamfered blocks', cities: ['Barcelona', 'Valencia', 'Bilbao', 'Zaragoza'], streets: streets('chamfered', 2, [11, 12]), lot: [5, 8], gap: 0, built: 0.9, building: [5, 8], setback: 0, windowEvery: 2, courtyards: true, hills: 0.2, green: 0.6, kinds: CITY }),
  canals: region({ name: 'Canal rings', cities: ['Amsterdam', 'Venice', 'Bruges', 'Copenhagen'], streets: streets('rings', 1, [7, 9]), lot: [3, 6], gap: 0, built: 0.9, building: [3, 6], setback: 0, windowEvery: 2, hills: 0, green: 0.6, kinds: ['town', 'city', 'ruins'] }),
  terraces: region({ name: 'Terraced streets', cities: ['Leeds', 'Dublin', 'Rotterdam', 'Cardiff'], streets: streets('grid', 1, [6, 7], 3), lot: [4, 6], gap: 0, built: 0.9, building: [4, 6], setback: 1, windowEvery: 2, green: 0.9, kinds: TOWN }),
  estate: region({ name: 'Housing estate', cities: ['Minsk', 'Novosibirsk', 'Bucharest', 'Almaty'], streets: streets('superblocks', 3, [22, 28]), lot: [10, 16], gap: 3, built: 0.6, building: [4, 14], setback: 2, windowEvery: 2, slabs: true, hills: 0.4, green: 1.3, kinds: CITY }),
  // Asia: Tokyo, a Japanese suburb, Beijing, an Indian bazaar, a hill village.
  tokyo: region({ name: 'Dense city', cities: ['Tokyo', 'Osaka', 'Hong Kong', 'Seoul'], streets: streets('lanes', 3, [18, 22]), lot: [3, 5], gap: 0, built: 0.95, building: [3, 5], setback: 0, windowEvery: 2, hills: 0.3, green: 0.3, kinds: CITY }),
  jpSuburb: region({ name: 'Residential lanes', cities: ['Saitama', 'Nara', 'Kanazawa', 'Sendai'], streets: streets('lanes', 2, [14, 18]), lot: [4, 5], gap: 1, built: 0.85, building: [3, 4], setback: 1, hills: 0.6, green: 0.9, kinds: TOWN }),
  hutong: region({ name: 'Hutong', cities: ['Beijing', 'Pingyao', 'Xi’an', 'Tianjin'], streets: streets('hutongs', 2, [20, 26]), lot: [6, 8], gap: 0, built: 0.9, building: [6, 8], setback: 0, windowEvery: 4, courtyards: true, hills: 0, green: 0.7, kinds: ['town', 'city', 'ruins'] }),
  bazaar: region({ name: 'Bazaar', cities: ['Mumbai', 'Jaipur', 'Dhaka', 'Kathmandu'], streets: streets('winding', 1, [6, 9]), lot: [3, 5], gap: 0, built: 0.9, building: [3, 5], setback: 0, windowEvery: 2, hills: 0.6, green: 0.4, kinds: ['town', 'city', 'industrial', 'ruins'] }),
  shophouses: region({ name: 'Shophouse lanes', cities: ['Hanoi', 'Bangkok', 'Penang', 'Ho Chi Minh City'], streets: streets('hutongs', 2, [16, 20]), lot: [3, 4], gap: 0, built: 0.95, building: [3, 4], setback: 0, windowEvery: 2, hills: 0.2, green: 0.8, kinds: ['town', 'city', 'ruins'] }),
  kampung: region({ name: 'Stilt village', cities: ['Bangkok', 'Brunei', 'Tonlé Sap', 'Inle'], streets: streets('rings', 1, [6, 8]), lot: [3, 5], gap: 1, built: 0.8, building: [3, 4], setback: 0, hills: 0, green: 1.6, kinds: ['town', 'countryside'] }),
  gulf: region({ name: 'Gulf city', cities: ['Dubai', 'Doha', 'Riyadh', 'Abu Dhabi'], streets: streets('freeway', 4, [18, 24]), lot: [8, 14], gap: 2, built: 0.5, building: [6, 12], setback: 2, windowEvery: 2, hills: 0, green: 0.2, kinds: CITY }),
  steppe: region({ name: 'Steppe town', cities: ['Ulaanbaatar', 'Bishkek', 'Kashgar', 'Samarkand'], streets: streets('plots', 2, [10, 13]), lot: [5, 8], gap: 1, built: 0.6, building: [4, 6], setback: 1, courtyards: true, hills: 1.2, green: 0.4, kinds: ['town', 'countryside', 'ruins'] }),
  village: region({ name: 'Mountain village', cities: ['Hallstatt', 'Shirakawa-gō', 'Zermatt', 'Cusco'], streets: streets('winding', 1, [16, 22]), lot: [8, 12], gap: 2, built: 0.35, building: [4, 6], setback: 2, hills: 2.6, green: 1.7, kinds: ['town', 'countryside'] }),
  // Africa and the Middle East: a medina, a desert town, a township.
  medina: region({ name: 'Medina', cities: ['Fez', 'Marrakesh', 'Cairo', 'Tunis'], streets: streets('alleys', 1, [8, 12]), lot: [5, 8], gap: 0, built: 0.95, building: [5, 8], setback: 0, windowEvery: 5, courtyards: true, hills: 0.4, green: 0.2, kinds: ['town', 'city', 'ruins'] }),
  oasis: region({ name: 'Desert town', cities: ['Timbuktu', 'Shibam', 'Yazd', 'Siwa'], streets: streets('alleys', 1, [10, 14]), lot: [5, 9], gap: 1, built: 0.7, building: [4, 7], setback: 1, windowEvery: 5, courtyards: true, hills: 0.5, green: 0.3, kinds: ['town', 'countryside', 'ruins'] }),
  compounds: region({ name: 'Compound quarter', cities: ['Kano', 'Bamako', 'Ouagadougou', 'Zinder'], streets: streets('winding', 2, [9, 12]), lot: [6, 9], gap: 1, built: 0.85, building: [6, 9], setback: 0, windowEvery: 6, courtyards: true, hills: 0.3, green: 0.4, kinds: ['town', 'city', 'ruins'] }),
  highlands: region({ name: 'Highland town', cities: ['Addis Ababa', 'Kigali', 'Kampala', 'Asmara'], streets: streets('cul-de-sacs', 2, [6, 8]), lot: [5, 7], gap: 1, built: 0.7, building: [4, 6], setback: 1, hills: 2.2, green: 1.3, kinds: ['town', 'countryside', 'ruins'] }),
  township: region({ name: 'Township', cities: ['Soweto', 'Lagos', 'Nairobi', 'Accra'], streets: streets('plots', 1, [6, 7]), lot: [3, 4], gap: 1, built: 0.9, building: [3, 4], setback: 0, hills: 0.7, green: 0.5, kinds: ['town', 'industrial', 'ruins'] }),
  // Oceania: an outback town on its wide grid.
  outback: region({ name: 'Outback town', cities: ['Alice Springs', 'Broken Hill', 'Kalgoorlie', 'Coober Pedy'], streets: streets('grid', 4, [16, 20]), lot: [7, 10], gap: 2, built: 0.45, building: [4, 7], setback: 2, hills: 0.3, green: 0.4, kinds: ['town', 'countryside', 'industrial', 'ruins'] }),
  // The far north and the islands.
  arctic: region({ name: 'Arctic town', cities: ['Tromsø', 'Nuuk', 'Longyearbyen', 'Yellowknife'], streets: streets('grid', 2, [12, 16]), lot: [6, 9], gap: 2, built: 0.55, building: [4, 7], setback: 2, windowEvery: 4, hills: 1.2, green: 0.2, kinds: ['town', 'countryside', 'industrial', 'ruins'] }),
  island: region({ name: 'Whitewashed island', cities: ['Santorini', 'Mykonos', 'Bonifacio', 'Procida'], streets: streets('winding', 1, [7, 10]), lot: [3, 6], gap: 0, built: 0.9, building: [3, 6], setback: 0, windowEvery: 3, hills: 3, green: 0.3, kinds: TOWN }),
} satisfies Record<string, Region>

export type RegionId = keyof typeof REGIONS
export const REGION_IDS = Object.keys(REGIONS) as RegionId[]

/** The regions a kind of place is found in; a compound or hive may stand in any. */
export const regionsFor = (kind: TerrainKind): RegionId[] => {
  const fit = REGION_IDS.filter((id) => REGIONS[id].kinds.includes(kind))
  return fit.length > 0 ? fit : REGION_IDS
}
