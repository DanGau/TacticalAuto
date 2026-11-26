// Stacks a fight builds on a unit and what they set off: burn, chill and freezing and how they cancel, marks, moving, Might, combos, exposure, every-Nth hits; payoffs that spend them, spreaders that pass them on.
import { fx } from './sources'
import { BURN_MAX, CHILL_TURNS, CADENCE, CATALYST_EVERY, CHILL_FREEZE, CHILL_MAX, MARK_MAX, EXPOSED, FRACTURE_DAMAGE, HIGH_CRIT, HIGH_LEVELS, MIGHT_MAX, GRID, isSoldier, NUMB_TURNS, THERMAL_FACTOR, BRIDGE_FACTOR, type Battle, type Effect, type Unit } from './battle'
import type { GameEvent } from './combat-event'
import { FIRE_TURNS, fireproof, foeHas, has, nearest, onTile } from './fighters'
import { distance, NEIGHBORS, onGrid } from './grid'
import { TUNING } from './tuning'
import { BOOM_DAMAGE, wound } from './wound'


/** Adds burn stacks to `target`, to at most BURN_MAX, unless it cannot burn or is numb. Chill on it cancels them; see meet. */
export function kindle(battle: Battle, target: Unit, stacks: number, events: GameEvent[] = []): void {
  if (target.hp <= 0 || fireproof(battle, target) || target.numb > 0) return
  if (stacks > 0) events.push({ type: 'stacks', id: target.id, quantity: 'burn', added: stacks, burn: Math.min(BURN_MAX, target.burn + stacks), chill: target.chill })
  const left = meet(battle, target, stacks, 'chill', events)
  if (left <= 0) return
  target.burn = Math.min(BURN_MAX, target.burn + left)
  if (battle.ground[target.y * GRID + target.x] === 'mire') ignite(battle, target, events)
}

/** Swamp gas: the mire on and beside `at` catches fire. */
function ignite(battle: Battle, at: Unit, events: GameEvent[]): void {
  let lit = 0
  for (const [dx, dy] of [[0, 0], ...NEIGHBORS]) {
    const tile = { x: at.x + dx, y: at.y + dy }
    if (!onGrid(tile.x, tile.y) || battle.ground[tile.y * GRID + tile.x] !== 'mire' || onTile(battle.fire, tile)) continue
    battle.fire.push({ ...tile, turns: FIRE_TURNS })
    lit++
  }
  if (lit > 0) events.push(fx(at.id, 'napalm', 0))
}

/** Whether `at` stands on ice or beside water, where Chill bites deeper. */
export const wet = (battle: Battle, at: { x: number; y: number }) =>
  battle.ground[at.y * GRID + at.x] === 'ice' || NEIGHBORS.some(([dx, dy]) => onGrid(at.x + dx, at.y + dy) && battle.ground[(at.y + dy) * GRID + at.x + dx] === 'water')

/** Adds chill stacks to `target`, to at most CHILL_MAX, unless it cannot be chilled; burn on it cancels them first. At CHILL_FREEZE it freezes and loses its next action; a boss never freezes. */
export function chillUnit(battle: Battle, target: Unit, stacks: number, events: GameEvent[]): void {
  if (target.hp <= 0 || target.resists.includes('chill') || target.numb > 0) return
  if (stacks > 0 && wet(battle, target)) stacks++
  if (stacks > 0) events.push({ type: 'stacks', id: target.id, quantity: 'chill', added: stacks, burn: target.burn, chill: Math.min(CHILL_MAX, target.chill + stacks) })
  const left = meet(battle, target, stacks, 'burn', events)
  if (left <= 0) return
  target.chill = Math.min(CHILL_MAX, target.chill + left)
  if ((target.boss && !foeHas(battle, target, 'frostHeart')) || target.chill < CHILL_FREEZE || target.frozen) return
  target.frozen = true
  target.panicked = true
  events.push(fx(target.id, 'frozen', 0))
}

/**
 * `stacks` of burn or chill meet the `opposite` on `target`: both go out, and the alien is numb, taking no burn, chill
 * or marks and NUMB_SOAK less from each hit, for NUMB_TURNS of its turns. With Thermal Shock Core they detonate instead: THERMAL_FACTOR times the hero's
 * damage for each stack of both, to the target, and half that to each alien beside it. Returns the stacks left to add.
 */
