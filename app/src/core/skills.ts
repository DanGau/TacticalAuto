// Powers heroes learn: each class's tree, and what each skill does.
import {
  COMBO_MAX,
  DRONE_STATS,
  FAULT,
  GUARD_MAX,
  FORCE_FIELD_ARMOR,
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
import type { Flow } from './quantities'
import type { Power } from './powers'

/**
 * Something a hero learns on gaining a level, from its class's tree. It changes stats, adds uses of the class
 * ability, or gives an effect that combat applies; `text` says which. One that `teaches` gives the hero its class's ability.
 */
export interface Skill extends Power, Flow {
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

/** How a stun that spares bosses reads. */
const bossImmune = 'Bosses are immune.'

/** A class's ability as a skill to learn. */
const taught = (cls: ClassId) => ({ ...classPower(CLASSES[cls], CLASSES[cls].charges), teaches: true as const })

/** After the hero acts, it steps away. */
const away = (verb: string) => `After you act, ${verb} up to 2 tiles away from the aliens.`

const skills = {
  // Assault
  mightyBound: taught('assault'),
  bloodlust: { name: 'Bloodlust', use: 'Reaction', reads: ['kill'], text: 'Whenever you kill an alien, attack again with that weapon.', effect: 'frenzy' },
  bracer: { name: 'Bracer', use: 'Passive', makes: ['armor'], text: `Whenever you hit, gain 1 Armor, up to ${GUARD_MAX} above your own.`, effect: 'braced' },
  leap: { name: 'Heroic Leap', use: '1/battle', range: '2× move', target: 'Thickest knot', text: `Deal ${LEAP_DAMAGE} damage to each alien beside where you land, and Root them.`, effect: 'leap' },
  rage: { name: 'Rage', use: 'Passive', text: 'While at half HP or less, deal 2 more damage.', effect: 'rage' },
  cleave: { name: 'Cleave', use: 'Reaction', reads: ['kill'], text: 'Whenever you kill an alien, deal 2 damage to each alien beside it.', effect: 'cleave' },
  surge: { name: 'Action Surge', use: '1/battle', text: 'Make 1 more attack with your weapon this turn.', effect: 'surge' },
  skirmish: { name: 'Skirmisher', use: 'Reaction', text: away('move'), effect: 'skirmish' },
  secondWind: { name: 'Second Wind', use: '1/battle', target: 'Self', text: 'When you drop to half HP or less, heal 5. You still attack.', effect: 'secondWind' },
  unbreakable: { name: 'Unbreakable', use: '1/battle', target: 'Self', text: 'When you would fall, survive at 1 HP.', effect: 'lastStand' },
  hurl: { name: 'Hurl', use: 'At will', target: 'Creature hit', makes: ['moved', 'impact'], text: `Displace it ${HURL_TILES} tiles back. If a wall or alien stops it, deal ${HURL_DAMAGE} damage to it.`, effect: 'hurl' },
  hamstring: { name: 'Crippling Blow', use: 'At will', target: 'Creature hit', text: 'Root it.', effect: 'snare' },
  sprinter: { name: 'Super Speed', use: 'Passive', text: 'Gain 2 move.', stats: { move: 2 } },
  bloodbath: { name: 'Bloodbath', use: 'Reaction', reads: ['kill'], text: `Whenever you kill an alien, heal ${BLOODBATH_HEAL} and gain 1 Might.`, effect: 'bloodbath' },
  riposte: { name: 'Riposte', use: 'Reaction', target: 'Whoever hits it', text: 'Whenever an alien hits you, deal that damage back to it, at any range.', effect: 'riposte' },
  projectile: { name: 'Living Projectile', use: 'At will', target: 'Alien a thrown one lands on', reads: ['moved'], makes: ['impact'], text: "Deal the thrown alien's HP in damage to it. You can throw without Heave.", effect: 'projectile' },
  earthshaker: { name: 'Earthshaker', use: 'Passive', text: `Use Heroic Leap at will. It deals ${EARTHSHAKER_DAMAGE} more damage.`, effect: 'earthshaker' },
  battleJoy: { name: 'Battle Joy', use: 'Passive', text: `While above half HP, deal ${T.bonus} more damage.`, effect: 'battleJoy' },
  grit: { name: 'Grit', use: 'Passive', text: `Take ${T.soak} less damage from each hit by an alien beside you.`, effect: 'grit' },
  charge: { name: 'Charge', use: 'Passive', text: `If you moved this turn, deal ${T.bonus} more damage.`, effect: 'charge' },
  vengeance: { name: 'Vengeance', use: 'Reaction', target: 'Self, when hit', text: 'Whenever you are hit, gain 1 Might.', effect: 'vengeance' },
  carnage: { name: 'Carnage', use: 'Reaction', reads: ['kill'], text: `Whenever you kill an alien, gain 1 move for the battle, up to ${T.moveMax}.`, effect: 'carnage' },
  thunderclap: { name: 'Thunderclap', use: 'Reaction', target: 'Beside its kill up close', reads: ['kill'], text: `Whenever you kill an alien beside you, Stun each alien beside it. ${bossImmune}`, effect: 'thunderclap' },
  berserk: { name: 'Berserker', use: 'Passive', reads: ['hurt'], makes: ['crit'], text: 'While at half HP or less, every hit is a Crit.', effect: 'berserk' },
  hunker: { name: 'Hunker Down', use: 'Passive', text: `Take ${T.soak} less damage from each hit from 2+ tiles away.`, effect: 'hunker' },
  hardened: { name: 'Hardened', use: 'Reaction', target: 'Self, when hit', reads: ['hurt'], makes: ['armor'], text: `Whenever you are hit, gain 1 Armor for the battle, up to ${T.hardMax}.`, effect: 'hardened' },
  bully: { name: 'Bully', use: 'Passive', text: `Deal ${T.bonus} more damage to a target whose HP is below yours.`, effect: 'bully' },
  tremor: { name: 'Tremor', use: 'Passive', range: '1', target: 'Aliens', text: `At the start of your turn, deal ${T.zap} damage to each alien beside you.`, effect: 'tremor' },
  // Heavy
  meteorStrike: taught('heavy'),
  arsenal: { name: 'Second Meteor', use: 'Passive', text: 'Gain 1 more Meteor Strike each battle.', charges: 1 },
  bulwark: { name: 'Bulwark', use: 'Aura', range: '2', target: 'It and allies', text: 'You and allies within 2 tiles take 1 less damage from each hit.', effect: 'bulwark' },
  suppression: { name: 'Staggering Blow', use: 'At will', target: 'Creature hit', text: 'Apply Weak.', effect: 'suppress' },
  bigBlast: { name: 'Greater Meteor', use: 'Passive', text: 'Meteor Strike hits each alien within 2 tiles of where it lands.', effect: 'bigBlast' },
  shredder: { name: 'Sundering Blow', use: 'At will', target: 'Creature hit', text: 'Destroy all its Armor before dealing damage.', effect: 'shred' },
  repulse: { name: 'Repulsor', use: 'At will', target: 'Creature hit', makes: ['moved', 'impact'], text: `Displace it ${REPULSE_TILES} tiles back. Off a ledge or the edge, it falls.`, effect: 'repulse' },
  gale: { name: 'Gale', use: 'Reaction', target: 'Creature crit', reads: ['crit'], makes: ['moved', 'impact'], text: `Whenever you Crit, Displace the target ${REPULSE_TILES} tiles back. Off a ledge or the edge, it falls.`, effect: 'gale' },
  concussion: { name: 'Concussive Blows', use: 'Reaction', target: 'Creature crit', reads: ['crit'], text: 'Whenever you Crit, Stun the target.', effect: 'concussion' },
  spikes: { name: 'Spiked Plate', use: 'Reaction', target: 'Whoever hits it', text: 'Whenever an alien hits you, deal 1 damage to it.', effect: 'thorns' },
  steadfast: { name: 'Steadfast', use: 'Passive', text: 'You cannot be Panicked. Acid and explosions deal you no damage.', effect: 'steadfast' },
  reactive: { name: 'Stone Skin', use: 'Passive', makes: ['armor'], text: 'Gain 4 Armor.', stats: { armor: 4 } },
  slam: { name: 'Ground Slam', use: '1/battle', range: 'Adjacent', target: '2+ aliens', text: `In place of an attack, deal ${SLAM_HIT} damage to each alien beside you and Displace them ${SLAM_TILES} tiles back.`, effect: 'slam' },
  kineticCore: { name: 'Kinetic Core', use: 'Passive', reads: ['impact'], text: 'Whenever you knock an alien into something or off a ledge, deal your damage to it again.', effect: 'impetus' },
  impact: { name: 'Impact', use: 'Passive', text: `Meteor Strike deals ${IMPACT_DAMAGE} more damage and can target a lone alien.`, effect: 'impact' },
  lasting: { name: 'Lasting Guard', use: 'Passive', reads: ['armor'], makes: ['armor'], text: 'At the start of your turn, restore your Armor and add half of what you kept, up to double.', effect: 'lasting' },
  shieldSlam: { name: 'Shield Slam', use: 'At will', target: 'Creature hit with a shield', reads: ['armor'], text: 'If you wield a shield, deal bonus damage equal to your Armor.', effect: 'shieldSlam' },
  fortress: { name: 'Fortress', use: 'Passive', text: 'Take half damage from every hit.', effect: 'fortress' },
  faultLine: { name: 'Fault Line', use: 'Reaction', range: '1', target: `Ground around its every ${FAULT.every}th creature hit up close`, makes: ['moved', 'impact'], text: `Drop the ground ${FAULT.levels} levels and deal ${FAULT.damage} damage to each alien on it.`, effect: 'faultLine' },
  aftershock: { name: 'Aftershock', use: 'At will', target: 'Beside creature hit', text: `Deal ${AFTERSHOCK_DAMAGE} damage to each alien beside it.`, effect: 'aftershock' },
  standAlone: { name: 'Stand Alone', use: 'Passive', text: `If no ally is within 2 tiles, take ${T.soak} less damage from each hit.`, effect: 'standAlone' },
  cracking: { name: 'Cracking Blow', use: 'At will', target: 'Creature hit', text: `Break ${T.crack} of its Armor.`, effect: 'cracking' },
  demolisher: { name: 'Demolisher', use: 'Passive', text: `Deal ${T.bonus} more damage to a target with Armor.`, effect: 'demolisher' },
  bedrock: { name: 'Bedrock', use: 'Passive', makes: ['armor'], text: `At the start of your turn, gain ${T.armor} Armor, up to ${T.armorMax} above your own.`, effect: 'bedrock' },
  resonance: { name: 'Resonance', use: 'Reaction', target: 'Beside creature crit', reads: ['crit'], text: `Whenever you Crit, deal ${T.zap} damage to each alien beside the target.`, effect: 'resonance' },
  artillery: { name: 'Artillery', use: 'Passive', text: `Deal ${T.bonus} more damage to a target ${T.far}+ tiles away.`, effect: 'artillery' },
  barrage: { name: 'Meteor Barrage', use: 'Passive', text: 'Gain 1 more Meteor Strike each battle.', charges: 1 },
  wrecker: { name: 'Wrecker', use: 'Passive', text: `Deal ${T.kill} more damage to a target with 2+ aliens beside it.`, effect: 'wrecker' },
  concussiveForce: { name: 'Concussive Force', use: 'Reaction', target: 'Its every 2nd creature hit up close', text: `Stun every 2nd alien you hit beside you. ${bossImmune}`, effect: 'concussiveForce' },
  // Sniper
  farSight: taught('sniper'),
  steady: { name: 'Steady Hands', use: 'Passive', text: 'If you did not move this turn, deal 1 more damage.', effect: 'steady' },
  mark: { name: "Hunter's Mark", use: 'At will', target: 'Creature hit', makes: ['mark'], text: 'Apply 1 Mark.', effect: 'mark' },
  elusive: { name: 'Elusive', use: 'Passive', text: 'Aliens more than 4 tiles away cannot shoot you.', effect: 'elusive' },
  callShot: { name: 'Called Shot', use: 'Passive', reads: ['mark'], text: `Whenever you hit a target with ${TUNING.spend.marks}+ Mark, consume it: deal 1 more damage per Mark and apply Weak.`, effect: 'spotter' },
  headshot: { name: 'Headshot', use: 'Passive', reads: ['crit'], text: 'Your Crits deal 2 more damage.', effect: 'headshot' },
  doubleTap: { name: 'Double Tap', use: 'Passive', text: 'If you did not move this turn, make a 3rd attack with your weapon.', effect: 'doubleTap' },
  assassinate: { name: 'Assassinate', use: 'Passive', makes: ['crit'], text: 'Every hit on a target at full HP is a Crit.', effect: 'assassinate' },
  combo: { name: 'Focus Fire', use: 'Passive', text: `Deal 1 more damage for each hit in a row on the same alien, up to ${COMBO_MAX}. A new target resets it.`, effect: 'combo' },
  slayer: { name: 'Colossus Slayer', use: 'Passive', text: 'Deal 2 more damage to a wounded target.', effect: 'slayer' },
  hollowPoint: { name: 'Piercing Blows', use: 'Passive', text: 'Your attacks ignore Armor.', effect: 'pierce' },
  volley: { name: 'Volley', use: 'At will', target: 'Beside creature hit', text: "Deal half the hit's damage to each alien beside it.", effect: 'volley' },
  decoy: { name: 'Mirror Image', use: 'Passive', text: 'At the start of each battle, gain 2 images. Each of the first 2 hits on you pops an image instead.', effect: 'mirror' },
  blink: { name: 'Blink', use: '1/battle', range: '5', target: 'Self', text: 'When you drop to half HP or less, teleport to the safest tile within 5.', effect: 'blink' },
  relocate: { name: 'Relocate', use: 'Reaction', text: away('move'), effect: 'skirmish' },
  sureShot: { name: 'Sure Shot', use: 'Passive', makes: ['crit'], text: 'If you did not move this turn, every hit is a Crit.', effect: 'sureShot' },
  apex: { name: 'Apex Predator', use: 'At will', target: 'Creature hit', reads: ['mark'], makes: ['mark', 'crit'], text: 'Apply 1 Mark. Every hit on a Marked alien is a Crit.', effect: 'apex' },
  ghostShot: { name: 'Ghost Shot', use: 'Passive', text: 'Your attacks pass through walls and ignore Armor.', effect: 'psionic' },
  snapShot: { name: 'Snap Shot', use: 'Passive', text: 'If you moved this turn, deal 1 more damage.', effect: 'snapShot' },
  deadeye: { name: 'Mercy Shot', use: 'Passive', makes: ['crit'], text: 'Every hit on a target at half HP or less is a Crit.', effect: 'deadeye' },
  bigGame: { name: 'Big Game', use: 'Passive', text: `Deal ${T.bonus} more damage to a target whose HP is above yours.`, effect: 'bigGame' },
  camouflage: { name: 'Camouflage', use: 'Passive', text: `If you did not move this turn, take ${T.soak} less damage from each hit.`, effect: 'camouflage' },
  shroud: { name: 'Shroud', use: 'Reaction', target: 'Self', reads: ['kill'], text: `Whenever you kill an alien ${T.far}+ tiles away, gain Cloak.`, effect: 'shroud' },
  killshot: { name: 'Killshot', use: 'Passive', text: `Deal ${T.kill} more damage to a target at a quarter HP or less.`, effect: 'killshot' },
  keenEye: { name: 'Keen Eye', use: 'Passive', makes: ['crit'], text: 'Gain 15% Crit chance.', stats: { crit: 0.15 } },
  perfectShot: { name: 'Perfect Shot', use: 'Passive', reads: ['crit'], text: `Your Crits deal ${T.kill} more damage.`, effect: 'perfectShot' },
  evasion: { name: 'Evasion', use: 'Passive', text: 'Take 1 less damage from each hit.', effect: 'dodge' },
  untouchable: { name: 'Untouchable', use: 'Passive', text: `If you did not move this turn, take ${T.kill} less damage from each hit.`, effect: 'untouchable' },
  // Engineer
  deployMech: taught('engineer'),
  titan: { name: 'Titan Frame', use: 'Passive', text: `Your mech gains ${TITAN_HEALTH} HP and 1 damage.`, effect: 'titan' },
  swarm: { name: 'Drone Swarm', use: 'Passive', text: `Deploy 2 drones instead of a mech, each with ${DRONE_STATS.hp} HP, ${DRONE_STATS.damage} damage and 2 more move. Aliens can ignore them.`, effect: 'swarm', teaches: true },
  launcher: { name: 'Caltrop Launcher', use: '1/battle', target: 'Path of an alien', text: 'Each tile costs 2 more move to cross and deals 1 damage to an alien crossing it.', effect: 'caltrops' },
  hardlight: { name: 'Hardlight Barrier', use: 'Reaction', target: 'Self', text: 'Block the first hit on you each battle.', effect: 'shield' },
  plating: { name: 'Reactive Plating', use: 'Passive', makes: ['armor'], text: `Your mech gains ${PLATING_ARMOR} Armor.`, effect: 'plating' },
  rebuild: { name: 'Field Rebuild', use: 'Passive', text: 'Deploy 1 more time each battle.', charges: 1 },
  servos: { name: 'Overclocked Servos', use: 'Passive', text: 'Your machines gain 2 move and 1 damage.', effect: 'servos' },
  detonate: { name: 'Self-Destruct', use: 'Reaction', target: 'Beside its mech', text: 'When your mech is destroyed, it deals 4 damage to each alien beside it.', effect: 'detonate' },
  spotter: { name: 'Spotter Drones', use: 'At will', target: 'Hit by drones', makes: ['mark'], text: 'Whenever your drones hit, apply 1 Mark.', effect: 'spotter' },
  linked: { name: 'Linked Targeting', use: 'Aura', range: '2 of a machine', target: 'Allies', text: 'You and allies within 2 tiles of your machine deal 1 more damage.', effect: 'linked' },
  hive: { name: 'Hive Mind', use: 'Passive', text: 'Deploy a 3rd drone.', effect: 'hive' },
  emp: { name: 'EMP Pulse', use: '1/battle', range: `${STUN_REACH} of it or machines`, target: '2+ aliens', text: `Stun each alien within ${STUN_REACH} tiles of you or your machines. ${bossImmune}`, effect: 'emp' },
  warMachine: { name: 'War Machine', use: 'Passive', text: `Your mech gains ${WAR_MACHINE.hp} HP, ${WAR_MACHINE.damage} damage and ${WAR_MACHINE.range} range.`, effect: 'warMachine' },
  endlessSwarm: { name: 'Endless Swarm', use: 'Passive', text: `At the start of your turn, if aliens are in sight, deploy a drone, up to ${SWARM_LIMIT} at once and ${SWARM_BUILDS} a battle.`, effect: 'endlessSwarm' },
  shockRounds: { name: 'Shock Rounds', use: 'Reaction', target: 'Creature crit', reads: ['crit'], text: 'Whenever you Crit, Stun the target.', effect: 'concussion' },
  tesla: { name: 'Tesla Coil', use: 'Reaction', range: `${TESLA.reach}`, target: `${TESLA.bolts} nearest aliens`, text: `After you act, deal ${TESLA.damage} damage to each of the ${TESLA.bolts} nearest aliens within ${TESLA.reach} tiles.`, effect: 'tesla' },
  mechanic: { name: 'Mechanic', use: 'Passive', text: `At the start of your turn, your machines heal ${T.heal}.`, effect: 'mechanic' },
  bodyguard: { name: 'Bodyguard', use: 'Passive', text: `While your machine is beside you, take ${T.soak} less damage from each hit.`, effect: 'bodyguard' },
  pilotLink: { name: 'Pilot Link', use: 'Passive', text: `While your machine fights, deal ${T.bonus} more damage.`, effect: 'pilotLink' },
  targetLink: { name: 'Target Link', use: 'Passive', text: `Your machines deal ${T.bonus} more damage to the alien you last hit.`, effect: 'targetLink' },
  staticCharge: { name: 'Static Charge', use: 'Reaction', target: `Its every ${T.every}rd creature hit`, text: `Stun every ${T.every}rd alien you hit. ${bossImmune}`, effect: 'staticCharge' },
  arcWelder: { name: 'Arc Welder', use: 'At will', range: `${T.reach} of creature hit`, target: 'Nearest other alien', text: `Deal ${T.zap} damage to the nearest other alien within ${T.reach} tiles of the target.`, effect: 'arcWelder' },
  overdrive: { name: 'Overdrive', use: 'Passive', text: `Your machines deal ${T.big} more damage.`, effect: 'overdrive' },
  armoredDrones: { name: 'Armored Drones', use: 'Passive', text: `Your machines take ${T.soak} less damage from each hit.`, effect: 'armoredDrones' },
  hiveQueen: { name: 'Hive Queen', use: 'Reaction', reads: ['kill'], text: `Whenever your machine kills an alien, it and you heal ${T.heal}, up to ${TUNING.healCap} a battle.`, effect: 'hiveQueen' },
  exploitFault: { name: 'Exploit Fault', use: 'Passive', text: `Deal ${TUNING.opportunistDamage} more damage to a Rooted or Stunned target.`, effect: 'opportunist' },
  staticField: { name: 'Static Field', use: 'Passive', range: '2', target: 'Aliens', text: `At the start of your turn, deal ${T.zap} damage to each alien within 2 tiles.`, effect: 'staticField' },
  // Support
  healingLight: taught('support'),
  fieldKit: { name: 'Deep Wellspring', use: 'Passive', text: 'Gain 2 more Healing Lights each battle.', charges: 2 },
  inspire: { name: 'Inspire', use: 'Aura', range: '2', target: 'It and allies', text: 'You and allies within 2 tiles deal 1 more damage.', effect: 'inspire' },
  barrier: { name: 'Shield of Faith', use: 'Passive', target: 'It and allies', makes: ['armor'], text: 'At the start of each battle, you and allies gain 2 Armor.', effect: 'barrier' },
  flashbang: { name: 'Blinding Light', use: '1/battle', range: 'Attack range', target: '2+ aliens together', text: `Stun each alien in a group of 2+ in range. ${bossImmune}`, effect: 'flashbang' },
  surgeon: { name: 'Greater Healing', use: 'Passive', text: 'Healing Light heals 3 more HP.', effect: 'surgeon' },
  revive: { name: 'Revivify', use: '1/battle', target: 'Itself, falling', text: 'When you would fall, get up with 3 HP.', effect: 'revive' },
  vitality: { name: 'Aura of Vitality', use: 'Aura', range: '2', target: 'It and wounded allies', text: 'At the start of your turn, you and wounded allies within 2 tiles heal 1.', effect: 'vitality' },
  haste: { name: 'Haste', use: 'Aura', range: '2', target: 'It and allies', text: 'You and allies within 2 tiles gain 2 move.', effect: 'haste' },
  drone: { name: 'Spirit Guardian', use: 'Reaction', range: '5', target: 'Nearest alien in sight', text: 'After you act, deal 2 damage to the nearest alien in sight within 5 tiles.', effect: 'drone' },
  forceField: { name: 'Sanctuary', use: '1/battle', target: 'Self', makes: ['armor'], text: `When you drop to half HP or less, gain ${FORCE_FIELD_ARMOR} Armor.`, effect: 'forceField' },
  ward: { name: 'Aura of Courage', use: 'Aura', range: '2', target: 'It and allies', text: 'You and allies within 2 tiles cannot be Panicked and take no damage from acid.', effect: 'ward' },
  bane: { name: 'Bane', use: 'Aura', range: '3', target: 'Aliens', text: 'Aliens within 3 tiles deal 1 less damage.', effect: 'bane' },
  gravBeam: { name: 'Gravity Lash', use: 'At will', target: 'Creature hit', text: 'Displace it 1 tile toward you.', effect: 'tether' },
  nullifier: { name: 'Silence', use: 'Aura', range: '3', target: 'Aliens', text: 'Aliens within 3 tiles cannot spit, Panic, spawn or burst.', effect: 'null' },
  fontOfLife: { name: 'Font of Life', use: 'Passive', range: `${FONT_REACH}`, target: 'Every wounded ally', text: `Healing Light heals any wound, on you and each wounded ally within ${FONT_REACH} tiles.`, effect: 'fontOfLife' },
  sacredGround: { name: 'Sacred Ground', use: 'Aura', range: `${SACRED_REACH}`, target: 'It and allies', text: `You and allies within ${SACRED_REACH} tiles take half damage from every hit.`, effect: 'sacredGround' },
  command: { name: 'Command', use: 'Reaction', target: 'Self', text: 'After you act, attack again with your weapon.', effect: 'command' },
  lifeLink: { name: 'Life Link', use: 'At will', range: `${T.reach}`, target: 'Most wounded of it and allies', text: `Whenever you hit, heal the most wounded of you and allies within ${T.reach} tiles 1, up to ${TUNING.healCap} a battle.`, effect: 'lifeLink' },
  transfusion: { name: 'Transfusion', use: 'Passive', range: `${T.reach}`, target: 'Nearest alien', text: `At the start of your turn, drain ${T.zap} HP from the nearest alien within ${T.reach} tiles.`, effect: 'transfusion' },
  rally: { name: 'Rally', use: 'Passive', range: '2', target: 'Most wounded of it and allies', makes: ['armor'], text: `At the start of your turn, the most wounded of you and allies within 2 gains ${T.armor} Armor, up to ${T.armorMax}.`, effect: 'rally' },
  retribution: { name: 'Retribution', use: 'Aura', range: `${T.reach}`, target: 'Aliens that hit it or an ally', text: `Whenever an alien hits you or an ally within ${T.reach} tiles, deal ${T.zap} damage to it.`, effect: 'retribution' },
  battleHymn: { name: 'Battle Hymn', use: 'Aura', range: '2', target: 'It and allies', reads: ['kill'], text: 'Whenever you or an ally within 2 tiles kills an alien, the killer gains 1 Might.', effect: 'battleHymn' },
  smite: { name: 'Smite', use: 'Passive', text: `Deal ${T.big} more damage to an alien beside you or an ally.`, effect: 'smite' },
  renewal: { name: 'Renewal', use: 'Passive', text: 'At the start of your turn, heal 1.', effect: 'regen' },
  wellspring: { name: 'Wellspring', use: 'Aura', range: '2', target: 'It and wounded allies', text: `At the start of your turn, you and wounded allies within 2 tiles heal ${T.mend}.`, effect: 'wellspring' },
  guardian: { name: 'Guardian Angel', use: 'Aura', range: '2', target: 'It and allies', text: `You and allies within 2 tiles take ${T.soak} less damage from each hit.`, effect: 'guardian' },
  warSong: { name: 'War Song', use: 'Aura', range: '2', target: 'It and allies', text: `You and allies within 2 tiles deal ${T.bonus} more damage.`, effect: 'warSong' },
  // Pyro
  fireball: taught('pyro'),
  tanks: { name: 'Deep Flame', use: 'Passive', text: 'Gain 1 more Fireball each battle.', charges: 1 },
  tinder: { name: 'Flame Blade', use: 'At will', target: 'Creature hit', makes: ['burn'], text: 'Apply Burn.', effect: 'tinder' },
  fanFlames: { name: 'Fan the Flames', use: 'At will', target: 'Burning creature hit', reads: ['burn'], makes: ['burn'], text: `If it has Burn, apply ${TUNING.fanStacks} more Burn.`, effect: 'fanFlames' },
  fireSuit: { name: 'Flameborn', use: 'Passive', text: 'You are immune to Burn.', effect: 'fireSuit' },
  inferno: { name: 'Inferno', use: 'Passive', makes: ['burn'], text: 'Fireball spreads to each alien within 2 tiles of where it lands.', effect: 'inferno' },
  backdraft: { name: 'Backdraft', use: 'Reaction', target: 'Beside its burning kill', reads: ['burn', 'kill'], makes: ['burn'], text: 'Whenever you kill an alien with Burn, apply Burn to each alien beside it.', effect: 'backdraft' },
  asbestos: { name: 'Hide of Cinders', use: 'Passive', text: 'Gain 3 HP.', stats: { hp: 3 } },
  searing: { name: 'Searing', use: 'Passive', reads: ['burn'], text: `Deal ${SEARING_DAMAGE} more damage to a target with Burn.`, effect: 'searing' },
  stoke: { name: 'Stoke', use: 'Passive', reads: ['burn'], text: `Whenever you hit a target with ${TUNING.spend.burns}+ Burn, consume it: deal 1 more damage and gain 1 Temp HP per Burn.`, effect: 'accelerant' },
  smolder: { name: 'Smolder', use: 'Passive', reads: ['burn'], makes: ['burn'], text: `Whenever you apply Burn, apply ${LINGER_STACKS} more.`, effect: 'smolder' },
  burningAura: { name: 'Fire Shield', use: 'Reaction', target: 'Whoever hits it', text: 'Whenever an alien hits you, deal 1 damage to it.', effect: 'thorns' },
  phoenixHeart: { name: 'Phoenix Heart', use: 'Passive', text: 'At the start of your turn, heal 1.', effect: 'regen' },
  firestorm: { name: 'Firestorm', use: 'Passive', reads: ['kill'], text: 'Whenever Fireball kills an alien, regain its use.', effect: 'firestorm' },
  conflagration: { name: 'Conflagration', use: 'Passive', reads: ['burn'], makes: ['burn'], text: `Aliens with Burn take ${CONFLAGRATION_DAMAGE} more damage each turn and apply Burn to aliens beside them.`, effect: 'conflagration' },
  hellfire: { name: 'Hellfire', use: 'Aura', range: `${HELLFIRE_REACH}`, target: 'Aliens', makes: ['burn'], text: `At the start of each alien's turn, if it is within ${HELLFIRE_REACH} tiles, apply Burn to it.`, effect: 'hellfire' },
  pyromania: { name: 'Pyromania', use: 'Passive', reads: ['burn'], text: 'Deal 1 more damage for every 2 aliens with Burn, up to 3.', effect: 'pyromania' },
  cauterize: { name: 'Cauterize', use: 'Reaction', reads: ['burn', 'kill'], text: `Whenever you kill an alien with Burn, heal ${T.heal}, up to ${TUNING.healCap} a battle.`, effect: 'cauterize' },
  combust: { name: 'Combust', use: 'At will', target: 'Burning creature hit', reads: ['burn'], text: 'Remove its Burn. Deal 1 damage per Burn removed.', effect: 'combust' },
  meltdown: { name: 'Meltdown', use: 'At will', target: 'Burning creature hit', reads: ['burn'], text: `If it has Burn, break ${T.crack} of its Armor.`, effect: 'meltdown' },
  heatShield: { name: 'Heat Shield', use: 'Passive', reads: ['burn'], text: 'Take 1 less damage from each hit per alien with Burn within 2 tiles, up to 3.', effect: 'heatShield' },
  cinderSkin: { name: 'Cinder Skin', use: 'Reaction', target: 'Whoever hits it up close', reads: ['hurt'], makes: ['burn'], text: 'Whenever an alien beside you hits you, apply Burn to it.', effect: 'cinderSkin' },
  kindling: { name: 'Kindling', use: 'Passive', text: `Deal ${T.bonus} more damage to a target without Burn.`, effect: 'kindling' },
  whiteHeat: { name: 'White Heat', use: 'Passive', reads: ['burn'], text: `Deal ${T.kill} more damage to a target with Burn.`, effect: 'whiteHeat' },
  spread: { name: 'Spreading Flames', use: 'At will', target: 'Alien beside burning creature hit', reads: ['burn'], makes: ['burn'], text: 'If it has Burn, apply Burn to an alien beside it without any.', effect: 'spread' },
  firebrand: { name: 'Firebrand', use: 'Passive', reads: ['burn'], text: 'Deal 1 more damage per Burn on the target.', effect: 'firebrand' },
  emberWard: { name: 'Ember Ward', use: 'Passive', reads: ['burn'], text: `Take ${T.soak} less damage from each hit by an alien with Burn.`, effect: 'emberWard' },
  emberHeart: { name: 'Ember Heart', use: 'Passive', reads: ['burn'], text: `At the start of your turn, if an alien within 2 tiles has Burn, heal ${T.heal}.`, effect: 'emberHeart' },
  // Cryo
  chillTouch: taught('cryo'),
  icebreak: { name: 'Icebreaker', use: 'Passive', reads: ['chill'], text: `Deal ${SEARING_DAMAGE} more damage to a Chilled target.`, effect: 'icebreak' },
  permafrost: { name: 'Permafrost', use: 'Passive', reads: ['chill'], makes: ['chill'], text: `Whenever you apply Chill, apply ${LINGER_STACKS} more.`, effect: 'permafrost' },
  iceArmor: { name: 'Ice Armor', use: 'Passive', makes: ['armor'], text: 'Gain 3 Armor.', stats: { armor: 3 } },
  coldSteel: { name: 'Cold Steel', use: 'Passive', text: 'Deal 1 more damage.', stats: { damage: 1 } },
  deepFreeze: { name: 'Deep Freeze', use: 'Reaction', target: 'Chilled alien crit', reads: ['crit', 'chill'], text: 'Whenever you Crit a Chilled alien, Stun it.', effect: 'deepFreeze' },
  rimeLock: { name: 'Rime Lock', use: 'At will', target: 'Alien it chills', reads: ['chill'], text: 'Whenever you apply Chill, Root the target.', effect: 'rimeLock' },
  glassEdge: { name: 'Glass Edge', use: 'Passive', reads: ['chill'], text: `Whenever you hit a target with ${TUNING.spend.chills}+ Chill, consume it: deal 1 more damage per Chill and Stun it.`, effect: 'glassEdge' },
  longRange: { name: 'Long Reach', use: 'Passive', text: 'Your bonus attack reaches 2 tiles farther.', effect: 'longshot' },
  frostAura: { name: 'Frost Aura', use: 'Reaction', target: 'Whoever hits it', reads: ['hurt'], makes: ['chill'], text: 'Whenever an alien hits you, apply Chill to it.', effect: 'rime' },
  glide: { name: 'Ice Glide', use: 'Reaction', text: away('slide'), effect: 'skirmish' },
  cryostasis: { name: 'Cryostasis', use: '1/battle', target: 'Self', text: 'When you would fall, survive at 1 HP.', effect: 'lastStand' },
  frozenHeart: { name: 'Frozen Heart', use: 'At will', target: 'Chilled alien hit', reads: ['chill'], text: 'Whenever you hit a Chilled alien, Freeze it.', effect: 'frozenHeart' },
  glacialArmor: { name: 'Glacial Armor', use: 'Passive', makes: ['armor'], text: 'At the start of your turn, restore your Armor in full.', effect: 'glacialArmor' },
  rimeGrip: { name: 'Rime Grip', use: 'Passive', text: `Deal ${TUNING.gripDamage} more damage to a target beside you.`, effect: 'rimeGrip' },
  shardstorm: { name: 'Shardstorm', use: 'At will', target: 'Beside creature hit', makes: ['chill'], text: `Deal ${SHARD_DAMAGE} damage to each alien beside it and apply Chill to them.`, effect: 'shardstorm' },
  flashFreeze: { name: 'Flash Freeze', use: 'At will', target: 'Chilled creature hit', reads: ['chill'], makes: ['chill'], text: 'If it has Chill, apply 1 more Chill.', effect: 'flashFreeze' },
  shatterpoint: { name: 'Shatterpoint', use: 'Passive', reads: ['chill'], text: `Deal ${T.big} more damage to a Frozen target.`, effect: 'shatterpoint' },
  coldSnap: { name: 'Cold Snap', use: 'Aura', range: '1', target: 'Aliens', makes: ['chill'], text: 'At the start of your turn, apply Chill to each alien beside you.', effect: 'coldSnap' },
  frostShell: { name: 'Frost Shell', use: 'Passive', reads: ['chill'], text: `Take ${T.soak} less damage from each hit by a Chilled alien.`, effect: 'frostShell' },
  splinter: { name: 'Splinter', use: 'Reaction', target: 'Beside creature crit', reads: ['crit'], makes: ['chill'], text: 'Whenever you Crit, apply Chill to each alien beside the target.', effect: 'splinter' },
  iceSpear: { name: 'Ice Spear', use: 'Passive', reads: ['chill'], text: 'Your hits on a Chilled target ignore Armor.', effect: 'iceSpear' },
  brittle: { name: 'Brittle', use: 'Passive', reads: ['chill'], text: `Deal ${T.kill} more damage to a Chilled target.`, effect: 'brittle' },
  iceAge: { name: 'Ice Age', use: 'Reaction', target: 'Beside its chilled kill', reads: ['chill', 'kill'], text: `Whenever you kill a Chilled alien, Stun each alien beside it. ${bossImmune}`, effect: 'iceAge' },
  polarVortex: { name: 'Polar Vortex', use: 'Aura', range: '2', target: 'Aliens', makes: ['chill'], text: 'At the start of your turn, apply Chill to each alien within 2 tiles.', effect: 'polarVortex' },
  iceLance: { name: 'Ice Lance', use: 'Passive', text: `Deal ${T.bonus} more damage to a target ${T.far}+ tiles away.`, effect: 'artillery' },
  glacialSpike: { name: 'Glacial Spike', use: 'Passive', reads: ['crit'], text: `Your Crits deal ${T.kill} more damage.`, effect: 'perfectShot' },
  // Phantom
  cloak: taught('phantom'),
  shadowStrike: { name: 'Shadow Strike', use: 'Passive', text: `Your attack out of Cloak deals ${SHADOW_DAMAGE} more damage.`, effect: 'shadowStrike' },
  vanish: { name: 'Vanish', use: '1/battle', target: 'Self', text: 'When you drop to half HP or less, gain Cloak.', effect: 'vanish' },
  daze: { name: 'Unseen Blade', use: 'At will', target: 'Creature hit out of Cloak', text: `Your attack out of Cloak Stuns its target. ${bossImmune}`, effect: 'daze' },
  deepCloak: { name: 'Deep Cloak', use: 'Passive', text: 'Gain 1 more Cloak each battle.', charges: 1 },
  afterimage: { name: 'Afterimage', use: 'Reaction', target: 'Self', reads: ['kill'], text: 'Whenever you kill an alien out of Cloak, gain Cloak again.', effect: 'afterimage' },
  knifeWork: { name: 'Knife Work', use: 'Passive', text: 'Deal 2 more damage to a target with no alien beside it.', effect: 'backstab' },
  phaseShift: { name: 'Phase Shift', use: 'Passive', text: 'Take 1 less damage from each hit.', effect: 'dodge' },
  fadeOut: { name: 'Fade Out', use: 'Reaction', text: away('move'), effect: 'skirmish' },
  shadowStep: { name: 'Shadow Step', use: 'Passive', text: 'Gain 2 move.', stats: { move: 2 } },
  flurry: { name: 'Flurry', use: 'Passive', makes: ['shots'], text: 'A weapon with 2+ shots fires 1 more.', effect: 'hairTrigger' },
  smokeBomb: { name: 'Darkness', use: '1/battle', range: 'Attack range', target: '2+ aliens together', text: `Stun each alien in a group of 2+ in range. ${bossImmune}`, effect: 'flashbang' },
  livingShadow: { name: 'Living Shadow', use: 'Passive', text: 'Attacking does not end your Cloak.', effect: 'livingShadow' },
  intangible: { name: 'Intangible', use: 'Passive', text: 'Each hit on you has a 50% chance to miss.', effect: 'intangible' },
  opportunist: { name: 'Opportunist', use: 'Passive', text: `Deal ${TUNING.opportunistDamage} more damage to a Rooted or Stunned target.`, effect: 'opportunist' },
  bladeDance: { name: 'Blade Dance', use: 'At will', text: `Your bonus attack also hits ${FAN_TARGETS} more aliens in reach.`, effect: 'bladeDance' },
  ambush: { name: 'Ambush', use: 'Passive', text: `Your first hit each battle deals ${T.big} more damage.`, effect: 'ambush' },
  shadowFeed: { name: 'Shadow Feed', use: 'Reaction', reads: ['kill'], text: `Whenever you kill an alien, heal ${T.heal}, up to ${TUNING.healCap} a battle.`, effect: 'shadowFeed' },
  wraithForm: { name: 'Wraith Form', use: 'Passive', text: `While at half HP or less, take ${T.soak} less damage from each hit.`, effect: 'wraithForm' },
  soulDrain: { name: 'Soul Drain', use: 'At will', target: 'Self', text: `Whenever you hit, heal 1, up to ${TUNING.healCap} a battle.`, effect: 'soulDrain' },
  venom: { name: 'Venom', use: 'At will', target: 'Creature hit', text: 'Apply Weak.', effect: 'venom' },
  bloodScent: { name: 'Blood Scent', use: 'Passive', text: `Deal ${T.bonus} more damage to a target at half HP or less.`, effect: 'bloodScent' },
  killerInstinct: { name: 'Killer Instinct', use: 'Passive', makes: ['crit'], text: 'Gain 15% Crit chance.', stats: { crit: 0.15 } },
  nightmare: { name: 'Nightmare', use: 'Reaction', range: '2', target: 'Aliens around its kill', reads: ['kill'], text: `Whenever you kill an alien, Stun each alien within 2 tiles of it. ${bossImmune}`, effect: 'nightmare' },
  deathless: { name: 'Deathless', use: '1/battle', target: 'Self', text: 'When you would fall, survive at 1 HP.', effect: 'lastStand' },
  soulHarvest: { name: 'Soul Harvest', use: 'Reaction', reads: ['kill'], text: `Whenever you kill an alien, heal ${T.heal}, up to ${TUNING.healCap} a battle, and gain 1 Might.`, effect: 'soulHarvest' },
  cutthroat: { name: 'Cutthroat', use: 'Passive', text: `Deal ${TUNING.gripDamage} more damage to a target beside you.`, effect: 'rimeGrip' },
  thousandCuts: { name: 'Thousand Cuts', use: 'Passive', text: 'Deal 1 more damage for every 2 hits you landed this battle, up to 4.', effect: 'thousandCuts' },
  // Ultimates, each once a battle
  killingSpree: { name: 'Killing Spree', use: '1/battle', range: `${SPREE.reach}`, target: `Up to ${SPREE.strikes} aliens in turn`, text: `Flash to each target in turn and deal your damage plus ${SPREE.damage}.`, effect: 'killingSpree' },
  indestructible: { name: 'Indestructible', use: '1/battle', target: 'Self at half HP', text: `When you drop to half HP or less, take no damage for ${INDESTRUCTIBLE.turns} turns and gain ${INDESTRUCTIBLE.damage} Might.`, effect: 'indestructible' },
  levelBlock: { name: 'Level the Block', use: '1/battle', range: `${LEVEL_BLOCK.radius}`, target: '2+ aliens', text: `Bring down everything standing within ${LEVEL_BLOCK.radius} tiles. Deal ${LEVEL_BLOCK.damage} damage to each alien.`, effect: 'levelBlock' },
  extinction: { name: 'Extinction Event', use: '1/battle', target: `${EXTINCTION.meteors} meteors, thickest knots`, text: `Each meteor deals ${EXTINCTION.damage} damage to aliens within ${EXTINCTION.radius} tiles and flattens the ground.`, effect: 'extinction' },
  titanForm: { name: 'Titan Form', use: '1/battle', target: 'Self at half HP', text: `When you drop to half HP or less, gain ${TITAN_FORM.hp} HP, ${TITAN_FORM.armor} Armor and ${TITAN_FORM.damage} damage. Heal to full.`, effect: 'titanForm' },
  earthquake: { name: 'Earthquake', use: '1/battle', range: `${QUAKE.radius}`, target: '2+ aliens', text: `Deal ${QUAKE.damage} damage to each alien within ${QUAKE.radius} tiles and Stun them, bosses too.`, effect: 'earthquake' },
  bulletTime: { name: 'Bullet Time', use: '1/battle', target: `Up to ${BULLET_TIME.targets} aliens in sight`, text: `Crit each target for ${BULLET_TIME.damage} more damage.`, effect: 'bulletTime' },
  deathSentence: { name: 'Death Sentence', use: '1/battle', target: 'Toughest alien, boss or not', text: `Deal half its HP plus ${SENTENCE} damage, ignoring Armor.`, effect: 'deathSentence' },
  hallOfMirrors: { name: 'Hall of Mirrors', use: '1/battle', target: 'Self', text: `Summon ${MIRRORS.images} images with ${MIRRORS.hp} HP. They attack and draw every alien's fire.`, effect: 'hallOfMirrors' },
  colossus: { name: 'Colossus', use: '1/battle', target: 'Beside it', text: `Deploy a colossus with ${COLOSSUS.hp} HP, ${COLOSSUS.armor} Armor and ${COLOSSUS.damage} damage. Every alien that can shoot it must.`, effect: 'colossus' },
  droneStorm: { name: 'Drone Storm', use: '1/battle', target: 'Aliens in the fight', text: `Rain ${DRONE_STORM.strikes} strikes of ${DRONE_STORM.damage} damage among the aliens.`, effect: 'droneStorm' },
  orbital: { name: 'Orbital Lance', use: '1/battle', range: `Line of ${ORBITAL.length}`, target: 'The line through the most aliens', text: `Deal ${ORBITAL.damage} damage to each alien on the line, ignoring Armor, and flatten it.`, effect: 'orbital' },
  resurrection: { name: 'Resurrection', use: '1/battle', target: 'Itself, at a third of HP or less', text: 'When you drop to a third of your HP or less, heal to full.', effect: 'resurrection' },
  divineShield: { name: 'Divine Shield', use: '1/battle', target: 'It and allies, at half HP', text: `When you drop to half HP or less, you and allies take no damage for ${SHIELD_TURNS} turns.`, effect: 'divineShield' },
  timeStop: { name: 'Time Stop', use: '1/battle', target: 'Every alien, boss too', text: `Every alien, bosses too, skips its next ${TIME_STOP} turns.`, effect: 'timeStop' },
  supernova: { name: 'Supernova', use: '1/battle', range: `${SUPERNOVA.radius}`, target: '2+ aliens', makes: ['burn'], text: `Deal ${SUPERNOVA.damage} damage to each alien within ${SUPERNOVA.radius} tiles and apply Burn. Lose half your HP.`, effect: 'supernova' },
  worldAblaze: { name: 'World Ablaze', use: '1/battle', target: 'Every alien in the fight', makes: ['burn'], text: `Destroy every alien's Armor and deal ${ABLAZE.damage} damage. Apply ${ABLAZE.burn} Burn to each on fire tiles.`, effect: 'worldAblaze' },
  phoenixRising: { name: 'Phoenix Rising', use: '1/battle', range: `${PHOENIX_RISING.radius}`, target: 'Self, as it falls', makes: ['burn'], text: `When you would fall, heal to full. Deal ${PHOENIX_RISING.damage} damage to each alien within ${PHOENIX_RISING.radius} tiles and apply Burn.`, effect: 'phoenixRising' },
  absoluteZero: { name: 'Absolute Zero', use: '1/battle', target: 'Every alien in the fight', makes: ['chill'], text: `Deal ${ZERO.damage} damage to every alien, ignoring Armor. Each skips ${ZERO.frozen} turns, a boss 1.`, effect: 'absoluteZero' },
  blizzard: { name: 'Blizzard', use: '1/battle', range: `${BLIZZARD.radius}`, target: 'Aliens around it', makes: ['chill'], text: `For ${BLIZZARD.turns} turns, deal ${BLIZZARD.damage} damage to each alien within ${BLIZZARD.radius} tiles and apply Chill.`, effect: 'blizzard' },
  hailOfIcicles: { name: 'Hail of Icicles', use: '1/battle', target: 'Aliens in the fight', makes: ['chill'], text: `Rain ${HAIL.shards} shards of ${HAIL.damage} damage among the aliens. Each applies Chill.`, effect: 'hailOfIcicles' },
  eclipse: { name: 'Eclipse', use: '1/battle', target: 'Itself', text: 'Gain Cloak.', effect: 'eclipse' },
  reap: { name: 'Reap', use: '1/battle', target: 'Every alien in the fight', text: 'Kill every alien at half HP or less, bosses aside. The rest lose half their HP.', effect: 'reap' },
  phantomLegion: { name: 'Phantom Legion', use: '1/battle', target: `${LEGION.blades} strikes in the fight`, text: `Shadows strike ${LEGION.blades} times for your damage plus ${LEGION.damage}, ignoring Armor.`, effect: 'phantomLegion' },
} satisfies Record<string, Skill>

export type SkillId = keyof typeof skills
export const SKILLS: Record<SkillId, Skill> = skills

const tree = (power: SkillId, ...paths: Path[]): Tree => ({ power, paths })
const path = (name: string, ...rows: SkillId[][]): Path => ({ name, rows })

export const TREES: Record<ClassId, Tree> = {
  assault: tree('mightyBound',
    path('Rampage', ['rage'], ['cleave', 'bloodlust', 'battleJoy'], ['bloodbath', 'surge', 'thunderclap'], ['killingSpree', 'carnage', 'berserk']),
    path('Ironhide', ['bracer'], ['secondWind', 'grit', 'vengeance'], ['riposte', 'unbreakable', 'hunker'], ['indestructible', 'skirmish', 'hardened']),
    path('Juggernaut', ['leap'], ['sprinter', 'charge', 'hamstring'], ['earthshaker', 'projectile', 'bully'], ['levelBlock', 'hurl', 'tremor'])),
  heavy: tree('meteorStrike',
    path('Cataclysm', ['arsenal'], ['artillery', 'bigBlast', 'cracking'], ['impact', 'shredder', 'barrage'], ['extinction', 'demolisher', 'wrecker']),
    path('Bastion', ['bulwark'], ['reactive', 'standAlone', 'spikes'], ['fortress', 'lasting', 'steadfast'], ['titanForm', 'bedrock', 'shieldSlam']),
    path('Shockwave', ['suppression'], ['repulse', 'concussion', 'kineticCore'], ['faultLine', 'aftershock', 'resonance'], ['earthquake', 'slam', 'concussiveForce'])),
  sniper: tree('farSight',
    path('Marksman', ['steady'], ['headshot', 'snapShot', 'doubleTap'], ['sureShot', 'assassinate', 'keenEye'], ['bulletTime', 'deadeye', 'perfectShot']),
    path('Hunter', ['mark'], ['bigGame', 'callShot', 'combo'], ['apex', 'slayer', 'volley'], ['deathSentence', 'hollowPoint', 'killshot']),
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
    path('Immolation', ['tinder'], ['smolder', 'meltdown', 'stoke'], ['conflagration', 'backdraft', 'spread'], ['worldAblaze', 'combust', 'firebrand']),
    path('Ember Hide', ['fireSuit'], ['cinderSkin', 'asbestos', 'burningAura'], ['hellfire', 'heatShield', 'emberWard'], ['phoenixRising', 'phoenixHeart', 'emberHeart'])),
  cryo: tree('chillTouch',
    path('Hoarfrost', ['icebreak'], ['permafrost', 'flashFreeze', 'rimeLock'], ['brittle', 'deepFreeze', 'shatterpoint'], ['absoluteZero', 'frozenHeart', 'iceAge']),
    path('Glacier', ['iceArmor'], ['frostAura', 'coldSnap', 'glide'], ['glacialArmor', 'cryostasis', 'gale'], ['blizzard', 'frostShell', 'polarVortex']),
    path('Icicle', ['coldSteel'], ['glassEdge', 'splinter', 'longRange'], ['shardstorm', 'iceSpear', 'iceLance'], ['hailOfIcicles', 'rimeGrip', 'glacialSpike'])),
  phantom: tree('cloak',
    path('Shade', ['shadowStrike'], ['ambush', 'daze', 'deepCloak'], ['livingShadow', 'afterimage', 'killerInstinct'], ['eclipse', 'shadowFeed', 'nightmare']),
    path('Wraith', ['vanish'], ['phaseShift', 'wraithForm', 'shadowStep'], ['intangible', 'fadeOut', 'deathless'], ['reap', 'soulDrain', 'soulHarvest']),
    path('Knives', ['knifeWork'], ['venom', 'flurry', 'opportunist'], ['bladeDance', 'bloodScent', 'cutthroat'], ['phantomLegion', 'smokeBomb', 'thousandCuts'])),
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
