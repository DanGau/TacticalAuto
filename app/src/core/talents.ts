// Talents: skills that shape a hit by where and how it lands, or answer a hit, a kill or a turn's start.
import { cloakOn } from './abilities'
import { BURN_MAX, type Battle, type Effect, type Unit } from './battle'
import type { GameEvent } from './combat-event'
import { foes, has, nearest } from './fighters'
import { fx } from './sources'
import { distance } from './grid'
import { chillFrom, chillUnit, empower, kindle, burnFrom } from './stacks'
import { wound } from './wound'
import { TALENT } from './tuning'
import { PERK } from './perks'


const hurt = (u: Unit) => u.hp <= u.stats.hp / 2
const machines = (battle: Battle, u: Unit) => battle.units.filter((m) => m.summoner !== null && m.summoner === u.soldier && m.hp > 0)
const ownerOf = (battle: Battle, u: Unit) => (u.summoner === null ? undefined : battle.units.find((s) => s.soldier === u.summoner))
const allies = (battle: Battle, u: Unit) => battle.units.filter((a) => a.side === u.side && a !== u && a.hp > 0 && !a.civilian)

function heal(u: Unit, amount: number, effect: Effect, events: GameEvent[]): void {
  const gain = Math.min(amount, u.stats.hp - u.hp)
  if (gain <= 0 || u.hp <= 0) return
  u.hp += gain
  events.push(fx(u.id, effect, gain))
}

function stun(u: Unit, effect: Effect, events: GameEvent[]): void {
  if (u.hp <= 0 || u.boss) return
  u.panicked = true
  events.push(fx(u.id, effect, 0))
}

function zap(battle: Battle, u: Unit, amount: number, effect: Effect, events: GameEvent[]): void {
  events.push(fx(u.id, effect, -amount))
  wound(battle, u, amount, events)
}

/** Damage `unit`'s talents add to its hit on `enemy`, less what `enemy`'s take off; each that shaped it said. */
export function talentDamage(battle: Battle, unit: Unit, enemy: Unit, used: Effect[], events: GameEvent[]): number {
  const owner = ownerOf(battle, unit)
  const burning = battle.units.filter((u) => u.side === enemy.side && u.hp > 0 && u.burn > 0).length
  const gives: [Effect, boolean, number][] = [
    ['battleJoy', !hurt(unit), TALENT.bonus],
    ['charge', unit.moved, TALENT.bonus],
    ['snapShot', unit.moved, 1],
    ['demolisher', enemy.armor > 0, TALENT.bonus],
    ['artillery', distance(unit, enemy) >= TALENT.far, TALENT.bonus],
    ['bigGame', enemy.stats.hp > unit.stats.hp, TALENT.bonus],
    ['killshot', enemy.hp <= enemy.stats.hp / 4, TALENT.kill],
    ['bloodScent', hurt(enemy), TALENT.bonus],
    ['ambush', unit.hits === 1, TALENT.big],
    ['shatterpoint', enemy.frozen, TALENT.big],
    ['smite', allies(battle, unit).some((a) => distance(a, enemy) <= 1), TALENT.big],
    ['pilotLink', machines(battle, unit).length > 0, TALENT.bonus],
    ['pyromania', burning >= 2, Math.min(3, Math.floor(burning / 2))],
    ['combust', enemy.burn > 0, enemy.burn],
    ['bully', enemy.hp < unit.hp, TALENT.bonus],
    ['wrecker', battle.units.filter((u) => u.side === enemy.side && u !== enemy && u.hp > 0 && distance(u, enemy) <= 1).length >= 2, TALENT.kill],
    ['kindling', enemy.burn === 0, TALENT.bonus],
    ['whiteHeat', enemy.burn > 0, TALENT.kill],
    ['firebrand', enemy.burn > 0, enemy.burn],
    ['brittle', enemy.chill > 0, TALENT.kill],
    ['firstStrike', unit.hits === 1, PERK.firstStrike],
    ['finisher', hurt(enemy), PERK.finisher],
    ['thousandCuts', unit.hits > 2, Math.min(4, Math.floor((unit.hits - 1) / 2))],
  ]
  let more = 0
  for (const [effect, applies, worth] of gives) {
    if (!applies || !has(unit, effect)) continue
    used.push(effect)
    more += worth
  }
  if (owner && has(owner, 'targetLink') && owner.comboOn === enemy.id) {
    used.push('targetLink')
    more += TALENT.bonus
  }
  if (owner && has(owner, 'overdrive')) {
    used.push('overdrive')
    more += TALENT.big
  }
  if (battle.units.some((u) => u.side === unit.side && u.hp > 0 && has(u, 'warSong') && distance(u, unit) <= 2)) {
    used.push('warSong')
    more += TALENT.bonus
  }
  const heat = battle.units.filter((u) => u.side !== enemy.side && u.hp > 0 && u.burn > 0 && distance(u, enemy) <= 2).length
  const takes: [Effect, boolean, number][] = [
    ['grit', distance(unit, enemy) <= 1, TALENT.soak],
    ['standAlone', !allies(battle, enemy).some((a) => distance(a, enemy) <= 2), TALENT.soak],
    ['camouflage', !enemy.moved, TALENT.soak],
    ['bodyguard', machines(battle, enemy).some((m) => distance(m, enemy) <= 1), TALENT.soak],
    ['frostShell', unit.chill > 0, TALENT.soak],
    ['wraithForm', hurt(enemy), TALENT.soak],
    ['heatShield', heat > 0, Math.min(3, heat)],
    ['hunker', distance(unit, enemy) > 1, TALENT.soak],
    ['untouchable', !enemy.moved, TALENT.kill],
    ['emberWard', unit.burn > 0, TALENT.soak],
  ]
  for (const [effect, applies, worth] of takes) {
    if (!applies || !has(enemy, effect)) continue
    events.push(fx(enemy.id, effect, 0))
    more -= worth
  }
  const guard = ownerOf(battle, enemy) && has(ownerOf(battle, enemy)!, 'armoredDrones') ? 'armoredDrones' : allies(battle, enemy).find((a) => has(a, 'guardian') && distance(a, enemy) <= 2) ? 'guardian' : undefined
  if (guard) {
    events.push(fx(enemy.id, guard, 0))
    more -= TALENT.soak
  }
  return more
}

