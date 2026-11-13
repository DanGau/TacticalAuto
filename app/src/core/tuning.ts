// Balance numbers.
export const TUNING = {
  /** Every alien's health, as a multiple of its kind's. */
  alienHp: 0.4,
  /** Damage every alien's attack adds. */
  alienDamage: -2,
  /** The alien force a battle has in each leg, before its risk and kind are counted. */
  legForce: [3, 10, 18, 20],
  /** Damage each hit on a marked unit adds. */
  markDamage: 1,
  /** The share of the hero's damage each stack a payoff spends adds; and the burn, chill and marks Accelerant Gel, Shatterglass Edge and Spotter Network wait for. */
  spend: { factor: 1, burns: 2, chills: 2, marks: 2 },
  /** Damage landing charges deal each alien they reach, before Breaching Charges add theirs. */
  impactDamage: 2,
  /** Damage Rime Grip adds to hits on a target beside its cryo. */
  gripDamage: 2,
  /** Damage Opportunist adds to hits on a target rooted or stunned. */
  opportunistDamage: 2,
  /** Burn stacks Fan the Flames adds to a burning target hit. */
  fanStacks: 1,
  /** Health each on-hit or on-kill healing source may give a unit a battle. */
  healCap: 3,
  /** Supplies an overrun zone pays. */
  dangerSupplies: 4,
  /** The share of its own force the hunt adds to a battle at full threat. */
  hunt: 0.5,
}

/** How much each talent gives or takes, and how far it reaches. */
export const TALENT = {
  /** Damage more a hit does by a talent: most, the bigger, the biggest. */
  bonus: 2,
  big: 3,
  kill: 4,
  /** Damage less a hit does by a guard talent. */
  soak: 2,
  /** Tiles at which a talent counts a target far. */
  far: 4,
  /** Armor Cracking Blow and Meltdown break. */
  crack: 2,
  /** Every how many hits Static Charge stuns. */
  every: 3,
  /** Damage a zapping talent deals, and how far a reaching one reaches. */
  zap: 2,
  reach: 3,
  /** HP a healing talent gives. */
  heal: 3,
  /** Armor Bedrock and Rally give a turn, and the most above its own they build to. */
  armor: 2,
  armorMax: 4,
  /** Armor Hardened builds to above its own; HP Wellspring heals a turn. */
  hardMax: 6,
  mend: 2,
  /** Move Carnage gives a kill, to at most this much. */
  moveMax: 3,
}
