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
import { ABLAZE, BLIZZARD, BULLET_TIME, COLOSSUS, DRONE_STORM, EXTINCTION, HAIL, INDESTRUCTIBLE, LEGION, LEVEL_BLOCK, MIRRORS, ORBITAL, QUAKE, SENTENCE, SHIELD_TURNS, SPREE, SUPERNOVA, TIME_STOP, TITAN_FORM, ZERO } from './ultimates'
import { PHOENIX_RISING } from './wound'
import { AFTERSHOCK_DAMAGE, BLOODBATH_HEAL, CONFLAGRATION_DAMAGE, EARTHSHAKER_DAMAGE, FAN_TARGETS, FONT_REACH, HELLFIRE_REACH, IMPACT_DAMAGE, SACRED_REACH, SHARD_DAMAGE, SWARM_BUILDS, SWARM_LIMIT, TESLA, WAR_MACHINE } from './keystones'
import { TUNING } from './tuning'
import { classPower, CLASSES, type ClassId } from './classes'
import type { Keyword } from './keywords'
import type { Power } from './powers'

/**
 * Something a hero learns on gaining a level, from its class's tree. It changes stats, adds uses of the class
 * ability, or gives an effect that combat applies; `text` says which. One that `teaches` gives the hero its class's ability.
 */
export interface Skill extends Power {
  tags?: Keyword[]
  stats?: Partial<Stats>
  /** Added to the uses of the class ability each battle. */
  charges?: number
  effect?: Effect
  teaches?: true
}

/** A way a class can grow: giving up the others is the choice. */
export interface Branch {
  name: string
  tiers: SkillId[][]
}

/** What a stunned alien loses. */
const stun = 'loses its next action'

/** A class's ability as a skill to learn. */
const taught = (cls: ClassId) => ({ ...classPower(CLASSES[cls], CLASSES[cls].charges), teaches: true as const })

