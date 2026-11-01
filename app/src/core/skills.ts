// Powers heroes learn: each class's tree, and what each skill does.
import {
  DRONE_STATS,
  FORCE_FIELD_ARMOR,
  FORCE_FIELD_REACH,
  HURL_DAMAGE,
  HURL_TILES,
  LEAP_DAMAGE,
  LINGER_TURNS,
  PLATING_ARMOR,
  SEARING_DAMAGE,
  SHADOW_DAMAGE,
  SLAM_HIT,
  SLAM_TILES,
  STUN_REACH,
  TITAN_HEALTH,
  type Effect,
  type Stats,
} from './battle'
import { TUNING } from './tuning'
import { classPower, CLASSES, type ClassId } from './classes'
import type { Keyword } from './keywords'
import type { Power } from './powers'

/**
 * What a skill is for: keeping its hero or party alive, holding the aliens back or moving them, or hitting harder
 * and more often. Each level offers one of each, so every class can always choose to guard or to control.
 */
export type Role = 'guard' | 'control' | 'power'

/**
 * Something a hero learns on gaining a level, from its class's tree. It changes stats, adds uses of the class
 * ability, or gives an effect that combat applies; `text` says which. A skill with `after` opens once the hero knows
 * any of those; one without is a root, open from the first pick. One that `teaches` gives the hero its class's ability.
 */
export interface Skill extends Power {
  role: Role
  tags?: Keyword[]
  stats?: Partial<Stats>
  /** Added to the uses of the class ability each battle. */
  charges?: number
  effect?: Effect
  after?: string[]
  teaches?: true
}

/** What a stunned alien loses. */
const stun = 'loses its next action'

/** A class's ability as a skill to learn. */
const taught = (cls: ClassId, role: Role) => ({ ...classPower(CLASSES[cls], CLASSES[cls].charges), role, teaches: true as const })

