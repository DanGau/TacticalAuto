// Stacks a fight builds on a unit and what they set off: burn, chill and freezing, marks, Might, combos, exposure, every-Nth hits; payoffs that spend them, spreaders that pass them on.
import { fx } from './sources'
import { BURN_MAX, BURN_STACKS, CADENCE, CHILL_FREEZE, CHILL_MAX, MARK_MAX, COMBO_MAX, EXPOSED, FAULT, FRACTURE_DAMAGE, HIGH_CRIT, HIGH_LEVELS, MIGHT_MAX, GRID, isSoldier, LINGER_STACKS, type Battle, type Effect, type Unit } from './battle'
import type { GameEvent } from './combat-event'
import { fireproof, foeHas, has, nearest } from './fighters'
import { distance, walks } from './grid'
import { RECKONING_KILLS } from './doctrines'
import { TUNING } from './tuning'
import { talentDamage, talentHit, talentKill } from './talents'
import { wound } from './wound'

/** Burn stacks a target `unit` sets burning takes on, and chill stacks one it chills. */
export const burnFrom = (unit: Unit | null) => BURN_STACKS + (unit && has(unit, 'smolder') ? LINGER_STACKS : 0)
export const chillFrom = (unit: Unit | null) => 1 + (unit && has(unit, 'permafrost') ? LINGER_STACKS : 0)

/** Adds burn stacks to `target`, to at most BURN_MAX, unless it cannot burn. */
export function kindle(battle: Battle, target: Unit, stacks: number): void {
  if (target.hp > 0 && !fireproof(battle, target)) target.burn = Math.min(BURN_MAX, target.burn + stacks)
}

/** Adds chill stacks to `target`, to at most CHILL_MAX, unless it cannot be chilled. At CHILL_FREEZE it freezes and loses its next action; a boss never freezes. */
export function chillUnit(_battle: Battle, target: Unit, stacks: number, events: GameEvent[]): void {
  if (target.hp <= 0 || target.resists.includes('frost')) return
  target.chill = Math.min(CHILL_MAX, target.chill + stacks)
  if (target.boss || target.chill < CHILL_FREEZE || target.frozen) return
  target.frozen = true
  target.panicked = true
  events.push(fx(target.id, 'frozen', 0))
}

/** Adds mark stacks to `target`, to at most MARK_MAX, unless it cannot be marked. */
export function markUnit(target: Unit, stacks: number): void {
  if (target.hp > 0 && !target.resists.includes('mark')) target.mark = Math.min(MARK_MAX, target.mark + stacks)
}

/**
 * Damage the payoffs add by spending `enemy`'s stacks, which they clear: a hit at TUNING.spend.burns burn or more the burn (Accelerant),
 * a hit the chill (Shatterglass), one at TUNING.spend.marks marks or more the marks (Spotter); then a hit on one both
 * burning and chilled spends what is left of both (Thermal Shock). What is spent bursts on every alien beside the target as well.
 */
export function spendStacks(battle: Battle, unit: Unit, enemy: Unit, used: Effect[], events: GameEvent[]): number {
  let more = 0
  const spend = (effect: Effect, applies: boolean, stacks: number, worth: number, clear: () => void) => {
    if (!applies || stacks <= 0 || !has(unit, effect)) return
    used.push(effect)
    more += stacks * worth
    clear()
    for (const other of battle.units.filter((u) => u.side === enemy.side && u !== enemy && u.hp > 0 && distance(u, enemy) <= 1)) {
      events.push(fx(other.id, effect, -stacks * worth))
      wound(battle, other, stacks * worth, events)
    }
  }
  spend('accelerant', enemy.burn >= TUNING.spend.burns, enemy.burn, TUNING.spend.burn, () => (enemy.burn = 0))
  spend('shatter', true, enemy.chill, TUNING.spend.chill, () => (enemy.chill = 0))
  spend('spotter', enemy.mark >= TUNING.spend.marks, enemy.mark, TUNING.spend.mark, () => (enemy.mark = 0))
  spend('thermal', enemy.burn > 0 && enemy.chill > 0, enemy.burn + enemy.chill, TUNING.spend.thermal, () => Object.assign(enemy, { burn: 0, chill: 0 }))
  return more
}

/** A frozen unit's lost action: it thaws with no chill left. */
export function thaw(unit: Unit): void {
  if (!unit.frozen) return
  unit.frozen = false
  unit.chill = 0
}

