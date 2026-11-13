// Exams: the trait each leg's Guardian has, the gap in a build it tests, and what answers it.
import type { Keyword } from './keywords'

/** A Guardian's trait. */
export type Exam = 'plates' | 'regrowth' | 'rampage' | 'thorns'

/** Hits under this much damage do half to a plated Guardian. */
export const PLATES_UNDER = 6

/** The share of its health a regrowing Guardian heals a turn while not burning, and the most it heals a battle. */
export const REGROWTH = { turn: 0.1, most: 0.6 }

/** `answers`: the keywords of the builds that pass it. */
export const EXAMS: Record<Exam, { name: string; icon: string; text: string; answer: string; answers: Keyword[] }> = {
  plates: { name: 'Plated', icon: '🪨', text: `Hits under ${PLATES_UNDER} damage do half`, answer: 'big hits: Might, payoffs, marks, heavy weapons', answers: ['might', 'mark'] },
  regrowth: { name: 'Regenerator', icon: '🧬', text: `Heals ${100 * REGROWTH.turn}% of its health each turn unless burning, up to ${100 * REGROWTH.most}% a battle`, answer: 'burn, or many hits', answers: ['burn', 'volley'] },
  rampage: { name: 'Berserker', icon: '😡', text: 'Gains 1 Might each of its turns', answer: 'chill, armor, or a fast kill', answers: ['frost', 'ward'] },
  thorns: { name: 'Thorned', icon: '🌵', text: 'Each hit on it hurts the attacker 1', answer: 'armor, knockback, or few big hits', answers: ['ward', 'force'] },
}
