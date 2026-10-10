import type { SkillEffect, Stats } from './battle'
import type { ClassId } from './classes'

/**
 * Something a soldier learns on gaining a level, chosen from three drawn from the class's skills.
 * It changes stats, adds uses of the class ability, or gives an effect that combat applies; `text` says which.
 */
export interface Skill {
  name: string
  text: string
  stats?: Partial<Stats>
  /** Added to the uses of the class ability each battle. */
  charges?: number
  effect?: SkillEffect
}

const skills = {
  // Assault
  bloodlust: { name: 'Bloodlust', text: 'A kill grants one more shot', effect: 'frenzy' },
  backstab: { name: 'Backstab', text: '+2 damage to a target with no cover against the shot', effect: 'backstab' },
  rage: { name: 'Rage', text: '+2 damage while at half health or less', effect: 'rage' },
  reflexes: { name: 'Reflexes', text: 'One hit in four against this soldier misses instead', effect: 'dodge' },
  sprinter: { name: 'Sprinter', text: '+2 move', stats: { move: 2 } },
  // Heavy
  arsenal: { name: 'Arsenal', text: 'One more rocket each battle', charges: 1 },
  shredder: { name: 'Shredder', text: "A hit destroys all the target's armor before it does damage", effect: 'shred' },
  suppression: { name: 'Suppression', text: 'A target it hits has -25% aim on its next turn', effect: 'suppress' },
  bulwark: { name: 'Bulwark', text: 'Squadmates within 2 tiles are 10% harder to hit', effect: 'bulwark' },
  overwatch: { name: 'Overwatch', text: 'Shoots at an alien that moves in its sights on the alien turn', effect: 'overwatch' },
  // Sniper
  steady: { name: 'Steady Aim', text: 'If it did not move this turn, it rolls twice to hit and takes the better', effect: 'steady' },
  headshot: { name: 'Headshot', text: 'Crits do 2 more damage', effect: 'headshot' },
  mark: { name: "Hunter's Mark", text: 'A target it hits is marked: every later hit on it does 1 more damage', effect: 'mark' },
  doubleTap: { name: 'Double Tap', text: 'If it did not move this turn, it shoots twice', effect: 'doubleTap' },
  hollowPoint: { name: 'Piercing Rounds', text: "Its shots ignore the target's cover", effect: 'pierce' },
  // Support
  fieldKit: { name: 'Field Kit', text: 'Two more heals each battle', charges: 2 },
  revive: { name: 'Revive', text: 'Once per battle, a squadmate who falls within 3 tiles gets up with 3 health', effect: 'revive' },
  inspire: { name: 'Inspire', text: 'Squadmates within 2 tiles have +10% aim', effect: 'inspire' },
  barrier: { name: 'Barrier Projector', text: 'Every squadmate starts each battle with 2 more armor', effect: 'barrier' },
  surgeon: { name: 'Surgeon', text: 'Its heals restore 3 more health', effect: 'surgeon' },
} satisfies Record<string, Skill>

export type SkillId = keyof typeof skills
export const SKILLS: Record<SkillId, Skill> = skills

/** The skills each class draws from. */
export const CLASS_SKILLS: Record<ClassId, SkillId[]> = {
  assault: ['bloodlust', 'backstab', 'rage', 'reflexes', 'sprinter'],
  heavy: ['arsenal', 'shredder', 'suppression', 'bulwark', 'overwatch'],
  sniper: ['steady', 'headshot', 'mark', 'doubleTap', 'hollowPoint'],
  support: ['fieldKit', 'revive', 'inspire', 'barrier', 'surgeon'],
}

/** Skills offered at each level gained. */
export const SKILL_OFFERS = 3
