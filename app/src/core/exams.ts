// Exams: the trait each leg's Guardian has, the gap in a build it tests, and the quantities that answer it.
import type { Quantity } from './quantities'

/** A Guardian's trait. */
export type Exam = 'plates' | 'regrowth' | 'rampage' | 'thorns'

/** Hits under this much damage do half to a plated Guardian. */
export const PLATES_UNDER = 6

/** The share of its health a regrowing Guardian heals a turn while neither burning nor chilled, and the most it heals a battle. */
export const REGROWTH = { turn: 0.1, most: 0.6 }

/** `answers`: the quantities whose makers pass it, each a different line. */
export const EXAMS: Record<Exam, { name: string; icon: string; text: string; answer: string; answers: Quantity[] }> = {
  plates: { name: 'Plated', icon: '🪨', text: `Hits under ${PLATES_UNDER} damage do half; slams and falls do full`, answer: 'big hits, marks, or knocking it into things', answers: ['overkill', 'mark', 'impact'] },
  regrowth: { name: 'Regenerator', icon: '🧬', text: `Heals ${100 * REGROWTH.turn}% of its health each turn unless burning or chilled, up to ${100 * REGROWTH.most}% a battle`, answer: 'burn, chill, or many shots', answers: ['burn', 'chill', 'shots'] },
  rampage: { name: 'Berserker', icon: '😡', text: 'Gains 1 Might each of its turns, unless moved since its last', answer: 'knocking or pulling it, chill, or armor', answers: ['moved', 'chill', 'armor'] },
  thorns: { name: 'Thorned', icon: '🌵', text: 'Each hit on it hurts the attacker 1; slams and falls do not', answer: 'armor, knocking it into things, or few big hits', answers: ['armor', 'impact', 'overkill'] },
}
