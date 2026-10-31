// Consumables: what each does, what the squad carries, and where it finds them.
import type { Keyword } from './keywords'

/**
 * One-use items the squad carries into battle, as Slay the Spire's potions: bought at shops, now and then found, and
 * used by the player at any point of a battle. One aimed at the aliens needs an alien in the fight in sight; one aimed
 * at the squad can be readied on the landing screen, to take effect as the squad lands.
 */
export type ConsumableId = 'airstrike' | 'medkit' | 'stims' | 'plating' | 'rage' | 'flashbang' | 'smoke' | 'cryo' | 'firebomb' | 'painter' | 'sentry' | 'decoy'

export const AIRSTRIKE = { damage: 5, radius: 2 }
export const HEAL = 5
export const STIMS = { stats: { move: 2, aim: 0.15 }, cost: 2 }
export const RAGE = { damage: 2, aim: -0.15 }
export const PLATING = 3
export const SMOKE_TURNS = 2
const pct = (n: number) => `${Math.round(100 * Math.abs(n))}%`

export interface Consumable {
  name: string
  tags?: Keyword[]
  icon: string
  text: string
  price: number
  /** Whom it acts on: the squad, or the aliens in the fight. */
  on: 'squad' | 'aliens'
  /** Threat it adds when used. */
  threat?: number
}

export const CONSUMABLES: Record<ConsumableId, Consumable> = {
  airstrike: { name: 'Airstrike', icon: '✈️', text: `Bombs the alien in the fight nearest the squad: ${AIRSTRIKE.damage} damage to every alien within ${AIRSTRIKE.radius} tiles, wrecking their cover`, price: 2, on: 'aliens', threat: 2 },
  medkit: { name: 'Nano-Medkit', icon: '➕', text: `Every soldier heals ${HEAL}`, price: 3, on: 'squad' },
  stims: { name: 'Combat Stims', icon: '💉', text: `Every soldier +${STIMS.stats.move} move and +${pct(STIMS.stats.aim)} aim for the battle, but loses ${STIMS.cost} health`, price: 2, on: 'squad' },
  plating: { name: 'Ablative Plating', icon: '🛡️', text: `Every soldier +${PLATING} armor`, price: 3, on: 'squad' },
  rage: { name: 'Rage Serum', icon: '😤', text: `Every soldier +${RAGE.damage} damage for the battle, but -${pct(RAGE.aim)} aim`, price: 2, on: 'squad' },
  flashbang: { name: 'Flashbang', icon: '✴️', text: 'Every alien in the fight loses its next action; bosses shrug it off', price: 3, on: 'aliens' },
  smoke: { name: 'Smoke Screen', icon: '💨', text: `Every alien in the fight is suppressed, aiming worse, for ${SMOKE_TURNS} turns`, price: 2, on: 'aliens' },
  cryo: { name: 'Cryo Bomb', icon: '🧊', text: 'Chills every alien in the fight', price: 2, on: 'aliens', tags: ['frost'] },
  firebomb: { name: 'Firebomb', icon: '🔥', text: 'Sets every alien in the fight burning', price: 2, on: 'aliens', tags: ['burn'] },
  painter: { name: 'Target Painter', icon: '🎯', text: 'Marks every alien in the fight', price: 2, on: 'aliens', tags: ['mark'] },
  sentry: { name: 'Sentry Drop', icon: '🗼', text: 'A turret lands beside the squad: it never moves, and shoots far and true', price: 3, on: 'squad' },
  decoy: { name: 'Holo-Decoy', icon: '🎈', text: 'A tough hard-light double stands between the squad and the aliens, drawing their fire', price: 2, on: 'squad' },
}

export const CONSUMABLE_IDS = Object.keys(CONSUMABLES) as ConsumableId[]

/** Consumables the squad can carry at once. */
export const KIT_SLOTS = 3
/** Consumables a shop stocks. */
export const SHOP_CONSUMABLES = 3
/** Chance a won battle also turns up a consumable, when the squad has room for it. */
export const CONSUMABLE_DROP = 0.25
