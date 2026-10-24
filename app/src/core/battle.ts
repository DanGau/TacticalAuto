import type { AlienKind } from './aliens'
import type { Keyword, Resist } from './keywords'
import { randomInt } from './rng'
import { CIVILIAN_HP, CIVILIANS, type Goal } from './goals'
import { generateTerrain, PROP_COVER, type Cover, type Edge, type Ground, type Prop, type TerrainKind } from './terrain'

export type { Cover }

export const GRID = 32
/** A battle still running at this beat ends as a draw. */
export const MAX_BEATS = 1000
/** Damage a crit adds. */
export const CRIT_BONUS = 2
/** Hit chance a target's cover removes, indexed by Cover. */
export const COVER_DEFENSE = [0, 0.2, 0.4]
/** Tiles within which a soldier with line of sight reveals an alien. */
export const SIGHT = 8
/** What a soldier's shots gain against an ambushed pod: hit chance, and chance for a hit to crit. */
export const AMBUSH_AIM = 0.2
export const AMBUSH_CRIT = 0.25
/** Tiles an alien moves per turn before its pod is revealed. */
export const PATROL_MOVE = 2
/** Damage a rocket does to every unit within BLAST_RADIUS tiles of where it lands. */
export const ROCKET_DAMAGE = 4
export const BLAST_RADIUS = 1
/** Health a medic restores, to a soldier within MEDIC_REACH tiles. */
export const MEDIC_HEAL = 4
export const MEDIC_REACH = 2
/** Tiles a unit in the standoff stance keeps from every enemy. */
export const STANDOFF = 7
/** Damage a grenade does within BLAST_RADIUS. */
export const GRENADE_DAMAGE = 3
/** Health a medkit restores to its carrier. */
export const MEDKIT_HEAL = 4
/** Turns a burning unit takes BURN_DAMAGE at the start of. */
export const BURN_TURNS = 2
export const BURN_DAMAGE = 1

export const CHILL_TURNS = 2
export const CHILL_MOVE = 2
export const CHILL_AIM = 0.15
export const SHATTER_DAMAGE = 2
export const THERMAL_DAMAGE = 3
export const SPOTTER_AIM = 0.15
/** Damage the executioner effect adds against a target at half health or less. */
export const EXECUTE_BONUS = 2
/** Damage a burster's explosion does within BLAST_RADIUS. */
export const BURST_DAMAGE = 4
/** Damage a spitter's spit does, the turns its acid lies on the tile, and the damage acid does to a unit still in it after its side moves. */
export const SPIT_DAMAGE = 1
export const ACID_TURNS = 2
export const ACID_DAMAGE = 2
/** Tiles a psion's panic reaches, the alien turns between its uses, and the damage its death does to its pod. */
export const PSI_RANGE = 7
export const PSI_COOLDOWN = 3
export const PSI_BACKLASH = 2
/** Alien turns between the swarmlings a boss spawns. */
export const SPAWN_EVERY = 2
/** What skills and relics are worth. Each name says the effect; skills.ts and relics.ts say what the effect does. */
export const BACKSTAB_DAMAGE = 2
export const RAGE_DAMAGE = 2
export const DODGE_CHANCE = 0.25
export const SUPPRESS_AIM = 0.25
export const AURA_REACH = 2
export const BULWARK_DEFENSE = 0.1
export const INSPIRE_AIM = 0.1
export const HEADSHOT_DAMAGE = 2
export const MARK_DAMAGE = 1
export const REVIVE_REACH = 3
export const REVIVE_HEALTH = 3
export const BARRIER_ARMOR = 2
export const SURGEON_HEAL = 3
export const FEAST_HEAL = 2
export const PHOENIX_HEALTH = 5
export const SECOND_WIND_HEAL = 5
export const SKIRMISH_MOVE = 2
export const RECKLESS_AIM = 0.2
export const CLEAVE_DAMAGE = 2
export const THICK_ARMOR = 1
export const BIG_BLAST_RADIUS = 2
export const SLAYER_DAMAGE = 2
export const GHOST_REACH = 4
export const HASTE_MOVE = 2
export const BANE_REACH = 3
export const BANE_AIM = 0.1
export const DRONE_DAMAGE = 2
export const DRONE_REACH = 5
/** Landing zones offered to the squad. */
export const ZONES = 3
/** Tiles around a landing zone's centre that count as the zone. */
export const ZONE_RADIUS = 3
/** Tiles a landing zone keeps from every alien and from the other zones. */
export const ZONE_CLEARANCE = 9

