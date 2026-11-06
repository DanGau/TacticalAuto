// Boons in a battle: what each picked utility does as the squad lands, each turn it lasts, and as it ends.
import { fx } from './sources'
import { isSoldier, type Battle, type Effect, type Stats, type Unit } from './battle'
import type { GameEvent } from './combat-event'
import { nearest } from './fighters'
import { distance } from './grid'
import { fuelTanks } from './objects'
import { chillUnit, kindle } from './stacks'
import { BLAZE_REACH, effectsOf, MINOR, SMOKE_REACH, STRENGTH, STUN_TURNS, UTILITIES, type EffectId, type MinorId, type Part, type UtilityId } from './utilities'

/** A boon under way: the round all its parts end, and what they added to each unit's stats, taken back then. */
export interface Boon {
  id: UtilityId
  until: number
  deltas: Record<number, Partial<Stats>>
}

/** The effect each part lends each hero while it lasts. */
const LENT: Partial<Record<EffectId, Effect>> = { crack: 'piercing', hover: 'hover', rangedShield: 'rangedShield', meleeShield: 'meleeShield' }

/** How much a part gives: as minor, MINOR; else STRENGTH. */
const amount = (part: Part) => (part.minor ? MINOR : STRENGTH)[part.id as MinorId]

/** What a part adds to a hero's stats, or to an alien's, at `n`. */
const HERO: Partial<Record<EffectId, (s: Stats, n: number) => Partial<Stats>>> = {
  thrusters: (_, n) => ({ move: n }),
  overcharge: (_, n) => ({ damage: n }),
  ironSkin: (_, n) => ({ armor: n }),
  farsight: (_, n) => ({ range: n }),
  keen: (_, n) => ({ crit: n }),
}
const ALIEN: Partial<Record<EffectId, (s: Stats, n: number) => Partial<Stats>>> = {
  smoke: (s) => ({ range: Math.min(0, SMOKE_REACH - s.range) }),
  gravity: (s, n) => ({ move: -Math.min(n, s.move - 1) }),
  dampener: (s, n) => ({ damage: -Math.min(n, s.damage - 1) }),
}

const shift = (unit: Unit, delta: Partial<Stats>, sign: number) => {
  const stats = { ...unit.stats }
  for (const [key, value] of Object.entries(delta) as [keyof Stats, number][]) stats[key] += sign * value
  unit.stats = stats
}

/** The utility the player picked takes hold as the squad comes in, each of its parts on the units it acts on. */
export function takeBoon(battle: Battle, id: UtilityId | null, tank: number): void {
  if (!id) return
  const boon: Boon = { id, until: battle.round + UTILITIES[id].rounds, deltas: {} }
  battle.boons.push(boon)
  for (const part of UTILITIES[id].parts) {
    const add = HERO[part.id] ?? ALIEN[part.id]
    for (const u of battle.units.filter((u) => u.hp > 0 && (ALIEN[part.id] ? u.side === 'alien' : isSoldier(u)))) {
      if (LENT[part.id]) u.effects = [...u.effects, LENT[part.id]!]
      if (!add) continue
      const delta = add(u.stats, amount(part))
      shift(u, delta, 1)
      if (delta.armor) u.armor += delta.armor
      const sum = (boon.deltas[u.id] ??= {})
      for (const [key, value] of Object.entries(delta) as [keyof Stats, number][]) sum[key] = (sum[key] ?? 0) + value
    }
    if (part.id === 'tank') battle.rigged = fuelTanks(battle)[tank] ?? null
    if (part.id === 'flashbang') {
      const first = nearest(battle.units.filter((u) => u.side === 'alien' && u.engaged), battle.entry!)
      for (const u of battle.units.filter((a) => a.side === 'alien' && first && a.cluster === first.cluster)) u.surprised = u.boss ? STUN_TURNS - 1 : STUN_TURNS
    }
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
    const mend = UTILITIES[boon.id].parts.find((p) => p.id === 'mending')
    const has = (id: EffectId) => effectsOf(boon.id).includes(id)
    if (mend) for (const u of heroes.filter((u) => u.hp < u.stats.hp)) {
      const healed = Math.min(amount(mend), u.stats.hp - u.hp)
      u.hp += healed
      events.push(fx(u.id, 'regen', healed))
    }
    if (has('coldSnap')) for (const u of aliens.filter((u) => u.engaged)) chillUnit(battle, u, 1, events)
    if (has('blaze') && battle.entry) for (const u of aliens.filter((u) => distance(u, battle.entry!) <= BLAZE_REACH)) kindle(battle, u, 1)
    if (has('hunted')) {
      const prey = aliens.reduce<Unit | null>((a, b) => (!a || b.stats.hp > a.stats.hp ? b : a), null)
      if (prey) prey.exposed = Math.max(prey.exposed, 1)
    }
  }
  battle.boons = battle.boons.filter((b) => b.until > battle.round)
}

/** A boon's bonus is taken back from every unit it held. */
function end(battle: Battle, boon: Boon, events: GameEvent[]): void {
  const lent = effectsOf(boon.id).flatMap((id) => LENT[id] ?? [])
  const on: number[] = []
  for (const u of battle.units.filter((u) => u.hp > 0)) {
    const delta = boon.deltas[u.id]
    if (delta) {
      shift(u, delta, -1)
      if (delta.armor) u.armor = Math.min(u.armor, u.stats.armor)
      on.push(u.id)
    }
    for (const effect of lent) {
      const at = u.effects.indexOf(effect)
      if (at < 0) continue
      u.effects = u.effects.filter((_, i) => i !== at)
      if (!on.includes(u.id)) on.push(u.id)
    }
  }
  if (effectsOf(boon.id).includes('tank')) battle.rigged = null
  if (on.length === 0 && boon.id !== 'flashbang') on.push(...battle.units.filter((u) => isSoldier(u) && u.hp > 0).map((u) => u.id))
  events.push({ type: 'used', src: { kind: 'boon', id: boon.id }, utility: boon.id, on, ended: true })
}
