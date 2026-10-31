// Actions in place of a shot: alien powers, and soldier skills and gear.
import { type Battle, type Effect, type Unit, BLAST_RADIUS, CLOAK_TURNS, isSoldier, FORCE_FIELD_REACH, FORCE_FIELD_ARMOR, SLAM_HIT, SLAM_TILES, STUN_REACH, SPIT_DAMAGE, ACID_TURNS, PSI_RANGE, PSI_COOLDOWN, SURGEON_HEAL, MEDIC_REACH, MEDIC_HEAL, SECOND_WIND_HEAL, revealed, DRONE_REACH, DRONE_DAMAGE, SKIRMISH_MOVE, MEDKIT_HEAL, TITAN_HEALTH, PLATING_ARMOR, MECH_STATS, DRONE_STATS, type Stats, type SkillEffect, engaged } from './battle'
import { mechUnit } from './spawn'
import { freeTilesNear } from './grid'
import { onGrid } from './grid'
import { NEIGHBORS } from './grid'
import { distance } from './grid'
import type { GameEvent } from './combat-event'
import { has, hostage, foes, shootable, nearest, immune, silenced, spend, enemiesOf, onTile, FIRE_TURNS } from './fighters'
import { walk, bestPath, paths, exposure } from './pathing'
import { canShoot, lineOfSight } from './sight'
import { wound, knockback, SLAM_DAMAGE } from './wound'

/** Ground Slam: once per battle, with two or more foes beside it, in place of an attack, it hurts each and hurls it back. */
export function slam(battle: Battle, unit: Unit): GameEvent[] {
  if (!has(unit, 'slam') || unit.spent.includes('slam')) return []
  const beside = foes(battle, unit).filter((u) => distance(u, unit) <= 1)
  if (beside.length < 2) return []
  unit.spent.push('slam')
  const events: GameEvent[] = [{ type: 'rocket', id: unit.id, x: unit.x, y: unit.y, hits: beside.map((u) => ({ target: u.id, damage: SLAM_HIT })) }]
  for (const foe of beside) {
    wound(battle, foe, SLAM_HIT, events)
    if (foe.hp > 0) knockback(battle, unit, foe, events, 1, SLAM_TILES, SLAM_DAMAGE, 'slam')
  }
  return events
}

/** Stuns each of `caught`, a boss aside: it loses its next action. */
export function stun(caught: Unit[], effect: Effect): GameEvent[] {
  return caught
    .filter((u) => !u.boss)
    .map((u) => {
      u.panicked = true
      return { type: 'effect', id: u.id, effect, amount: 0 }
    })
}

/**
 * Intimidate and EMP Pulse: once per battle, with two or more foes within STUN_REACH of the soldier, or for an EMP of
 * its machines too, each is stunned.
 */
export function pulse(battle: Battle, unit: Unit, effect: 'warcry' | 'emp'): GameEvent[] {
  if (!has(unit, effect) || unit.spent.includes(effect)) return []
  const centres = [unit, ...(effect === 'emp' ? battle.units.filter((u) => u.summoner !== null && u.summoner === unit.soldier) : [])]
  const caught = foes(battle, unit).filter((u) => !u.boss && centres.some((c) => distance(c, u) <= STUN_REACH))
  if (caught.length < 2) return []
  unit.spent.push(effect)
  return stun(caught, effect)
}

/** Flashbang: once per battle, at the foe it can attack with the most foes beside it, two or more, stunning each. */
export function flashbang(battle: Battle, unit: Unit, seen: Set<number>): GameEvent[] {
  if (!has(unit, 'flashbang') || unit.spent.includes('flashbang')) return []
  const all = foes(battle, unit).filter((u) => !u.boss)
  const knots = all.filter((u) => shootable(battle, unit, unit, u, seen)).map((centre) => all.filter((u) => distance(u, centre) <= BLAST_RADIUS))
  const caught = knots.reduce<Unit[]>((best, knot) => (knot.length > best.length ? knot : best), [])
  if (caught.length < 2) return []
  unit.spent.push('flashbang')
  return stun(caught, 'flashbang')
}