export type Side = 'human' | 'alien'

export type Tile = { x: number; y: number }

export interface Stats {
  hp: number
  /** Points that take damage before health does. */
  armor: number
  /** Chance to hit a target at full range with no cover against the shooter. */
  aim: number
  damage: number
  /** Tiles a shot reaches, counting a diagonal as one. */
  range: number
  /** Tiles the unit may move in its side's turn. */
  move: number
  /** Chance a hit crits when the target has no cover against the shooter. */
  crit: number
  /** Hit chance a shot gains for each tile the target is nearer than the range. */
  close: number
}

export const BASE_STATS: Stats = { hp: 10, armor: 0, aim: 0.75, damage: 3, range: 5, move: 4, crit: 0.5, close: 0.06 }

/** Something a unit does unprompted beyond moving and shooting; each is described where combat applies it. */
export type Ability = 'runAndGun' | 'rocket' | 'squadsight' | 'medic'

/** Something a piece of gear does; gear.ts says what each does. */
export type GearEffect = 'frostbite' | 'tracer' | 'rime' | 'incendiary' | 'piercing' | 'vampiric' | 'executioner' | 'chain' | 'thorns' | 'shield' | 'regen' | 'lastStand' | 'medkit' | 'grenade'
/** Something a skill does; skills.ts says what each does. */
export type SkillEffect =
  | 'frenzy'
  | 'backstab'
  | 'rage'
  | 'dodge'
  | 'shred'
  | 'suppress'
  | 'bulwark'
  | 'overwatch'
  | 'steady'
  | 'headshot'
  | 'mark'
  | 'doubleTap'
  | 'pierce'
  | 'revive'
  | 'inspire'
  | 'barrier'
  | 'surgeon'
  | 'surge'
  | 'secondWind'
  | 'skirmish'
  | 'reckless'
  | 'cleave'
  | 'taunt'
  | 'thick'
  | 'steadfast'
  | 'bigBlast'
  | 'concussion'
  | 'assassinate'
  | 'slayer'
  | 'volley'
  | 'ghost'
  | 'haste'
  | 'vitality'
  | 'bane'
  | 'ward'
  | 'drone'
/** Something a relic does; relics.ts says what each does. */
export type RelicEffect = 'opener' | 'rearm' | 'feast' | 'phoenix' | 'accelerant' | 'wildfire' | 'ignite' | 'freeze' | 'shatter' | 'thermal' | 'spotter' | 'exploit' | 'momentum' | 'bloodRite' | 'armored' | 'conductor' | 'kindling' | 'overkill' | 'brittle'
/** Anything a unit's gear, skills or the squad's relics do. Combat applies them. */
export type Effect = GearEffect | SkillEffect | RelicEffect

/** How a unit chooses where to stand; each is described where combat applies it. */
export type Stance = 'balanced' | 'rush' | 'anchor' | 'standoff' | 'escort'

/** An alien to place in a battle. A boss is the one a key or final mission is about. */
export interface Alien {
  kind: AlienKind
  stats: Stats
  stance: Stance
  boss: boolean
  /** Whether it spawns swarmlings. */
  spawns: boolean
  /** Whether it is the commander an assassination is after. */
  target: boolean
  resists: Resist[]
}

/** A soldier waiting to land. */
export interface Reserve {
  soldier: number
  stats: Stats
  ability: Ability | null
  charges: number
  stance: Stance
  effects: Effect[]
}

