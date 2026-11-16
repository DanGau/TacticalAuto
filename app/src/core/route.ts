// The crossing's route: the walk from the landing to the objective, plain and with what a boon opens.
import { BASE_STATS, GRID, type Battle, type Tile } from './battle'
import { HOVER, stepCost, strides, walkingDistances, walks } from './grid'
import { effectsOf, type EffectId, type UtilityId } from './utilities'

/** Tiles either side of the straight way from the landing to the objective whose water Cold Snap freezes. */
export const FREEZE_REACH = 2

/** Tiles of walk a boon must save for the route it opens to count as better. */
export const SHORTCUT = 8

/** The tiles of water within FREEZE_REACH of the straight way from the landing to the objective. */
export function waterOnRoute(battle: Battle): number[] {
  const a = battle.entry ?? battle.approach
  const b = battle.objective
  const [dx, dy] = [b.x - a.x, b.y - a.y]
  const span = Math.hypot(dx, dy) || 1
  return battle.ground.flatMap((g, t) => {
    if (g !== 'water') return []
    const [x, y] = [(t % GRID) - a.x, Math.floor(t / GRID) - a.y]
    const along = (x * dx + y * dy) / span
    return along >= 0 && along <= span && Math.abs(x * dy - y * dx) / span <= FREEZE_REACH ? [t] : []
  })
}

/** Turns `tiles` of water to ice, firm to walk on. */
export function freeze(battle: Battle, tiles: number[]): void {
  for (const t of tiles) {
    battle.ground[t] = 'ice'
    battle.props[t] = 'none'
    battle.bulk[t] = 0
  }
  walks.delete(battle)
}

/** The battle as it would stand with `effects` taken: Cold Snap's ice laid. */
function opened(battle: Battle, effects: EffectId[]): Battle {
  const water = effects.includes('coldSnap') ? waterOnRoute(battle) : []
  if (water.length === 0) return battle
  const copy = { ...battle, ground: [...battle.ground], props: [...battle.props], bulk: [...battle.bulk] }
  freeze(copy, water)
  return copy
}

/** The walk to the objective from every tile for a hero of `jump` with `effects`: Levitation floats it over everything. */
function field(battle: Battle, jump: number, effects: EffectId[]): { ground: Battle; walk: readonly number[] } {
  const ground = opened(battle, effects)
  return { ground, walk: walkingDistances(ground, battle.objective, effects.includes('hover') ? HOVER : jump) }
}

/** The hero's jump, landed or not. */
const jumpOf = (battle: Battle) => battle.reserve[0]?.stats.jump ?? battle.units.find((u) => u.soldier !== null && u.side === 'human')?.stats.jump ?? BASE_STATS.jump

/** The walk from the landing to the objective with `effects`, in move; Infinity if there is none. */
export function routeWalk(battle: Battle, effects: EffectId[] = [], jump = jumpOf(battle)): number {
  const from = battle.entry ?? battle.approach
  return field(battle, jump, effects).walk[from.y * GRID + from.x]
}

/** The tiles of the route with `effects`, the landing first and the objective last; empty if there is none. */
export function routePath(battle: Battle, effects: EffectId[] = [], jump = jumpOf(battle)): Tile[] {
  const { ground, walk } = field(battle, jump, effects)
  const leap = effects.includes('hover') ? HOVER : jump
  const at = (t: Tile) => walk[t.y * GRID + t.x]
  const path = [battle.entry ?? battle.approach]
  if (at(path[0]) === Infinity) return []
  for (let here = path[0]; at(here) > 0; ) {
    const next = strides(ground, here, leap).filter((to) => at(to) + stepCost(ground, here, to, leap >= HOVER) === at(here))
    if (next.length === 0) break
    // Of equal ways on, straight on before a turn.
    const last = path.at(-2) ?? here
    here = next.reduce((a, b) => (Math.hypot(b.x - 2 * here.x + last.x, b.y - 2 * here.y + last.y) < Math.hypot(a.x - 2 * here.x + last.x, a.y - 2 * here.y + last.y) ? b : a))
    path.push(here)
  }
  return path
}

/** Whether boon `id` opens a route at least SHORTCUT shorter than the plain one. */
export const opens = (battle: Battle, id: UtilityId) => routeWalk(battle, effectsOf(id)) <= routeWalk(battle) - SHORTCUT
