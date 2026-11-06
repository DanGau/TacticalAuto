// Boons in a battle: what each picked utility does as the squad lands, each turn it lasts, and as it ends.
import { isSoldier, type Battle, type Effect, type Stats, type Unit } from './battle'
import type { GameEvent } from './combat-event'
import { nearest } from './fighters'
import { distance } from './grid'
import { fuelTanks } from './objects'
import { chillUnit, kindle } from './stacks'
import { BLAZE_REACH, DAMPEN, FARSIGHT, GRAVITY, IRON_SKIN, KEEN, MEND, OVERCHARGE, SMOKE_REACH, STUN_TURNS, THRUST, UTILITIES, type UtilityId } from './utilities'

/** A boon under way: the round it ends, and what it added to each unit's stats, taken back then. */
export interface Boon {
  id: UtilityId
  until: number
  deltas: Record<number, Partial<Stats>>
}

/** The effect a boon lends each hero while it lasts. */
const LENT: Partial<Record<UtilityId, Effect>> = { crack: 'piercing', hover: 'hover', rangedShield: 'rangedShield', meleeShield: 'meleeShield' }

/** What a boon adds to a hero's stats, or to an alien's. */
const HERO: Partial<Record<UtilityId, (s: Stats) => Partial<Stats>>> = {
  thrusters: () => ({ move: THRUST }),
  overcharge: () => ({ damage: OVERCHARGE }),
  ironSkin: () => ({ armor: IRON_SKIN }),
  farsight: () => ({ range: FARSIGHT }),
  keen: () => ({ crit: KEEN }),
}
const ALIEN: Partial<Record<UtilityId, (s: Stats) => Partial<Stats>>> = {
  smoke: (s) => ({ range: Math.min(0, SMOKE_REACH - s.range) }),
  gravity: (s) => ({ move: -Math.min(GRAVITY, s.move - 1) }),
  dampener: (s) => ({ damage: -Math.min(DAMPEN, s.damage - 1) }),
}

const shift = (unit: Unit, delta: Partial<Stats>, sign: number) => {
  const stats = { ...unit.stats }
  for (const [key, value] of Object.entries(delta) as [keyof Stats, number][]) stats[key] += sign * value
  unit.stats = stats
}

/** Rounds `id` has left, if under way. */
export const roundsLeft = (battle: Battle, id: UtilityId) => {
  const boon = battle.boons.find((b) => b.id === id)
  return boon ? boon.until - battle.round : 0
}

/** The utility the player picked takes hold as the squad comes in. */
export function takeBoon(battle: Battle, id: UtilityId | null, tank: number): void {
  if (!id) return
  const boon: Boon = { id, until: battle.round + UTILITIES[id].rounds, deltas: {} }
  battle.boons.push(boon)
  const add = HERO[id] ?? ALIEN[id]
  for (const u of battle.units.filter((u) => u.hp > 0 && (ALIEN[id] ? u.side === 'alien' : isSoldier(u)))) {
    if (LENT[id]) u.effects = [...u.effects, LENT[id]]
    if (!add) continue
    boon.deltas[u.id] = add(u.stats)
    shift(u, boon.deltas[u.id], 1)
    if (id === 'ironSkin') u.armor += IRON_SKIN
  }
  if (id === 'tank') battle.rigged = fuelTanks(battle)[tank] ?? null
  if (id === 'flashbang') {
    const first = nearest(battle.units.filter((u) => u.side === 'alien' && u.engaged), battle.entry!)
    for (const u of battle.units.filter((a) => a.side === 'alien' && first && a.cluster === first.cluster)) u.surprised = u.boss ? STUN_TURNS - 1 : STUN_TURNS
  }
}

/** As the squad's turn begins: each boon under way does its turn's work, and each whose rounds are run ends, said on the units it held. */
export function tickBoons(battle: Battle, events: GameEvent[]): void {
  const heroes = battle.units.filter((u) => isSoldier(u) && u.hp > 0)
  const aliens = battle.units.filter((u) => u.side === 'alien' && u.hp > 0)
  for (const boon of battle.boons) {
    if (boon.until <= battle.round) {
      end(battle, boon, events)
      continue
    }
    if (boon.id === 'mending') for (const u of heroes.filter((u) => u.hp < u.stats.hp)) {
      const amount = Math.min(MEND, u.stats.hp - u.hp)
      u.hp += amount
      events.push({ type: 'effect', id: u.id, effect: 'regen', amount })
    }
    if (boon.id === 'coldSnap') for (const u of aliens.filter((u) => u.engaged)) chillUnit(battle, u, 1, events)
    if (boon.id === 'blaze' && battle.entry) for (const u of aliens.filter((u) => distance(u, battle.entry!) <= BLAZE_REACH)) kindle(battle, u, 1)
    if (boon.id === 'hunted') {
      const prey = aliens.reduce<Unit | null>((a, b) => (!a || b.stats.hp > a.stats.hp ? b : a), null)
      if (prey) prey.exposed = Math.max(prey.exposed, 1)
    }
  }
  battle.boons = battle.boons.filter((b) => b.until > battle.round)
}

/** A boon's bonus is taken back from every unit it held. */
function end(battle: Battle, boon: Boon, events: GameEvent[]): void {
  const lent = LENT[boon.id]
  const on: number[] = []
  for (const u of battle.units.filter((u) => u.hp > 0)) {
    const delta = boon.deltas[u.id]
    if (delta) {
      shift(u, delta, -1)
      if (delta.armor) u.armor = Math.min(u.armor, u.stats.armor)
      on.push(u.id)
    }
    const at = lent ? u.effects.indexOf(lent) : -1
    if (at >= 0) {
      u.effects = u.effects.filter((_, i) => i !== at)
      on.push(u.id)
    }
  }
  if (boon.id === 'tank') battle.rigged = null
  if (on.length === 0 && boon.id !== 'flashbang') on.push(...battle.units.filter((u) => isSoldier(u) && u.hp > 0).map((u) => u.id))
  events.push({ type: 'used', utility: boon.id, on, ended: true })
}