const skills = {
  // Assault
  mightyBound: taught('assault'),
  bloodlust: { name: 'Bloodlust', use: 'Reaction', tags: ['kill'], text: 'A kill grants one more attack with its weapon', effect: 'frenzy' },
  reflexes: { name: 'Reflexes', use: 'Passive', text: 'Takes 1 less damage from each hit', effect: 'dodge' },
  leap: { name: 'Heroic Leap', use: '1/battle', range: '2× move', target: 'Thickest knot', text: `${LEAP_DAMAGE} damage to each alien beside where it lands, and roots them`, effect: 'leap' },
  rage: { name: 'Rage', use: 'Passive', text: '+2 damage at half HP or less', effect: 'rage' },
  cleave: { name: 'Cleave', use: 'Reaction', tags: ['kill'], text: 'A kill does 2 damage to every alien beside the one killed', effect: 'cleave' },
  surge: { name: 'Action Surge', use: '1/battle', text: 'One more attack with its weapon in a turn', effect: 'surge' },
  skirmish: { name: 'Skirmisher', use: 'Reaction', text: 'After it acts, moves up to 2 tiles away from the aliens', effect: 'skirmish' },
  secondWind: { name: 'Second Wind', use: '1/battle', target: 'Self', text: 'At half HP or less, heals 5 and still attacks', effect: 'secondWind' },
  unbreakable: { name: 'Unbreakable', use: '1/battle', target: 'Self', text: 'Survives a killing hit at 1 HP', effect: 'lastStand' },
  hurl: { name: 'Hurl', use: 'At will', target: 'Creature hit', text: `Thrown ${HURL_TILES} tiles back; ${HURL_DAMAGE} damage if a wall or alien stops it`, effect: 'hurl' },
  hamstring: { name: 'Crippling Blow', use: 'At will', target: 'Creature hit', text: 'Rooted: it cannot move on its next turn', effect: 'snare' },
  sprinter: { name: 'Super Speed', use: 'Passive', text: '+2 move', stats: { move: 2 } },
  bloodbath: { name: 'Bloodbath', use: 'Reaction', tags: ['kill'], text: `Each kill heals ${BLOODBATH_HEAL} and adds +1 damage for the rest of the battle`, effect: 'bloodbath' },
  riposte: { name: 'Riposte', use: 'Reaction', target: 'Whoever hits it', text: 'Takes its damage back, each hit, at any range', effect: 'riposte' },
  earthshaker: { name: 'Earthshaker', use: 'Passive', text: `Heroic Leap is at will and does ${EARTHSHAKER_DAMAGE} more damage`, effect: 'earthshaker' },
  // Heavy
  meteorStrike: taught('heavy'),
  arsenal: { name: 'Second Meteor', use: 'Passive', text: 'One more Meteor Strike each battle', charges: 1 },
  bulwark: { name: 'Bulwark', use: 'Aura', range: '2', target: 'Allies', tags: ['ward'], text: 'Take 1 less damage from each hit', effect: 'bulwark' },
  suppression: { name: 'Staggering Blow', use: 'At will', target: 'Creature hit', text: 'It does 1 less damage on its next turn', effect: 'suppress' },
  bigBlast: { name: 'Greater Meteor', use: 'Passive', text: 'Meteor Strike blasts 2 tiles around where it lands', effect: 'bigBlast' },
  shredder: { name: 'Sundering Blow', use: 'At will', target: 'Creature hit', tags: ['ward'], text: 'Destroys all its armor before doing damage', effect: 'shred' },
  concussion: { name: 'Concussive Blows', use: 'Reaction', target: 'Creature crit', tags: ['crit'], text: `Stunned: it ${stun}`, effect: 'concussion' },
  taunt: { name: 'Taunt', use: 'Passive', text: 'An alien that can shoot it must shoot it', effect: 'taunt' },
  steadfast: { name: 'Steadfast', use: 'Passive', text: 'Cannot be panicked; acid and explosions do it no harm', effect: 'steadfast' },
  reactive: { name: 'Stone Skin', use: 'Passive', tags: ['ward'], text: '+4 armor', stats: { armor: 4 } },
  slam: { name: 'Ground Slam', use: '1/battle', range: 'Adjacent', target: '2+ aliens', text: `Replaces an attack. ${SLAM_HIT} damage to each, hurled ${SLAM_TILES} tiles back`, effect: 'slam' },
  intimidate: { name: 'Terrifying Roar', use: '1/battle', range: `${STUN_REACH}`, target: '2+ aliens', text: `Each ${stun}; a boss stands firm`, effect: 'warcry' },
  impact: { name: 'Impact', use: 'Passive', text: `Meteor Strike does ${IMPACT_DAMAGE} more damage and falls on a lone alien too`, effect: 'impact' },
  fortress: { name: 'Fortress', use: 'Passive', tags: ['ward'], text: 'Takes half damage from every hit', effect: 'fortress' },
  aftershock: { name: 'Aftershock', use: 'At will', target: 'Beside creature hit', text: `${AFTERSHOCK_DAMAGE} damage to each`, effect: 'aftershock' },
  // Sniper
  farSight: taught('sniper'),
  steady: { name: 'Steady Hands', use: 'Passive', text: '+1 damage if it did not move this turn', effect: 'steady' },
  mark: { name: "Hunter's Mark", use: 'At will', target: 'Creature hit', tags: ['mark'], text: `Marked: every later hit on it does ${TUNING.markDamage} more damage`, effect: 'mark' },
  elusive: { name: 'Elusive', use: 'Passive', text: 'Aliens more than 4 tiles away cannot shoot it', effect: 'elusive' },
  kneecap: { name: 'Pinning Shot', use: 'At will', target: 'Creature hit', text: 'Rooted: it cannot move on its next turn', effect: 'snare' },
  headshot: { name: 'Headshot', use: 'Passive', tags: ['crit'], text: 'Crits do 2 more damage', effect: 'headshot' },
  doubleTap: { name: 'Double Tap', use: 'Passive', text: 'A third attack with its weapon if it did not move this turn', effect: 'doubleTap' },
  assassinate: { name: 'Assassinate', use: 'Passive', tags: ['crit'], text: 'A hit on a target at full HP is a crit', effect: 'assassinate' },
  slayer: { name: 'Colossus Slayer', use: 'Passive', text: '+2 damage to a target already wounded', effect: 'slayer' },
  hollowPoint: { name: 'Piercing Blows', use: 'Passive', text: 'Its attacks ignore armor', effect: 'pierce' },
  volley: { name: 'Volley', use: 'At will', target: 'Beside creature hit', text: "Half the hit's damage to each", effect: 'volley' },
  decoy: { name: 'Mirror Image', use: 'Passive', text: 'Starts each battle with 2 images; each of the first 2 hits pops one instead', effect: 'mirror' },
  blink: { name: 'Blink', use: '1/battle', range: '5', target: 'Self', text: 'Hit to half HP or less: blinks to the safest tile', effect: 'blink' },
  relocate: { name: 'Relocate', use: 'Reaction', text: 'After it acts, moves up to 2 tiles away from the aliens', effect: 'skirmish' },
  sureShot: { name: 'Sure Shot', use: 'Passive', tags: ['crit'], text: 'Every hit is a crit if it did not move this turn', effect: 'sureShot' },
  apex: { name: 'Apex Predator', use: 'At will', target: 'Creature hit', tags: ['mark', 'crit'], text: 'Marked; every hit on a marked alien is a crit', effect: 'apex' },
  ghostShot: { name: 'Ghost Shot', use: 'Passive', text: 'Its attacks pass through walls and ignore armor', effect: 'psionic' },
  // Engineer
  deployMech: taught('engineer'),
  titan: { name: 'Titan Frame', use: 'Passive', text: `Its mech has +${TITAN_HEALTH} HP and +1 damage`, effect: 'titan' },
  swarm: { name: 'Drone Swarm', use: 'Passive', text: `Deploys two drones in place of a mech: ${DRONE_STATS.hp} HP, ${DRONE_STATS.damage} damage, +2 move; aliens may ignore them`, effect: 'swarm', teaches: true },
  launcher: { name: 'Caltrop Launcher', use: '1/battle', target: 'Path of an alien', text: 'Each tile costs 2 more move to cross and hurts an alien 1', effect: 'caltrops' },
  hardlight: { name: 'Hardlight Barrier', use: 'Reaction', target: 'Self', tags: ['ward'], text: 'Absorbs the first hit each battle', effect: 'shield' },
  plating: { name: 'Reactive Plating', use: 'Passive', tags: ['ward'], text: `Its mech has +${PLATING_ARMOR} armor`, effect: 'plating' },
  rebuild: { name: 'Field Rebuild', use: 'Passive', text: 'One more deploy each battle', charges: 1 },
  servos: { name: 'Overclocked Servos', use: 'Passive', text: 'Its machines have +2 move and +1 damage', effect: 'servos' },
  detonate: { name: 'Self-Destruct', use: 'Reaction', target: 'Beside its mech', text: 'When destroyed, the mech does 4 damage to each', effect: 'detonate' },
  spotter: { name: 'Spotter Drones', use: 'At will', target: 'Hit by drones', tags: ['mark'], text: 'Marked', effect: 'spotter' },
  linked: { name: 'Linked Targeting', use: 'Aura', range: '2 of a machine', target: 'Allies', text: '+1 damage', effect: 'linked' },
  hive: { name: 'Hive Mind', use: 'Passive', text: 'Deploys a third drone', effect: 'hive' },
  emp: { name: 'EMP Pulse', use: '1/battle', range: `${STUN_REACH} of it or machines`, target: '2+ aliens', text: `Each ${stun}; a boss stands firm`, effect: 'emp' },
  warMachine: { name: 'War Machine', use: 'Passive', text: `Its mech has +${WAR_MACHINE.hp} HP, +${WAR_MACHINE.damage} damage and +${WAR_MACHINE.range} range`, effect: 'warMachine' },
  endlessSwarm: { name: 'Endless Swarm', use: 'Passive', text: `With aliens in sight, a new drone each turn, up to ${SWARM_LIMIT} at once and ${SWARM_BUILDS} a battle`, effect: 'endlessSwarm' },
  tesla: { name: 'Tesla Coil', use: 'Reaction', range: `${TESLA.reach}`, target: `${TESLA.bolts} nearest aliens`, text: `After it acts, ${TESLA.damage} damage to each`, effect: 'tesla' },
  // Support
  healingLight: taught('support'),
  fieldKit: { name: 'Deep Wellspring', use: 'Passive', text: 'Two more Healing Lights each battle', charges: 2 },
  inspire: { name: 'Inspire', use: 'Aura', range: '2', target: 'Allies', text: '+1 damage', effect: 'inspire' },
  barrier: { name: 'Shield of Faith', use: 'Passive', target: 'All allies', tags: ['ward'], text: 'Start each battle with 2 more armor', effect: 'barrier' },
  flashbang: { name: 'Blinding Light', use: '1/battle', range: 'Attack range', target: '2+ aliens together', text: `Each ${stun}; a boss stands firm`, effect: 'flashbang' },
  surgeon: { name: 'Greater Healing', use: 'Passive', text: 'Healing Light restores 3 more HP', effect: 'surgeon' },
  revive: { name: 'Revivify', use: '1/battle', range: '3', target: 'Falling ally', text: 'Gets up with 3 HP', effect: 'revive' },
  vitality: { name: 'Aura of Vitality', use: 'Aura', range: '2', target: 'Wounded allies', text: 'Heal 1 at the start of its turn', effect: 'vitality' },
  haste: { name: 'Haste', use: 'Aura', range: '2', target: 'Allies', text: '+2 move', effect: 'haste' },
  drone: { name: 'Spirit Guardian', use: 'Reaction', range: '5', target: 'Nearest alien in sight', text: 'After it acts, 2 damage', effect: 'drone' },
  forceField: { name: 'Sanctuary', use: '1/battle', range: `${FORCE_FIELD_REACH}`, target: 'Ally at half HP', tags: ['ward'], text: `Gains ${FORCE_FIELD_ARMOR} armor`, effect: 'forceField' },
  ward: { name: 'Aura of Courage', use: 'Aura', range: '2', target: 'It and allies', text: 'Cannot be panicked; acid does them no harm', effect: 'ward' },
  bane: { name: 'Bane', use: 'Aura', range: '3', target: 'Aliens', text: 'Do 1 less damage', effect: 'bane' },
  gravBeam: { name: 'Gravity Lash', use: 'At will', target: 'Creature hit', text: 'Pulled a tile toward it', effect: 'tether' },
  nullifier: { name: 'Silence', use: 'Aura', range: '3', target: 'Aliens', text: 'Cannot spit, panic, spawn or burst', effect: 'null' },
  fontOfLife: { name: 'Font of Life', use: 'Passive', range: `${FONT_REACH}`, target: 'Every wounded ally', text: 'Healing Light heals them all, once one is at half HP or two are hurt', effect: 'fontOfLife' },
  sacredGround: { name: 'Sacred Ground', use: 'Aura', range: `${SACRED_REACH}`, target: 'It and allies', tags: ['ward'], text: 'Take half damage from every hit', effect: 'sacredGround' },
  command: { name: 'Command', use: 'Reaction', target: 'Hardest-hitting ally with a shot', text: 'After it acts, that ally attacks with its weapon', effect: 'command' },
  // Pyro
  fireball: taught('pyro'),
  tanks: { name: 'Deep Flame', use: 'Passive', tags: ['burn'], text: 'One more Fireball each battle', charges: 1 },
  tinder: { name: 'Flame Blade', use: 'At will', target: 'Creature hit', tags: ['burn'], text: 'Set burning', effect: 'tinder' },
  fireSuit: { name: 'Flameborn', use: 'Passive', text: 'It cannot burn', effect: 'fireSuit' },
  inferno: { name: 'Inferno', use: 'Passive', tags: ['burn'], text: 'Fireball spreads 2 tiles around where it lands', effect: 'inferno' },
  backdraft: { name: 'Backdraft', use: 'Reaction', target: 'Beside its burning kill', tags: ['burn', 'kill'], text: 'Set burning', effect: 'backdraft' },
  asbestos: { name: 'Hide of Cinders', use: 'Passive', text: '+3 HP', stats: { hp: 3 } },
  searing: { name: 'Searing', use: 'Passive', tags: ['burn'], text: `+${SEARING_DAMAGE} damage to a burning target`, effect: 'searing' },
  flashpoint: { name: 'Flashpoint', use: 'Passive', tags: ['crit'], text: '+15% crit', stats: { crit: 0.15 } },
  smolder: { name: 'Smolder', use: 'Passive', tags: ['burn'], text: `Its burns last ${LINGER_TURNS} more turns`, effect: 'smolder' },
  burningAura: { name: 'Fire Shield', use: 'Reaction', target: 'Whoever hits it', text: 'Takes 1 damage', effect: 'thorns' },
  phoenixHeart: { name: 'Phoenix Heart', use: 'Passive', text: 'Heals 1 at the start of each turn', effect: 'regen' },
  firestorm: { name: 'Firestorm', use: 'Passive', tags: ['burn', 'kill'], text: 'A Fireball that kills gives its use back', effect: 'firestorm' },
  conflagration: { name: 'Conflagration', use: 'Passive', tags: ['burn'], text: `Aliens burning take ${CONFLAGRATION_DAMAGE} more each turn, and set those beside them burning`, effect: 'conflagration' },
  hellfire: { name: 'Hellfire', use: 'Aura', range: `${HELLFIRE_REACH}`, target: 'Aliens', tags: ['burn'], text: 'Set burning at the start of each of their turns', effect: 'hellfire' },
  // Cryo
  chillTouch: taught('cryo'),
  icebreak: { name: 'Icebreaker', use: 'Passive', tags: ['frost'], text: `+${SEARING_DAMAGE} damage to a chilled target`, effect: 'icebreak' },
  permafrost: { name: 'Permafrost', use: 'Passive', tags: ['frost'], text: `Its chills last ${LINGER_TURNS} more turns`, effect: 'permafrost' },
  iceArmor: { name: 'Ice Armor', use: 'Passive', tags: ['ward'], text: '+3 armor', stats: { armor: 3 } },
  coldSteel: { name: 'Cold Steel', use: 'Passive', text: '+1 damage', stats: { damage: 1 } },
  deepFreeze: { name: 'Deep Freeze', use: 'Reaction', target: 'Chilled alien crit', tags: ['frost', 'crit'], text: `Frozen solid: it ${stun}`, effect: 'deepFreeze' },
  rimeLock: { name: 'Rime Lock', use: 'At will', target: 'Alien it chills', tags: ['frost'], text: 'Rooted too', effect: 'rimeLock' },
  coldEye: { name: 'Cold Eye', use: 'Passive', text: '+15% crit', stats: { crit: 0.15 } },
  longRange: { name: 'Long Throw', use: 'Passive', text: 'Bonus attack reaches 2 tiles farther', effect: 'longshot' },
  frostAura: { name: 'Frost Aura', use: 'Reaction', target: 'Whoever hits it', tags: ['frost'], text: 'Chilled', effect: 'rime' },
  glide: { name: 'Ice Glide', use: 'Reaction', text: 'After it acts, slides up to 2 tiles away from the aliens', effect: 'skirmish' },
  cryostasis: { name: 'Cryostasis', use: '1/battle', target: 'Self', text: 'Survives a killing hit at 1 HP', effect: 'lastStand' },
  frozenHeart: { name: 'Frozen Heart', use: 'At will', target: 'Chilled alien hit', tags: ['frost'], text: `Frozen solid: it ${stun}; a boss stands firm`, effect: 'frozenHeart' },
  glacialArmor: { name: 'Glacial Armor', use: 'Passive', tags: ['ward'], text: 'Its armor returns in full at the start of each of its turns', effect: 'glacialArmor' },
  shardstorm: { name: 'Shardstorm', use: 'At will', target: 'Beside creature hit', tags: ['frost'], text: `${SHARD_DAMAGE} damage to each, and chilled`, effect: 'shardstorm' },
  // Phantom
  cloak: taught('phantom'),
  shadowStrike: { name: 'Shadow Strike', use: 'Passive', text: `Its attack out of Cloak does ${SHADOW_DAMAGE} more damage`, effect: 'shadowStrike' },
  vanish: { name: 'Vanish', use: '1/battle', target: 'Self', text: 'Hit to half HP or less: it cloaks', effect: 'vanish' },
  daze: { name: 'Unseen Blade', use: 'At will', target: 'Creature hit out of Cloak', text: `Stunned: it ${stun}; a boss stands firm`, effect: 'daze' },
  deepCloak: { name: 'Deep Cloak', use: 'Passive', text: 'One more Cloak each battle', charges: 1 },
  afterimage: { name: 'Afterimage', use: 'Reaction', target: 'Self', tags: ['kill'], text: 'A kill out of Cloak cloaks it again', effect: 'afterimage' },
  knifeWork: { name: 'Knife Work', use: 'Passive', text: '+2 damage to a target with no alien beside it', effect: 'backstab' },
  phaseShift: { name: 'Phase Shift', use: 'Passive', text: 'Takes 1 less damage from each hit', effect: 'dodge' },
  fadeOut: { name: 'Fade Out', use: 'Reaction', text: 'After it acts, moves up to 2 tiles away from the aliens', effect: 'skirmish' },
  shadowStep: { name: 'Shadow Step', use: 'Passive', text: '+2 move', stats: { move: 2 } },
  garrote: { name: 'Shadow Grip', use: 'At will', target: 'Creature hit', text: 'Rooted: it cannot move on its next turn', effect: 'snare' },
  smokeBomb: { name: 'Darkness', use: '1/battle', range: 'Attack range', target: '2+ aliens together', text: `Each ${stun}; a boss stands firm`, effect: 'flashbang' },
  livingShadow: { name: 'Living Shadow', use: 'Passive', text: 'Attacking does not break its Cloak: every attack in it strikes from the dark', effect: 'livingShadow' },
  intangible: { name: 'Intangible', use: 'Passive', text: 'Half of the hits on it pass through', effect: 'intangible' },
  bladeDance: { name: 'Blade Dance', use: 'At will', text: `Its bonus attack also strikes ${FAN_TARGETS} more aliens in reach`, effect: 'bladeDance' },
  // Tier 4s, each once a battle
  killingSpree: { name: 'Killing Spree', use: '1/battle', range: `${SPREE.reach}`, target: `Up to ${SPREE.strikes} aliens in turn`, text: `Flashes to each and strikes for its damage +${SPREE.damage}`, effect: 'killingSpree' },
  indestructible: { name: 'Indestructible', use: '1/battle', target: 'Self at half HP', text: `Nothing can hurt it for ${INDESTRUCTIBLE.turns} turns; +${INDESTRUCTIBLE.damage} damage for the battle`, effect: 'indestructible' },
  levelBlock: { name: 'Level the Block', use: '1/battle', range: `${LEVEL_BLOCK.radius}`, target: '2+ aliens', text: `Everything standing in reach comes down; ${LEVEL_BLOCK.damage} damage to each alien`, effect: 'levelBlock' },
  extinction: { name: 'Extinction Event', use: '1/battle', target: `${EXTINCTION.meteors} meteors, thickest knots`, text: `Each does ${EXTINCTION.damage} to aliens within ${EXTINCTION.radius} and flattens the ground; allies are spared`, effect: 'extinction' },
  titanForm: { name: 'Titan Form', use: '1/battle', target: 'Self at half HP', text: `Grows to a titan: +${TITAN_FORM.hp} HP, full health, +${TITAN_FORM.armor} armor, +${TITAN_FORM.damage} damage, and Taunt, for the battle`, effect: 'titanForm' },
  earthquake: { name: 'Earthquake', use: '1/battle', range: `${QUAKE.radius}`, target: '2+ aliens', text: `${QUAKE.damage} damage to each; each loses its next turn, a boss too`, effect: 'earthquake' },
  bulletTime: { name: 'Bullet Time', use: '1/battle', target: `Up to ${BULLET_TIME.targets} aliens in sight`, text: `A crit on each, +${BULLET_TIME.damage} damage`, effect: 'bulletTime' },
  deathSentence: { name: 'Death Sentence', use: '1/battle', target: 'Toughest alien, boss or not', text: `Half its HP +${SENTENCE} damage, ignoring armor`, effect: 'deathSentence' },
  hallOfMirrors: { name: 'Hall of Mirrors', use: '1/battle', target: 'Self', text: `${MIRRORS.images} images of ${MIRRORS.hp} HP step out, attack and draw every alien's fire`, effect: 'hallOfMirrors' },
  colossus: { name: 'Colossus', use: '1/battle', target: 'Beside it', text: `Deploys a colossus: ${COLOSSUS.hp} HP, ${COLOSSUS.armor} armor, ${COLOSSUS.damage} damage; every alien able must shoot it`, effect: 'colossus' },
  droneStorm: { name: 'Drone Storm', use: '1/battle', target: 'Aliens in the fight', text: `${DRONE_STORM.strikes} strikes of ${DRONE_STORM.damage} damage rain among them`, effect: 'droneStorm' },
  orbital: { name: 'Orbital Lance', use: '1/battle', range: `Line of ${ORBITAL.length}`, target: 'The line through the most aliens', text: `${ORBITAL.damage} damage, ignoring armor; flattens all along it`, effect: 'orbital' },
  resurrection: { name: 'Resurrection', use: '1/battle', target: 'Every ally, fallen or not', text: 'The fallen rise beside it; all stand at full HP', effect: 'resurrection' },
  divineShield: { name: 'Divine Shield', use: '1/battle', target: 'Every ally, once one is at half HP', text: `Nothing can hurt them for ${SHIELD_TURNS} turns`, effect: 'divineShield' },
  timeStop: { name: 'Time Stop', use: '1/battle', target: 'Every alien, boss too', text: `Frozen in time for ${TIME_STOP} rounds`, effect: 'timeStop' },
  supernova: { name: 'Supernova', use: '1/battle', range: `${SUPERNOVA.radius}`, target: '2+ aliens', tags: ['burn'], text: `${SUPERNOVA.damage} damage to each, and burning; costs it half its HP`, effect: 'supernova' },
  worldAblaze: { name: 'World Ablaze', use: '1/battle', target: 'Every alien in the fight', tags: ['burn'], text: `Armor burns away; ${ABLAZE.damage} damage, burning for ${ABLAZE.burn} turns on burning ground`, effect: 'worldAblaze' },
  phoenixRising: { name: 'Phoenix Rising', use: '1/battle', range: `${PHOENIX_RISING.radius}`, target: 'Self, as it falls', tags: ['burn'], text: `Rises at full HP; ${PHOENIX_RISING.damage} damage to each alien in reach, and burning`, effect: 'phoenixRising' },
  absoluteZero: { name: 'Absolute Zero', use: '1/battle', target: 'Every alien in the fight', tags: ['frost'], text: `A wave of ice: ${ZERO.damage} damage past armor; frozen ${ZERO.frozen} rounds, a boss 1`, effect: 'absoluteZero' },
  blizzard: { name: 'Blizzard', use: '1/battle', range: `${BLIZZARD.radius}`, target: 'Aliens around it', tags: ['frost'], text: `For ${BLIZZARD.turns} turns, ${BLIZZARD.damage} damage to each and chilled, as it walks`, effect: 'blizzard' },
  hailOfIcicles: { name: 'Hail of Icicles', use: '1/battle', target: 'Aliens in the fight', tags: ['frost'], text: `${HAIL.shards} shards of ${HAIL.damage} damage rain among them, each chilling`, effect: 'hailOfIcicles' },
  eclipse: { name: 'Eclipse', use: '1/battle', target: 'Every hero', text: 'Darkness: each hero Cloaks, unseen until its attack strikes from the dark', effect: 'eclipse' },
  reap: { name: 'Reap', use: '1/battle', target: 'Every alien in the fight', text: 'Those at half HP or less die, a boss aside; the rest lose half their HP', effect: 'reap' },
  phantomLegion: { name: 'Phantom Legion', use: '1/battle', target: `${LEGION.blades} strikes in the fight`, text: `Shadows strike for its damage +${LEGION.damage}, ignoring armor`, effect: 'phantomLegion' },
} satisfies Record<string, Skill>

