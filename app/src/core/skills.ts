import { DRONE_STATS, LINGER_TURNS, PLATING_ARMOR, SEARING_DAMAGE, TITAN_HEALTH, type SkillEffect, type Stats } from './battle'
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
  reactive: { name: 'Reactive Armor', tags: ['ward'], text: '+4 armor', stats: { armor: 4 } },
  steadfast: { name: 'Steadfast', text: 'It cannot be panicked, and acid and explosions do it no harm', effect: 'steadfast' },
  bigBlast: { name: 'Cluster Rocket', text: 'Its rockets blast 2 tiles around where they land', effect: 'bigBlast' },
  concussion: { name: 'Concussive Rounds', tags: ['crit'], text: 'A crit stuns the target, which loses its next action', effect: 'concussion' },
  // Sniper
  steady: { name: 'Steady Aim', text: 'If it did not move this turn, it rolls twice to hit and takes the better', effect: 'steady' },
  headshot: { name: 'Headshot', tags: ['crit'], text: 'Crits do 2 more damage', effect: 'headshot' },
  mark: { name: "Hunter's Mark", tags: ['mark'], text: `A target it hits is marked: every later hit on it does ${TUNING.markDamage} more damage`, effect: 'mark' },
  doubleTap: { name: 'Double Tap', text: 'If it did not move this turn, it shoots a third time', effect: 'doubleTap' },
  hollowPoint: { name: 'Piercing Rounds', text: "Its shots ignore the target's cover", effect: 'pierce' },
  assassinate: { name: 'Assassinate', tags: ['crit'], text: 'A hit on a target at full health is a crit', effect: 'assassinate' },
  longshot: { name: 'Longshot', text: '+2 range', stats: { range: 2 } },
  slayer: { name: 'Colossus Slayer', text: '+2 damage to a target already wounded', effect: 'slayer' },
  volley: { name: 'Volley', text: 'A hit also does half its damage to every alien beside the target', effect: 'volley' },
  ghost: { name: 'Ghost', text: 'Aliens more than 4 tiles away cannot shoot it', effect: 'ghost' },
  // Engineer
  titan: { name: 'Titan Frame', text: `Its mech has +${TITAN_HEALTH} health and +1 damage`, effect: 'titan' },
  plating: { name: 'Reactive Plating', tags: ['ward'], text: `Its mech has +${PLATING_ARMOR} armor`, effect: 'plating' },
  servos: { name: 'Overclocked Servos', text: 'Its mech has +2 move and +15% aim', effect: 'servos' },
  detonate: { name: 'Self-Destruct', text: 'A destroyed mech of its explodes for 4 damage on every alien beside it', effect: 'detonate' },
  rebuild: { name: 'Field Rebuild', text: 'One more deploy each battle', charges: 1 },
  swarm: { name: 'Drone Swarm', text: `Deploys two light drones in place of a mech: ${DRONE_STATS.hp} health and ${DRONE_STATS.damage} damage each, +2 move, and the aliens are free to ignore them`, effect: 'swarm' },
  spotter: { name: 'Spotter Drones', tags: ['mark'], text: 'A target its drones hit is marked', effect: 'spotter' },
  linked: { name: 'Linked Targeting', text: 'Squadmates within 2 tiles of one of its drones have +10% aim', effect: 'linked' },
  hive: { name: 'Hive Mind', text: 'Deploys a third drone', effect: 'hive' },
  shock: { name: 'Shock Prongs', text: 'A target its drones hit is rooted: it cannot move on its next turn', effect: 'shock' },
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
  // Pyro
  tanks: { name: 'Napalm Tanks', tags: ['burn'], text: 'One more napalm each battle', charges: 1 },
  inferno: { name: 'Inferno', tags: ['burn'], text: 'Its napalm spreads 2 tiles around where it lands', effect: 'inferno' },
  fireSuit: { name: 'Fire Suit', text: 'It cannot burn', effect: 'fireSuit' },
  backdraft: { name: 'Backdraft', tags: ['burn', 'kill'], text: 'An alien it kills while burning sets every alien beside it burning', effect: 'backdraft' },
  asbestos: { name: 'Asbestos Coat', text: '+3 health', stats: { hp: 3 } },
  tinder: { name: 'Incendiary Rounds', tags: ['burn'], text: 'Its hits set the target burning', effect: 'tinder' },
  searing: { name: 'Searing', tags: ['burn'], text: `+${SEARING_DAMAGE} damage to a burning target`, effect: 'searing' },
  flashpoint: { name: 'Flashpoint', tags: ['crit'], text: '+15% crit', stats: { crit: 0.15 } },
  smolder: { name: 'Smolder', tags: ['burn'], text: `Its burns last ${LINGER_TURNS} more turns`, effect: 'smolder' },
  afterburner: { name: 'Afterburner', text: '+2 move', stats: { move: 2 } },
  // Cryo
  icebreak: { name: 'Icebreaker', tags: ['frost'], text: `+${SEARING_DAMAGE} damage to a chilled target`, effect: 'icebreak' },
  frostbreak: { name: 'Frostbite', tags: ['frost', 'ward'], text: "Hits on a chilled target ignore its armor", effect: 'frostbreak' },
  deepFreeze: { name: 'Deep Freeze', tags: ['frost', 'crit'], text: 'A crit on a chilled alien freezes it solid: it loses its next action', effect: 'deepFreeze' },
  avalanche: { name: 'Avalanche', tags: ['frost', 'kill'], text: 'An alien it kills while chilled chills every alien beside it', effect: 'avalanche' },
  coldSteel: { name: 'Cold Steel', text: '+1 damage', stats: { damage: 1 } },
  permafrost: { name: 'Permafrost', tags: ['frost'], text: `Its chills last ${LINGER_TURNS} more turns`, effect: 'permafrost' },
  rimeLock: { name: 'Rime Lock', tags: ['frost'], text: 'An alien it chills is rooted too', effect: 'rimeLock' },
  coldEye: { name: 'Cold Eye', text: '+10% aim', stats: { aim: 0.1 } },
  iceArmor: { name: 'Ice Armor', tags: ['ward'], text: '+2 armor', stats: { armor: 2 } },
  longRange: { name: 'Long Barrel', text: '+2 range', stats: { range: 2 } },
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
    { name: 'Guardian', core: 'bulwark', tiers: [['taunt', 'reactive'], ['steadfast', 'overwatch']] },
  ],
  sniper: [
    { name: 'Marksman', core: 'steady', tiers: [['headshot', 'longshot'], ['doubleTap', 'assassinate']] },
    { name: 'Hunter', core: 'mark', tiers: [['slayer', 'hollowPoint'], ['volley', 'ghost']] },
  ],
  engineer: [
    { name: 'Mechanic', core: 'titan', tiers: [['plating', 'servos'], ['detonate', 'rebuild']] },
    { name: 'Dronemaster', core: 'swarm', tiers: [['spotter', 'linked'], ['hive', 'shock']] },
  ],
  pyro: [
    { name: 'Arsonist', core: 'tanks', tiers: [['inferno', 'fireSuit'], ['backdraft', 'asbestos']] },
    { name: 'Firestarter', core: 'tinder', tiers: [['searing', 'flashpoint'], ['smolder', 'afterburner']] },
  ],
  cryo: [
    { name: 'Icebreaker', core: 'icebreak', tiers: [['frostbreak', 'coldSteel'], ['deepFreeze', 'avalanche']] },
    { name: 'Glacier', core: 'permafrost', tiers: [['rimeLock', 'coldEye'], ['iceArmor', 'longRange']] },
  ],
  support: [
    { name: 'Medic', core: 'fieldKit', tiers: [['surgeon', 'vitality'], ['revive', 'ward']] },
    { name: 'Tactician', core: 'inspire', tiers: [['haste', 'bane'], ['barrier', 'drone']] },
  ],
}
