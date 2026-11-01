// Every effect a skill can have.

/** Tier 4 effects: each hero's moment, once a battle. */
export const ULTIMATE_EFFECTS = [
  'killingSpree', 'indestructible', 'levelBlock', 'extinction', 'titanForm', 'earthquake', 'bulletTime',
  'deathSentence', 'hallOfMirrors', 'colossus', 'droneStorm', 'orbital', 'resurrection', 'divineShield', 'timeStop',
  'supernova', 'worldAblaze', 'phoenixRising', 'absoluteZero', 'blizzard', 'hailOfIcicles', 'eclipse', 'reap',
  'phantomLegion',
] as const

export const SKILL_EFFECTS = [
  'thorns', 'shield', 'rime', 'regen', 'lastStand', 'mirror', 'blink', 'polymorph', 'null', 'caltrops', 'titan',
  'plating', 'servos', 'detonate', 'swarm', 'spotter', 'linked', 'hive', 'shock', 'frenzy', 'backstab', 'rage',
  'dodge', 'longshot', 'shred', 'suppress', 'bulwark', 'overwatch', 'steady', 'headshot', 'mark', 'doubleTap',
  'pierce', 'revive', 'inspire', 'barrier', 'surgeon', 'surge', 'throw', 'secondWind', 'skirmish', 'reckless',
  'cleave', 'taunt', 'steadfast', 'bigBlast', 'concussion', 'assassinate', 'slayer', 'volley', 'elusive', 'haste',
  'vitality', 'bane', 'ward', 'drone', 'inferno', 'fireSuit', 'tinder', 'searing', 'backdraft', 'smolder',
  'icebreak', 'frostbreak', 'deepFreeze', 'avalanche', 'permafrost', 'rimeLock', 'leap', 'hurl', 'slam', 'warcry',
  'emp', 'flashbang', 'forceField', 'firewall', 'shadowStrike', 'vanish', 'daze', 'afterimage', 'bloodbath',
  'riposte', 'earthshaker', 'impact', 'fortress', 'aftershock', 'sureShot', 'apex', 'warMachine', 'endlessSwarm',
  'tesla', 'fontOfLife', 'sacredGround', 'command', 'firestorm', 'conflagration', 'hellfire', 'frozenHeart',
  'glacialArmor', 'shardstorm', 'livingShadow', 'intangible', 'bladeDance',
  ...ULTIMATE_EFFECTS,
] as const
