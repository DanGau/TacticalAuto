// Stacks a fight builds on a unit and what they set off: burn, chill and freezing and how they cancel, marks, moving, Might, combos, exposure, every-Nth hits; payoffs that spend them, spreaders that pass them on.
import { fx } from './sources'
import { BURN_MAX, BURN_STACKS, CADENCE, CATALYST_EVERY, CHILL_FREEZE, CHILL_MAX, MARK_MAX, COMBO_MAX, EXPOSED, FAULT, FRACTURE_DAMAGE, HIGH_CRIT, HIGH_LEVELS, MIGHT_MAX, GRID, isSoldier, LINGER_STACKS, type Battle, type Effect, type Unit } from './battle'
import type { GameEvent } from './combat-event'
import type { Kit } from './weapons'
import { fireproof, foeHas, has, nearest } from './fighters'
import { distance, walks } from './grid'
import { RECKONING_KILLS } from './doctrines'
import { TUNING } from './tuning'
import { talentDamage, talentHit, talentKill } from './talents'
import { BOOM_DAMAGE, wound } from './wound'

/** Burn stacks a target `unit` sets burning takes on, and chill stacks one it chills. */
export const burnFrom = (unit: Unit | null) => BURN_STACKS + (unit && has(unit, 'smolder') ? LINGER_STACKS : 0)
export const chillFrom = (unit: Unit | null) => 1 + (unit && has(unit, 'permafrost') ? LINGER_STACKS : 0)

/** Stacks a hit by `unit` adds: twice as many by the squad's Carry. */
export const carried = (unit: Unit, stacks: number) => (has(unit, 'carry') ? 2 * stacks : stacks)

/** Adds burn stacks to `target`, to at most BURN_MAX, unless it cannot burn. Chill on it cancels them first; see meet. */
export function kindle(battle: Battle, target: Unit, stacks: number, events: GameEvent[] = []): void {
  if (target.hp <= 0 || fireproof(battle, target)) return
  const left = meet(battle, target, stacks, 'chill', events)
  if (left > 0) target.burn = Math.min(BURN_MAX, target.burn + left)
}

/** Adds chill stacks to `target`, to at most CHILL_MAX, unless it cannot be chilled; burn on it cancels them first. At CHILL_FREEZE it freezes and loses its next action; a boss never freezes. */
export function chillUnit(battle: Battle, target: Unit, stacks: number, events: GameEvent[]): void {
  if (target.hp <= 0 || target.resists.includes('chill')) return
  const left = meet(battle, target, stacks, 'burn', events)
  if (left <= 0) return
  target.chill = Math.min(CHILL_MAX, target.chill + left)
  if ((target.boss && !foeHas(battle, target, 'frostHeart')) || target.chill < CHILL_FREEZE || target.frozen) return
  target.frozen = true
  target.panicked = true
  events.push(fx(target.id, 'frozen', 0))
}

/**
 * `stacks` of burn or chill meet the `opposite` on `target`: as many as there are of it cancel, stack for stack. With
 * Thermal Shock Core they detonate instead: the hero's damage each to the target, half that to each alien beside it.
 * Returns the stacks left to add.
 */
function meet(battle: Battle, target: Unit, stacks: number, opposite: 'burn' | 'chill', events: GameEvent[]): number {
  const met = Math.min(stacks, target[opposite])
  if (met <= 0) return stacks
  target[opposite] -= met
  if (opposite === 'chill' && target.chill === 0) target.frozen = false
  if (!foeHas(battle, target, 'thermal')) {
    events.push(fx(target.id, 'quenched', 0))
    return stacks - met
  }
  const blast = met * strikerOf(battle, target).stats.damage
  events.push(fx(target.id, 'thermal', -blast))
  for (const other of battle.units.filter((u) => u.side === target.side && u !== target && u.hp > 0 && distance(u, target) <= 1)) {
    events.push(fx(other.id, 'thermal', -Math.ceil(blast / 2)))
    wound(battle, other, Math.ceil(blast / 2), events)
  }
  wound(battle, target, blast, events)
  return stacks - met
}

/** The hero whose blow a bridge's damage counts as: the one acting, else the hardest hitter facing `target`. */
const strikerOf = (battle: Battle, target: Unit): Unit =>
  actorOf(battle) ?? battle.units.filter((u) => u.side !== target.side && isSoldier(u)).reduce<Unit | undefined>((a, b) => (!a || b.stats.damage > a.stats.damage ? b : a), undefined) ?? target

/**
 * `target` is driven from where it stood, by a knockback, a pull or a slide: it counts as moved until its own turn, a
 * booming charge on it goes off, a frozen alien thaws and a marked one loses its marks. Shatterglass Edge shatters the
 * frozen in place of thawing, and Lock-On Rig keeps the marks and strikes for each.
 */
export function displaced(battle: Battle, target: Unit, events: GameEvent[]): void {
  if (target.hp <= 0 || target.side !== 'alien') return
  target.shifted = true
  const blow = strikerOf(battle, target).stats.damage
  if (target.frozen && foeHas(battle, target, 'shatter')) {
    events.push(fx(target.id, 'shatter', -blow * target.chill))
    wound(battle, target, blow * target.chill, events)
  } else if (target.frozen) {
    Object.assign(target, { frozen: false, panicked: false, chill: 0 })
    events.push(fx(target.id, 'thawed', 0))
  }
  if (target.hp > 0 && target.mark > 0 && foeHas(battle, target, 'lockOn')) {
    events.push(fx(target.id, 'lockOn', -blow * target.mark))
    wound(battle, target, blow * target.mark, events)
  } else if (target.mark > 0) {
    target.mark = 0
    events.push(fx(target.id, 'unlocked', 0))
  }
  if (target.hp > 0 && target.booming > 0) {
    target.booming = 0
    events.push(fx(target.id, 'booming', -BOOM_DAMAGE))
    wound(battle, target, BOOM_DAMAGE, events)
  }
}