/** Gives `unit` Might, to at most MIGHT_MAX, saying what gave it. */
export function empower(unit: Unit, amount: number, effect: Effect, events: GameEvent[]): void {
  const gain = Math.min(amount, MIGHT_MAX - unit.might)
  if (gain <= 0 || unit.hp <= 0) return
  unit.might += gain
  events.push(fx(unit.id, effect, 0))
}

/** The hero whose action is under way, if a hero's. */
const actorOf = (battle: Battle) => battle.units.find((u) => u.id === battle.actor && u.side === 'human')

/** Damage more a fall of `levels` the acting hero caused does `unit`: Kinetic Engine's the hero's damage; Toppling's a level, after which hits on it are exposed. */
export function fell(battle: Battle, unit: Unit, levels: number, events: GameEvent[]): number {
  const by = actorOf(battle)
  if (!by || unit.side !== 'alien') return 0
  const impact = has(by, 'impetus') ? by.stats.damage : 0
  if (impact > 0) events.push(fx(unit.id, 'impetus', 0))
  if (!has(by, 'topple')) return impact
  unit.exposed = EXPOSED.turns
  events.push(fx(unit.id, 'topple', 0))
  return impact + levels
}

/** An alien the acting hero knocked into something solid: a stack of burn or chill by its gear, the hero's damage again by Kinetic Engine. */
export function slammed(battle: Battle, unit: Unit, events: GameEvent[]): void {
  const by = actorOf(battle)
  if (!by || unit.side !== 'alien' || unit.hp <= 0) return
  if (has(by, 'kiln')) kindle(battle, unit, 1)
  if (has(by, 'quench')) chillUnit(battle, unit, 1, events)
  if (!has(by, 'impetus')) return
  events.push(fx(unit.id, 'impetus', -by.stats.damage))
  wound(battle, unit, by.stats.damage, events)
}

/** Damage a shot does more by the stacks and its place: Might, a combo on the same target, a shield's armor, Rime Grip, Opportunist, talents; exposure is in `exposedDamage`. */
export function stackDamage(battle: Battle, unit: Unit, enemy: Unit, used: Effect[], events: GameEvent[]): number {
  const combo = has(unit, 'combo') && unit.comboOn === enemy.id ? Math.min(COMBO_MAX, unit.combo) : 0
  const slam = has(unit, 'shieldSlam') && unit.weapon === 'shield' ? unit.armor : 0
  const grip = has(unit, 'rimeGrip') && distance(unit, enemy) <= 1 ? TUNING.gripDamage : 0
  const opportune = has(unit, 'opportunist') && (enemy.rooted > 0 || enemy.panicked) ? TUNING.opportunistDamage : 0
  if (combo > 0) used.push('combo')
  if (slam > 0) used.push('shieldSlam')
  if (grip > 0) used.push('rimeGrip')
  if (opportune > 0) used.push('opportunist')
  return unit.might + combo + slam + grip + opportune + talentDamage(battle, unit, enemy, used, events)
}

/** A hit on an exposed target does half again; the every-Nth hit of Cadenced gear twice. */
export function scaledDamage(unit: Unit, enemy: Unit, damage: number, used: Effect[]): number {
  const exposed = enemy.exposed > 0 ? Math.floor(damage * EXPOSED.factor) : damage
  if (enemy.exposed > 0) used.push('topple')
  if (!has(unit, 'cadence') || unit.hits % CADENCE !== 0) return exposed
  used.push('cadence')
  return exposed * 2
}

/** Crit chance more Lofty gear gives for standing above the target. */
export const highCrit = (battle: Battle, unit: Unit, enemy: Unit) => (has(unit, 'lofty') ? HIGH_CRIT * Math.min(HIGH_LEVELS, Math.max(0, battle.height[unit.y * GRID + unit.x] - battle.height[enemy.y * GRID + enemy.x])) : 0)

