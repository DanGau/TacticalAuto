import type { Ability, Effect } from './battle'
import { CLASSES } from './classes'
import { DOCTRINES } from './doctrines'
import { EFFECTS } from './gear'
import { RELICS } from './relics'
import { SKILLS } from './skills'

/** What an effect is called where the player sees it at work: the skill's, relic's, doctrine's or class ability's name, or the word a gear effect adds to a name. */
export function effectName(effect: Effect | Ability): string {
  const ability = Object.values(CLASSES).find((cls) => cls.ability === effect)
  if (ability) return ability.abilityName
  const named = [...Object.values(SKILLS), ...Object.values(RELICS), ...Object.values(DOCTRINES)].find((source) => source.effect === effect)
  return named?.name ?? EFFECTS[effect as keyof typeof EFFECTS].prefix.replace(/'s$/, '')
}
