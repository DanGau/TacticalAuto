// Balance numbers.
export const TUNING = {
  /** Every alien's health, as a multiple of its kind's. */
  alienHp: 0.38,
  /** Every alien's attack damage, as a multiple of its kind's: at least 1 before its weapon. */
  alienDamage: 0.3,
  /** Damage more every `every`th alien of a road battle hits for, from the leg after `from` keys: the road wears the hero down. */
  roadDamage: { damage: 1, from: 3, every: 3 },
  /** The alien force a battle has in each leg, before its risk and kind are counted. */
  legForce: [3, 7, 9, 11],
  /** Damage each hit on a marked unit adds. */
  markDamage: 1,
  /** The share of the hero's damage each stack a payoff spends adds; and the burn, chill and marks Accelerant Gel, Shatterglass Edge and Spotter Network wait for. */
  spend: { factor: 1, burns: 2, chills: 2, marks: 2 },
  /** Damage landing charges deal each alien they reach, before Breaching Charges add theirs. */
  impactDamage: 2,
  /** Health each on-hit or on-kill healing source may give a unit a battle. */
  healCap: 3,
  /** Supplies an overrun zone pays. */
  dangerSupplies: 4,
  /** The share of its own force the hunt adds to a battle at full threat. */
  hunt: 0.5,
}
