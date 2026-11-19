// Boons in a battle: what the activated boon adds that is no stat or lent effect, read where combat needs it.
import { fx } from './sources'
import { isSoldier, type Battle, type Unit } from './battle'
import type { GameEvent } from './combat-event'
import { boonStat, type Rider } from './utilities'

/** What the hero's activated boon adds to `rider` for `unit`: none for any but the hero. */
export const rider = (battle: Battle, unit: Unit, of: Rider) => (isSoldier(unit) && battle.boon ? boonStat([battle.boon], of) : 0)

/** As the hero's turn begins, Regen Gel heals it. */
export function tickBoons(battle: Battle, events: GameEvent[]): void {
  for (const u of battle.units.filter((u) => isSoldier(u) && u.hp > 0 && u.hp < u.stats.hp)) {
    const healed = Math.min(rider(battle, u, 'regen'), u.stats.hp - u.hp)
    if (healed <= 0) continue
    u.hp += healed
    events.push(fx(u.id, 'regen', healed))
  }
}
