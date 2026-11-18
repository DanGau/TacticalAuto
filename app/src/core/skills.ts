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
  SKIRMISH_MOVE,
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

/** A class's ability as a skill to learn. */
const taught = (cls: ClassId) => ({ ...classPower(CLASSES[cls], CLASSES[cls].charges), teaches: true as const })

/** After the hero acts, it steps away. */
const retreat = `Retreat ${SKIRMISH_MOVE}.`

const skills = {
  // Assault
  mightyBound: taught('assault'),
  bloodlust: { name: 'Bloodlust', use: 'Reaction', reads: ['kill'], text: 'On kill, attack again with that weapon.', effect: 'frenzy' },
  bracer: { name: 'Bracer', use: 'Passive', makes: ['armor'], text: `On hit, gain 1 Armor, up to ${GUARD_MAX} above base.`, effect: 'braced' },
  leap: { name: 'Heroic Leap', use: '1/battle', range: '2× move', target: 'Thickest knot', text: `Deal ${LEAP_DAMAGE} damage to aliens adjacent to where you land. Root them.`, effect: 'leap' },
  rage: { name: 'Rage', use: 'Passive', text: 'At half HP or less, deal 2 more damage.', effect: 'rage' },
  cleave: { name: 'Cleave', use: 'Reaction', reads: ['kill'], text: 'On kill, deal 2 damage to adjacent aliens.', effect: 'cleave' },
  surge: { name: 'Action Surge', use: '1/battle', text: 'Attack 1 more time this turn.', effect: 'surge' },
  skirmish: { name: 'Skirmisher', use: 'Reaction', text: retreat, effect: 'skirmish' },
  secondWind: { name: 'Second Wind', use: '1/battle', target: 'Self', text: 'At half HP or less: heal 5. Still attack.', effect: 'secondWind' },
  unbreakable: { name: 'Unbreakable', use: '1/battle', target: 'Self', text: 'When you would fall: survive at 1 HP.', effect: 'lastStand' },
  hurl: { name: 'Hurl', use: 'At will', target: 'Creature hit', makes: ['moved', 'impact'], text: `Knockback ${HURL_TILES}. Impact: deal ${HURL_DAMAGE} damage.`, effect: 'hurl' },
  hamstring: { name: 'Crippling Blow', use: 'At will', target: 'Creature hit', text: 'Root it.', effect: 'snare' },
  sprinter: { name: 'Super Speed', use: 'Passive', text: 'Gain 2 move.', stats: { move: 2 } },
  bloodbath: { name: 'Bloodbath', use: 'Reaction', reads: ['kill'], text: `On kill, heal ${BLOODBATH_HEAL} and gain 1 Might.`, effect: 'bloodbath' },
  riposte: { name: 'Riposte', use: 'Reaction', target: 'Attacker', text: 'When hit: deal that damage back, at any range.', effect: 'riposte' },
  projectile: { name: 'Living Projectile', use: 'At will', target: 'Alien a thrown one lands on', reads: ['moved'], makes: ['impact'], text: "Deal the thrown alien's HP as damage. Throw without Heave.", effect: 'projectile' },
  earthshaker: { name: 'Earthshaker', use: 'Passive', text: `Use Heroic Leap at will. It deals ${EARTHSHAKER_DAMAGE} more damage.`, effect: 'earthshaker' },
  battleJoy: { name: 'Battle Joy', use: 'Passive', text: `Above half HP, deal ${T.bonus} more damage.`, effect: 'battleJoy' },
  grit: { name: 'Grit', use: 'Passive', text: `Take ${T.soak} less damage from adjacent aliens.`, effect: 'grit' },
  charge: { name: 'Charge', use: 'Passive', text: `If you moved, deal ${T.bonus} more damage.`, effect: 'charge' },
  vengeance: { name: 'Vengeance', use: 'Reaction', target: 'Self, when hit', text: 'When hit: gain 1 Might.', effect: 'vengeance' },
  carnage: { name: 'Carnage', use: 'Reaction', reads: ['kill'], text: `On kill, gain 1 move for the battle, up to ${T.moveMax}.`, effect: 'carnage' },
  thunderclap: { name: 'Thunderclap', use: 'Reaction', target: 'Adjacent to its adjacent kill', reads: ['kill'], text: 'On kill of an adjacent alien, Stun aliens adjacent to it.', effect: 'thunderclap' },
  berserk: { name: 'Berserker', use: 'Passive', reads: ['hurt'], makes: ['crit'], text: 'At half HP or less, every hit Crits.', effect: 'berserk' },
  hunker: { name: 'Hunker Down', use: 'Passive', text: `Take ${T.soak} less damage from hits 2+ tiles away.`, effect: 'hunker' },
  hardened: { name: 'Hardened', use: 'Reaction', target: 'Self, when hit', reads: ['hurt'], makes: ['armor'], text: `When hit: gain 1 Armor for the battle, up to ${T.hardMax}.`, effect: 'hardened' },
  bully: { name: 'Bully', use: 'Passive', text: `Deal ${T.bonus} more damage to targets with HP below yours.`, effect: 'bully' },
  tremor: { name: 'Tremor', use: 'Passive', range: '1', target: 'Aliens', text: `Start of turn: deal ${T.zap} damage to adjacent aliens.`, effect: 'tremor' },
  // Heavy
  meteorStrike: taught('heavy'),
  arsenal: { name: 'Second Meteor', use: 'Passive', text: '1 more Meteor Strike each battle.', charges: 1 },
  bulwark: { name: 'Bulwark', use: 'Aura', range: '2', target: 'It and allies', text: 'You and allies within 2 tiles take 1 less damage per hit.', effect: 'bulwark' },
  suppression: { name: 'Staggering Blow', use: 'At will', target: 'Creature hit', text: 'Apply Weak.', effect: 'suppress' },
  bigBlast: { name: 'Greater Meteor', use: 'Passive', text: 'Meteor Strike hits aliens within 2 tiles.', effect: 'bigBlast' },
  shredder: { name: 'Sundering Blow', use: 'At will', target: 'Creature hit', text: 'Destroy its Armor, then deal damage.', effect: 'shred' },
  repulse: { name: 'Repulsor', use: 'At will', target: 'Creature hit', makes: ['moved', 'impact'], text: `Knockback ${REPULSE_TILES}.`, effect: 'repulse' },
  gale: { name: 'Gale', use: 'Reaction', target: 'Creature crit', reads: ['crit'], makes: ['moved', 'impact'], text: `On Crit, Knockback ${REPULSE_TILES}.`, effect: 'gale' },
  concussion: { name: 'Concussive Blows', use: 'Reaction', target: 'Creature crit', reads: ['crit'], text: 'On Crit, Stun.', effect: 'concussion' },
  spikes: { name: 'Spiked Plate', use: 'Reaction', target: 'Attacker', text: 'Thorns 1.', effect: 'thorns' },
  steadfast: { name: 'Steadfast', use: 'Passive', text: 'Immune to Panic, acid and explosions.', effect: 'steadfast' },
  reactive: { name: 'Stone Skin', use: 'Passive', makes: ['armor'], text: 'Gain 4 Armor.', stats: { armor: 4 } },
  slam: { name: 'Ground Slam', use: '1/battle', range: 'Adjacent', target: '2+ aliens', text: `Instead of attacking, deal ${SLAM_HIT} damage to adjacent aliens. Knockback ${SLAM_TILES}.`, effect: 'slam' },
  kineticCore: { name: 'Kinetic Core', use: 'Passive', reads: ['impact'], text: 'Impact: deal your damage again.', effect: 'impetus' },
  impact: { name: 'Impact', use: 'Passive', text: `Meteor Strike deals ${IMPACT_DAMAGE} more damage and can target a lone alien.`, effect: 'impact' },
  lasting: { name: 'Lasting Guard', use: 'Passive', reads: ['armor'], makes: ['armor'], text: 'Start of turn: restore Armor, plus half what you kept, up to double.', effect: 'lasting' },
  shieldSlam: { name: 'Shield Slam', use: 'At will', target: 'Creature hit with a shield', reads: ['armor'], text: 'With a shield, deal extra damage equal to your Armor.', effect: 'shieldSlam' },
  fortress: { name: 'Fortress', use: 'Passive', text: 'Take half damage.', effect: 'fortress' },
  faultLine: { name: 'Fault Line', use: 'Reaction', range: '1', target: `Ground around its every ${FAULT.every}th creature hit up close`, makes: ['moved', 'impact'], text: `Drop the ground ${FAULT.levels} levels. Deal ${FAULT.damage} damage to aliens on it.`, effect: 'faultLine' },
  aftershock: { name: 'Aftershock', use: 'At will', target: 'Adjacent to creature hit', text: `Deal ${AFTERSHOCK_DAMAGE} damage to adjacent aliens.`, effect: 'aftershock' },
  standAlone: { name: 'Stand Alone', use: 'Passive', text: `With no ally within 2 tiles, take ${T.soak} less damage per hit.`, effect: 'standAlone' },
  cracking: { name: 'Cracking Blow', use: 'At will', target: 'Creature hit', text: `Break ${T.crack} of its Armor.`, effect: 'cracking' },
  demolisher: { name: 'Demolisher', use: 'Passive', text: `Deal ${T.bonus} more damage to a target with Armor.`, effect: 'demolisher' },
  bedrock: { name: 'Bedrock', use: 'Passive', makes: ['armor'], text: `Start of turn: gain ${T.armor} Armor, up to ${T.armorMax} above base.`, effect: 'bedrock' },
  resonance: { name: 'Resonance', use: 'Reaction', target: 'Adjacent to creature crit', reads: ['crit'], text: `On Crit, deal ${T.zap} damage to aliens adjacent to the target.`, effect: 'resonance' },
  artillery: { name: 'Artillery', use: 'Passive', text: `Deal ${T.bonus} more damage to targets ${T.far}+ tiles away.`, effect: 'artillery' },
  barrage: { name: 'Meteor Barrage', use: 'Passive', text: '1 more Meteor Strike each battle.', charges: 1 },
  wrecker: { name: 'Wrecker', use: 'Passive', text: `Deal ${T.kill} more damage to targets with 2+ adjacent aliens.`, effect: 'wrecker' },
  concussiveForce: { name: 'Concussive Force', use: 'Reaction', target: 'Every 2nd adjacent creature hit', text: 'Stun every 2nd adjacent alien you hit.', effect: 'concussiveForce' },
  // Sniper
  farSight: taught('sniper'),
  steady: { name: 'Steady Hands', use: 'Passive', text: 'If you did not move, deal 1 more damage.', effect: 'steady' },
  mark: { name: "Hunter's Mark", use: 'At will', target: 'Creature hit', makes: ['mark'], text: 'Apply 1 Mark.', effect: 'mark' },
  elusive: { name: 'Elusive', use: 'Passive', text: 'Aliens more than 4 tiles away cannot shoot you.', effect: 'elusive' },
  callShot: { name: 'Called Shot', use: 'Passive', reads: ['mark'], text: `On hit with ${TUNING.spend.marks}+ Mark, Consume it: deal 1 more damage per Mark. Apply Weak.`, effect: 'spotter' },
  headshot: { name: 'Headshot', use: 'Passive', reads: ['crit'], text: 'Crits deal 2 more damage.', effect: 'headshot' },
  doubleTap: { name: 'Double Tap', use: 'Passive', text: 'If you did not move, attack a 3rd time.', effect: 'doubleTap' },
  assassinate: { name: 'Assassinate', use: 'Passive', makes: ['crit'], text: 'Hits on targets at full HP Crit.', effect: 'assassinate' },
  combo: { name: 'Focus Fire', use: 'Passive', text: `Deal 1 more damage per hit in a row on the same alien, up to ${COMBO_MAX}.`, effect: 'combo' },
  slayer: { name: 'Colossus Slayer', use: 'Passive', text: 'Deal 2 more damage to wounded targets.', effect: 'slayer' },
  hollowPoint: { name: 'Piercing Blows', use: 'Passive', text: 'Ignore Armor.', effect: 'pierce' },
  volley: { name: 'Volley', use: 'At will', target: 'Adjacent to creature hit', text: 'Half the damage splashes to adjacent aliens.', effect: 'volley' },
  decoy: { name: 'Mirror Image', use: 'Passive', text: 'Start of battle: gain 2 images. Each takes 1 hit for you.', effect: 'mirror' },
  blink: { name: 'Blink', use: '1/battle', range: '5', target: 'Self', text: 'At half HP or less: teleport to the safest tile within 5.', effect: 'blink' },
  relocate: { name: 'Relocate', use: 'Reaction', text: retreat, effect: 'skirmish' },
  sureShot: { name: 'Sure Shot', use: 'Passive', makes: ['crit'], text: 'If you did not move, every hit Crits.', effect: 'sureShot' },
  apex: { name: 'Apex Predator', use: 'At will', target: 'Creature hit', reads: ['mark'], makes: ['mark', 'crit'], text: 'Apply 1 Mark. Hits on Marked aliens Crit.', effect: 'apex' },
  ghostShot: { name: 'Ghost Shot', use: 'Passive', text: 'Shoot through walls. Ignore Armor.', effect: 'psionic' },
  snapShot: { name: 'Snap Shot', use: 'Passive', text: 'If you moved, deal 1 more damage.', effect: 'snapShot' },
  deadeye: { name: 'Mercy Shot', use: 'Passive', makes: ['crit'], text: 'Hits on targets at half HP or less Crit.', effect: 'deadeye' },
  bigGame: { name: 'Big Game', use: 'Passive', text: `Deal ${T.bonus} more damage to targets with HP above yours.`, effect: 'bigGame' },
  camouflage: { name: 'Camouflage', use: 'Passive', text: `If you did not move, take ${T.soak} less damage per hit.`, effect: 'camouflage' },
  shroud: { name: 'Shroud', use: 'Reaction', target: 'Self', reads: ['kill'], text: `On kill ${T.far}+ tiles away, gain Cloak.`, effect: 'shroud' },
  killshot: { name: 'Killshot', use: 'Passive', text: `Deal ${T.kill} more damage to targets at a quarter HP or less.`, effect: 'killshot' },
  keenEye: { name: 'Keen Eye', use: 'Passive', makes: ['crit'], text: 'Gain 15% Crit chance.', stats: { crit: 0.15 } },
  perfectShot: { name: 'Perfect Shot', use: 'Passive', reads: ['crit'], text: `Crits deal ${T.kill} more damage.`, effect: 'perfectShot' },
  evasion: { name: 'Evasion', use: 'Passive', text: 'Take 1 less damage per hit.', effect: 'dodge' },
  untouchable: { name: 'Untouchable', use: 'Passive', text: `If you did not move, take ${T.kill} less damage per hit.`, effect: 'untouchable' },
  // Engineer
  deployMech: taught('engineer'),
  titan: { name: 'Titan Frame', use: 'Passive', text: `Mech gains ${TITAN_HEALTH} HP and 1 damage.`, effect: 'titan' },
  swarm: { name: 'Drone Swarm', use: 'Passive', text: `Deploy 2 drones instead of a mech: ${DRONE_STATS.hp} HP, ${DRONE_STATS.damage} damage, 2 more move. Aliens can ignore them.`, effect: 'swarm', teaches: true },
  launcher: { name: 'Caltrop Launcher', use: '1/battle', target: 'Path of an alien', text: 'Tiles cost 2 more move and deal 1 damage to aliens crossing.', effect: 'caltrops' },
  hardlight: { name: 'Hardlight Barrier', use: 'Reaction', target: 'Self', text: 'Parry 1 hit each battle.', effect: 'shield' },
  plating: { name: 'Reactive Plating', use: 'Passive', makes: ['armor'], text: `Mech gains ${PLATING_ARMOR} Armor.`, effect: 'plating' },
  rebuild: { name: 'Field Rebuild', use: 'Passive', text: 'Deploy 1 more time each battle.', charges: 1 },
  servos: { name: 'Overclocked Servos', use: 'Passive', text: 'Machines gain 2 move and 1 damage.', effect: 'servos' },
  detonate: { name: 'Self-Destruct', use: 'Reaction', target: 'Adjacent to its mech', text: 'When your mech dies, it deals 4 damage to adjacent aliens.', effect: 'detonate' },
  spotter: { name: 'Spotter Drones', use: 'At will', target: 'Hit by drones', makes: ['mark'], text: 'Drone hits apply 1 Mark.', effect: 'spotter' },
  linked: { name: 'Linked Targeting', use: 'Aura', range: '2 of a machine', target: 'Allies', text: 'You and allies within 2 tiles of your machine deal 1 more damage.', effect: 'linked' },
  hive: { name: 'Hive Mind', use: 'Passive', text: 'Deploy a 3rd drone.', effect: 'hive' },
  emp: { name: 'EMP Pulse', use: '1/battle', range: `${STUN_REACH} of it or machines`, target: '2+ aliens', text: `Stun aliens within ${STUN_REACH} tiles of you or your machines.`, effect: 'emp' },
  warMachine: { name: 'War Machine', use: 'Passive', text: `Mech gains ${WAR_MACHINE.hp} HP, ${WAR_MACHINE.damage} damage and ${WAR_MACHINE.range} range.`, effect: 'warMachine' },
  endlessSwarm: { name: 'Endless Swarm', use: 'Passive', text: `Start of turn: if aliens are in sight, deploy a drone. Max ${SWARM_LIMIT} at once, ${SWARM_BUILDS} a battle.`, effect: 'endlessSwarm' },
  shockRounds: { name: 'Shock Rounds', use: 'Reaction', target: 'Creature crit', reads: ['crit'], text: 'On Crit, Stun.', effect: 'concussion' },
  tesla: { name: 'Tesla Coil', use: 'Reaction', range: `${TESLA.reach}`, target: `${TESLA.bolts} nearest aliens`, text: `After acting, deal ${TESLA.damage} damage to the ${TESLA.bolts} nearest aliens within ${TESLA.reach} tiles.`, effect: 'tesla' },
  mechanic: { name: 'Mechanic', use: 'Passive', text: `Start of turn: machines heal ${T.heal}.`, effect: 'mechanic' },
  bodyguard: { name: 'Bodyguard', use: 'Passive', text: `While your machine is adjacent, take ${T.soak} less damage per hit.`, effect: 'bodyguard' },
  pilotLink: { name: 'Pilot Link', use: 'Passive', text: `While your machine fights, deal ${T.bonus} more damage.`, effect: 'pilotLink' },
  targetLink: { name: 'Target Link', use: 'Passive', text: `Machines deal ${T.bonus} more damage to the alien you last hit.`, effect: 'targetLink' },
  staticCharge: { name: 'Static Charge', use: 'Reaction', target: `Its every ${T.every}rd creature hit`, text: `Stun every ${T.every}rd alien you hit.`, effect: 'staticCharge' },
  arcWelder: { name: 'Arc Welder', use: 'At will', range: `${T.reach} of creature hit`, target: 'Nearest other alien', text: `Deal ${T.zap} damage to the nearest alien within ${T.reach} tiles of the target.`, effect: 'arcWelder' },
  overdrive: { name: 'Overdrive', use: 'Passive', text: `Machines deal ${T.big} more damage.`, effect: 'overdrive' },
  armoredDrones: { name: 'Armored Drones', use: 'Passive', text: `Machines take ${T.soak} less damage per hit.`, effect: 'armoredDrones' },
  hiveQueen: { name: 'Hive Queen', use: 'Reaction', reads: ['kill'], text: `When your machine kills, it and you heal ${T.heal}, up to ${TUNING.healCap} a battle.`, effect: 'hiveQueen' },
  exploitFault: { name: 'Exploit Fault', use: 'Passive', text: `Deal ${TUNING.opportunistDamage} more damage to Rooted or Stunned targets.`, effect: 'opportunist' },
  staticField: { name: 'Static Field', use: 'Passive', range: '2', target: 'Aliens', text: `Start of turn: deal ${T.zap} damage to aliens within 2 tiles.`, effect: 'staticField' },
  // Support
  healingLight: taught('support'),
  fieldKit: { name: 'Deep Wellspring', use: 'Passive', text: '2 more Healing Lights each battle.', charges: 2 },
  inspire: { name: 'Inspire', use: 'Aura', range: '2', target: 'It and allies', text: 'You and allies within 2 tiles deal 1 more damage.', effect: 'inspire' },
  barrier: { name: 'Shield of Faith', use: 'Passive', target: 'It and allies', makes: ['armor'], text: 'Start of battle: you and allies gain 2 Armor.', effect: 'barrier' },
  flashbang: { name: 'Blinding Light', use: '1/battle', range: 'Attack range', target: '2+ aliens together', text: 'Stun aliens in a group of 2+ in range.', effect: 'flashbang' },
  surgeon: { name: 'Greater Healing', use: 'Passive', text: 'Healing Light heals 3 more.', effect: 'surgeon' },
  revive: { name: 'Revivify', use: '1/battle', target: 'Itself, falling', text: 'When you would fall: get up with 3 HP.', effect: 'revive' },
  vitality: { name: 'Aura of Vitality', use: 'Aura', range: '2', target: 'It and wounded allies', text: 'Start of turn: you and allies within 2 tiles heal 1.', effect: 'vitality' },
  haste: { name: 'Haste', use: 'Aura', range: '2', target: 'It and allies', text: 'You and allies within 2 tiles gain 2 move.', effect: 'haste' },
  drone: { name: 'Spirit Guardian', use: 'Reaction', range: '5', target: 'Nearest alien in sight', text: 'After acting, deal 2 damage to the nearest alien in sight within 5 tiles.', effect: 'drone' },
  forceField: { name: 'Sanctuary', use: '1/battle', target: 'Self', makes: ['armor'], text: `At half HP or less: gain ${FORCE_FIELD_ARMOR} Armor.`, effect: 'forceField' },
  ward: { name: 'Aura of Courage', use: 'Aura', range: '2', target: 'It and allies', text: 'You and allies within 2 tiles are immune to Panic and acid.', effect: 'ward' },
  bane: { name: 'Bane', use: 'Aura', range: '3', target: 'Aliens', text: 'Aliens within 3 tiles deal 1 less damage.', effect: 'bane' },
  gravBeam: { name: 'Gravity Lash', use: 'At will', target: 'Creature hit', text: 'Pull 1.', effect: 'tether' },
  nullifier: { name: 'Silence', use: 'Aura', range: '3', target: 'Aliens', text: 'Aliens within 3 tiles cannot spit, Panic, spawn or burst.', effect: 'null' },
  fontOfLife: { name: 'Font of Life', use: 'Passive', range: `${FONT_REACH}`, target: 'Every wounded ally', text: `Healing Light heals to full, on you and allies within ${FONT_REACH} tiles.`, effect: 'fontOfLife' },
  sacredGround: { name: 'Sacred Ground', use: 'Aura', range: `${SACRED_REACH}`, target: 'It and allies', text: `You and allies within ${SACRED_REACH} tiles take half damage.`, effect: 'sacredGround' },
  command: { name: 'Command', use: 'Reaction', target: 'Self', text: 'After acting, attack again.', effect: 'command' },
  lifeLink: { name: 'Life Link', use: 'At will', range: `${T.reach}`, target: 'Most wounded of it and allies', text: `On hit, heal the most wounded of you and allies within ${T.reach} tiles 1, up to ${TUNING.healCap} a battle.`, effect: 'lifeLink' },
  transfusion: { name: 'Transfusion', use: 'Passive', range: `${T.reach}`, target: 'Nearest alien', text: `Start of turn: drain ${T.zap} HP from the nearest alien within ${T.reach} tiles.`, effect: 'transfusion' },
  rally: { name: 'Rally', use: 'Passive', range: '2', target: 'Most wounded of it and allies', makes: ['armor'], text: `Start of turn: the most wounded of you and allies within 2 tiles gains ${T.armor} Armor, up to ${T.armorMax}.`, effect: 'rally' },
  retribution: { name: 'Retribution', use: 'Aura', range: `${T.reach}`, target: 'Aliens that hit it or an ally', text: `When you or an ally within ${T.reach} tiles is hit, deal ${T.zap} damage to the attacker.`, effect: 'retribution' },
  battleHymn: { name: 'Battle Hymn', use: 'Aura', range: '2', target: 'It and allies', reads: ['kill'], text: 'When you or an ally within 2 tiles kills, the killer gains 1 Might.', effect: 'battleHymn' },
  smite: { name: 'Smite', use: 'Passive', text: `Deal ${T.big} more damage to aliens adjacent to you or an ally.`, effect: 'smite' },
  renewal: { name: 'Renewal', use: 'Passive', text: 'Start of turn: heal 1.', effect: 'regen' },
  wellspring: { name: 'Wellspring', use: 'Aura', range: '2', target: 'It and wounded allies', text: `Start of turn: you and allies within 2 tiles heal ${T.mend}.`, effect: 'wellspring' },
  guardian: { name: 'Guardian Angel', use: 'Aura', range: '2', target: 'It and allies', text: `You and allies within 2 tiles take ${T.soak} less damage per hit.`, effect: 'guardian' },
  warSong: { name: 'War Song', use: 'Aura', range: '2', target: 'It and allies', text: `You and allies within 2 tiles deal ${T.bonus} more damage.`, effect: 'warSong' },
  // Pyro
  fireball: taught('pyro'),
  tanks: { name: 'Deep Flame', use: 'Passive', text: '1 more Fireball each battle.', charges: 1 },
  tinder: { name: 'Flame Blade', use: 'At will', target: 'Creature hit', makes: ['burn'], text: 'Apply Burn.', effect: 'tinder' },
  fanFlames: { name: 'Fan the Flames', use: 'At will', target: 'Burning creature hit', reads: ['burn'], makes: ['burn'], text: `If Burning, apply ${TUNING.fanStacks} more Burn.`, effect: 'fanFlames' },
  fireSuit: { name: 'Flameborn', use: 'Passive', text: 'Immune to Burn.', effect: 'fireSuit' },
  inferno: { name: 'Inferno', use: 'Passive', makes: ['burn'], text: 'Fireball hits aliens within 2 tiles.', effect: 'inferno' },
  backdraft: { name: 'Backdraft', use: 'Reaction', target: 'Adjacent to its Burning kill', reads: ['burn', 'kill'], makes: ['burn'], text: 'On kill of a Burning alien, apply Burn to adjacent aliens.', effect: 'backdraft' },
  asbestos: { name: 'Hide of Cinders', use: 'Passive', text: 'Gain 3 HP.', stats: { hp: 3 } },
  searing: { name: 'Searing', use: 'Passive', reads: ['burn'], text: `Deal ${SEARING_DAMAGE} more damage to Burning targets.`, effect: 'searing' },
  stoke: { name: 'Stoke', use: 'Passive', reads: ['burn'], text: `On hit with ${TUNING.spend.burns}+ Burn, Consume it: per Burn, deal 1 more damage and gain 1 Temp HP.`, effect: 'accelerant' },
  smolder: { name: 'Smolder', use: 'Passive', reads: ['burn'], makes: ['burn'], text: `Burn you apply is ${LINGER_STACKS} more.`, effect: 'smolder' },
  burningAura: { name: 'Fire Shield', use: 'Reaction', target: 'Attacker', text: 'Thorns 1.', effect: 'thorns' },
  phoenixHeart: { name: 'Phoenix Heart', use: 'Passive', text: 'Start of turn: heal 1.', effect: 'regen' },
  firestorm: { name: 'Firestorm', use: 'Passive', reads: ['kill'], text: 'When Fireball kills, regain its use.', effect: 'firestorm' },
  conflagration: { name: 'Conflagration', use: 'Passive', reads: ['burn'], makes: ['burn'], text: `Burning aliens take ${CONFLAGRATION_DAMAGE} more damage each turn and spread Burn to adjacent aliens.`, effect: 'conflagration' },
  hellfire: { name: 'Hellfire', use: 'Aura', range: `${HELLFIRE_REACH}`, target: 'Aliens', makes: ['burn'], text: `Aliens starting a turn within ${HELLFIRE_REACH} tiles gain Burn.`, effect: 'hellfire' },
  pyromania: { name: 'Pyromania', use: 'Passive', reads: ['burn'], text: 'Deal 1 more damage per 2 Burning aliens, up to 3.', effect: 'pyromania' },
  cauterize: { name: 'Cauterize', use: 'Reaction', reads: ['burn', 'kill'], text: `On kill of a Burning alien, heal ${T.heal}, up to ${TUNING.healCap} a battle.`, effect: 'cauterize' },
  combust: { name: 'Combust', use: 'At will', target: 'Burning creature hit', reads: ['burn'], text: 'Consume its Burn: deal 1 damage per Burn.', effect: 'combust' },
  meltdown: { name: 'Meltdown', use: 'At will', target: 'Burning creature hit', reads: ['burn'], text: `If Burning, break ${T.crack} of its Armor.`, effect: 'meltdown' },
  heatShield: { name: 'Heat Shield', use: 'Passive', reads: ['burn'], text: 'Take 1 less damage per hit per Burning alien within 2 tiles, up to 3.', effect: 'heatShield' },
  cinderSkin: { name: 'Cinder Skin', use: 'Reaction', target: 'Adjacent attacker', reads: ['hurt'], makes: ['burn'], text: 'When hit by an adjacent alien: apply Burn to it.', effect: 'cinderSkin' },
  kindling: { name: 'Kindling', use: 'Passive', text: `Deal ${T.bonus} more damage to targets without Burn.`, effect: 'kindling' },
  whiteHeat: { name: 'White Heat', use: 'Passive', reads: ['burn'], text: `Deal ${T.kill} more damage to Burning targets.`, effect: 'whiteHeat' },
  spread: { name: 'Spreading Flames', use: 'At will', target: 'Alien adjacent to Burning creature hit', reads: ['burn'], makes: ['burn'], text: 'If Burning, apply Burn to an adjacent alien without Burn.', effect: 'spread' },
  firebrand: { name: 'Firebrand', use: 'Passive', reads: ['burn'], text: 'Deal 1 more damage per Burn on the target.', effect: 'firebrand' },
  emberWard: { name: 'Ember Ward', use: 'Passive', reads: ['burn'], text: `Take ${T.soak} less damage from Burning aliens.`, effect: 'emberWard' },
  emberHeart: { name: 'Ember Heart', use: 'Passive', reads: ['burn'], text: `Start of turn: if a Burning alien is within 2 tiles, heal ${T.heal}.`, effect: 'emberHeart' },
  // Cryo
  chillTouch: taught('cryo'),
  icebreak: { name: 'Icebreaker', use: 'Passive', reads: ['chill'], text: `Deal ${SEARING_DAMAGE} more damage to Chilled targets.`, effect: 'icebreak' },
  permafrost: { name: 'Permafrost', use: 'Passive', reads: ['chill'], makes: ['chill'], text: `Chill you apply is ${LINGER_STACKS} more.`, effect: 'permafrost' },
  iceArmor: { name: 'Ice Armor', use: 'Passive', makes: ['armor'], text: 'Gain 3 Armor.', stats: { armor: 3 } },
  coldSteel: { name: 'Cold Steel', use: 'Passive', text: 'Deal 1 more damage.', stats: { damage: 1 } },
  deepFreeze: { name: 'Deep Freeze', use: 'Reaction', target: 'Chilled alien crit', reads: ['crit', 'chill'], text: 'On Crit on a Chilled alien, Stun it.', effect: 'deepFreeze' },
  rimeLock: { name: 'Rime Lock', use: 'At will', target: 'Alien it Chills', reads: ['chill'], text: 'Chill you apply also Roots.', effect: 'rimeLock' },
  glassEdge: { name: 'Glass Edge', use: 'Passive', reads: ['chill'], text: `On hit with ${TUNING.spend.chills}+ Chill, Consume it: deal 1 more damage per Chill. Stun.`, effect: 'glassEdge' },
  longRange: { name: 'Long Reach', use: 'Passive', text: 'Bonus attack reaches 2 tiles farther.', effect: 'longshot' },
  frostAura: { name: 'Frost Aura', use: 'Reaction', target: 'Attacker', reads: ['hurt'], makes: ['chill'], text: 'When hit: apply Chill to the attacker.', effect: 'rime' },
  glide: { name: 'Ice Glide', use: 'Reaction', text: retreat, effect: 'skirmish' },
  cryostasis: { name: 'Cryostasis', use: '1/battle', target: 'Self', text: 'When you would fall: survive at 1 HP.', effect: 'lastStand' },
  frozenHeart: { name: 'Frozen Heart', use: 'At will', target: 'Chilled alien hit', reads: ['chill'], text: 'On hit on a Chilled alien, Freeze it.', effect: 'frozenHeart' },
  glacialArmor: { name: 'Glacial Armor', use: 'Passive', makes: ['armor'], text: 'Start of turn: restore Armor in full.', effect: 'glacialArmor' },
  rimeGrip: { name: 'Rime Grip', use: 'Passive', text: `Deal ${TUNING.gripDamage} more damage to adjacent targets.`, effect: 'rimeGrip' },
  shardstorm: { name: 'Shardstorm', use: 'At will', target: 'Adjacent to creature hit', makes: ['chill'], text: `Deal ${SHARD_DAMAGE} damage to adjacent aliens. Apply Chill to them.`, effect: 'shardstorm' },
  flashFreeze: { name: 'Flash Freeze', use: 'At will', target: 'Chilled creature hit', reads: ['chill'], makes: ['chill'], text: 'If Chilled, apply 1 more Chill.', effect: 'flashFreeze' },
  shatterpoint: { name: 'Shatterpoint', use: 'Passive', reads: ['chill'], text: `Deal ${T.big} more damage to Frozen targets.`, effect: 'shatterpoint' },
  coldSnap: { name: 'Cold Snap', use: 'Aura', range: '1', target: 'Aliens', makes: ['chill'], text: 'Start of turn: apply Chill to adjacent aliens.', effect: 'coldSnap' },
  frostShell: { name: 'Frost Shell', use: 'Passive', reads: ['chill'], text: `Take ${T.soak} less damage from Chilled aliens.`, effect: 'frostShell' },
  splinter: { name: 'Splinter', use: 'Reaction', target: 'Adjacent to creature crit', reads: ['crit'], makes: ['chill'], text: 'On Crit, apply Chill to aliens adjacent to the target.', effect: 'splinter' },
  iceSpear: { name: 'Ice Spear', use: 'Passive', reads: ['chill'], text: 'Ignore Armor on Chilled targets.', effect: 'iceSpear' },
  brittle: { name: 'Brittle', use: 'Passive', reads: ['chill'], text: `Deal ${T.kill} more damage to Chilled targets.`, effect: 'brittle' },
  iceAge: { name: 'Ice Age', use: 'Reaction', target: 'Adjacent to its Chilled kill', reads: ['chill', 'kill'], text: 'On kill of a Chilled alien, Stun adjacent aliens.', effect: 'iceAge' },
  polarVortex: { name: 'Polar Vortex', use: 'Aura', range: '2', target: 'Aliens', makes: ['chill'], text: 'Start of turn: apply Chill to aliens within 2 tiles.', effect: 'polarVortex' },
  iceLance: { name: 'Ice Lance', use: 'Passive', text: `Deal ${T.bonus} more damage to targets ${T.far}+ tiles away.`, effect: 'artillery' },
  glacialSpike: { name: 'Glacial Spike', use: 'Passive', reads: ['crit'], text: `Crits deal ${T.kill} more damage.`, effect: 'perfectShot' },
  // Phantom
  cloak: taught('phantom'),
  shadowStrike: { name: 'Shadow Strike', use: 'Passive', text: `Attacks out of Cloak deal ${SHADOW_DAMAGE} more damage.`, effect: 'shadowStrike' },
  vanish: { name: 'Vanish', use: '1/battle', target: 'Self', text: 'At half HP or less: gain Cloak.', effect: 'vanish' },
  daze: { name: 'Unseen Blade', use: 'At will', target: 'Creature hit out of Cloak', text: 'Attacks out of Cloak Stun.', effect: 'daze' },
  deepCloak: { name: 'Deep Cloak', use: 'Passive', text: '1 more Cloak each battle.', charges: 1 },
  afterimage: { name: 'Afterimage', use: 'Reaction', target: 'Self', reads: ['kill'], text: 'On kill out of Cloak, gain Cloak again.', effect: 'afterimage' },
  knifeWork: { name: 'Knife Work', use: 'Passive', text: 'Deal 2 more damage to targets with no adjacent alien.', effect: 'backstab' },
  phaseShift: { name: 'Phase Shift', use: 'Passive', text: 'Take 1 less damage per hit.', effect: 'dodge' },
  fadeOut: { name: 'Fade Out', use: 'Reaction', text: retreat, effect: 'skirmish' },
  shadowStep: { name: 'Shadow Step', use: 'Passive', text: 'Gain 2 move.', stats: { move: 2 } },
  flurry: { name: 'Flurry', use: 'Passive', makes: ['shots'], text: 'Weapons with 2+ shots fire 1 more.', effect: 'hairTrigger' },
  smokeBomb: { name: 'Darkness', use: '1/battle', range: 'Attack range', target: '2+ aliens together', text: 'Stun aliens in a group of 2+ in range.', effect: 'flashbang' },
  livingShadow: { name: 'Living Shadow', use: 'Passive', text: 'Attacking does not end Cloak.', effect: 'livingShadow' },
  intangible: { name: 'Intangible', use: 'Passive', text: 'Hits on you miss 50% of the time.', effect: 'intangible' },
  opportunist: { name: 'Opportunist', use: 'Passive', text: `Deal ${TUNING.opportunistDamage} more damage to Rooted or Stunned targets.`, effect: 'opportunist' },
  bladeDance: { name: 'Blade Dance', use: 'At will', text: `Bonus attack also hits ${FAN_TARGETS} more aliens in reach.`, effect: 'bladeDance' },
  ambush: { name: 'Ambush', use: 'Passive', text: `First hit each battle: ${T.big} more damage.`, effect: 'ambush' },
  shadowFeed: { name: 'Shadow Feed', use: 'Reaction', reads: ['kill'], text: `On kill, heal ${T.heal}, up to ${TUNING.healCap} a battle.`, effect: 'shadowFeed' },
  wraithForm: { name: 'Wraith Form', use: 'Passive', text: `At half HP or less, take ${T.soak} less damage per hit.`, effect: 'wraithForm' },
  soulDrain: { name: 'Soul Drain', use: 'At will', target: 'Self', text: `On hit, heal 1, up to ${TUNING.healCap} a battle.`, effect: 'soulDrain' },
  venom: { name: 'Venom', use: 'At will', target: 'Creature hit', text: 'Apply Weak.', effect: 'venom' },
  bloodScent: { name: 'Blood Scent', use: 'Passive', text: `Deal ${T.bonus} more damage to targets at half HP or less.`, effect: 'bloodScent' },
  killerInstinct: { name: 'Killer Instinct', use: 'Passive', makes: ['crit'], text: 'Gain 15% Crit chance.', stats: { crit: 0.15 } },
  nightmare: { name: 'Nightmare', use: 'Reaction', range: '2', target: 'Aliens near its kill', reads: ['kill'], text: 'On kill, Stun aliens within 2 tiles of it.', effect: 'nightmare' },
  deathless: { name: 'Deathless', use: '1/battle', target: 'Self', text: 'When you would fall: survive at 1 HP.', effect: 'lastStand' },
  soulHarvest: { name: 'Soul Harvest', use: 'Reaction', reads: ['kill'], text: `On kill, gain 1 Might and heal ${T.heal}, up to ${TUNING.healCap} a battle.`, effect: 'soulHarvest' },
  cutthroat: { name: 'Cutthroat', use: 'Passive', text: `Deal ${TUNING.gripDamage} more damage to adjacent targets.`, effect: 'rimeGrip' },
  thousandCuts: { name: 'Thousand Cuts', use: 'Passive', text: 'Deal 1 more damage per 2 hits landed this battle, up to 4.', effect: 'thousandCuts' },
  // Ultimates, each once a battle
  killingSpree: { name: 'Killing Spree', use: '1/battle', range: `${SPREE.reach}`, target: `Up to ${SPREE.strikes} aliens in turn`, text: `Flash to each target. Deal your damage plus ${SPREE.damage}.`, effect: 'killingSpree' },
  indestructible: { name: 'Indestructible', use: '1/battle', target: 'Self at half HP', text: `At half HP or less: take no damage for ${INDESTRUCTIBLE.turns} turns. Gain ${INDESTRUCTIBLE.damage} Might.`, effect: 'indestructible' },
  levelBlock: { name: 'Level the Block', use: '1/battle', range: `${LEVEL_BLOCK.radius}`, target: '2+ aliens', text: `Flatten everything within ${LEVEL_BLOCK.radius} tiles. Deal ${LEVEL_BLOCK.damage} damage to each alien.`, effect: 'levelBlock' },
  extinction: { name: 'Extinction Event', use: '1/battle', target: `${EXTINCTION.meteors} meteors, thickest knots`, text: `Each meteor deals ${EXTINCTION.damage} damage within ${EXTINCTION.radius} tiles and flattens the ground.`, effect: 'extinction' },
  titanForm: { name: 'Titan Form', use: '1/battle', target: 'Self at half HP', text: `At half HP or less: gain ${TITAN_FORM.hp} HP, ${TITAN_FORM.armor} Armor and ${TITAN_FORM.damage} damage. Heal to full.`, effect: 'titanForm' },
  earthquake: { name: 'Earthquake', use: '1/battle', range: `${QUAKE.radius}`, target: '2+ aliens', text: `Deal ${QUAKE.damage} damage to aliens within ${QUAKE.radius} tiles. Stun them, bosses too.`, effect: 'earthquake' },
  bulletTime: { name: 'Bullet Time', use: '1/battle', target: `Up to ${BULLET_TIME.targets} aliens in sight`, text: `Crit each target for ${BULLET_TIME.damage} more damage.`, effect: 'bulletTime' },
  deathSentence: { name: 'Death Sentence', use: '1/battle', target: 'Toughest alien, boss or not', text: `Deal half its HP plus ${SENTENCE} damage. Ignore Armor.`, effect: 'deathSentence' },
  hallOfMirrors: { name: 'Hall of Mirrors', use: '1/battle', target: 'Self', text: `Summon ${MIRRORS.images} images with ${MIRRORS.hp} HP. They attack and draw all fire.`, effect: 'hallOfMirrors' },
  colossus: { name: 'Colossus', use: '1/battle', target: 'Adjacent', text: `Deploy a colossus: ${COLOSSUS.hp} HP, ${COLOSSUS.armor} Armor, ${COLOSSUS.damage} damage. Aliens that can shoot it must.`, effect: 'colossus' },
  droneStorm: { name: 'Drone Storm', use: '1/battle', target: 'Aliens in the fight', text: `Rain ${DRONE_STORM.strikes} strikes of ${DRONE_STORM.damage} damage on aliens.`, effect: 'droneStorm' },
  orbital: { name: 'Orbital Lance', use: '1/battle', range: `Line of ${ORBITAL.length}`, target: 'The line through the most aliens', text: `Deal ${ORBITAL.damage} damage to aliens on the line. Ignore Armor. Flatten it.`, effect: 'orbital' },
  resurrection: { name: 'Resurrection', use: '1/battle', target: 'Itself, at a third of HP or less', text: 'At a third HP or less: heal to full.', effect: 'resurrection' },
  divineShield: { name: 'Divine Shield', use: '1/battle', target: 'It and allies, at half HP', text: `At half HP or less: you and allies take no damage for ${SHIELD_TURNS} turns.`, effect: 'divineShield' },
  timeStop: { name: 'Time Stop', use: '1/battle', target: 'Every alien, boss too', text: `Every alien, bosses too, skips its next ${TIME_STOP} turns.`, effect: 'timeStop' },
  supernova: { name: 'Supernova', use: '1/battle', range: `${SUPERNOVA.radius}`, target: '2+ aliens', makes: ['burn'], text: `Deal ${SUPERNOVA.damage} damage to aliens within ${SUPERNOVA.radius} tiles. Apply Burn. Lose half your HP.`, effect: 'supernova' },
  worldAblaze: { name: 'World Ablaze', use: '1/battle', target: 'Every alien in the fight', makes: ['burn'], text: `Destroy every alien's Armor. Deal ${ABLAZE.damage} damage. Apply ${ABLAZE.burn} Burn to aliens on fire.`, effect: 'worldAblaze' },
  phoenixRising: { name: 'Phoenix Rising', use: '1/battle', range: `${PHOENIX_RISING.radius}`, target: 'Self, as it falls', makes: ['burn'], text: `When you would fall: heal to full. Deal ${PHOENIX_RISING.damage} damage to aliens within ${PHOENIX_RISING.radius} tiles. Apply Burn.`, effect: 'phoenixRising' },
  absoluteZero: { name: 'Absolute Zero', use: '1/battle', target: 'Every alien in the fight', makes: ['chill'], text: `Deal ${ZERO.damage} damage to every alien. Ignore Armor. Each skips ${ZERO.frozen} turns, a boss 1.`, effect: 'absoluteZero' },
  blizzard: { name: 'Blizzard', use: '1/battle', range: `${BLIZZARD.radius}`, target: 'Aliens around it', makes: ['chill'], text: `For ${BLIZZARD.turns} turns, deal ${BLIZZARD.damage} damage to aliens within ${BLIZZARD.radius} tiles. Apply Chill.`, effect: 'blizzard' },
  hailOfIcicles: { name: 'Hail of Icicles', use: '1/battle', target: 'Aliens in the fight', makes: ['chill'], text: `Rain ${HAIL.shards} shards of ${HAIL.damage} damage on aliens. Each applies Chill.`, effect: 'hailOfIcicles' },
  eclipse: { name: 'Eclipse', use: '1/battle', target: 'Itself', text: 'Gain Cloak.', effect: 'eclipse' },
  reap: { name: 'Reap', use: '1/battle', target: 'Every alien in the fight', text: 'Kill every alien at half HP or less, bar bosses. The rest lose half their HP.', effect: 'reap' },
  phantomLegion: { name: 'Phantom Legion', use: '1/battle', target: `${LEGION.blades} strikes in the fight`, text: `Strike ${LEGION.blades} times for your damage plus ${LEGION.damage}. Ignore Armor.`, effect: 'phantomLegion' },
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