export type SkillId = keyof typeof skills
export const SKILLS: Record<SkillId, Skill> = skills

/** Each class's tree: its branches, each with its name and its skills by tier, lowest first. The first branch holds the class's ability. */
export const TREES: Record<ClassId, Branch[]> = {
  assault: [
    { name: 'Rampage', tiers: [['mightyBound', 'bloodlust'], ['rage', 'cleave', 'surge'], ['bloodbath'], ['killingSpree']] },
    { name: 'Ironhide', tiers: [['reflexes'], ['secondWind', 'skirmish', 'unbreakable'], ['riposte'], ['indestructible']] },
    { name: 'Juggernaut', tiers: [['leap'], ['hamstring', 'hurl', 'sprinter'], ['earthshaker'], ['levelBlock']] },
  ],
  heavy: [
    { name: 'Cataclysm', tiers: [['meteorStrike'], ['arsenal', 'shredder', 'bigBlast'], ['impact'], ['extinction']] },
    { name: 'Bastion', tiers: [['bulwark'], ['taunt', 'steadfast', 'reactive'], ['fortress'], ['titanForm']] },
    { name: 'Shockwave', tiers: [['suppression'], ['slam', 'concussion', 'intimidate'], ['aftershock'], ['earthquake']] },
  ],
  sniper: [
    { name: 'Marksman', tiers: [['farSight', 'steady'], ['headshot', 'doubleTap', 'assassinate'], ['sureShot'], ['bulletTime']] },
    { name: 'Hunter', tiers: [['mark', 'kneecap'], ['slayer', 'hollowPoint', 'volley'], ['apex'], ['deathSentence']] },
    { name: 'Ghost', tiers: [['elusive'], ['decoy', 'blink', 'relocate'], ['ghostShot'], ['hallOfMirrors']] },
  ],
  engineer: [
    { name: 'Mech Bay', tiers: [['deployMech'], ['titan', 'plating', 'rebuild', 'detonate'], ['warMachine'], ['colossus']] },
    { name: 'Drone Hive', tiers: [['swarm'], ['spotter', 'linked', 'servos', 'hive'], ['endlessSwarm'], ['droneStorm']] },
    { name: 'Tinker', tiers: [['launcher'], ['hardlight', 'emp'], ['tesla'], ['orbital']] },
  ],
  support: [
    { name: 'Mending', tiers: [['healingLight'], ['fieldKit', 'surgeon', 'vitality', 'revive'], ['fontOfLife'], ['resurrection']] },
    { name: 'Aegis', tiers: [['barrier'], ['ward', 'bane', 'forceField'], ['sacredGround'], ['divineShield']] },
    { name: 'Zeal', tiers: [['inspire', 'flashbang'], ['haste', 'drone', 'gravBeam', 'nullifier'], ['command'], ['timeStop']] },
  ],
  pyro: [
    { name: 'Inferno', tiers: [['fireball'], ['tanks', 'searing', 'inferno'], ['firestorm'], ['supernova']] },
    { name: 'Immolation', tiers: [['tinder'], ['flashpoint', 'smolder', 'backdraft'], ['conflagration'], ['worldAblaze']] },
    { name: 'Ember Hide', tiers: [['fireSuit'], ['burningAura', 'asbestos', 'phoenixHeart'], ['hellfire'], ['phoenixRising']] },
  ],
  cryo: [
    { name: 'Hoarfrost', tiers: [['chillTouch'], ['icebreak', 'permafrost', 'rimeLock', 'deepFreeze'], ['frozenHeart'], ['absoluteZero']] },
    { name: 'Glacier', tiers: [['iceArmor'], ['frostAura', 'glide', 'cryostasis'], ['glacialArmor'], ['blizzard']] },
    { name: 'Icicle', tiers: [['coldSteel'], ['coldEye', 'longRange'], ['shardstorm'], ['hailOfIcicles']] },
  ],
  phantom: [
    { name: 'Shade', tiers: [['cloak'], ['shadowStrike', 'daze', 'deepCloak', 'afterimage'], ['livingShadow'], ['eclipse']] },
    { name: 'Wraith', tiers: [['vanish'], ['phaseShift', 'fadeOut', 'shadowStep'], ['intangible'], ['reap']] },
    { name: 'Knives', tiers: [['knifeWork'], ['garrote', 'smokeBomb'], ['bladeDance'], ['phantomLegion']] },
  ],
}

/** Picks a hero must have made before a tier 3 skill opens; a tier 4 needs its tier 3. */
export const CAPSTONE_PICKS = 3

/** A skill of `tiers` is open at tier 1; above, once the hero knows one of the tier below in its branch, and from tier 3, has made CAPSTONE_PICKS. */
const opens = (tiers: SkillId[][], tier: number, known: SkillId[]) => tier === 0 || (tiers[tier - 1].some((id) => known.includes(id)) && (tier < 2 || known.length >= CAPSTONE_PICKS))

/** The skills of `cls` a hero knowing `known` can learn now, in tree order. */
export const unlocked = (cls: ClassId, known: SkillId[]): SkillId[] => TREES[cls].flatMap(({ tiers }) => tiers.flatMap((skills, tier) => (opens(tiers, tier, known) ? skills.filter((id) => !known.includes(id)) : [])))

/** The tier of a skill in its class's tree, counted from 0. */
export const tierOf = (cls: ClassId, id: SkillId) => Math.max(...TREES[cls].map(({ tiers }) => tiers.findIndex((skills) => skills.includes(id))))

/** A class's roots: the skills open from the first pick, its ability first. */
export const roots = (cls: ClassId) => TREES[cls].flatMap((branch) => branch.tiers[0])
