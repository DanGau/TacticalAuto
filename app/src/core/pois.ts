// Points of interest: the landmarks an encounter is staged about, each dressed with its own cluster and joined by lanes.
import type { ArenaKind } from './arena-kinds'
import { GRID, type Alien, type Battle, type Tile } from './battle'
import type { Goal } from './goals'
import { onGrid } from './grid'
import type { Ground } from './terrain'

/** What a landmark is: what the battle is about, where aliens gather, high ground, a hazard, a cover strongpoint, or where the hero lands. */
export type PoiKind = 'objective' | 'nest' | 'vantage' | 'hazard' | 'strongpoint' | 'landing'

/** A landmark: its centre, and the square about `frame`, `extent` tiles from it each way, that shows it whole. */
export interface Poi {
  kind: PoiKind
  label: string
  x: number
  y: number
  frame: { x: number; y: number; extent: number }
}

/** Each ground's names for its landmarks. */
export const POI_NAMES: Record<ArenaKind, Record<'vantage' | 'hazard' | 'strongpoint' | 'landing', string>> = {
  open: { vantage: 'Grassy Knoll', hazard: 'Fuel Depot', strongpoint: 'Supply Barricade', landing: 'Landing Zone' },
  skyscraper: { vantage: 'Machine Deck', hazard: 'Roof Edge', strongpoint: 'Vent Stacks', landing: 'Rooftop Helipad' },
  overpass: { vantage: 'Overpass Deck', hazard: 'Tanker Wreck', strongpoint: 'Jersey Barriers', landing: 'Off-Ramp' },
  quarry: { vantage: 'Upper Terrace', hazard: 'Blasting Charges', strongpoint: 'Ore Carts', landing: 'Quarry Pit' },
  rift: { vantage: 'Rift Rim', hazard: 'The Rift', strongpoint: 'Wreck Pile', landing: 'Landing Zone' },
  flooded: { vantage: 'Plaza Steps', hazard: 'Flooded Plaza', strongpoint: 'Sandbag Wall', landing: 'Dry Ground' },
  marsh: { vantage: 'Wooded Island', hazard: 'Gas Bog', strongpoint: 'Fallen Logs', landing: 'Boardwalk' },
  mesa: { vantage: 'Mesa Watchtower', hazard: 'Fuel Cache', strongpoint: 'Boulder Field', landing: 'Dry Wash' },
  ice: { vantage: 'Snow Ridge', hazard: 'Ice Holes', strongpoint: 'Supply Crates', landing: 'Ice Camp' },
}

/** What the objective is called: the target or Guardian at it, else what the goal holds there. */
export function objectiveName(goal: Goal, aliens: Alien[]): string {
  if (aliens.some((a) => a.boss)) return 'Guardian Lair'
  if (aliens.some((a) => a.target)) return 'Commander Post'
  return goal === 'hold' ? 'Uplink' : goal === 'rescue' ? 'Civilians' : 'Extraction Zone'
}

/** The ground a hazard is on its own, where the ground has one: the drop, water, mire or ice. */
export const NATURAL_HAZARD: Partial<Record<ArenaKind, Ground>> = { skyscraper: 'void', rift: 'void', flooded: 'water', marsh: 'mire', ice: 'ice' }

/** The landmark the ground's feature shows at: its hazard where the ground has its own, else its vantage. */
export const groundPoi = (battle: Battle): Poi | undefined => battle.pois.find((p) => p.kind === (NATURAL_HAZARD[battle.arenaKind] ? 'hazard' : 'vantage'))

/** The least a frame reaches past its centre, and the margin it keeps past what it shows. */
const FRAME_LEAST = 3
const FRAME_MARGIN = 2

/** A landmark of `kind` at `at`, framed to show it and `shows`. */
export function poi(kind: PoiKind, label: string, at: Tile, shows: Tile[] = []): Poi {
  const all = [at, ...shows]
  const x = Math.round(all.reduce((s, t) => s + t.x, 0) / all.length)
  const y = Math.round(all.reduce((s, t) => s + t.y, 0) / all.length)
  const extent = Math.max(FRAME_LEAST, ...all.map((t) => Math.ceil(Math.max(Math.abs(t.x - x), Math.abs(t.y - y))) + FRAME_MARGIN))
  return { kind, label, x: at.x, y: at.y, frame: { x, y, extent } }
}

/** The ground a lane lays over each ground it crosses; others it leaves. */
const LANE: Partial<Record<Ground, Ground>> = { grass: 'pavement', pavement: 'road', scorched: 'road' }

/** Lays a lane two tiles wide along the straight line from `a` to `b`, over firm ground only; nothing on it changes. */
export function lane(battle: Battle, a: Tile, b: Tile): void {
  const steps = Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y), 1)
  for (let i = 0; i <= steps; i++) {
    const x = Math.round(a.x + ((b.x - a.x) * i) / steps)
    const y = Math.round(a.y + ((b.y - a.y) * i) / steps)
    for (const [dx, dy] of [[0, 0], [1, 0], [0, 1]]) {
      if (!onGrid(x + dx, y + dy)) continue
      const t = (y + dy) * GRID + x + dx
      const to = LANE[battle.ground[t]]
      if (to && battle.place !== 'hive') battle.ground[t] = to
    }
  }
}

/** How far about a nest its creep spreads. */
const CREEP = 2.5

/** Spreads hive creep over the firm ground about `at`: it marks a nest and changes nothing else. */
export function creep(battle: Battle, at: Tile): void {
  for (let y = Math.floor(at.y - CREEP); y <= at.y + CREEP; y++)
    for (let x = Math.floor(at.x - CREEP); x <= at.x + CREEP; x++) {
      if (!onGrid(x, y) || Math.hypot(x - at.x, y - at.y) > CREEP) continue
      const t = y * GRID + x
      if (['grass', 'pavement', 'road', 'scorched'].includes(battle.ground[t])) battle.ground[t] = 'hive'
    }
}

/** The landing's landmark, once the hero's landing is planned. */
export const landingPoi = (battle: Battle): Poi => poi('landing', POI_NAMES[battle.arenaKind].landing, battle.entry!)
