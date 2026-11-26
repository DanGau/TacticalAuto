// The names effects show under in the view.
import { EXAMS, type Exam } from './exams'
import type { Effect } from './battle'
import { EFFECTS } from './gear'
import { RELICS } from './relics'
import { cancelOf } from './quantities'

/** What an effect is called where the player sees it at work: a cancellation's name, a Guardian trait's, a relic's, or the word a gear effect adds to a name. */
export function effectName(effect: Effect): string {
  if (effect === 'stun') return 'Stunned'
  if (effect === 'frozen') return 'Frozen'
  const cancel = cancelOf(effect)
  if (cancel) return cancel.name
  if (effect in EXAMS && effect !== 'thorns') return EXAMS[effect as Exam].name
  const relic = Object.values(RELICS).find((source) => source.effect === effect)
  if (relic) return relic.name
  if (effect in EFFECTS) return EFFECTS[effect as keyof typeof EFFECTS].prefix
  return effect
}
