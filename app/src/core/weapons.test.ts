import { TUNING } from './tuning'
import { expect, test } from 'vitest'
import { isSoldier, type Battle, type Unit } from './battle'
import { beat } from './roads'
import { shoot, weaponAttack, wielded } from './attack'
import type { GameEvent } from './combat-event'
import { spotted } from './fighters'
import { wound } from './wound'
import { apply } from './apply'
import { begun, enterAt } from './roads'
import { SECONDARIES } from './secondaries'
import { gearCard, gearText } from '../ui/html'
import { BLOCK_SOAK, WEAPONS, type WeaponId } from './weapons'

/** A hero with `weapon`, its base damage 10, and aliens at `at` on open ground, too tough to fall. */
function field(weapon: WeaponId, at: [number, number][], range = WEAPONS[weapon].melee ? 1 : 5): { b: Battle; hero: Unit; aliens: Unit[] } {
  const run = begun(1)
  apply(run, { type: 'go', index: 1 })
  apply(run, { type: 'advance' })
  enterAt(run)
  const b = run.battle!
  const hero = b.units.find(isSoldier)!
  const template = b.units.find((u) => u.side === 'alien')!
  const aliens = at.map(([x, y], i) => ({ ...structuredClone(template), id: 900 + i, x, y, hp: 500, armor: 0, kind: 'trooper' as const, boss: false, target: false, surprised: 0, panicked: false, revealed: true, engaged: true, stats: { ...template.stats, hp: 500, move: 0, range: 0 } }))
  b.units = [hero, ...aliens]
  b.ground.fill('pavement')
  b.props.fill('none')
  b.bulk.fill(0 as never)
  b.height.fill(0)
  b.north.fill('none' as never)
  b.west.fill('none' as never)
  Object.assign(b, { goal: 'cross', uplink: null, extract: null, quarry: false, waves: [], twist: null, opening: false })
  Object.assign(hero, { x: 10, y: 10, weapon, effects: [], ability: null, secondary: 'frag', stats: { ...hero.stats, damage: 10, crit: 0, range, move: 0 }, stance: 'anchor' })
  return { b, hero, aliens }
}

const shots = (events: GameEvent[]) => events.filter((e) => e.type === 'shot') as Extract<GameEvent, { type: 'shot' }>[]

const heroTurn = (b: Battle, hero: Unit) => {
  Object.assign(b, { turn: 'human', stage: 'shoot', shooter: 0, attacks: 0, strides: {} })
  const round = b.round
  const events: GameEvent[] = []
  for (let i = 0; i < 4; i++) {
    events.push(...beat(b))
    if (b.turn !== 'human' || b.round !== round) break
  }
  return shots(events).filter((s) => s.id === hero.id)
}

test.each(Object.entries(WEAPONS).filter(([, w]) => !w.melee) as [WeaponId, (typeof WEAPONS)[WeaponId]][])('%s fires its count of shots, each its share of damage', (id, w) => {
  const { b, hero } = field(id, [[12, 10]])
  const fired = shots(weaponAttack(b, hero, spotted(b)))
  expect(fired).toHaveLength(w.attack.shots)
  for (const shot of fired) expect(Math.abs(shot.damage - wielded(10, w.attack.power))).toBeLessThanOrEqual(1)
})

test('guns differ in shots and in damage a shot', () => {
  const guns = Object.values(WEAPONS).filter((w) => !w.melee)
  expect(new Set(guns.map((w) => w.attack.shots)).size).toBeGreaterThanOrEqual(4)
  expect(new Set(guns.map((w) => w.attack.power)).size).toBe(guns.length)
})

test('the shotgun hurts those beside its target', () => {
  const { b, hero, aliens } = field('shotgun', [[12, 10], [13, 10]])
  weaponAttack(b, hero, spotted(b))
  expect(aliens.map((a) => a.hp).every((hp) => hp < 500)).toBe(true)
})

test('a volley shares one crit roll; on-hit effects come every shot, knockback once', () => {
  const { b, hero, aliens } = field('lmg', [[12, 10]])
  hero.stats.crit = 0.5
  hero.effects = ['vampiric', 'thunder']
  hero.hp = 1
  const fired = shots(weaponAttack(b, hero, spotted(b)))
  expect(new Set(fired.map((s) => s.crit)).size).toBe(1)
  expect(hero.hp).toBe(1 + Math.min(TUNING.healCap, fired.filter((s) => s.damage > 0).length))
  expect(aliens[0].x).toBe(12)
})

test('a kill grants one more volley, not one for each kill, and none after it', () => {
  const { b, hero, aliens } = field('lmg', [[12, 10], [13, 10], [14, 10], [12, 11], [12, 9]])
  hero.effects = ['frenzy']
  for (const a of aliens) a.hp = 1
  const fired = shots(weaponAttack(b, hero, spotted(b)))
  expect(fired.filter((s) => s.with.includes('frenzy')).length).toBeLessThanOrEqual(WEAPONS.lmg.attack.shots)
  expect(fired.length).toBeLessThanOrEqual(2 * WEAPONS.lmg.attack.shots)
})