const skills = {
  // Assault
  mightyBound: taught('assault', 'power'),
  bloodlust: { name: 'Bloodlust', use: 'Reaction', role: 'power', tags: ['kill'], text: 'A kill grants one more attack with its weapon', effect: 'frenzy' },
  reflexes: { name: 'Reflexes', use: 'Passive', role: 'guard', text: 'Takes 1 less damage from each hit', effect: 'dodge' },
  leap: { name: 'Heroic Leap', use: '1/battle', range: '2× move', target: 'Thickest knot', role: 'control', text: `${LEAP_DAMAGE} damage to each alien beside where it lands, and roots them`, effect: 'leap' },
  rage: { name: 'Rage', use: 'Passive', role: 'power', text: '+2 damage at half HP or less', effect: 'rage', after: ['bloodlust'] },
  cleave: { name: 'Cleave', use: 'Reaction', role: 'power', tags: ['kill'], text: 'A kill does 2 damage to every alien beside the one killed', effect: 'cleave', after: ['bloodlust'] },
  surge: { name: 'Action Surge', use: '1/battle', role: 'power', text: 'One more attack with its weapon in a turn', effect: 'surge', after: ['bloodlust', 'rage'] },
  reckless: { name: 'Reckless Attack', use: 'Passive', role: 'power', text: '+1 damage; aliens do 1 more damage to it', effect: 'reckless', after: ['rage'] },
  skirmish: { name: 'Skirmisher', use: 'Reaction', role: 'guard', text: 'After it acts, moves up to 2 tiles away from the aliens', effect: 'skirmish', after: ['reflexes'] },
  secondWind: { name: 'Second Wind', use: '1/battle', target: 'Self', role: 'guard', text: 'At half HP or less, heals 5 and still attacks', effect: 'secondWind', after: ['reflexes'] },
  unbreakable: { name: 'Unbreakable', use: '1/battle', target: 'Self', role: 'guard', text: 'Survives a killing hit at 1 HP', effect: 'lastStand', after: ['reflexes', 'secondWind'] },
  hurl: { name: 'Hurl', use: 'At will', target: 'Creature hit', role: 'control', text: `Thrown ${HURL_TILES} tiles back; ${HURL_DAMAGE} damage if a wall or alien stops it`, effect: 'hurl', after: ['leap'] },
  hamstring: { name: 'Crippling Blow', use: 'At will', target: 'Creature hit', role: 'control', text: 'Rooted: it cannot move on its next turn', effect: 'snare', after: ['leap'] },
  sprinter: { name: 'Super Speed', use: 'Passive', role: 'power', text: '+2 move', stats: { move: 2 }, after: ['leap', 'skirmish'] },
  backstab: { name: 'Lone Prey', use: 'Passive', role: 'power', text: '+2 damage to a target with no alien beside it', effect: 'backstab', after: ['skirmish', 'sprinter'] },
  // Heavy
  meteorStrike: taught('heavy', 'power'),
  arsenal: { name: 'Second Meteor', use: 'Passive', role: 'power', text: 'One more Meteor Strike each battle', charges: 1, after: ['meteorStrike'] },
  bulwark: { name: 'Bulwark', use: 'Aura', range: '2', target: 'Allies', role: 'guard', tags: ['ward'], text: 'Take 1 less damage from each hit', effect: 'bulwark' },
  suppression: { name: 'Staggering Blow', use: 'At will', target: 'Creature hit', role: 'control', text: 'It does 1 less damage on its next turn', effect: 'suppress' },
  bigBlast: { name: 'Greater Meteor', use: 'Passive', role: 'power', text: 'Meteor Strike blasts 2 tiles around where it lands', effect: 'bigBlast', after: ['arsenal'] },
  shredder: { name: 'Sundering Blow', use: 'At will', target: 'Creature hit', role: 'power', tags: ['ward'], text: 'Destroys all its armor before doing damage', effect: 'shred', after: ['meteorStrike'] },
  concussion: { name: 'Concussive Blows', use: 'Reaction', target: 'Creature crit', role: 'control', tags: ['crit'], text: `Stunned: it ${stun}`, effect: 'concussion', after: ['arsenal', 'suppression'] },
  taunt: { name: 'Taunt', use: 'Passive', role: 'guard', text: 'An alien that can shoot it must shoot it', effect: 'taunt', after: ['bulwark'] },
  steadfast: { name: 'Steadfast', use: 'Passive', role: 'guard', text: 'Cannot be panicked; acid and explosions do it no harm', effect: 'steadfast', after: ['bulwark'] },
  reactive: { name: 'Stone Skin', use: 'Passive', role: 'guard', tags: ['ward'], text: '+4 armor', stats: { armor: 4 }, after: ['bulwark', 'taunt'] },
  slam: { name: 'Ground Slam', use: '1/battle', range: 'Adjacent', target: '2+ aliens', role: 'control', text: `Replaces an attack. ${SLAM_HIT} damage to each, hurled ${SLAM_TILES} tiles back`, effect: 'slam', after: ['suppression'] },
  intimidate: { name: 'Terrifying Roar', use: '1/battle', range: `${STUN_REACH}`, target: '2+ aliens', role: 'control', text: `Each ${stun}; a boss stands firm`, effect: 'warcry', after: ['suppression', 'taunt'] },
  overwatch: { name: 'Opportunity Attack', use: 'Reaction', range: 'Weapon', target: 'Alien moving in', role: 'power', text: 'Attacks it on the alien turn', effect: 'overwatch', after: ['steadfast', 'suppression'] },
  charge: { name: 'Bull Rush', use: '1/battle', range: '2× move', target: 'Thickest knot', role: 'control', text: `${LEAP_DAMAGE} damage to each alien beside where it lands, and roots them`, effect: 'leap', after: ['slam'] },
  // Sniper
  farSight: taught('sniper', 'power'),
  steady: { name: 'Steady Hands', use: 'Passive', role: 'power', text: '+1 damage if it did not move this turn', effect: 'steady' },
  mark: { name: "Hunter's Mark", use: 'At will', target: 'Creature hit', role: 'power', tags: ['mark'], text: `Marked: every later hit on it does ${TUNING.markDamage} more damage`, effect: 'mark' },
  elusive: { name: 'Elusive', use: 'Passive', role: 'guard', text: 'Aliens more than 4 tiles away cannot shoot it', effect: 'elusive' },
  kneecap: { name: 'Pinning Shot', use: 'At will', target: 'Creature hit', role: 'control', text: 'Rooted: it cannot move on its next turn', effect: 'snare' },
  headshot: { name: 'Headshot', use: 'Passive', role: 'power', tags: ['crit'], text: 'Crits do 2 more damage', effect: 'headshot', after: ['steady'] },
  doubleTap: { name: 'Double Tap', use: 'Passive', role: 'power', text: 'A third attack with its weapon if it did not move this turn', effect: 'doubleTap', after: ['steady'] },
  assassinate: { name: 'Assassinate', use: 'Passive', role: 'power', tags: ['crit'], text: 'A hit on a target at full HP is a crit', effect: 'assassinate', after: ['steady', 'headshot'] },
  slayer: { name: 'Colossus Slayer', use: 'Passive', role: 'power', text: '+2 damage to a target already wounded', effect: 'slayer', after: ['mark'] },
  hollowPoint: { name: 'Piercing Blows', use: 'Passive', role: 'power', text: 'Its attacks ignore armor', effect: 'pierce', after: ['mark'] },
  volley: { name: 'Volley', use: 'At will', target: 'Beside creature hit', role: 'power', text: "Half the hit's damage to each", effect: 'volley', after: ['mark', 'slayer'] },
  decoy: { name: 'Mirror Image', use: 'Passive', role: 'guard', text: 'Starts each battle with 2 images; each of the first 2 hits pops one instead', effect: 'mirror', after: ['elusive'] },
  blink: { name: 'Blink', use: '1/battle', range: '5', target: 'Self', role: 'guard', text: 'Hit to half HP or less: blinks to the safest tile', effect: 'blink', after: ['elusive'] },
  relocate: { name: 'Relocate', use: 'Reaction', role: 'guard', text: 'After it acts, moves up to 2 tiles away from the aliens', effect: 'skirmish', after: ['elusive', 'blink'] },
  longshot: { name: 'Longshot', use: 'Passive', role: 'power', text: 'Bonus attack reaches 2 tiles farther', effect: 'longshot', after: ['elusive', 'steady'] },
  tranq: { name: 'Sleep', use: '1/battle', range: '5', target: 'Toughest non-boss', role: 'control', text: `Falls asleep and ${stun}`, effect: 'polymorph', after: ['kneecap'] },
  charged: { name: 'Booming Blows', use: 'At will', target: 'Creature hit', role: 'control', text: 'If it moves on its next turn, it takes 3 damage', effect: 'booming', after: ['kneecap'] },
  // Engineer
  deployMech: taught('engineer', 'power'),
  titan: { name: 'Titan Frame', use: 'Passive', role: 'guard', text: `Its mech has +${TITAN_HEALTH} HP and +1 damage`, effect: 'titan', after: ['deployMech'] },
  swarm: { name: 'Drone Swarm', use: 'Passive', role: 'power', text: `Deploys two drones in place of a mech: ${DRONE_STATS.hp} HP, ${DRONE_STATS.damage} damage, +2 move; aliens may ignore them`, effect: 'swarm', after: ['deployMech'] },
  launcher: { name: 'Caltrop Launcher', use: '1/battle', target: 'Path of an alien', role: 'control', text: 'Each tile costs 2 more move to cross and hurts an alien 1', effect: 'caltrops' },
  hardlight: { name: 'Hardlight Barrier', use: 'Reaction', target: 'Self', role: 'guard', tags: ['ward'], text: 'Absorbs the first hit each battle', effect: 'shield' },
  plating: { name: 'Reactive Plating', use: 'Passive', role: 'guard', tags: ['ward'], text: `Its mech has +${PLATING_ARMOR} armor`, effect: 'plating', after: ['titan'] },
  rebuild: { name: 'Field Rebuild', use: 'Passive', role: 'guard', text: 'One more deploy each battle', charges: 1, after: ['titan', 'swarm'] },
  servos: { name: 'Overclocked Servos', use: 'Passive', role: 'power', text: 'Its machines have +2 move and +1 damage', effect: 'servos', after: ['titan', 'swarm'] },
  detonate: { name: 'Self-Destruct', use: 'Reaction', target: 'Beside its mech', role: 'power', text: 'When destroyed, the mech does 4 damage to each', effect: 'detonate', after: ['titan', 'plating'] },
  spotter: { name: 'Spotter Drones', use: 'At will', target: 'Hit by drones', role: 'power', tags: ['mark'], text: 'Marked', effect: 'spotter', after: ['swarm'] },
  linked: { name: 'Linked Targeting', use: 'Aura', range: '2 of a machine', target: 'Allies', role: 'power', text: '+1 damage', effect: 'linked', after: ['swarm'] },
  hive: { name: 'Hive Mind', use: 'Passive', role: 'power', text: 'Deploys a third drone', effect: 'hive', after: ['swarm'] },
  shock: { name: 'Shock Prongs', use: 'At will', target: 'Hit by machines', role: 'control', text: 'Rooted: it cannot move on its next turn', effect: 'shock', after: ['swarm', 'launcher'] },
  emp: { name: 'EMP Pulse', use: '1/battle', range: `${STUN_REACH} of it or machines`, target: '2+ aliens', role: 'control', text: `Each ${stun}; a boss stands firm`, effect: 'emp', after: ['launcher'] },
  // Support
  healingLight: taught('support', 'guard'),
  fieldKit: { name: 'Deep Wellspring', use: 'Passive', role: 'power', text: 'Two more Healing Lights each battle', charges: 2, after: ['healingLight'] },
  inspire: { name: 'Inspire', use: 'Aura', range: '2', target: 'Allies', role: 'power', text: '+1 damage', effect: 'inspire' },
  barrier: { name: 'Shield of Faith', use: 'Passive', target: 'All allies', role: 'guard', tags: ['ward'], text: 'Start each battle with 2 more armor', effect: 'barrier' },
  flashbang: { name: 'Blinding Light', use: '1/battle', range: 'Attack range', target: '2+ aliens together', role: 'control', text: `Each ${stun}; a boss stands firm`, effect: 'flashbang' },
  surgeon: { name: 'Greater Healing', use: 'Passive', role: 'power', text: 'Healing Light restores 3 more HP', effect: 'surgeon', after: ['fieldKit'] },
  revive: { name: 'Revivify', use: '1/battle', range: '3', target: 'Falling ally', role: 'guard', text: 'Gets up with 3 HP', effect: 'revive', after: ['fieldKit'] },
  vitality: { name: 'Aura of Vitality', use: 'Aura', range: '2', target: 'Wounded allies', role: 'guard', text: 'Heal 1 at the start of its turn', effect: 'vitality', after: ['fieldKit', 'surgeon'] },
  haste: { name: 'Haste', use: 'Aura', range: '2', target: 'Allies', role: 'power', text: '+2 move', effect: 'haste', after: ['inspire'] },
  drone: { name: 'Spirit Guardian', use: 'Reaction', range: '5', target: 'Nearest alien in sight', role: 'power', text: 'After it acts, 2 damage', effect: 'drone', after: ['inspire'] },
  forceField: { name: 'Sanctuary', use: '1/battle', range: `${FORCE_FIELD_REACH}`, target: 'Ally at half HP', role: 'guard', tags: ['ward'], text: `Gains ${FORCE_FIELD_ARMOR} armor`, effect: 'forceField', after: ['barrier', 'inspire'] },
  ward: { name: 'Aura of Courage', use: 'Aura', range: '2', target: 'It and allies', role: 'guard', text: 'Cannot be panicked; acid does them no harm', effect: 'ward', after: ['barrier'] },
  bane: { name: 'Bane', use: 'Aura', range: '3', target: 'Aliens', role: 'guard', text: 'Do 1 less damage', effect: 'bane', after: ['barrier'] },
  gravBeam: { name: 'Gravity Lash', use: 'At will', target: 'Creature hit', role: 'control', text: 'Pulled a tile toward it', effect: 'tether', after: ['flashbang'] },
  nullifier: { name: 'Silence', use: 'Aura', range: '3', target: 'Aliens', role: 'control', text: 'Cannot spit, panic, spawn or burst', effect: 'null', after: ['flashbang'] },
  // Pyro
  fireball: taught('pyro', 'power'),
  tanks: { name: 'Deep Flame', use: 'Passive', role: 'power', tags: ['burn'], text: 'One more Fireball each battle', charges: 1, after: ['fireball'] },
  tinder: { name: 'Flame Blade', use: 'At will', target: 'Creature hit', role: 'power', tags: ['burn'], text: 'Set burning', effect: 'tinder' },
  fireSuit: { name: 'Flameborn', use: 'Passive', role: 'guard', text: 'It cannot burn', effect: 'fireSuit' },
  firewall: { name: 'Wall of Fire', use: '1/battle', target: 'Path of an alien', role: 'control', tags: ['burn'], text: 'Raises a wall of fire across it', effect: 'firewall' },
  inferno: { name: 'Inferno', use: 'Passive', role: 'power', tags: ['burn'], text: 'Fireball spreads 2 tiles around where it lands', effect: 'inferno', after: ['tanks'] },
  backdraft: { name: 'Backdraft', use: 'Reaction', target: 'Beside its burning kill', role: 'power', tags: ['burn', 'kill'], text: 'Set burning', effect: 'backdraft', after: ['tanks', 'tinder'] },
  asbestos: { name: 'Hide of Cinders', use: 'Passive', role: 'guard', text: '+3 HP', stats: { hp: 3 }, after: ['tanks', 'fireSuit'] },
  searing: { name: 'Searing', use: 'Passive', role: 'power', tags: ['burn'], text: `+${SEARING_DAMAGE} damage to a burning target`, effect: 'searing', after: ['tinder'] },
  flashpoint: { name: 'Flashpoint', use: 'Passive', role: 'power', tags: ['crit'], text: '+15% crit', stats: { crit: 0.15 }, after: ['tinder'] },
  smolder: { name: 'Smolder', use: 'Passive', role: 'power', tags: ['burn'], text: `Its burns last ${LINGER_TURNS} more turns`, effect: 'smolder', after: ['tinder', 'firewall'] },
  burningAura: { name: 'Fire Shield', use: 'Reaction', target: 'Whoever hits it', role: 'guard', text: 'Takes 1 damage', effect: 'thorns', after: ['fireSuit'] },
  phoenixHeart: { name: 'Phoenix Heart', use: 'Passive', role: 'guard', text: 'Heals 1 at the start of each turn', effect: 'regen', after: ['fireSuit'] },
  blastWave: { name: 'Blast Wave', use: 'At will', target: 'Creature hit', role: 'control', text: 'Knocked a tile back; 1 damage if something stops it', effect: 'thunder', after: ['firewall'] },
  blinding: { name: 'Searing Flash', use: 'Reaction', target: 'Creature crit', role: 'control', tags: ['crit'], text: `Stunned: it ${stun}`, effect: 'concussion', after: ['tinder', 'firewall'] },
  afterburner: { name: 'Rocket Flames', use: 'Passive', role: 'power', text: '+2 move', stats: { move: 2 }, after: ['firewall'] },
  // Cryo
  chillTouch: taught('cryo', 'control'),
  icebreak: { name: 'Icebreaker', use: 'Passive', role: 'power', tags: ['frost'], text: `+${SEARING_DAMAGE} damage to a chilled target`, effect: 'icebreak', after: ['chillTouch'] },
  permafrost: { name: 'Permafrost', use: 'Passive', role: 'control', tags: ['frost'], text: `Its chills last ${LINGER_TURNS} more turns`, effect: 'permafrost', after: ['chillTouch'] },
  iceArmor: { name: 'Ice Armor', use: 'Passive', role: 'guard', tags: ['ward'], text: '+3 armor', stats: { armor: 3 } },
  frostbreak: { name: 'Frostbite', use: 'Passive', role: 'power', tags: ['frost', 'ward'], text: 'Hits on a chilled target ignore its armor', effect: 'frostbreak', after: ['icebreak'] },
  coldSteel: { name: 'Cold Steel', use: 'Passive', role: 'power', text: '+1 damage', stats: { damage: 1 } },
  deepFreeze: { name: 'Deep Freeze', use: 'Reaction', target: 'Chilled alien crit', role: 'control', tags: ['frost', 'crit'], text: `Frozen solid: it ${stun}`, effect: 'deepFreeze', after: ['icebreak', 'permafrost'] },
  avalanche: { name: 'Avalanche', use: 'Reaction', target: 'Beside its chilled kill', role: 'control', tags: ['frost', 'kill'], text: 'Chilled', effect: 'avalanche', after: ['icebreak', 'deepFreeze'] },
  rimeLock: { name: 'Rime Lock', use: 'At will', target: 'Alien it chills', role: 'control', tags: ['frost'], text: 'Rooted too', effect: 'rimeLock', after: ['permafrost'] },
  coldEye: { name: 'Cold Eye', use: 'Passive', role: 'power', text: '+15% crit', stats: { crit: 0.15 }, after: ['permafrost'] },
  longRange: { name: 'Long Throw', use: 'Passive', role: 'power', text: 'Bonus attack reaches 2 tiles farther', effect: 'longshot', after: ['permafrost', 'iceArmor'] },
  frostAura: { name: 'Frost Aura', use: 'Reaction', target: 'Whoever hits it', role: 'guard', tags: ['frost'], text: 'Chilled', effect: 'rime', after: ['iceArmor'] },
  glide: { name: 'Ice Glide', use: 'Reaction', role: 'guard', text: 'After it acts, slides up to 2 tiles away from the aliens', effect: 'skirmish', after: ['iceArmor'] },
  cryostasis: { name: 'Cryostasis', use: '1/battle', target: 'Self', role: 'guard', text: 'Survives a killing hit at 1 HP', effect: 'lastStand', after: ['iceArmor'] },
  // Phantom
  cloak: taught('phantom', 'power'),
  shadowStrike: { name: 'Shadow Strike', use: 'Passive', role: 'power', text: `Its attack out of Cloak does ${SHADOW_DAMAGE} more damage`, effect: 'shadowStrike', after: ['cloak'] },
  vanish: { name: 'Vanish', use: '1/battle', target: 'Self', role: 'guard', text: 'Hit to half HP or less: it cloaks', effect: 'vanish' },
  daze: { name: 'Unseen Blade', use: 'At will', target: 'Creature hit out of Cloak', role: 'control', text: `Stunned: it ${stun}; a boss stands firm`, effect: 'daze', after: ['cloak'] },
  deepCloak: { name: 'Deep Cloak', use: 'Passive', role: 'power', text: 'One more Cloak each battle', charges: 1, after: ['shadowStrike'] },
  afterimage: { name: 'Afterimage', use: 'Reaction', target: 'Self', role: 'power', tags: ['kill'], text: 'A kill out of Cloak cloaks it again', effect: 'afterimage', after: ['shadowStrike', 'deepCloak'] },
  knifeWork: { name: 'Knife Work', use: 'Passive', role: 'power', text: '+2 damage to a target with no alien beside it', effect: 'backstab' },
  phaseShift: { name: 'Phase Shift', use: 'Passive', role: 'guard', text: 'Takes 1 less damage from each hit', effect: 'dodge', after: ['vanish'] },
  fadeOut: { name: 'Fade Out', use: 'Reaction', role: 'guard', text: 'After it acts, moves up to 2 tiles away from the aliens', effect: 'skirmish', after: ['vanish'] },
  shadowStep: { name: 'Shadow Step', use: 'Passive', role: 'power', text: '+2 move', stats: { move: 2 }, after: ['fadeOut', 'shadowStrike'] },
  garrote: { name: 'Shadow Grip', use: 'At will', target: 'Creature hit', role: 'control', text: 'Rooted: it cannot move on its next turn', effect: 'snare' },
  smokeBomb: { name: 'Darkness', use: '1/battle', range: 'Attack range', target: '2+ aliens together', role: 'control', text: `Each ${stun}; a boss stands firm`, effect: 'flashbang', after: ['daze', 'vanish'] },
} satisfies Record<string, Skill>

