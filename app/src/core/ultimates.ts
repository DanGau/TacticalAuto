// Tier 4 powers: once a battle, each hero's moment. Each says when it is worth spending and what it does.
import { cloakOn } from './abilities'
import { BURN_TURNS, CHILL_TURNS, CRIT_BONUS, isSoldier, type Battle, type Tile, type Unit } from './battle'
import type { GameEvent } from './combat-event'
import { fireproof, foes, FIRE_TURNS, has, onTile } from './fighters'
import { distance, freeTilesNear, NEIGHBORS, onGrid, wreck } from './grid'
import { randomInt } from './rng'
import type { ULTIMATE_EFFECTS } from './skill-effects'
import { mechUnit } from './spawn'
import { wound } from './wound'

export const SPREE = { strikes: 6, reach: 10, damage: 3 }
export const INDESTRUCTIBLE = { turns: 3, damage: 3 }
export const LEVEL_BLOCK = { radius: 6, damage: 6 }
export const EXTINCTION = { meteors: 6, radius: 2, damage: 5 }
export const TITAN_FORM = { hp: 10, armor: 6, damage: 3 }
export const QUAKE = { radius: 8, damage: 5 }
export const BULLET_TIME = { targets: 8, damage: 2 }
export const SENTENCE = 10
export const MIRRORS = { images: 4, hp: 6 }
export const COLOSSUS = { hp: 40, armor: 4, damage: 8, range: 6, move: 3, crit: 0.2 }
export const DRONE_STORM = { strikes: 12, damage: 3 }
export const ORBITAL = { length: 30, damage: 12 }
export const SHIELD_TURNS = 2
export const TIME_STOP = 2
export const SUPERNOVA = { radius: 5, damage: 10 }
export const ABLAZE = { burn: 6, damage: 2 }
export const ZERO = { damage: 4, frozen: 2 }
export const BLIZZARD = { turns: 3, radius: 6, damage: 2 }
export const HAIL = { shards: 16, damage: 3 }
export const LEGION = { blades: 6, damage: 3 }

/** A tier 4. Phoenix Rising fires as its hero falls, in `wound`; the rest on a hero's turn, by `ultimates`. */
export type UltimateEffect = (typeof ULTIMATE_EFFECTS)[number]

/** Aliens in the fight that make a tier 4 worth spending by their number alone. */
const CROWD = 3

const halfDown = (unit: Unit) => unit.hp <= unit.stats.hp / 2
const soldiers = (battle: Battle) => battle.units.filter(isSoldier)
const near = (battle: Battle, unit: Unit, radius: number) => foes(battle, unit).filter((u) => distance(u, unit) <= radius)

/** The fight has come to it: a crowd, a boss, or a hero of the squad at half HP. */
const moment = (battle: Battle, unit: Unit) => {
  const fight = foes(battle, unit)
  return fight.length >= CROWD || (fight.length > 0 && (fight.some((u) => u.boss || u.target) || soldiers(battle).some(halfDown)))
}

/** Hurts each of `caught`, past armor if `pierce`, saying so over each. */
function strike(battle: Battle, caught: Unit[], amount: number, effect: UltimateEffect, events: GameEvent[], pierce = false): void {
  for (const foe of caught.filter((u) => u.hp > 0)) {
    events.push({ type: 'effect', id: foe.id, effect, amount: -amount })
    wound(battle, foe, amount, events, pierce, true)
  }
}

/** A rain of `count` quick shots from `unit`, each at an alien left in the fight. */
function barrage(battle: Battle, unit: Unit, count: number, amount: number, effect: UltimateEffect, events: GameEvent[], pierce = false, chill = false): void {
  for (let i = 0; i < count; i++) {
    const left = foes(battle, unit).filter((u) => u.hp > 0)
    if (left.length === 0) return
    const target = left[randomInt(battle, left.length)]
    events.push({ type: 'shot', id: unit.id, target: target.id, crit: true, damage: amount, with: [effect], nth: 1 + (i % 3), lasts: 90 })
    if (chill && !target.resists.includes('frost')) target.chilled = CHILL_TURNS
    wound(battle, target, amount, events, pierce, true)
  }
}

const freeze = (unit: Unit, turns: number) => {
  unit.surprised = Math.max(unit.surprised, unit.boss ? 1 : turns)
}

