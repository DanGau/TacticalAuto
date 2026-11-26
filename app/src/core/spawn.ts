// Making units for a battle: aliens, soldiers, civilians.
import { NODE_SPAWNS, HATCH_TURNS } from './aliens'
import { type Battle, type Alien, type Tile, type Unit, FRESH, SPAWN_EVERY, BASE_STATS, type Reserve } from './battle'
import { CIVILIAN_MOVE } from './goals'

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
    cluster: 0,
    revealed: seen && alien.kind !== 'burrower',
    surprised: 0,
   
    // A hive node's charges are the swarmlings left in it.
    charges: alien.kind === 'hiveNode' ? NODE_SPAWNS : 0,
    // A commander blinks to safety once wounded.
    effects: [...(alien.target ? ['blink' as const] : []), ...(alien.exam ? [alien.exam] : [])],
    spent: [],
    ...FRESH,
    rooted: 0,
    booming: 0,
    civilian: false,
   
    panicked: false,
    moved: false,
    suppressed: 0,

    cooldown: alien.spawns ? SPAWN_EVERY : alien.kind === 'incubator' ? HATCH_TURNS : 0,
  }
}

/** A civilian with `hp` health, standing on `tile`. */
export function civilianUnit(battle: Battle, tile: Tile, hp: number): Unit {
  const stats = { ...BASE_STATS, hp, damage: 0, range: 0, move: CIVILIAN_MOVE, crit: 0, strength: 1, jump: 1 }
  return { id: battle.nextId++, side: 'human', ...tile, hp, armor: 0, stats, soldier: null, engaged: true, cluster: 0, revealed: true, surprised: 0, charges: 0, stance: 'anchor', effects: [], spent: [], ...FRESH, rooted: 0, booming: 0, kind: null, boss: false, spawns: false, target: false, resists: [], civilian: true, panicked: false, moved: false, suppressed: 0, cooldown: 0 }
}

/** A soldier's unit, coming in from the reserve on `tile`. */
export function soldierUnit(battle: Battle, soldier: Reserve, tile: Tile): Unit {
  return { id: battle.nextId++, side: 'human', ...tile, armor: soldier.stats.armor, engaged: true, cluster: 0, revealed: true, surprised: 0, charges: 0, spent: [], ...FRESH, rooted: 0, booming: 0, kind: null, boss: false, spawns: false, target: false, resists: [], civilian: false, panicked: false, moved: false, suppressed: 0, cooldown: 0, ...soldier }
}