export interface Unit {
  id: number
  side: Side
  x: number
  y: number
  hp: number
  /** Armor left. */
  armor: number
  stats: Stats
  /** The soldier this unit is; null for aliens. */
  soldier: number | null
  /** Index of the alien's pod; null for humans. */
  pod: number | null
  ability: Ability | null
  /** Uses of the ability left this battle. */
  charges: number
  stance: Stance
  /** Effects of the unit's gear. */
  effects: Effect[]
  /** Once-per-battle effects already used. */
  spent: Effect[]
  /** Turns of burning left. */
  burning: number
  /** Own turns for which it is chilled. */
  chilled: number
  /** Damage its kills this battle have added, by blood rite. */
  fury: number
  /** The kind of alien; null for humans. */
  kind: AlienKind | null
  boss: boolean
  /** Whether it spawns swarmlings; false for humans. */
  spawns: boolean
  /** Whether it is the commander an assassination is after. */
  target: boolean
  /** Keywords it shrugs off; empty for humans. */
  resists: Resist[]
  /** A civilian to rescue: on the human side, but never moves or shoots, and is not a soldier. */
  civilian: boolean
  /** Whether the unit loses its next action. */
  panicked: boolean
  /** Whether the unit has moved this turn. */
  moved: boolean
  /** Own turns for which its aim is suppressed. */
  suppressed: number
  /** Whether every hit on it does 1 more damage. */
  marked: boolean
  /** Alien turns until the unit's recurring ability is ready: a psion's panic, a spawner's spawn. */
  cooldown: number
}

/** A group of aliens. It patrols toward its waypoint, unseen, until a soldier sights a member; then it fights. */
export interface Pod {
  /** The name of its pack. */
  name: string
  revealed: boolean
  /** Caught unaware by a concealed squad: until the squad's turn ends, shots at its members gain the ambush bonus. */
  ambushed: boolean
  /** Revealed during the current alien turn, so its members do not shoot until the next. */
  surprised: boolean
  waypoint: Tile
}

export interface Battle {
  rng: number
  goal: Goal
  /** Alien turns begun. */
  round: number
  /** Packs still to arrive on a hold, one every WAVE_EVERY rounds. */
  waves: { name: string; aliens: Alien[] }[]
  /** Calls to stepBattle so far. */
  beat: number
  phase: 'deploy' | 'battle' | 'over'
  /** The side whose turn it is. A turn is one move stage, then one shot per unit. */
  turn: Side
  stage: 'move' | 'shoot'
  /** Id of the last unit to shoot this turn; 0 before the first shot. */
  shooter: number
  /** Set when phase is 'over'; null is a draw. */
  winner: Side | null
  units: Unit[]
  nextId: number
  /** The cover each tile's prop gives, one entry per tile, row by row; read it with coverAt. */
  cover: Cover[]
  ground: Ground[]
  /** How high each tile stands; read it with heightAt. */
  height: number[]
  props: Prop[]
  /** What stands on each tile's north edge and west edge; read them with edgeBetween. */
  north: Edge[]
  west: Edge[]
  pods: Pod[]
  /** Once-per-battle effects of the whole squad already used. */
  used: Effect[]
  /** True from the landing until the first pod is sighted. That pod is ambushed. */
  concealed: boolean
  /** Tiles of acid, each with the alien turns it has left. */
  acid: { x: number; y: number; turns: number }[]
  /** Centres of the landing zones on offer in the deploy phase. */
  zones: Tile[]
  /** On a hold, the uplink the squad must reach and defend; null otherwise. */
  uplink: Tile | null
  /** The keyword each landing zone grants the squad for the battle, in zones order. */
  boons: Keyword[]
  /** Soldiers not yet landed. */
  reserve: Reserve[]
}

/** Tiles between two points, counting a diagonal as one. */
export const distance = (a: Tile, b: Tile) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y))

export const NEIGHBORS = [[0, -1], [1, 0], [0, 1], [-1, 0], [1, -1], [1, 1], [-1, 1], [-1, -1]]

export const onGrid = (x: number, y: number) => x >= 0 && y >= 0 && x < GRID && y < GRID

export const heightAt = (battle: Battle, tile: Tile) => battle.height[tile.y * GRID + tile.x]

/** Tiles of sight a unit gains for each level it stands above what it looks at, and loses for each below. */
export const HIGH_SIGHT = 2
/** Aim a shot gains for each level the shooter stands above its target, and loses for each below. */
export const HIGH_AIM = 0.1
/** Move a step costs beyond its one tile for each level it climbs. */
export const CLIMB = 2

/** What a step between neighbouring tiles costs of a unit's move: one tile, and CLIMB more for each level up. */
export const stepCost = (battle: Battle, from: Tile, to: Tile) => 1 + CLIMB * Math.max(0, heightAt(battle, to) - heightAt(battle, from))

