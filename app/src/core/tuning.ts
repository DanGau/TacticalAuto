// Balance numbers.
export const TUNING = {
  /** Every alien's health, as a multiple of its kind's. */
  alienHp: 0.3,
  /** Damage every alien's attack adds. */
  alienDamage: -1,
  /** The alien force a battle has in each leg, before its risk and kind are counted. */
  legForce: [3, 10, 18, 20],
  /** Damage each hit on a marked unit adds. */
  markDamage: 1,
  /** Damage Accelerant Gel adds to hits on a burning target. */
  accelerantDamage: 1,
  /** Damage Shatterglass Edge adds to hits on a chilled target. */
  shatterDamage: 2,
  /** Damage Thermal Shock Core adds to hits on a target both burning and chilled. */
  thermalDamage: 3,
  /** Damage landing charges deal each alien they reach, before Breaching Charges add theirs. */
  impactDamage: 2,
  /** Damage Rime Grip adds to hits on a target beside its cryo. */
  gripDamage: 2,
  /** Damage Opportunist adds to hits on a target rooted or stunned. */
  opportunistDamage: 2,
  /** Burn stacks Fan the Flames adds to a burning target hit. */
  fanStacks: 1,
  /** Supplies an overrun zone pays. */
  dangerSupplies: 4,
  /** The share of its own force the hunt adds to a battle at full threat. */
  hunt: 0.5,
}

/** How much each talent gives or takes, and how far it reaches. */
export const TALENT = {
  /** Damage more a hit does by Battle Joy, Charge, Demolisher, Artillery, Big Game, Pilot Link, Target Link and Blood Scent. */
  bonus: 2,
  /** Damage more by Ambush, Shatterpoint, Smite; by Killshot. */
  big: 3,
  kill: 4,
  /** Damage less a hit does by Grit, Stand Alone, Camouflage, Bodyguard, Frost Shell and Wraith Form. */
  soak: 2,
  /** Tiles at which Artillery and Shroud count a target far. */
  far: 4,
  /** Armor Cracking Blow and Meltdown break. */
  crack: 2,
  /** Every how many hits Static Charge stuns. */
  every: 3,
  /** Damage Arc Welder, Retribution and Resonance deal, and the reach of Arc Welder, Life Link and Retribution. */
  zap: 2,
  reach: 3,
  /** HP Cauterize, Shadow Feed, Mechanic and Transfusion give; Life Link and Soul Drain give 1. */
  heal: 3,
  /** Armor Bedrock and Rally give a turn, and the most above its own they build to. */
  armor: 2,
  armorMax: 4,
  /** Move Carnage gives a kill, to at most this much. */
  moveMax: 3,
}