/** Force Field: once per battle, the most wounded soldier within reach at half health or less gains armor. */
export function forceField(battle: Battle, unit: Unit): GameEvent[] {
  if (!has(unit, 'forceField') || unit.spent.includes('forceField')) return []
  const mate = battle.units
    .filter((u) => isSoldier(u) && u.side === unit.side && u.hp <= u.stats.hp / 2 && distance(u, unit) <= FORCE_FIELD_REACH)
    .reduce<Unit | undefined>((worst, u) => (!worst || u.hp < worst.hp ? u : worst), undefined)
  if (!mate) return []
  unit.spent.push('forceField')
  mate.armor += FORCE_FIELD_ARMOR
  return [{ type: 'effect', id: mate.id, effect: 'forceField', amount: 0 }]
}

/** Polymorph: once per battle, the toughest alien the unit can shoot, a boss aside, becomes a chicken and loses its next action. */
export function polymorph(battle: Battle, unit: Unit, seen: Set<number>): GameEvent[] {
  if (!has(unit, 'polymorph') || unit.spent.includes('polymorph')) return []
  const target = battle.units
    .filter((u) => u.side !== unit.side && !u.boss && !u.panicked && shootable(battle, unit, unit, u, seen))
    .reduce<Unit | undefined>((best, u) => (!best || u.hp > best.hp ? u : best), undefined)
  if (!target) return []
  unit.spent.push('polymorph')
  target.panicked = true
  return [{ type: 'effect', id: target.id, effect: 'polymorph', amount: 0 }]
}

/** Spit: the nearest unit but a hostage the spitter can shoot is hit, and acid is left on its tile. */
export function spit(battle: Battle, unit: Unit): GameEvent[] {
  const target = nearest(
    battle.units.filter((u) => u.side !== unit.side && !u.cloaked && !hostage(battle, u) && canShoot(battle, unit, u, unit.stats.range)),
    unit,
  )
  if (!target) return []
  const events: GameEvent[] = [{ type: 'spit', id: unit.id, target: target.id, damage: SPIT_DAMAGE }]
  battle.acid = [...battle.acid.filter((pool) => pool.x !== target.x || pool.y !== target.y), { x: target.x, y: target.y, turns: ACID_TURNS }]
  wound(battle, target, SPIT_DAMAGE, events, unit.resists.includes('ward'))
  return events
}

/** Panic: when ready, the psion panics the soldier in reach and sight who hits hardest, not already panicked. */
export function panic(battle: Battle, unit: Unit): GameEvent[] {
  if (unit.cooldown > 0) return []
  const targets = battle.units.filter((u) => u.side !== unit.side && !u.cloaked && !u.panicked && !immune(battle, u, 'panic') && distance(unit, u) <= PSI_RANGE && lineOfSight(battle, unit, u))
  const target = targets.reduce<Unit | undefined>((best, u) => (!best || u.stats.damage > best.stats.damage ? u : best), undefined)
  if (!target) return []
  target.panicked = true
  unit.cooldown = PSI_COOLDOWN
  return [{ type: 'panic', id: unit.id, target: target.id }]
}

/** What an alien does in place of a shot, by its kind; empty if it shoots, or has nothing to do. */
export function alienAction(battle: Battle, unit: Unit): GameEvent[] | null {
  if (unit.kind && unit.kind !== 'trooper' && silenced(battle, unit)) return unit.kind === 'burster' ? [] : null
  if (unit.kind === 'incubator') return []
  if (unit.kind === 'spitter') return spit(battle, unit)
  if (unit.kind === 'psion') {
    const events = panic(battle, unit)
    return events.length > 0 ? events : null
  }
  if (unit.kind !== 'burster') return null
  // A burster beside a soldier blows itself up.
  const events: GameEvent[] = []
  if (battle.units.some((u) => u.side !== unit.side && distance(unit, u) <= 1)) wound(battle, unit, unit.hp, events)
  return events
}

