import type { SkillEffect, Stats } from './battle'
import { TUNING } from './tuning'
import type { ClassId } from './classes'
import type { Keyword } from './keywords'

/**
 * Something a soldier learns on gaining one of its first levels, along one of its class's paths.
 * It changes stats, adds uses of the class ability, or gives an effect that combat applies; `text` says which.
 */
export interface Skill {
  name: string
  text: string
  tags?: Keyword[]
  stats?: Partial<Stats>
  /** Added to the uses of the class ability each battle. */
  charges?: number
  effect?: SkillEffect
}

const skills = {
  // Assault
  bloodlust: { name: 'Bloodlust', tags: ['kill'], text: 'A kill grants one more shot', effect: 'frenzy' },
  backstab: { name: 'Backstab', text: '+2 damage to a target with no cover against the shot', effect: 'backstab' },
  rage: { name: 'Rage', text: '+2 damage while at half health or less', effect: 'rage' },
  reflexes: { name: 'Reflexes', text: 'One hit in four against this soldier misses instead', effect: 'dodge' },
  sprinter: { name: 'Sprinter', text: '+2 move', stats: { move: 2 } },
  surge: { name: 'Action Surge', text: 'Once per battle, it shoots twice in one turn', effect: 'surge' },
  secondWind: { name: 'Second Wind', text: 'Once per battle, at half health or less, it heals 5 and still shoots', effect: 'secondWind' },
  skirmish: { name: 'Skirmisher', text: 'After it acts, it moves up to 2 tiles to where the aliens have the worst shot at it', effect: 'skirmish' },
  reckless: { name: 'Reckless Attack', text: '+20% aim, and aliens have +20% aim against it', effect: 'reckless' },
  cleave: { name: 'Cleave', tags: ['kill'], text: 'A kill does 2 damage to every alien beside the one killed', effect: 'cleave' },
  // Heavy
  arsenal: { name: 'Arsenal', text: 'One more rocket each battle', charges: 1 },
  shredder: { name: 'Shredder', text: "A hit destroys all the target's armor before it does damage", effect: 'shred' },
  suppression: { name: 'Suppression', text: 'A target it hits has -25% aim on its next turn', effect: 'suppress' },
  bulwark: { name: 'Bulwark', tags: ['ward'], text: 'Squadmates within 2 tiles are 10% harder to hit', effect: 'bulwark' },
  overwatch: { name: 'Overwatch', text: 'Shoots at an alien that moves in its sights on the alien turn', effect: 'overwatch' },
  taunt: { name: 'Taunt', text: 'An alien that can shoot it must shoot it', effect: 'taunt' },
  thick: { name: 'Heavy Armor Master', tags: ['ward'], text: 'Every hit on it does 1 less damage', effect: 'thick' },
  steadfast: { name: 'Steadfast', text: 'It cannot be panicked, and acid and explosions do it no harm', effect: 'steadfast' },
  bigBlast: { name: 'Cluster Rocket', text: 'Its rockets blast 2 tiles around where they land', effect: 'bigBlast' },
  concussion: { name: 'Concussive Rounds', tags: ['crit'], text: 'A crit stuns the target, which loses its next action', effect: 'concussion' },
  // Sniper
  steady: { name: 'Steady Aim', text: 'If it did not move this turn, it rolls twice to hit and takes the better', effect: 'steady' },
  headshot: { name: 'Headshot', tags: ['crit'], text: 'Crits do 2 more damage', effect: 'headshot' },
  mark: { name: "Hunter's Mark", tags: ['mark'], text: `A target it hits is marked: every later hit on it does ${TUNING.markDamage} more damage`, effect: 'mark' },
  doubleTap: { name: 'Double Tap', text: 'If it did not move this turn, it shoots twice', effect: 'doubleTap' },
  hollowPoint: { name: 'Piercing Rounds', text: "Its shots ignore the target's cover", effect: 'pierce' },
  assassinate: { name: 'Assassinate', tags: ['crit'], text: 'A hit on a target at full health is a crit', effect: 'assassinate' },
  longshot: { name: 'Longshot', text: '+2 range', stats: { range: 2 } },
  slayer: { name: 'Colossus Slayer', text: '+2 damage to a target already wounded', effect: 'slayer' },
  volley: { name: 'Volley', text: 'A hit also does half its damage to every alien beside the target', effect: 'volley' },
  ghost: { name: 'Ghost', text: 'Aliens more than 4 tiles away cannot shoot it', effect: 'ghost' },
  // Support
  fieldKit: { name: 'Field Kit', text: 'Two more heals each battle', charges: 2 },
  revive: { name: 'Revive', text: 'Once per battle, a squadmate who falls within 3 tiles gets up with 3 health', effect: 'revive' },
  inspire: { name: 'Inspire', text: 'Squadmates within 2 tiles have +10% aim', effect: 'inspire' },
  barrier: { name: 'Barrier Projector', tags: ['ward'], text: 'Every squadmate starts each battle with 2 more armor', effect: 'barrier' },
  surgeon: { name: 'Surgeon', text: 'Its heals restore 3 more health', effect: 'surgeon' },
  haste: { name: 'Haste', text: 'Squadmates within 2 tiles have +2 move', effect: 'haste' },
  vitality: { name: 'Aura of Vitality', text: 'At the start of its turn, each wounded squadmate within 2 tiles heals 1', effect: 'vitality' },
  bane: { name: 'Bane', text: 'Aliens within 3 tiles of it have -10% aim', effect: 'bane' },
  ward: { name: 'Ward', text: 'It and squadmates within 2 tiles cannot be panicked, and acid does them no harm', effect: 'ward' },
  drone: { name: 'Combat Drone', text: 'After it acts, its drone does 2 damage to the nearest alien in sight within 5 tiles', effect: 'drone' },
} satisfies Record<string, Skill>

export type SkillId = keyof typeof skills
export const SKILLS: Record<SkillId, Skill> = skills

/** A way to build a soldier: its core skill, learned first, then one skill of each tier's pair, the other lost. */
export interface Path {
  name: string
  core: SkillId
  tiers: [SkillId, SkillId][]
}

/** Each class's two paths; choosing one shuts the other. */
export const PATHS: Record<ClassId, [Path, Path]> = {
  assault: [
    { name: 'Berserker', core: 'bloodlust', tiers: [['rage', 'reckless'], ['cleave', 'surge']] },
    { name: 'Infiltrator', core: 'backstab', tiers: [['reflexes', 'sprinter'], ['skirmish', 'secondWind']] },
  ],
  heavy: [
    { name: 'Demolisher', core: 'arsenal', tiers: [['bigBlast', 'shredder'], ['concussion', 'suppression']] },
    { name: 'Guardian', core: 'bulwark', tiers: [['taunt', 'thick'], ['steadfast', 'overwatch']] },
  ],
  sniper: [
    { name: 'Marksman', core: 'steady', tiers: [['headshot', 'longshot'], ['doubleTap', 'assassinate']] },
    { name: 'Hunter', core: 'mark', tiers: [['slayer', 'hollowPoint'], ['volley', 'ghost']] },
  ],
  support: [
    { name: 'Medic', core: 'fieldKit', tiers: [['surgeon', 'vitality'], ['revive', 'ward']] },
    { name: 'Tactician', core: 'inspire', tiers: [['haste', 'bane'], ['barrier', 'drone']] },
  ],
}