/** Adds mark stacks to `target`, to at most MARK_MAX, unless it cannot be marked. */
export function markUnit(target: Unit, stacks: number): void {
  if (target.hp > 0 && !target.resists.includes('mark')) target.mark = Math.min(MARK_MAX, target.mark + stacks)
}

/**
 * Damage the payoffs add by spending `enemy`'s stacks, which they clear: each stack spent is TUNING.spend.factor of the hero's
 * damage, so stacks multiply it. Accelerant Gel spends burn at TUNING.spend.burns or more and gives the hero that
 * much temp HP; Glass Edge spends chill at TUNING.spend.chills or more and stuns; Spotter Network spends marks at TUNING.spend.marks or more and weakens.
 * A hit spends by one payoff.
 * Half of what is spent bursts on every alien beside the target. Dead Eye Ledger leaves marks on.
 */
export function spendStacks(battle: Battle, unit: Unit, enemy: Unit, used: Effect[], events: GameEvent[]): number {
  let more = 0
  const each = unit.stats.damage * TUNING.spend.factor
  const spend = (effect: Effect, applies: boolean, stacks: number, clear: () => void, rider: (stacks: number) => void) => {
    if (more > 0 || !applies || stacks <= 0 || !has(unit, effect)) return
    used.push(effect)
    const worth = Math.round(stacks * each)
    more += worth
    clear()
    rider(stacks)
    for (const other of battle.units.filter((u) => u.side === enemy.side && u !== enemy && u.hp > 0 && distance(u, enemy) <= 1)) {
      events.push(fx(other.id, effect, -Math.ceil(worth / 2)))
      wound(battle, other, Math.ceil(worth / 2), events)
    }
  }
  const shield = (stacks: number) => {
    unit.temp = Math.min(unit.stats.hp, (unit.temp ?? 0) + stacks)
  }
  const stun = () => {
    if (enemy.boss) enemy.suppressed = Math.max(enemy.suppressed, WEAKEN_TURNS)
    else enemy.panicked = true
  }
  const weaken = () => (enemy.suppressed = Math.max(enemy.suppressed, WEAKEN_TURNS))
  spend('accelerant', enemy.burn >= TUNING.spend.burns, enemy.burn, () => (enemy.burn = 0), shield)
  spend('glassEdge', enemy.chill >= TUNING.spend.chills, enemy.chill, () => (enemy.chill = 0), stun)
  const ledger = has(unit, 'ledger')
  spend('spotter', enemy.mark >= TUNING.spend.marks, enemy.mark, () => (enemy.mark = ledger ? enemy.mark : 0), weaken)
  return more
}

/** Turns a weakened unit does SUPPRESS_DAMAGE less. */
export const WEAKEN_TURNS = 2

/** A frozen unit's lost action: it thaws with no chill left. */
export function thaw(battle: Battle, unit: Unit): void {
  if (!unit.frozen) return
  unit.frozen = false
  if (!foeHas(battle, unit, 'frostHeart')) unit.chill = 0
}

/** The most armor `unit` builds to by a source that stops at `cap`: twice that with Ironclad Lattice. */
export const armorCap = (unit: Unit, cap: number) => (has(unit, 'ironclad') ? 2 * cap : cap)

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
  if (has(by, 'kiln')) kindle(battle, unit, 1, events)
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
  const ram = has(unit, 'ram') ? Math.min(unit.armor, unit.stats.damage) : 0
  if (ram > 0) used.push('ram')
  return unit.might + combo + slam + grip + opportune + ram + talentDamage(battle, unit, enemy, used, events)
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
  if (unit.hits % CATALYST_EVERY === 0 && enemy.hp > 0 && has(unit, 'catalyst') && enemy.burn + enemy.chill + enemy.mark > 0) {
    kindle(battle, enemy, enemy.burn, events)
    events.push(fx(enemy.id, 'catalyst', 0))
    chillUnit(battle, enemy, enemy.chill, events)
    markUnit(enemy, enemy.mark)
  }
  const beside = battle.units.filter((u) => u.side === enemy.side && u !== enemy && u.hp > 0 && distance(u, enemy) <= 1)
  for (const [effect, applies, add] of [
    ['bellows', enemy.burn > 0, (u: Unit) => kindle(battle, u, Math.ceil(enemy.burn / 2), events)],
    ['conductor', enemy.chill > 0, (u: Unit) => chillUnit(battle, u, Math.ceil(enemy.chill / 2), events)],
  ] as const) {
    if (!applies || !has(unit, effect)) continue
    for (const other of beside) {
      add(other)
      events.push(fx(other.id, effect, 0))
    }
  }
  if (enemy.hp > 0 && enemy.burn > 0 && has(unit, 'fanFlames')) {
    kindle(battle, enemy, TUNING.fanStacks, events)
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
    kindle(battle, heir, target.burn, events)
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

/** A kit as the unit fires it: Hair Trigger, Quick Draw and Twinned gear each add a shot to one of two or more; Split Rounds doubles the shots at half power. */
export function volley(unit: Unit, kit: Kit): Kit {
  const shots = kit.shots + (kit.shots >= 2 ? (['hairTrigger', 'quickDraw', 'twinned'] as const).filter((effect) => has(unit, effect)).length : 0)
  return has(unit, 'split') ? { ...kit, shots: shots * 2, power: kit.power / 2 } : { ...kit, shots }
}
