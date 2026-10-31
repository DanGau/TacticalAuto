import type { RegionId } from './regions'

/** A place on the globe: longitude east, then latitude north, in degrees. */
export type LonLat = [number, number]

/** A city on the globe. */
export interface City {
  name: string
  country: string
  at: LonLat
}

/** A continent the squad can cross: the ways its towns are built, and the cities a hero may wait in. */
interface Continent {
  name: string
  regions: RegionId[]
  cities: City[]
}

export const CONTINENTS = {
  northAmerica: {
    name: 'North America',
    regions: ['downtown', 'freeway', 'suburb', 'arctic'],
    cities: [
      { name: 'New York', country: 'United States', at: [-74, 40.7] },
      { name: 'Houston', country: 'United States', at: [-95.4, 29.8] },
      { name: 'Toronto', country: 'Canada', at: [-79.4, 43.7] },
      { name: 'Mexico City', country: 'Mexico', at: [-99.1, 19.4] },
    ],
  },
  southAmerica: {
    name: 'South America',
    regions: ['colonial', 'favela', 'barrio', 'village'],
    cities: [
      { name: 'Rio de Janeiro', country: 'Brazil', at: [-43.2, -22.9] },
      { name: 'Lima', country: 'Peru', at: [-77, -12] },
      { name: 'Bogotá', country: 'Colombia', at: [-74.1, 4.7] },
      { name: 'Buenos Aires', country: 'Argentina', at: [-58.4, -34.6] },
    ],
  },
  europe: {
    name: 'Europe',
    regions: ['oldTown', 'boulevards', 'eixample', 'canals', 'terraces', 'estate', 'island'],
    cities: [
      { name: 'Paris', country: 'France', at: [2.35, 48.9] },
      { name: 'Lisbon', country: 'Portugal', at: [-9.1, 38.7] },
      { name: 'Berlin', country: 'Germany', at: [13.4, 52.5] },
      { name: 'Rome', country: 'Italy', at: [12.5, 41.9] },
      { name: 'Moscow', country: 'Russia', at: [37.6, 55.75] },
    ],
  },
  africa: {
    name: 'Africa',
    regions: ['medina', 'oasis', 'compounds', 'highlands', 'township'],
    cities: [
      { name: 'Cairo', country: 'Egypt', at: [31.2, 30] },
      { name: 'Lagos', country: 'Nigeria', at: [3.4, 6.5] },
      { name: 'Nairobi', country: 'Kenya', at: [36.8, -1.3] },
      { name: 'Marrakesh', country: 'Morocco', at: [-8, 31.6] },
      { name: 'Johannesburg', country: 'South Africa', at: [28, -26.2] },
    ],
  },
  asia: {
    name: 'Asia',
    regions: ['tokyo', 'jpSuburb', 'hutong', 'bazaar', 'shophouses', 'kampung', 'gulf', 'steppe', 'village'],
    cities: [
      { name: 'Tokyo', country: 'Japan', at: [139.7, 35.7] },
      { name: 'Beijing', country: 'China', at: [116.4, 39.9] },
      { name: 'Mumbai', country: 'India', at: [72.9, 19.1] },
      { name: 'Dubai', country: 'United Arab Emirates', at: [55.3, 25.2] },
      { name: 'Bangkok', country: 'Thailand', at: [100.5, 13.75] },
    ],
  },
  oceania: {
    name: 'Oceania',
    regions: ['outback', 'suburb'],
    cities: [
      { name: 'Sydney', country: 'Australia', at: [151.2, -33.9] },
      { name: 'Perth', country: 'Australia', at: [115.9, -32] },
      { name: 'Auckland', country: 'New Zealand', at: [174.8, -36.8] },
    ],
  },
} satisfies Record<string, Continent>

export type ContinentId = keyof typeof CONTINENTS
export const CONTINENT_IDS = Object.keys(CONTINENTS) as ContinentId[]

/** The alien hub the run ends at, under the Antarctic ice. */
export const HUB: City = { name: 'The Hub', country: 'Antarctica', at: [106.8, -78.5] }

/** The angle between two places on the globe, in degrees. */
export function arc(a: LonLat, b: LonLat): number {
  const r = Math.PI / 180
  const cos = Math.sin(a[1] * r) * Math.sin(b[1] * r) + Math.cos(a[1] * r) * Math.cos(b[1] * r) * Math.cos((a[0] - b[0]) * r)
  return Math.acos(Math.max(-1, Math.min(1, cos))) / r
}

/** The place a share `t` of the way from `a` to `b` along the shortest route over the globe. */
export function along(a: LonLat, b: LonLat, t: number): LonLat {
  const r = Math.PI / 180
  const v = ([lon, lat]: LonLat) => [Math.cos(lat * r) * Math.cos(lon * r), Math.cos(lat * r) * Math.sin(lon * r), Math.sin(lat * r)]
  const [p, q] = [v(a), v(b)]
  const d = (arc(a, b) * r) || 1e-9
  const s = Math.sin(d)
  const [wa, wb] = [Math.sin((1 - t) * d) / s, Math.sin(t * d) / s]
  const [x, y, z] = [0, 1, 2].map((i) => p[i] * wa + q[i] * wb)
  return [Math.atan2(y, x) / r, Math.atan2(z, Math.hypot(x, y)) / r]
}
