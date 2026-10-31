// Skills: each class's tree, and what each skill does.
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
import type { ClassId } from './classes'
import type { Keyword } from './keywords'

/**
 * What a skill is for: keeping its soldier or squad alive, holding the aliens back or moving them, or hitting harder
 * and more often. Each level offers one of each, so every class can always choose to guard or to control.
 */
export type Role = 'guard' | 'control' | 'power'

/**
 * Something a soldier learns on gaining a level, from its class's tree. It changes stats, adds uses of the class
 * ability, or gives an effect that combat applies; `text` says which. A skill with `after` opens once the soldier knows
 * any of those; one without is a root, which a recruit may arrive knowing.
 */
export interface Skill {
  name: string
  text: string
  role: Role
  tags?: Keyword[]
  stats?: Partial<Stats>
  /** Added to the uses of the class ability each battle. */
  charges?: number
  effect?: Effect
  after?: string[]
}

const skills = {
  // Assault
  bloodlust: { name: 'Bloodlust', role: 'power', tags: ['kill'], text: 'A kill grants one more attack', effect: 'frenzy' },
  reflexes: { name: 'Reflexes', role: 'guard', text: 'One hit in four against it misses instead', effect: 'dodge' },
  leap: { name: 'Heroic Leap', role: 'control', text: `Once per battle, leaps onto the thickest knot of aliens within twice its move: ${LEAP_DAMAGE} damage to each alien beside where it lands, and they are rooted`, effect: 'leap' },
  rage: { name: 'Rage', role: 'power', text: '+2 damage while at half health or less', effect: 'rage', after: ['bloodlust'] },
  cleave: { name: 'Cleave', role: 'power', tags: ['kill'], text: 'A kill does 2 damage to every alien beside the one killed', effect: 'cleave', after: ['bloodlust'] },
  surge: { name: 'Action Surge', role: 'power', text: 'Once per battle, it attacks once more in a turn', effect: 'surge', after: ['bloodlust', 'rage'] },
  reckless: { name: 'Reckless Attack', role: 'power', text: '+20% aim, and aliens have +20% aim against it', effect: 'reckless', after: ['rage'] },
  skirmish: { name: 'Skirmisher', role: 'guard', text: 'After it acts, it moves up to 2 tiles to where the aliens have the worst shot at it', effect: 'skirmish', after: ['reflexes'] },
  secondWind: { name: 'Second Wind', role: 'guard', text: 'Once per battle, at half health or less, it heals 5 and still attacks', effect: 'secondWind', after: ['reflexes'] },
  unbreakable: { name: 'Unbreakable', role: 'guard', text: 'Once per battle, survives a killing hit at 1 health', effect: 'lastStand', after: ['reflexes', 'secondWind'] },
  hurl: { name: 'Hurl', role: 'control', text: `A hit on an alien beside it throws the alien ${HURL_TILES} tiles back; whatever stops it, wall or alien, it slams into for ${HURL_DAMAGE} damage`, effect: 'hurl', after: ['leap'] },
  hamstring: { name: 'Hamstring', role: 'control', text: 'Its hits root the target: it cannot move on its next turn', effect: 'snare', after: ['leap'] },
  sprinter: { name: 'Sprinter', role: 'power', text: '+2 move', stats: { move: 2 }, after: ['leap', 'skirmish'] },
  backstab: { name: 'Backstab', role: 'power', text: '+2 damage to a target with no cover against the attack', effect: 'backstab', after: ['skirmish', 'sprinter'] },
  // Heavy
  arsenal: { name: 'Arsenal', role: 'power', text: 'One more rocket each battle', charges: 1 },
  bulwark: { name: 'Bulwark', role: 'guard', tags: ['ward'], text: 'Squadmates within 2 tiles are 10% harder to hit', effect: 'bulwark' },
  suppression: { name: 'Suppression', role: 'control', text: 'A target it hits has -25% aim on its next turn', effect: 'suppress' },
  bigBlast: { name: 'Cluster Rocket', role: 'power', text: 'Its rockets blast 2 tiles around where they land', effect: 'bigBlast', after: ['arsenal'] },
  shredder: { name: 'Shredder', role: 'power', tags: ['ward'], text: "A hit destroys all the target's armor before it does damage", effect: 'shred', after: ['arsenal'] },
  concussion: { name: 'Concussive Rounds', role: 'control', tags: ['crit'], text: 'A crit stuns the target: it loses its next action', effect: 'concussion', after: ['arsenal', 'suppression'] },
  taunt: { name: 'Taunt', role: 'guard', text: 'An alien that can shoot it must shoot it', effect: 'taunt', after: ['bulwark'] },
  steadfast: { name: 'Steadfast', role: 'guard', text: 'It cannot be panicked, and acid and explosions do it no harm', effect: 'steadfast', after: ['bulwark'] },
  reactive: { name: 'Reactive Armor', role: 'guard', tags: ['ward'], text: '+4 armor', stats: { armor: 4 }, after: ['bulwark', 'taunt'] },
  slam: { name: 'Ground Slam', role: 'control', text: `Once per battle, with two or more aliens beside it, in place of an attack: ${SLAM_HIT} damage to each, hurling them ${SLAM_TILES} tiles back`, effect: 'slam', after: ['suppression'] },
  intimidate: { name: 'Intimidate', role: 'control', text: `Once per battle, with two or more aliens within ${STUN_REACH} tiles, it roars: each is stunned and loses its next action; a boss stands firm`, effect: 'warcry', after: ['suppression', 'taunt'] },
  overwatch: { name: 'Overwatch', role: 'power', text: 'Attacks an alien that moves in its sights on the alien turn', effect: 'overwatch', after: ['steadfast', 'suppression'] },
  charge: { name: 'Bull Rush', role: 'control', text: `Once per battle, charges onto the thickest knot of aliens within twice its move: ${LEAP_DAMAGE} damage to each alien beside where it lands, and they are rooted`, effect: 'leap', after: ['slam'] },
  // Sniper
  steady: { name: 'Steady Aim', role: 'power', text: 'If it did not move this turn, it rolls twice to hit and takes the better', effect: 'steady' },
  mark: { name: "Hunter's Mark", role: 'power', tags: ['mark'], text: `A target it hits is marked: every later hit on it does ${TUNING.markDamage} more damage`, effect: 'mark' },
  elusive: { name: 'Elusive', role: 'guard', text: 'Aliens more than 4 tiles away cannot shoot it', effect: 'elusive' },
  kneecap: { name: 'Kneecap', role: 'control', text: 'Its hits root the target: it cannot move on its next turn', effect: 'snare' },
  headshot: { name: 'Headshot', role: 'power', tags: ['crit'], text: 'Crits do 2 more damage', effect: 'headshot', after: ['steady'] },
  doubleTap: { name: 'Double Tap', role: 'power', text: 'If it did not move this turn, it attacks a third time', effect: 'doubleTap', after: ['steady'] },
  assassinate: { name: 'Assassinate', role: 'power', tags: ['crit'], text: 'A hit on a target at full health is a crit', effect: 'assassinate', after: ['steady', 'headshot'] },
  slayer: { name: 'Colossus Slayer', role: 'power', text: '+2 damage to a target already wounded', effect: 'slayer', after: ['mark'] },
  hollowPoint: { name: 'Piercing Rounds', role: 'power', text: "Its shots ignore the target's cover", effect: 'pierce', after: ['mark'] },
  volley: { name: 'Volley', role: 'power', text: 'A hit also does half its damage to every alien beside the target', effect: 'volley', after: ['mark', 'slayer'] },
  decoy: { name: 'Decoy', role: 'guard', text: 'Begins each battle with 2 holograms of itself; each hit on it has a 50% chance to pop one instead', effect: 'mirror', after: ['elusive'] },
  blink: { name: 'Blink', role: 'guard', text: 'Once per battle, when hit to half health or less, it blinks to the safest tile within 5', effect: 'blink', after: ['elusive'] },
  relocate: { name: 'Relocate', role: 'guard', text: 'After it acts, it moves up to 2 tiles to where the aliens have the worst shot at it', effect: 'skirmish', after: ['elusive', 'blink'] },
  longshot: { name: 'Longshot', role: 'power', text: '+2 range', stats: { range: 2 }, after: ['elusive', 'steady'] },
  tranq: { name: 'Tranquilizer Dart', role: 'control', text: 'Once per battle, the toughest alien it can shoot, a boss aside, falls asleep and loses its next action', effect: 'polymorph', after: ['kneecap'] },
  charged: { name: 'Charged Rounds', role: 'control', text: 'Its hits charge the target: if it moves on its next turn, it takes 3 damage', effect: 'booming', after: ['kneecap'] },
  // Engineer
  titan: { name: 'Titan Frame', role: 'guard', text: `Its mech has +${TITAN_HEALTH} health and +1 damage`, effect: 'titan' },
  swarm: { name: 'Drone Swarm', role: 'power', text: `Deploys two light drones in place of a mech: ${DRONE_STATS.hp} health and ${DRONE_STATS.damage} damage each, +2 move, and the aliens are free to ignore them`, effect: 'swarm' },
  launcher: { name: 'Caltrop Launcher', role: 'control', text: 'Once per battle, strews caltrops across the path of an alien closing in; each tile costs 2 more move to cross and hurts an alien 1', effect: 'caltrops' },
  hardlight: { name: 'Hardlight Barrier', role: 'guard', tags: ['ward'], text: 'Absorbs the first hit each battle', effect: 'shield' },
  plating: { name: 'Reactive Plating', role: 'guard', tags: ['ward'], text: `Its mech has +${PLATING_ARMOR} armor`, effect: 'plating', after: ['titan'] },
  rebuild: { name: 'Field Rebuild', role: 'guard', text: 'One more deploy each battle', charges: 1, after: ['titan', 'swarm'] },
  servos: { name: 'Overclocked Servos', role: 'power', text: 'Its machines have +2 move and +15% aim', effect: 'servos', after: ['titan', 'swarm'] },
  detonate: { name: 'Self-Destruct', role: 'power', text: 'A destroyed mech of its explodes for 4 damage on every alien beside it', effect: 'detonate', after: ['titan', 'plating'] },
  spotter: { name: 'Spotter Drones', role: 'power', tags: ['mark'], text: 'A target its drones hit is marked', effect: 'spotter', after: ['swarm'] },
  linked: { name: 'Linked Targeting', role: 'power', text: 'Squadmates within 2 tiles of one of its machines have +10% aim', effect: 'linked', after: ['swarm'] },
  hive: { name: 'Hive Mind', role: 'power', text: 'Deploys a third drone', effect: 'hive', after: ['swarm'] },
  shock: { name: 'Shock Prongs', role: 'control', text: 'A target its machines hit is rooted: it cannot move on its next turn', effect: 'shock', after: ['swarm', 'launcher'] },
  emp: { name: 'EMP Pulse', role: 'control', text: `Once per battle, with two or more aliens within ${STUN_REACH} tiles of it or its machines, it pulses: each is stunned and loses its next action; a boss stands firm`, effect: 'emp', after: ['launcher'] },
  // Support
  fieldKit: { name: 'Field Kit', role: 'power', text: 'Two more heals each battle', charges: 2 },
  inspire: { name: 'Inspire', role: 'power', text: 'Squadmates within 2 tiles have +10% aim', effect: 'inspire' },
  barrier: { name: 'Barrier Projector', role: 'guard', tags: ['ward'], text: 'Every squadmate starts each battle with 2 more armor', effect: 'barrier' },
  flashbang: { name: 'Flashbang', role: 'control', text: 'Once per battle, throws a flashbang at two or more aliens standing together it can attack: each is stunned and loses its next action; a boss stands firm', effect: 'flashbang' },
  surgeon: { name: 'Surgeon', role: 'power', text: 'Its heals restore 3 more health', effect: 'surgeon', after: ['fieldKit'] },
  revive: { name: 'Revive', role: 'guard', text: 'Once per battle, a squadmate who falls within 3 tiles gets up with 3 health', effect: 'revive', after: ['fieldKit'] },
  vitality: { name: 'Aura of Vitality', role: 'guard', text: 'At the start of its turn, each wounded squadmate within 2 tiles heals 1', effect: 'vitality', after: ['fieldKit', 'surgeon'] },
  haste: { name: 'Haste', role: 'power', text: 'Squadmates within 2 tiles have +2 move', effect: 'haste', after: ['inspire'] },
  drone: { name: 'Combat Drone', role: 'power', text: 'After it acts, its drone does 2 damage to the nearest alien in sight within 5 tiles', effect: 'drone', after: ['inspire'] },
  forceField: { name: 'Force Field', role: 'guard', tags: ['ward'], text: `Once per battle, a soldier within ${FORCE_FIELD_REACH} tiles at half health or less gains ${FORCE_FIELD_ARMOR} armor`, effect: 'forceField', after: ['barrier', 'inspire'] },
  ward: { name: 'Ward', role: 'guard', text: 'It and squadmates within 2 tiles cannot be panicked, and acid does them no harm', effect: 'ward', after: ['barrier'] },
  bane: { name: 'Bane', role: 'guard', text: 'Aliens within 3 tiles of it have -10% aim', effect: 'bane', after: ['barrier'] },
  gravBeam: { name: 'Grav Beam', role: 'control', text: 'Its hits pull the target a tile toward it', effect: 'tether', after: ['flashbang'] },
  nullifier: { name: 'Nullifier', role: 'control', text: 'Aliens within 3 tiles of it cannot spit, panic, spawn or burst', effect: 'null', after: ['flashbang'] },
  // Pyro
  tanks: { name: 'Napalm Tanks', role: 'power', tags: ['burn'], text: 'One more napalm each battle', charges: 1 },
  tinder: { name: 'Incendiary Rounds', role: 'power', tags: ['burn'], text: 'Its hits set the target burning', effect: 'tinder' },
  fireSuit: { name: 'Fire Suit', role: 'guard', text: 'It cannot burn', effect: 'fireSuit' },
  firewall: { name: 'Firewall', role: 'control', tags: ['burn'], text: 'Once per battle, raises a wall of fire across the path of an alien closing in', effect: 'firewall' },
  inferno: { name: 'Inferno', role: 'power', tags: ['burn'], text: 'Its napalm spreads 2 tiles around where it lands', effect: 'inferno', after: ['tanks'] },
  backdraft: { name: 'Backdraft', role: 'power', tags: ['burn', 'kill'], text: 'An alien it kills while burning sets every alien beside it burning', effect: 'backdraft', after: ['tanks', 'tinder'] },
  asbestos: { name: 'Asbestos Coat', role: 'guard', text: '+3 health', stats: { hp: 3 }, after: ['tanks', 'fireSuit'] },
  searing: { name: 'Searing', role: 'power', tags: ['burn'], text: `+${SEARING_DAMAGE} damage to a burning target`, effect: 'searing', after: ['tinder'] },
  flashpoint: { name: 'Flashpoint', role: 'power', tags: ['crit'], text: '+15% crit', stats: { crit: 0.15 }, after: ['tinder'] },
  smolder: { name: 'Smolder', role: 'power', tags: ['burn'], text: `Its burns last ${LINGER_TURNS} more turns`, effect: 'smolder', after: ['tinder', 'firewall'] },
  burningAura: { name: 'Burning Aura', role: 'guard', text: 'Whoever hits it takes 1 damage', effect: 'thorns', after: ['fireSuit'] },
  phoenixHeart: { name: 'Phoenix Heart', role: 'guard', text: 'Heals 1 at the start of each turn', effect: 'regen', after: ['fireSuit'] },
  blastWave: { name: 'Blast Wave', role: 'control', text: 'Its hits knock the target a tile back; if something stops it, it slams into that for 1 damage', effect: 'thunder', after: ['firewall'] },
  blinding: { name: 'Blinding Flash', role: 'control', tags: ['crit'], text: 'A crit stuns the target: it loses its next action', effect: 'concussion', after: ['tinder', 'firewall'] },
  afterburner: { name: 'Afterburner', role: 'power', text: '+2 move', stats: { move: 2 }, after: ['firewall'] },
  // Cryo
  icebreak: { name: 'Icebreaker', role: 'power', tags: ['frost'], text: `+${SEARING_DAMAGE} damage to a chilled target`, effect: 'icebreak' },
  permafrost: { name: 'Permafrost', role: 'control', tags: ['frost'], text: `Its chills last ${LINGER_TURNS} more turns`, effect: 'permafrost' },
  iceArmor: { name: 'Ice Armor', role: 'guard', tags: ['ward'], text: '+3 armor', stats: { armor: 3 } },
  frostbreak: { name: 'Frostbite', role: 'power', tags: ['frost', 'ward'], text: 'Hits on a chilled target ignore its armor', effect: 'frostbreak', after: ['icebreak'] },
  coldSteel: { name: 'Cold Steel', role: 'power', text: '+1 damage', stats: { damage: 1 }, after: ['icebreak'] },
  deepFreeze: { name: 'Deep Freeze', role: 'control', tags: ['frost', 'crit'], text: 'A crit on a chilled alien freezes it solid: it loses its next action', effect: 'deepFreeze', after: ['icebreak', 'permafrost'] },
  avalanche: { name: 'Avalanche', role: 'control', tags: ['frost', 'kill'], text: 'An alien it kills while chilled chills every alien beside it', effect: 'avalanche', after: ['icebreak', 'deepFreeze'] },
  rimeLock: { name: 'Rime Lock', role: 'control', tags: ['frost'], text: 'An alien it chills is rooted too', effect: 'rimeLock', after: ['permafrost'] },
  coldEye: { name: 'Cold Eye', role: 'power', text: '+10% aim', stats: { aim: 0.1 }, after: ['permafrost'] },
  longRange: { name: 'Long Barrel', role: 'power', text: '+2 range', stats: { range: 2 }, after: ['permafrost', 'iceArmor'] },
  frostAura: { name: 'Frost Aura', role: 'guard', tags: ['frost'], text: 'Whoever hits it is chilled', effect: 'rime', after: ['iceArmor'] },
  glide: { name: 'Ice Glide', role: 'guard', text: 'After it acts, it slides up to 2 tiles to where the aliens have the worst shot at it', effect: 'skirmish', after: ['iceArmor'] },
  cryostasis: { name: 'Cryostasis', role: 'guard', text: 'Once per battle, survives a killing hit at 1 health', effect: 'lastStand', after: ['iceArmor'] },
  // Phantom
  shadowStrike: { name: 'Shadow Strike', role: 'power', text: `Its attack out of cloak does ${SHADOW_DAMAGE} more damage`, effect: 'shadowStrike' },
  vanish: { name: 'Vanish', role: 'guard', text: 'Once per battle, when hit to half health or less, it cloaks', effect: 'vanish' },
  daze: { name: 'Unseen Blade', role: 'control', text: 'A hit out of cloak stuns the target: it loses its next action; a boss stands firm', effect: 'daze' },
  deepCloak: { name: 'Deep Cloak', role: 'power', text: 'One more cloak each battle', charges: 1, after: ['shadowStrike'] },
  afterimage: { name: 'Afterimage', role: 'power', tags: ['kill'], text: 'A kill out of cloak cloaks it again', effect: 'afterimage', after: ['shadowStrike', 'deepCloak'] },
  knifeWork: { name: 'Knife Work', role: 'power', text: '+2 damage to a target with no cover against the attack', effect: 'backstab', after: ['shadowStrike'] },
  phaseShift: { name: 'Phase Shift', role: 'guard', text: 'One hit in four against it misses instead', effect: 'dodge', after: ['vanish'] },
  fadeOut: { name: 'Fade Out', role: 'guard', text: 'After it acts, it moves up to 2 tiles to where the aliens have the worst shot at it', effect: 'skirmish', after: ['vanish'] },
  shadowStep: { name: 'Shadow Step', role: 'power', text: '+2 move', stats: { move: 2 }, after: ['fadeOut', 'shadowStrike'] },
  garrote: { name: 'Garrote', role: 'control', text: 'Its hits root the target: it cannot move on its next turn', effect: 'snare', after: ['daze'] },
  smokeBomb: { name: 'Smoke Bomb', role: 'control', text: 'Once per battle, throws a smoke bomb at two or more aliens standing together it can attack: each is stunned and loses its next action; a boss stands firm', effect: 'flashbang', after: ['daze', 'vanish'] },
} satisfies Record<string, Skill>

