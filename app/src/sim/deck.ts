// The deck comparison: the strategic bot keeping its deck as it judges, taking every card offered, or skipping them all.
import { strategic } from '../bots/strategic'
import type { Bot } from '../bots/bots'
import { CARDS } from '../core/cards'
import type { RunResult } from './run'

/** The strategic bot with every card offered or for sale passed over. */
const skipping: Bot = (run, rng) => {
  if (run.phase === 'reward' && run.cardOffers.length > 0 && run.relicOffers.length === 0 && run.finds.length === 0) return { type: 'card', index: null }
  return strategic(run.shop ? { ...run, shop: { ...run.shop, cards: run.shop.cards.map((c) => ({ ...c, sold: true })) } } : run, rng)
}

/** The strategic bot taking the rarest card of every offer. */
const hoarding: Bot = (run, rng) => {
  if (run.phase === 'reward' && run.cardOffers.length > 0 && run.relicOffers.length === 0 && run.finds.length === 0) {
    const rank = { basic: -1, common: 0, rare: 1, epic: 2 }
    return { type: 'card', index: run.cardOffers.reduce((b, id, i) => (rank[CARDS[id].rarity] > rank[CARDS[run.cardOffers[b]].rarity] ? i : b), 0) }
  }
  return strategic(run, rng)
}

/** Deck policies, by name: the strategic bot's own, skipping every card, taking one of every offer. */
export const DECKS: Record<string, Bot> = { lean: strategic, skip: skipping, hoard: hoarding }

/** Final deck sizes the runs are banded by. */
const BANDS: [number, number][] = [[0, 7], [8, 10], [11, 14], [15, 19], [20, Infinity]]

/** By policy: wins, the deck's size at the end, and cards taken a run; then each policy's wins by the deck's size at the end. */
export function formatDecks(played: Record<string, RunResult[]>): string {
  const pct = (rs: RunResult[]) => (rs.length === 0 ? '-' : `${Math.round((100 * rs.filter((r) => r.won).length) / rs.length)}%`)
  const mean = (rs: RunResult[], v: (r: RunResult) => number) => (rs.reduce((sum, r) => sum + v(r), 0) / Math.max(1, rs.length)).toFixed(1)
  const lines = ['policy   wins   deck  taken']
  for (const [name, rs] of Object.entries(played)) lines.push(`${name.padEnd(8)}${pct(rs).padStart(5)}${mean(rs, (r) => r.deck).padStart(7)}${mean(rs, (r) => r.taken.reduce((a, b) => a + b, 0)).padStart(7)}`)
  lines.push('', `deck at end  ${Object.keys(played).map((n) => n.padStart(12)).join('')}`)
  for (const [lo, hi] of BANDS) {
    const label = hi === Infinity ? `${lo}+` : `${lo}-${hi}`
    lines.push(`${label.padEnd(13)}${Object.values(played).map((rs) => {
      const of = rs.filter((r) => r.deck >= lo && r.deck <= hi)
      return `${pct(of)} of ${of.length}`.padStart(12)
    }).join('')}`)
  }
  return lines.join('\n')
}