/** Medic: heals the most wounded other soldier at half health or less within reach. It does not cost the medic's shot. */
export function heal(battle: Battle, unit: Unit): GameEvent[] {
  const wounded = battle.units
    .filter((u) => u.side === unit.side && u !== unit && u.hp <= u.stats.hp / 2 && distance(unit, u) <= MEDIC_REACH)
    .reduce<Unit | undefined>((worst, u) => (!worst || u.hp < worst.hp ? u : worst), undefined)
  if (!wounded) return []
  const amount = Math.min(MEDIC_HEAL + (has(unit, 'surgeon') ? SURGEON_HEAL : 0), wounded.stats.hp - wounded.hp)
  wounded.hp += amount
  return [{ type: 'heal', id: unit.id, target: wounded.id, amount }]
}

/** Second wind: once per battle, a soldier at half health or less heals. */
export function secondWind(unit: Unit): GameEvent[] {
  if (unit.hp > unit.stats.hp / 2 || !spend(unit, 'secondWind')) return []
  const amount = Math.min(SECOND_WIND_HEAL, unit.stats.hp - unit.hp)
  unit.hp += amount
  return [{ type: 'effect', id: unit.id, effect: 'secondWind', amount }]
}

/** A combat drone hits the nearest revealed alien its soldier has in sight within reach. */
export function drone(battle: Battle, unit: Unit): GameEvent[] {
  if (!has(unit, 'drone')) return []
  const target = nearest(
    battle.units.filter((u) => u.side !== unit.side && revealed(battle, u) && distance(unit, u) <= DRONE_REACH && lineOfSight(battle, unit, u)),
    unit,
  )
  if (!target) return []
  const events: GameEvent[] = [{ type: 'shot', id: unit.id, target: target.id, crit: false, damage: DRONE_DAMAGE, with: ['drone'] }]
  wound(battle, target, DRONE_DAMAGE, events)
  return events
}

/** A skirmisher steps to the tile in reach where the enemy's best shot at it is worst, then farthest from them. */
export function skirmish(battle: Battle, unit: Unit): GameEvent[] {
  if (!has(unit, 'skirmish')) return []
  const enemies = enemiesOf(battle, unit)
  const events: GameEvent[] = []
  walk(unit, bestPath(paths(battle, unit, SKIRMISH_MOVE), unit, (end) => [exposure(battle, enemies, end), -Math.min(...enemies.map((e) => distance(e, end)))]), events)
  return events.map((e) => (e.type === 'move' ? { ...e, with: 'skirmish' as const } : e))
}

/** Medkit: heals its carrier at half health or less. */
export function medkit(unit: Unit): GameEvent[] {
  if (unit.hp > unit.stats.hp / 2 || !spend(unit, 'medkit')) return []
  const amount = Math.min(MEDKIT_HEAL, unit.stats.hp - unit.hp)
  unit.hp += amount
  return [{ type: 'effect', id: unit.id, effect: 'medkit', amount }]
}

/** Each feeder in sight grows on a trick the squad's unit used in `events`: its ability, a grenade, or a once-per-battle effect. */
export function feed(battle: Battle, unit: Unit, events: GameEvent[]): GameEvent[] {
  const tricked = events.some((e) => (e.type === 'rocket' || e.type === 'heal' || e.type === 'spawn' || (e.type === 'effect' && e.amount >= 0)) && e.id === unit.id)
  if (!tricked) return []
  return battle.units
    .filter((u) => u.kind === 'feeder' && revealed(battle, u))
    .map((u) => {
      u.fury++
      return { type: 'feed', id: u.id, damage: u.fury }
    })
}

/**
 * Deploy Mech: once aliens are in sight, an engineer with a deploy left builds a mech beside it, a frail decoy every
 * alien that can shoot must shoot, or drones for a swarm, shaped by its skills. It costs no shot.
 */
