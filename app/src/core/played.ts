// The card played in a battle: what it adds that is no stat or lent effect, read where combat needs it.
import { fx } from './sources'
import { isSoldier, type Battle, type Unit } from './battle'
import type { GameEvent } from './combat-event'
import type { Rider } from './cards'

/** What the hero's played card adds to `rider` for `unit`: none for any but the hero. */
export const rider = (battle: Battle, unit: Unit, of: Rider) => (isSoldier(unit) ? (battle.riders[of] ?? 0) : 0)

/** As the hero lands, it gains the Temp HP its card lends. */
export function armCard(battle: Battle): void {
  for (const u of battle.units.filter(isSoldier)) u.temp = Math.max(u.temp ?? 0, battle.riders.temp ?? 0)
}

/** As the hero's turn begins, Regen Gel heals it. */
export function tickCard(battle: Battle, events: GameEvent[]): void {
  for (const u of battle.units.filter((u) => isSoldier(u) && u.hp > 0 && u.hp < u.stats.hp)) {
    const healed = Math.min(rider(battle, u, 'regen'), u.stats.hp - u.hp)
    if (healed <= 0) continue
    u.hp += healed
    events.push(fx(u.id, 'regen', healed, { kind: 'card', id: 'regen' }))
  }
}