/** What `unit`'s talents do on its hit striking `enemy`, and what `enemy`'s and its allies' do back. */
export function talentHit(battle: Battle, unit: Unit, enemy: Unit, crit: boolean, events: GameEvent[]): void {
  const crack = (effect: Effect) => {
    enemy.armor = Math.max(0, enemy.armor - TALENT.crack)
    events.push(fx(enemy.id, effect, 0))
  }
  const beside = battle.units.filter((u) => u.side === enemy.side && u !== enemy && u.hp > 0 && distance(u, enemy) <= 1)
  if (has(unit, 'combust') && enemy.burn > 0) enemy.burn = 0
  if (enemy.hp > 0) {
    if (has(unit, 'cracking') && enemy.armor > 0) crack('cracking')
    if (has(unit, 'meltdown') && enemy.burn > 0 && enemy.armor > 0) crack('meltdown')
    if (has(unit, 'venom')) {
      enemy.suppressed = 2
      events.push(fx(enemy.id, 'venom', 0))
    }
    if (has(unit, 'staticCharge') && unit.hits % TALENT.every === 0) stun(enemy, 'staticCharge', events)
    if (has(unit, 'concussiveForce') && distance(unit, enemy) <= 1 && unit.hits % 2 === 0) stun(enemy, 'concussiveForce', events)
    if (has(enemy, 'hardened') && enemy.spent.filter((e) => e === 'hardened').length < TALENT.hardMax) {
      enemy.spent.push('hardened')
      enemy.stats = { ...enemy.stats, armor: enemy.stats.armor + 1 }
      enemy.armor++
      events.push(fx(enemy.id, 'hardened', 0))
    }
    if (has(unit, 'flashFreeze') && enemy.chill > 0) {
      events.push(fx(enemy.id, 'flashFreeze', 0))
      chillUnit(battle, enemy, 1, events)
    }
  }
  const tinder = has(unit, 'spread') && enemy.burn > 0 ? beside.find((u) => u.burn === 0) : undefined
  if (tinder) {
    kindle(battle, tinder, burnFrom(unit))
    events.push(fx(tinder.id, 'spread', 0))
  }
  if (crit && has(unit, 'splinter')) for (const u of beside) chillUnit(battle, u, chillFrom(unit), events)
  if (crit && has(unit, 'resonance')) for (const u of beside) zap(battle, u, TALENT.zap, 'resonance', events)
  const arc = has(unit, 'arcWelder') ? nearest(battle.units.filter((u) => u.side === enemy.side && u !== enemy && u.hp > 0 && distance(u, enemy) <= TALENT.reach), enemy) : undefined
  if (arc) zap(battle, arc, TALENT.zap, 'arcWelder', events)
  if (has(unit, 'soulDrain')) heal(unit, 1, 'soulDrain', events)
  if (has(unit, 'lifeLink')) {
    const mate = allies(battle, unit).filter((a) => a.hp < a.stats.hp && distance(a, unit) <= TALENT.reach).sort((a, b) => a.hp / a.stats.hp - b.hp / b.stats.hp)[0]
    if (mate) heal(mate, 1, 'lifeLink', events)
  }
  if (enemy.hp > 0 && has(enemy, 'vengeance')) empower(enemy, 1, 'vengeance', events)
  if (has(enemy, 'cinderSkin') && distance(unit, enemy) <= 1 && unit.hp > 0 && unit.burn < BURN_MAX) {
    kindle(battle, unit, burnFrom(enemy))
    events.push(fx(unit.id, 'cinderSkin', 0))
  }
  const avenger = allies(battle, enemy).find((a) => has(a, 'retribution') && distance(a, enemy) <= TALENT.reach)
  if (avenger && unit.hp > 0) zap(battle, unit, TALENT.zap, 'retribution', events)
}