test('no grant of a further attack ever throws a second time', () => {
  for (const effect of ['surge', 'twin', 'frenzy'] as const) {
    const { b, hero, aliens } = field('hammer', [[13, 10], [13, 12]])
    hero.effects = [effect]
    aliens[0].hp = 1
    const fired = heroTurn(b, hero)
    expect(fired.filter((s) => s.form === 'throw').length).toBeLessThanOrEqual(1)
  }
})

test('no class secondary reads as a thrown shield or hammer', () => {
  for (const s of Object.values(SECONDARIES)) expect(s.name).not.toMatch(/shield|hammer/i)
})

test('a shield takes off shots from afar, not up close', () => {
  const { b, hero, aliens } = field('shield', [[13, 10]])
  const shooter = aliens[0]
  Object.assign(shooter, { stats: { ...shooter.stats, damage: 6, range: 8 } })
  hero.hp = hero.stats.hp = 100
  hero.effects = ['block']
  hero.guarded = ['any']
  const far = shots(shoot(b, shooter, new Set([hero.id])))[0]
  Object.assign(shooter, { x: 11 })
  const close = shots(shoot(b, shooter, new Set([hero.id])))[0]
  expect(far.damage).toBe(close.damage - BLOCK_SOAK)
})

test.each(Object.entries(WEAPONS).filter(([, w]) => w.guard) as [WeaponId, (typeof WEAPONS)[WeaponId]][])('a %s saves only the first hit each turn it guards, so a crowd breaks through', (id, w) => {
  const { b, hero, aliens } = field(id, [[11, 10], [9, 10], [10, 11], [13, 10]])
  hero.hp = hero.stats.hp = 100
  for (const a of aliens) Object.assign(a, { stats: { ...a.stats, damage: 6, range: 8 } })
  const hit = (a: Unit) => shots(shoot(b, a, new Set([hero.id])))[0]
  const crowd = aliens.slice(0, 3).map(hit)
  expect(crowd.map((s) => s.deflect)).toEqual([w.guard!.word, undefined, undefined])
  expect(crowd[0].damage).toBeLessThan(crowd[1].damage)
  expect(hit(aliens[3]).deflect).toBe(w.guard!.each ? w.guard!.word : undefined)
})

test('a hammer blow stuns at its chance, never a boss', () => {
  const shock = WEAPONS.hammer.stun!
  WEAPONS.hammer.stun = { chance: 1, reach: 1 }
  const { b, hero, aliens } = field('hammer', [[11, 10]])
  weaponAttack(b, hero, new Set(aliens.map((a) => a.id)))
  expect(aliens[0].panicked).toBe(true)
  const boss = field('hammer', [[11, 10]])
  boss.aliens[0].boss = true
  weaponAttack(boss.b, boss.hero, new Set([boss.aliens[0].id]))
  expect(boss.aliens[0].panicked).toBe(false)
  WEAPONS.hammer.stun = shock
})

test("a weapon card's face says its type and special; its numbers are the type's tip", () => {
  for (const [id, w] of Object.entries(WEAPONS)) {
    const gear = { id: 1, rarity: 'common' as const, name: `Heavy ${w.name}`, weapon: id as WeaponId, stats: { damage: 1, move: -1 }, effect: null }
    const card = gearCard(gear)
    // The keywords' definitions, shown on hover, are not its face.
    const face = card.replace(/<span class="def[^"]*">.*?<\/span>/g, '').replace(/<[^>]*>/g, '')
    expect(face).toContain(w.name)
    expect(face).not.toMatch(/×|%|[+-]\d|\b(range|move|crit|armor|strength|thrown|dash)\b/i)
    if (w.special) expect(gearText(gear)).toContain(w.special)
    const tip = card.match(/data-tip="([^"]*)"/)![1]
    expect(tip).toContain(`Attack: ${w.attack.shots} × ${Math.round(100 * w.attack.power)}% damage`)
    expect(tip).toContain('Heavy: +1 damage, -1 move')
  }
})

test('a hammer charges the alien in reach, though a cluster still waiting stands near it', () => {
  const { b, hero, aliens } = field('hammer', [[14, 10], [18, 10]])
  Object.assign(aliens[0], { engaged: true, revealed: true })
  Object.assign(aliens[1], { engaged: false, revealed: true })
  Object.assign(hero, { engaged: true, stats: { ...hero.stats, move: 6 } })
  Object.assign(b, { turn: 'human', stage: 'move', shooter: 0, attacks: 0, strides: {}, round: 0 })
  beat(b)
  expect(Math.max(Math.abs(hero.x - aliens[0].x), Math.abs(hero.y - aliens[0].y))).toBeLessThanOrEqual(1)
})

test('a hammer kill gives temp HP to its cap, which takes damage before health', () => {
  const { b, hero, aliens } = field('hammer', [[11, 10]])
  const surge = WEAPONS.hammer.surge!
  for (let i = 0; i < 2; i++) {
    Object.assign(aliens[0], { hp: 1, x: 11, y: 10 })
    b.units = [hero, aliens[0]]
    shoot(b, hero, spotted(b))
  }
  expect(hero.temp).toBe(surge.cap)
  const hp = hero.hp
  wound(b, hero, surge.cap + 1, [])
  expect([hero.temp, hero.hp]).toEqual([0, hp - 1])
})
