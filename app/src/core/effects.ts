import type { Effect } from './battle'
import { EFFECTS } from './gear'
import { RELICS } from './relics'
import { SKILLS } from './skills'

/** What an effect is called where the player sees it at work: the skill's or relic's name, or the word a gear effect adds to a name. */
export function effectName(effect: Effect): string {
  const named = [...Object.values(SKILLS), ...Object.values(RELICS)].find((source) => source.effect === effect)
  return named?.name ?? EFFECTS[effect as keyof typeof EFFECTS].prefix.replace(/'s$/, '')
}
