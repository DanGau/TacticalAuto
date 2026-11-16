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
  plates: { name: 'Plated', icon: '🪨', text: `Hits under ${PLATES_UNDER} damage deal half. Slams and falls deal full damage.`, answer: 'Overkill, Mark, or Impact', answers: ['overkill', 'mark', 'impact'] },
  regrowth: { name: 'Regrowth', icon: '🧬', text: `At the start of its turn, unless it has Burn or Chill, it heals ${100 * REGROWTH.turn}% of its max HP, up to ${100 * REGROWTH.most}% each battle.`, answer: 'Burn, Chill, or many shots', answers: ['burn', 'chill', 'shots'] },
  rampage: { name: 'Rampager', icon: '😡', text: 'At the start of its turn, unless Displaced since its last, it gains 1 Might.', answer: 'Displace, Chill, or Armor', answers: ['moved', 'chill', 'armor'] },
  thorns: { name: 'Thorned', icon: '🌵', text: 'Whenever a hit lands on it, deal 1 damage to the attacker. Slams and falls do not count.', answer: 'Armor, Impact, or few big hits', answers: ['armor', 'impact', 'overkill'] },
}
