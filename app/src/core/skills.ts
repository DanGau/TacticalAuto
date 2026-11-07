// Powers heroes learn: each class's tree, and what each skill does.
import {
  COMBO_MAX,
  DRONE_STATS,
  FAULT,
  FORCE_FIELD_ARMOR,
  FORCE_FIELD_REACH,
  HURL_DAMAGE,
  HURL_TILES,
  REPULSE_TILES,
  LEAP_DAMAGE,
  LINGER_STACKS,
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
import { TALENT as T, TUNING } from './tuning'
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

/** A way a class can grow: its entry, then a row of three for each pick after, the last its capstones. Any of a row opens the next. */
export interface Path {
  name: string
  rows: SkillId[][]
}

/** A class's tree: its power, free on recruit, then three paths; the first pick commits a hero to one for the run. */
export interface Tree {
  power: SkillId
  paths: Path[]
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
  hurl: { name: 'Hurl', use: 'At will', target: 'Creature hit', tags: ['force'], text: `Thrown ${HURL_TILES} tiles back; ${HURL_DAMAGE} damage if a wall or alien stops it`, effect: 'hurl' },
  hamstring: { name: 'Crippling Blow', use: 'At will', target: 'Creature hit', text: 'Rooted: it cannot move on its next turn', effect: 'snare' },
  sprinter: { name: 'Super Speed', use: 'Passive', text: '+2 move', stats: { move: 2 } },
  bloodbath: { name: 'Bloodbath', use: 'Reaction', tags: ['kill'], text: `Each kill heals ${BLOODBATH_HEAL} and adds +1 damage for the rest of the battle`, effect: 'bloodbath' },
  riposte: { name: 'Riposte', use: 'Reaction', target: 'Whoever hits it', text: 'Takes its damage back, each hit, at any range', effect: 'riposte' },
  projectile: { name: 'Living Projectile', use: 'At will', target: 'Alien a thrown one lands on', tags: ['force'], text: "Takes the thrown alien's HP in damage", effect: 'projectile' },
  earthshaker: { name: 'Earthshaker', use: 'Passive', text: `Heroic Leap is at will and does ${EARTHSHAKER_DAMAGE} more damage`, effect: 'earthshaker' },
  battleJoy: { name: 'Battle Joy', use: 'Passive', text: `+${T.bonus} damage above half HP`, effect: 'battleJoy' },
  grit: { name: 'Grit', use: 'Passive', text: `Takes ${T.soak} less damage from each hit up close`, effect: 'grit' },
  charge: { name: 'Charge', use: 'Passive', text: `+${T.bonus} damage if it moved this turn`, effect: 'charge' },
  vengeance: { name: 'Vengeance', use: 'Reaction', target: 'Self, when hit', text: '+1 damage for the rest of the battle', effect: 'vengeance' },
  carnage: { name: 'Carnage', use: 'Reaction', tags: ['kill'], text: `Each kill gives +1 move for the battle, to +${T.moveMax}`, effect: 'carnage' },
  thunderclap: { name: 'Thunderclap', use: 'Reaction', target: 'Beside its kill up close', tags: ['kill'], text: `Each ${stun}; a boss stands firm`, effect: 'thunderclap' },
  berserk: { name: 'Berserker', use: 'Passive', tags: ['crit'], text: 'Every hit is a crit at half HP or less', effect: 'berserk' },
  hunker: { name: 'Hunker Down', use: 'Passive', text: `Takes ${T.soak} less damage from each hit from 2+ tiles away`, effect: 'hunker' },
  hardened: { name: 'Hardened', use: 'Reaction', target: 'Self, when hit', tags: ['ward'], text: `+1 armor for the battle, to +${T.hardMax}`, effect: 'hardened' },
  bully: { name: 'Bully', use: 'Passive', text: `+${T.bonus} damage to a target with less HP than its own`, effect: 'bully' },
  tremor: { name: 'Tremor', use: 'Passive', range: '1', target: 'Aliens', text: `${T.zap} damage to each at the start of its turn`, effect: 'tremor' },
  // Heavy
  meteorStrike: taught('heavy'),
  arsenal: { name: 'Second Meteor', use: 'Passive', text: 'One more Meteor Strike each battle', charges: 1 },
  bulwark: { name: 'Bulwark', use: 'Aura', range: '2', target: 'Allies', tags: ['ward'], text: 'Take 1 less damage from each hit', effect: 'bulwark' },
  suppression: { name: 'Staggering Blow', use: 'At will', target: 'Creature hit', text: 'It does 1 less damage on its next turn', effect: 'suppress' },
  bigBlast: { name: 'Greater Meteor', use: 'Passive', text: 'Meteor Strike blasts 2 tiles around where it lands', effect: 'bigBlast' },
  shredder: { name: 'Sundering Blow', use: 'At will', target: 'Creature hit', tags: ['ward'], text: 'Destroys all its armor before doing damage', effect: 'shred' },
  repulse: { name: 'Repulsor', use: 'At will', target: 'Creature hit', tags: ['force'], text: `Driven ${REPULSE_TILES} tiles back; off a ledge or the edge, it falls`, effect: 'repulse' },
  gale: { name: 'Gale', use: 'Reaction', target: 'Creature crit', tags: ['crit', 'force'], text: `Blown ${REPULSE_TILES} tiles back; off a ledge or the edge, it falls`, effect: 'gale' },
  concussion: { name: 'Concussive Blows', use: 'Reaction', target: 'Creature crit', tags: ['crit'], text: `Stunned: it ${stun}`, effect: 'concussion' },
  taunt: { name: 'Taunt', use: 'Passive', text: 'An alien that can shoot it must shoot it', effect: 'taunt' },
  steadfast: { name: 'Steadfast', use: 'Passive', text: 'Cannot be panicked; acid and explosions do it no harm', effect: 'steadfast' },
  reactive: { name: 'Stone Skin', use: 'Passive', tags: ['ward'], text: '+4 armor', stats: { armor: 4 } },
  slam: { name: 'Ground Slam', use: '1/battle', range: 'Adjacent', target: '2+ aliens', text: `Replaces an attack. ${SLAM_HIT} damage to each, hurled ${SLAM_TILES} tiles back`, effect: 'slam' },
  intimidate: { name: 'Terrifying Roar', use: '1/battle', range: `${STUN_REACH}`, target: '2+ aliens', text: `Each ${stun}; a boss stands firm`, effect: 'warcry' },
  impact: { name: 'Impact', use: 'Passive', text: `Meteor Strike does ${IMPACT_DAMAGE} more damage and falls on a lone alien too`, effect: 'impact' },
  lasting: { name: 'Lasting Guard', use: 'Passive', tags: ['ward'], text: 'Its armor is whole again each turn, and half of what it kept carries on top, to double', effect: 'lasting' },
  shieldSlam: { name: 'Shield Slam', use: 'At will', target: 'Creature hit with a Star Shield', tags: ['ward'], text: 'Takes its armor in more damage', effect: 'shieldSlam' },
  fortress: { name: 'Fortress', use: 'Passive', tags: ['ward'], text: 'Takes half damage from every hit', effect: 'fortress' },
  faultLine: { name: 'Fault Line', use: 'Reaction', range: '1', target: `Ground around its every ${FAULT.every}th creature hit up close`, tags: ['force'], text: `Drops ${FAULT.levels} levels; ${FAULT.damage} damage to each alien on it`, effect: 'faultLine' },
  aftershock: { name: 'Aftershock', use: 'At will', target: 'Beside creature hit', text: `${AFTERSHOCK_DAMAGE} damage to each`, effect: 'aftershock' },
  standAlone: { name: 'Stand Alone', use: 'Passive', text: `Takes ${T.soak} less damage from each hit with no ally within 2`, effect: 'standAlone' },
  cracking: { name: 'Cracking Blow', use: 'At will', target: 'Creature hit', tags: ['ward'], text: `Breaks ${T.crack} of its armor`, effect: 'cracking' },
  demolisher: { name: 'Demolisher', use: 'Passive', text: `+${T.bonus} damage to a target with armor`, effect: 'demolisher' },
  bedrock: { name: 'Bedrock', use: 'Passive', tags: ['ward'], text: `+${T.armor} armor each turn, to ${T.armorMax} above its own`, effect: 'bedrock' },
  resonance: { name: 'Resonance', use: 'Reaction', target: 'Beside creature crit', tags: ['crit'], text: `${T.zap} damage to each`, effect: 'resonance' },
  artillery: { name: 'Artillery', use: 'Passive', text: `+${T.bonus} damage to a target ${T.far}+ tiles away`, effect: 'artillery' },
  barrage: { name: 'Meteor Barrage', use: 'Passive', text: 'One more Meteor Strike each battle', charges: 1 },
  wrecker: { name: 'Wrecker', use: 'Passive', text: `+${T.kill} damage to a target with 2+ aliens beside it`, effect: 'wrecker' },
  concussiveForce: { name: 'Concussive Force', use: 'Reaction', target: 'Its every 2nd creature hit up close', text: `Stunned: it ${stun}; a boss stands firm`, effect: 'concussiveForce' },
  // Sniper
  farSight: taught('sniper'),
  steady: { name: 'Steady Hands', use: 'Passive', text: '+1 damage if it did not move this turn', effect: 'steady' },
  mark: { name: "Hunter's Mark", use: 'At will', target: 'Creature hit', tags: ['mark'], text: `Marked: every later hit on it does ${TUNING.markDamage} more damage`, effect: 'mark' },
  elusive: { name: 'Elusive', use: 'Passive', text: 'Aliens more than 4 tiles away cannot shoot it', effect: 'elusive' },
  kneecap: { name: 'Pinning Shot', use: 'At will', target: 'Creature hit', text: 'Rooted: it cannot move on its next turn', effect: 'snare' },
  headshot: { name: 'Headshot', use: 'Passive', tags: ['crit'], text: 'Crits do 2 more damage', effect: 'headshot' },
  doubleTap: { name: 'Double Tap', use: 'Passive', text: 'A third attack with its weapon if it did not move this turn', effect: 'doubleTap' },
  assassinate: { name: 'Assassinate', use: 'Passive', tags: ['crit'], text: 'A hit on a target at full HP is a crit', effect: 'assassinate' },
  combo: { name: 'Focus Fire', use: 'Passive', text: `+1 damage for each hit in a row on the same alien, to +${COMBO_MAX}; another target starts over`, effect: 'combo' },
  slayer: { name: 'Colossus Slayer', use: 'Passive', text: '+2 damage to a target already wounded', effect: 'slayer' },
  hollowPoint: { name: 'Piercing Blows', use: 'Passive', text: 'Its attacks ignore armor', effect: 'pierce' },
  volley: { name: 'Volley', use: 'At will', target: 'Beside creature hit', text: "Half the hit's damage to each", effect: 'volley' },
  decoy: { name: 'Mirror Image', use: 'Passive', text: 'Starts each battle with 2 images; each of the first 2 hits pops one instead', effect: 'mirror' },
  blink: { name: 'Blink', use: '1/battle', range: '5', target: 'Self', text: 'Hit to half HP or less: blinks to the safest tile', effect: 'blink' },
  relocate: { name: 'Relocate', use: 'Reaction', text: 'After it acts, moves up to 2 tiles away from the aliens', effect: 'skirmish' },
  sureShot: { name: 'Sure Shot', use: 'Passive', tags: ['crit'], text: 'Every hit is a crit if it did not move this turn', effect: 'sureShot' },
  apex: { name: 'Apex Predator', use: 'At will', target: 'Creature hit', tags: ['mark', 'crit'], text: 'Marked; every hit on a marked alien is a crit', effect: 'apex' },
  ghostShot: { name: 'Ghost Shot', use: 'Passive', text: 'Its attacks pass through walls and ignore armor', effect: 'psionic' },
  snapShot: { name: 'Snap Shot', use: 'Passive', text: '+1 damage if it moved this turn', effect: 'snapShot' },
  deadeye: { name: 'Mercy Shot', use: 'Passive', tags: ['crit'], text: 'A hit on a target at half HP or less is a crit', effect: 'deadeye' },
  bigGame: { name: 'Big Game', use: 'Passive', text: `+${T.bonus} damage to a target with more HP than its own`, effect: 'bigGame' },
  camouflage: { name: 'Camouflage', use: 'Passive', text: `Takes ${T.soak} less damage from each hit if it did not move this turn`, effect: 'camouflage' },
  shroud: { name: 'Shroud', use: 'Reaction', target: 'Self', tags: ['kill'], text: `A kill ${T.far}+ tiles away cloaks it`, effect: 'shroud' },
  killshot: { name: 'Killshot', use: 'Passive', text: `+${T.kill} damage to a target at a quarter HP or less`, effect: 'killshot' },
  keenEye: { name: 'Keen Eye', use: 'Passive', tags: ['crit'], text: '+15% crit', stats: { crit: 0.15 } },
  perfectShot: { name: 'Perfect Shot', use: 'Passive', tags: ['crit'], text: `Crits do ${T.kill} more damage`, effect: 'perfectShot' },
  evasion: { name: 'Evasion', use: 'Passive', text: 'Takes 1 less damage from each hit', effect: 'dodge' },
  untouchable: { name: 'Untouchable', use: 'Passive', text: `Takes ${T.kill} less damage from each hit if it did not move this turn`, effect: 'untouchable' },
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
  shockRounds: { name: 'Shock Rounds', use: 'Reaction', target: 'Creature crit', tags: ['crit'], text: `Stunned: it ${stun}`, effect: 'concussion' },
  tesla: { name: 'Tesla Coil', use: 'Reaction', range: `${TESLA.reach}`, target: `${TESLA.bolts} nearest aliens`, text: `After it acts, ${TESLA.damage} damage to each`, effect: 'tesla' },
  mechanic: { name: 'Mechanic', use: 'Passive', text: `Its machines heal ${T.heal} at the start of each turn`, effect: 'mechanic' },
  bodyguard: { name: 'Bodyguard', use: 'Passive', text: `Takes ${T.soak} less damage from each hit while a machine of its stands beside it`, effect: 'bodyguard' },
  pilotLink: { name: 'Pilot Link', use: 'Passive', text: `+${T.bonus} damage while a machine of its fights`, effect: 'pilotLink' },
  targetLink: { name: 'Target Link', use: 'Passive', text: `Its machines do +${T.bonus} damage to the alien it last hit`, effect: 'targetLink' },
  staticCharge: { name: 'Static Charge', use: 'Reaction', target: `Its every ${T.every}rd creature hit`, text: `Stunned: it ${stun}; a boss stands firm`, effect: 'staticCharge' },
  arcWelder: { name: 'Arc Welder', use: 'At will', range: `${T.reach} of creature hit`, target: 'Nearest other alien', text: `${T.zap} damage`, effect: 'arcWelder' },
  overdrive: { name: 'Overdrive', use: 'Passive', text: `Its machines do +${T.big} damage`, effect: 'overdrive' },
  armoredDrones: { name: 'Armored Drones', use: 'Passive', tags: ['ward'], text: `Its machines take ${T.soak} less damage from each hit`, effect: 'armoredDrones' },
  hiveQueen: { name: 'Hive Queen', use: 'Reaction', tags: ['kill'], text: `A kill by its machine heals that machine and it ${T.heal}`, effect: 'hiveQueen' },
  exploitFault: { name: 'Exploit Fault', use: 'Passive', text: `+${TUNING.opportunistDamage} damage to a target rooted or stunned`, effect: 'opportunist' },
  staticField: { name: 'Static Field', use: 'Passive', range: '2', target: 'Aliens', text: `${T.zap} damage to each at the start of its turn`, effect: 'staticField' },
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
  lifeLink: { name: 'Life Link', use: 'At will', range: `${T.reach}`, target: 'Most wounded ally', text: 'Each hit it lands heals them 1', effect: 'lifeLink' },
  transfusion: { name: 'Transfusion', use: 'Passive', range: `${T.reach}`, target: 'Most wounded ally', text: `Above half HP, gives ${T.heal} of its HP each turn`, effect: 'transfusion' },
  rally: { name: 'Rally', use: 'Passive', range: '2', target: 'Most wounded ally', tags: ['ward'], text: `+${T.armor} armor each turn, to ${T.armorMax} above its own`, effect: 'rally' },
  retribution: { name: 'Retribution', use: 'Aura', range: `${T.reach}`, target: 'Aliens that hit an ally', text: `Take ${T.zap} damage`, effect: 'retribution' },
  battleHymn: { name: 'Battle Hymn', use: 'Aura', range: '2', target: 'It and allies', tags: ['kill'], text: 'Each kill gives +1 damage for the battle', effect: 'battleHymn' },
  smite: { name: 'Smite', use: 'Passive', text: `+${T.big} damage to an alien beside an ally`, effect: 'smite' },
  renewal: { name: 'Renewal', use: 'Passive', text: 'Heals 1 at the start of each turn', effect: 'regen' },
  wellspring: { name: 'Wellspring', use: 'Aura', range: '2', target: 'Wounded allies', text: `Heal ${T.mend} at the start of its turn`, effect: 'wellspring' },
  guardian: { name: 'Guardian Angel', use: 'Aura', range: '2', target: 'Allies', tags: ['ward'], text: `Take ${T.soak} less damage from each hit`, effect: 'guardian' },
  warSong: { name: 'War Song', use: 'Aura', range: '2', target: 'It and allies', text: `+${T.bonus} damage`, effect: 'warSong' },
  // Pyro
  fireball: taught('pyro'),
  tanks: { name: 'Deep Flame', use: 'Passive', tags: ['burn'], text: 'One more Fireball each battle', charges: 1 },
  tinder: { name: 'Flame Blade', use: 'At will', target: 'Creature hit', tags: ['burn'], text: 'Set burning', effect: 'tinder' },
  fanFlames: { name: 'Fan the Flames', use: 'At will', target: 'Burning creature hit', tags: ['burn'], text: `${TUNING.fanStacks} more burn stack`, effect: 'fanFlames' },
  fireSuit: { name: 'Flameborn', use: 'Passive', text: 'It cannot burn', effect: 'fireSuit' },
  inferno: { name: 'Inferno', use: 'Passive', tags: ['burn'], text: 'Fireball spreads 2 tiles around where it lands', effect: 'inferno' },
  backdraft: { name: 'Backdraft', use: 'Reaction', target: 'Beside its burning kill', tags: ['burn', 'kill'], text: 'Set burning', effect: 'backdraft' },
  asbestos: { name: 'Hide of Cinders', use: 'Passive', text: '+3 HP', stats: { hp: 3 } },
  searing: { name: 'Searing', use: 'Passive', tags: ['burn'], text: `+${SEARING_DAMAGE} damage to a burning target`, effect: 'searing' },
  flashpoint: { name: 'Flashpoint', use: 'Passive', tags: ['crit'], text: '+15% crit', stats: { crit: 0.15 } },
  smolder: { name: 'Smolder', use: 'Passive', tags: ['burn'], text: `Each of its burns adds ${LINGER_STACKS} more stack`, effect: 'smolder' },
  burningAura: { name: 'Fire Shield', use: 'Reaction', target: 'Whoever hits it', text: 'Takes 1 damage', effect: 'thorns' },
  phoenixHeart: { name: 'Phoenix Heart', use: 'Passive', text: 'Heals 1 at the start of each turn', effect: 'regen' },
  firestorm: { name: 'Firestorm', use: 'Passive', tags: ['burn', 'kill'], text: 'A Fireball that kills gives its use back', effect: 'firestorm' },
  conflagration: { name: 'Conflagration', use: 'Passive', tags: ['burn'], text: `Aliens burning take ${CONFLAGRATION_DAMAGE} more each turn, and set those beside them burning`, effect: 'conflagration' },
  hellfire: { name: 'Hellfire', use: 'Aura', range: `${HELLFIRE_REACH}`, target: 'Aliens', tags: ['burn'], text: 'Set burning at the start of each of their turns', effect: 'hellfire' },
  pyromania: { name: 'Pyromania', use: 'Passive', tags: ['burn'], text: '+1 damage for each 2 aliens burning, to +3', effect: 'pyromania' },
  cauterize: { name: 'Cauterize', use: 'Reaction', tags: ['burn', 'kill'], text: `A kill of a burning alien heals it ${T.heal}`, effect: 'cauterize' },
  combust: { name: 'Combust', use: 'At will', target: 'Burning creature hit', tags: ['burn'], text: 'Its burn goes out, for a damage per stack', effect: 'combust' },
  meltdown: { name: 'Meltdown', use: 'At will', target: 'Burning creature hit', tags: ['burn', 'ward'], text: `Breaks ${T.crack} of its armor`, effect: 'meltdown' },
  heatShield: { name: 'Heat Shield', use: 'Passive', tags: ['burn'], text: 'Takes 1 less damage from each hit per alien burning within 2, to 3', effect: 'heatShield' },
  cinderSkin: { name: 'Cinder Skin', use: 'Reaction', target: 'Whoever hits it up close', tags: ['burn'], text: 'Set burning', effect: 'cinderSkin' },
  kindling: { name: 'Kindling', use: 'Passive', text: `+${T.bonus} damage to a target not burning`, effect: 'kindling' },
  whiteHeat: { name: 'White Heat', use: 'Passive', tags: ['burn'], text: `+${T.kill} damage to a burning target`, effect: 'whiteHeat' },
  spread: { name: 'Spreading Flames', use: 'At will', target: 'Alien beside burning creature hit', tags: ['burn'], text: 'Set burning', effect: 'spread' },
  firebrand: { name: 'Firebrand', use: 'Passive', tags: ['burn'], text: '+1 damage for each burn stack on its target', effect: 'firebrand' },
  emberWard: { name: 'Ember Ward', use: 'Passive', tags: ['burn'], text: `Takes ${T.soak} less damage from each hit by a burning alien`, effect: 'emberWard' },
  emberHeart: { name: 'Ember Heart', use: 'Passive', tags: ['burn'], text: `Heals ${T.heal} at the start of each turn while an alien within 2 burns`, effect: 'emberHeart' },
  // Cryo
  chillTouch: taught('cryo'),
  icebreak: { name: 'Icebreaker', use: 'Passive', tags: ['frost'], text: `+${SEARING_DAMAGE} damage to a chilled target`, effect: 'icebreak' },
  permafrost: { name: 'Permafrost', use: 'Passive', tags: ['frost'], text: `Each of its chills adds ${LINGER_STACKS} more stack`, effect: 'permafrost' },
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
  rimeGrip: { name: 'Rime Grip', use: 'Passive', text: `+${TUNING.gripDamage} damage to a target beside it`, effect: 'rimeGrip' },
  shardstorm: { name: 'Shardstorm', use: 'At will', target: 'Beside creature hit', tags: ['frost'], text: `${SHARD_DAMAGE} damage to each, and chilled`, effect: 'shardstorm' },
  flashFreeze: { name: 'Flash Freeze', use: 'At will', target: 'Chilled creature hit', tags: ['frost'], text: 'A chill stack more', effect: 'flashFreeze' },
  shatterpoint: { name: 'Shatterpoint', use: 'Passive', tags: ['frost'], text: `+${T.big} damage to a frozen target`, effect: 'shatterpoint' },
  coldSnap: { name: 'Cold Snap', use: 'Aura', range: '1', target: 'Aliens', tags: ['frost'], text: 'Chilled at the start of each of its turns', effect: 'coldSnap' },
  frostShell: { name: 'Frost Shell', use: 'Passive', tags: ['frost'], text: `Takes ${T.soak} less damage from each hit by a chilled alien`, effect: 'frostShell' },
  splinter: { name: 'Splinter', use: 'Reaction', target: 'Beside creature crit', tags: ['crit', 'frost'], text: 'Chilled', effect: 'splinter' },
  iceSpear: { name: 'Ice Spear', use: 'Passive', tags: ['frost'], text: 'Its hits on a chilled target ignore armor', effect: 'iceSpear' },
  brittle: { name: 'Brittle', use: 'Passive', tags: ['frost'], text: `+${T.kill} damage to a chilled target`, effect: 'brittle' },
  iceAge: { name: 'Ice Age', use: 'Reaction', target: 'Beside its chilled kill', tags: ['frost', 'kill'], text: `Each ${stun}; a boss stands firm`, effect: 'iceAge' },
  polarVortex: { name: 'Polar Vortex', use: 'Aura', range: '2', target: 'Aliens', tags: ['frost'], text: 'Chilled at the start of each of its turns', effect: 'polarVortex' },
  iceLance: { name: 'Ice Lance', use: 'Passive', text: `+${T.bonus} damage to a target ${T.far}+ tiles away`, effect: 'artillery' },
  glacialSpike: { name: 'Glacial Spike', use: 'Passive', tags: ['crit'], text: `Crits do ${T.kill} more damage`, effect: 'perfectShot' },
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
  opportunist: { name: 'Opportunist', use: 'Passive', text: `+${TUNING.opportunistDamage} damage to a target rooted or stunned`, effect: 'opportunist' },
  bladeDance: { name: 'Blade Dance', use: 'At will', text: `Its bonus attack also strikes ${FAN_TARGETS} more aliens in reach`, effect: 'bladeDance' },
  ambush: { name: 'Ambush', use: 'Passive', text: `Its first hit each battle does ${T.big} more damage`, effect: 'ambush' },
  shadowFeed: { name: 'Shadow Feed', use: 'Reaction', tags: ['kill'], text: `Each kill heals it ${T.heal}`, effect: 'shadowFeed' },
  wraithForm: { name: 'Wraith Form', use: 'Passive', text: `At half HP or less, takes ${T.soak} less damage from each hit`, effect: 'wraithForm' },
  soulDrain: { name: 'Soul Drain', use: 'At will', target: 'Self', text: 'Each hit it lands heals it 1', effect: 'soulDrain' },
  venom: { name: 'Venom', use: 'At will', target: 'Creature hit', text: 'It does 1 less damage on its next turn', effect: 'venom' },
  bloodScent: { name: 'Blood Scent', use: 'Passive', text: `+${T.bonus} damage to a target at half HP or less`, effect: 'bloodScent' },
  killerInstinct: { name: 'Killer Instinct', use: 'Passive', tags: ['crit'], text: '+15% crit', stats: { crit: 0.15 } },
  nightmare: { name: 'Nightmare', use: 'Reaction', range: '2', target: 'Aliens around its kill', tags: ['kill'], text: `Each ${stun}; a boss stands firm`, effect: 'nightmare' },
  deathless: { name: 'Deathless', use: '1/battle', target: 'Self', text: 'Survives a killing hit at 1 HP', effect: 'lastStand' },
  soulHarvest: { name: 'Soul Harvest', use: 'Reaction', tags: ['kill'], text: `Each kill heals it ${T.heal} and gives +1 damage for the battle`, effect: 'soulHarvest' },
  cutthroat: { name: 'Cutthroat', use: 'Passive', text: `+${TUNING.gripDamage} damage to a target beside it`, effect: 'rimeGrip' },
  thousandCuts: { name: 'Thousand Cuts', use: 'Passive', text: '+1 damage for each 2 hits it landed earlier this battle, to +4', effect: 'thousandCuts' },
  // Ultimates, each once a battle
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
  worldAblaze: { name: 'World Ablaze', use: '1/battle', target: 'Every alien in the fight', tags: ['burn'], text: `Armor burns away; ${ABLAZE.damage} damage, ${ABLAZE.burn} burn stacks on burning ground`, effect: 'worldAblaze' },
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

const tree = (power: SkillId, ...paths: Path[]): Tree => ({ power, paths })
const path = (name: string, ...rows: SkillId[][]): Path => ({ name, rows })

export const TREES: Record<ClassId, Tree> = {
  assault: tree('mightyBound',
    path('Rampage', ['rage'], ['cleave', 'bloodlust', 'battleJoy'], ['bloodbath', 'surge', 'thunderclap'], ['killingSpree', 'carnage', 'berserk']),
    path('Ironhide', ['reflexes'], ['secondWind', 'grit', 'vengeance'], ['riposte', 'unbreakable', 'hunker'], ['indestructible', 'skirmish', 'hardened']),
    path('Juggernaut', ['leap'], ['sprinter', 'charge', 'hamstring'], ['earthshaker', 'projectile', 'bully'], ['levelBlock', 'hurl', 'tremor'])),
  heavy: tree('meteorStrike',
    path('Cataclysm', ['arsenal'], ['artillery', 'bigBlast', 'cracking'], ['impact', 'shredder', 'barrage'], ['extinction', 'demolisher', 'wrecker']),
    path('Bastion', ['bulwark'], ['reactive', 'standAlone', 'taunt'], ['fortress', 'lasting', 'steadfast'], ['titanForm', 'bedrock', 'shieldSlam']),
    path('Shockwave', ['suppression'], ['repulse', 'concussion', 'intimidate'], ['faultLine', 'aftershock', 'resonance'], ['earthquake', 'slam', 'concussiveForce'])),
  sniper: tree('farSight',
    path('Marksman', ['steady'], ['headshot', 'snapShot', 'doubleTap'], ['sureShot', 'assassinate', 'keenEye'], ['bulletTime', 'deadeye', 'perfectShot']),
    path('Hunter', ['mark'], ['bigGame', 'kneecap', 'combo'], ['apex', 'slayer', 'volley'], ['deathSentence', 'hollowPoint', 'killshot']),
    path('Ghost', ['elusive'], ['camouflage', 'decoy', 'relocate'], ['ghostShot', 'shroud', 'evasion'], ['hallOfMirrors', 'blink', 'untouchable'])),
  engineer: tree('deployMech',
    path('Mech Bay', ['titan'], ['mechanic', 'plating', 'rebuild'], ['warMachine', 'detonate', 'pilotLink'], ['colossus', 'bodyguard', 'overdrive']),
    path('Drone Hive', ['swarm'], ['linked', 'spotter', 'servos'], ['endlessSwarm', 'hive', 'armoredDrones'], ['droneStorm', 'targetLink', 'hiveQueen']),
    path('Tinker', ['launcher'], ['hardlight', 'staticCharge', 'shockRounds'], ['tesla', 'arcWelder', 'exploitFault'], ['orbital', 'emp', 'staticField'])),
  support: tree('healingLight',
    path('Mending', ['fieldKit'], ['vitality', 'surgeon', 'lifeLink'], ['fontOfLife', 'revive', 'renewal'], ['resurrection', 'transfusion', 'wellspring']),
    path('Aegis', ['barrier'], ['ward', 'rally', 'bane'], ['sacredGround', 'forceField', 'nullifier'], ['divineShield', 'retribution', 'guardian']),
    path('Zeal', ['inspire'], ['haste', 'battleHymn', 'gravBeam'], ['command', 'drone', 'smite'], ['timeStop', 'flashbang', 'warSong'])),
  pyro: tree('fireball',
    path('Inferno', ['tanks'], ['pyromania', 'inferno', 'searing'], ['firestorm', 'fanFlames', 'kindling'], ['supernova', 'cauterize', 'whiteHeat']),
    path('Immolation', ['tinder'], ['smolder', 'meltdown', 'flashpoint'], ['conflagration', 'backdraft', 'spread'], ['worldAblaze', 'combust', 'firebrand']),
    path('Ember Hide', ['fireSuit'], ['cinderSkin', 'asbestos', 'burningAura'], ['hellfire', 'heatShield', 'emberWard'], ['phoenixRising', 'phoenixHeart', 'emberHeart'])),
  cryo: tree('chillTouch',
    path('Hoarfrost', ['icebreak'], ['permafrost', 'flashFreeze', 'rimeLock'], ['brittle', 'deepFreeze', 'shatterpoint'], ['absoluteZero', 'frozenHeart', 'iceAge']),
    path('Glacier', ['iceArmor'], ['frostAura', 'coldSnap', 'glide'], ['glacialArmor', 'cryostasis', 'gale'], ['blizzard', 'frostShell', 'polarVortex']),
    path('Icicle', ['coldSteel'], ['coldEye', 'splinter', 'longRange'], ['shardstorm', 'iceSpear', 'iceLance'], ['hailOfIcicles', 'rimeGrip', 'glacialSpike'])),
  phantom: tree('cloak',
    path('Shade', ['shadowStrike'], ['ambush', 'daze', 'deepCloak'], ['livingShadow', 'afterimage', 'killerInstinct'], ['eclipse', 'shadowFeed', 'nightmare']),
    path('Wraith', ['vanish'], ['phaseShift', 'wraithForm', 'shadowStep'], ['intangible', 'fadeOut', 'deathless'], ['reap', 'soulDrain', 'soulHarvest']),
    path('Knives', ['knifeWork'], ['venom', 'garrote', 'opportunist'], ['bladeDance', 'bloodScent', 'cutthroat'], ['phantomLegion', 'smokeBomb', 'thousandCuts'])),
}

/** Every skill of a class's tree: its power, then each path's, row by row. */
export const treeOf = (cls: ClassId): SkillId[] => [TREES[cls].power, ...TREES[cls].paths.flatMap((p) => p.rows.flat())]

/** The skill that teaches a class its power, which every hero of the class starts with. */
export const powerOf = (cls: ClassId): SkillId => TREES[cls].power

/** Each path's last row. */
export const capstones = (cls: ClassId): SkillId[] => TREES[cls].paths.flatMap((p) => p.rows.at(-1)!)

/** The path a skill stands in; the power stands in none. */
export const pathOf = (cls: ClassId, id: SkillId): Path | undefined => TREES[cls].paths.find((p) => p.rows.some((row) => row.includes(id)))

/** The path a hero knowing `known` took at its first pick, if it has. */
export const committed = (cls: ClassId, known: SkillId[]): Path | undefined => known.map((id) => pathOf(cls, id)).find(Boolean)