/** What `killer`'s talents, and those of a hymn-singer near it, do on its kill of `target`. */
export function talentKill(battle: Battle, target: Unit, killer: Unit, events: GameEvent[]): void {
  const kin = battle.units.filter((u) => u.side === target.side && u.hp > 0)
  if (has(killer, 'thunderclap') && distance(killer, target) <= 1) for (const u of kin.filter((u) => distance(u, target) <= 1)) stun(u, 'thunderclap', events)
  if (has(killer, 'iceAge') && target.chill > 0) for (const u of kin.filter((u) => distance(u, target) <= 1)) stun(u, 'iceAge', events)
  if (has(killer, 'nightmare')) for (const u of kin.filter((u) => distance(u, target) <= 2)) stun(u, 'nightmare', events)
  if (has(killer, 'soulHarvest')) {
    heal(killer, TALENT.heal, 'soulHarvest', events)
    empower(killer, 1, 'soulHarvest', events)
  }
  const queen = ownerOf(battle, killer)
  if (queen && has(queen, 'hiveQueen')) for (const u of [killer, queen]) heal(u, TALENT.heal, 'hiveQueen', events)
  if (has(killer, 'shroud') && distance(killer, target) >= TALENT.far && !killer.cloaked) events.push(cloakOn(killer))
  if (has(killer, 'cauterize') && target.burn > 0) heal(killer, TALENT.heal, 'cauterize', events)
  if (has(killer, 'shadowFeed')) heal(killer, TALENT.heal, 'shadowFeed', events)
  if (has(killer, 'scavenger')) heal(killer, PERK.scavenge, 'scavenger', events)
  if (has(killer, 'carnage') && killer.spent.filter((e) => e === 'carnage').length < TALENT.moveMax) {
    killer.spent.push('carnage')
    killer.stats = { ...killer.stats, move: killer.stats.move + 1 }
    events.push(fx(killer.id, 'carnage', 0))
  }
  if (battle.units.some((u) => u.side === killer.side && u.hp > 0 && has(u, 'battleHymn') && distance(u, killer) <= 2)) empower(killer, 1, 'battleHymn', events)
}

/** What `unit`'s talents, or its engineer's, do as its turn begins, with foes in the fight. */
export function talentTurn(battle: Battle, unit: Unit, events: GameEvent[]): void {
  if (foes(battle, unit).length === 0) return
  const owner = ownerOf(battle, unit)
  if (owner && has(owner, 'mechanic')) heal(unit, TALENT.heal, 'mechanic', events)
  if (has(unit, 'secondBreath') && hurt(unit) && !unit.spent.includes('secondBreath')) {
    unit.spent.push('secondBreath')
    heal(unit, PERK.breath, 'secondBreath', events)
  }
  if (has(unit, 'bedrock') && unit.armor < unit.stats.armor + TALENT.armorMax) {
    unit.armor = Math.min(unit.stats.armor + TALENT.armorMax, unit.armor + TALENT.armor)
    events.push(fx(unit.id, 'bedrock', 0))
  }
  const near = allies(battle, unit).filter((a) => distance(a, unit) <= 2)
  const shaken = near.filter((a) => a.armor < a.stats.armor + TALENT.armorMax).sort((a, b) => a.hp / a.stats.hp - b.hp / b.stats.hp)[0]
  if (has(unit, 'rally') && shaken) {
    shaken.armor = Math.min(shaken.stats.armor + TALENT.armorMax, shaken.armor + TALENT.armor)
    events.push(fx(shaken.id, 'rally', 0))
  }
  const faint = allies(battle, unit).filter((a) => distance(a, unit) <= TALENT.reach && a.stats.hp - a.hp >= TALENT.heal).sort((a, b) => a.hp / a.stats.hp - b.hp / b.stats.hp)[0]
  if (has(unit, 'transfusion') && faint && unit.hp - TALENT.heal > unit.stats.hp / 2) {
    unit.hp -= TALENT.heal
    events.push(fx(unit.id, 'transfusion', -TALENT.heal))
    heal(faint, TALENT.heal, 'transfusion', events)
  }
  const around = (reach: number) => battle.units.filter((u) => u.side !== unit.side && u.hp > 0 && distance(u, unit) <= reach)
  for (const [effect, reach] of [['coldSnap', 1], ['polarVortex', 2]] as const) {
    if (!has(unit, effect)) continue
    for (const u of around(reach)) {
      events.push(fx(u.id, effect, 0))
      chillUnit(battle, u, chillFrom(unit), events)
    }
  }
  for (const [effect, reach] of [['tremor', 1], ['staticField', 2]] as const) if (has(unit, effect)) for (const u of around(reach)) zap(battle, u, TALENT.zap, effect, events)
  if (has(unit, 'emberHeart') && around(2).some((u) => u.burn > 0)) heal(unit, TALENT.heal, 'emberHeart', events)
  if (has(unit, 'wellspring')) for (const a of near.filter((a) => a.hp < a.stats.hp)) heal(a, TALENT.mend, 'wellspring', events)
}
