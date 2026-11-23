// The board at a battle's deploy screen, counted for what each card plays to; and the line each card in the hand shows.
import { GRID, type Battle, type Stats } from './battle'
import { amountOf, CARDS, signOf, type Card } from './cards'
import { distance } from './grid'
import { CIVILIANS } from './goals'
import { CHARGE_REACH } from './landing'

/** A shot from this far or more marks a ranged alien. */
const RANGED_FROM = 3

/** What the board holds: aliens and their health, Armor and reach; tiles of each kind about the fight; how far the objective lies. */
export interface Board {
  aliens: number
  hp: number
  armor: number
  ranged: number
  melee: number
  boss: { hp: number; armor: number } | null
  toughest: number
  /** Tiles from the landing to the objective. */
  far: number
  water: number
  mire: number
  ice: number
  voids: number
  /** Tiles with a drop of 2 levels or more, or void, beside them. */
  ledges: number
  /** Tiles standing above the landing. */
  high: number
  /** Aliens within CHARGE_REACH of the landing. */
  near: number
}

/** Counts the board of `battle`, about its arena. */
export function boardOf(battle: Battle): Board {
  const aliens = battle.units.filter((u) => u.side === 'alien' && u.hp > 0)
  const boss = aliens.find((u) => u.boss)
  const from = battle.approach
  const tiles = Array.from({ length: GRID * GRID }, (_, t) => ({ x: t % GRID, y: Math.floor(t / GRID), t })).filter((p) => distance(p, battle.arena) <= battle.arena.reach)
  const ground = (kind: string) => tiles.filter((p) => battle.ground[p.t] === kind).length
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= GRID || y >= GRID ? null : y * GRID + x)
  const ledge = (p: { x: number; y: number; t: number }) =>
    [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => {
      const n = at(p.x + dx, p.y + dy)
      return n !== null && battle.ground[p.t] !== 'void' && (battle.ground[n] === 'void' || battle.height[p.t] - battle.height[n] >= 2)
    })
  const base = battle.height[from.y * GRID + from.x]
  return {
    aliens: aliens.length,
    hp: aliens.reduce((sum, u) => sum + u.hp, 0),
    armor: aliens.reduce((sum, u) => sum + u.armor, 0),
    ranged: aliens.filter((u) => u.stats.range >= RANGED_FROM).length,
    melee: aliens.filter((u) => u.stats.range < RANGED_FROM).length,
    boss: boss ? { hp: boss.hp, armor: boss.armor } : null,
    toughest: Math.max(0, ...aliens.map((u) => u.hp)),
    far: distance(from, battle.objective),
    water: ground('water'),
    mire: ground('mire'),
    ice: ground('ice'),
    voids: ground('void'),
    ledges: tiles.filter(ledge).length,
    high: tiles.filter((p) => battle.height[p.t] > base).length,
    near: aliens.filter((u) => distance(u, from) <= CHARGE_REACH).length,
  }
}

/** Whether card `card` has nothing to play to in `battle`: a goal it does not serve, or Armor where no alien has any. */
export function inert(battle: Battle, board: Board, card: Card): boolean {
  const sign = signOf(card.id)
  return (sign === 'rescue' && battle.goal !== 'rescue') || (sign === 'hold' && battle.goal !== 'hold') || (sign === 'extract' && !battle.extract) || (sign === 'pierce' && board.armor === 0)
}

/** What card `card` plays to on `board` in `battle`, for a hero of `stats`, as its line in the hand. */
export function lineOf(battle: Battle, board: Board, card: Card, stats: Stats): string {
  const n = amountOf(card.id, card.level)
  const b = board
  const turns = (move: number) => Math.ceil(b.far / Math.max(1, move))
  const tough = b.boss ? `Boss: ${b.boss.hp} HP, ${b.boss.armor} Armor.` : `Toughest alien: ${b.toughest} HP.`
  const aliens = (n: number) => `${n} alien${n === 1 ? '' : 's'}`
  const change = (now: number, by: number, unit = '') => (by > 0 ? `${now}${unit} → ${now + by}${unit}` : `${now}${unit}`)
  switch (signOf(card.id)) {
    case 'damage': return `Hits ${change(stats.damage, n)}. ${aliens(b.aliens)}, ${b.hp} HP.`
    case 'pierce': return b.armor > 0 ? `Ignores ${b.armor} alien Armor.` : 'No alien Armor here.'
    case 'hp': return `HP ${change(stats.hp, n)}. ${aliens(b.aliens)}.`
    case 'temp': return `${n} Temp HP. ${aliens(b.aliens)}, ${b.hp} HP.`
    case 'armor': return `${b.melee} melee and ${b.ranged} ranged aliens.`
    case 'guard': return `${aliens(b.aliens)} to hit you.`
    case 'regen': return b.boss ? `Long fight: ${tough}` : `${aliens(b.aliens)}, ${b.hp} HP.`
    case 'ranged': return `Ranged: ${b.ranged} of ${aliens(b.aliens)}.`
    case 'melee': return `Melee: ${b.melee} of ${aliens(b.aliens)}.`
    case 'move': return `Objective ${b.far} tiles off: ${turns(stats.move)} turns${n > 0 ? ` → ${turns(stats.move + n)}` : ''}.`
    case 'jump': return `${b.high} tiles stand above the landing.`
    case 'span': return `${b.water + b.voids} tiles of water or void.`
    case 'hover': return `${b.mire + b.water + b.voids} tiles of mire, water or void.`
    case 'range': return `Range ${change(stats.range, n)}. Ranged: ${aliens(b.ranged)}.`
    case 'crit': return CARDS[card.id].adds.to === 'crit' ? `Crit ${change(Math.round(100 * stats.crit), Math.round(100 * n), '%')}. ${b.high} tiles stand above the landing.` : `${b.high} tiles stand above the landing.`
    case 'push': case 'moved': case 'impact': return `${b.ledges} ledge tiles, ${b.ice} ice tiles.`
    case 'landing': return `${aliens(b.near)} within ${CHARGE_REACH} tiles of the landing.`
    case 'burn': return `${b.mire} mire tiles. ${aliens(b.aliens)}.`
    case 'chill': return `${b.water + b.ice} tiles of water or ice.`
    case 'mark': case 'boss': case 'overkill': return tough
    case 'rescue': return battle.goal === 'rescue' ? `${CIVILIANS} civilians to reach.` : 'No civilians here.'
    case 'hold': return battle.goal === 'hold' ? 'An uplink to hold.' : 'No uplink here.'
    case 'extract': return battle.extract ? `Extraction ${b.far} tiles off.` : 'No extraction here.'
    default: return `${aliens(b.aliens)}.`
  }
}