export type SkillId = keyof typeof skills
export const SKILLS: Record<SkillId, Skill> = skills

/** Each class's tree: the skills its heroes learn from, roots first. */
export const TREES: Record<ClassId, SkillId[]> = {
  assault: ['mightyBound', 'bloodlust', 'reflexes', 'leap', 'rage', 'cleave', 'surge', 'reckless', 'skirmish', 'secondWind', 'unbreakable', 'hurl', 'hamstring', 'sprinter', 'backstab'],
  heavy: ['meteorStrike', 'arsenal', 'bulwark', 'suppression', 'bigBlast', 'shredder', 'concussion', 'taunt', 'steadfast', 'reactive', 'slam', 'intimidate', 'overwatch', 'charge'],
  sniper: ['farSight', 'steady', 'mark', 'elusive', 'kneecap', 'headshot', 'doubleTap', 'assassinate', 'slayer', 'hollowPoint', 'volley', 'decoy', 'blink', 'longshot', 'tranq', 'charged', 'relocate'],
  engineer: ['deployMech', 'titan', 'swarm', 'launcher', 'hardlight', 'plating', 'rebuild', 'servos', 'detonate', 'spotter', 'linked', 'hive', 'shock', 'emp'],
  support: ['healingLight', 'fieldKit', 'inspire', 'barrier', 'flashbang', 'surgeon', 'revive', 'vitality', 'haste', 'drone', 'forceField', 'ward', 'bane', 'gravBeam', 'nullifier'],
  pyro: ['fireball', 'tanks', 'tinder', 'fireSuit', 'firewall', 'inferno', 'backdraft', 'asbestos', 'searing', 'flashpoint', 'smolder', 'burningAura', 'phoenixHeart', 'blastWave', 'blinding', 'afterburner'],
  phantom: ['cloak', 'shadowStrike', 'vanish', 'daze', 'deepCloak', 'afterimage', 'knifeWork', 'phaseShift', 'fadeOut', 'shadowStep', 'garrote', 'smokeBomb'],
  cryo: ['chillTouch', 'icebreak', 'permafrost', 'iceArmor', 'frostbreak', 'coldSteel', 'deepFreeze', 'avalanche', 'rimeLock', 'coldEye', 'longRange', 'frostAura', 'cryostasis', 'glide'],
}

/** A class's roots: the skills open from the first pick, its ability first. */
export const roots = (cls: ClassId) => TREES[cls].filter((id) => !SKILLS[id].after)
