// The names effects show under in the view, from the squad's skills and weapons.
import { EXAMS, type Exam } from './exams'
import type { Ability, Effect } from './battle'
import { CLASSES } from './classes'
import { DOCTRINES } from './doctrines'
import { DUOS, type DuoId } from './duos'
import { EFFECTS } from './gear'
import { UTILITIES } from './utilities'
import { RELICS } from './relics'
import { cancelOf } from './quantities'
import { PERKS } from './perks'
import { SKILLS, type SkillId } from './skills'
import { WEAPONS, type WeaponId } from './weapons'

/**
 * What an effect is called where the player sees it at work: the class ability's name; else that of a skill or weapon
 * the squad has, since skills of different classes may share an effect; else the relic's or doctrine's, the word a gear
 * effect adds to a name, or any skill's.
 */
export function effectName(effect: Effect | Ability, squad: { skills: SkillId[]; weapons: WeaponId[] } = { skills: [], weapons: [] }): string {
  if (effect === 'overwatch') return 'Overwatch'
  if (effect === 'stun') return 'Stunned'
  if (effect === 'surge') return 'Temp HP'
  if (effect === 'carry') return 'Carry'
  if (effect === 'frozen') return 'Frozen'
  if (effect === 'reckoning') return "Executioner's Oath"
  const cancel = cancelOf(effect)
  if (cancel) return cancel.name
  if (effect in DUOS) return DUOS[effect as DuoId].name
  if (effect in EXAMS && effect !== 'thorns') return EXAMS[effect as Exam].name
  const ability = Object.values(CLASSES).find((cls) => cls.ability === effect)
  if (ability) return ability.abilityName
  const own = [...squad.skills.map((id) => SKILLS[id]), ...squad.weapons.map((id) => WEAPONS[id]), ...Object.values(RELICS), ...Object.values(DOCTRINES)].find((source) => source.effect === effect)
  if (own) return own.name
  if (effect in UTILITIES) return UTILITIES[effect as keyof typeof UTILITIES].name
  const perk = Object.values(PERKS).find((p) => p.effect === effect)
  if (perk) return perk.name
  if (effect in EFFECTS) return EFFECTS[effect as keyof typeof EFFECTS].prefix
  return Object.values(SKILLS).find((skill) => skill.effect === effect)!.name
}