function meet(battle: Battle, target: Unit, stacks: number, opposite: 'burn' | 'chill', events: GameEvent[]): number {
  const met = target[opposite]
  if (met <= 0 || stacks <= 0) return stacks
  target[opposite] = 0
  if (opposite === 'chill') target.frozen = false
  if (!foeHas(battle, target, 'thermal')) {
    numb(target, 'quenched', events)
    return 0
  }
  const blast = THERMAL_FACTOR * (met + stacks) * strikerOf(battle, target).stats.damage
  events.push(fx(target.id, 'thermal', -blast))
  for (const other of battle.units.filter((u) => u.side === target.side && u !== target && u.hp > 0 && distance(u, target) <= 1)) {
    events.push(fx(other.id, 'thermal', -Math.ceil(blast / 2)))
    wound(battle, other, Math.ceil(blast / 2), events)
  }
  wound(battle, target, blast, events)
  return 0
}

/** A cancellation on `target`: it says so, and is numb for NUMB_TURNS. */
function numb(target: Unit, effect: Effect, events: GameEvent[]): void {
  target.numb = NUMB_TURNS
  events.push(fx(target.id, effect, 0))
}

/** Overkill Coils: a hit's `excess` damage past OVERKILL_FROM hits the nearest other alien. */
export function carryOverkill(battle: Battle, target: Unit, excess: number, events: GameEvent[]): void {
  const to = nearest(battle.units.filter((u) => u.side === target.side && u !== target && u.hp > 0), target)
  if (!to) return
  events.push(fx(to.id, 'overkill', -excess))
  wound(battle, to, excess, events)
}

/** The hero whose blow a bridge's damage counts as: the one acting, else the hardest hitter facing `target`. */
export const strikerOf = (battle: Battle, target: Unit): Unit =>
  actorOf(battle) ?? battle.units.filter((u) => u.side !== target.side && isSoldier(u)).reduce<Unit | undefined>((a, b) => (!a || b.stats.damage > a.stats.damage ? b : a), undefined) ?? target

/**
 * `target` is driven from where it stood, by a knockback, a pull or a slide: it counts as moved until its own turn and cannot walk on that turn, a
 * booming charge on it goes off, a frozen alien thaws and a marked one loses its marks, each going numb. Shatterglass Edge
 * shatters any chilled one for BRIDGE_FACTOR times the hero's damage a chill stack, a frozen one staying frozen; Lock-On Rig keeps the marks and strikes as hard for each.
 */
export function displaced(battle: Battle, target: Unit, events: GameEvent[]): void {
  if (target.hp <= 0 || target.side !== 'alien') return
  target.shifted = true
  // A boss shrugs off the stagger, so a knockback build never pins one out of reach.
  if (!target.boss) target.rooted = Math.max(target.rooted, CHILL_TURNS)
  const blow = strikerOf(battle, target).stats.damage
  if (target.chill > 0 && foeHas(battle, target, 'shatter')) {
    const shards = BRIDGE_FACTOR * blow * target.chill
    events.push(fx(target.id, 'shatter', -shards))
    wound(battle, target, shards, events)
  } else if (target.frozen) {
    Object.assign(target, { frozen: false, panicked: false, chill: 0 })
    numb(target, 'thawed', events)
  }
  if (target.hp > 0 && target.mark > 0 && foeHas(battle, target, 'lockOn')) {
    const locked = BRIDGE_FACTOR * blow * target.mark
    events.push(fx(target.id, 'lockOn', -locked))
    wound(battle, target, locked, events)
  } else if (target.mark > 0) {
    target.mark = 0
    numb(target, 'unlocked', events)
  }
  if (target.hp > 0 && target.booming > 0) {
    target.booming = 0
    events.push(fx(target.id, 'booming', -BOOM_DAMAGE))
    wound(battle, target, BOOM_DAMAGE, events)
  }
}

/** Adds mark stacks to `target`, to at most MARK_MAX, unless it cannot be marked or is numb. */
export function markUnit(target: Unit, stacks: number): void {
  if (target.hp > 0 && !target.resists.includes('mark') && target.numb === 0) target.mark = Math.min(MARK_MAX, target.mark + stacks)
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

/** Damage a shot does more by the stacks and its place: Might, and Ram's armor; exposure is in `scaledDamage`. */
export function stackDamage(unit: Unit, used: Effect[]): number {
  const ram = has(unit, 'ram') ? Math.min(unit.armor, unit.stats.damage) : 0
  if (ram > 0) used.push('ram')
  return unit.might + ram
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

/** What a shot that struck adds up: a catalysing hit, and burn and chill spread to those beside. */
export function struck(battle: Battle, unit: Unit, enemy: Unit, events: GameEvent[]): void {
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
}

/** What a death sets off by the stacks: a frozen alien shatters, and its stacks pass on by Witch's Hex. */
export function died(battle: Battle, target: Unit, events: GameEvent[]): void {
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
}
