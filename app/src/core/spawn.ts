// Making units for a battle: aliens, soldiers, civilians, and mechs and drops an owner brings.
import { NODE_SPAWNS, HATCH_TURNS } from './aliens'
import { type Battle, type Alien, type Tile, type Unit, SPAWN_EVERY, type Stats, type Effect, BASE_STATS, type Reserve, GRID } from './battle'
import { CIVILIAN_MOVE } from './goals'
import { walkingDistances, freeTilesNear } from './grid'

/** A new alien unit on a tile, waiting its turn unless `engaged`; a burrower starts underground, and a wave unseen. */
export function alienUnit(battle: Battle, alien: Alien, tile: Tile, engaged = false, seen = true): Unit {
  return {
    id: battle.nextId++,
    side: 'alien',
    ...tile,
    hp: alien.stats.hp,
    armor: alien.stats.armor,
    ...alien,
    soldier: null,
    engaged,
    revealed: seen && alien.kind !== 'burrower',
    surprised: 0,
    ability: null,
    // A hive node's charges are the swarmlings left in it.
    charges: alien.kind === 'hiveNode' ? NODE_SPAWNS : 0,
    // A commander blinks to safety once wounded.
    effects: alien.target ? ['blink'] : [],
    spent: [],
    burning: 0,
    chilled: 0,
    rooted: 0,
    booming: 0,
    fury: 0,
    civilian: null,
    summoner: null,
    panicked: false,
    moved: false,
    suppressed: 0,
    marked: false,
    order: null,
    cooldown: alien.spawns ? SPAWN_EVERY : alien.kind === 'incubator' ? HATCH_TURNS : 0,
  }
}

/** A mech built by the engineer `owner`, with `stats` and the `effects` its skills give it, standing on `tile`. */
export function mechUnit(battle: Battle, owner: Unit, stats: Stats, effects: Effect[], tile: Tile): Unit {
  return { id: battle.nextId++, side: 'human', ...tile, hp: stats.hp, armor: stats.armor, stats, soldier: null, engaged: true, revealed: true, surprised: 0, ability: null, charges: 0, stance: 'rush', effects, spent: [], burning: 0, chilled: 0, rooted: 0, booming: 0, fury: 0, kind: null, boss: false, spawns: false, target: false, resists: [], civilian: null, summoner: owner.soldier, panicked: false, moved: false, suppressed: 0, marked: false, cooldown: 0, order: null }
}

/** A civilian of `kind` with `hp` health, standing on `tile`. */
export function civilianUnit(battle: Battle, tile: Tile, hp: number, kind: NonNullable<Unit['civilian']>): Unit {
  const stats = { ...BASE_STATS, hp, damage: 0, range: 0, move: CIVILIAN_MOVE, crit: 0 }
  return { id: battle.nextId++, side: 'human', ...tile, hp, armor: 0, stats, soldier: null, engaged: true, revealed: true, surprised: 0, ability: null, charges: 0, stance: 'anchor', effects: [], spent: [], burning: 0, chilled: 0, rooted: 0, booming: 0, fury: 0, kind: null, boss: false, spawns: false, target: false, resists: [], civilian: kind, summoner: null, panicked: false, moved: false, suppressed: 0, marked: false, cooldown: 0, order: null }
}

/** A soldier's unit, coming in from the reserve on `tile`. */
export function soldierUnit(battle: Battle, soldier: Reserve, tile: Tile): Unit {
  return { id: battle.nextId++, side: 'human', ...tile, armor: soldier.stats.armor, engaged: true, revealed: true, surprised: 0, spent: [], burning: 0, chilled: 0, rooted: 0, booming: 0, fury: 0, kind: null, boss: false, spawns: false, target: false, resists: [], civilian: null, summoner: null, panicked: false, moved: false, suppressed: 0, marked: false, cooldown: 0, order: null, ...soldier }
}

/**
 * Lands a unit of `stats` that never moves, fighting for `owner`'s side, on the free tile nearest `spot` where it cuts no
 * ground off from `owner` nor cuts a squadmate off from it; none if there is no such tile.
 */
export function dropUnit(battle: Battle, owner: Unit, stats: Stats, spot: Tile, effects: Effect[] = []): Unit | undefined {
  const open = walkingDistances(battle, owner).filter(Number.isFinite).length
  const mates = battle.units.filter((u) => u.side === owner.side && u !== owner && u.stats.move > 0)
  for (const tile of freeTilesNear(battle, spot, 6)) {
    const unit = mechUnit(battle, owner, stats, effects, tile)
    battle.units.push(unit)
    const walk = walkingDistances(battle, owner)
    if (walk.filter(Number.isFinite).length >= open - 1 && mates.every((m) => walk[m.y * GRID + m.x] < Infinity)) return unit
    battle.units.splice(battle.units.indexOf(unit), 1)
  }
}

/** A drop turret: it never moves, and shoots far and true. */
export const TURRET: Stats = { ...BASE_STATS, hp: 8, damage: 3, range: 7, move: 0, crit: 0.1 }

/** A holo-decoy: tough, unmoving, and harmless. */
export const DECOY: Stats = { ...BASE_STATS, hp: 10, armor: 2, damage: 0, range: 0, move: 0, crit: 0 }
