// Every effect a skill can have.

/** Tier 4 effects: each hero's moment, once a battle. */
export const ULTIMATE_EFFECTS = [
  'killingSpree', 'indestructible', 'levelBlock', 'extinction', 'titanForm', 'earthquake', 'bulletTime',
  'deathSentence', 'hallOfMirrors', 'colossus', 'droneStorm', 'orbital', 'resurrection', 'divineShield', 'timeStop',
  'supernova', 'worldAblaze', 'phoenixRising', 'absoluteZero', 'blizzard', 'hailOfIcicles', 'eclipse', 'reap',
  'phantomLegion',
] as const

export const SKILL_EFFECTS = [
  'thorns', 'shield', 'rime', 'regen', 'lastStand', 'mirror', 'blink', 'null', 'caltrops', 'titan',
  'plating', 'servos', 'detonate', 'swarm', 'spotter', 'linked', 'hive', 'frenzy', 'backstab', 'rage',
  'dodge', 'longshot', 'shred', 'suppress', 'bulwark', 'steady', 'headshot', 'mark', 'doubleTap',
  'pierce', 'revive', 'inspire', 'barrier', 'surgeon', 'surge', 'secondWind', 'skirmish', 
  'cleave', 'taunt', 'steadfast', 'bigBlast', 'concussion', 'assassinate', 'slayer', 'volley', 'elusive', 'haste',
  'vitality', 'bane', 'ward', 'drone', 'inferno', 'fireSuit', 'tinder', 'searing', 'backdraft', 'smolder',
  'icebreak', 'deepFreeze', 'permafrost', 'rimeLock', 'leap', 'hurl', 'slam', 'warcry',
  'emp', 'flashbang', 'forceField', 'shadowStrike', 'vanish', 'daze', 'afterimage', 'bloodbath',
  'riposte', 'earthshaker', 'impact', 'fortress', 'aftershock', 'sureShot', 'apex', 'warMachine', 'endlessSwarm',
  'tesla', 'fontOfLife', 'sacredGround', 'command', 'firestorm', 'conflagration', 'hellfire', 'frozenHeart',
  'glacialArmor', 'shardstorm', 'repulse', 'gale', 'livingShadow', 'intangible', 'bladeDance',
  'lasting', 'shieldSlam', 'combo', 'projectile', 'faultLine',
  ...ULTIMATE_EFFECTS,
] as const