export function coverAt(battle: Battle, x: number, y: number): Cover {
  return battle.cover[y * GRID + x]
}

export function unitAt(battle: Battle, x: number, y: number): Unit | undefined {
  return battle.units.find((u) => u.x === x && u.y === y)
}

/** Removes everything a blast catches: the props on tiles within `radius` of `centre`, and the walls and windows around those tiles. */
export function wreck(battle: Battle, centre: Tile, radius = BLAST_RADIUS): void {
  for (let y = centre.y - radius; y <= centre.y + radius; y++) {
    for (let x = centre.x - radius; x <= centre.x + radius; x++) {
      if (!onGrid(x, y)) continue
      const tile = y * GRID + x
      battle.props[tile] = 'none'
      battle.cover[tile] = 0
      battle.ground[tile] = 'scorched'
      battle.north[tile] = battle.west[tile] = 'none'
      if (onGrid(x, y + 1)) battle.north[tile + GRID] = 'none'
      if (onGrid(x + 1, y)) battle.west[tile + 1] = 'none'
    }
  }
}

/** What stands on the line between two tiles that share a side. */
export function edgeBetween(battle: Battle, a: Tile, b: Tile): Edge {
  return a.y === b.y ? battle.west[a.y * GRID + Math.max(a.x, b.x)] : battle.north[Math.max(a.y, b.y) * GRID + a.x]
}

/** Whether a unit may step between two neighbouring tiles: no wall or window in the way, and on a diagonal, none at the corner it turns. */
export function passable(battle: Battle, from: Tile, to: Tile): boolean {
  if (from.x === to.x || from.y === to.y) return edgeBetween(battle, from, to) === 'none'
  const viaX = { x: to.x, y: from.y }
  const viaY = { x: from.x, y: to.y }
  return [viaX, viaY].every((via) => passable(battle, from, via) && passable(battle, via, to))
}

/** Whether nothing may stand on the tile: it is off the grid, cover, or occupied. */
export function blocked(battle: Battle, x: number, y: number): boolean {
  return !onGrid(x, y) || coverAt(battle, x, y) > 0 || unitAt(battle, x, y) !== undefined
}

/** Whether the alien fights in the open: humans always do, an alien once its pod is revealed. */
/** Whether the unit is a soldier: on the human side, and no civilian. */
export const isSoldier = (unit: Unit) => unit.side === 'human' && !unit.civilian

export function revealed(battle: Battle, unit: Unit): boolean {
  return unit.pod === null || battle.pods[unit.pod].revealed
}

/** The `count` free tiles nearest `centre` by walking, nearest first. */
export function freeTilesNear(battle: Battle, centre: Tile, count: number): Tile[] {
  const found: Tile[] = []
  const seen = new Set([centre.y * GRID + centre.x])
  const queue = [centre]
  for (const tile of queue) {
    if (!blocked(battle, tile.x, tile.y)) found.push(tile)
    if (found.length === count) break
    for (const [dx, dy] of NEIGHBORS) {
      const x = tile.x + dx
      const y = tile.y + dy
      if (!onGrid(x, y) || coverAt(battle, x, y) > 0 || seen.has(y * GRID + x) || !passable(battle, tile, { x, y })) continue
      seen.add(y * GRID + x)
      queue.push({ x, y })
    }
  }
  return found
}

const randomTile = (battle: Battle): Tile => ({ x: randomInt(battle, GRID), y: randomInt(battle, GRID) })

/** A random open tile at least `clearance` from every tile in `avoid`; the clearance shrinks if the map is too crowded. */
export function spacedTile(battle: Battle, avoid: Tile[], clearance: number): Tile {
  for (let tries = 0; ; tries++) {
    const tile = randomTile(battle)
    const needed = clearance - Math.floor(tries / 200)
    if (coverAt(battle, tile.x, tile.y) === 0 && avoid.every((other) => distance(tile, other) >= needed)) return tile
  }
}