/** What a shot that struck adds up: the combo, a catalysing crit, burn and chill spread to those beside, a fanned burn, Fault Line's every-Nth melee hit, and talents. */
export function struck(battle: Battle, unit: Unit, enemy: Unit, crit: boolean, events: GameEvent[]): void {
  talentHit(battle, unit, enemy, crit, events)
  if (unit.comboOn === enemy.id) unit.combo++
  else Object.assign(unit, { comboOn: enemy.id, combo: 1 })
  if (crit && enemy.hp > 0 && has(unit, 'catalyst') && enemy.burn + enemy.chill + enemy.mark > 0) {
    kindle(battle, enemy, enemy.burn)
    events.push(fx(enemy.id, 'catalyst', 0))
    chillUnit(battle, enemy, enemy.chill, events)
    markUnit(enemy, enemy.mark)
  }
  const beside = battle.units.filter((u) => u.side === enemy.side && u !== enemy && u.hp > 0 && distance(u, enemy) <= 1)
  for (const [effect, applies, add] of [
    ['bellows', enemy.burn > 0, (u: Unit) => kindle(battle, u, 1)],
    ['conductor', enemy.chill > 0, (u: Unit) => chillUnit(battle, u, 1, events)],
  ] as const) {
    if (!applies || !has(unit, effect)) continue
    for (const other of beside) {
      add(other)
      events.push(fx(other.id, effect, 0))
    }
  }
  if (enemy.hp > 0 && enemy.burn > 0 && has(unit, 'fanFlames')) {
    kindle(battle, enemy, TUNING.fanStacks)
    events.push(fx(enemy.id, 'fanFlames', 0))
  }
  if (has(unit, 'faultLine') && distance(unit, enemy) <= 1 && unit.hits % FAULT.every === 0) fault(battle, unit, enemy, events)
}

/** Fault Line: the ground about `at` drops a ledge, and each alien on it takes the fall. */
function fault(battle: Battle, unit: Unit, at: Unit, events: GameEvent[]): void {
  for (let y = at.y - 1; y <= at.y + 1; y++) for (let x = at.x - 1; x <= at.x + 1; x++) if (x >= 0 && y >= 0 && x < GRID && y < GRID && battle.ground[y * GRID + x] !== 'void') battle.height[y * GRID + x] = Math.max(0, battle.height[y * GRID + x] - FAULT.levels)
  walks.delete(battle)
  events.push(fx(at.id, 'faultLine', 0))
  for (const alien of battle.units.filter((u) => u.side !== unit.side && distance(u, at) <= 1)) {
    events.push({ type: 'hurt', id: alien.id, amount: FAULT.damage, cause: 'impact' })
    wound(battle, alien, FAULT.damage, events, true)
  }
}

/** Every 3rd human turn with Chrono Coil, the hardest-hitting hero attacks twice over. */
export function chrono(battle: Battle, events: GameEvent[]): void {
  for (const u of battle.units) u.twice = false
  const heroes = battle.units.filter((u) => isSoldier(u) && u.hp > 0)
  if ((battle.round + 1) % 3 !== 0 || !heroes.some((u) => has(u, 'chrono'))) return
  const pick = heroes.reduce((a, b) => (b.stats.damage > a.stats.damage ? b : a))
  pick.twice = true
  events.push(fx(pick.id, 'chrono', 0))
}

/** What a death sets off by the stacks: a frozen alien shatters, its stacks pass on by Witch's Hex, and the oath counts the kill. */
export function died(battle: Battle, target: Unit, killer: Unit | null, events: GameEvent[]): void {
  const kin = battle.units.filter((u) => u.side === target.side && u !== target && u.hp > 0)
  if (target.frozen && target.chill > 0 && foeHas(battle, target, 'fracture')) {
    events.push(fx(target.id, 'fracture', 0))
    for (const other of kin.filter((u) => distance(u, target) <= 1)) {
      events.push(fx(other.id, 'fracture', -FRACTURE_DAMAGE * target.chill))
      wound(battle, other, FRACTURE_DAMAGE * target.chill, events)
    }
  }
  const heir = target.burn + target.chill + target.mark > 0 && foeHas(battle, target, 'hex') ? nearest(kin, target) : undefined
  if (heir) {
    kindle(battle, heir, target.burn)
    chillUnit(battle, heir, target.chill, events)
    markUnit(heir, target.mark)
    events.push(fx(heir.id, 'hex', 0))
  }
  if (killer && killer.side !== target.side) talentKill(battle, target, killer, events)
  if (!killer || killer.side !== 'human' || target.side !== 'alien' || !battle.rules.includes('reckoning')) return
  battle.kills++
  if (battle.kills % RECKONING_KILLS === 0) for (const hero of battle.units.filter(isSoldier)) empower(hero, 1, 'reckoning', events)
}

/** Lasting Guard: armor whole again each own turn, and half of what was left unused carries on top, to at most double. */
export function lastingArmor(unit: Unit): void {
  if (has(unit, 'lasting') && unit.stats.armor > 0) unit.armor = Math.min(2 * unit.stats.armor, unit.stats.armor + Math.floor(unit.armor / 2))
}