const burn = (battle: Battle, unit: Unit, turns: number) => {
  if (unit.hp > 0 && !fireproof(battle, unit)) unit.burning = Math.max(unit.burning, turns)
}

/** How an ultimate lands, for the view: how far it reaches, and for a beam where it ends. */
type Landing = { radius?: number; to?: Tile } | void

interface Ultimate {
  when: (battle: Battle, unit: Unit, seen: Set<number>) => boolean
  go: (battle: Battle, unit: Unit, events: GameEvent[], seen: Set<number>) => Landing
}

const ultimates = {
  killingSpree: {
    when: moment,
    go(battle, unit, events) {
      for (let i = 0; i < SPREE.strikes; i++) {
        const left = near(battle, unit, SPREE.reach).filter((u) => u.hp > 0)
        const target = left.reduce<Unit | undefined>((best, u) => (!best || distance(u, unit) < distance(best, unit) ? u : best), undefined)
        if (!target) break
        const [tile] = freeTilesNear(battle, target, 1)
        if (tile) {
          Object.assign(unit, { ...tile, moved: true })
          events.push({ type: 'move', id: unit.id, path: [tile], with: 'killingSpree' })
        }
        const damage = unit.stats.damage + SPREE.damage
        events.push({ type: 'shot', id: unit.id, target: target.id, crit: true, damage, with: ['killingSpree'], nth: 1, lasts: 120 })
        wound(battle, target, damage, events, false, true)
      }
    },
  },
  indestructible: {
    when: (battle, unit) => halfDown(unit) && foes(battle, unit).length > 0,
    go(_battle, unit) {
      unit.invulnerable = INDESTRUCTIBLE.turns
      unit.stats = { ...unit.stats, damage: unit.stats.damage + INDESTRUCTIBLE.damage }
    },
  },
  levelBlock: {
    when: (battle, unit) => near(battle, unit, LEVEL_BLOCK.radius).length >= 2,
    go(battle, unit, events) {
      wreck(battle, unit, LEVEL_BLOCK.radius)
      strike(battle, near(battle, unit, LEVEL_BLOCK.radius), LEVEL_BLOCK.damage, 'levelBlock', events)
      return { radius: LEVEL_BLOCK.radius }
    },
  },
  extinction: {
    when: moment,
    go(battle, unit, events) {
      for (let i = 0; i < EXTINCTION.meteors; i++) {
        const left = foes(battle, unit).filter((u) => u.hp > 0)
        if (left.length === 0) break
        const at = left.reduce((best, u) => (left.filter((o) => distance(o, u) <= EXTINCTION.radius).length > left.filter((o) => distance(o, best) <= EXTINCTION.radius).length ? u : best))
        const caught = left.filter((o) => distance(o, at) <= EXTINCTION.radius)
        const { x, y } = at
        wreck(battle, { x, y }, EXTINCTION.radius)
        events.push({ type: 'rocket', id: -1, x, y, hits: caught.map((u) => ({ target: u.id, damage: EXTINCTION.damage })), label: 'METEOR' })
        for (const u of caught) wound(battle, u, EXTINCTION.damage, events)
      }
    },
  },
  titanForm: {
    when: (battle, unit) => halfDown(unit) && foes(battle, unit).length > 0,
    go(_battle, unit) {
      unit.stats = { ...unit.stats, hp: unit.stats.hp + TITAN_FORM.hp, armor: unit.stats.armor + TITAN_FORM.armor, damage: unit.stats.damage + TITAN_FORM.damage }
      Object.assign(unit, { hp: unit.stats.hp, armor: unit.armor + TITAN_FORM.armor, giant: true })
      if (!has(unit, 'taunt')) unit.effects = [...unit.effects, 'taunt']
    },
  },
  earthquake: {
    when: (battle, unit) => near(battle, unit, QUAKE.radius).length >= 2,
    go(battle, unit, events) {
      const caught = near(battle, unit, QUAKE.radius)
      wreck(battle, unit, 2)
      for (const foe of caught) freeze(foe, 1)
      strike(battle, caught, QUAKE.damage, 'earthquake', events)
      return { radius: QUAKE.radius }
    },
  },
  bulletTime: {
    when: moment,
    go(battle, unit, events, seen) {
      const damage = unit.stats.damage + CRIT_BONUS + BULLET_TIME.damage
      for (const target of foes(battle, unit).filter((u) => seen.has(u.id)).slice(0, BULLET_TIME.targets)) {
        events.push({ type: 'shot', id: unit.id, target: target.id, crit: true, damage, with: ['bulletTime'], nth: 1, lasts: 150 })
        wound(battle, target, damage, events, false, true)
      }
    },
  },
  deathSentence: {
    when: moment,
    go(battle, unit, events) {
      const target = foes(battle, unit).reduce((best, u) => (u.hp + u.armor > best.hp + best.armor ? u : best))
      const to = { x: target.x, y: target.y }
      const damage = Math.ceil(target.hp / 2) + SENTENCE
      events.push({ type: 'shot', id: unit.id, target: target.id, crit: true, damage, with: ['deathSentence'] })
      wound(battle, target, damage, events, true, true)
      return { to }
    },
  },
  hallOfMirrors: {
    when: moment,
    go(battle, unit, events) {
      for (const tile of freeTilesNear(battle, unit, MIRRORS.images)) {
        const image = mechUnit(battle, unit, { ...unit.stats, hp: MIRRORS.hp, armor: 0, damage: Math.max(1, Math.ceil(unit.stats.damage / 2)) }, ['taunt'], tile)
        battle.units.push(image)
        events.push({ type: 'spawn', id: unit.id, unit: { id: image.id, x: image.x, y: image.y } })
      }
    },
  },
  colossus: {
    when: moment,
    go(battle, unit, events) {
      const [tile] = freeTilesNear(battle, unit, 1)
      if (!tile) return
      const giant = mechUnit(battle, unit, { hp: COLOSSUS.hp, armor: COLOSSUS.armor, damage: COLOSSUS.damage, range: COLOSSUS.range, move: COLOSSUS.move, crit: COLOSSUS.crit, strength: 6, jump: 1 }, ['taunt'], tile)
      giant.giant = true
      battle.units.push(giant)
      events.push({ type: 'spawn', id: unit.id, unit: { id: giant.id, x: giant.x, y: giant.y } })
    },
  },
  droneStorm: {
    when: moment,
    go: (battle, unit, events) => barrage(battle, unit, DRONE_STORM.strikes, DRONE_STORM.damage, 'droneStorm', events),
  },
  orbital: {
    when: moment,
    go(battle, unit, events) {
      const fight = foes(battle, unit)
      const rays = NEIGHBORS.map(([dx, dy]) => Array.from({ length: ORBITAL.length }, (_, k) => ({ x: unit.x + dx * (k + 1), y: unit.y + dy * (k + 1) })).filter((t) => onGrid(t.x, t.y)))
      const onRay = (ray: Tile[]) => fight.filter((u) => ray.some((t) => distance(t, u) <= 1))
      const ray = rays.reduce((best, r) => (onRay(r).length > onRay(best).length ? r : best))
      const caught = onRay(ray)
      for (const tile of ray) wreck(battle, tile, 1)
      strike(battle, caught, ORBITAL.damage, 'orbital', events, true)
      return { to: ray.at(-1) }
    },
  },
  resurrection: {
    when: (battle) => battle.downed.some((d) => d.unit && d.carrier === null) || soldiers(battle).some((u) => u.hp <= u.stats.hp / 3),
    go(battle, unit, events) {
      const fallen = battle.downed.filter((d) => d.unit && d.carrier === null)
      battle.downed = battle.downed.filter((d) => !fallen.includes(d))
      const tiles = freeTilesNear(battle, unit, fallen.length)
      fallen.forEach((d, i) => {
        const risen = d.unit!
        Object.assign(risen, { ...(tiles[i] ?? { x: d.x, y: d.y }), hp: risen.stats.hp, armor: risen.stats.armor, burning: 0, chilled: 0, panicked: false })
        battle.units.push(risen)
        events.push({ type: 'freed', id: unit.id, unit: { id: risen.id, x: risen.x, y: risen.y } })
      })
      for (const mate of soldiers(battle).filter((u) => u.hp < u.stats.hp)) {
        const amount = mate.stats.hp - mate.hp
        mate.hp += amount
        events.push({ type: 'heal', id: unit.id, target: mate.id, amount })
      }
    },
  },
  divineShield: {
    when: (battle, unit) => foes(battle, unit).length > 0 && soldiers(battle).some(halfDown),
    go(battle, unit) {
      for (const ally of battle.units.filter((u) => u.side === unit.side && !u.civilian)) ally.invulnerable = SHIELD_TURNS
    },
  },
  timeStop: {
    when: moment,
    go(battle) {
      for (const alien of battle.units.filter((u) => u.side === 'alien')) alien.surprised = Math.max(alien.surprised, TIME_STOP)
    },
  },
  supernova: {
    when: (battle, unit) => near(battle, unit, SUPERNOVA.radius).length >= 2,
    go(battle, unit, events) {
      const caught = near(battle, unit, SUPERNOVA.radius)
      unit.hp = Math.max(1, Math.ceil(unit.hp / 2))
      wreck(battle, unit, 2)
      strike(battle, caught, SUPERNOVA.damage, 'supernova', events)
      for (const foe of caught) burn(battle, foe, BURN_TURNS)
      return { radius: SUPERNOVA.radius }
    },
  },
  worldAblaze: {
    when: moment,
    go(battle, unit, events) {
      const caught = foes(battle, unit)
      for (const foe of caught) {
        foe.armor = 0
        burn(battle, foe, ABLAZE.burn)
        if (!onTile(battle.fire, foe)) battle.fire.push({ x: foe.x, y: foe.y, turns: FIRE_TURNS })
      }
      strike(battle, caught, ABLAZE.damage, 'worldAblaze', events)
      return { radius: 30 }
    },
  },
  absoluteZero: {
    when: moment,
    go(battle, unit, events) {
      const caught = foes(battle, unit)
      for (const foe of caught) {
        freeze(foe, ZERO.frozen)
        if (!foe.resists.includes('frost')) Object.assign(foe, { chilled: ZERO.frozen + 1, rooted: ZERO.frozen + 1 })
      }
      strike(battle, caught, ZERO.damage, 'absoluteZero', events, true)
      return { radius: 30 }
    },
  },
  blizzard: {
    when: moment,
    go(battle, unit, events) {
      unit.storm = BLIZZARD.turns
      stormBlows(battle, unit, events)
      return { radius: BLIZZARD.radius }
    },
  },
  hailOfIcicles: {
    when: moment,
    go: (battle, unit, events) => barrage(battle, unit, HAIL.shards, HAIL.damage, 'hailOfIcicles', events, false, true),
  },
  eclipse: {
    when: moment,
    go(battle, _unit, events) {
      for (const ally of soldiers(battle)) events.push(cloakOn(ally))
      return { radius: 30 }
    },
  },
  reap: {
    when: moment,
    go(battle, unit, events) {
      for (const foe of foes(battle, unit)) {
        const dies = foe.hp <= foe.stats.hp / 2 && !foe.boss && !foe.target
        const amount = dies ? foe.hp : Math.ceil(foe.hp / 2)
        strike(battle, [foe], amount, 'reap', events, true)
      }
      return { radius: 30 }
    },
  },
  phantomLegion: {
    when: moment,
    go: (battle, unit, events) => barrage(battle, unit, LEGION.blades, unit.stats.damage + LEGION.damage, 'phantomLegion', events, true),
  },
} satisfies Record<Exclude<UltimateEffect, 'phoenixRising'>, Ultimate>

/** The hero's tier 4, if it has one unspent and now is its moment. It costs no attack. */
export function ultimate(battle: Battle, unit: Unit, seen: Set<number>): GameEvent[] {
  for (const [effect, power] of Object.entries(ultimates) as [keyof typeof ultimates, Ultimate][]) {
    if (!has(unit, effect) || unit.spent.includes(effect) || !power.when(battle, unit, seen)) continue
    unit.spent.push(effect)
    const events: GameEvent[] = []
    const at = { x: unit.x, y: unit.y }
    const landing = power.go(battle, unit, events, seen) ?? {}
    return [{ type: 'ultimate', id: unit.id, effect, ...at, radius: landing.radius ?? 0, ...(landing.to ? { to: landing.to } : {}) }, ...events]
  }
  return []
}

/** A blizzard's blow: each alien near its owner is chilled and hurt. */
export function stormBlows(battle: Battle, unit: Unit, events: GameEvent[]): void {
  const caught = near(battle, unit, BLIZZARD.radius)
  for (const foe of caught) if (!foe.resists.includes('frost')) foe.chilled = CHILL_TURNS
  strike(battle, caught, BLIZZARD.damage, 'blizzard', events)
}