/** What a landing zone offers: cover tiles in and around it, and the distance to the nearest alien. */
export function zoneInfo(battle: Battle, zone: Tile): { cover: number; contact: number } {
  let cover = 0
  for (let y = zone.y - ZONE_RADIUS; y <= zone.y + ZONE_RADIUS; y++) {
    for (let x = zone.x - ZONE_RADIUS; x <= zone.x + ZONE_RADIUS; x++) {
      if (onGrid(x, y) && coverAt(battle, x, y) > 0) cover++
    }
  }
  const aliens = battle.units.filter((u) => u.side === 'alien')
  return { cover, contact: Math.min(...aliens.map((u) => distance(zone, u))) }
}

/** What landing in a zone gives the squad for the battle, by the zone's keyword. */
export const BOONS: Record<Keyword, { name: string; text: string }> = {
  burn: { name: 'Fuel depot', text: "Every soldier's hits this battle set the target burning" },
  frost: { name: 'Coolant leak', text: 'Every alien starts the battle chilled' },
  mark: { name: 'Spotter tower', text: 'Every alien of the pod nearest this zone starts marked' },
  crit: { name: 'Sniper nest', text: 'Every soldier has +15% crit chance this battle' },
  kill: { name: 'War drums', text: 'Each kill gives the soldier who made it +1 damage for the rest of the battle' },
  ward: { name: 'Supply crates', text: 'Every soldier lands with +2 armor' },
}

const BOON_EFFECTS: Partial<Record<Keyword, Effect>> = { burn: 'incendiary', kill: 'bloodRite' }
export const BOON_CRIT = 0.15
export const BOON_ARMOR = 2

/** Lands the whole squad on the free tiles nearest the zone's centre, grants the zone's boon, and begins the battle. */
export function land(battle: Battle, zone: Tile): void {
  const boon = battle.boons[battle.zones.indexOf(zone)]
  const tiles = freeTilesNear(battle, zone, battle.reserve.length)
  battle.reserve.forEach((soldier, i) => {
    battle.units.push({ id: battle.nextId++, side: 'human', ...tiles[i], hp: soldier.stats.hp, armor: soldier.stats.armor, pod: null, spent: [], burning: 0, chilled: 0, fury: 0, kind: null, boss: false, spawns: false, target: false, resists: [], civilian: false, panicked: false, moved: false, suppressed: 0, marked: false, cooldown: 0, ...soldier })
  })
  battle.reserve = []
  battle.phase = 'battle'
  const squad = battle.units.filter((u) => u.side === 'human' && !u.civilian)
  const aliens = battle.units.filter((u) => u.side === 'alien')
  const effect = BOON_EFFECTS[boon]
  for (const unit of squad) {
    if (effect) unit.effects = [...unit.effects, effect]
    if (boon === 'crit') unit.stats = { ...unit.stats, crit: unit.stats.crit + BOON_CRIT }
    if (boon === 'ward') unit.armor += BOON_ARMOR
  }
  if (boon === 'frost') for (const alien of aliens.filter((u) => !u.resists.includes('frost'))) alien.chilled = CHILL_TURNS
  if (boon === 'mark' && aliens.length > 0) {
    const pod = aliens.reduce((a, b) => (distance(zone, a) <= distance(zone, b) ? a : b)).pod
    for (const alien of aliens.filter((u) => u.pod === pod && !u.resists.includes('mark'))) alien.marked = true
  }
  // A barrier projector armors every squadmate of its carrier.
  for (const carrier of squad.filter((u) => u.effects.includes('barrier'))) {
    for (const mate of squad) if (mate !== carrier) mate.armor += BARRIER_ARMOR
  }
}

/** Fills every open tile outside the largest walkable area with stacks, so any open tile can reach any other. */
function sealPockets(battle: Battle): void {
  const area = Array<number>(GRID * GRID).fill(-1)
  const sizes: number[] = []
  for (let start = 0; start < GRID * GRID; start++) {
    if (battle.cover[start] > 0 || area[start] >= 0) continue
    area[start] = sizes.length
    const queue = [start]
    for (const tile of queue) {
      for (const [dx, dy] of NEIGHBORS) {
        const x = (tile % GRID) + dx
        const y = Math.floor(tile / GRID) + dy
        const from = { x: tile % GRID, y: Math.floor(tile / GRID) }
        if (!onGrid(x, y) || battle.cover[y * GRID + x] > 0 || area[y * GRID + x] >= 0 || !passable(battle, from, { x, y })) continue
        area[y * GRID + x] = sizes.length
        queue.push(y * GRID + x)
      }
    }
    sizes.push(queue.length)
  }
  const largest = sizes.indexOf(Math.max(...sizes))
  area.forEach((id, tile) => {
    if (id < 0 || id === largest) return
    battle.cover[tile] = 2
    battle.props[tile] = 'stack'
  })
}