export function deploy(battle: Battle, unit: Unit, seen: Set<number>): GameEvent[] {
  if (unit.ability !== 'mech' || unit.charges <= 0 || seen.size === 0) return []
  const swarm = has(unit, 'swarm')
  const stats: Stats = swarm ? { ...DRONE_STATS } : { ...MECH_STATS }
  if (has(unit, 'titan')) Object.assign(stats, { hp: stats.hp + TITAN_HEALTH, damage: stats.damage + 1 })
  if (has(unit, 'plating')) stats.armor += PLATING_ARMOR
  if (has(unit, 'servos')) Object.assign(stats, { move: stats.move + 2, damage: stats.damage + 1 })
  const granted: [SkillEffect, Effect][] = [['spotter', 'mark'], ['linked', 'inspire'], ['shock', 'snare'], ['detonate', 'detonate']]
  const effects = [...(swarm ? [] : ['taunt' as const]), ...granted.flatMap(([skill, effect]) => (has(unit, skill) ? [effect] : []))]
  const tiles = freeTilesNear(battle, unit, !swarm ? 1 : has(unit, 'hive') ? 3 : 2)
  if (tiles.length === 0) return []
  unit.charges--
  return tiles.map((tile) => {
    const mech = mechUnit(battle, unit, { ...stats }, effects, tile)
    battle.units.push(mech)
    return { type: 'spawn', id: unit.id, unit: { id: mech.id, x: mech.x, y: mech.y } }
  })
}

/**
 * Caltrops and Firewall: once per battle, an alien closing in finds the tiles between it and the soldier strewn with
 * caltrops, or set alight.
 */
export function strew(battle: Battle, unit: Unit, effect: 'caltrops' | 'firewall'): GameEvent[] {
  if (!has(unit, effect) || unit.spent.includes(effect)) return []
  const rusher = nearest(
    battle.units.filter((u) => u.side !== unit.side && revealed(battle, u) && engaged(battle, u) && distance(u, unit) <= CALTROP_RANGE && distance(u, unit) > CALTROP_LATE),
    unit,
  )
  if (!rusher) return []
  unit.spent.push(effect)
  const centre = { x: unit.x + 2 * Math.sign(rusher.x - unit.x), y: unit.y + 2 * Math.sign(rusher.y - unit.y) }
  for (const [dx, dy] of [[0, 0], ...NEIGHBORS]) {
    const tile = { x: centre.x + dx, y: centre.y + dy }
    if (!onGrid(tile.x, tile.y)) continue
    if (effect === 'caltrops' && !onTile(battle.caltrops, tile)) battle.caltrops.push(tile)
    if (effect === 'firewall' && !onTile(battle.fire, tile)) battle.fire.push({ ...tile, turns: FIRE_TURNS })
  }
  return [{ type: 'effect', id: unit.id, effect, amount: 0 }]
}

/** How near an alien closing in must come before caltrops are strewn in its path, and how near is too late. */
export const CALTROP_RANGE = 6

export const CALTROP_LATE = 2

/** Cloaks a unit for CLOAK_TURNS. */
export function cloakOn(unit: Unit): GameEvent {
  unit.cloaked = CLOAK_TURNS
  return { type: 'cloak', id: unit.id, on: true }
}

/**
 * Cloak: in place of its attacks, a phantom with a cloak left and none on cloaks once aliens can shoot it and it is
 * wounded, two can, or it has no shot of its own.
 */
export function cloak(battle: Battle, unit: Unit, seen: Set<number>): GameEvent[] {
  if (unit.ability !== 'cloak' || unit.charges <= 0 || unit.cloaked) return []
  const aliens = foes(battle, unit)
  const threats = aliens.filter((u) => shootable(battle, u, u, unit, seen)).length
  const shot = aliens.some((u) => shootable(battle, unit, unit, u, seen))
  if (threats === 0 || (shot && threats < 2 && unit.hp > unit.stats.hp / 2)) return []
  unit.charges--
  return [cloakOn(unit)]
}
