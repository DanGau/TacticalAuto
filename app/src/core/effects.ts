import type { Ability, Effect } from './battle'
import { CLASSES } from './classes'
import { DOCTRINES } from './doctrines'
import { EFFECTS } from './gear'
import { RELICS } from './relics'
import { SKILLS, type SkillId } from './skills'
import { WEAPONS, type WeaponId } from './weapons'

/**
 * What an effect is called where the player sees it at work: the class ability's name; else that of a skill or weapon
 * the squad has, since skills of different classes may share an effect; else the relic's or doctrine's, the word a gear
 * effect adds to a name, or any skill's.
 */
export function effectName(effect: Effect | Ability, squad: { skills: SkillId[]; weapons: WeaponId[] } = { skills: [], weapons: [] }): string {
  const ability = Object.values(CLASSES).find((cls) => cls.ability === effect)
  if (ability) return ability.abilityName
  const own = [...squad.skills.map((id) => SKILLS[id]), ...squad.weapons.map((id) => WEAPONS[id]), ...Object.values(RELICS), ...Object.values(DOCTRINES)].find((source) => source.effect === effect)
  if (own) return own.name
  if (effect in EFFECTS) return EFFECTS[effect as keyof typeof EFFECTS].prefix.replace(/'s$/, '')
  return Object.values(SKILLS).find((skill) => skill.effect === effect)!.name
}