/** A new alien unit on a tile, in a pod. */
export function alienUnit(battle: Battle, alien: Alien, tile: Tile, pod: number): Unit {
  return {
    id: battle.nextId++,
    side: 'alien',
    ...tile,
    hp: alien.stats.hp,
    armor: alien.stats.armor,
    ...alien,
    soldier: null,
    pod,
    ability: null,
    charges: 0,
    effects: [],
    spent: [],
    burning: 0,
    chilled: 0,
    fury: 0,
    civilian: false,
    panicked: false,
    moved: false,
    suppressed: 0,
    marked: false,
    cooldown: alien.spawns ? SPAWN_EVERY : 0,
  }
}

/** Places a pack as a new pod around `centre`. */
export function placePod(battle: Battle, pack: { name: string; aliens: Alien[] }, centre: Tile, revealed: boolean): Unit[] {
  const units = freeTilesNear(battle, centre, pack.aliens.length).map((tile, i) => alienUnit(battle, pack.aliens[i], tile, battle.pods.length))
  battle.units.push(...units)
  battle.pods.push({ name: pack.name, revealed, ambushed: false, surprised: false, waypoint: randomTile(battle) })
  return units
}

/**
 * A battle awaiting the squad's landing, with terrain, alien pods, and landing zones placed. A hold keeps half its
 * packs back as waves and offers one landing zone, the uplink; a rescue places civilians away from the aliens.
 */
export function createBattle(seed: number, kind: TerrainKind, packs: { name: string; aliens: Alien[] }[], reserve: Reserve[], goal: Goal = 'exterminate'): Battle {
  const holder = { rng: seed }
  const terrain = generateTerrain(holder, GRID, kind)
  const battle: Battle = {
    rng: holder.rng,
    goal,
    round: 0,
    waves: goal === 'hold' ? packs.slice(Math.ceil(packs.length / 2)) : [],
    beat: 0,
    phase: 'deploy',
    turn: 'human',
    stage: 'move',
    shooter: 0,
    winner: null,
    units: [],
    nextId: 1,
    ...terrain,
    cover: terrain.props.map((prop) => PROP_COVER[prop]),
    pods: [],
    used: [],
    concealed: true,
    acid: [],
    zones: [],
    uplink: null,
    boons: [],
    reserve,
  }
  sealPockets(battle)

  const centres: Tile[] = []
  for (const pack of packs.slice(0, packs.length - battle.waves.length)) {
    const centre = spacedTile(battle, centres, ZONE_CLEARANCE)
    centres.push(centre)
    placePod(battle, pack, centre, false)
  }
  if (goal === 'rescue') {
    for (const tile of freeTilesNear(battle, spacedTile(battle, battle.units, ZONE_CLEARANCE), CIVILIANS)) {
      const stats = { ...BASE_STATS, hp: CIVILIAN_HP, aim: 0, damage: 0, range: 0, move: 0, crit: 0 }
      battle.units.push({ id: battle.nextId++, side: 'human', ...tile, hp: stats.hp, armor: 0, stats, soldier: null, pod: null, ability: null, charges: 0, stance: 'anchor', effects: [], spent: [], burning: 0, chilled: 0, fury: 0, kind: null, boss: false, spawns: false, target: false, resists: [], civilian: true, panicked: false, moved: false, suppressed: 0, marked: false, cooldown: 0 })
    }
  }
  if (goal === 'hold') battle.uplink = spacedTile(battle, battle.units, ZONE_CLEARANCE)
  while (battle.zones.length < ZONES) battle.zones.push(spacedTile(battle, [...battle.units, ...battle.zones, ...(battle.uplink ? [battle.uplink] : [])], ZONE_CLEARANCE))
  const boons = Object.keys(BOONS) as Keyword[]
  battle.boons = battle.zones.map(() => boons.splice(randomInt(battle, boons.length), 1)[0])
  return battle
}