export type SkillId = keyof typeof skills
export const SKILLS: Record<SkillId, Skill> = skills

/** Each class's tree: the skills its soldiers learn from, roots first. */
export const TREES: Record<ClassId, SkillId[]> = {
  assault: ['bloodlust', 'reflexes', 'leap', 'rage', 'cleave', 'surge', 'reckless', 'skirmish', 'secondWind', 'unbreakable', 'hurl', 'hamstring', 'sprinter', 'backstab'],
  heavy: ['arsenal', 'bulwark', 'suppression', 'bigBlast', 'shredder', 'concussion', 'taunt', 'steadfast', 'reactive', 'slam', 'intimidate', 'overwatch', 'charge'],
  sniper: ['steady', 'mark', 'elusive', 'kneecap', 'headshot', 'doubleTap', 'assassinate', 'slayer', 'hollowPoint', 'volley', 'decoy', 'blink', 'longshot', 'tranq', 'charged', 'relocate'],
  engineer: ['titan', 'swarm', 'launcher', 'hardlight', 'plating', 'rebuild', 'servos', 'detonate', 'spotter', 'linked', 'hive', 'shock', 'emp'],
  support: ['fieldKit', 'inspire', 'barrier', 'flashbang', 'surgeon', 'revive', 'vitality', 'haste', 'drone', 'forceField', 'ward', 'bane', 'gravBeam', 'nullifier'],
  pyro: ['tanks', 'tinder', 'fireSuit', 'firewall', 'inferno', 'backdraft', 'asbestos', 'searing', 'flashpoint', 'smolder', 'burningAura', 'phoenixHeart', 'blastWave', 'blinding', 'afterburner'],
  phantom: ['shadowStrike', 'vanish', 'daze', 'deepCloak', 'afterimage', 'knifeWork', 'phaseShift', 'fadeOut', 'shadowStep', 'garrote', 'smokeBomb'],
  cryo: ['icebreak', 'permafrost', 'iceArmor', 'frostbreak', 'coldSteel', 'deepFreeze', 'avalanche', 'rimeLock', 'coldEye', 'longRange', 'frostAura', 'cryostasis', 'glide'],
}

/** A class's roots: the skills a recruit may arrive knowing. */
export const roots = (cls: ClassId) => TREES[cls].filter((id) => !SKILLS[id].after)
